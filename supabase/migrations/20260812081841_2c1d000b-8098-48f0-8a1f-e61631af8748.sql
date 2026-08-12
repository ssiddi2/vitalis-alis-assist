-- ============ 1. TYPES ============
DO $$ BEGIN
  CREATE TYPE public.claim_status AS ENUM (
    'draft','scrubbed','approved','submission_pending','submitted','acknowledged',
    'accepted','rejected','adjudicated','paid','denied','voided');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ============ 2. PAYERS ============
CREATE TABLE IF NOT EXISTS public.payers (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  name text NOT NULL,
  payer_code text,
  x12_payer_id text,
  claim_rules jsonb NOT NULL DEFAULT '{}'::jsonb,
  active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, name)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payers TO authenticated;
GRANT ALL ON public.payers TO service_role;
ALTER TABLE public.payers ENABLE ROW LEVEL SECURITY;
CREATE POLICY "payers_select" ON public.payers FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE POLICY "payers_admin_write" ON public.payers FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

-- ============ 3. COVERAGE (extends patient_insurance; no duplicate model) ============
ALTER TABLE public.patient_insurance
  ADD COLUMN IF NOT EXISTS hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS payer_id uuid REFERENCES public.payers(id),
  ADD COLUMN IF NOT EXISTS verification_status text NOT NULL DEFAULT 'unverified',
  ADD COLUMN IF NOT EXISTS verified_at timestamptz;
UPDATE public.patient_insurance ci SET hospital_id = p.hospital_id
  FROM public.patients p WHERE p.id = ci.patient_id AND ci.hospital_id IS NULL;

ALTER TABLE public.encounter_diagnoses
  ADD COLUMN IF NOT EXISTS code_set text NOT NULL DEFAULT 'ICD-10-CM',
  ADD COLUMN IF NOT EXISTS code_version text NOT NULL DEFAULT '2026';

-- ============ 4. ELIGIBILITY (X12 270/271 metadata only) ============
CREATE TABLE IF NOT EXISTS public.eligibility_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  coverage_id uuid REFERENCES public.patient_insurance(id) ON DELETE SET NULL,
  payer_id uuid REFERENCES public.payers(id),
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  transaction_type text NOT NULL DEFAULT '270',
  service_date date,
  control_number text NOT NULL,
  correlation_id text NOT NULL,
  payload_hash text,
  status text NOT NULL DEFAULT 'unavailable',
  response_code text,
  coverage_active boolean,
  copay_amount numeric(10,2),
  deductible_remaining numeric(10,2),
  coinsurance_percent numeric(5,2),
  plan_summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  requested_by uuid NOT NULL REFERENCES auth.users(id),
  requested_at timestamptz NOT NULL DEFAULT now(),
  responded_at timestamptz,
  UNIQUE (correlation_id)
);
GRANT SELECT ON public.eligibility_checks TO authenticated;
GRANT ALL ON public.eligibility_checks TO service_role;
ALTER TABLE public.eligibility_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "eligibility_select" ON public.eligibility_checks FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id));
CREATE TRIGGER eligibility_checks_append_only BEFORE UPDATE OR DELETE ON public.eligibility_checks
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ============ 5. PROVIDER PAYER ENROLLMENT ============
CREATE TABLE IF NOT EXISTS public.provider_payer_enrollments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  provider_user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  payer_id uuid NOT NULL REFERENCES public.payers(id) ON DELETE CASCADE,
  npi text,
  taxonomy_code text,
  enrollment_status text NOT NULL DEFAULT 'pending',
  effective_date date,
  end_date date,
  verified_at timestamptz,
  verification_source text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, provider_user_id, payer_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_payer_enrollments TO authenticated;
GRANT ALL ON public.provider_payer_enrollments TO service_role;
ALTER TABLE public.provider_payer_enrollments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "enrollments_select" ON public.provider_payer_enrollments FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE POLICY "enrollments_admin_write" ON public.provider_payer_enrollments FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

