-- Change resource_id from UUID to TEXT to support non-UUID identifiers (like demo data IDs)
ALTER TABLE public.audit_logs 
ALTER COLUMN resource_id TYPE text USING resource_id::text;

-- Update the log_audit_event function to accept text for resource_id
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type audit_action_type,
  p_resource_type text,
  p_resource_id text DEFAULT NULL,
  p_patient_id uuid DEFAULT NULL,
  p_hospital_id uuid DEFAULT NULL,
  p_metadata jsonb DEFAULT '{}'::jsonb,
  p_ip_address inet DEFAULT NULL,
  p_user_agent text DEFAULT NULL,
  p_session_id text DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id uuid;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    action_type,
    resource_type,
    resource_id,
    patient_id,
    hospital_id,
    metadata,
    ip_address,
    user_agent,
    session_id
  ) VALUES (
    auth.uid(),
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_patient_id,
    p_hospital_id,
    p_metadata,
    p_ip_address,
    p_user_agent,
    p_session_id
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;