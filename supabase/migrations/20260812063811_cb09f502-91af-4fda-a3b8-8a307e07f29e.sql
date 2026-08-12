-- ============ 1. Provider state authorizations ============
CREATE TABLE public.provider_licenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  provider_user_id uuid NOT NULL,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  state_code text NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  license_number text NOT NULL,
  status text NOT NULL DEFAULT 'active' CHECK (status IN ('active','suspended','expired','revoked')),
  effective_date date NOT NULL DEFAULT current_date,
  expiration_date date,
  telehealth_permitted boolean NOT NULL DEFAULT true,
  verification_source text,
  verified_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (provider_user_id, hospital_id, state_code, license_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_licenses TO authenticated;
GRANT ALL ON public.provider_licenses TO service_role;
ALTER TABLE public.provider_licenses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view licenses at their hospital"
ON public.provider_licenses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
  WHERE hu.user_id = auth.uid() AND hu.hospital_id = provider_licenses.hospital_id));

CREATE POLICY "Admins insert licenses at their hospital"
ON public.provider_licenses FOR INSERT TO authenticated
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
  SELECT 1 FROM public.hospital_users hu
  WHERE hu.user_id = auth.uid() AND hu.hospital_id = provider_licenses.hospital_id));

CREATE POLICY "Admins update licenses at their hospital"
ON public.provider_licenses FOR UPDATE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
  SELECT 1 FROM public.hospital_users hu
  WHERE hu.user_id = auth.uid() AND hu.hospital_id = provider_licenses.hospital_id))
WITH CHECK (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
  SELECT 1 FROM public.hospital_users hu
  WHERE hu.user_id = auth.uid() AND hu.hospital_id = provider_licenses.hospital_id));

CREATE POLICY "Admins delete licenses at their hospital"
ON public.provider_licenses FOR DELETE TO authenticated
USING (has_role(auth.uid(), 'admin'::app_role) AND EXISTS (
  SELECT 1 FROM public.hospital_users hu
  WHERE hu.user_id = auth.uid() AND hu.hospital_id = provider_licenses.hospital_id));

CREATE TRIGGER update_provider_licenses_updated_at
BEFORE UPDATE ON public.provider_licenses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_provider_licenses_lookup
ON public.provider_licenses (provider_user_id, hospital_id, state_code, status);

-- ============ 2. Encounter safety columns ============
ALTER TABLE public.encounters
  ADD COLUMN lock_version integer NOT NULL DEFAULT 1,
  ADD COLUMN completed_at timestamptz,
  ADD COLUMN completed_by uuid,
  ADD COLUMN patient_state_code text CHECK (patient_state_code IS NULL OR patient_state_code ~ '^[A-Z]{2}$'),
  ADD COLUMN patient_country text DEFAULT 'US',
  ADD COLUMN patient_address_text text,
  ADD COLUMN identity_verified_at timestamptz,
  ADD COLUMN identity_verification_method text,
  ADD COLUMN identity_verified_by uuid,
  ADD COLUMN consent_version text,
  ADD COLUMN consent_method text,
  ADD COLUMN consent_accepted_at timestamptz,
  ADD COLUMN consent_recorded_by uuid,
  ADD COLUMN callback_phone text,
  ADD COLUMN callback_verified_at timestamptz,
  ADD COLUMN provider_authorization_id uuid REFERENCES public.provider_licenses(id),
  ADD COLUMN provider_authorization_snapshot jsonb,
  ADD COLUMN disposition text,
  ADD COLUMN follow_up_instructions text,
  ADD COLUMN med_rec_completed_at timestamptz,
  ADD COLUMN med_rec_by uuid,
  ADD COLUMN allergy_review_at timestamptz,
  ADD COLUMN allergy_review_by uuid;

-- ============ 3. Encounter diagnoses ============
CREATE TABLE public.encounter_diagnoses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  icd10_code text NOT NULL,
  description text NOT NULL,
  rank integer NOT NULL DEFAULT 1,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (encounter_id, icd10_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.encounter_diagnoses TO authenticated;
GRANT ALL ON public.encounter_diagnoses TO service_role;
ALTER TABLE public.encounter_diagnoses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view encounter diagnoses"
ON public.encounter_diagnoses FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
  WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounter_diagnoses.hospital_id));

CREATE POLICY "Clinicians add diagnoses to open encounters"
ON public.encounter_diagnoses FOR INSERT TO authenticated
WITH CHECK (
  (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND created_by = auth.uid()
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounter_diagnoses.hospital_id)
  AND EXISTS (SELECT 1 FROM public.encounters e
    WHERE e.id = encounter_diagnoses.encounter_id
      AND e.hospital_id = encounter_diagnoses.hospital_id
      AND e.patient_id = encounter_diagnoses.patient_id
      AND e.status NOT IN ('completed','cancelled','no_show'))
);