-- ============ 6. CLAIMS ============
CREATE TABLE IF NOT EXISTS public.claims (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  coverage_id uuid REFERENCES public.patient_insurance(id),
  payer_id uuid REFERENCES public.payers(id),
  billing_type text NOT NULL DEFAULT 'insurance',
  rendering_provider_id uuid NOT NULL REFERENCES auth.users(id),
  rendering_provider_npi text,
  billing_provider_npi text,
  enrollment_id uuid REFERENCES public.provider_payer_enrollments(id),
  place_of_service text,
  claim_type text NOT NULL DEFAULT '837P',
  status public.claim_status NOT NULL DEFAULT 'draft',
  total_charge numeric(12,2) NOT NULL DEFAULT 0,
  allowed_amount numeric(12,2),
  paid_amount numeric(12,2),
  patient_responsibility numeric(12,2),
  medical_necessity_note_id uuid REFERENCES public.clinical_notes(id),
  medical_necessity_rationale text,
  control_number text UNIQUE,
  idempotency_key text UNIQUE,
  correlation_id text,
  lock_version integer NOT NULL DEFAULT 1,
  submitted_at timestamptz,
  submitted_by uuid REFERENCES auth.users(id),
  submitted_snapshot jsonb,
  submitted_hash text,
  acknowledged_at timestamptz,
  adjudicated_at timestamptz,
  paid_at timestamptz,
  denial_code text,
  denial_reason text,
  appeal_status text,
  appeal_filed_at timestamptz,
  appeal_notes text,
  replaces_claim_id uuid REFERENCES public.claims(id),
  correction_reason text,
  created_by uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS claims_hospital_status_idx ON public.claims(hospital_id, status);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claims TO authenticated;
GRANT ALL ON public.claims TO service_role;
ALTER TABLE public.claims ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claims_select" ON public.claims FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id));
CREATE POLICY "claims_insert" ON public.claims FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id)
              AND created_by = auth.uid()
              AND (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin')));
CREATE POLICY "claims_update" ON public.claims FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id)
         AND (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin')))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id));
CREATE POLICY "claims_delete_draft_only" ON public.claims FOR DELETE TO authenticated
  USING (public.is_my_hospital(hospital_id) AND created_by = auth.uid()
         AND submitted_at IS NULL AND status = 'draft');

CREATE TABLE IF NOT EXISTS public.claim_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  line_number integer NOT NULL,
  cpt_code text NOT NULL,
  code_set text NOT NULL DEFAULT 'CPT',
  code_version text NOT NULL DEFAULT '2026',
  modifiers text[] NOT NULL DEFAULT '{}',
  units integer NOT NULL DEFAULT 1,
  charge_amount numeric(12,2) NOT NULL DEFAULT 0,
  diagnosis_pointers integer[] NOT NULL DEFAULT '{1}',
  service_date date,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (claim_id, line_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.claim_lines TO authenticated;
GRANT ALL ON public.claim_lines TO service_role;
ALTER TABLE public.claim_lines ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_lines_select" ON public.claim_lines FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE POLICY "claim_lines_write" ON public.claim_lines FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id)
         AND EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_id
                     AND c.hospital_id = claim_lines.hospital_id AND c.submitted_at IS NULL))
  WITH CHECK (public.is_my_hospital(hospital_id)
         AND EXISTS (SELECT 1 FROM public.claims c WHERE c.id = claim_id
                     AND c.hospital_id = claim_lines.hospital_id AND c.submitted_at IS NULL));

CREATE TABLE IF NOT EXISTS public.claim_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  actor_id uuid REFERENCES auth.users(id),
  from_status text,
  to_status text,
  event_code text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.claim_events TO authenticated;
GRANT ALL ON public.claim_events TO service_role;
ALTER TABLE public.claim_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_events_select" ON public.claim_events FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER claim_events_append_only BEFORE UPDATE OR DELETE ON public.claim_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ============ 7. SCRUBBER ============
CREATE TABLE IF NOT EXISTS public.claim_scrub_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  rule_code text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('hard','reviewable')),
  message text NOT NULL,
  source text NOT NULL,
  source_version text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.claim_scrub_results TO authenticated;
