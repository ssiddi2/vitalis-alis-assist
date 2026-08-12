CREATE TYPE public.vendor_integration_state AS ENUM (
  'not_contracted','baa_pending','sandbox_pending','sandbox_configured',
  'certification_testing','production_review','production_verified','suspended'
);

CREATE TABLE public.vendor_onboarding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  vendor_key text NOT NULL CHECK (vendor_key IN ('dosespot','stedi','health_gorilla','docupdate')),
  environment text NOT NULL CHECK (environment IN ('sandbox','production')),
  state public.vendor_integration_state NOT NULL DEFAULT 'not_contracted',
  owner_name text,
  owner_email text,
  blocker text,
  next_action text,
  secret_ref_names text[] NOT NULL DEFAULT '{}',
  checklist jsonb NOT NULL DEFAULT '{}'::jsonb,
  capabilities jsonb NOT NULL DEFAULT '{}'::jsonb,
  contract_evidence_hash text,
  credential_evidence_hash text,
  certification_evidence_hash text,
  approval_evidence_hash text,
  approved_by uuid REFERENCES auth.users(id),
  evidence_expires_at timestamptz,
  last_test_at timestamptz,
  last_test_result text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (hospital_id, vendor_key, environment)
);

CREATE TABLE public.vendor_onboarding_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  onboarding_id uuid NOT NULL REFERENCES public.vendor_onboarding(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  from_state public.vendor_integration_state,
  to_state public.vendor_integration_state,
  detail jsonb NOT NULL DEFAULT '{}'::jsonb,
  actor_id uuid REFERENCES auth.users(id),
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.vendor_callback_quarantine (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id uuid REFERENCES public.hospitals(id) ON DELETE CASCADE,
  vendor_key text NOT NULL,
  environment text,
  event_type text,
  correlation_id text,
  vendor_reference text,
  payload_hash text NOT NULL,
  quarantine_reason text NOT NULL,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (vendor_key, payload_hash)
);

GRANT SELECT ON public.vendor_onboarding TO authenticated;
GRANT INSERT, UPDATE ON public.vendor_onboarding TO authenticated;
GRANT ALL ON public.vendor_onboarding TO service_role;
GRANT SELECT ON public.vendor_onboarding_events TO authenticated;
GRANT ALL ON public.vendor_onboarding_events TO service_role;
GRANT SELECT ON public.vendor_callback_quarantine TO authenticated;
GRANT ALL ON public.vendor_callback_quarantine TO service_role;

ALTER TABLE public.vendor_onboarding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_onboarding_events ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.vendor_callback_quarantine ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members view vendor onboarding"
ON public.vendor_onboarding FOR SELECT TO authenticated
USING (public.is_my_hospital(hospital_id));

CREATE POLICY "Admins create vendor onboarding"
ON public.vendor_onboarding FOR INSERT TO authenticated
WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins update vendor onboarding"
ON public.vendor_onboarding FOR UPDATE TO authenticated
USING (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'))
WITH CHECK (public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Members view vendor onboarding events"
ON public.vendor_onboarding_events FOR SELECT TO authenticated
USING (public.is_my_hospital(hospital_id));

CREATE POLICY "Admins view vendor quarantine"
ON public.vendor_callback_quarantine FOR SELECT TO authenticated
USING (hospital_id IS NOT NULL AND public.is_my_hospital(hospital_id) AND public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER vendor_onboarding_events_immutable
BEFORE UPDATE OR DELETE ON public.vendor_onboarding_events
FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TRIGGER vendor_quarantine_immutable
BEFORE DELETE ON public.vendor_callback_quarantine
FOR EACH ROW EXECUTE FUNCTION public.deny_mutation();

CREATE TRIGGER vendor_onboarding_updated_at
BEFORE UPDATE ON public.vendor_onboarding
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE OR REPLACE FUNCTION public.enforce_vendor_onboarding()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  -- Secret VALUES may never be stored: only reference names.
  IF EXISTS (
    SELECT 1 FROM unnest(NEW.secret_ref_names) n
    WHERE n !~ '^[A-Z][A-Z0-9_]{2,80}$'
  ) THEN
    RAISE EXCEPTION 'secret_ref_names must contain uppercase reference names only, never secret values';
  END IF;

  -- Production verification requires complete, unexpired, independently approved evidence.
  IF NEW.state = 'production_verified' THEN
    IF NEW.environment <> 'production' THEN
      RAISE EXCEPTION 'only a production profile can be production_verified';
    END IF;
    IF coalesce(NEW.contract_evidence_hash,'') = ''
       OR coalesce(NEW.credential_evidence_hash,'') = ''
       OR coalesce(NEW.certification_evidence_hash,'') = ''
       OR coalesce(NEW.approval_evidence_hash,'') = '' THEN
      RAISE EXCEPTION 'production_verified requires contract, credential, certification and approval evidence';
    END IF;
    IF NEW.last_test_result <> 'passed' THEN
      RAISE EXCEPTION 'production_verified requires a passed end-to-end test';
    END IF;
    IF NEW.evidence_expires_at IS NULL OR NEW.evidence_expires_at <= now() THEN
      RAISE EXCEPTION 'production_verified requires unexpired evidence';
    END IF;
    IF NEW.approved_by IS NULL OR NEW.approved_by = auth.uid() THEN
      RAISE EXCEPTION 'production_verified requires independent approval; self-approval is denied';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER enforce_vendor_onboarding_trg
BEFORE INSERT OR UPDATE ON public.vendor_onboarding
FOR EACH ROW EXECUTE FUNCTION public.enforce_vendor_onboarding();

CREATE OR REPLACE FUNCTION public.log_vendor_onboarding_event()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' OR NEW.state IS DISTINCT FROM OLD.state THEN
    INSERT INTO public.vendor_onboarding_events (onboarding_id, hospital_id, event_type, from_state, to_state, actor_id, detail)
    VALUES (NEW.id, NEW.hospital_id, CASE WHEN TG_OP = 'INSERT' THEN 'created' ELSE 'state_change' END,
            CASE WHEN TG_OP = 'INSERT' THEN NULL ELSE OLD.state END, NEW.state, auth.uid(),
            jsonb_build_object('vendor_key', NEW.vendor_key, 'environment', NEW.environment));
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER log_vendor_onboarding_event_trg
AFTER INSERT OR UPDATE ON public.vendor_onboarding
FOR EACH ROW EXECUTE FUNCTION public.log_vendor_onboarding_event();

CREATE INDEX idx_vendor_onboarding_hospital ON public.vendor_onboarding(hospital_id, vendor_key);
CREATE INDEX idx_vendor_onboarding_events_hospital ON public.vendor_onboarding_events(hospital_id, created_at DESC);
CREATE INDEX idx_vendor_quarantine_vendor ON public.vendor_callback_quarantine(vendor_key, created_at DESC);