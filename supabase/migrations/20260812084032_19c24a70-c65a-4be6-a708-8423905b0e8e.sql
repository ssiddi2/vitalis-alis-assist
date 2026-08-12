REVOKE ALL ON FUNCTION public.apply_access_attestation() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.has_governance_role(uuid, uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.has_governance_role(uuid, uuid, text) TO authenticated, service_role;