-- ============================================================
-- Correctness / security hardening for the cash-pay obesity launch.
-- Forward-only.
-- ============================================================

-- ---------- 1. Governance role + facility mapping containment ----------
DROP POLICY IF EXISTS "vendor mappings readable by admins" ON public.vendor_identity_mappings;
CREATE POLICY "vendor mappings readable by admins"
ON public.vendor_identity_mappings FOR SELECT TO authenticated
USING (
  public.is_my_hospital(hospital_id)
  AND (public.has_role(auth.uid(), 'admin')
       OR public.has_governance_role(auth.uid(), hospital_id, 'compliance'))
);

CREATE OR REPLACE FUNCTION public.enforce_vendor_identity_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  IF NEW.vendor_identifier ~* '(secret|password|token|api[ _-]?key|bearer|private)' THEN
    RAISE EXCEPTION 'vendor_identifier must be an identifier, never a credential value';
  END IF;
  IF NEW.subject_type = 'patient' AND NOT EXISTS (
       SELECT 1 FROM public.patients p WHERE p.id = NEW.subject_id AND p.hospital_id = NEW.hospital_id) THEN
    RAISE EXCEPTION 'patient mapping must reference a patient in this facility';
  END IF;
  IF NEW.subject_type = 'prescriber' AND NOT EXISTS (
       SELECT 1 FROM public.hospital_users hu WHERE hu.user_id = NEW.subject_id AND hu.hospital_id = NEW.hospital_id) THEN
    RAISE EXCEPTION 'prescriber mapping must reference a member of this facility';
  END IF;
  IF NEW.subject_type = 'facility' AND NEW.subject_id <> NEW.hospital_id THEN
    RAISE EXCEPTION 'facility mapping subject_id must equal hospital_id';
  END IF;
  NEW.created_by := auth.uid();
  RETURN NEW;
END $$;
REVOKE ALL ON FUNCTION public.enforce_vendor_identity_mapping() FROM public, anon, authenticated;

-- ---------- 2. Governance artifact kinds + DoseSpot prescriber credentials ----------
ALTER TABLE public.clinical_protocols DROP CONSTRAINT IF EXISTS clinical_protocols_kind_check;
ALTER TABLE public.clinical_protocols ADD CONSTRAINT clinical_protocols_kind_check
  CHECK (kind IN ('protocol','order_set','red_flag_screen','escalation_rule','documentation_template',
                  'prescribing_limit','service_scope_map','obesity_intake','note_template'));

ALTER TABLE public.staff_credentials DROP CONSTRAINT IF EXISTS staff_credentials_credential_type_check;
ALTER TABLE public.staff_credentials ADD CONSTRAINT staff_credentials_credential_type_check
  CHECK (credential_type IN ('identity','license','dea_registration','state_controlled_substance','malpractice',
                             'payer_enrollment','training','background_check','privilege',
                             'dosespot_identity_proofing','dosespot_two_factor','dosespot_epcs_enrollment'));