CREATE POLICY "Clinicians edit diagnoses on open encounters"
ON public.encounter_diagnoses FOR UPDATE TO authenticated
USING (
  (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounter_diagnoses.hospital_id)
  AND EXISTS (SELECT 1 FROM public.encounters e
    WHERE e.id = encounter_diagnoses.encounter_id AND e.status NOT IN ('completed','cancelled','no_show'))
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounter_diagnoses.hospital_id)
  AND EXISTS (SELECT 1 FROM public.encounters e
    WHERE e.id = encounter_diagnoses.encounter_id
      AND e.hospital_id = encounter_diagnoses.hospital_id
      AND e.patient_id = encounter_diagnoses.patient_id
      AND e.status NOT IN ('completed','cancelled','no_show'))
);

CREATE POLICY "Clinicians remove diagnoses from open encounters"
ON public.encounter_diagnoses FOR DELETE TO authenticated
USING (
  (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role))
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounter_diagnoses.hospital_id)
  AND EXISTS (SELECT 1 FROM public.encounters e
    WHERE e.id = encounter_diagnoses.encounter_id AND e.status NOT IN ('completed','cancelled','no_show'))
);

CREATE TRIGGER update_encounter_diagnoses_updated_at
BEFORE UPDATE ON public.encounter_diagnoses
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============ 4. Append-only encounter events ============
CREATE TABLE public.encounter_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id uuid NOT NULL REFERENCES public.encounters(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL,
  hospital_id uuid NOT NULL,
  actor_id uuid,
  from_status text,
  to_status text,
  event_code text NOT NULL,
  reason text,
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT ON public.encounter_events TO authenticated;
GRANT ALL ON public.encounter_events TO service_role;
ALTER TABLE public.encounter_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view encounter events"
ON public.encounter_events FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
  WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounter_events.hospital_id));

CREATE POLICY "Members append encounter events"
ON public.encounter_events FOR INSERT TO authenticated
WITH CHECK (
  actor_id = auth.uid()
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounter_events.hospital_id)
  AND EXISTS (SELECT 1 FROM public.encounters e
    WHERE e.id = encounter_events.encounter_id
      AND e.hospital_id = encounter_events.hospital_id
      AND e.patient_id = encounter_events.patient_id)
);

CREATE TRIGGER encounter_events_append_only
BEFORE UPDATE OR DELETE ON public.encounter_events
FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE INDEX idx_encounter_events_encounter ON public.encounter_events (encounter_id, created_at);

-- ============ 5. Lifecycle enforcement (SECURITY INVOKER) ============
CREATE OR REPLACE FUNCTION public.enforce_encounter_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_allowed boolean := false;
  v_lic public.provider_licenses%ROWTYPE;
  v_reopen boolean := coalesce(current_setting('app.encounter_reopen', true) = '1', false);
  v_note_count integer;
  v_dx_count integer;
