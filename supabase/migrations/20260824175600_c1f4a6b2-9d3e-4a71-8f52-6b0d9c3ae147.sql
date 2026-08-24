-- Forward-only fix: the previously applied definition used ambiguous
-- `text[] || <scalar text>` appends, which Postgres resolved as array-literal
-- casts and raised 22P02 (malformed array literal) at runtime. Same logic and
-- grants; every scalar append now uses explicit array_append.

CREATE OR REPLACE FUNCTION public.obesity_launch_readiness_internal(
  p_hospital_id uuid, p_service_line_id uuid, p_state_code text,
  p_prescribing boolean DEFAULT true, p_controlled boolean DEFAULT false)
RETURNS jsonb LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = '' AS $$
DECLARE
  gates jsonb := '[]'::jsonb; blockers text[] := '{}'; ok boolean; missing text[] := '{}';
  p text; k text; ds public.vendor_onboarding; pc jsonb; pcblk text; it public.clinical_protocols;
  NOTE_TEXT text := 'INTERNAL READINESS ONLY — not a legal, clinical, regulatory or vendor certification approval';
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
  IF NOT ok THEN blockers := array_append(blockers, 'service_state_available'); END IF;

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
  IF NOT ok THEN blockers := array_append(blockers, 'authorized_provider'); END IF;

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
    IF NOT ok THEN blockers := array_append(blockers, 'governance_' || k); END IF;
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
  IF NOT ok THEN blockers := array_append(blockers, 'note_template'); END IF;

  FOREACH p IN ARRAY ARRAY['telehealth','treatment','privacy','financial','communication'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.consent_documents d
                   WHERE d.hospital_id = p_hospital_id AND d.purpose = p AND d.status = 'approved'
                     AND (d.jurisdiction_state_code IS NULL OR d.jurisdiction_state_code = p_state_code)
                     AND (d.service_line_id IS NULL OR d.service_line_id = p_service_line_id)
                     AND (d.effective_start IS NULL OR d.effective_start <= current_date)
                     AND (d.effective_end IS NULL OR d.effective_end >= current_date)) THEN
      missing := array_append(missing, p);
    END IF;
  END LOOP;
  ok := array_length(missing, 1) IS NULL;
  gates := gates || jsonb_build_object('key','consents','type','internal','owner','Compliance',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Missing approved consent: ' || array_to_string(missing, ', ') END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Approve the missing consent versions' END);
  IF NOT ok THEN blockers := array_append(blockers, 'consents'); END IF;

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
    IF NOT ok THEN blockers := array_append(blockers, k); END IF;
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
  IF NOT ok THEN blockers := array_append(blockers, 'cash_pay_fee_configured'); END IF;

  SELECT * INTO ds FROM public.vendor_onboarding
   WHERE hospital_id = p_hospital_id AND vendor_key = 'dosespot' AND environment = 'production'
   ORDER BY updated_at DESC LIMIT 1;
  pc := ds.capabilities;

  -- Truthful, document-aligned DoseSpot gates. The REST V2 resource guide can
  -- satisfy only `rest_v2_reference_received`; it establishes nothing else.
  FOREACH k IN ARRAY ARRAY['rest_v2_reference_received','rest_auth_contract','jumpstart_launch_contract',
                           'staging_certification','production_base_url_allowlisted','environment_secret_refs',
                           'production_connection_test'] LOOP
    pcblk := public.dosespot_rest_blocker(pc, coalesce(ds.secret_ref_names, ARRAY[]::text[]), k);
    ok := ds.id IS NOT NULL AND pcblk IS NULL;
    IF k = 'production_connection_test' THEN
      ok := ok AND ds.state = 'production_verified'
            AND ds.last_test_result = 'production_readiness_passed'
            AND ds.evidence_expires_at IS NOT NULL AND ds.evidence_expires_at > now();
      IF pcblk IS NULL AND NOT ok AND ds.id IS NOT NULL THEN pcblk := 'production_connection_test_missing'; END IF;
    END IF;
    gates := gates || jsonb_build_object('key', k, 'type','external','owner','Vendor / Compliance',
      'status', CASE WHEN ok THEN 'verified' WHEN ds.id IS NULL THEN 'not_configured' ELSE 'unverified' END,
      'blocker', CASE WHEN ok THEN NULL ELSE coalesce(pcblk, 'no_dosespot_production_onboarding_row') END,
      'next_step', CASE WHEN ok THEN NULL ELSE CASE k
        WHEN 'rest_v2_reference_received' THEN 'Associate the uploaded DoseSpot RESTful API Guide V2 (v1.4.0, sha256 9bed7b50…) with this hospital and approve it'
        WHEN 'rest_auth_contract' THEN 'Obtain the separate DoseSpot RESTful API Authentication Guide, record the subscription header name and JWT token mapping, and approve it'
        WHEN 'jumpstart_launch_contract' THEN 'Obtain the separate DoseSpot Jumpstart embedded launch/SSO guide; prescribing launch stays blocked until it is recorded and approved'
        WHEN 'staging_certification' THEN 'Complete staging Surescripts certification with the DoseSpot Integration Specialist and record the evidence'
        WHEN 'production_base_url_allowlisted' THEN 'Record the exact production base URL DoseSpot supplies after certification and add its host to the environment allowlist'
        WHEN 'environment_secret_refs' THEN 'Provision production Clinic Id, User Id, Clinic Key and Subscription Key secret references'
        ELSE 'Record an unexpired production connection test with BAA and vendor portal MFA evidence' END END);
    IF p_prescribing AND NOT ok THEN blockers := array_append(blockers, k); END IF;
  END LOOP;

  -- DoseSpot numeric identifiers are environment-specific and must be mapped explicitly.
  ok := ds.id IS NOT NULL
        AND EXISTS (SELECT 1 FROM public.vendor_identity_mappings m
                     WHERE m.hospital_id = p_hospital_id AND m.vendor_key = 'dosespot'
                       AND m.environment = 'production' AND m.subject_type = 'facility')
        AND EXISTS (SELECT 1 FROM public.vendor_identity_mappings m
                     WHERE m.hospital_id = p_hospital_id AND m.vendor_key = 'dosespot'
                       AND m.environment = 'production' AND m.subject_type = 'prescriber');
  gates := gates || jsonb_build_object('key','identifier_mappings','type','internal','owner','Operations',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Production DoseSpot Clinic Id / Clinician Id are not mapped for this facility' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Record production vendor identity mappings; staging identifiers are never reused' END);
  IF p_prescribing AND NOT ok THEN blockers := array_append(blockers, 'identifier_mappings'); END IF;

  ok := EXISTS (
    SELECT 1 FROM public.provider_service_lines psl
     JOIN public.provider_licenses l ON l.provider_user_id = psl.provider_user_id
      AND l.hospital_id = psl.hospital_id
     WHERE psl.hospital_id = p_hospital_id AND psl.service_line_id = p_service_line_id AND psl.active
       AND l.state_code = p_state_code AND l.status = 'active' AND l.telehealth_permitted
       AND (l.expiration_date IS NULL OR l.expiration_date >= current_date)
       AND EXISTS (SELECT 1 FROM public.staff_credentials c
                    WHERE c.hospital_id = p_hospital_id AND c.user_id = psl.provider_user_id
                      AND c.credential_type = 'dosespot_registration' AND c.status = 'verified'
                      AND c.effective_date <= current_date
                      AND (c.expiration_date IS NULL OR c.expiration_date >= current_date))
       AND EXISTS (SELECT 1 FROM public.vendor_identity_mappings m
                    WHERE m.hospital_id = p_hospital_id AND m.vendor_key = 'dosespot'
                      AND m.environment = 'production' AND m.subject_type = 'prescriber'
                      AND m.subject_id = psl.provider_user_id));
  gates := gates || jsonb_build_object('key','prescriber_registration','type','external','owner','Vendor / Credentialing',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No prescriber has a verified DoseSpot registration plus a mapped production clinician identifier' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Register the prescriber with DoseSpot, confirm Confirmed/Active and record the verified registration credential' END);
  IF p_prescribing AND NOT ok THEN blockers := array_append(blockers, 'prescriber_registration'); END IF;

  ok := ok
        AND public.jsonb_is_true(pc -> 'epcs')
        AND public.jsonb_is_true(pc -> 'epcs_identity_proofing_verified')
        AND public.jsonb_is_true(pc -> 'epcs_two_factor_verified')
        AND EXISTS (
          SELECT 1 FROM public.provider_service_lines psl
           JOIN public.provider_licenses l ON l.provider_user_id = psl.provider_user_id
            AND l.hospital_id = psl.hospital_id
           WHERE psl.hospital_id = p_hospital_id AND psl.service_line_id = p_service_line_id AND psl.active
             AND l.state_code = p_state_code AND l.status = 'active' AND l.telehealth_permitted
             AND (l.expiration_date IS NULL OR l.expiration_date >= current_date)
             AND public.dosespot_prescriber_epcs_ok(p_hospital_id, psl.provider_user_id, p_state_code));
  gates := gates || jsonb_build_object('key','epcs_when_in_scope','type','external','owner','Vendor / Compliance',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'EPCS requires vendor certification plus per-prescriber identity proofing, two-factor, EPCS enrollment, DEA and state controlled-substance evidence' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Record verified, unexpired individual EPCS credentials for at least one authorized prescriber' END);
  IF p_controlled AND NOT ok THEN blockers := array_append(blockers, 'epcs_when_in_scope'); END IF;

  ok := NOT EXISTS (SELECT 1 FROM public.incident_reports r
                    WHERE r.hospital_id = p_hospital_id AND r.severity = 'critical' AND r.status <> 'closed');
  gates := gates || jsonb_build_object('key','no_critical_defects','type','internal','owner','Engineering',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Unresolved critical safety, privacy or data-integrity incident' END,
    'next_step', CASE WHEN ok THEN NULL ELSE 'Close the open critical incident' END);
  IF NOT ok THEN blockers := array_append(blockers, 'no_critical_defects'); END IF;

  RETURN jsonb_build_object(
    'authorized', true, 'state_code', p_state_code, 'service_line_id', p_service_line_id,
    'prescribing', p_prescribing, 'controlled', p_controlled, 'gates', gates,
    'blockers', to_jsonb(blockers), 'can_launch', array_length(blockers, 1) IS NULL, 'note', NOTE_TEXT);
END $$;
REVOKE ALL ON FUNCTION public.obesity_launch_readiness_internal(uuid, uuid, text, boolean, boolean) FROM public, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.obesity_launch_readiness_internal(uuid, uuid, text, boolean, boolean) TO service_role;