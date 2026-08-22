-- ============================================================
-- Cash-pay obesity medicine launch: encounter payment boundary,
-- versioned obesity intake screens, vendor identity mapping and a
-- single fail-closed go-live readiness function.
-- ============================================================

-- ---------- 1. Cash-pay boundary (no card data ever) ----------
CREATE TABLE public.encounter_cash_pay (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL UNIQUE REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_line_id uuid REFERENCES public.service_lines(id),
  fee_reference text NOT NULL,
  amount_cents integer NOT NULL CHECK (amount_cents >= 0),
  currency text NOT NULL DEFAULT 'USD' CHECK (currency ~ '^[A-Z]{3}$'),
  payment_status text NOT NULL DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid','pending','settled','waived','refunded','voided')),
  processor text NOT NULL DEFAULT 'not_connected'
    CHECK (processor IN ('not_connected','external_reference')),
  payment_reference text,
  receipt_status text NOT NULL DEFAULT 'none' CHECK (receipt_status IN ('none','issued','failed')),
  refund_status text NOT NULL DEFAULT 'none' CHECK (refund_status IN ('none','requested','completed','chargeback')),
  waiver_reason text,
  waived_by uuid,
  waived_at timestamptz,
  settled_at timestamptz,
  recorded_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE ON public.encounter_cash_pay TO authenticated;
GRANT ALL ON public.encounter_cash_pay TO service_role;
ALTER TABLE public.encounter_cash_pay ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash pay readable in my hospital" ON public.encounter_cash_pay
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "cash pay insertable in my hospital" ON public.encounter_cash_pay
  FOR INSERT TO authenticated WITH CHECK (public.is_my_hospital(hospital_id));
CREATE POLICY "cash pay updatable in my hospital" ON public.encounter_cash_pay
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id))
  WITH CHECK (public.is_my_hospital(hospital_id));

CREATE OR REPLACE FUNCTION public.enforce_encounter_cash_pay()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE e public.encounters;
BEGIN
  SELECT * INTO e FROM public.encounters WHERE id = NEW.encounter_id;
  IF e.id IS NULL OR e.hospital_id <> NEW.hospital_id OR e.patient_id <> NEW.patient_id THEN
    RAISE EXCEPTION 'cash-pay record must match the encounter facility and patient';
  END IF;

  -- VirtualisONE never stores card, CVV or bank credentials.
  IF NEW.payment_reference IS NOT NULL AND (
       NEW.payment_reference ~ '[0-9]{13,19}'
       OR NEW.payment_reference ~* '(cvv|cvc|iban|routing|account[ _-]?number|pan)') THEN
    RAISE EXCEPTION 'payment_reference must be a non-card external reference: card, CVV and bank credentials are never stored';
  END IF;
  IF length(coalesce(NEW.payment_reference, '')) > 80 THEN
    RAISE EXCEPTION 'payment_reference is limited to an 80 character external reference';
  END IF;

  IF TG_OP = 'INSERT' THEN
    NEW.recorded_by := auth.uid();
  ELSE
    NEW.recorded_by := OLD.recorded_by;
    NEW.hospital_id := OLD.hospital_id;
    NEW.encounter_id := OLD.encounter_id;
    NEW.patient_id := OLD.patient_id;
  END IF;

  IF NEW.payment_status = 'waived' THEN
    IF NOT public.has_role(auth.uid(), 'admin') THEN
      RAISE EXCEPTION 'only an administrator may waive a cash-pay fee';
    END IF;
    IF length(coalesce(btrim(NEW.waiver_reason), '')) < 10 THEN
      RAISE EXCEPTION 'a waiver requires a written reason';
    END IF;
    NEW.waived_by := auth.uid();
    NEW.waived_at := coalesce(NEW.waived_at, now());
  ELSE
    NEW.waived_by := NULL; NEW.waived_at := NULL; NEW.waiver_reason := NULL;
  END IF;

  IF NEW.payment_status = 'settled' THEN
    IF NEW.processor = 'not_connected' OR coalesce(btrim(NEW.payment_reference), '') = '' THEN
      RAISE EXCEPTION 'settlement requires a configured payment workflow and an external payment reference';
    END IF;
    NEW.settled_at := coalesce(NEW.settled_at, now());
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;

CREATE TRIGGER enforce_encounter_cash_pay
  BEFORE INSERT OR UPDATE ON public.encounter_cash_pay
  FOR EACH ROW EXECUTE FUNCTION public.enforce_encounter_cash_pay();

CREATE OR REPLACE FUNCTION public.log_cash_pay_event()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.encounter_events (encounter_id, patient_id, hospital_id, actor_id, event_code, reason, metadata)
  VALUES (NEW.encounter_id, NEW.patient_id, NEW.hospital_id, auth.uid(),
          'cash_pay.' || NEW.payment_status,
          CASE WHEN NEW.payment_status = 'waived' THEN NEW.waiver_reason ELSE NULL END,
          jsonb_build_object('amount_cents', NEW.amount_cents, 'currency', NEW.currency,
                             'processor', NEW.processor, 'refund_status', NEW.refund_status));
  RETURN NEW;