BEGIN
  -- immutability of ownership fields on every update
  IF NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.provider_id IS DISTINCT FROM OLD.provider_id THEN
    RAISE EXCEPTION 'encounter patient, hospital and provider are immutable';
  END IF;

  IF OLD.status = 'completed' AND NOT v_reopen THEN
    RAISE EXCEPTION 'completed encounters are immutable; document via note addenda';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF v_reopen THEN
      v_allowed := OLD.status = 'completed' AND NEW.status = 'in_progress';
    ELSE
      v_allowed := (OLD.status = 'scheduled'  AND NEW.status IN ('checked_in','cancelled','no_show'))
                OR (OLD.status = 'checked_in' AND NEW.status IN ('in_progress','cancelled'))
                OR (OLD.status = 'in_progress' AND NEW.status IN ('completed','cancelled'));
    END IF;
    IF NOT v_allowed THEN
      RAISE EXCEPTION 'illegal encounter transition % -> %', OLD.status, NEW.status;
    END IF;

    -- start of care
    IF NEW.status = 'in_progress' AND NOT v_reopen THEN
      IF NEW.provider_id IS DISTINCT FROM auth.uid() THEN
        RAISE EXCEPTION 'only the assigned provider may start this encounter';
      END IF;
      IF NEW.encounter_type = 'telehealth' THEN
        IF NEW.identity_verified_at IS NULL OR NEW.identity_verification_method IS NULL THEN
          RAISE EXCEPTION 'patient identity must be verified before starting telehealth';
        END IF;
        IF NEW.patient_state_code IS NULL THEN
          RAISE EXCEPTION 'patient physical state is required for telehealth';
        END IF;
        IF NEW.callback_phone IS NULL OR NEW.callback_verified_at IS NULL THEN
          RAISE EXCEPTION 'a verified emergency callback number is required';
        END IF;
        IF NEW.consent_accepted_at IS NULL OR NEW.consent_version IS NULL OR NEW.consent_method IS NULL THEN
          RAISE EXCEPTION 'telehealth consent must be accepted before starting';
        END IF;
        SELECT * INTO v_lic FROM public.provider_licenses l
          WHERE l.provider_user_id = NEW.provider_id
            AND l.hospital_id = NEW.hospital_id
            AND l.state_code = NEW.patient_state_code
            AND l.status = 'active'
            AND l.telehealth_permitted
            AND l.effective_date <= current_date
            AND (l.expiration_date IS NULL OR l.expiration_date >= current_date)
          ORDER BY l.expiration_date NULLS FIRST LIMIT 1;
        IF v_lic.id IS NULL THEN
          RAISE EXCEPTION 'no active telehealth authorization for state %', NEW.patient_state_code;
        END IF;
        NEW.provider_authorization_id := v_lic.id;
        NEW.provider_authorization_snapshot := jsonb_build_object(
          'state_code', v_lic.state_code, 'status', v_lic.status,
          'expiration_date', v_lic.expiration_date, 'telehealth_permitted', v_lic.telehealth_permitted,
          'verification_source', v_lic.verification_source, 'captured_at', now());
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.patients p
        WHERE p.id = NEW.patient_id AND p.hospital_id = NEW.hospital_id) THEN
        RAISE EXCEPTION 'patient does not belong to this hospital';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.hospital_users hu
        WHERE hu.user_id = NEW.provider_id AND hu.hospital_id = NEW.hospital_id) THEN
        RAISE EXCEPTION 'provider is not a member of this hospital';
      END IF;
    END IF;

    -- completion
    IF NEW.status = 'completed' THEN
      SELECT count(*) INTO v_note_count
        FROM public.clinical_notes n JOIN public.note_versions nv ON nv.note_id = n.id
        WHERE n.encounter_id = NEW.id AND n.status IN ('signed','amended')
          AND n.signed_by = NEW.provider_id AND n.content_hash IS NOT NULL;
      IF v_note_count = 0 THEN
        RAISE EXCEPTION 'a signed clinical note by the treating provider is required to complete';
      END IF;
      SELECT count(*) INTO v_dx_count FROM public.encounter_diagnoses d WHERE d.encounter_id = NEW.id;
      IF v_dx_count = 0 THEN
        RAISE EXCEPTION 'at least one encounter diagnosis is required to complete';
      END IF;
      IF coalesce(btrim(NEW.disposition), '') = '' OR coalesce(btrim(NEW.follow_up_instructions), '') = '' THEN
        RAISE EXCEPTION 'disposition and follow-up instructions are required to complete';
      END IF;
      IF NEW.med_rec_completed_at IS NULL OR NEW.med_rec_by IS NULL
         OR NEW.allergy_review_at IS NULL OR NEW.allergy_review_by IS NULL THEN
        RAISE EXCEPTION 'medication reconciliation and allergy review are required to complete';
      END IF;
      NEW.completed_at := now();
      NEW.completed_by := auth.uid();
      NEW.check_out_at := coalesce(NEW.check_out_at, now());
    END IF;
  END IF;

  NEW.lock_version := OLD.lock_version + 1;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS enforce_encounter_lifecycle ON public.encounters;
CREATE TRIGGER enforce_encounter_lifecycle
BEFORE UPDATE ON public.encounters
FOR EACH ROW EXECUTE FUNCTION public.enforce_encounter_lifecycle();

-- lifecycle events are written by the database, not the client
CREATE OR REPLACE FUNCTION public.log_encounter_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.encounter_events (encounter_id, patient_id, hospital_id, actor_id, from_status, to_status, event_code)
    VALUES (NEW.id, NEW.patient_id, NEW.hospital_id, auth.uid(), NULL, NEW.status::text, 'encounter.created');
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.encounter_events (encounter_id, patient_id, hospital_id, actor_id, from_status, to_status, event_code, reason)
    VALUES (NEW.id, NEW.patient_id, NEW.hospital_id, auth.uid(), OLD.status::text, NEW.status::text,
            'encounter.transition', nullif(current_setting('app.encounter_reason', true), ''));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS log_encounter_event ON public.encounters;
CREATE TRIGGER log_encounter_event
AFTER INSERT OR UPDATE ON public.encounters
FOR EACH ROW EXECUTE FUNCTION public.log_encounter_event();

