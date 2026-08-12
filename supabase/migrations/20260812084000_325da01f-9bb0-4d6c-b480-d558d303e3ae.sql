-- ============================================================
-- Launch requirements 6 & 7: clinical governance, consent,
-- identity, credentialing and operational readiness.
-- ============================================================

-- ---------- governance roles (separation of duties) ----------
CREATE TABLE public.governance_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  role text NOT NULL CHECK (role IN ('medical_director','compliance')),
  granted_by uuid,
  granted_at timestamptz NOT NULL DEFAULT now(),
  revoked_at timestamptz,
  UNIQUE (hospital_id, user_id, role)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.governance_roles TO authenticated;
GRANT ALL ON public.governance_roles TO service_role;
ALTER TABLE public.governance_roles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "governance roles readable in facility" ON public.governance_roles
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage governance roles" ON public.governance_roles
  FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.has_governance_role(_user_id uuid, _hospital_id uuid, _role text)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path TO 'public' AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.governance_roles g
    WHERE g.user_id = _user_id AND g.hospital_id = _hospital_id
      AND g.role = _role AND g.revoked_at IS NULL
  )
$$;

-- ---------- versioned clinical protocol / order-set registry ----------
CREATE TABLE public.clinical_protocols (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('protocol','order_set','red_flag_screen','escalation_rule','documentation_template','prescribing_limit','service_scope_map')),
  service_line_id uuid REFERENCES public.service_lines(id) ON DELETE SET NULL,
  state_code text,
  scope text,
  title text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.clinical_protocols(id) ON DELETE SET NULL,
  owner_user_id uuid,
  source_evidence text,
  review_cadence_months integer NOT NULL DEFAULT 12,
  next_review_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','retired')),
  effective_start date,
  effective_end date,
  change_summary text,
  content jsonb NOT NULL DEFAULT '{}'::jsonb,
  generated_by_ai boolean NOT NULL DEFAULT false,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lock_version integer NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE ON public.clinical_protocols TO authenticated;
GRANT ALL ON public.clinical_protocols TO service_role;
ALTER TABLE public.clinical_protocols ENABLE ROW LEVEL SECURITY;
CREATE POLICY "protocols readable in facility" ON public.clinical_protocols
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "authorized staff author protocols" ON public.clinical_protocols
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND created_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'clinician')));
CREATE POLICY "authorized staff revise protocols" ON public.clinical_protocols
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'clinician')))
  WITH CHECK (public.is_my_hospital(hospital_id));

-- ---------- consent document registry ----------
CREATE TABLE public.consent_documents (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  purpose text NOT NULL CHECK (purpose IN ('telehealth','treatment','privacy','financial','communication')),
  jurisdiction_state_code text,
  service_line_id uuid REFERENCES public.service_lines(id) ON DELETE SET NULL,
  title text NOT NULL,
  version integer NOT NULL DEFAULT 1,
  supersedes_id uuid REFERENCES public.consent_documents(id) ON DELETE SET NULL,
  owner_user_id uuid,
  source_evidence text,
  review_cadence_months integer NOT NULL DEFAULT 12,
  next_review_date date,
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','in_review','approved','retired')),
  effective_start date,
  effective_end date,
  change_summary text,
  body_hash text NOT NULL,
  approved_at timestamptz,
  approved_by uuid,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  lock_version integer NOT NULL DEFAULT 1
);
GRANT SELECT, INSERT, UPDATE ON public.consent_documents TO authenticated;
GRANT ALL ON public.consent_documents TO service_role;
ALTER TABLE public.consent_documents ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent documents readable in facility" ON public.consent_documents
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins author consent documents" ON public.consent_documents
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND created_by = auth.uid()
    AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins revise consent documents" ON public.consent_documents
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id));

-- ---------- append-only approvals ledger ----------
CREATE TABLE public.governance_approvals (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('clinical_protocols','consent_documents')),
  subject_id uuid NOT NULL,
  approver_id uuid NOT NULL,
  approver_role text NOT NULL CHECK (approver_role IN ('medical_director','compliance')),
  decision text NOT NULL CHECK (decision IN ('approved','rejected')),
  rationale text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX governance_approvals_subject_idx ON public.governance_approvals (subject_type, subject_id);
GRANT SELECT, INSERT ON public.governance_approvals TO authenticated;
GRANT ALL ON public.governance_approvals TO service_role;
ALTER TABLE public.governance_approvals ENABLE ROW LEVEL SECURITY;
CREATE POLICY "approvals readable in facility" ON public.governance_approvals
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "governance officers record approvals" ON public.governance_approvals
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND approver_id = auth.uid()
    AND public.has_governance_role(auth.uid(), hospital_id, approver_role));
