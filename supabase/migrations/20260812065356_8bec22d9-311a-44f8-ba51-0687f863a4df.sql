-- ============================================================
-- National virtual-care intake & service routing
-- ============================================================

CREATE TYPE public.service_availability_status AS ENUM ('available', 'waitlist', 'unavailable');
CREATE TYPE public.care_request_status AS ENUM ('draft', 'submitted', 'waitlisted', 'triaged', 'scheduled', 'declined', 'cancelled');
CREATE TYPE public.payer_preference AS ENUM ('insurance', 'self_pay', 'unknown');
CREATE TYPE public.visit_modality AS ENUM ('video', 'phone', 'async', 'in_person');

-- ---------- service catalog ----------
CREATE TABLE public.service_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  code text NOT NULL,
  name text NOT NULL,
  patient_description text NOT NULL,
  active boolean NOT NULL DEFAULT true,
  visible_to_patients boolean NOT NULL DEFAULT true,
  allows_new_patients boolean NOT NULL DEFAULT true,
  allows_established_patients boolean NOT NULL DEFAULT true,
  min_age integer NOT NULL DEFAULT 18,
  modality public.visit_modality NOT NULL DEFAULT 'video',
  response_window text NOT NULL DEFAULT 'Within 1 business day',
  requires_referral boolean NOT NULL DEFAULT false,
  requires_records boolean NOT NULL DEFAULT false,
  sort_order integer NOT NULL DEFAULT 0,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_lines TO authenticated;
GRANT ALL ON public.service_lines TO service_role;
ALTER TABLE public.service_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view service lines" ON public.service_lines
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
               WHERE hu.hospital_id = service_lines.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Admins insert service lines" ON public.service_lines
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = service_lines.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Admins update service lines" ON public.service_lines
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = service_lines.hospital_id AND hu.user_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = service_lines.hospital_id AND hu.user_id = auth.uid()));

CREATE TRIGGER update_service_lines_updated_at BEFORE UPDATE ON public.service_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- state coverage ----------
CREATE TABLE public.state_service_availability (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  service_line_id uuid NOT NULL REFERENCES public.service_lines(id) ON DELETE CASCADE,
  state_code text NOT NULL CHECK (state_code ~ '^[A-Z]{2}$'),
  status public.service_availability_status NOT NULL DEFAULT 'unavailable',
  launch_date date,
  modality public.visit_modality,
  min_age integer,
  max_age integer,
  reason text CHECK (reason IS NULL OR length(reason) <= 300),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, service_line_id, state_code)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.state_service_availability TO authenticated;
GRANT ALL ON public.state_service_availability TO service_role;
ALTER TABLE public.state_service_availability ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view state coverage" ON public.state_service_availability
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
               WHERE hu.hospital_id = state_service_availability.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Admins insert state coverage" ON public.state_service_availability
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = state_service_availability.hospital_id AND hu.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.service_lines sl
              WHERE sl.id = state_service_availability.service_line_id
                AND sl.hospital_id = state_service_availability.hospital_id));

CREATE POLICY "Admins update state coverage" ON public.state_service_availability
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = state_service_availability.hospital_id AND hu.user_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = state_service_availability.hospital_id AND hu.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.service_lines sl
              WHERE sl.id = state_service_availability.service_line_id
                AND sl.hospital_id = state_service_availability.hospital_id));

CREATE TRIGGER update_state_service_availability_updated_at BEFORE UPDATE ON public.state_service_availability
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- provider ↔ service assignments ----------
CREATE TABLE public.provider_service_lines (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  provider_user_id uuid NOT NULL,
  service_line_id uuid NOT NULL REFERENCES public.service_lines(id) ON DELETE CASCADE,
  active boolean NOT NULL DEFAULT true,
  effective_date date NOT NULL DEFAULT current_date,
  end_date date,
  daily_capacity integer NOT NULL DEFAULT 12,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, provider_user_id, service_line_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.provider_service_lines TO authenticated;
GRANT ALL ON public.provider_service_lines TO service_role;
ALTER TABLE public.provider_service_lines ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view provider services" ON public.provider_service_lines
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
               WHERE hu.hospital_id = provider_service_lines.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Admins insert provider services" ON public.provider_service_lines
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = provider_service_lines.hospital_id AND hu.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.hospital_users hp
              WHERE hp.hospital_id = provider_service_lines.hospital_id
                AND hp.user_id = provider_service_lines.provider_user_id)
  AND EXISTS (SELECT 1 FROM public.service_lines sl
              WHERE sl.id = provider_service_lines.service_line_id
                AND sl.hospital_id = provider_service_lines.hospital_id));