END $$;

CREATE TRIGGER log_cash_pay_event
  AFTER INSERT OR UPDATE OF payment_status, refund_status ON public.encounter_cash_pay
  FOR EACH ROW EXECUTE FUNCTION public.log_cash_pay_event();

-- ---------- 2. Versioned obesity intake / safety screen ----------
CREATE TABLE public.obesity_intake_screens (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  template_protocol_id uuid NOT NULL REFERENCES public.clinical_protocols(id),
  template_version integer NOT NULL,
  answers jsonb NOT NULL DEFAULT '{}'::jsonb,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  red_flags text[] NOT NULL DEFAULT '{}',
  pregnancy_applicable boolean NOT NULL DEFAULT false,
  completed_by uuid,
  completed_at timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT ON public.obesity_intake_screens TO authenticated;
GRANT ALL ON public.obesity_intake_screens TO service_role;
ALTER TABLE public.obesity_intake_screens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "intake screens readable in my hospital" ON public.obesity_intake_screens
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "intake screens insertable in my hospital" ON public.obesity_intake_screens
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id));

CREATE OR REPLACE FUNCTION public.enforce_obesity_intake_screen()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE e public.encounters; t public.clinical_protocols;
BEGIN
  SELECT * INTO e FROM public.encounters WHERE id = NEW.encounter_id;
  IF e.id IS NULL OR e.hospital_id <> NEW.hospital_id OR e.patient_id <> NEW.patient_id THEN
    RAISE EXCEPTION 'intake screen must match the encounter facility and patient';
  END IF;

  SELECT * INTO t FROM public.clinical_protocols WHERE id = NEW.template_protocol_id;
  IF t.id IS NULL OR t.hospital_id <> NEW.hospital_id THEN
    RAISE EXCEPTION 'intake template must belong to this facility';
  END IF;
  IF t.kind <> 'obesity_intake' OR t.status <> 'approved' THEN
    RAISE EXCEPTION 'intake screen requires an approved obesity_intake template';
  END IF;
  IF t.effective_end IS NOT NULL AND t.effective_end < current_date THEN
    RAISE EXCEPTION 'intake template version has expired';
  END IF;

  NEW.template_version := t.version;
  NEW.completed_by := auth.uid();
  NEW.completed_at := now();
  -- Answers and provenance only: no AI conclusion may be persisted as a screen result.
  IF NEW.provenance ? 'ai_conclusion' OR NEW.answers ? 'ai_conclusion' THEN
    RAISE EXCEPTION 'AI conclusions may not be stored as intake screen results';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER enforce_obesity_intake_screen
  BEFORE INSERT ON public.obesity_intake_screens
  FOR EACH ROW EXECUTE FUNCTION public.enforce_obesity_intake_screen();

CREATE TRIGGER obesity_intake_screens_append_only
  BEFORE UPDATE OR DELETE ON public.obesity_intake_screens
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ---------- 3. Vendor identity mappings (identifiers only, never credentials) ----------
CREATE TABLE public.vendor_identity_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  vendor_key text NOT NULL CHECK (vendor_key IN ('dosespot','stedi','health_gorilla')),
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  subject_type text NOT NULL CHECK (subject_type IN ('patient','prescriber','facility')),
  subject_id uuid NOT NULL,
  vendor_identifier text NOT NULL CHECK (length(vendor_identifier) BETWEEN 1 AND 128),
  evidence_ref text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, vendor_key, environment, subject_type, subject_id),
  UNIQUE (hospital_id, vendor_key, environment, vendor_identifier)
);

GRANT SELECT, INSERT ON public.vendor_identity_mappings TO authenticated;
GRANT ALL ON public.vendor_identity_mappings TO service_role;
ALTER TABLE public.vendor_identity_mappings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "vendor mappings readable in my hospital" ON public.vendor_identity_mappings
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "vendor mappings insertable by hospital admins" ON public.vendor_identity_mappings
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.enforce_vendor_identity_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  -- A mapping stores a vendor-issued identifier. Never a secret value.
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
  NEW.created_by := auth.uid();
  RETURN NEW;
END $$;

CREATE TRIGGER enforce_vendor_identity_mapping
  BEFORE INSERT ON public.vendor_identity_mappings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_identity_mapping();

