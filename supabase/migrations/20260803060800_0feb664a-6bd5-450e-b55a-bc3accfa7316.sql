
REVOKE ALL ON FUNCTION public.log_audit_event(public.audit_action_type, text, text, uuid, uuid, jsonb, inet, text, text) FROM authenticated;

CREATE OR REPLACE FUNCTION public.get_user_role(_user_id uuid)
RETURNS app_role
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
  SELECT role FROM public.user_roles
  WHERE user_id = _user_id
    AND (_user_id = auth.uid() OR public.has_role(auth.uid(), 'admin'))
  ORDER BY
    CASE role
      WHEN 'admin' THEN 1
      WHEN 'clinician' THEN 2
      WHEN 'viewer' THEN 3
    END
  LIMIT 1
$function$;