CREATE POLICY "Admins update provider services" ON public.provider_service_lines
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = provider_service_lines.hospital_id AND hu.user_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = provider_service_lines.hospital_id AND hu.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.hospital_users hp
              WHERE hp.hospital_id = provider_service_lines.hospital_id
                AND hp.user_id = provider_service_lines.provider_user_id)
  AND EXISTS (SELECT 1 FROM public.service_lines sl
              WHERE sl.id = provider_service_lines.service_line_id
                AND sl.hospital_id = provider_service_lines.hospital_id));

CREATE TRIGGER update_provider_service_lines_updated_at BEFORE UPDATE ON public.provider_service_lines
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- versioned safety screen templates ----------
CREATE TABLE public.safety_screen_templates (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  service_line_id uuid REFERENCES public.service_lines(id) ON DELETE CASCADE,
  version integer NOT NULL,
  questions jsonb NOT NULL DEFAULT '[]'::jsonb,
  disclaimer text NOT NULL DEFAULT 'This screen is not a diagnosis. If this is an emergency, call 911 or your local emergency number.',
  approval_required boolean NOT NULL DEFAULT true,
  approved_by uuid,
  approved_at timestamptz,
  active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX safety_screen_templates_scope_version
  ON public.safety_screen_templates (hospital_id, COALESCE(service_line_id, '00000000-0000-0000-0000-000000000000'::uuid), version);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.safety_screen_templates TO authenticated;
GRANT ALL ON public.safety_screen_templates TO service_role;
ALTER TABLE public.safety_screen_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view safety screens" ON public.safety_screen_templates
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
               WHERE hu.hospital_id = safety_screen_templates.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Admins insert safety screens" ON public.safety_screen_templates
FOR INSERT TO authenticated
WITH CHECK (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = safety_screen_templates.hospital_id AND hu.user_id = auth.uid())
  AND (service_line_id IS NULL OR EXISTS (
        SELECT 1 FROM public.service_lines sl
        WHERE sl.id = safety_screen_templates.service_line_id
          AND sl.hospital_id = safety_screen_templates.hospital_id)));

CREATE POLICY "Admins update safety screens" ON public.safety_screen_templates
FOR UPDATE TO authenticated
USING (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = safety_screen_templates.hospital_id AND hu.user_id = auth.uid()))
WITH CHECK (public.has_role(auth.uid(), 'admin')
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = safety_screen_templates.hospital_id AND hu.user_id = auth.uid())
  AND (service_line_id IS NULL OR EXISTS (
        SELECT 1 FROM public.service_lines sl
        WHERE sl.id = safety_screen_templates.service_line_id
          AND sl.hospital_id = safety_screen_templates.hospital_id)));

CREATE TRIGGER update_safety_screen_templates_updated_at BEFORE UPDATE ON public.safety_screen_templates
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- a template only becomes usable once a medical director approves it
CREATE OR REPLACE FUNCTION public.enforce_safety_screen_approval()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF NEW.active AND NEW.approval_required AND (NEW.approved_by IS NULL OR NEW.approved_at IS NULL) THEN
    RAISE EXCEPTION 'safety screen templates require medical-director approval before activation';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id OR NEW.version IS DISTINCT FROM OLD.version THEN
      RAISE EXCEPTION 'safety screen hospital and version are immutable; publish a new version';
    END IF;
    IF OLD.approved_at IS NOT NULL AND NEW.questions IS DISTINCT FROM OLD.questions THEN
      RAISE EXCEPTION 'approved safety screens are immutable; publish a new version';
    END IF;
  END IF;
  IF NEW.approved_at IS NOT NULL AND NEW.approved_by IS DISTINCT FROM COALESCE(auth.uid(), NEW.approved_by) THEN
    RAISE EXCEPTION 'safety screen approval must be attributed to the approving user';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_safety_screen_approval BEFORE INSERT OR UPDATE ON public.safety_screen_templates