-- ============ 6. Admin correction workflow ============
CREATE OR REPLACE FUNCTION public.reopen_encounter(p_encounter_id uuid, p_reason text)
RETURNS public.encounters
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE v_row public.encounters;
BEGIN
  IF coalesce(btrim(p_reason), '') = '' OR length(p_reason) > 500 THEN
    RAISE EXCEPTION 'a correction reason (1-500 chars, no PHI) is required';
  END IF;
  SELECT * INTO v_row FROM public.encounters WHERE id = p_encounter_id;
  IF v_row.id IS NULL THEN RAISE EXCEPTION 'encounter not found'; END IF;
  IF NOT has_role(auth.uid(), 'admin'::app_role)
     OR NOT EXISTS (SELECT 1 FROM public.hospital_users hu
       WHERE hu.user_id = auth.uid() AND hu.hospital_id = v_row.hospital_id) THEN
    RAISE EXCEPTION 'only an admin at this hospital may reopen an encounter';
  END IF;
  IF v_row.status <> 'completed' THEN RAISE EXCEPTION 'only completed encounters can be reopened'; END IF;

  PERFORM set_config('app.encounter_reopen', '1', true);
  PERFORM set_config('app.encounter_reason', p_reason, true);
  UPDATE public.encounters SET status = 'in_progress', completed_at = NULL, completed_by = NULL
    WHERE id = p_encounter_id RETURNING * INTO v_row;
  PERFORM set_config('app.encounter_reopen', '0', true);
  PERFORM set_config('app.encounter_reason', '', true);
  RETURN v_row;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.reopen_encounter(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reopen_encounter(uuid, text) TO authenticated;

-- ============ 7. Readiness introspection for the UI ============
CREATE OR REPLACE FUNCTION public.encounter_readiness(p_encounter_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  e public.encounters;
  start_blocks text[] := '{}';
  complete_blocks text[] := '{}';
  v_auth boolean;
BEGIN
  SELECT * INTO e FROM public.encounters WHERE id = p_encounter_id;
  IF e.id IS NULL THEN RETURN jsonb_build_object('found', false); END IF;

  IF e.encounter_type = 'telehealth' THEN
    IF e.identity_verified_at IS NULL THEN start_blocks := start_blocks || 'Patient identity not verified'; END IF;
    IF e.patient_state_code IS NULL THEN start_blocks := start_blocks || 'Patient physical state not recorded'; END IF;
    IF e.callback_phone IS NULL OR e.callback_verified_at IS NULL THEN start_blocks := start_blocks || 'Emergency callback not verified'; END IF;
    IF e.consent_accepted_at IS NULL THEN start_blocks := start_blocks || 'Telehealth consent not accepted'; END IF;
    SELECT EXISTS (SELECT 1 FROM public.provider_licenses l
      WHERE l.provider_user_id = e.provider_id AND l.hospital_id = e.hospital_id
        AND l.state_code = e.patient_state_code AND l.status = 'active' AND l.telehealth_permitted
        AND l.effective_date <= current_date
        AND (l.expiration_date IS NULL OR l.expiration_date >= current_date)) INTO v_auth;
    IF NOT v_auth THEN start_blocks := start_blocks || 'No active telehealth authorization for patient state'; END IF;
  END IF;
  IF e.provider_id IS DISTINCT FROM auth.uid() THEN start_blocks := start_blocks || 'You are not the assigned provider'; END IF;

  IF NOT EXISTS (SELECT 1 FROM public.clinical_notes n JOIN public.note_versions nv ON nv.note_id = n.id
    WHERE n.encounter_id = e.id AND n.status IN ('signed','amended') AND n.signed_by = e.provider_id)
    THEN complete_blocks := complete_blocks || 'No signed clinical note for this encounter'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.encounter_diagnoses d WHERE d.encounter_id = e.id)
    THEN complete_blocks := complete_blocks || 'No encounter diagnosis recorded'; END IF;
  IF coalesce(btrim(e.disposition), '') = '' THEN complete_blocks := complete_blocks || 'Disposition missing'; END IF;
  IF coalesce(btrim(e.follow_up_instructions), '') = '' THEN complete_blocks := complete_blocks || 'Follow-up instructions missing'; END IF;
  IF e.med_rec_completed_at IS NULL THEN complete_blocks := complete_blocks || 'Medication reconciliation not recorded'; END IF;
  IF e.allergy_review_at IS NULL THEN complete_blocks := complete_blocks || 'Allergy review not recorded'; END IF;

  RETURN jsonb_build_object(
    'found', true, 'status', e.status, 'lock_version', e.lock_version,
    'encounter_type', e.encounter_type,
    'can_start', array_length(start_blocks, 1) IS NULL,
    'start_blocks', to_jsonb(start_blocks),
    'can_complete', array_length(complete_blocks, 1) IS NULL,
    'complete_blocks', to_jsonb(complete_blocks));
END;
$$;
REVOKE EXECUTE ON FUNCTION public.encounter_readiness(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.encounter_readiness(uuid) TO authenticated;