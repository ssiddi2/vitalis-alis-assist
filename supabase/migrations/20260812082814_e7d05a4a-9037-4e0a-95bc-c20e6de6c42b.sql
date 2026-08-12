-- ============ enums ============
CREATE TYPE public.diagnostic_kind AS ENUM ('lab','imaging');
CREATE TYPE public.diagnostic_order_status AS ENUM ('draft','ready','transmission_pending','transmitted','acknowledged','errored','cancelled','resulted');
CREATE TYPE public.diagnostic_result_status AS ENUM ('preliminary','final','corrected','amended','cancelled');
CREATE TYPE public.record_staging_status AS ENUM ('pending','accepted','rejected','corrected');

-- ============ 1. vendor profiles (secret NAMES only, fail closed) ============
CREATE TABLE public.diagnostic_vendor_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('lab','imaging','records_exchange')),
  vendor text NOT NULL,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  standards jsonb NOT NULL DEFAULT '{}'::jsonb,
  secret_ref_names text[] NOT NULL DEFAULT '{}',
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','testing','verified')),
  last_test_result text CHECK (last_test_result IN ('passed','failed')),
  last_test_at timestamptz,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, kind, vendor, environment)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_vendor_profiles TO authenticated;
GRANT ALL ON public.diagnostic_vendor_profiles TO service_role;
ALTER TABLE public.diagnostic_vendor_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor profiles readable in facility" ON public.diagnostic_vendor_profiles
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage vendor profiles" ON public.diagnostic_vendor_profiles
  FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.enforce_diagnostic_vendor_profile()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN NEW.created_by := COALESCE(auth.uid(), NEW.created_by); END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.secret_ref_names) n WHERE n !~ '^[A-Z][A-Z0-9_]{2,63}$') THEN
    RAISE EXCEPTION 'secret_ref_names must be uppercase secret NAMES only';
  END IF;
  IF NEW.environment = 'production'
     AND (NEW.verification_status <> 'verified' OR COALESCE(NEW.last_test_result,'') <> 'passed') THEN
    RAISE EXCEPTION 'a production diagnostic vendor profile requires a passed end-to-end test';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_diagnostic_vendor_profile BEFORE INSERT OR UPDATE ON public.diagnostic_vendor_profiles
  FOR EACH ROW EXECUTE FUNCTION public.enforce_diagnostic_vendor_profile();

-- ============ 2. SMART app registrations ============
CREATE TABLE public.smart_app_registrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  app_name text NOT NULL,
  client_id text NOT NULL,
  launch_type text NOT NULL DEFAULT 'ehr_launch' CHECK (launch_type IN ('ehr_launch','standalone','backend_service')),
  scopes text[] NOT NULL DEFAULT '{}',
  fhir_version text NOT NULL DEFAULT 'R4',
  jwks_uri text,
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  status text NOT NULL DEFAULT 'disabled' CHECK (status IN ('disabled','enabled')),
  secret_ref_names text[] NOT NULL DEFAULT '{}',
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, client_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.smart_app_registrations TO authenticated;
GRANT ALL ON public.smart_app_registrations TO service_role;
ALTER TABLE public.smart_app_registrations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "smart apps readable in facility" ON public.smart_app_registrations
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage smart apps" ON public.smart_app_registrations
  FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.enforce_smart_registration()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE bad text;
BEGIN
  NEW.updated_at := now();
  IF TG_OP = 'INSERT' THEN NEW.created_by := COALESCE(auth.uid(), NEW.created_by); END IF;
  IF EXISTS (SELECT 1 FROM unnest(NEW.secret_ref_names) n WHERE n !~ '^[A-Z][A-Z0-9_]{2,63}$') THEN
    RAISE EXCEPTION 'secret_ref_names must be uppercase secret NAMES only';
  END IF;
  SELECT s INTO bad FROM unnest(NEW.scopes) s
   WHERE s !~ '^(launch(/(patient|encounter))?|openid|fhirUser|offline_access|(patient|user|system)/[A-Za-z*]+\.(read|write|rs|cruds|c?r?u?d?s?))$'
   LIMIT 1;
  IF bad IS NOT NULL THEN RAISE EXCEPTION 'unsupported SMART scope: %', bad; END IF;
  IF NEW.status = 'enabled' AND NEW.environment = 'production' THEN
    RAISE EXCEPTION 'production SMART app registration is disabled: no EHR connection is contracted or verified';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_smart_registration BEFORE INSERT OR UPDATE ON public.smart_app_registrations
  FOR EACH ROW EXECUTE FUNCTION public.enforce_smart_registration();

