-- =====================================================
-- HIPAA-Compliant Audit Logging for PHI Access
-- =====================================================

-- 1. Create audit action type enum
CREATE TYPE public.audit_action_type AS ENUM (
  'view',
  'create',
  'update',
  'delete',
  'export',
  'sign',
  'approve',
  'login',
  'logout'
);

-- 2. Create audit_logs table
CREATE TABLE public.audit_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  action_type public.audit_action_type NOT NULL,
  resource_type TEXT NOT NULL,
  resource_id UUID,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  metadata JSONB DEFAULT '{}'::jsonb,
  ip_address INET,
  user_agent TEXT,
  session_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 3. Create indexes for query performance
CREATE INDEX idx_audit_logs_user_id ON public.audit_logs(user_id);
CREATE INDEX idx_audit_logs_patient_id ON public.audit_logs(patient_id);
CREATE INDEX idx_audit_logs_resource ON public.audit_logs(resource_type, resource_id);
CREATE INDEX idx_audit_logs_created_at ON public.audit_logs(created_at DESC);
CREATE INDEX idx_audit_logs_hospital_id ON public.audit_logs(hospital_id);
CREATE INDEX idx_audit_logs_action_type ON public.audit_logs(action_type);

-- 4. Enable RLS
ALTER TABLE public.audit_logs ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies - Admins can read, no one can update/delete (immutable)
CREATE POLICY "Admins can view audit logs"
ON public.audit_logs
FOR SELECT
USING (has_role(auth.uid(), 'admin'::app_role));

-- No UPDATE or DELETE policies - logs are immutable

-- 6. Security definer function for inserting audit logs
-- This bypasses RLS to allow authenticated users to write logs
CREATE OR REPLACE FUNCTION public.log_audit_event(
  p_action_type public.audit_action_type,
  p_resource_type TEXT,
  p_resource_id UUID DEFAULT NULL,
  p_patient_id UUID DEFAULT NULL,
  p_hospital_id UUID DEFAULT NULL,
  p_metadata JSONB DEFAULT '{}'::jsonb,
  p_ip_address INET DEFAULT NULL,
  p_user_agent TEXT DEFAULT NULL,
  p_session_id TEXT DEFAULT NULL
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_log_id UUID;
BEGIN
  INSERT INTO public.audit_logs (
    user_id,
    hospital_id,
    action_type,
    resource_type,
    resource_id,
    patient_id,
    metadata,
    ip_address,
    user_agent,
    session_id
  ) VALUES (
    auth.uid(),
    p_hospital_id,
    p_action_type,
    p_resource_type,
    p_resource_id,
    p_patient_id,
    p_metadata,
    p_ip_address,
    p_user_agent,
    p_session_id
  )
  RETURNING id INTO v_log_id;
  
  RETURN v_log_id;
END;
$$;

-- 7. Generic audit trigger function for PHI tables
CREATE OR REPLACE FUNCTION public.audit_phi_changes()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_action public.audit_action_type;
  v_resource_id UUID;
  v_patient_id UUID;
  v_hospital_id UUID;
  v_metadata JSONB;
BEGIN
  -- Determine action type
  IF TG_OP = 'INSERT' THEN
    v_action := 'create';
    v_resource_id := NEW.id;
  ELSIF TG_OP = 'UPDATE' THEN
    v_action := 'update';
    v_resource_id := NEW.id;
  ELSIF TG_OP = 'DELETE' THEN
    v_action := 'delete';
    v_resource_id := OLD.id;
  END IF;

  -- Extract patient_id if available
  IF TG_TABLE_NAME = 'patients' THEN
    v_patient_id := COALESCE(NEW.id, OLD.id);
    v_hospital_id := COALESCE(NEW.hospital_id, OLD.hospital_id);
  ELSIF TG_TABLE_NAME IN ('clinical_notes', 'staged_orders', 'billing_events') THEN
    v_patient_id := COALESCE(NEW.patient_id, OLD.patient_id);
    -- Get hospital_id from patient
    SELECT hospital_id INTO v_hospital_id FROM public.patients WHERE id = v_patient_id;
  ELSIF TG_TABLE_NAME = 'conversations' THEN
    v_patient_id := COALESCE(NEW.patient_id, OLD.patient_id);
    v_hospital_id := COALESCE(NEW.hospital_id, OLD.hospital_id);
  ELSIF TG_TABLE_NAME = 'messages' THEN
    -- Get patient_id and hospital_id from conversation
    SELECT c.patient_id, c.hospital_id INTO v_patient_id, v_hospital_id
    FROM public.conversations c
    WHERE c.id = COALESCE(NEW.conversation_id, OLD.conversation_id);
  END IF;

  -- Build metadata with relevant changes
  IF TG_OP = 'UPDATE' THEN
    v_metadata := jsonb_build_object(
      'changed_fields', (
        SELECT jsonb_object_agg(key, value)
        FROM jsonb_each(to_jsonb(NEW))
        WHERE to_jsonb(NEW) -> key IS DISTINCT FROM to_jsonb(OLD) -> key
        AND key NOT IN ('updated_at', 'created_at')
      )
    );
  ELSIF TG_OP = 'DELETE' THEN
    v_metadata := jsonb_build_object('deleted_record', to_jsonb(OLD));
  ELSE
    v_metadata := '{}'::jsonb;
  END IF;

  -- Insert audit log
  INSERT INTO public.audit_logs (
    user_id,
    hospital_id,
    action_type,
    resource_type,
    resource_id,
    patient_id,
    metadata
  ) VALUES (
    auth.uid(),
    v_hospital_id,
    v_action,
    TG_TABLE_NAME,
    v_resource_id,
    v_patient_id,
    v_metadata
  );

  RETURN COALESCE(NEW, OLD);
END;
$$;

-- 8. Create triggers for PHI tables

-- Patients trigger
CREATE TRIGGER audit_patients_changes
AFTER INSERT OR UPDATE OR DELETE ON public.patients
FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

-- Clinical notes trigger
CREATE TRIGGER audit_clinical_notes_changes
AFTER INSERT OR UPDATE OR DELETE ON public.clinical_notes
FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

-- Staged orders trigger
CREATE TRIGGER audit_staged_orders_changes
AFTER INSERT OR UPDATE OR DELETE ON public.staged_orders
FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

-- Billing events trigger
CREATE TRIGGER audit_billing_events_changes
AFTER INSERT OR UPDATE OR DELETE ON public.billing_events
FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

-- Conversations trigger (for INSERT, UPDATE, DELETE only)
CREATE TRIGGER audit_conversations_changes
AFTER INSERT OR UPDATE OR DELETE ON public.conversations
FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

-- Messages trigger (for INSERT only - messages are typically immutable)
CREATE TRIGGER audit_messages_changes
AFTER INSERT ON public.messages
FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

-- 9. Grant execute permission on the log function to authenticated users
GRANT EXECUTE ON FUNCTION public.log_audit_event TO authenticated;