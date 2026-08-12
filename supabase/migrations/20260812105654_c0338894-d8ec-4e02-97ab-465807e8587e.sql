-- Least-privilege lockdown of SECURITY DEFINER functions.
-- 1) Internal-only definer functions: never callable by anon/authenticated.
--    Trigger execution is unaffected (triggers run the function as the table
--    owner, independent of EXECUTE grants).
DO $$
DECLARE f record;
BEGIN
  FOR f IN
    SELECT p.oid::regprocedure AS sig
    FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
    WHERE n.nspname = 'public' AND p.prosecdef
      AND p.proname NOT IN ('has_role', 'has_governance_role')
  LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f.sig);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO service_role', f.sig);
  END LOOP;
END $$;

-- 2) has_role / has_governance_role stay executable by authenticated because
--    101 RLS policies call them, but they now only answer for the caller.
--    Cross-user probing returns false; server-side roles keep full lookup.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND (_user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = _user_id AND role = _role
    )
$$;

CREATE OR REPLACE FUNCTION public.has_governance_role(_user_id uuid, _hospital_id uuid, _role text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL AND _hospital_id IS NOT NULL
    AND (_user_id = auth.uid() OR current_setting('request.jwt.claim.role', true) IS NULL)
    AND EXISTS (
      SELECT 1 FROM public.governance_roles g
      WHERE g.user_id = _user_id AND g.hospital_id = _hospital_id
        AND g.role = _role AND g.revoked_at IS NULL
    )
$$;

REVOKE ALL ON FUNCTION public.has_role(uuid, app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.has_governance_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.has_governance_role(uuid, uuid, text) TO authenticated, service_role;