-- ============ 3. terminology mappings ============
CREATE TABLE public.terminology_mappings (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  domain text NOT NULL CHECK (domain IN ('lab','imaging','condition','medication')),
  local_code text NOT NULL,
  local_system text NOT NULL,
  canonical_code text NOT NULL,
  canonical_system text NOT NULL CHECK (canonical_system IN ('LOINC','SNOMED-CT','CPT','ICD-10-CM','RxNorm','DICOM')),
  canonical_version text,
  display text,
  validated boolean NOT NULL DEFAULT false,
  validated_by uuid,
  validated_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, domain, local_system, local_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.terminology_mappings TO authenticated;
GRANT ALL ON public.terminology_mappings TO service_role;
ALTER TABLE public.terminology_mappings ENABLE ROW LEVEL SECURITY;
CREATE POLICY "mappings readable in facility" ON public.terminology_mappings
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage mappings" ON public.terminology_mappings
  FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.enforce_terminology_mapping()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  NEW.updated_at := now();
  IF NEW.canonical_system = 'LOINC' AND NEW.canonical_code !~ '^\d{1,5}-\d$' THEN
    RAISE EXCEPTION 'invalid LOINC code';
  END IF;
  IF NEW.canonical_system = 'CPT' AND NEW.canonical_code !~ '^\d{4}[0-9A-Z]$' THEN
    RAISE EXCEPTION 'invalid CPT code';
  END IF;
  IF NEW.validated THEN
    NEW.validated_by := COALESCE(auth.uid(), NEW.validated_by);
    NEW.validated_at := COALESCE(NEW.validated_at, now());
  ELSE
    NEW.validated_by := NULL; NEW.validated_at := NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_terminology_mapping BEFORE INSERT OR UPDATE ON public.terminology_mappings
  FOR EACH ROW EXECUTE FUNCTION public.enforce_terminology_mapping();

-- ============ 4. diagnostic orders ============
CREATE TABLE public.diagnostic_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  encounter_id uuid REFERENCES public.encounters(id) ON DELETE SET NULL,
  staged_order_id uuid REFERENCES public.staged_orders(id) ON DELETE SET NULL,
  kind public.diagnostic_kind NOT NULL,
  status public.diagnostic_order_status NOT NULL DEFAULT 'draft',
  code text NOT NULL,
  code_system text NOT NULL CHECK (code_system IN ('LOINC','CPT','DICOM','local')),
  code_version text,
  display text NOT NULL,
  priority text NOT NULL DEFAULT 'routine' CHECK (priority IN ('routine','urgent','stat')),
  modality text,
  body_site text,
  clinical_indication text,
  ordering_provider_id uuid NOT NULL,
  vendor_profile_id uuid REFERENCES public.diagnostic_vendor_profiles(id) ON DELETE SET NULL,
  message_profile text,
  placer_order_number text,
  filler_order_number text,
  correlation_id text,
  idempotency_key text,
  payload_hash text,
  signed_snapshot jsonb,
  transmitted_at timestamptz,
  error_code text,
  lock_version integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, idempotency_key)
);
CREATE INDEX idx_diag_orders_patient ON public.diagnostic_orders(patient_id, created_at DESC);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.diagnostic_orders TO authenticated;
GRANT ALL ON public.diagnostic_orders TO service_role;
ALTER TABLE public.diagnostic_orders ENABLE ROW LEVEL SECURITY;
CREATE POLICY "diagnostic orders readable in facility" ON public.diagnostic_orders
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "clinicians create diagnostic orders" ON public.diagnostic_orders
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id)
    AND public.patient_in_my_hospital(patient_id)
    AND ordering_provider_id = auth.uid()
    AND (public.has_role(auth.uid(),'clinician') OR public.has_role(auth.uid(),'admin')));
CREATE POLICY "clinicians update diagnostic orders" ON public.diagnostic_orders
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'clinician') OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id));
CREATE POLICY "authors delete unsent diagnostic orders" ON public.diagnostic_orders
  FOR DELETE TO authenticated
  USING (public.is_my_hospital(hospital_id) AND status = 'draft'
    AND transmitted_at IS NULL AND created_by = auth.uid());

