-- ============ helpers (SECURITY INVOKER) ============
CREATE OR REPLACE FUNCTION public.patient_in_my_hospital(_patient_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = _patient_id AND hu.user_id = auth.uid()
  )
$$;

CREATE OR REPLACE FUNCTION public.is_my_hospital(_hospital_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY INVOKER SET search_path = public AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.hospital_id = _hospital_id AND hu.user_id = auth.uid()
  )
$$;

-- ============ prescriptions: clinical + lifecycle columns ============
ALTER TABLE public.prescriptions
  ADD COLUMN IF NOT EXISTS lock_version integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS rx_kind text NOT NULL DEFAULT 'new',
  ADD COLUMN IF NOT EXISTS replaces_prescription_id uuid REFERENCES public.prescriptions(id),
  ADD COLUMN IF NOT EXISTS rxcui text,
  ADD COLUMN IF NOT EXISTS rxnorm_name text,
  ADD COLUMN IF NOT EXISTS ndc text,
  ADD COLUMN IF NOT EXISTS indication_text text,
  ADD COLUMN IF NOT EXISTS indication_code text,
  ADD COLUMN IF NOT EXISTS units text,
  ADD COLUMN IF NOT EXISTS days_supply integer,
  ADD COLUMN IF NOT EXISTS duration_days integer,
  ADD COLUMN IF NOT EXISTS dispense_as_written boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS pharmacy_ncpdp_id text,
  ADD COLUMN IF NOT EXISTS no_encounter_reason text,
  ADD COLUMN IF NOT EXISTS prescriber_state_code text,
  ADD COLUMN IF NOT EXISTS authored_at timestamptz NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS signed_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_by uuid,
  ADD COLUMN IF NOT EXISTS transmitted_at timestamptz,
  ADD COLUMN IF NOT EXISTS signed_snapshot jsonb,
  ADD COLUMN IF NOT EXISTS signed_hash text;

ALTER TABLE public.prescriptions DROP CONSTRAINT IF EXISTS prescriptions_rx_kind_check;
ALTER TABLE public.prescriptions ADD CONSTRAINT prescriptions_rx_kind_check
  CHECK (rx_kind IN ('new','refill','renewal','change'));

-- ============ append-only event log ============
CREATE TABLE IF NOT EXISTS public.prescription_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  actor_id uuid,
  from_status text,
  to_status text,
  event_code text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.prescription_events TO authenticated;
GRANT ALL ON public.prescription_events TO service_role;
ALTER TABLE public.prescription_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "rx_events_select_tenant" ON public.prescription_events
  FOR SELECT TO authenticated USING (public.patient_in_my_hospital(patient_id));

