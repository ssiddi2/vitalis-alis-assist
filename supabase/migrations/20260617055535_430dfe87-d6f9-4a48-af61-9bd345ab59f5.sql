
CREATE TABLE public.patient_insurance (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  rank TEXT NOT NULL DEFAULT 'primary' CHECK (rank IN ('primary','secondary','tertiary')),
  payer_name TEXT NOT NULL,
  member_id TEXT NOT NULL,
  group_number TEXT,
  plan_name TEXT,
  subscriber_name TEXT,
  subscriber_dob DATE,
  relationship_to_subscriber TEXT DEFAULT 'self',
  effective_date DATE,
  termination_date DATE,
  copay_amount NUMERIC(10,2),
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.patient_insurance TO authenticated;
GRANT ALL ON public.patient_insurance TO service_role;
ALTER TABLE public.patient_insurance ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage insurance" ON public.patient_insurance
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_patient_insurance_updated BEFORE UPDATE ON public.patient_insurance
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.fee_schedule (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  code_type TEXT NOT NULL DEFAULT 'cpt' CHECK (code_type IN ('cpt','hcpcs')),
  code TEXT NOT NULL,
  description TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  modifier TEXT,
  active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX fee_schedule_unique_code ON public.fee_schedule (hospital_id, code, COALESCE(modifier, ''));
GRANT SELECT, INSERT, UPDATE, DELETE ON public.fee_schedule TO authenticated;
GRANT ALL ON public.fee_schedule TO service_role;
ALTER TABLE public.fee_schedule ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage fee schedule" ON public.fee_schedule
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_fee_schedule_updated BEFORE UPDATE ON public.fee_schedule
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TABLE public.superbills (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  provider_id UUID,
  service_date DATE NOT NULL,
  cpt_lines JSONB NOT NULL DEFAULT '[]'::jsonb,
  icd10_codes TEXT[] NOT NULL DEFAULT '{}',
  insurance_snapshot JSONB,
  total_amount NUMERIC(10,2) NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','finalized','exported')),
  pdf_url TEXT,
  generated_by UUID,
  generated_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.superbills TO authenticated;
GRANT ALL ON public.superbills TO service_role;
ALTER TABLE public.superbills ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Authenticated can manage superbills" ON public.superbills
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE TRIGGER trg_superbills_updated BEFORE UPDATE ON public.superbills
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE INDEX idx_superbills_patient ON public.superbills(patient_id);
CREATE INDEX idx_superbills_encounter ON public.superbills(encounter_id);
CREATE INDEX idx_patient_insurance_patient ON public.patient_insurance(patient_id);
CREATE INDEX idx_fee_schedule_hospital_code ON public.fee_schedule(hospital_id, code);