CREATE TABLE public.diagnostic_order_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_id uuid NOT NULL REFERENCES public.diagnostic_orders(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  actor_id uuid,
  from_status text,
  to_status text,
  event_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.diagnostic_order_events TO authenticated;
GRANT ALL ON public.diagnostic_order_events TO service_role;
ALTER TABLE public.diagnostic_order_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "order events readable in facility" ON public.diagnostic_order_events
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER diagnostic_order_events_append_only BEFORE UPDATE OR DELETE ON public.diagnostic_order_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE OR REPLACE FUNCTION public.enforce_diagnostic_order_lifecycle()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); allowed text[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(uid, NEW.created_by);
    IF uid IS NOT NULL THEN NEW.ordering_provider_id := uid; END IF;
    IF NEW.status <> 'draft' THEN RAISE EXCEPTION 'new diagnostic orders must start as draft'; END IF;
    NEW.lock_version := 1;
    NEW.transmitted_at := NULL; NEW.payload_hash := NULL; NEW.signed_snapshot := NULL;
    IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.hospital_id = NEW.hospital_id) THEN
      RAISE EXCEPTION 'patient does not belong to this facility';
    END IF;
    IF NEW.encounter_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.encounters e WHERE e.id = NEW.encounter_id
        AND e.patient_id = NEW.patient_id AND e.hospital_id = NEW.hospital_id) THEN
      RAISE EXCEPTION 'encounter, patient and facility must match';
    END IF;
    INSERT INTO public.diagnostic_order_events(order_id, hospital_id, patient_id, actor_id, to_status, event_code)
      VALUES (NEW.id, NEW.hospital_id, NEW.patient_id, uid, 'draft', 'diag_order.created');
    RETURN NEW;
  END IF;

  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.encounter_id IS DISTINCT FROM OLD.encounter_id
     OR NEW.ordering_provider_id IS DISTINCT FROM OLD.ordering_provider_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'diagnostic order facility, patient, encounter and author are immutable';
  END IF;
  IF uid IS NOT NULL AND NEW.lock_version <> OLD.lock_version + 1 THEN
    RAISE EXCEPTION 'stale diagnostic order version';
  END IF;

  IF OLD.status <> NEW.status THEN
    allowed := CASE OLD.status::text
      WHEN 'draft' THEN ARRAY['ready','cancelled']
      WHEN 'ready' THEN ARRAY['draft','transmission_pending','cancelled']
      WHEN 'transmission_pending' THEN ARRAY['transmitted','errored','cancelled']
      WHEN 'transmitted' THEN ARRAY['acknowledged','errored','resulted','cancelled']
      WHEN 'acknowledged' THEN ARRAY['resulted','errored','cancelled']
      WHEN 'errored' THEN ARRAY['transmission_pending','cancelled']
      ELSE ARRAY[]::text[] END;
    IF NOT (NEW.status::text = ANY(allowed)) THEN
      RAISE EXCEPTION 'invalid diagnostic order transition % -> %', OLD.status, NEW.status;
    END IF;
    IF uid IS NOT NULL AND NEW.status::text IN ('transmission_pending','transmitted','acknowledged','errored','resulted') THEN
      RAISE EXCEPTION 'diagnostic order transmission and result states are set by the server path only';
    END IF;
    IF NEW.status = 'ready' THEN
      IF coalesce(btrim(NEW.clinical_indication),'') = '' THEN
        RAISE EXCEPTION 'a clinical indication is required before releasing this order';
      END IF;
      IF NEW.code_system = 'local' OR NEW.code_version IS NULL THEN
        RAISE EXCEPTION 'a versioned standard code (LOINC/CPT/DICOM) is required before releasing this order';
      END IF;
      IF NEW.kind = 'imaging' AND coalesce(btrim(NEW.modality),'') = '' THEN
        RAISE EXCEPTION 'an imaging modality is required before releasing this order';
      END IF;
    END IF;
    IF NEW.status = 'transmission_pending' AND (NEW.idempotency_key IS NULL OR NEW.correlation_id IS NULL) THEN
      RAISE EXCEPTION 'an idempotency key and correlation id are required before transmission';
    END IF;
    IF NEW.status = 'transmitted' THEN NEW.transmitted_at := now(); END IF;
    INSERT INTO public.diagnostic_order_events(order_id, hospital_id, patient_id, actor_id, from_status, to_status, event_code)
      VALUES (NEW.id, NEW.hospital_id, NEW.patient_id, uid, OLD.status::text, NEW.status::text, 'diag_order.transition');
  END IF;

  IF OLD.transmitted_at IS NOT NULL THEN
    IF NEW.code IS DISTINCT FROM OLD.code OR NEW.code_system IS DISTINCT FROM OLD.code_system
       OR NEW.display IS DISTINCT FROM OLD.display OR NEW.kind IS DISTINCT FROM OLD.kind
       OR NEW.priority IS DISTINCT FROM OLD.priority OR NEW.modality IS DISTINCT FROM OLD.modality
       OR NEW.body_site IS DISTINCT FROM OLD.body_site
       OR NEW.clinical_indication IS DISTINCT FROM OLD.clinical_indication
       OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash THEN
      RAISE EXCEPTION 'transmitted diagnostic order content is immutable; cancel and reorder';
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_diagnostic_order_lifecycle BEFORE INSERT OR UPDATE ON public.diagnostic_orders
  FOR EACH ROW EXECUTE FUNCTION public.enforce_diagnostic_order_lifecycle();

