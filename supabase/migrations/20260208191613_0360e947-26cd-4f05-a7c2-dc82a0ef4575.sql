-- Drop the UUID version of log_audit_event to resolve ambiguity
-- Keep the TEXT version for EMR interoperability with non-UUID identifiers
DROP FUNCTION IF EXISTS public.log_audit_event(
  p_action_type public.audit_action_type,
  p_resource_type text,
  p_resource_id uuid,
  p_patient_id uuid,
  p_hospital_id uuid,
  p_metadata jsonb,
  p_ip_address inet,
  p_user_agent text,
  p_session_id text
);