-- Individual prescriber EPCS evidence. Facility-level booleans are never sufficient.
CREATE OR REPLACE FUNCTION public.dosespot_prescriber_epcs_ok(
  p_hospital_id uuid, p_user_id uuid, p_state_code text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT p_user_id IS NOT NULL
    AND (SELECT count(DISTINCT credential_type) FROM public.staff_credentials
          WHERE hospital_id = p_hospital_id AND user_id = p_user_id AND status = 'verified'
            AND effective_date <= current_date
            AND (expiration_date IS NULL OR expiration_date >= current_date)
            AND credential_type IN ('dosespot_identity_proofing','dosespot_two_factor',
                                    'dosespot_epcs_enrollment','dea_registration')) = 4
    AND EXISTS (SELECT 1 FROM public.staff_credentials
                 WHERE hospital_id = p_hospital_id AND user_id = p_user_id
                   AND credential_type = 'state_controlled_substance' AND status = 'verified'
                   AND (state_code IS NULL OR state_code = p_state_code)
                   AND effective_date <= current_date
                   AND (expiration_date IS NULL OR expiration_date >= current_date));
$$;
REVOKE ALL ON FUNCTION public.dosespot_prescriber_epcs_ok(uuid, uuid, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.dosespot_prescriber_epcs_ok(uuid, uuid, text) TO service_role;

-- ---------- 3. Admin-configurable cash-pay service fee ----------
CREATE TABLE public.cash_pay_service_fees (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  service_line_id uuid NOT NULL REFERENCES public.service_lines(id) ON DELETE CASCADE,
  state_code text CHECK (state_code ~ '^[A-Z]{2}$'),
  fee_reference text NOT NULL CHECK (length(btrim(fee_reference)) BETWEEN 1 AND 80),
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  effective_start date NOT NULL DEFAULT current_date,
  effective_end date,
  active boolean NOT NULL DEFAULT true,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.cash_pay_service_fees TO authenticated;
GRANT ALL ON public.cash_pay_service_fees TO service_role;
ALTER TABLE public.cash_pay_service_fees ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service fees readable in my hospital" ON public.cash_pay_service_fees
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "service fees managed by hospital admins" ON public.cash_pay_service_fees
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));
CREATE POLICY "service fees updated by hospital admins" ON public.cash_pay_service_fees
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

CREATE UNIQUE INDEX cash_pay_service_fees_active_key
  ON public.cash_pay_service_fees (hospital_id, service_line_id, coalesce(state_code, '*'))
  WHERE active;

CREATE TRIGGER cash_pay_service_fees_updated_at
  BEFORE UPDATE ON public.cash_pay_service_fees
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- 4. Cash pay becomes read-only to ordinary staff ----------
DROP POLICY IF EXISTS "cash pay insertable in my hospital" ON public.encounter_cash_pay;
DROP POLICY IF EXISTS "cash pay updatable in my hospital" ON public.encounter_cash_pay;
REVOKE INSERT, UPDATE ON public.encounter_cash_pay FROM authenticated;

-- Single server-authoritative payment action. The client supplies only an
-- action and a PHI-minimized external receipt reference / waiver reason.
CREATE OR REPLACE FUNCTION public.record_cash_pay(
  p_encounter_id uuid,
  p_action text,
  p_payment_reference text DEFAULT NULL,
  p_reason text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e public.encounters; f public.cash_pay_service_fees; cp public.encounter_cash_pay; sl uuid;
BEGIN
  IF p_action NOT IN ('settle','waive','refund','void','chargeback') THEN
    RETURN jsonb_build_object('status','error','reason','invalid_action');
  END IF;
  SELECT * INTO e FROM public.encounters WHERE id = p_encounter_id;
  IF e.id IS NULL OR NOT public.is_my_hospital(e.hospital_id) THEN
    RETURN jsonb_build_object('status','error','reason','encounter_not_found');
  END IF;
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RETURN jsonb_build_object('status','error','reason','not_authorized');
  END IF;

  SELECT cr.service_line_id INTO sl FROM public.care_requests cr
   WHERE cr.encounter_id = p_encounter_id ORDER BY cr.created_at DESC LIMIT 1;

  SELECT * INTO cp FROM public.encounter_cash_pay WHERE encounter_id = p_encounter_id;
  IF cp.id IS NULL THEN
    SELECT * INTO f FROM public.cash_pay_service_fees
      WHERE hospital_id = e.hospital_id AND service_line_id = sl AND active
        AND effective_start <= current_date
        AND (effective_end IS NULL OR effective_end >= current_date)
        AND (state_code IS NULL OR state_code = e.patient_state_code)
      ORDER BY (state_code IS NULL) LIMIT 1;
    IF f.id IS NULL THEN
      RETURN jsonb_build_object('status','error','reason','no_service_fee_configured');
    END IF;
    INSERT INTO public.encounter_cash_pay
      (hospital_id, encounter_id, patient_id, service_line_id, fee_reference, amount_cents, currency)
    VALUES (e.hospital_id, p_encounter_id, e.patient_id, sl, f.fee_reference, f.amount_cents, f.currency)
    RETURNING * INTO cp;
  END IF;

  IF p_action = 'settle' THEN
    IF coalesce(btrim(p_payment_reference), '') = '' THEN
      RETURN jsonb_build_object('status','error','reason','external_payment_reference_required');
    END IF;
    UPDATE public.encounter_cash_pay
       SET payment_status = 'settled', processor = 'external_reference',
           payment_reference = btrim(p_payment_reference), receipt_status = 'issued'
     WHERE id = cp.id RETURNING * INTO cp;

  ELSIF p_action = 'waive' THEN
    IF length(coalesce(btrim(p_reason), '')) < 10 THEN
      RETURN jsonb_build_object('status','error','reason','waiver_reason_required');
    END IF;
    UPDATE public.encounter_cash_pay
       SET payment_status = 'waived', waiver_reason = btrim(p_reason)
     WHERE id = cp.id RETURNING * INTO cp;

  ELSIF p_action = 'void' THEN
    UPDATE public.encounter_cash_pay SET payment_status = 'voided' WHERE id = cp.id RETURNING * INTO cp;

  ELSE -- refund | chargeback: financial only, clinical records are never rewritten
    IF cp.payment_status <> 'settled' THEN
      RETURN jsonb_build_object('status','error','reason','no_settled_payment');
    END IF;
    UPDATE public.encounter_cash_pay
       SET payment_status = 'refunded',
           refund_status = CASE WHEN p_action = 'chargeback' THEN 'chargeback' ELSE 'requested' END
     WHERE id = cp.id RETURNING * INTO cp;
    INSERT INTO public.encounter_events
      (encounter_id, patient_id, hospital_id, actor_id, event_code, reason, metadata)
    VALUES (p_encounter_id, e.patient_id, e.hospital_id, auth.uid(),
            'cash_pay.work_item_opened', left(coalesce(p_reason, p_action), 200),
            jsonb_build_object('kind', p_action, 'amount_cents', cp.amount_cents));
  END IF;

  RETURN jsonb_build_object('status','ok','payment_status', cp.payment_status,
                            'refund_status', cp.refund_status, 'amount_cents', cp.amount_cents,
                            'currency', cp.currency, 'fee_reference', cp.fee_reference);
END $$;
REVOKE ALL ON FUNCTION public.record_cash_pay(uuid, text, text, text) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.record_cash_pay(uuid, text, text, text) TO authenticated, service_role;

-- ---------- 5. Server-derived obesity intake ----------
DROP POLICY IF EXISTS "intake screens insertable in my hospital" ON public.obesity_intake_screens;
REVOKE INSERT ON public.obesity_intake_screens FROM authenticated;

CREATE OR REPLACE FUNCTION public.submit_obesity_intake(p_encounter_id uuid, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e public.encounters; t public.clinical_protocols; q jsonb; ans jsonb;
  qid text; qtype text; ids text[]; k text; applicable boolean;
  flags text[] := '{}'; preg boolean := false; new_id uuid;
BEGIN
  IF jsonb_typeof(coalesce(p_answers, 'null'::jsonb)) <> 'object' THEN
    RETURN jsonb_build_object('status','error','reason','answers_must_be_an_object');
  END IF;
  SELECT * INTO e FROM public.encounters WHERE id = p_encounter_id;
  IF e.id IS NULL OR NOT public.is_my_hospital(e.hospital_id) THEN
    RETURN jsonb_build_object('status','error','reason','encounter_not_found');
  END IF;
  IF NOT (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'clinician')) THEN
    RETURN jsonb_build_object('status','error','reason','not_authorized');
  END IF;

  SELECT * INTO t FROM public.clinical_protocols
   WHERE hospital_id = e.hospital_id AND kind = 'obesity_intake' AND status = 'approved'
     AND (effective_end IS NULL OR effective_end >= current_date)
   ORDER BY version DESC LIMIT 1;
  IF t.id IS NULL THEN RETURN jsonb_build_object('status','error','reason','no_approved_intake_template'); END IF;
  IF jsonb_typeof(t.content -> 'questions') <> 'array' THEN
    RETURN jsonb_build_object('status','error','reason','template_schema_invalid');
  END IF;

  SELECT array_agg(x ->> 'id') INTO ids FROM jsonb_array_elements(t.content -> 'questions') x;
  FOR k IN SELECT jsonb_object_keys(p_answers) LOOP
    IF NOT (k = ANY (ids)) THEN
      RETURN jsonb_build_object('status','error','reason','unknown_question','question_id',k);
    END IF;
  END LOOP;

  FOR q IN SELECT x FROM jsonb_array_elements(t.content -> 'questions') x LOOP
    qid := q ->> 'id';
    qtype := coalesce(q ->> 'type', 'boolean');
    applicable := true;
    IF q ? 'applies_when' THEN
      applicable := (p_answers -> (q -> 'applies_when' ->> 'question_id')) IS NOT DISTINCT FROM (q -> 'applies_when' -> 'equals');
    END IF;
    ans := p_answers -> qid;

    IF NOT applicable THEN
      IF ans IS NOT NULL THEN
        RETURN jsonb_build_object('status','error','reason','answer_not_applicable','question_id',qid);
      END IF;
      CONTINUE;
    END IF;

    IF ans IS NULL OR jsonb_typeof(ans) = 'null' THEN
      IF coalesce((q ->> 'required')::boolean, false) THEN
        RETURN jsonb_build_object('status','error','reason','missing_required_answer','question_id',qid);
      END IF;
      CONTINUE;
    END IF;

    IF (qtype = 'boolean' AND jsonb_typeof(ans) <> 'boolean')
       OR (qtype = 'number' AND jsonb_typeof(ans) <> 'number')
       OR (qtype IN ('choice','text') AND jsonb_typeof(ans) <> 'string') THEN
      RETURN jsonb_build_object('status','error','reason','answer_type_mismatch','question_id',qid);
    END IF;
    IF qtype = 'choice' AND q ? 'options'
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q -> 'options') o WHERE o = ans) THEN
      RETURN jsonb_build_object('status','error','reason','answer_not_in_options','question_id',qid);
    END IF;

    -- Red flags are derived here from the approved immutable template only.
    IF q ? 'red_flag_values'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(q -> 'red_flag_values') v WHERE v = ans) THEN
      flags := flags || qid;
    END IF;
    IF coalesce((q ->> 'pregnancy')::boolean, false) THEN preg := true; END IF;
  END LOOP;

  INSERT INTO public.obesity_intake_screens
    (hospital_id, patient_id, encounter_id, template_protocol_id, template_version,
     answers, provenance, red_flags, pregnancy_applicable)
  VALUES (e.hospital_id, e.patient_id, p_encounter_id, t.id, t.version, p_answers,
          jsonb_build_object('source','clinician_entry','template_protocol_id', t.id,
                             'template_version', t.version, 'derived_by','server'),
          flags, preg)
  RETURNING id INTO new_id;

  RETURN jsonb_build_object('status','ok','id',new_id,'red_flags',to_jsonb(flags),
                            'pregnancy_applicable',preg,'template_version',t.version);