GRANT ALL ON public.claim_scrub_results TO service_role;
ALTER TABLE public.claim_scrub_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_scrub_select" ON public.claim_scrub_results FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER claim_scrub_results_append_only BEFORE UPDATE OR DELETE ON public.claim_scrub_results
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE IF NOT EXISTS public.claim_scrub_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.claim_scrub_results(id) ON DELETE CASCADE,
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  rationale text NOT NULL CHECK (length(btrim(rationale)) >= 10),
  overridden_by uuid NOT NULL REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (result_id)
);
GRANT SELECT, INSERT ON public.claim_scrub_overrides TO authenticated;
GRANT ALL ON public.claim_scrub_overrides TO service_role;
ALTER TABLE public.claim_scrub_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_override_select" ON public.claim_scrub_overrides FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE POLICY "claim_override_insert" ON public.claim_scrub_overrides FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND overridden_by = auth.uid()
              AND (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin')));
CREATE TRIGGER claim_scrub_overrides_append_only BEFORE UPDATE OR DELETE ON public.claim_scrub_overrides
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE OR REPLACE FUNCTION public.enforce_claim_scrub_override()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE r public.claim_scrub_results;
BEGIN
  NEW.overridden_by := COALESCE(auth.uid(), NEW.overridden_by);
  SELECT * INTO r FROM public.claim_scrub_results WHERE id = NEW.result_id;
  IF r.id IS NULL THEN RAISE EXCEPTION 'scrub result not found'; END IF;
  IF r.claim_id <> NEW.claim_id OR r.hospital_id <> NEW.hospital_id THEN
    RAISE EXCEPTION 'scrub override must reference the same claim and facility';
  END IF;
  IF r.severity = 'hard' THEN
    RAISE EXCEPTION 'a hard scrubber failure cannot be overridden';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_claim_scrub_override BEFORE INSERT ON public.claim_scrub_overrides
  FOR EACH ROW EXECUTE FUNCTION public.enforce_claim_scrub_override();

-- ============ 8. REMITTANCE (999 / 277CA / 835) ============
CREATE TABLE IF NOT EXISTS public.claim_remittances (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  payer_id uuid REFERENCES public.payers(id),
  transaction_type text NOT NULL CHECK (transaction_type IN ('999','277CA','835')),
  control_number text,
  correlation_id text,
  payload_hash text,
  status text NOT NULL,
  paid_amount numeric(12,2),
  allowed_amount numeric(12,2),
  patient_responsibility numeric(12,2),
  adjustment_codes text[] NOT NULL DEFAULT '{}',
  denial_code text,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  received_at timestamptz NOT NULL DEFAULT now(),
  reconciled_at timestamptz,
  reconciled_by uuid REFERENCES auth.users(id)
);
GRANT SELECT ON public.claim_remittances TO authenticated;
GRANT ALL ON public.claim_remittances TO service_role;
ALTER TABLE public.claim_remittances ENABLE ROW LEVEL SECURITY;
CREATE POLICY "remittance_select" ON public.claim_remittances FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER claim_remittances_append_only BEFORE DELETE ON public.claim_remittances
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ============ 9. CLEARINGHOUSE PROFILES + ENVELOPES ============
CREATE TABLE IF NOT EXISTS public.clearinghouse_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  vendor text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_status text NOT NULL DEFAULT 'not_configured',
  last_test_at timestamptz,
  last_test_result text,
  secret_ref_names text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, vendor, environment)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.clearinghouse_profiles TO authenticated;
GRANT ALL ON public.clearinghouse_profiles TO service_role;
ALTER TABLE public.clearinghouse_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "clearinghouse_select" ON public.clearinghouse_profiles FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE POLICY "clearinghouse_admin_write" ON public.clearinghouse_profiles FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.enforce_clearinghouse_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  IF EXISTS (SELECT 1 FROM unnest(NEW.secret_ref_names) n WHERE n !~ '^[A-Z][A-Z0-9_]{2,63}$') THEN
    RAISE EXCEPTION 'secret_ref_names must be uppercase secret NAMES only';
  END IF;
  IF NEW.environment = 'production' AND NEW.verification_status = 'verified'
     AND (NEW.last_test_at IS NULL OR NEW.last_test_result IS DISTINCT FROM 'passed') THEN
    RAISE EXCEPTION 'a production clearinghouse profile requires a passed end-to-end test';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_clearinghouse_profile BEFORE INSERT OR UPDATE ON public.clearinghouse_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_clearinghouse_profile();