-- ============ 5. diagnostic results (append-only versions, critical flags) ============
CREATE TABLE public.diagnostic_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  order_id uuid REFERENCES public.diagnostic_orders(id) ON DELETE SET NULL,
  kind public.diagnostic_kind NOT NULL,
  status public.diagnostic_result_status NOT NULL DEFAULT 'preliminary',
  version integer NOT NULL DEFAULT 1,
  code text NOT NULL,
  code_system text NOT NULL,
  code_version text,
  display text NOT NULL,
  value_text text,
  unit text,
  reference_range text,
  interpretation text CHECK (interpretation IN ('normal','abnormal','critical_low','critical_high','inconclusive')),
  is_abnormal boolean NOT NULL DEFAULT false,
  is_critical boolean NOT NULL DEFAULT false,
  sensitive_category text,
  observed_at timestamptz,
  reported_at timestamptz NOT NULL DEFAULT now(),
  source_system text NOT NULL,
  source_version text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text,
  signature_verified boolean NOT NULL DEFAULT false,
  study_instance_uid text,
  dicomweb_study_ref text,
  imaging_study_id uuid REFERENCES public.imaging_studies(id) ON DELETE SET NULL,
  lab_result_id uuid REFERENCES public.lab_results(id) ON DELETE SET NULL,
  acknowledged_by uuid,
  acknowledged_at timestamptz,
  escalation_level integer NOT NULL DEFAULT 0,
  patient_release_status text NOT NULL DEFAULT 'blocked' CHECK (patient_release_status IN ('blocked','pending','released')),
  released_at timestamptz,
  released_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_diag_results_patient ON public.diagnostic_results(patient_id, reported_at DESC);
CREATE INDEX idx_diag_results_unacked ON public.diagnostic_results(hospital_id) WHERE acknowledged_at IS NULL;
GRANT SELECT, UPDATE ON public.diagnostic_results TO authenticated;
GRANT ALL ON public.diagnostic_results TO service_role;
ALTER TABLE public.diagnostic_results ENABLE ROW LEVEL SECURITY;
CREATE POLICY "results readable in facility" ON public.diagnostic_results
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "clinicians acknowledge results" ON public.diagnostic_results
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'clinician') OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id));

CREATE TABLE public.diagnostic_result_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.diagnostic_results(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  version integer NOT NULL,
  status public.diagnostic_result_status NOT NULL,
  snapshot jsonb NOT NULL,
  content_hash text NOT NULL,
  amendment_reason text,
  source_system text,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (result_id, version)
);
GRANT SELECT ON public.diagnostic_result_versions TO authenticated;
GRANT ALL ON public.diagnostic_result_versions TO service_role;
ALTER TABLE public.diagnostic_result_versions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "result versions readable in facility" ON public.diagnostic_result_versions
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER diagnostic_result_versions_append_only BEFORE UPDATE OR DELETE ON public.diagnostic_result_versions
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE public.result_acknowledgements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  result_id uuid NOT NULL REFERENCES public.diagnostic_results(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  actor_id uuid NOT NULL,
  action text NOT NULL CHECK (action IN ('acknowledged','callback_documented','escalated','released_to_patient')),
  callback_method text CHECK (callback_method IN ('phone','portal','in_person','message')),
  documentation text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.result_acknowledgements TO authenticated;
GRANT ALL ON public.result_acknowledgements TO service_role;
ALTER TABLE public.result_acknowledgements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "acks readable in facility" ON public.result_acknowledgements
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "clinicians record acks" ON public.result_acknowledgements
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id)
    AND actor_id = auth.uid()
    AND (public.has_role(auth.uid(),'clinician') OR public.has_role(auth.uid(),'admin')));