CREATE TRIGGER governance_approvals_append_only BEFORE UPDATE OR DELETE ON public.governance_approvals
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE OR REPLACE FUNCTION public.enforce_governance_approval()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE v_h uuid; v_owner uuid; v_author uuid; v_status text;
BEGIN
  NEW.approver_id := COALESCE(auth.uid(), NEW.approver_id);
  IF NEW.subject_type NOT IN ('clinical_protocols','consent_documents') THEN
    RAISE EXCEPTION 'unsupported approval subject';
  END IF;
  EXECUTE format('SELECT hospital_id, owner_user_id, created_by, status FROM public.%I WHERE id = $1', NEW.subject_type)
    INTO v_h, v_owner, v_author, v_status USING NEW.subject_id;
  IF v_h IS NULL THEN RAISE EXCEPTION 'approval subject not found'; END IF;
  IF v_h IS DISTINCT FROM NEW.hospital_id THEN
    RAISE EXCEPTION 'an approval must stay inside the artifact facility';
  END IF;
  IF v_status <> 'in_review' THEN
    RAISE EXCEPTION 'only an artifact in review can be approved or rejected';
  END IF;
  IF NOT public.has_governance_role(NEW.approver_id, NEW.hospital_id, NEW.approver_role) THEN
    RAISE EXCEPTION 'approver does not hold the % role at this facility', NEW.approver_role;
  END IF;
  IF NEW.decision = 'approved' AND (NEW.approver_id = v_owner OR NEW.approver_id = v_author) THEN
    RAISE EXCEPTION 'authors cannot approve their own clinical content';
  END IF;
  IF NEW.decision = 'approved' AND EXISTS (
    SELECT 1 FROM public.governance_approvals a
    WHERE a.subject_type = NEW.subject_type AND a.subject_id = NEW.subject_id
      AND a.decision = 'approved' AND a.approver_id = NEW.approver_id
  ) THEN
    RAISE EXCEPTION 'separation of duties: one person cannot supply both approvals';
  END IF;
  IF coalesce(btrim(NEW.rationale), '') = '' THEN
    RAISE EXCEPTION 'an approval rationale is required';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_governance_approval BEFORE INSERT ON public.governance_approvals
  FOR EACH ROW EXECUTE FUNCTION public.enforce_governance_approval();

-- ---------- shared governed-artifact lifecycle ----------
CREATE OR REPLACE FUNCTION public.enforce_governed_artifact()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE
  uid uuid := auth.uid(); j jsonb; n_md integer; n_comp integer;
  v_prev_status text; v_prev_version integer; v_prev_h uuid;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(uid, NEW.created_by);
    NEW.owner_user_id := COALESCE(NEW.owner_user_id, NEW.created_by);
    NEW.status := 'draft';
    NEW.lock_version := 1;
    NEW.approved_at := NULL; NEW.approved_by := NULL;
    NEW.next_review_date := COALESCE(NEW.next_review_date,
      (current_date + (NEW.review_cadence_months || ' months')::interval)::date);
    IF NEW.supersedes_id IS NOT NULL THEN
      EXECUTE format('SELECT hospital_id, status, version FROM public.%I WHERE id = $1', TG_TABLE_NAME)
        INTO v_prev_h, v_prev_status, v_prev_version USING NEW.supersedes_id;
      IF v_prev_h IS DISTINCT FROM NEW.hospital_id THEN
        RAISE EXCEPTION 'a new version must supersede a version in the same facility';
      END IF;
      IF NEW.version <= v_prev_version THEN
        RAISE EXCEPTION 'a superseding version must increment the version number';
      END IF;
      IF coalesce(btrim(NEW.change_summary), '') = '' THEN
        RAISE EXCEPTION 'a change summary is required when superseding a version';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by
     OR NEW.version IS DISTINCT FROM OLD.version
     OR NEW.supersedes_id IS DISTINCT FROM OLD.supersedes_id THEN
    RAISE EXCEPTION 'governed artifact facility, author and version are immutable';
  END IF;

  IF OLD.status = 'retired' THEN
    RAISE EXCEPTION 'retired versions are immutable';
  END IF;

  IF OLD.status = 'approved' THEN
    IF NEW.status NOT IN ('approved','retired') THEN
      RAISE EXCEPTION 'approved versions may only be retired; publish a new version';
    END IF;
    IF (to_jsonb(NEW) - 'status' - 'effective_end' - 'updated_at' - 'lock_version')
       IS DISTINCT FROM (to_jsonb(OLD) - 'status' - 'effective_end' - 'updated_at' - 'lock_version') THEN
      RAISE EXCEPTION 'approved versions are immutable; publish a new version';
    END IF;
    IF NEW.status = 'retired' THEN
      NEW.effective_end := COALESCE(NEW.effective_end, current_date);
    END IF;
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status AND OLD.status <> 'approved' THEN
    IF NOT ((OLD.status = 'draft' AND NEW.status IN ('in_review','retired'))
         OR (OLD.status = 'in_review' AND NEW.status IN ('draft','approved','retired'))) THEN
      RAISE EXCEPTION 'illegal governance transition % -> %', OLD.status, NEW.status;
    END IF;

    IF NEW.status = 'approved' THEN
      j := to_jsonb(NEW);
      IF COALESCE((j->>'generated_by_ai')::boolean, false)
         AND COALESCE(j->>'kind','') IN ('red_flag_screen','escalation_rule','prescribing_limit','service_scope_map') THEN
        RAISE EXCEPTION 'autogenerated clinical content cannot approve or override a safety rule';
      END IF;
      SELECT count(*) FILTER (WHERE a.approver_role = 'medical_director'),
             count(*) FILTER (WHERE a.approver_role = 'compliance')
        INTO n_md, n_comp
        FROM public.governance_approvals a
       WHERE a.subject_type = TG_TABLE_NAME AND a.subject_id = NEW.id AND a.decision = 'approved';
      IF COALESCE(n_md,0) < 1 OR COALESCE(n_comp,0) < 1 THEN
        RAISE EXCEPTION 'production use requires a medical-director approval and an independent compliance approval';
      END IF;
      IF coalesce(btrim(NEW.source_evidence), '') = '' THEN
        RAISE EXCEPTION 'an evidence or source reference is required before approval';
      END IF;
      NEW.approved_at := now();
      NEW.approved_by := uid;
      NEW.effective_start := COALESCE(NEW.effective_start, current_date);
    END IF;
  END IF;

  NEW.updated_at := now();
  NEW.lock_version := OLD.lock_version + 1;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_clinical_protocol BEFORE INSERT OR UPDATE ON public.clinical_protocols
  FOR EACH ROW EXECUTE FUNCTION public.enforce_governed_artifact();