FOR EACH ROW EXECUTE FUNCTION public.enforce_safety_screen_approval();

-- ---------- care requests ----------
CREATE TABLE public.care_requests (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  service_line_id uuid NOT NULL REFERENCES public.service_lines(id),
  created_by uuid NOT NULL,
  status public.care_request_status NOT NULL DEFAULT 'draft',
  patient_state_code text CHECK (patient_state_code IS NULL OR patient_state_code ~ '^[A-Z]{2}$'),
  requested_urgency text NOT NULL DEFAULT 'routine' CHECK (requested_urgency IN ('routine','soon','urgent')),
  reason_text text CHECK (reason_text IS NULL OR length(reason_text) <= 2000),
  symptom_duration text CHECK (symptom_duration IS NULL OR length(symptom_duration) <= 120),
  callback_phone text CHECK (callback_phone IS NULL OR length(callback_phone) <= 32),
  callback_verified_at timestamptz,
  preferred_language text CHECK (preferred_language IS NULL OR length(preferred_language) <= 80),
  accessibility_needs text CHECK (accessibility_needs IS NULL OR length(accessibility_needs) <= 500),
  is_established_patient boolean NOT NULL DEFAULT false,
  referral_status text NOT NULL DEFAULT 'not_required' CHECK (referral_status IN ('not_required','pending','received')),
  records_status text NOT NULL DEFAULT 'not_required' CHECK (records_status IN ('not_required','pending','received')),
  payer_preference public.payer_preference NOT NULL DEFAULT 'unknown',
  consent_version text,
  consent_accepted_at timestamptz,
  safety_screen_version integer,
  safety_screen_completed_at timestamptz,
  red_flag boolean NOT NULL DEFAULT false,
  red_flag_codes text[] NOT NULL DEFAULT '{}',
  emergency_ack_at timestamptz,
  triage_disposition text CHECK (triage_disposition IS NULL OR length(triage_disposition) <= 120),
  triage_reason text CHECK (triage_reason IS NULL OR length(triage_reason) <= 500),
  triaged_by uuid,
  triaged_at timestamptz,
  assigned_provider_id uuid,
  appointment_id uuid REFERENCES public.appointments(id),
  encounter_id uuid REFERENCES public.encounters(id),
  decline_reason text CHECK (decline_reason IS NULL OR length(decline_reason) <= 500),
  lock_version integer NOT NULL DEFAULT 0,
  submitted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_requests_queue_idx ON public.care_requests (hospital_id, status, created_at DESC);
GRANT SELECT, INSERT, UPDATE ON public.care_requests TO authenticated;
GRANT ALL ON public.care_requests TO service_role;
ALTER TABLE public.care_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Requester or hospital staff view care requests" ON public.care_requests
FOR SELECT TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.hospital_id = care_requests.hospital_id AND hu.user_id = auth.uid())
  AND (created_by = auth.uid()
       OR public.has_role(auth.uid(), 'clinician')
       OR public.has_role(auth.uid(), 'admin'))
);

CREATE POLICY "Members create their own care requests" ON public.care_requests
FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
  AND status = 'draft'
  AND EXISTS (SELECT 1 FROM public.hospital_users hu
              WHERE hu.hospital_id = care_requests.hospital_id AND hu.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = care_requests.patient_id AND p.hospital_id = care_requests.hospital_id)
  AND EXISTS (SELECT 1 FROM public.service_lines sl
              WHERE sl.id = care_requests.service_line_id AND sl.hospital_id = care_requests.hospital_id)
);