CREATE TRIGGER result_acknowledgements_append_only BEFORE UPDATE OR DELETE ON public.result_acknowledgements
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE public.result_release_rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  category text NOT NULL,
  auto_release boolean NOT NULL DEFAULT false,
  delay_hours integer NOT NULL DEFAULT 0,
  prohibited boolean NOT NULL DEFAULT false,
  rationale text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, category)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.result_release_rules TO authenticated;
GRANT ALL ON public.result_release_rules TO service_role;
ALTER TABLE public.result_release_rules ENABLE ROW LEVEL SECURITY;
CREATE POLICY "release rules readable in facility" ON public.result_release_rules
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage release rules" ON public.result_release_rules
  FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.enforce_diagnostic_result_integrity()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid(); rule public.result_release_rules;
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF uid IS NOT NULL THEN
      RAISE EXCEPTION 'results are written by the verified inbound server path only';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.hospital_id = NEW.hospital_id) THEN
      RAISE EXCEPTION 'patient does not belong to this facility';
    END IF;
    IF NEW.order_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM public.diagnostic_orders o WHERE o.id = NEW.order_id
        AND o.patient_id = NEW.patient_id AND o.hospital_id = NEW.hospital_id) THEN
      RAISE EXCEPTION 'result order, patient and facility must match';
    END IF;
    NEW.patient_release_status := 'blocked';
    RETURN NEW;
  END IF;

  -- clinical content and provenance are immutable; corrections arrive as new versions
  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.order_id IS DISTINCT FROM OLD.order_id
     OR NEW.code IS DISTINCT FROM OLD.code
     OR NEW.source_system IS DISTINCT FROM OLD.source_system
     OR NEW.provenance IS DISTINCT FROM OLD.provenance
     OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
     OR NEW.signature_verified IS DISTINCT FROM OLD.signature_verified THEN
    IF uid IS NOT NULL THEN
      RAISE EXCEPTION 'result content and provenance are immutable; amendments create a new version';
    END IF;
  END IF;

  IF uid IS NOT NULL THEN
    IF NEW.value_text IS DISTINCT FROM OLD.value_text OR NEW.status IS DISTINCT FROM OLD.status
       OR NEW.version IS DISTINCT FROM OLD.version OR NEW.is_critical IS DISTINCT FROM OLD.is_critical
       OR NEW.is_abnormal IS DISTINCT FROM OLD.is_abnormal THEN
      RAISE EXCEPTION 'result values and flags are set by the inbound server path only';
    END IF;
    IF OLD.acknowledged_at IS NOT NULL AND NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at THEN
      RAISE EXCEPTION 'a result acknowledgement cannot be withdrawn or reassigned';
    END IF;
    IF NEW.acknowledged_at IS DISTINCT FROM OLD.acknowledged_at THEN
      NEW.acknowledged_by := uid;
      NEW.acknowledged_at := now();
    END IF;
    IF NEW.patient_release_status IS DISTINCT FROM OLD.patient_release_status THEN
      IF NEW.patient_release_status = 'released' THEN
        SELECT * INTO rule FROM public.result_release_rules
         WHERE hospital_id = NEW.hospital_id AND category = COALESCE(NEW.sensitive_category, 'default');
        IF COALESCE(rule.prohibited, false) THEN
          RAISE EXCEPTION 'this result category may not be released to the patient portal';
        END IF;
        IF NEW.is_critical AND NEW.acknowledged_at IS NULL THEN
          RAISE EXCEPTION 'a critical result must be acknowledged before patient release';
        END IF;
        NEW.released_at := now();
        NEW.released_by := uid;
      ELSE
        NEW.released_at := NULL; NEW.released_by := NULL;
      END IF;
    END IF;
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_diagnostic_result_integrity BEFORE INSERT OR UPDATE ON public.diagnostic_results
  FOR EACH ROW EXECUTE FUNCTION public.enforce_diagnostic_result_integrity();