END $$;
REVOKE ALL ON FUNCTION public.submit_obesity_intake(uuid, jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.submit_obesity_intake(uuid, jsonb) TO authenticated, service_role;

-- ---------- 6. Go-live gate that mirrors runtime exactly ----------
CREATE OR REPLACE FUNCTION public.obesity_launch_readiness_internal(
  p_hospital_id uuid, p_service_line_id uuid, p_state_code text,
  p_prescribing boolean DEFAULT true, p_controlled boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  gates jsonb := '[]'::jsonb; blockers text[] := '{}'; ok boolean; missing text[] := '{}';
  p text; k text; ds public.vendor_onboarding; pc jsonb;
  NOTE_TEXT text := 'INTERNAL READINESS ONLY — not a legal, clinical, regulatory or vendor certification approval';
  REQUIRED_REFS text[] := ARRAY['DOSESPOT_PROD_CLIENT_ID_REF','DOSESPOT_PROD_CLIENT_SECRET_REF','DOSESPOT_PROD_CLINIC_ID_REF'];
BEGIN
  -- Only the obesity medicine service line may be launched through this gate.
  IF NOT EXISTS (SELECT 1 FROM public.service_lines s
                  WHERE s.id = p_service_line_id AND s.hospital_id = p_hospital_id
                    AND s.code = 'obesity_medicine' AND s.active) THEN
    RETURN jsonb_build_object('authorized', true, 'state_code', p_state_code,
      'service_line_id', p_service_line_id, 'prescribing', p_prescribing, 'controlled', p_controlled,
      'gates', jsonb_build_array(jsonb_build_object('key','service_line_is_obesity_medicine','type','internal',
        'owner','Operations','status','unverified',
        'blocker','This gate only evaluates the obesity_medicine service line',
        'next_step','Select the Obesity Medicine service line')),
      'blockers', to_jsonb(ARRAY['service_line_is_obesity_medicine']),
      'can_launch', false, 'note', NOTE_TEXT);
  END IF;

  ok := EXISTS (SELECT 1 FROM public.state_service_availability a
                JOIN public.service_lines s ON s.id = a.service_line_id AND s.active
                WHERE a.hospital_id = p_hospital_id AND a.service_line_id = p_service_line_id
                  AND a.state_code = p_state_code AND a.status = 'available');
  gates := gates || jsonb_build_object('key','service_state_available','type','internal','owner','Operations',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Obesity service is not explicitly available in this state' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Record an explicit state + service availability row' END);
  IF NOT ok THEN blockers := blockers || 'service_state_available'; END IF;

  ok := EXISTS (SELECT 1 FROM public.provider_service_lines psl
                JOIN public.provider_licenses l ON l.provider_user_id = psl.provider_user_id
                 AND l.hospital_id = psl.hospital_id
                WHERE psl.hospital_id = p_hospital_id AND psl.service_line_id = p_service_line_id
                  AND psl.active AND psl.effective_date <= current_date
                  AND (psl.end_date IS NULL OR psl.end_date >= current_date)
                  AND l.state_code = p_state_code AND l.status = 'active' AND l.telehealth_permitted
                  AND l.effective_date <= current_date
                  AND (l.expiration_date IS NULL OR l.expiration_date >= current_date));
  gates := gates || jsonb_build_object('key','authorized_provider','type','internal','owner','Medical Director',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No currently authorized obesity provider for this state' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Assign a licensed, telehealth-authorized provider to the service line' END);
  IF NOT ok THEN blockers := blockers || 'authorized_provider'; END IF;

  FOREACH k IN ARRAY ARRAY['protocol','obesity_intake','red_flag_screen','prescribing_limit','escalation_rule'] LOOP
    ok := EXISTS (SELECT 1 FROM public.clinical_protocols c
                  WHERE c.hospital_id = p_hospital_id AND c.kind = k AND c.status = 'approved'
                    AND (c.service_line_id IS NULL OR c.service_line_id = p_service_line_id)
                    AND (c.state_code IS NULL OR c.state_code = p_state_code)
                    AND (c.effective_end IS NULL OR c.effective_end >= current_date));
    gates := gates || jsonb_build_object('key','governance_' || k,'type','internal','owner','Medical Director + Compliance',
      'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
      'blocker', CASE WHEN ok THEN NULL ELSE 'No approved, current ' || k || ' version' END,
      'next_step', CASE WHEN ok THEN NULL ELSE 'Approve a ' || k || ' version through separation-of-duties review' END);
    IF NOT ok THEN blockers := blockers || ('governance_' || k); END IF;
  END LOOP;

  -- A real note template row AND an approved note_template governance version.
  ok := EXISTS (SELECT 1 FROM public.note_templates n WHERE n.hospital_id = p_hospital_id)
        AND EXISTS (SELECT 1 FROM public.clinical_protocols c
                    WHERE c.hospital_id = p_hospital_id AND c.kind = 'note_template' AND c.status = 'approved'
                      AND (c.service_line_id IS NULL OR c.service_line_id = p_service_line_id)
                      AND (c.effective_end IS NULL OR c.effective_end >= current_date));
  gates := gates || jsonb_build_object('key','note_template','type','internal','owner','Medical Director',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No obesity visit note template plus approved note_template version' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Publish a note template and approve a note_template governance version' END);
  IF NOT ok THEN blockers := blockers || 'note_template'; END IF;

  FOREACH p IN ARRAY ARRAY['telehealth','treatment','privacy','financial','communication'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.consent_documents d
                   WHERE d.hospital_id = p_hospital_id AND d.purpose = p AND d.status = 'approved'
                     AND (d.jurisdiction_state_code IS NULL OR d.jurisdiction_state_code = p_state_code)
                     AND (d.service_line_id IS NULL OR d.service_line_id = p_service_line_id)
                     AND (d.effective_end IS NULL OR d.effective_end >= current_date)) THEN
      missing := missing || p;
    END IF;
  END LOOP;
  ok := array_length(missing, 1) IS NULL;
  gates := gates || jsonb_build_object('key','consents','type','internal','owner','Compliance',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Missing approved consent: ' || array_to_string(missing, ', ') END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Approve the missing consent versions' END);
  IF NOT ok THEN blockers := blockers || 'consents'; END IF;

  -- Attestations must carry an evidence reference to count as verified.
  FOREACH k IN ARRAY ARRAY['identity','privacy_security','backup_restore','incident_downtime','staff_training','support','cash_pay_workflow'] LOOP
    ok := EXISTS (SELECT 1 FROM public.launch_readiness_gates g
                  WHERE g.hospital_id = p_hospital_id AND g.state_code = p_state_code
                    AND g.gate_key = k AND g.status = 'verified'
                    AND coalesce(btrim(g.evidence_ref), '') <> ''
                    AND (g.service_line_id IS NULL OR g.service_line_id = p_service_line_id));
    gates := gates || jsonb_build_object('key', k, 'type','internal','owner','Compliance / Operations',
      'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
      'blocker', CASE WHEN ok THEN NULL ELSE 'No current verified, evidence-referenced attestation for ' || k END,
      'next_step', CASE WHEN ok THEN NULL ELSE 'Record an evidence-backed ' || k || ' attestation' END);
    IF NOT ok THEN blockers := blockers || k; END IF;
  END LOOP;

  -- Cash-pay fee must be configured for this service (and state, if state-specific).
  ok := EXISTS (SELECT 1 FROM public.cash_pay_service_fees f
                WHERE f.hospital_id = p_hospital_id AND f.service_line_id = p_service_line_id AND f.active
                  AND f.effective_start <= current_date
                  AND (f.effective_end IS NULL OR f.effective_end >= current_date)
                  AND (f.state_code IS NULL OR f.state_code = p_state_code));
  gates := gates || jsonb_build_object('key','cash_pay_fee_configured','type','internal','owner','Operations',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No active cash-pay service fee for this service and state' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Configure the cash-pay service fee' END);
  IF NOT ok THEN blockers := blockers || 'cash_pay_fee_configured'; END IF;

  SELECT * INTO ds FROM public.vendor_onboarding
   WHERE hospital_id = p_hospital_id AND vendor_key = 'dosespot' AND environment = 'production'
   ORDER BY updated_at DESC LIMIT 1;
  pc := ds.capabilities -> 'partner_config';

  -- Mirrors vendorGate() + partnerConfig() exactly: the UI can never be greener than runtime.
  ok := ds.id IS NOT NULL
        AND ds.state = 'production_verified'
        AND (ds.capabilities->>'new_rx')::boolean IS TRUE
        AND (ds.capabilities->>'baa_verified')::boolean IS TRUE
        AND (ds.capabilities->>'mfa_enforced')::boolean IS TRUE
        AND ds.evidence_expires_at IS NOT NULL AND ds.evidence_expires_at > now()
        AND ds.last_test_result = 'production_readiness_passed'
        AND ds.secret_ref_names @> REQUIRED_REFS
        AND pc IS NOT NULL
        AND pc ? 'host' AND pc ? 'launchPath' AND pc ? 'signing'
        AND jsonb_typeof(pc -> 'signing') = 'object'
        AND (pc -> 'paramNames') ? 'signature'
        AND (pc ->> 'controlled_substance_mode') IN ('vendor_disabled','enabled')
        AND coalesce((pc ->> 'evidence_approved')::boolean, false)
        AND coalesce(btrim(pc ->> 'evidence_ref'), '') <> '';
  gates := gates || jsonb_build_object('key','dosespot_new_rx','type','external','owner','Vendor / Compliance',
    'status', CASE WHEN ok THEN 'verified' WHEN ds.id IS NULL THEN 'not_configured' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'DoseSpot production new_rx evidence, secret references or partner package is incomplete' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Upload the approved DoseSpot partner package, provision secret references and pass the end-to-end production test' END);
  IF p_prescribing AND NOT ok THEN blockers := blockers || 'dosespot_new_rx'; END IF;

  -- EPCS: facility capability AND at least one individually credentialed, state-authorized obesity prescriber.
  ok := ok
        AND (ds.capabilities->>'epcs')::boolean IS TRUE
        AND (pc ->> 'controlled_substance_mode') = 'enabled'
        AND EXISTS (
          SELECT 1 FROM public.provider_service_lines psl
           JOIN public.provider_licenses l ON l.provider_user_id = psl.provider_user_id
            AND l.hospital_id = psl.hospital_id
           WHERE psl.hospital_id = p_hospital_id AND psl.service_line_id = p_service_line_id AND psl.active
             AND l.state_code = p_state_code AND l.status = 'active' AND l.telehealth_permitted
             AND (l.expiration_date IS NULL OR l.expiration_date >= current_date)
             AND public.dosespot_prescriber_epcs_ok(p_hospital_id, psl.provider_user_id, p_state_code));
  gates := gates || jsonb_build_object('key','dosespot_epcs','type','external','owner','Vendor / Compliance',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'EPCS requires vendor certification and per-prescriber identity proofing, two-factor, EPCS enrollment, DEA and state controlled-substance evidence' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Record verified, unexpired individual EPCS credentials for at least one authorized prescriber' END);
  IF p_controlled AND NOT ok THEN blockers := blockers || 'dosespot_epcs'; END IF;

  ok := NOT EXISTS (SELECT 1 FROM public.incident_reports r
                    WHERE r.hospital_id = p_hospital_id AND r.severity = 'critical' AND r.status <> 'closed');
  gates := gates || jsonb_build_object('key','no_critical_defects','type','internal','owner','Engineering',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Unresolved critical safety, privacy or data-integrity incident' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Close the open critical incident' END);
  IF NOT ok THEN blockers := blockers || 'no_critical_defects'; END IF;

  RETURN jsonb_build_object(
    'authorized', true, 'state_code', p_state_code, 'service_line_id', p_service_line_id,
    'prescribing', p_prescribing, 'controlled', p_controlled, 'gates', gates,
    'blockers', to_jsonb(blockers), 'can_launch', array_length(blockers, 1) IS NULL, 'note', NOTE_TEXT);
END $$;
REVOKE ALL ON FUNCTION public.obesity_launch_readiness_internal(uuid, uuid, text, boolean, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obesity_launch_readiness_internal(uuid, uuid, text, boolean, boolean) TO service_role;

CREATE OR REPLACE FUNCTION public.obesity_launch_readiness(
  p_hospital_id uuid, p_service_line_id uuid, p_state_code text,
  p_prescribing boolean DEFAULT true, p_controlled boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
BEGIN
  IF NOT public.is_my_hospital(p_hospital_id) THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;
  RETURN public.obesity_launch_readiness_internal(
    p_hospital_id, p_service_line_id, p_state_code, p_prescribing, p_controlled);
END $$;
REVOKE ALL ON FUNCTION public.obesity_launch_readiness(uuid, uuid, text, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.obesity_launch_readiness(uuid, uuid, text, boolean, boolean) TO authenticated, service_role;

-- ---------- 7. Internal, service-role-only encounter prescribing readiness ----------
CREATE OR REPLACE FUNCTION public.obesity_prescribing_readiness(
  p_encounter_id uuid, p_controlled boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public AS $$
DECLARE
  e public.encounters; b text[] := '{}'; sl uuid; slcode text;
  scr public.obesity_intake_screens; cp public.encounter_cash_pay; stage text; lr jsonb; p text;
BEGIN
  SELECT * INTO e FROM public.encounters WHERE id = p_encounter_id;
  IF e.id IS NULL THEN
    RETURN jsonb_build_object('allowed', false, 'blockers', to_jsonb(ARRAY['encounter_not_found']));
  END IF;

  SELECT cr.service_line_id INTO sl FROM public.care_requests cr
   WHERE cr.encounter_id = p_encounter_id ORDER BY cr.created_at DESC LIMIT 1;
  SELECT s.code INTO slcode FROM public.service_lines s WHERE s.id = sl;
  IF coalesce(slcode, '') <> 'obesity_medicine' THEN b := b || 'service_line_not_obesity_medicine'; END IF;
  IF coalesce(e.patient_state_code, '') = '' THEN b := b || 'patient_state_unknown'; END IF;
  IF e.status::text NOT IN ('checked_in','in_progress') THEN b := b || 'encounter_not_active'; END IF;
  IF e.provider_id IS NULL THEN b := b || 'no_assigned_provider'; END IF;
  IF e.med_rec_completed_at IS NULL THEN b := b || 'medication_reconciliation_missing'; END IF;
  IF e.allergy_review_at IS NULL THEN b := b || 'allergy_review_missing'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.provider_licenses l
                  WHERE l.provider_user_id = e.provider_id AND l.hospital_id = e.hospital_id
                    AND l.state_code = e.patient_state_code AND l.status = 'active' AND l.telehealth_permitted
                    AND l.effective_date <= current_date
                    AND (l.expiration_date IS NULL OR l.expiration_date >= current_date)) THEN
    b := b || 'provider_not_state_authorized';
  END IF;
  IF sl IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.provider_service_lines psl
                  WHERE psl.provider_user_id = e.provider_id AND psl.hospital_id = e.hospital_id
                    AND psl.service_line_id = sl AND psl.active
                    AND (psl.end_date IS NULL OR psl.end_date >= current_date)) THEN
    b := b || 'provider_not_assigned_to_service';
  END IF;

  SELECT * INTO scr FROM public.obesity_intake_screens
   WHERE encounter_id = p_encounter_id ORDER BY completed_at DESC LIMIT 1;
  IF scr.id IS NULL THEN
    b := b || 'obesity_intake_missing';
  ELSE
    IF NOT EXISTS (SELECT 1 FROM public.clinical_protocols c
                    WHERE c.id = scr.template_protocol_id AND c.status = 'approved'
                      AND c.version = scr.template_version
                      AND (c.effective_end IS NULL OR c.effective_end >= current_date)) THEN
      b := b || 'obesity_intake_template_not_current';
    END IF;
    IF array_length(scr.red_flags, 1) IS NOT NULL THEN b := b || 'unresolved_red_flags'; END IF;
  END IF;

  FOREACH p IN ARRAY ARRAY['telehealth','treatment','privacy','financial','communication'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.consent_records r
                   JOIN public.consent_documents d ON d.id = r.consent_document_id
                   WHERE r.patient_id = e.patient_id AND r.hospital_id = e.hospital_id AND r.purpose = p
                     AND r.accepted_at IS NOT NULL AND r.withdrawn_at IS NULL AND r.declined_at IS NULL
                     AND d.status = 'approved'
                     AND (d.effective_end IS NULL OR d.effective_end >= current_date)) THEN
      b := b || ('consent_missing_' || p);
    END IF;
  END LOOP;

  SELECT * INTO cp FROM public.encounter_cash_pay WHERE encounter_id = p_encounter_id;
  IF cp.id IS NULL OR cp.payment_status NOT IN ('settled','waived') THEN b := b || 'payment_not_settled'; END IF;

  -- Launch stage comes from the approved medical-director protocol, never a client flag.
  SELECT coalesce(c.content ->> 'prescribing_launch_stage', 'after_signed_note') INTO stage
    FROM public.clinical_protocols c
   WHERE c.hospital_id = e.hospital_id AND c.kind = 'protocol' AND c.status = 'approved'
     AND (c.service_line_id IS NULL OR c.service_line_id = sl)
     AND (c.effective_end IS NULL OR c.effective_end >= current_date)
   ORDER BY c.version DESC LIMIT 1;
  IF stage IS NULL THEN
    b := b || 'obesity_protocol_not_approved';
  ELSIF stage = 'after_signed_note' THEN
    IF NOT EXISTS (SELECT 1 FROM public.clinical_notes n
                    WHERE n.encounter_id = p_encounter_id AND n.status = 'signed') THEN
      b := b || 'signed_note_required';
    END IF;
  ELSIF stage <> 'during_visit' THEN
    b := b || 'prescribing_launch_stage_unrecognized';
  END IF;

  lr := public.obesity_launch_readiness_internal(e.hospital_id, sl, e.patient_state_code, true, p_controlled);
  IF NOT coalesce((lr ->> 'can_launch')::boolean, false) THEN b := b || 'hospital_launch_gate_blocked'; END IF;

  IF p_controlled AND NOT public.dosespot_prescriber_epcs_ok(e.hospital_id, e.provider_id, e.patient_state_code) THEN
    b := b || 'prescriber_epcs_evidence_missing';
  END IF;

  RETURN jsonb_build_object('allowed', array_length(b, 1) IS NULL,
                            'blockers', to_jsonb(b), 'controlled', p_controlled);
END $$;
REVOKE ALL ON FUNCTION public.obesity_prescribing_readiness(uuid, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obesity_prescribing_readiness(uuid, boolean) TO service_role;