CREATE POLICY "Requester or triage staff update care requests" ON public.care_requests
FOR UPDATE TO authenticated
USING (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.hospital_id = care_requests.hospital_id AND hu.user_id = auth.uid())
  AND (
    (created_by = auth.uid() AND status IN ('draft','submitted','waitlisted'))
    OR public.has_role(auth.uid(), 'clinician')
    OR public.has_role(auth.uid(), 'admin')
  )
)
WITH CHECK (
  EXISTS (SELECT 1 FROM public.hospital_users hu
          WHERE hu.hospital_id = care_requests.hospital_id AND hu.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.patients p
              WHERE p.id = care_requests.patient_id AND p.hospital_id = care_requests.hospital_id)
  AND EXISTS (SELECT 1 FROM public.service_lines sl
              WHERE sl.id = care_requests.service_line_id AND sl.hospital_id = care_requests.hospital_id)
  AND (assigned_provider_id IS NULL OR EXISTS (
        SELECT 1 FROM public.hospital_users hp
        WHERE hp.user_id = care_requests.assigned_provider_id
          AND hp.hospital_id = care_requests.hospital_id))
  AND (appointment_id IS NULL OR EXISTS (
        SELECT 1 FROM public.appointments a
        WHERE a.id = care_requests.appointment_id
          AND a.hospital_id = care_requests.hospital_id
          AND a.patient_id = care_requests.patient_id))
  AND (encounter_id IS NULL OR EXISTS (
        SELECT 1 FROM public.encounters e
        WHERE e.id = care_requests.encounter_id
          AND e.hospital_id = care_requests.hospital_id
          AND e.patient_id = care_requests.patient_id))
);

CREATE TRIGGER update_care_requests_updated_at BEFORE UPDATE ON public.care_requests
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ---------- append-only event trail ----------
CREATE TABLE public.care_request_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  care_request_id uuid NOT NULL REFERENCES public.care_requests(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL,
  patient_id uuid NOT NULL,
  actor_id uuid,
  from_status text,
  to_status text,
  event_code text NOT NULL,
  reason text CHECK (reason IS NULL OR length(reason) <= 500),
  metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX care_request_events_request_idx ON public.care_request_events (care_request_id, created_at DESC);
GRANT SELECT, INSERT ON public.care_request_events TO authenticated;
GRANT ALL ON public.care_request_events TO service_role;
ALTER TABLE public.care_request_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view care request events" ON public.care_request_events
FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu
               WHERE hu.hospital_id = care_request_events.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Members append care request events" ON public.care_request_events
FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.hospital_users hu
                    WHERE hu.hospital_id = care_request_events.hospital_id AND hu.user_id = auth.uid())
  AND EXISTS (SELECT 1 FROM public.care_requests cr
              WHERE cr.id = care_request_events.care_request_id
                AND cr.hospital_id = care_request_events.hospital_id
                AND cr.patient_id = care_request_events.patient_id));

CREATE TRIGGER care_request_events_append_only BEFORE UPDATE OR DELETE ON public.care_request_events
FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

-- ---------- routing check (aggregate only: never exposes license numbers) ----------
CREATE OR REPLACE FUNCTION public.care_routing_status(p_hospital_id uuid, p_service_line_id uuid, p_state_code text)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_avail public.state_service_availability;
  v_service public.service_lines;
  v_providers integer := 0;
  v_blocks text[] := '{}';
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.hospital_users hu
                 WHERE hu.hospital_id = p_hospital_id AND hu.user_id = auth.uid()) THEN
    RETURN jsonb_build_object('authorized', false);
  END IF;

  SELECT * INTO v_service FROM public.service_lines
   WHERE id = p_service_line_id AND hospital_id = p_hospital_id;
  IF v_service.id IS NULL OR NOT v_service.active THEN
    v_blocks := v_blocks || 'Service is not offered by this facility';
  END IF;

  SELECT * INTO v_avail FROM public.state_service_availability
   WHERE hospital_id = p_hospital_id AND service_line_id = p_service_line_id AND state_code = p_state_code;

  SELECT count(*) INTO v_providers
    FROM public.provider_service_lines psl
    JOIN public.provider_licenses l
      ON l.provider_user_id = psl.provider_user_id
     AND l.hospital_id = psl.hospital_id
   WHERE psl.hospital_id = p_hospital_id
     AND psl.service_line_id = p_service_line_id
     AND psl.active
     AND psl.effective_date <= current_date
     AND (psl.end_date IS NULL OR psl.end_date >= current_date)
     AND l.state_code = p_state_code
     AND l.status = 'active'
     AND l.telehealth_permitted
     AND l.effective_date <= current_date
     AND (l.expiration_date IS NULL OR l.expiration_date >= current_date);

  IF v_avail.id IS NULL OR v_avail.status = 'unavailable' THEN
    v_blocks := v_blocks || 'Not yet available in this state';
  END IF;
  IF v_providers = 0 THEN
    v_blocks := v_blocks || 'No state-authorized provider is currently available';
  END IF;

  RETURN jsonb_build_object(
    'authorized', true,
    'status', COALESCE(v_avail.status::text, 'unavailable'),
    'launch_date', v_avail.launch_date,
    'reason', v_avail.reason,
    'modality', COALESCE(v_avail.modality, v_service.modality),
    'response_window', v_service.response_window,
    'provider_count', v_providers,
    'can_route', (v_avail.status = 'available' AND v_providers > 0 AND COALESCE(v_service.active, false)),
    'blocks', to_jsonb(v_blocks));