-- ============ safety checks + overrides ============
CREATE TABLE IF NOT EXISTS public.medication_safety_checks (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  check_type text NOT NULL,
  severity text NOT NULL CHECK (severity IN ('hard','reviewable','info')),
  detail_code text,
  message text NOT NULL,
  source text NOT NULL,
  source_version text NOT NULL,
  checked_at timestamptz NOT NULL DEFAULT now(),
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.medication_safety_checks TO authenticated;
GRANT ALL ON public.medication_safety_checks TO service_role;
ALTER TABLE public.medication_safety_checks ENABLE ROW LEVEL SECURITY;
CREATE POLICY "med_checks_select_tenant" ON public.medication_safety_checks
  FOR SELECT TO authenticated USING (public.patient_in_my_hospital(patient_id));
CREATE POLICY "med_checks_insert_tenant" ON public.medication_safety_checks
  FOR INSERT TO authenticated WITH CHECK (public.patient_in_my_hospital(patient_id) AND created_by = auth.uid());

CREATE TABLE IF NOT EXISTS public.medication_safety_overrides (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  check_id uuid NOT NULL REFERENCES public.medication_safety_checks(id) ON DELETE CASCADE,
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  overridden_by uuid NOT NULL,
  rationale text NOT NULL CHECK (length(btrim(rationale)) BETWEEN 10 AND 500),
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.medication_safety_overrides TO authenticated;
GRANT ALL ON public.medication_safety_overrides TO service_role;
ALTER TABLE public.medication_safety_overrides ENABLE ROW LEVEL SECURITY;
CREATE POLICY "med_overrides_select_tenant" ON public.medication_safety_overrides
  FOR SELECT TO authenticated USING (public.patient_in_my_hospital(patient_id));
CREATE POLICY "med_overrides_insert_tenant" ON public.medication_safety_overrides
  FOR INSERT TO authenticated WITH CHECK (public.patient_in_my_hospital(patient_id) AND overridden_by = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_safety_override()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE c record;
BEGIN
  NEW.overridden_by := COALESCE(auth.uid(), NEW.overridden_by);
  SELECT * INTO c FROM public.medication_safety_checks WHERE id = NEW.check_id;
  IF c IS NULL THEN RAISE EXCEPTION 'safety check not found'; END IF;
  IF c.prescription_id <> NEW.prescription_id OR c.patient_id <> NEW.patient_id THEN
    RAISE EXCEPTION 'safety override must reference the same prescription and patient';
  END IF;
  IF c.severity = 'hard' THEN
    RAISE EXCEPTION 'hard safety stop cannot be overridden';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_safety_override ON public.medication_safety_overrides;
CREATE TRIGGER trg_safety_override BEFORE INSERT ON public.medication_safety_overrides
  FOR EACH ROW EXECUTE FUNCTION public.enforce_safety_override();

DROP TRIGGER IF EXISTS trg_med_checks_append_only ON public.medication_safety_checks;
CREATE TRIGGER trg_med_checks_append_only BEFORE UPDATE OR DELETE ON public.medication_safety_checks
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();
DROP TRIGGER IF EXISTS trg_med_overrides_append_only ON public.medication_safety_overrides;
CREATE TRIGGER trg_med_overrides_append_only BEFORE UPDATE OR DELETE ON public.medication_safety_overrides
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();
DROP TRIGGER IF EXISTS trg_rx_events_append_only ON public.prescription_events;
CREATE TRIGGER trg_rx_events_append_only BEFORE UPDATE OR DELETE ON public.prescription_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ============ PDMP metadata ============
CREATE TABLE IF NOT EXISTS public.pdmp_queries (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  requested_by uuid NOT NULL,
  state_code text NOT NULL,
  purpose text NOT NULL,
  legal_basis text NOT NULL,
  vendor_request_id text,
  queried_at timestamptz NOT NULL DEFAULT now(),
  status text NOT NULL DEFAULT 'unavailable',
  result_summary_flag text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pdmp_queries TO authenticated;
GRANT ALL ON public.pdmp_queries TO service_role;
ALTER TABLE public.pdmp_queries ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdmp_select_scoped" ON public.pdmp_queries
  FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id) AND (requested_by = auth.uid() OR public.has_role(auth.uid(), 'admin')));

CREATE TABLE IF NOT EXISTS public.pdmp_access_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  pdmp_query_id uuid NOT NULL REFERENCES public.pdmp_queries(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  actor_id uuid NOT NULL,
  event_code text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.pdmp_access_events TO authenticated;
GRANT ALL ON public.pdmp_access_events TO service_role;
ALTER TABLE public.pdmp_access_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "pdmp_events_admin_select" ON public.pdmp_access_events
  FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));
DROP TRIGGER IF EXISTS trg_pdmp_events_append_only ON public.pdmp_access_events;
CREATE TRIGGER trg_pdmp_events_append_only BEFORE UPDATE OR DELETE ON public.pdmp_access_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();
DROP TRIGGER IF EXISTS trg_pdmp_queries_append_only ON public.pdmp_queries;
CREATE TRIGGER trg_pdmp_queries_append_only BEFORE UPDATE OR DELETE ON public.pdmp_queries
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ============ eRx integration profiles (no credentials, ever) ============
CREATE TABLE IF NOT EXISTS public.erx_integration_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  vendor text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  capabilities jsonb NOT NULL DEFAULT '{"new_rx":false,"cancel":false,"change":false,"refill":false,"med_history":false,"eligibility":false,"epcs":false}'::jsonb,
  epcs_enabled boolean NOT NULL DEFAULT false,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','testing','verified','suspended')),
  last_test_at timestamptz,
  last_test_result text,
  secret_ref_names text[] NOT NULL DEFAULT '{}',
  notes text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, vendor, environment)
);
GRANT SELECT ON public.erx_integration_profiles TO authenticated;
GRANT INSERT, UPDATE, DELETE ON public.erx_integration_profiles TO authenticated;
GRANT ALL ON public.erx_integration_profiles TO service_role;
ALTER TABLE public.erx_integration_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erx_profiles_select_members" ON public.erx_integration_profiles
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "erx_profiles_admin_write" ON public.erx_integration_profiles
  FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