CREATE TABLE IF NOT EXISTS public.claim_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  claim_id uuid NOT NULL REFERENCES public.claims(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  x12_version text NOT NULL DEFAULT '005010X222A1',
  correlation_id text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'queued',
  retry_count integer NOT NULL DEFAULT 0,
  vendor_reference text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.claim_outbox TO authenticated;
GRANT ALL ON public.claim_outbox TO service_role;
ALTER TABLE public.claim_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_outbox_select" ON public.claim_outbox FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER claim_outbox_append_only BEFORE UPDATE OR DELETE ON public.claim_outbox
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE IF NOT EXISTS public.claim_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  claim_id uuid REFERENCES public.claims(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  correlation_id text,
  payload_hash text NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received',
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.claim_inbox TO authenticated;
GRANT ALL ON public.claim_inbox TO service_role;
ALTER TABLE public.claim_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "claim_inbox_select" ON public.claim_inbox FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER claim_inbox_append_only BEFORE UPDATE OR DELETE ON public.claim_inbox
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ============ 10. CLAIM READINESS + LIFECYCLE ============
CREATE OR REPLACE FUNCTION public.claim_readiness(p_claim_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path = public AS $$
DECLARE c public.claims; e public.encounters; blocks text[] := '{}'; n integer;
BEGIN
  SELECT * INTO c FROM public.claims WHERE id = p_claim_id;
  IF c.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  SELECT * INTO e FROM public.encounters WHERE id = c.encounter_id;

  IF e.id IS NULL OR e.status <> 'completed' THEN blocks := blocks || 'Encounter is not completed'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.clinical_notes cn WHERE cn.encounter_id = c.encounter_id
                 AND cn.status IN ('signed','amended') AND cn.content_hash IS NOT NULL)
    THEN blocks := blocks || 'No signed clinical note for this encounter'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.encounter_diagnoses d WHERE d.encounter_id = c.encounter_id)
    THEN blocks := blocks || 'No validated diagnosis code'; END IF;
  SELECT count(*) INTO n FROM public.claim_lines l WHERE l.claim_id = c.id;
  IF n = 0 THEN blocks := blocks || 'No coded service line'; END IF;
  IF coalesce(btrim(c.place_of_service), '') = '' THEN blocks := blocks || 'Place of service missing'; END IF;
  IF coalesce(btrim(c.billing_provider_npi), '') = '' THEN blocks := blocks || 'Billing provider NPI missing'; END IF;
  IF coalesce(btrim(c.medical_necessity_rationale), '') = '' THEN blocks := blocks || 'Medical-necessity documentation missing'; END IF;
  IF c.billing_type = 'insurance' THEN
    IF c.coverage_id IS NULL OR c.payer_id IS NULL THEN blocks := blocks || 'Coverage and payer required for an insurance claim'; END IF;
    IF NOT EXISTS (SELECT 1 FROM public.provider_payer_enrollments pe
                   WHERE pe.hospital_id = c.hospital_id AND pe.provider_user_id = c.rendering_provider_id
                     AND pe.payer_id = c.payer_id AND pe.enrollment_status = 'active'
                     AND (pe.effective_date IS NULL OR pe.effective_date <= current_date)
                     AND (pe.end_date IS NULL OR pe.end_date >= current_date))
      THEN blocks := blocks || 'Rendering provider is not enrolled with this payer'; END IF;
  END IF;
  IF EXISTS (SELECT 1 FROM public.claim_scrub_results r WHERE r.claim_id = c.id AND r.severity = 'hard')
    THEN blocks := blocks || 'Unresolved hard scrubber failure'; END IF;
  IF EXISTS (SELECT 1 FROM public.claim_scrub_results r WHERE r.claim_id = c.id AND r.severity = 'reviewable'
             AND NOT EXISTS (SELECT 1 FROM public.claim_scrub_overrides o WHERE o.result_id = r.id))
    THEN blocks := blocks || 'Reviewable scrubber findings need a documented override'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.claim_scrub_results r WHERE r.claim_id = c.id)
     AND c.status = 'draft' THEN blocks := blocks || 'Claim has not been scrubbed'; END IF;

  RETURN jsonb_build_object('found', true, 'status', c.status, 'lock_version', c.lock_version,
    'can_approve', array_length(blocks, 1) IS NULL, 'blocks', to_jsonb(blocks));