CREATE TRIGGER enforce_consent_document BEFORE INSERT OR UPDATE ON public.consent_documents
  FOR EACH ROW EXECUTE FUNCTION public.enforce_governed_artifact();
CREATE TRIGGER clinical_protocols_no_client_delete BEFORE DELETE ON public.clinical_protocols
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();
CREATE TRIGGER consent_documents_no_client_delete BEFORE DELETE ON public.consent_documents
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ---------- patient consent records ----------
CREATE TABLE public.consent_records (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  consent_document_id uuid NOT NULL REFERENCES public.consent_documents(id),
  purpose text NOT NULL,
  presented_at timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  declined_at timestamptz,
  withdrawn_at timestamptz,
  withdrawal_reason text,
  signer_name text,
  signer_relationship text NOT NULL DEFAULT 'self',
  method text NOT NULL DEFAULT 'electronic',
  evidence_hash text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX consent_records_patient_idx ON public.consent_records (patient_id, purpose);
GRANT SELECT, INSERT, UPDATE ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "consent records readable in facility" ON public.consent_records
  FOR SELECT TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id));
CREATE POLICY "staff record consent" ON public.consent_records
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id)
    AND created_by = auth.uid());
CREATE POLICY "staff record consent withdrawal" ON public.consent_records
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.patient_in_my_hospital(patient_id));

CREATE OR REPLACE FUNCTION public.enforce_consent_record()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE d public.consent_documents;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    SELECT * INTO d FROM public.consent_documents WHERE id = NEW.consent_document_id;
    IF d.id IS NULL OR d.hospital_id IS DISTINCT FROM NEW.hospital_id THEN
      RAISE EXCEPTION 'consent document must belong to this facility';
    END IF;
    IF d.status <> 'approved' THEN
      RAISE EXCEPTION 'only an approved consent version can be presented to a patient';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.hospital_id = NEW.hospital_id) THEN
      RAISE EXCEPTION 'patient does not belong to this facility';
    END IF;
    NEW.purpose := d.purpose;
    NEW.withdrawn_at := NULL;
    IF coalesce(btrim(NEW.evidence_hash), '') = '' THEN
      RAISE EXCEPTION 'consent evidence hash is required';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.consent_document_id IS DISTINCT FROM OLD.consent_document_id
     OR NEW.purpose IS DISTINCT FROM OLD.purpose
     OR NEW.evidence_hash IS DISTINCT FROM OLD.evidence_hash
     OR NEW.presented_at IS DISTINCT FROM OLD.presented_at
     OR NEW.accepted_at IS DISTINCT FROM OLD.accepted_at
     OR NEW.signer_name IS DISTINCT FROM OLD.signer_name
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'consent evidence is immutable; record a withdrawal or a new consent';
  END IF;
  IF OLD.withdrawn_at IS NOT NULL AND NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at THEN
    RAISE EXCEPTION 'a consent withdrawal cannot be reversed';
  END IF;
  IF NEW.withdrawn_at IS DISTINCT FROM OLD.withdrawn_at THEN
    IF coalesce(btrim(NEW.withdrawal_reason), '') = '' THEN
      RAISE EXCEPTION 'a withdrawal reason is required';
    END IF;
    NEW.withdrawn_at := now();
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_consent_record BEFORE INSERT OR UPDATE ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.enforce_consent_record();
CREATE TRIGGER consent_records_no_client_delete BEFORE DELETE ON public.consent_records
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE OR REPLACE FUNCTION public.consent_status(_patient_id uuid, _hospital_id uuid, _state_code text DEFAULT NULL)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE missing text[] := '{}'; p text;
BEGIN
  IF NOT public.is_my_hospital(_hospital_id) THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;
  FOREACH p IN ARRAY ARRAY['telehealth','treatment','privacy','financial','communication'] LOOP
    IF NOT EXISTS (
      SELECT 1 FROM public.consent_records r
      JOIN public.consent_documents d ON d.id = r.consent_document_id
      WHERE r.patient_id = _patient_id AND r.hospital_id = _hospital_id
        AND r.purpose = p AND r.accepted_at IS NOT NULL AND r.withdrawn_at IS NULL
        AND d.status = 'approved'
        AND (d.jurisdiction_state_code IS NULL OR _state_code IS NULL OR d.jurisdiction_state_code = _state_code)
        AND (d.effective_end IS NULL OR d.effective_end >= current_date)
    ) THEN
      missing := missing || p;
    END IF;
  END LOOP;
  RETURN jsonb_build_object('authorized', true,
    'satisfied', array_length(missing,1) IS NULL, 'missing', to_jsonb(missing));
