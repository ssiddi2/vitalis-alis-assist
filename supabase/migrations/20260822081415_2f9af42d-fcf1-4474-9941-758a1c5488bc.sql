-- ============================================================
-- Narrow forward-only parity correction:
--  1. explicit question types
--  2. effective_start honoured wherever "approved/current" is counted
--  3. one authoritative scope selector shared by encounter selection
--     and the launch readiness gate
-- ============================================================

-- ---------- 1. Strict intake schema validator ----------
CREATE OR REPLACE FUNCTION public.obesity_intake_schema_blocker(content jsonb)
RETURNS text LANGUAGE plpgsql IMMUTABLE SET search_path = '' AS $$
DECLARE
  qs jsonb; q jsonb; ids text[] := '{}'; qid text; qtype text; want text;
  aw jsonb; ref jsonb; reftype text; refwant text; v jsonb; n int;
BEGIN
  IF content IS NULL OR jsonb_typeof(content) <> 'object' THEN RETURN 'template_schema_invalid'; END IF;
  qs := content -> 'questions';
  IF qs IS NULL OR jsonb_typeof(qs) <> 'array' OR jsonb_array_length(qs) = 0 THEN
    RETURN 'template_schema_invalid';
  END IF;

  FOR q IN SELECT x FROM jsonb_array_elements(qs) x LOOP
    IF jsonb_typeof(q) <> 'object' THEN RETURN 'template_question_invalid'; END IF;
    IF NOT public.jsonb_nonempty_text(q -> 'id') OR (q ->> 'id') !~ '^[a-z0-9][a-z0-9_]{0,63}$' THEN
      RETURN 'template_question_id_invalid';
    END IF;
    qid := q ->> 'id';
    IF qid = ANY (ids) THEN RETURN 'template_question_id_duplicated'; END IF;
    ids := ids || qid;

    -- Type must be explicitly declared; there is no implicit boolean default.
    IF NOT public.jsonb_nonempty_text(q -> 'type')
       OR (q ->> 'type') NOT IN ('boolean', 'choice', 'number', 'text') THEN
      RETURN 'template_question_type_invalid';
    END IF;
    qtype := q ->> 'type';
    want := CASE qtype WHEN 'boolean' THEN 'boolean' WHEN 'number' THEN 'number' ELSE 'string' END;

    IF q ? 'required' AND jsonb_typeof(q -> 'required') <> 'boolean' THEN RETURN 'template_required_invalid'; END IF;
    IF q ? 'pregnancy' AND jsonb_typeof(q -> 'pregnancy') <> 'boolean' THEN RETURN 'template_pregnancy_invalid'; END IF;

    IF q ? 'red_flag_values' THEN
      IF jsonb_typeof(q -> 'red_flag_values') <> 'array' OR jsonb_array_length(q -> 'red_flag_values') = 0
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q -> 'red_flag_values') e WHERE jsonb_typeof(e) <> want) THEN
        RETURN 'template_red_flag_values_invalid';
      END IF;
    END IF;

    IF qtype = 'choice' THEN
      IF NOT (q ? 'options') OR jsonb_typeof(q -> 'options') <> 'array'
         OR jsonb_array_length(q -> 'options') = 0
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q -> 'options') o
                     WHERE jsonb_typeof(o) <> 'string' OR btrim(o #>> '{}') = '') THEN
        RETURN 'template_options_invalid';
      END IF;
      SELECT count(DISTINCT o) INTO n FROM jsonb_array_elements(q -> 'options') o;
      IF n <> jsonb_array_length(q -> 'options') THEN RETURN 'template_options_duplicated'; END IF;
    ELSIF q ? 'options' THEN
      IF jsonb_typeof(q -> 'options') <> 'array'
         OR EXISTS (SELECT 1 FROM jsonb_array_elements(q -> 'options') o WHERE jsonb_typeof(o) <> want) THEN
        RETURN 'template_options_invalid';
      END IF;
    END IF;

    -- Red flag values of a choice question must be declared options.
    IF qtype = 'choice' AND q ? 'red_flag_values'
       AND EXISTS (SELECT 1 FROM jsonb_array_elements(q -> 'red_flag_values') e
                    WHERE NOT EXISTS (SELECT 1 FROM jsonb_array_elements(q -> 'options') o WHERE o = e)) THEN
      RETURN 'template_red_flag_values_invalid';
    END IF;
  END LOOP;

  FOR q IN SELECT x FROM jsonb_array_elements(qs) x LOOP
    IF NOT (q ? 'applies_when') THEN CONTINUE; END IF;
    aw := q -> 'applies_when';
    IF jsonb_typeof(aw) <> 'object' OR NOT public.jsonb_nonempty_text(aw -> 'question_id') OR NOT (aw ? 'equals') THEN
      RETURN 'template_applies_when_invalid';
    END IF;
    SELECT x INTO ref FROM jsonb_array_elements(qs) x WHERE x ->> 'id' = aw ->> 'question_id';
    IF ref IS NULL THEN RETURN 'template_applies_when_unknown_question'; END IF;
    reftype := ref ->> 'type';
    refwant := CASE reftype WHEN 'boolean' THEN 'boolean' WHEN 'number' THEN 'number' ELSE 'string' END;
    v := aw -> 'equals';
    IF jsonb_typeof(v) <> refwant THEN RETURN 'template_applies_when_type_mismatch'; END IF;
    IF reftype = 'choice'
       AND NOT EXISTS (SELECT 1 FROM jsonb_array_elements(ref -> 'options') o WHERE o = v) THEN
      RETURN 'template_applies_when_value_not_an_option';
    END IF;
  END LOOP;

  RETURN NULL;
END $$;
REVOKE ALL ON FUNCTION public.obesity_intake_schema_blocker(jsonb) FROM public, anon;
GRANT EXECUTE ON FUNCTION public.obesity_intake_schema_blocker(jsonb) TO authenticated, service_role;

-- ---------- 2. One authoritative scope selector ----------
-- Exact service line first, then exact state, then highest version. Only
-- approved versions whose effective window has already started and not ended.
CREATE OR REPLACE FUNCTION public.obesity_intake_template_scoped(
  p_hospital_id uuid, p_service_line_id uuid, p_state_code text)
RETURNS public.clinical_protocols
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = '' AS $$
  SELECT c.* FROM public.clinical_protocols c
   WHERE c.hospital_id = p_hospital_id AND c.kind = 'obesity_intake' AND c.status = 'approved'
     AND (c.service_line_id IS NULL OR c.service_line_id = p_service_line_id)
     AND (c.state_code IS NULL OR c.state_code = p_state_code)
     AND (c.effective_start IS NULL OR c.effective_start <= current_date)
     AND (c.effective_end IS NULL OR c.effective_end >= current_date)
   ORDER BY (c.service_line_id IS NOT NULL) DESC, (c.state_code IS NOT NULL) DESC, c.version DESC
   LIMIT 1;
$$;
REVOKE ALL ON FUNCTION public.obesity_intake_template_scoped(uuid, uuid, text) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obesity_intake_template_scoped(uuid, uuid, text) TO service_role;

CREATE OR REPLACE FUNCTION public.obesity_intake_template_for(p_encounter_id uuid)
RETURNS public.clinical_protocols
LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.encounters; sl uuid; slcode text;
BEGIN
  SELECT * INTO e FROM public.encounters WHERE id = p_encounter_id;
  IF e.id IS NULL THEN RETURN NULL; END IF;

  SELECT cr.service_line_id INTO sl FROM public.care_requests cr
   WHERE cr.encounter_id = p_encounter_id ORDER BY cr.created_at DESC LIMIT 1;
  SELECT s.code INTO slcode FROM public.service_lines s WHERE s.id = sl AND s.hospital_id = e.hospital_id;
  IF coalesce(slcode, '') <> 'obesity_medicine' THEN RETURN NULL; END IF;

  RETURN public.obesity_intake_template_scoped(e.hospital_id, sl, e.patient_state_code);
END $$;
REVOKE ALL ON FUNCTION public.obesity_intake_template_for(uuid) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obesity_intake_template_for(uuid) TO service_role;

-- ---------- 3. Submission mirrors the strict declared types ----------
CREATE OR REPLACE FUNCTION public.submit_obesity_intake(p_encounter_id uuid, p_answers jsonb)
RETURNS jsonb LANGUAGE plpgsql SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  e public.encounters; t public.clinical_protocols; q jsonb; ans jsonb; blk text;
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

  t := public.obesity_intake_template_for(p_encounter_id);
  IF t.id IS NULL THEN RETURN jsonb_build_object('status','error','reason','no_approved_intake_template'); END IF;
  blk := public.obesity_intake_schema_blocker(t.content);
  IF blk IS NOT NULL THEN RETURN jsonb_build_object('status','error','reason',blk); END IF;

  SELECT array_agg(x ->> 'id') INTO ids FROM jsonb_array_elements(t.content -> 'questions') x;
  FOR k IN SELECT jsonb_object_keys(p_answers) LOOP
    IF NOT (k = ANY (ids)) THEN
      RETURN jsonb_build_object('status','error','reason','unknown_question','question_id',k);
    END IF;
  END LOOP;

  FOR q IN SELECT x FROM jsonb_array_elements(t.content -> 'questions') x LOOP
    qid := q ->> 'id';
    qtype := q ->> 'type';
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

-- ---------- 4. Readiness gate: effective_start parity + exact selected template ----------
CREATE OR REPLACE FUNCTION public.obesity_launch_readiness_internal(
  p_hospital_id uuid, p_service_line_id uuid, p_state_code text,
  p_prescribing boolean DEFAULT true, p_controlled boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  gates jsonb := '[]'::jsonb; blockers text[] := '{}'; ok boolean; missing text[] := '{}';
  p text; k text; ds public.vendor_onboarding; pc jsonb; pcblk text; it public.clinical_protocols;
  NOTE_TEXT text := 'INTERNAL READINESS ONLY — not a legal, clinical, regulatory or vendor certification approval';
  REQUIRED_REFS text[] := ARRAY['DOSESPOT_PROD_CLIENT_ID_REF','DOSESPOT_PROD_CLIENT_SECRET_REF','DOSESPOT_PROD_CLINIC_ID_REF'];
BEGIN
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

  -- The exact template an encounter in this scope would select must itself be well formed.
  it := public.obesity_intake_template_scoped(p_hospital_id, p_service_line_id, p_state_code);

  FOREACH k IN ARRAY ARRAY['protocol','obesity_intake','red_flag_screen','prescribing_limit','escalation_rule'] LOOP
    ok := EXISTS (SELECT 1 FROM public.clinical_protocols c
                  WHERE c.hospital_id = p_hospital_id AND c.kind = k AND c.status = 'approved'
                    AND (c.service_line_id IS NULL OR c.service_line_id = p_service_line_id)
                    AND (c.state_code IS NULL OR c.state_code = p_state_code)
                    AND (c.effective_start IS NULL OR c.effective_start <= current_date)
                    AND (c.effective_end IS NULL OR c.effective_end >= current_date));
    IF k = 'obesity_intake' THEN
      ok := it.id IS NOT NULL AND public.obesity_intake_schema_blocker(it.content) IS NULL;
    END IF;
    gates := gates || jsonb_build_object('key','governance_' || k,'type','internal','owner','Medical Director + Compliance',
      'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
      'blocker', CASE WHEN ok THEN NULL
        WHEN k = 'obesity_intake' AND it.id IS NOT NULL
          THEN 'The intake template this scope selects is malformed: ' || public.obesity_intake_schema_blocker(it.content)
        ELSE 'No approved, current, well-formed ' || k || ' version' END,
      'next_step', CASE WHEN ok THEN NULL ELSE 'Approve a ' || k || ' version through separation-of-duties review' END);
    IF NOT ok THEN blockers := blockers || ('governance_' || k); END IF;
  END LOOP;

  ok := EXISTS (SELECT 1 FROM public.note_templates n WHERE n.hospital_id = p_hospital_id)
        AND EXISTS (SELECT 1 FROM public.clinical_protocols c
                    WHERE c.hospital_id = p_hospital_id AND c.kind = 'note_template' AND c.status = 'approved'
                      AND (c.service_line_id IS NULL OR c.service_line_id = p_service_line_id)
                      AND (c.effective_start IS NULL OR c.effective_start <= current_date)
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
                     AND (d.effective_start IS NULL OR d.effective_start <= current_date)
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
  pcblk := public.dosespot_partner_config_blocker(pc, coalesce(ds.secret_ref_names, ARRAY[]::text[]));

  ok := ds.id IS NOT NULL
        AND ds.state = 'production_verified'
        AND public.jsonb_is_true(ds.capabilities -> 'new_rx')
        AND public.jsonb_is_true(ds.capabilities -> 'baa_verified')
        AND public.jsonb_is_true(ds.capabilities -> 'mfa_enforced')
        AND ds.evidence_expires_at IS NOT NULL AND ds.evidence_expires_at > now()
        AND ds.last_test_result = 'production_readiness_passed'
        AND ds.secret_ref_names @> REQUIRED_REFS
        AND pcblk IS NULL;
  gates := gates || jsonb_build_object('key','dosespot_new_rx','type','external','owner','Vendor / Compliance',
    'status', CASE WHEN ok THEN 'verified' WHEN ds.id IS NULL THEN 'not_configured' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL
      ELSE coalesce(pcblk, 'DoseSpot production new_rx evidence or secret references are incomplete') END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Upload the approved DoseSpot partner package, provision secret references and pass the end-to-end production test' END);
  IF p_prescribing AND NOT ok THEN blockers := blockers || 'dosespot_new_rx'; END IF;

  ok := ok
        AND public.jsonb_is_true(ds.capabilities -> 'epcs')
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