CREATE TRIGGER vendor_identity_mappings_immutable
  BEFORE UPDATE OR DELETE ON public.vendor_identity_mappings
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ---------- 4. Single fail-closed cash-pay obesity go-live gate ----------
CREATE OR REPLACE FUNCTION public.obesity_launch_readiness(
  p_hospital_id uuid,
  p_service_line_id uuid,
  p_state_code text,
  p_prescribing boolean DEFAULT true,
  p_controlled boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SET search_path = public
AS $$
DECLARE
  gates jsonb := '[]'::jsonb;
  blockers text[] := '{}';
  ok boolean;
  missing text[] := '{}';
  p text;
  k text;
  ds public.vendor_onboarding;
  NOTE_TEXT text := 'INTERNAL READINESS ONLY — not a legal, clinical, regulatory or vendor certification approval';

  PROCEDURE_UNUSED text := NULL;
BEGIN
  IF NOT public.is_my_hospital(p_hospital_id) THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  -- helper inline: state + service availability, never a national wildcard
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

  -- approved, current governance artifacts
  FOREACH k IN ARRAY ARRAY['protocol','obesity_intake','red_flag_screen','prescribing_limits','escalation'] LOOP
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

  ok := EXISTS (SELECT 1 FROM public.note_templates n WHERE n.hospital_id = p_hospital_id);
  gates := gates || jsonb_build_object('key','note_template','type','internal','owner','Medical Director',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No obesity visit note template configured' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Publish an approved obesity visit note template' END);
  IF NOT ok THEN blockers := blockers || 'note_template'; END IF;

  -- consents applicable to a cash-pay telehealth service
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

  -- operational attestations recorded as explicit readiness gates
  FOREACH k IN ARRAY ARRAY['identity','privacy_security','backup_restore','incident_downtime','staff_training','support','cash_pay_workflow'] LOOP
    ok := EXISTS (SELECT 1 FROM public.launch_readiness_gates g
                  WHERE g.hospital_id = p_hospital_id AND g.state_code = p_state_code
                    AND g.gate_key = k AND g.status = 'verified'
                    AND (g.service_line_id IS NULL OR g.service_line_id = p_service_line_id));
    gates := gates || jsonb_build_object('key', k, 'type','internal','owner','Compliance / Operations',
      'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
      'blocker', CASE WHEN ok THEN NULL ELSE 'No current verified attestation for ' || k END,
      'next_step', CASE WHEN ok THEN NULL ELSE 'Record an evidence-backed ' || k || ' attestation' END);
    IF NOT ok THEN blockers := blockers || k; END IF;
  END LOOP;

  -- DoseSpot production boundary (non-controlled new_rx), only when the service promises prescribing
  SELECT * INTO ds FROM public.vendor_onboarding
   WHERE hospital_id = p_hospital_id AND vendor_key = 'dosespot' AND environment = 'production'
   ORDER BY updated_at DESC LIMIT 1;
  ok := ds.id IS NOT NULL
        AND ds.state = 'production_verified'
        AND (ds.capabilities->>'new_rx')::boolean IS TRUE
        AND ds.evidence_expires_at IS NOT NULL AND ds.evidence_expires_at > now()
        AND ds.last_test_result = 'production_readiness_passed';
  gates := gates || jsonb_build_object('key','dosespot_new_rx','type','external','owner','Vendor / Compliance',
    'status', CASE WHEN ok THEN 'verified' WHEN ds.id IS NULL THEN 'not_configured' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'DoseSpot production new_rx is not evidence-verified' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Complete DoseSpot onboarding evidence, secret references and end-to-end test' END);
  IF p_prescribing AND NOT ok THEN blockers := blockers || 'dosespot_new_rx'; END IF;

  -- EPCS is a separate gate and only blocks a controlled-capable configuration
  ok := ds.id IS NOT NULL AND ds.state = 'production_verified'
        AND (ds.capabilities->>'epcs')::boolean IS TRUE
        AND ds.evidence_expires_at IS NOT NULL AND ds.evidence_expires_at > now();
  gates := gates || jsonb_build_object('key','dosespot_epcs','type','external','owner','Vendor / Compliance',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'EPCS is not verified: controlled prescribing stays hard-blocked' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Complete DoseSpot EPCS certification, prescriber identity proofing and TFA enrollment' END);
  IF p_controlled AND NOT ok THEN blockers := blockers || 'dosespot_epcs'; END IF;

  -- unresolved critical defects
  ok := NOT EXISTS (SELECT 1 FROM public.incident_reports r
                    WHERE r.hospital_id = p_hospital_id AND r.severity = 'critical' AND r.status <> 'closed');
  gates := gates || jsonb_build_object('key','no_critical_defects','type','internal','owner','Engineering',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Unresolved critical safety, privacy or data-integrity incident' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Close the open critical incident' END);
  IF NOT ok THEN blockers := blockers || 'no_critical_defects'; END IF;

  RETURN jsonb_build_object(
    'authorized', true,
    'state_code', p_state_code,
    'service_line_id', p_service_line_id,
    'prescribing', p_prescribing,
    'controlled', p_controlled,
    'gates', gates,
    'blockers', to_jsonb(blockers),
    'can_launch', array_length(blockers, 1) IS NULL,
    'note', NOTE_TEXT);
END $$;

REVOKE ALL ON FUNCTION public.obesity_launch_readiness(uuid, uuid, text, boolean, boolean) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.obesity_launch_readiness(uuid, uuid, text, boolean, boolean) TO authenticated, service_role;