END $$;

-- ---------- identity proofing (metadata only) ----------
CREATE TABLE public.identity_verification_profiles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  vendor text NOT NULL,
  assurance_level text NOT NULL DEFAULT 'ial1' CHECK (assurance_level IN ('ial1','ial2','ial3')),
  environment text NOT NULL DEFAULT 'sandbox' CHECK (environment IN ('sandbox','production')),
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  verification_status text NOT NULL DEFAULT 'unverified' CHECK (verification_status IN ('unverified','pending','verified','disabled')),
  secret_ref_names text[] NOT NULL DEFAULT '{}',
  last_test_at timestamptz,
  last_test_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.identity_verification_profiles TO authenticated;
GRANT ALL ON public.identity_verification_profiles TO service_role;
ALTER TABLE public.identity_verification_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "identity profiles readable in facility" ON public.identity_verification_profiles
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage identity profiles" ON public.identity_verification_profiles
  FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));

CREATE TABLE public.identity_verifications (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  subject_type text NOT NULL CHECK (subject_type IN ('patient','staff')),
  patient_id uuid REFERENCES public.patients(id) ON DELETE CASCADE,
  subject_user_id uuid,
  profile_id uuid REFERENCES public.identity_verification_profiles(id) ON DELETE SET NULL,
  assurance_level text NOT NULL DEFAULT 'ial1' CHECK (assurance_level IN ('ial1','ial2','ial3')),
  result text NOT NULL CHECK (result IN ('pass','fail','pending','manual_exception')),
  reference_id text,
  verified_at timestamptz,
  expires_at timestamptz,
  exception_reason text,
  reviewer_id uuid,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.identity_verifications TO authenticated;
GRANT ALL ON public.identity_verifications TO service_role;
ALTER TABLE public.identity_verifications ENABLE ROW LEVEL SECURITY;
CREATE POLICY "identity verifications readable in facility" ON public.identity_verifications
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "clinical staff record identity verification" ON public.identity_verifications
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND created_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_role(auth.uid(),'clinician')));
CREATE TRIGGER identity_verifications_append_only BEFORE UPDATE OR DELETE ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE OR REPLACE FUNCTION public.enforce_identity_minimization()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE k text;
BEGIN
  NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
  FOR k IN SELECT jsonb_object_keys(NEW.metadata) LOOP
    IF lower(k) ~ '(image|photo|scan|selfie|biometric|fingerprint|otp|seed|secret|token|password|answer|kba|ssn|dob|birth|document_number|license_number|passport)' THEN
      RAISE EXCEPTION 'identity verification stores metadata only: % is not permitted', k;
    END IF;
  END LOOP;
  IF NEW.reference_id IS NOT NULL AND length(NEW.reference_id) > 128 THEN
    RAISE EXCEPTION 'identity reference is a vendor reference, not a credential payload';
  END IF;
  IF NEW.subject_type = 'patient' AND NEW.patient_id IS NULL THEN
    RAISE EXCEPTION 'a patient verification requires a patient';
  END IF;
  IF NEW.patient_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_id AND p.hospital_id = NEW.hospital_id) THEN
    RAISE EXCEPTION 'patient does not belong to this facility';
  END IF;
  IF NEW.subject_type = 'staff' AND NEW.subject_user_id IS NULL THEN
    RAISE EXCEPTION 'a staff verification requires a subject user';
  END IF;
  IF NEW.result = 'manual_exception' AND (NEW.reviewer_id IS NULL OR coalesce(btrim(NEW.exception_reason),'') = '') THEN
    RAISE EXCEPTION 'a manual identity exception requires a reviewer and a documented reason';
  END IF;
  IF NEW.result = 'pass' THEN NEW.verified_at := COALESCE(NEW.verified_at, now()); END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_identity_minimization BEFORE INSERT ON public.identity_verifications
  FOR EACH ROW EXECUTE FUNCTION public.enforce_identity_minimization();

-- ---------- credentialing & access lifecycle ----------
CREATE TABLE public.staff_credentials (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  credential_type text NOT NULL CHECK (credential_type IN ('identity','license','dea_registration','state_controlled_substance','malpractice','payer_enrollment','training','background_check','privilege')),
  state_code text,
  issuing_authority text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending','verified','expired','revoked','not_applicable')),
  effective_date date,
  expiration_date date,
  psv_source text,
  psv_verified_at timestamptz,
  psv_evidence_ref text,
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX staff_credentials_expiry_idx ON public.staff_credentials (hospital_id, expiration_date);
GRANT SELECT, INSERT, UPDATE ON public.staff_credentials TO authenticated;
GRANT ALL ON public.staff_credentials TO service_role;
ALTER TABLE public.staff_credentials ENABLE ROW LEVEL SECURITY;
CREATE POLICY "credentials readable in facility" ON public.staff_credentials
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage credentials" ON public.staff_credentials
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin') AND created_by = auth.uid());
CREATE POLICY "admins update credentials" ON public.staff_credentials
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));