END $$;

CREATE OR REPLACE FUNCTION public.enforce_claim_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE uid uuid := auth.uid(); allowed text[]; ready jsonb; e public.encounters;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF uid IS NOT NULL THEN NEW.created_by := uid; END IF;
    NEW.status := 'draft';
    NEW.lock_version := 1;
    NEW.submitted_at := NULL; NEW.submitted_by := NULL;
    NEW.submitted_snapshot := NULL; NEW.submitted_hash := NULL;
    SELECT * INTO e FROM public.encounters WHERE id = NEW.encounter_id;
    IF e.id IS NULL OR e.patient_id <> NEW.patient_id OR e.hospital_id <> NEW.hospital_id THEN
      RAISE EXCEPTION 'encounter, patient and facility must match';
    END IF;
    IF NEW.coverage_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.patient_insurance i WHERE i.id = NEW.coverage_id AND i.patient_id = NEW.patient_id
    ) THEN RAISE EXCEPTION 'coverage does not belong to this patient'; END IF;
    IF NEW.payer_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.payers p WHERE p.id = NEW.payer_id AND p.hospital_id = NEW.hospital_id
    ) THEN RAISE EXCEPTION 'payer does not belong to this facility'; END IF;
    INSERT INTO public.claim_events(claim_id, hospital_id, actor_id, to_status, event_code)
      VALUES (NEW.id, NEW.hospital_id, uid, 'draft', 'claim.created');
    RETURN NEW;
  END IF;

  IF NEW.hospital_id <> OLD.hospital_id OR NEW.patient_id <> OLD.patient_id
     OR NEW.encounter_id <> OLD.encounter_id OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'claim facility, patient, encounter and author are immutable';
  END IF;

  IF uid IS NOT NULL AND NEW.lock_version <> OLD.lock_version + 1 THEN
    RAISE EXCEPTION 'stale claim version';
  END IF;

  IF OLD.submitted_at IS NOT NULL THEN
    IF NEW.submitted_snapshot IS DISTINCT FROM OLD.submitted_snapshot
       OR NEW.submitted_hash IS DISTINCT FROM OLD.submitted_hash
       OR NEW.total_charge <> OLD.total_charge
       OR NEW.coverage_id IS DISTINCT FROM OLD.coverage_id
       OR NEW.payer_id IS DISTINCT FROM OLD.payer_id
       OR NEW.place_of_service IS DISTINCT FROM OLD.place_of_service
       OR NEW.rendering_provider_id <> OLD.rendering_provider_id
       OR NEW.billing_provider_npi IS DISTINCT FROM OLD.billing_provider_npi
       OR NEW.control_number IS DISTINCT FROM OLD.control_number THEN
      RAISE EXCEPTION 'submitted claim content is immutable; file a corrected or replacement claim';
    END IF;
  END IF;

  IF OLD.status = NEW.status THEN
    allowed := ARRAY[OLD.status::text];
  ELSE
    allowed := CASE OLD.status::text
      WHEN 'draft' THEN ARRAY['scrubbed','voided']
      WHEN 'scrubbed' THEN ARRAY['draft','approved','voided']
      WHEN 'approved' THEN ARRAY['draft','submission_pending','voided']
      WHEN 'submission_pending' THEN ARRAY['submitted','rejected','voided']
      WHEN 'submitted' THEN ARRAY['acknowledged','rejected']
      WHEN 'acknowledged' THEN ARRAY['accepted','rejected']
      WHEN 'accepted' THEN ARRAY['adjudicated','denied']
      WHEN 'adjudicated' THEN ARRAY['paid','denied']
      WHEN 'denied' THEN ARRAY['submission_pending','voided']
      WHEN 'rejected' THEN ARRAY['draft','voided']
      ELSE ARRAY[]::text[]
    END;
    IF NOT (NEW.status::text = ANY(allowed)) THEN
      RAISE EXCEPTION 'invalid claim transition % -> %', OLD.status, NEW.status;
    END IF;
    IF uid IS NOT NULL AND NEW.status::text IN
       ('submitted','acknowledged','accepted','rejected','adjudicated','paid','denied') THEN
      RAISE EXCEPTION 'claim submission and payer outcome states are set by the server path only';
    END IF;
  END IF;

  IF NEW.status = 'approved' AND OLD.status <> 'approved' THEN
    ready := public.claim_readiness(NEW.id);
    IF NOT (ready->>'can_approve')::boolean THEN
      RAISE EXCEPTION 'claim is not ready to approve: %', ready->>'blocks';
    END IF;
  END IF;

  IF NEW.status = 'submission_pending' AND OLD.status <> 'submission_pending' THEN
    IF OLD.status = 'denied' AND coalesce(btrim(NEW.correction_reason), '') = '' THEN
      RAISE EXCEPTION 'a corrected claim requires a documented correction reason';
    END IF;
    IF NEW.idempotency_key IS NULL OR NEW.correlation_id IS NULL THEN
      RAISE EXCEPTION 'an idempotency key and correlation id are required before submission';
    END IF;
    NEW.submitted_snapshot := to_jsonb(NEW) - 'submitted_snapshot' - 'submitted_hash' - 'updated_at' - 'lock_version';
    NEW.submitted_hash := encode(sha256(convert_to(NEW.submitted_snapshot::text, 'UTF8')), 'hex');
  END IF;

  IF NEW.status = 'submitted' AND OLD.status <> 'submitted' THEN
    NEW.submitted_at := now();
    NEW.submitted_by := COALESCE(uid, NEW.rendering_provider_id);
  END IF;
  IF NEW.status = 'adjudicated' AND OLD.status <> 'adjudicated' THEN NEW.adjudicated_at := now(); END IF;
  IF NEW.status = 'paid' AND OLD.status <> 'paid' THEN NEW.paid_at := now(); END IF;

  IF OLD.status <> NEW.status THEN
    INSERT INTO public.claim_events(claim_id, hospital_id, actor_id, from_status, to_status, event_code)
      VALUES (NEW.id, NEW.hospital_id, uid, OLD.status::text, NEW.status::text, 'claim.transition');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_claim_lifecycle BEFORE INSERT OR UPDATE ON public.claims
  FOR EACH ROW EXECUTE FUNCTION public.enforce_claim_lifecycle();

CREATE OR REPLACE FUNCTION public.enforce_claim_line_immutability()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
DECLARE c public.claims;
BEGIN
  SELECT * INTO c FROM public.claims WHERE id = COALESCE(NEW.claim_id, OLD.claim_id);
  IF c.id IS NULL THEN RETURN COALESCE(NEW, OLD); END IF;
  IF c.submitted_at IS NOT NULL THEN
    RAISE EXCEPTION 'service lines of a submitted claim are immutable';
  END IF;
  IF TG_OP <> 'DELETE' AND c.hospital_id <> NEW.hospital_id THEN
    RAISE EXCEPTION 'claim line must stay inside the claim facility';
  END IF;
  RETURN COALESCE(NEW, OLD);
END $$;
CREATE TRIGGER enforce_claim_line_immutability BEFORE INSERT OR UPDATE OR DELETE ON public.claim_lines
  FOR EACH ROW EXECUTE FUNCTION public.enforce_claim_line_immutability();

CREATE TRIGGER update_payers_updated_at BEFORE UPDATE ON public.payers
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
CREATE TRIGGER update_enrollments_updated_at BEFORE UPDATE ON public.provider_payer_enrollments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();