CREATE OR REPLACE FUNCTION public.enforce_erx_profile()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  NEW.updated_at := now();
  -- secret_ref_names must be names, never values
  IF EXISTS (SELECT 1 FROM unnest(NEW.secret_ref_names) n WHERE n !~ '^[A-Z][A-Z0-9_]{2,63}$') THEN
    RAISE EXCEPTION 'secret_ref_names must be uppercase secret NAMES only';
  END IF;
  -- EPCS can never be enabled from the application layer
  IF NEW.epcs_enabled THEN
    RAISE EXCEPTION 'EPCS is disabled: DEA certification and identity proofing are not in place';
  END IF;
  IF COALESCE((NEW.capabilities->>'epcs')::boolean, false) THEN
    RAISE EXCEPTION 'EPCS capability cannot be enabled';
  END IF;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_erx_profile ON public.erx_integration_profiles;
CREATE TRIGGER trg_erx_profile BEFORE INSERT OR UPDATE ON public.erx_integration_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_erx_profile();

-- ============ idempotent, append-only eRx envelopes (server-written only) ============
CREATE TABLE IF NOT EXISTS public.erx_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  prescription_id uuid NOT NULL REFERENCES public.prescriptions(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  message_type text NOT NULL,
  script_version text NOT NULL DEFAULT 'NCPDP-SCRIPT-2017071',
  correlation_id text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'pending',
  retry_count integer NOT NULL DEFAULT 0,
  vendor_reference text,
  error_code text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.erx_outbox TO authenticated;
GRANT ALL ON public.erx_outbox TO service_role;
ALTER TABLE public.erx_outbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erx_outbox_select_members" ON public.erx_outbox
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));

CREATE TABLE IF NOT EXISTS public.erx_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id text NOT NULL UNIQUE,
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  correlation_id text,
  message_type text NOT NULL,
  vendor_reference text,
  payload_hash text NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  status text NOT NULL DEFAULT 'received',
  error_code text,
  received_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.erx_inbox TO authenticated;