CREATE OR REPLACE FUNCTION public.enforce_staff_credential()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.created_by := COALESCE(auth.uid(), NEW.created_by); END IF;
  IF coalesce(NEW.notes,'') ~ '[0-9]{6,}' OR coalesce(NEW.psv_evidence_ref,'') ~ '[0-9]{9,}' THEN
    RAISE EXCEPTION 'credentialing records store status and dates only, never credential values';
  END IF;
  IF NEW.status = 'verified' AND (NEW.psv_source IS NULL OR NEW.psv_verified_at IS NULL) THEN
    RAISE EXCEPTION 'primary-source verification evidence is required to mark a credential verified';
  END IF;
  IF NEW.status = 'verified' AND NEW.expiration_date IS NOT NULL AND NEW.expiration_date < current_date THEN
    NEW.status := 'expired';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_staff_credential BEFORE INSERT OR UPDATE ON public.staff_credentials
  FOR EACH ROW EXECUTE FUNCTION public.enforce_staff_credential();
CREATE TRIGGER staff_credentials_no_client_delete BEFORE DELETE ON public.staff_credentials
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE public.access_attestations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  kind text NOT NULL CHECK (kind IN ('onboarding','least_privilege_grant','access_review','termination')),
  roles_granted text[] NOT NULL DEFAULT '{}',
  attested_by uuid NOT NULL,
  attested_at timestamptz NOT NULL DEFAULT now(),
  notes text
);
GRANT SELECT, INSERT ON public.access_attestations TO authenticated;
GRANT ALL ON public.access_attestations TO service_role;
ALTER TABLE public.access_attestations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "attestations readable in facility" ON public.access_attestations
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins record attestations" ON public.access_attestations
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND attested_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')));
CREATE TRIGGER access_attestations_append_only BEFORE UPDATE OR DELETE ON public.access_attestations
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE OR REPLACE FUNCTION public.apply_access_attestation()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path TO 'public' AS $$
BEGIN
  IF NEW.kind = 'termination' THEN
    DELETE FROM public.hospital_users hu WHERE hu.user_id = NEW.user_id AND hu.hospital_id = NEW.hospital_id;
    UPDATE public.governance_roles g SET revoked_at = now()
      WHERE g.user_id = NEW.user_id AND g.hospital_id = NEW.hospital_id AND g.revoked_at IS NULL;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER apply_access_attestation AFTER INSERT ON public.access_attestations
  FOR EACH ROW EXECUTE FUNCTION public.apply_access_attestation();

-- ---------- support & operational readiness ----------
CREATE TABLE public.support_cases (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  category text NOT NULL CHECK (category IN ('access','clinical_workflow','integration','billing','device','other')),
  priority text NOT NULL DEFAULT 'normal' CHECK (priority IN ('low','normal','high','urgent')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','in_progress','waiting','resolved','closed')),
  subject text NOT NULL,
  description text NOT NULL,
  patient_ref uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  requester_id uuid NOT NULL,
  assignee_id uuid,
  resolution text,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.support_cases TO authenticated;
GRANT ALL ON public.support_cases TO service_role;
ALTER TABLE public.support_cases ENABLE ROW LEVEL SECURITY;
CREATE POLICY "support cases readable in facility" ON public.support_cases
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "members open support cases" ON public.support_cases
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND requester_id = auth.uid());
CREATE POLICY "members update own or assigned support cases" ON public.support_cases
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id)
    AND (requester_id = auth.uid() OR assignee_id = auth.uid() OR public.has_role(auth.uid(),'admin')))
  WITH CHECK (public.is_my_hospital(hospital_id));

CREATE OR REPLACE FUNCTION public.enforce_support_case_minimization()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE blob text;
BEGIN
  IF TG_OP = 'INSERT' THEN NEW.requester_id := COALESCE(auth.uid(), NEW.requester_id); END IF;
  blob := coalesce(NEW.subject,'') || ' ' || coalesce(NEW.description,'') || ' ' || coalesce(NEW.resolution,'');
  IF blob ~ '[0-9]{3}-[0-9]{2}-[0-9]{4}' OR blob ~ '[0-9]{2}/[0-9]{2}/[0-9]{4}'
     OR blob ~ '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}' OR blob ~ '[0-9]{9,}' THEN
    RAISE EXCEPTION 'support cases are PHI-minimized: reference the patient record instead of identifiers';
  END IF;
  IF length(coalesce(NEW.description,'')) > 2000 THEN
    RAISE EXCEPTION 'support description exceeds the 2000 character limit';
  END IF;
  IF NEW.patient_ref IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public.patients p WHERE p.id = NEW.patient_ref AND p.hospital_id = NEW.hospital_id) THEN
    RAISE EXCEPTION 'referenced patient does not belong to this facility';
  END IF;
  IF NEW.status IN ('resolved','closed') THEN NEW.resolved_at := COALESCE(NEW.resolved_at, now()); END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_support_case BEFORE INSERT OR UPDATE ON public.support_cases
  FOR EACH ROW EXECUTE FUNCTION public.enforce_support_case_minimization();
CREATE TRIGGER support_cases_no_client_delete BEFORE DELETE ON public.support_cases
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE public.incident_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('security','privacy','breach_assessment','availability','clinical_safety')),
  severity text NOT NULL DEFAULT 'low' CHECK (severity IN ('low','moderate','high','critical')),
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open','investigating','contained','closed')),
  summary text NOT NULL,
  discovered_at timestamptz NOT NULL DEFAULT now(),
  contained_at timestamptz,
  closed_at timestamptz,
  affected_record_estimate integer,
  risk_assessment jsonb NOT NULL DEFAULT '{}'::jsonb,
  notification_assessment text,
  notification_required boolean,
  reported_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.incident_reports TO authenticated;