CREATE TRIGGER diagnostic_results_no_client_delete BEFORE DELETE ON public.diagnostic_results
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ============ 6. external record reconciliation staging ============
CREATE TABLE public.external_record_staging (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  candidate_patient_id uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  match_confidence numeric NOT NULL DEFAULT 0 CHECK (match_confidence >= 0 AND match_confidence <= 1),
  match_basis jsonb NOT NULL DEFAULT '{}'::jsonb,
  resource_type text NOT NULL,
  fhir_profile text,
  source_system text NOT NULL,
  source_version text,
  provenance jsonb NOT NULL DEFAULT '{}'::jsonb,
  consent_basis text NOT NULL,
  summary jsonb NOT NULL DEFAULT '{}'::jsonb,
  payload_hash text NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  status public.record_staging_status NOT NULL DEFAULT 'pending',
  reviewed_by uuid,
  reviewed_at timestamptz,
  review_reason text,
  accepted_target_table text,
  accepted_target_id uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX idx_staging_pending ON public.external_record_staging(hospital_id) WHERE status = 'pending';
GRANT SELECT, UPDATE ON public.external_record_staging TO authenticated;
GRANT ALL ON public.external_record_staging TO service_role;
ALTER TABLE public.external_record_staging ENABLE ROW LEVEL SECURITY;
CREATE POLICY "staging readable in facility" ON public.external_record_staging
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "clinicians review staging" ON public.external_record_staging
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'clinician') OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_my_hospital(hospital_id));

CREATE OR REPLACE FUNCTION public.enforce_record_staging_review()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF uid IS NOT NULL THEN
      RAISE EXCEPTION 'external records are staged by the verified inbound server path only';
    END IF;
    NEW.status := 'pending'; NEW.patient_id := NULL;
    NEW.reviewed_by := NULL; NEW.reviewed_at := NULL;
    NEW.accepted_target_table := NULL; NEW.accepted_target_id := NULL;
    RETURN NEW;
  END IF;

  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.resource_type IS DISTINCT FROM OLD.resource_type
     OR NEW.source_system IS DISTINCT FROM OLD.source_system
     OR NEW.source_version IS DISTINCT FROM OLD.source_version
     OR NEW.provenance IS DISTINCT FROM OLD.provenance
     OR NEW.consent_basis IS DISTINCT FROM OLD.consent_basis
     OR NEW.summary IS DISTINCT FROM OLD.summary
     OR NEW.payload_hash IS DISTINCT FROM OLD.payload_hash
     OR NEW.signature_verified IS DISTINCT FROM OLD.signature_verified
     OR NEW.match_confidence IS DISTINCT FROM OLD.match_confidence THEN
    RAISE EXCEPTION 'staged record provenance and content are immutable';
  END IF;

  IF OLD.status <> 'pending' AND NEW.status IS DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'a reviewed external record cannot be re-reviewed; request a correction';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status NOT IN ('accepted','rejected','corrected') THEN
      RAISE EXCEPTION 'invalid staging review outcome';
    END IF;
    IF uid IS NULL THEN RAISE EXCEPTION 'staging review requires an authenticated clinician'; END IF;
    NEW.reviewed_by := uid;
    NEW.reviewed_at := now();
    IF coalesce(btrim(NEW.review_reason),'') = '' THEN
      RAISE EXCEPTION 'a review reason is required';
    END IF;
    IF NEW.status = 'accepted' THEN
      IF NEW.patient_id IS NULL THEN
        RAISE EXCEPTION 'a confirmed patient match is required before accepting an external record';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.hospital_id = NEW.hospital_id) THEN
        RAISE EXCEPTION 'the matched patient does not belong to this facility';
      END IF;
      IF coalesce(btrim(NEW.consent_basis),'') = '' THEN
        RAISE EXCEPTION 'a documented legal basis is required before accepting an external record';
      END IF;
    ELSE
      NEW.patient_id := NULL;
    END IF;
  ELSIF NEW.patient_id IS DISTINCT FROM OLD.patient_id AND OLD.status <> 'pending' THEN
    RAISE EXCEPTION 'the accepted patient match is immutable';
  END IF;

  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_record_staging_review BEFORE INSERT OR UPDATE ON public.external_record_staging
  FOR EACH ROW EXECUTE FUNCTION public.enforce_record_staging_review();