GRANT ALL ON public.erx_inbox TO service_role;
ALTER TABLE public.erx_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "erx_inbox_admin_select" ON public.erx_inbox
  FOR SELECT TO authenticated
  USING (hospital_id IS NOT NULL AND public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

-- ============ external medication history staging ============
CREATE TABLE IF NOT EXISTS public.medication_history_candidates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  source text NOT NULL,
  source_version text,
  external_id text,
  medication_text text NOT NULL,
  rxcui text,
  dose text,
  route text,
  frequency text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','accepted','rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, UPDATE ON public.medication_history_candidates TO authenticated;
GRANT ALL ON public.medication_history_candidates TO service_role;
ALTER TABLE public.medication_history_candidates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "med_hist_select_tenant" ON public.medication_history_candidates
  FOR SELECT TO authenticated USING (public.patient_in_my_hospital(patient_id));
CREATE POLICY "med_hist_review_tenant" ON public.medication_history_candidates
  FOR UPDATE TO authenticated
  USING (public.patient_in_my_hospital(patient_id) AND status = 'pending')
  WITH CHECK (public.patient_in_my_hospital(patient_id) AND reviewed_by = auth.uid());

CREATE OR REPLACE FUNCTION public.enforce_med_history_review()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
BEGIN
  IF OLD.status <> 'pending' THEN RAISE EXCEPTION 'candidate already reviewed'; END IF;
  IF NEW.status NOT IN ('accepted','rejected') THEN RAISE EXCEPTION 'invalid review status'; END IF;
  IF NEW.patient_id <> OLD.patient_id OR NEW.medication_text <> OLD.medication_text
     OR NEW.source <> OLD.source OR COALESCE(NEW.rxcui,'') <> COALESCE(OLD.rxcui,'') THEN
    RAISE EXCEPTION 'imported medication provenance is immutable';
  END IF;
  NEW.reviewed_by := auth.uid();
  NEW.reviewed_at := now();
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS trg_med_history_review ON public.medication_history_candidates;
CREATE TRIGGER trg_med_history_review BEFORE UPDATE ON public.medication_history_candidates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_med_history_review();

-- ============ prescription lifecycle enforcement ============
CREATE OR REPLACE FUNCTION public.enforce_prescription_lifecycle()
RETURNS trigger LANGUAGE plpgsql SECURITY INVOKER SET search_path = public AS $$
DECLARE
  uid uuid := auth.uid();
  enc record;
  allowed text[];
  pat_state text;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF uid IS NOT NULL THEN NEW.prescriber_id := uid; END IF;
    IF NEW.status::text NOT IN ('draft','ready_for_review') THEN
      RAISE EXCEPTION 'new prescriptions must start as draft';
    END IF;
    NEW.lock_version := 1;
    NEW.signed_at := NULL; NEW.signed_by := NULL; NEW.transmitted_at := NULL;
    NEW.signed_snapshot := NULL; NEW.signed_hash := NULL;
    IF NEW.encounter_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.encounters e WHERE e.id = NEW.encounter_id AND e.patient_id = NEW.patient_id
    ) THEN RAISE EXCEPTION 'encounter does not belong to this patient'; END IF;
    INSERT INTO public.prescription_events(prescription_id, patient_id, actor_id, to_status, event_code)
      VALUES (NEW.id, NEW.patient_id, uid, NEW.status::text, 'rx.created');
    RETURN NEW;
  END IF;

  -- UPDATE
  IF NEW.patient_id <> OLD.patient_id OR NEW.prescriber_id <> OLD.prescriber_id
     OR COALESCE(NEW.encounter_id, '00000000-0000-0000-0000-000000000000'::uuid)
        <> COALESCE(OLD.encounter_id, '00000000-0000-0000-0000-000000000000'::uuid) THEN
    RAISE EXCEPTION 'patient, prescriber and encounter are immutable';
  END IF;

  IF uid IS NOT NULL AND NEW.lock_version <> OLD.lock_version + 1 THEN
    RAISE EXCEPTION 'stale prescription version';
  END IF;

  IF OLD.status::text = NEW.status::text THEN
    allowed := ARRAY[OLD.status::text];
  ELSE
    allowed := CASE OLD.status::text
      WHEN 'draft' THEN ARRAY['ready_for_review','cancelled']
      WHEN 'ready_for_review' THEN ARRAY['draft','signed','cancelled']
      WHEN 'signed' THEN ARRAY['transmission_pending','cancelled','discontinued']
      WHEN 'transmission_pending' THEN ARRAY['transmitted','errored','cancelled']
      WHEN 'transmitted' THEN ARRAY['accepted','errored','discontinued']
      WHEN 'accepted' THEN ARRAY['filled','discontinued']
      WHEN 'errored' THEN ARRAY['transmission_pending','cancelled']
      WHEN 'sent' THEN ARRAY['filled','cancelled','discontinued']
      WHEN 'filled' THEN ARRAY['discontinued']
      ELSE ARRAY[]::text[]
    END;
    IF NOT (NEW.status::text = ANY(allowed)) THEN
      RAISE EXCEPTION 'invalid prescription transition % -> %', OLD.status, NEW.status;
    END IF;
    -- transmission states are server-only
    IF uid IS NOT NULL AND NEW.status::text IN ('transmission_pending','transmitted','accepted','errored') THEN
      RAISE EXCEPTION 'transmission status is set by the server transmission path only';
    END IF;
  END IF;

  -- signed clinical content is immutable
  IF OLD.signed_at IS NOT NULL THEN
    IF NEW.medication_name <> OLD.medication_name
       OR COALESCE(NEW.sig,'') <> COALESCE(OLD.sig,'')
       OR COALESCE(NEW.dose,'') <> COALESCE(OLD.dose,'')
       OR COALESCE(NEW.route,'') <> COALESCE(OLD.route,'')
       OR COALESCE(NEW.frequency,'') <> COALESCE(OLD.frequency,'')
       OR COALESCE(NEW.quantity,-1) <> COALESCE(OLD.quantity,-1)
       OR COALESCE(NEW.refills,-1) <> COALESCE(OLD.refills,-1)
       OR COALESCE(NEW.days_supply,-1) <> COALESCE(OLD.days_supply,-1)
       OR COALESCE(NEW.rxcui,'') <> COALESCE(OLD.rxcui,'')
       OR NEW.dispense_as_written <> OLD.dispense_as_written
       OR NEW.signed_hash IS DISTINCT FROM OLD.signed_hash THEN
      RAISE EXCEPTION 'signed prescription content is immutable; use a change or cancel request';
    END IF;
  END IF;

  -- signing prerequisites
  IF NEW.status::text = 'signed' AND OLD.status::text <> 'signed' THEN
    IF NEW.dea_schedule IS NOT NULL AND btrim(NEW.dea_schedule) <> '' THEN
      RAISE EXCEPTION 'controlled substance prescribing is disabled (EPCS not certified)';
    END IF;
    IF NEW.rxcui IS NULL OR NEW.rxnorm_name IS NULL THEN
      RAISE EXCEPTION 'medication terminology unverified: RxNorm RxCUI is required';
    END IF;
    IF NEW.sig IS NULL OR NEW.quantity IS NULL OR NEW.units IS NULL OR NEW.route IS NULL
       OR NEW.frequency IS NULL OR NEW.days_supply IS NULL OR NEW.refills IS NULL
       OR NEW.indication_text IS NULL THEN
      RAISE EXCEPTION 'sig, quantity, units, route, frequency, days supply, refills and indication are required';
    END IF;
    IF NEW.pharmacy_name IS NULL AND NEW.pharmacy_ncpdp_id IS NULL THEN
      RAISE EXCEPTION 'a pharmacy selection is required';
    END IF;
    IF NEW.encounter_id IS NULL AND (NEW.no_encounter_reason IS NULL OR length(btrim(NEW.no_encounter_reason)) < 10) THEN
      RAISE EXCEPTION 'an encounter or a documented exception reason is required';
    END IF;
    IF NEW.encounter_id IS NOT NULL THEN
      SELECT * INTO enc FROM public.encounters e WHERE e.id = NEW.encounter_id;
      IF enc.med_rec_completed_at IS NULL OR enc.allergy_review_at IS NULL THEN
        RAISE EXCEPTION 'medication and allergy reconciliation must be completed first';
      END IF;
      pat_state := enc.patient_state_code;
    END IF;
    pat_state := COALESCE(NEW.prescriber_state_code, pat_state);
    IF pat_state IS NULL THEN RAISE EXCEPTION 'patient state is required to verify prescribing authority'; END IF;
    NEW.prescriber_state_code := pat_state;
    IF NOT EXISTS (
      SELECT 1 FROM public.provider_licenses l
      WHERE l.provider_user_id = NEW.prescriber_id
        AND l.state_code = pat_state
        AND l.status = 'active'
        AND l.telehealth_permitted
        AND (l.expiration_date IS NULL OR l.expiration_date >= current_date)
        AND (l.effective_date IS NULL OR l.effective_date <= current_date)
    ) THEN
      RAISE EXCEPTION 'no active prescribing authority for state %', pat_state;
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.medication_safety_checks c
      WHERE c.prescription_id = NEW.id AND c.severity = 'hard'
    ) THEN
      RAISE EXCEPTION 'an unresolved hard safety stop blocks signing';
    END IF;
    IF EXISTS (
      SELECT 1 FROM public.medication_safety_checks c
      WHERE c.prescription_id = NEW.id AND c.severity = 'reviewable'
        AND NOT EXISTS (SELECT 1 FROM public.medication_safety_overrides o WHERE o.check_id = c.id)
    ) THEN
      RAISE EXCEPTION 'reviewable safety alerts require acknowledgment with a rationale';
    END IF;
    NEW.signed_at := now();
    NEW.signed_by := COALESCE(uid, NEW.prescriber_id);
    NEW.signed_snapshot := to_jsonb(NEW) - 'signed_snapshot' - 'signed_hash' - 'updated_at' - 'lock_version';
    NEW.signed_hash := encode(sha256(convert_to(NEW.signed_snapshot::text, 'UTF8')), 'hex');
  END IF;

  IF NEW.status::text = 'transmitted' AND OLD.status::text <> 'transmitted' THEN
    NEW.transmitted_at := now();
  END IF;

  IF OLD.status::text <> NEW.status::text THEN
    INSERT INTO public.prescription_events(prescription_id, patient_id, actor_id, from_status, to_status, event_code)
      VALUES (NEW.id, NEW.patient_id, uid, OLD.status::text, NEW.status::text, 'rx.transition');
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS trg_prescription_lifecycle ON public.prescriptions;
CREATE TRIGGER trg_prescription_lifecycle BEFORE INSERT OR UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.enforce_prescription_lifecycle();

-- no client delete of signed/transmitted prescriptions
DROP POLICY IF EXISTS "Clinicians can delete prescriptions" ON public.prescriptions;
DROP POLICY IF EXISTS "rx_delete_unsigned_own" ON public.prescriptions;
CREATE POLICY "rx_delete_unsigned_own" ON public.prescriptions
  FOR DELETE TO authenticated
  USING (prescriber_id = auth.uid() AND signed_at IS NULL
         AND status::text IN ('draft','ready_for_review')
         AND public.patient_in_my_hospital(patient_id));