GRANT ALL ON public.incident_reports TO service_role;
ALTER TABLE public.incident_reports ENABLE ROW LEVEL SECURITY;
CREATE POLICY "incidents readable in facility" ON public.incident_reports
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "members report incidents" ON public.incident_reports
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND reported_by = auth.uid());
CREATE POLICY "admins and compliance manage incidents" ON public.incident_reports
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')))
  WITH CHECK (public.is_my_hospital(hospital_id));
CREATE TRIGGER incident_reports_no_client_delete BEFORE DELETE ON public.incident_reports
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE public.complaints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  source text NOT NULL DEFAULT 'patient' CHECK (source IN ('patient','caregiver','staff','payer','regulator')),
  category text NOT NULL,
  status text NOT NULL DEFAULT 'received' CHECK (status IN ('received','acknowledged','investigating','resolved','escalated')),
  summary text NOT NULL,
  patient_ref uuid REFERENCES public.patients(id) ON DELETE SET NULL,
  received_at timestamptz NOT NULL DEFAULT now(),
  acknowledged_at timestamptz,
  resolved_at timestamptz,
  resolution text,
  owner_id uuid,
  created_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.complaints TO authenticated;
GRANT ALL ON public.complaints TO service_role;
ALTER TABLE public.complaints ENABLE ROW LEVEL SECURITY;
CREATE POLICY "complaints readable in facility" ON public.complaints
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "members log complaints" ON public.complaints
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND created_by = auth.uid());
CREATE POLICY "admins and compliance manage complaints" ON public.complaints
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')))
  WITH CHECK (public.is_my_hospital(hospital_id));
CREATE TRIGGER complaints_no_client_delete BEFORE DELETE ON public.complaints
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE public.continuity_exercises (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('downtime','bcp','dr','backup_restore')),
  performed_at timestamptz NOT NULL DEFAULT now(),
  result text NOT NULL CHECK (result IN ('passed','partial','failed')),
  rto_minutes integer,
  rpo_minutes integer,
  findings text,
  next_due_date date,
  performed_by uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.continuity_exercises TO authenticated;
GRANT ALL ON public.continuity_exercises TO service_role;
ALTER TABLE public.continuity_exercises ENABLE ROW LEVEL SECURITY;
CREATE POLICY "continuity exercises readable in facility" ON public.continuity_exercises
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins record continuity exercises" ON public.continuity_exercises
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND performed_by = auth.uid()
    AND public.has_role(auth.uid(),'admin'));
CREATE TRIGGER continuity_exercises_append_only BEFORE UPDATE OR DELETE ON public.continuity_exercises
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE public.vendor_agreements (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  vendor text NOT NULL,
  service text NOT NULL,
  phi_access boolean NOT NULL DEFAULT false,
  baa_status text NOT NULL DEFAULT 'none' CHECK (baa_status IN ('none','pending','executed','terminated')),
  baa_executed_at date,
  expires_at date,
  risk_review_at date,
  status text NOT NULL DEFAULT 'evaluating' CHECK (status IN ('evaluating','approved','suspended','terminated')),
  notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.vendor_agreements TO authenticated;
GRANT ALL ON public.vendor_agreements TO service_role;
ALTER TABLE public.vendor_agreements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "vendor agreements readable in facility" ON public.vendor_agreements
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage vendor agreements" ON public.vendor_agreements
  FOR ALL TO authenticated
  USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));

CREATE TABLE public.workforce_training (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  curriculum text NOT NULL,
  completed_at timestamptz,
  expires_at date,
  status text NOT NULL DEFAULT 'assigned' CHECK (status IN ('assigned','completed','expired')),
  evidence_ref text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE ON public.workforce_training TO authenticated;
GRANT ALL ON public.workforce_training TO service_role;
ALTER TABLE public.workforce_training ENABLE ROW LEVEL SECURITY;
CREATE POLICY "training readable in facility" ON public.workforce_training
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins manage training" ON public.workforce_training
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(),'admin'));
CREATE POLICY "admins or learner update training" ON public.workforce_training
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id) AND (public.has_role(auth.uid(),'admin') OR user_id = auth.uid()))
  WITH CHECK (public.is_my_hospital(hospital_id));