CREATE TRIGGER external_record_staging_no_client_delete BEFORE DELETE ON public.external_record_staging
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ============ 7. interop envelopes (idempotent, replay protected, hashes only) ============
CREATE TABLE public.interop_outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  vendor_profile_id uuid REFERENCES public.diagnostic_vendor_profiles(id) ON DELETE SET NULL,
  order_id uuid REFERENCES public.diagnostic_orders(id) ON DELETE SET NULL,
  message_type text NOT NULL,
  standard text NOT NULL CHECK (standard IN ('HL7v2','FHIR-R4','DICOMweb')),
  standard_version text,
  correlation_id text NOT NULL,
  idempotency_key text NOT NULL,
  payload_hash text NOT NULL,
  status text NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','blocked','failed')),
  blocked_reason text,
  attempts integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, idempotency_key)
);
CREATE TABLE public.interop_inbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL,
  vendor_profile_id uuid REFERENCES public.diagnostic_vendor_profiles(id) ON DELETE SET NULL,
  message_type text NOT NULL,
  standard text NOT NULL CHECK (standard IN ('HL7v2','FHIR-R4','DICOMweb')),
  standard_version text,
  correlation_id text,
  message_control_id text NOT NULL,
  payload_hash text NOT NULL,
  signature_verified boolean NOT NULL DEFAULT false,
  received_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz,
  outcome text NOT NULL DEFAULT 'received' CHECK (outcome IN ('received','staged','rejected','replay')),
  reject_code text,
  UNIQUE (hospital_id, message_control_id)
);
GRANT SELECT ON public.interop_outbox TO authenticated;
GRANT SELECT ON public.interop_inbox TO authenticated;
GRANT ALL ON public.interop_outbox TO service_role;
GRANT ALL ON public.interop_inbox TO service_role;
ALTER TABLE public.interop_outbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.interop_inbox ENABLE ROW LEVEL SECURITY;
CREATE POLICY "outbox readable in facility" ON public.interop_outbox
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "inbox readable in facility" ON public.interop_inbox
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER interop_outbox_append_only BEFORE UPDATE OR DELETE ON public.interop_outbox
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();
CREATE TRIGGER interop_inbox_append_only BEFORE UPDATE OR DELETE ON public.interop_inbox
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- imaging study identifiers (metadata + viewer link only; never binaries)
ALTER TABLE public.imaging_studies
  ADD COLUMN IF NOT EXISTS study_instance_uid text,
  ADD COLUMN IF NOT EXISTS dicomweb_study_ref text,
  ADD COLUMN IF NOT EXISTS series_count integer,
  ADD COLUMN IF NOT EXISTS instance_count integer;

-- ============ 8. readiness helper ============
CREATE OR REPLACE FUNCTION public.diagnostic_order_readiness(p_order_id uuid)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE o public.diagnostic_orders; b text[] := '{}'; prof public.diagnostic_vendor_profiles;
BEGIN
  SELECT * INTO o FROM public.diagnostic_orders WHERE id = p_order_id;
  IF o.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;
  IF NOT public.is_my_hospital(o.hospital_id) THEN RETURN jsonb_build_object('found', false); END IF;

  IF coalesce(btrim(o.clinical_indication),'') = '' THEN b := b || 'Clinical indication missing'; END IF;
  IF o.code_system = 'local' OR o.code_version IS NULL THEN b := b || 'Versioned standard code missing'; END IF;
  IF o.kind = 'imaging' AND coalesce(btrim(o.modality),'') = '' THEN b := b || 'Imaging modality missing'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.terminology_mappings m
                 WHERE m.hospital_id = o.hospital_id AND m.canonical_code = o.code AND m.validated)
     THEN b := b || 'No validated terminology mapping for this code'; END IF;

  SELECT * INTO prof FROM public.diagnostic_vendor_profiles
   WHERE id = o.vendor_profile_id AND hospital_id = o.hospital_id;
  IF prof.id IS NULL THEN b := b || 'No vendor profile selected';
  ELSIF prof.verification_status <> 'verified' THEN b := b || 'Vendor profile is not verified';
  ELSIF coalesce(prof.last_test_result,'') <> 'passed' THEN b := b || 'Vendor end-to-end test has not passed';
  ELSIF prof.environment <> 'production' THEN b := b || 'Vendor profile is in TEST MODE (not connected)';
  END IF;

  RETURN jsonb_build_object('found', true, 'status', o.status, 'lock_version', o.lock_version,
    'can_release', array_length(b,1) IS NULL OR NOT (b && ARRAY['Clinical indication missing','Versioned standard code missing','Imaging modality missing']),
    'can_transmit', array_length(b,1) IS NULL, 'blocks', to_jsonb(b));
END $$;