END;
$$;
REVOKE ALL ON FUNCTION public.care_routing_status(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.care_routing_status(uuid, uuid, text) TO authenticated;

-- ---------- lifecycle enforcement ----------
CREATE OR REPLACE FUNCTION public.enforce_care_request_lifecycle()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_service public.service_lines;
  v_avail public.state_service_availability;
  v_age integer;
  v_allowed boolean := false;
  v_appt public.appointments;
BEGIN
  IF TG_OP = 'INSERT' THEN
    NEW.created_by := COALESCE(auth.uid(), NEW.created_by);
    NEW.status := 'draft';
    NEW.lock_version := 0;
    RETURN NEW;
  END IF;

  -- immutable identity
  IF NEW.hospital_id IS DISTINCT FROM OLD.hospital_id
     OR NEW.patient_id IS DISTINCT FROM OLD.patient_id
     OR NEW.created_by IS DISTINCT FROM OLD.created_by THEN
    RAISE EXCEPTION 'care request patient, facility and requester are immutable';
  END IF;

  IF OLD.status IN ('declined','cancelled','scheduled') AND NEW.status IS NOT DISTINCT FROM OLD.status THEN
    RAISE EXCEPTION 'closed care requests are immutable';
  END IF;

  -- intake content is frozen once the request leaves draft
  IF OLD.status <> 'draft' THEN
    IF NEW.service_line_id IS DISTINCT FROM OLD.service_line_id
       OR NEW.patient_state_code IS DISTINCT FROM OLD.patient_state_code
       OR NEW.reason_text IS DISTINCT FROM OLD.reason_text
       OR NEW.symptom_duration IS DISTINCT FROM OLD.symptom_duration
       OR NEW.requested_urgency IS DISTINCT FROM OLD.requested_urgency
       OR NEW.consent_version IS DISTINCT FROM OLD.consent_version
       OR NEW.consent_accepted_at IS DISTINCT FROM OLD.consent_accepted_at
       OR NEW.safety_screen_version IS DISTINCT FROM OLD.safety_screen_version
       OR NEW.safety_screen_completed_at IS DISTINCT FROM OLD.safety_screen_completed_at
       OR NEW.red_flag IS DISTINCT FROM OLD.red_flag
       OR NEW.red_flag_codes IS DISTINCT FROM OLD.red_flag_codes THEN
      RAISE EXCEPTION 'submitted care request intake is immutable';
    END IF;
  END IF;

  -- triage attribution is stamped, never supplied
  IF NEW.triaged_at IS DISTINCT FROM OLD.triaged_at OR NEW.triage_disposition IS DISTINCT FROM OLD.triage_disposition THEN
    NEW.triaged_by := COALESCE(auth.uid(), OLD.triaged_by);
    NEW.triaged_at := COALESCE(OLD.triaged_at, now());
  ELSIF NEW.triaged_by IS DISTINCT FROM OLD.triaged_by THEN
    RAISE EXCEPTION 'triage attribution is immutable';
  END IF;

  IF NEW.status IS DISTINCT FROM OLD.status THEN
    v_allowed := (OLD.status = 'draft'       AND NEW.status IN ('submitted','cancelled'))
              OR (OLD.status = 'submitted'   AND NEW.status IN ('triaged','waitlisted','declined','cancelled'))
              OR (OLD.status = 'waitlisted'  AND NEW.status IN ('triaged','declined','cancelled'))
              OR (OLD.status = 'triaged'     AND NEW.status IN ('scheduled','declined','cancelled'));
    IF NOT v_allowed THEN
      RAISE EXCEPTION 'illegal care request transition % -> %', OLD.status, NEW.status;
    END IF;

    -- only the requester may cancel their own request; triage moves need clinical staff
    IF NEW.status IN ('triaged','waitlisted','declined','scheduled')
       AND NOT (has_role(auth.uid(), 'clinician') OR has_role(auth.uid(), 'admin')) THEN
      RAISE EXCEPTION 'only clinical staff may triage or schedule a care request';
    END IF;

    IF NEW.status = 'submitted' THEN
      IF NEW.created_by IS DISTINCT FROM auth.uid()
         AND NOT (has_role(auth.uid(), 'clinician') OR has_role(auth.uid(), 'admin')) THEN
        RAISE EXCEPTION 'only the requester may submit this care request';
      END IF;
      IF NEW.patient_state_code IS NULL THEN
        RAISE EXCEPTION 'the patient physical state is required before submitting';
      END IF;
      IF NEW.callback_phone IS NULL OR NEW.callback_verified_at IS NULL THEN
        RAISE EXCEPTION 'a verified callback number is required before submitting';
      END IF;
      IF NEW.consent_version IS NULL OR NEW.consent_accepted_at IS NULL THEN
        RAISE EXCEPTION 'consent must be acknowledged before submitting';
      END IF;
      IF coalesce(btrim(NEW.reason_text), '') = '' THEN
        RAISE EXCEPTION 'a reason for the visit is required before submitting';
      END IF;
      IF NEW.safety_screen_version IS NULL OR NEW.safety_screen_completed_at IS NULL THEN
        RAISE EXCEPTION 'the safety screen must be completed before submitting';
      END IF;
      IF NEW.red_flag THEN
        RAISE EXCEPTION 'emergency symptoms reported: routine submission is blocked, direct the patient to 911 or local emergency services';
      END IF;

      SELECT * INTO v_service FROM public.service_lines
       WHERE id = NEW.service_line_id AND hospital_id = NEW.hospital_id;
      IF v_service.id IS NULL OR NOT v_service.active OR NOT v_service.visible_to_patients THEN
        RAISE EXCEPTION 'this service is not currently offered';
      END IF;
      IF NEW.is_established_patient AND NOT v_service.allows_established_patients THEN
        RAISE EXCEPTION 'this service is not accepting established patients';
      END IF;
      IF NOT NEW.is_established_patient AND NOT v_service.allows_new_patients THEN
        RAISE EXCEPTION 'this service is not accepting new patients';
      END IF;
      IF v_service.requires_referral AND NEW.referral_status <> 'received' THEN
        RAISE EXCEPTION 'a referral is required for this service';
      END IF;
      IF v_service.requires_records AND NEW.records_status <> 'received' THEN
        RAISE EXCEPTION 'prior records are required for this service';
      END IF;

      SELECT age INTO v_age FROM public.patients WHERE id = NEW.patient_id;
      IF v_age IS NULL OR v_age < v_service.min_age THEN
        RAISE EXCEPTION 'the patient does not meet the minimum age for this service';
      END IF;

      SELECT * INTO v_avail FROM public.state_service_availability
       WHERE hospital_id = NEW.hospital_id AND service_line_id = NEW.service_line_id
         AND state_code = NEW.patient_state_code;
      IF v_avail.id IS NULL OR v_avail.status = 'unavailable' THEN
        RAISE EXCEPTION 'this service is not available in the patient state yet';
      END IF;
      IF v_avail.min_age IS NOT NULL AND v_age < v_avail.min_age THEN
        RAISE EXCEPTION 'the patient does not meet the minimum age for this state';
      END IF;
      IF v_avail.max_age IS NOT NULL AND v_age > v_avail.max_age THEN
        RAISE EXCEPTION 'the patient exceeds the maximum age for this state';
      END IF;
      IF v_avail.status = 'waitlist' THEN
        NEW.status := 'waitlisted';
      END IF;
      NEW.submitted_at := now();
    END IF;

    IF NEW.status = 'scheduled' THEN
      IF NEW.red_flag THEN
        RAISE EXCEPTION 'a red-flagged request cannot be routinely scheduled';
      END IF;
      IF NEW.assigned_provider_id IS NULL OR NEW.appointment_id IS NULL THEN
        RAISE EXCEPTION 'an assigned provider and appointment are required to schedule';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.hospital_users hu
                     WHERE hu.user_id = NEW.assigned_provider_id AND hu.hospital_id = NEW.hospital_id) THEN
        RAISE EXCEPTION 'the assigned provider is not a member of this facility';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.provider_service_lines psl
                     WHERE psl.provider_user_id = NEW.assigned_provider_id
                       AND psl.hospital_id = NEW.hospital_id
                       AND psl.service_line_id = NEW.service_line_id
                       AND psl.active
                       AND psl.effective_date <= current_date
                       AND (psl.end_date IS NULL OR psl.end_date >= current_date)) THEN
        RAISE EXCEPTION 'the assigned provider is not active for this service line';
      END IF;
      IF NOT EXISTS (SELECT 1 FROM public.provider_licenses l
                     WHERE l.provider_user_id = NEW.assigned_provider_id
                       AND l.hospital_id = NEW.hospital_id
                       AND l.state_code = NEW.patient_state_code
                       AND l.status = 'active'
                       AND l.telehealth_permitted
                       AND l.effective_date <= current_date
                       AND (l.expiration_date IS NULL OR l.expiration_date >= current_date)) THEN
        RAISE EXCEPTION 'the assigned provider is not authorized in the patient state';
      END IF;
      SELECT * INTO v_appt FROM public.appointments WHERE id = NEW.appointment_id;
      IF v_appt.id IS NULL
         OR v_appt.hospital_id IS DISTINCT FROM NEW.hospital_id
         OR v_appt.patient_id IS DISTINCT FROM NEW.patient_id
         OR v_appt.provider_id IS DISTINCT FROM NEW.assigned_provider_id THEN
        RAISE EXCEPTION 'the appointment must match this facility, patient and assigned provider';
      END IF;
    END IF;
  END IF;

  NEW.lock_version := OLD.lock_version + 1;
  RETURN NEW;
