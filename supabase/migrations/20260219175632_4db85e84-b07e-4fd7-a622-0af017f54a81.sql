
-- ============================================
-- Phase 1: Outpatient EMR Data Foundation
-- ============================================

-- 1. New Enums
CREATE TYPE public.encounter_type AS ENUM (
  'office_visit', 'telehealth', 'follow_up', 'annual_physical', 'urgent', 'procedure'
);

CREATE TYPE public.encounter_status AS ENUM (
  'scheduled', 'checked_in', 'in_progress', 'completed', 'cancelled', 'no_show'
);

CREATE TYPE public.appointment_status AS ENUM (
  'scheduled', 'confirmed', 'checked_in', 'completed', 'cancelled', 'no_show'
);

CREATE TYPE public.prescription_status AS ENUM (
  'draft', 'signed', 'sent', 'filled', 'cancelled'
);

CREATE TYPE public.referral_status AS ENUM (
  'draft', 'sent', 'scheduled', 'completed', 'cancelled'
);

CREATE TYPE public.referral_urgency AS ENUM (
  'routine', 'urgent', 'stat'
);

CREATE TYPE public.patient_type AS ENUM (
  'inpatient', 'outpatient', 'both'
);

-- 2. Encounters table
CREATE TABLE public.encounters (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  provider_id UUID NOT NULL,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id),
  encounter_type public.encounter_type NOT NULL DEFAULT 'office_visit',
  visit_reason TEXT,
  chief_complaint TEXT,
  scheduled_at TIMESTAMPTZ,
  check_in_at TIMESTAMPTZ,
  check_out_at TIMESTAMPTZ,
  status public.encounter_status NOT NULL DEFAULT 'scheduled',
  duration_minutes INTEGER,
  room_number TEXT,
  billing_event_id UUID REFERENCES public.billing_events(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.encounters ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view encounters at their hospital"
  ON public.encounters FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hospital_users hu
      WHERE hu.user_id = auth.uid() AND hu.hospital_id = encounters.hospital_id
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clinicians can create encounters"
  ON public.encounters FOR INSERT
  WITH CHECK (
    (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
    AND provider_id = auth.uid()
  );

CREATE POLICY "Providers can update their encounters"
  ON public.encounters FOR UPDATE
  USING (
    provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_encounters_updated_at
  BEFORE UPDATE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 3. Appointments table
CREATE TABLE public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  provider_id UUID NOT NULL,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id),
  encounter_type public.encounter_type NOT NULL DEFAULT 'office_visit',
  visit_reason TEXT,
  start_time TIMESTAMPTZ NOT NULL,
  end_time TIMESTAMPTZ NOT NULL,
  duration_minutes INTEGER NOT NULL DEFAULT 30,
  status public.appointment_status NOT NULL DEFAULT 'scheduled',
  recurring_rule JSONB,
  notes TEXT,
  encounter_id UUID REFERENCES public.encounters(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view appointments at their hospital"
  ON public.appointments FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.hospital_users hu
      WHERE hu.user_id = auth.uid() AND hu.hospital_id = appointments.hospital_id
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clinicians can create appointments"
  ON public.appointments FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clinicians can update appointments"
  ON public.appointments FOR UPDATE
  USING (
    provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_appointments_updated_at
  BEFORE UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Enable realtime for appointments
ALTER PUBLICATION supabase_realtime ADD TABLE public.appointments;

-- 4. Prescriptions table
CREATE TABLE public.prescriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  encounter_id UUID REFERENCES public.encounters(id),
  prescriber_id UUID NOT NULL,
  medication_name TEXT NOT NULL,
  dose TEXT,
  frequency TEXT,
  route TEXT,
  quantity INTEGER,
  refills INTEGER DEFAULT 0,
  pharmacy_name TEXT,
  pharmacy_npi TEXT,
  status public.prescription_status NOT NULL DEFAULT 'draft',
  sig TEXT,
  dea_schedule TEXT,
  start_date DATE,
  end_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.prescriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view prescriptions via hospital access"
  ON public.prescriptions FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
      WHERE p.id = prescriptions.patient_id AND hu.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clinicians can create prescriptions"
  ON public.prescriptions FOR INSERT
  WITH CHECK (
    (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
    AND prescriber_id = auth.uid()
  );

CREATE POLICY "Prescribers can update their prescriptions"
  ON public.prescriptions FOR UPDATE
  USING (
    prescriber_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_prescriptions_updated_at
  BEFORE UPDATE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 5. Immunizations table
CREATE TABLE public.immunizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  vaccine_name TEXT NOT NULL,
  cvx_code TEXT,
  administered_date DATE NOT NULL DEFAULT CURRENT_DATE,
  lot_number TEXT,
  site TEXT,
  route TEXT,
  administered_by TEXT,
  manufacturer TEXT,
  next_due_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.immunizations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view immunizations"
  ON public.immunizations FOR SELECT
  USING (
    public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clinicians can insert immunizations"
  ON public.immunizations FOR INSERT
  WITH CHECK (
    public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clinicians can update immunizations"
  ON public.immunizations FOR UPDATE
  USING (
    public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_immunizations_updated_at
  BEFORE UPDATE ON public.immunizations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 6. Referrals table
CREATE TABLE public.referrals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  encounter_id UUID REFERENCES public.encounters(id),
  referring_provider_id UUID NOT NULL,
  referred_to_provider TEXT,
  referred_to_specialty TEXT NOT NULL,
  reason TEXT NOT NULL,
  urgency public.referral_urgency NOT NULL DEFAULT 'routine',
  status public.referral_status NOT NULL DEFAULT 'draft',
  scheduled_date DATE,
  completed_date DATE,
  report_received BOOLEAN DEFAULT false,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.referrals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view referrals via hospital access"
  ON public.referrals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
      WHERE p.id = referrals.patient_id AND hu.user_id = auth.uid()
    ) OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Clinicians can create referrals"
  ON public.referrals FOR INSERT
  WITH CHECK (
    (public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin'))
    AND referring_provider_id = auth.uid()
  );

CREATE POLICY "Referring providers can update referrals"
  ON public.referrals FOR UPDATE
  USING (
    referring_provider_id = auth.uid() OR public.has_role(auth.uid(), 'admin')
  );

CREATE TRIGGER update_referrals_updated_at
  BEFORE UPDATE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 7. Note Templates table
CREATE TABLE public.note_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  encounter_type public.encounter_type,
  specialty TEXT,
  template_content JSONB NOT NULL DEFAULT '{}',
  created_by UUID,
  hospital_id UUID REFERENCES public.hospitals(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.note_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view note templates"
  ON public.note_templates FOR SELECT
  USING (
    public.has_role(auth.uid(), 'clinician') OR public.has_role(auth.uid(), 'admin')
  );

CREATE POLICY "Admins can manage note templates"
  ON public.note_templates FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_note_templates_updated_at
  BEFORE UPDATE ON public.note_templates
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 8. Modify patients table for outpatient fields
ALTER TABLE public.patients
  ADD COLUMN IF NOT EXISTS patient_type public.patient_type DEFAULT 'inpatient',
  ADD COLUMN IF NOT EXISTS insurance_provider TEXT,
  ADD COLUMN IF NOT EXISTS insurance_id TEXT,
  ADD COLUMN IF NOT EXISTS pcp_provider_id UUID,
  ADD COLUMN IF NOT EXISTS preferred_pharmacy TEXT,
  ADD COLUMN IF NOT EXISTS preferred_language TEXT DEFAULT 'English',
  ADD COLUMN IF NOT EXISTS emergency_contact JSONB;

-- Make inpatient-specific fields nullable (they already have defaults so existing rows are fine)
ALTER TABLE public.patients
  ALTER COLUMN bed DROP NOT NULL,
  ALTER COLUMN location DROP NOT NULL,
  ALTER COLUMN admission_day SET DEFAULT 0,
  ALTER COLUMN expected_los SET DEFAULT 0;

-- 9. Add encounter_id to clinical_notes and staged_orders for encounter scoping
ALTER TABLE public.clinical_notes
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id);

ALTER TABLE public.staged_orders
  ADD COLUMN IF NOT EXISTS encounter_id UUID REFERENCES public.encounters(id);

-- 10. Audit triggers on new tables
CREATE TRIGGER audit_encounters_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.encounters
  FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

CREATE TRIGGER audit_prescriptions_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.prescriptions
  FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

CREATE TRIGGER audit_immunizations_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.immunizations
  FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

CREATE TRIGGER audit_referrals_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.referrals
  FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();