-- ---------- national launch readiness ----------
CREATE TABLE public.launch_readiness_gates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  state_code text NOT NULL,
  service_line_id uuid REFERENCES public.service_lines(id) ON DELETE CASCADE,
  gate_key text NOT NULL,
  gate_type text NOT NULL DEFAULT 'external' CHECK (gate_type IN ('internal','external')),
  status text NOT NULL DEFAULT 'unverified' CHECK (status IN ('unverified','in_progress','verified','blocked')),
  blocker text,
  evidence_ref text,
  verified_by uuid,
  verified_at timestamptz,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, state_code, service_line_id, gate_key)
);
GRANT SELECT, INSERT, UPDATE ON public.launch_readiness_gates TO authenticated;
GRANT ALL ON public.launch_readiness_gates TO service_role;
ALTER TABLE public.launch_readiness_gates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readiness gates readable in facility" ON public.launch_readiness_gates
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE POLICY "admins and compliance create readiness gates" ON public.launch_readiness_gates
  FOR INSERT TO authenticated
  WITH CHECK (public.is_my_hospital(hospital_id) AND created_by = auth.uid()
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')));
CREATE POLICY "admins and compliance update readiness gates" ON public.launch_readiness_gates
  FOR UPDATE TO authenticated
  USING (public.is_my_hospital(hospital_id)
    AND (public.has_role(auth.uid(),'admin') OR public.has_governance_role(auth.uid(), hospital_id, 'compliance')))
  WITH CHECK (public.is_my_hospital(hospital_id));
CREATE TRIGGER launch_readiness_gates_no_client_delete BEFORE DELETE ON public.launch_readiness_gates
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TABLE public.readiness_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  gate_id uuid REFERENCES public.launch_readiness_gates(id) ON DELETE CASCADE,
  actor_id uuid,
  from_status text,
  to_status text,
  event_code text NOT NULL,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT ON public.readiness_events TO authenticated;
GRANT ALL ON public.readiness_events TO service_role;
ALTER TABLE public.readiness_events ENABLE ROW LEVEL SECURITY;
CREATE POLICY "readiness events readable in facility" ON public.readiness_events
  FOR SELECT TO authenticated USING (public.is_my_hospital(hospital_id));
CREATE TRIGGER readiness_events_append_only BEFORE UPDATE OR DELETE ON public.readiness_events
  FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE OR REPLACE FUNCTION public.enforce_readiness_gate()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE uid uuid := auth.uid();
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(uid, NEW.created_by);
    NEW.status := COALESCE(NULLIF(NEW.status,'verified'), 'unverified');
    INSERT INTO public.readiness_events(hospital_id, gate_id, actor_id, to_status, event_code, metadata)
      VALUES (NEW.hospital_id, NEW.id, uid, NEW.status, 'gate.created',
              jsonb_build_object('gate_key', NEW.gate_key, 'state_code', NEW.state_code));
    RETURN NEW;
  END IF;
  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.state_code IS DISTINCT FROM OLD.state_code
     OR NEW.gate_key IS DISTINCT FROM OLD.gate_key
     OR NEW.service_line_id IS DISTINCT FROM OLD.service_line_id THEN
    RAISE EXCEPTION 'a readiness gate identity is immutable';
  END IF;
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'verified' THEN
      IF coalesce(btrim(NEW.evidence_ref), '') = '' THEN
        RAISE EXCEPTION 'verification evidence is required to verify a readiness gate';
      END IF;
      NEW.verified_by := uid;
      NEW.verified_at := now();
    ELSE
      NEW.verified_by := NULL; NEW.verified_at := NULL;
    END IF;
    INSERT INTO public.readiness_events(hospital_id, gate_id, actor_id, from_status, to_status, event_code, metadata)
      VALUES (NEW.hospital_id, NEW.id, uid, OLD.status, NEW.status, 'gate.transition',
              jsonb_build_object('gate_key', NEW.gate_key, 'blocker', NEW.blocker));
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END $$;
CREATE TRIGGER enforce_readiness_gate BEFORE INSERT OR UPDATE ON public.launch_readiness_gates
  FOR EACH ROW EXECUTE FUNCTION public.enforce_readiness_gate();

CREATE OR REPLACE FUNCTION public.launch_readiness(p_hospital_id uuid, p_service_line_id uuid, p_state_code text)
RETURNS jsonb LANGUAGE plpgsql STABLE SET search_path TO 'public' AS $$
DECLARE gates jsonb := '[]'::jsonb; blockers text[] := '{}'; ok boolean; g record; missing_consent text[] := '{}'; p text;
  FUNCTION_NOTE text := 'internal readiness only; no legal, clinical or regulatory approval is implied';
BEGIN
  IF NOT public.is_my_hospital(p_hospital_id) THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  -- licensure
  ok := EXISTS (SELECT 1 FROM public.provider_licenses l
                WHERE l.hospital_id = p_hospital_id AND l.state_code = p_state_code
                  AND l.status = 'active' AND l.telehealth_permitted
                  AND (l.expiration_date IS NULL OR l.expiration_date >= current_date));
  gates := gates || jsonb_build_object('key','licensure','type','internal',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No active state telehealth authorization' END);
  IF NOT ok THEN blockers := blockers || 'licensure'; END IF;

  -- approved clinical protocol for the service in this state
  ok := EXISTS (SELECT 1 FROM public.clinical_protocols c
                WHERE c.hospital_id = p_hospital_id AND c.kind = 'protocol' AND c.status = 'approved'
                  AND (c.service_line_id IS NULL OR c.service_line_id = p_service_line_id)
                  AND (c.state_code IS NULL OR c.state_code = p_state_code)
                  AND (c.effective_end IS NULL OR c.effective_end >= current_date));
  gates := gates || jsonb_build_object('key','clinical_protocol','type','internal',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No approved clinical protocol version' END);
  IF NOT ok THEN blockers := blockers || 'clinical_protocol'; END IF;

  -- approved red-flag safety screen
  ok := EXISTS (SELECT 1 FROM public.clinical_protocols c
                WHERE c.hospital_id = p_hospital_id AND c.kind = 'red_flag_screen' AND c.status = 'approved'
                  AND (c.service_line_id IS NULL OR c.service_line_id = p_service_line_id));
  gates := gates || jsonb_build_object('key','safety_screen','type','internal',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No approved red-flag screen version' END);
  IF NOT ok THEN blockers := blockers || 'safety_screen'; END IF;

  -- consent coverage for every purpose
  FOREACH p IN ARRAY ARRAY['telehealth','treatment','privacy','financial','communication'] LOOP
    IF NOT EXISTS (SELECT 1 FROM public.consent_documents d
                   WHERE d.hospital_id = p_hospital_id AND d.purpose = p AND d.status = 'approved'
                     AND (d.jurisdiction_state_code IS NULL OR d.jurisdiction_state_code = p_state_code)
                     AND (d.service_line_id IS NULL OR d.service_line_id = p_service_line_id)
                     AND (d.effective_end IS NULL OR d.effective_end >= current_date)) THEN
      missing_consent := missing_consent || p;
    END IF;
  END LOOP;
  ok := array_length(missing_consent, 1) IS NULL;
  gates := gates || jsonb_build_object('key','consent','type','internal',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Missing approved consent: ' || array_to_string(missing_consent, ', ') END);
  IF NOT ok THEN blockers := blockers || 'consent'; END IF;

  -- identity proofing
  ok := EXISTS (SELECT 1 FROM public.identity_verification_profiles i
                WHERE i.hospital_id = p_hospital_id AND i.verification_status = 'verified');
  gates := gates || jsonb_build_object('key','identity_proofing','type','external',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'No verified identity-proofing profile' END);
  IF NOT ok THEN blockers := blockers || 'identity_proofing'; END IF;

  -- vendor / BAA inventory
  ok := NOT EXISTS (SELECT 1 FROM public.vendor_agreements v
                    WHERE v.hospital_id = p_hospital_id AND v.phi_access
                      AND (v.baa_status <> 'executed' OR (v.expires_at IS NOT NULL AND v.expires_at < current_date)));
  gates := gates || jsonb_build_object('key','vendor_baa','type','external',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'A PHI vendor has no current executed agreement' END);
  IF NOT ok THEN blockers := blockers || 'vendor_baa'; END IF;

  -- credentialing currency
  ok := NOT EXISTS (SELECT 1 FROM public.staff_credentials s
                    WHERE s.hospital_id = p_hospital_id AND s.status <> 'not_applicable'
                      AND s.expiration_date IS NOT NULL AND s.expiration_date < current_date);
  gates := gates || jsonb_build_object('key','credentialing','type','internal',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Expired staff credential on file' END);
  IF NOT ok THEN blockers := blockers || 'credentialing'; END IF;

  -- operations: continuity exercise and open critical incidents
  ok := EXISTS (SELECT 1 FROM public.continuity_exercises e
                WHERE e.hospital_id = p_hospital_id AND e.result = 'passed'
                  AND e.performed_at > now() - interval '365 days')
        AND NOT EXISTS (SELECT 1 FROM public.incident_reports r
                        WHERE r.hospital_id = p_hospital_id AND r.severity = 'critical' AND r.status <> 'closed');
  gates := gates || jsonb_build_object('key','operations','type','internal',
    'status', CASE WHEN ok THEN 'verified' ELSE 'unverified' END,
    'blocker', CASE WHEN ok THEN NULL ELSE 'Continuity exercise overdue or an open critical incident' END);
  IF NOT ok THEN blockers := blockers || 'operations'; END IF;

  -- explicit external gates recorded by compliance
  FOR g IN SELECT * FROM public.launch_readiness_gates lg
            WHERE lg.hospital_id = p_hospital_id AND lg.state_code = p_state_code
              AND (lg.service_line_id IS NULL OR lg.service_line_id = p_service_line_id) LOOP
    gates := gates || jsonb_build_object('key', g.gate_key, 'type', g.gate_type,
      'status', g.status, 'blocker', g.blocker);
    IF g.status <> 'verified' THEN blockers := blockers || g.gate_key; END IF;
  END LOOP;

  RETURN jsonb_build_object(
    'authorized', true, 'state_code', p_state_code, 'service_line_id', p_service_line_id,
    'gates', gates, 'blockers', to_jsonb(blockers),
    'can_launch', array_length(blockers, 1) IS NULL, 'note', FUNCTION_NOTE);
END $$;

-- production availability is fail-closed on readiness
CREATE OR REPLACE FUNCTION public.gate_state_service_availability()
RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public' AS $$
DECLARE r jsonb;
BEGIN
  IF auth.uid() IS NULL THEN RETURN NEW; END IF;
  IF NEW.status = 'available' AND (TG_OP = 'INSERT' OR OLD.status IS DISTINCT FROM 'available') THEN
    r := public.launch_readiness(NEW.hospital_id, NEW.service_line_id, NEW.state_code);
    IF NOT COALESCE((r->>'can_launch')::boolean, false) THEN
      RAISE EXCEPTION 'launch gates are not verified for this state and service: %', r->>'blockers';
    END IF;
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER gate_state_service_availability BEFORE INSERT OR UPDATE ON public.state_service_availability
  FOR EACH ROW EXECUTE FUNCTION public.gate_state_service_availability();