END;
$$;
CREATE TRIGGER enforce_care_request_lifecycle BEFORE INSERT OR UPDATE ON public.care_requests
FOR EACH ROW EXECUTE FUNCTION public.enforce_care_request_lifecycle();

CREATE OR REPLACE FUNCTION public.log_care_request_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    INSERT INTO public.care_request_events (care_request_id, hospital_id, patient_id, actor_id, from_status, to_status, event_code, metadata)
    VALUES (NEW.id, NEW.hospital_id, NEW.patient_id, auth.uid(), NULL, NEW.status::text, 'care_request.created',
            jsonb_build_object('service_line_id', NEW.service_line_id));
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    INSERT INTO public.care_request_events (care_request_id, hospital_id, patient_id, actor_id, from_status, to_status, event_code, metadata)
    VALUES (NEW.id, NEW.hospital_id, NEW.patient_id, auth.uid(), OLD.status::text, NEW.status::text, 'care_request.transition',
            jsonb_build_object('state_code', NEW.patient_state_code, 'red_flag', NEW.red_flag));
  ELSIF NEW.red_flag AND NOT OLD.red_flag THEN
    INSERT INTO public.care_request_events (care_request_id, hospital_id, patient_id, actor_id, from_status, to_status, event_code, metadata)
    VALUES (NEW.id, NEW.hospital_id, NEW.patient_id, auth.uid(), OLD.status::text, NEW.status::text, 'care_request.emergency_escalation',
            jsonb_build_object('screen_version', NEW.safety_screen_version, 'codes', to_jsonb(NEW.red_flag_codes)));
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER log_care_request_event AFTER INSERT OR UPDATE ON public.care_requests
FOR EACH ROW EXECUTE FUNCTION public.log_care_request_event();