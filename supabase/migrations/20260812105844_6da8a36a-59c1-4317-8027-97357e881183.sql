-- Least-privilege lockdown of SECURITY DEFINER functions (part 2):
-- make the server-side escape hatch explicit and role-based rather than
-- inferring it from a missing JWT claim.
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT _user_id IS NOT NULL
    AND (_user_id = auth.uid() OR current_user NOT IN ('authenticated', 'anon'))
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
    AND (_user_id = auth.uid() OR current_user NOT IN ('authenticated', 'anon'))
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