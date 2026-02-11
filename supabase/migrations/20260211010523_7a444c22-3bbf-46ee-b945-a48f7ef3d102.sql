
-- Patient Medications
CREATE TABLE public.patient_medications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  dose TEXT,
  route TEXT,
  frequency TEXT,
  start_date DATE,
  end_date DATE,
  status TEXT NOT NULL DEFAULT 'active',
  prescriber TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_medications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view patient medications"
  ON public.patient_medications FOR SELECT
  USING (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clinicians can insert patient medications"
  ON public.patient_medications FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clinicians can update patient medications"
  ON public.patient_medications FOR UPDATE
  USING (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Patient Allergies
CREATE TABLE public.patient_allergies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  allergen TEXT NOT NULL,
  reaction TEXT,
  severity TEXT NOT NULL DEFAULT 'moderate',
  onset_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_allergies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view patient allergies"
  ON public.patient_allergies FOR SELECT
  USING (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clinicians can insert patient allergies"
  ON public.patient_allergies FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clinicians can update patient allergies"
  ON public.patient_allergies FOR UPDATE
  USING (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Patient Problems
CREATE TABLE public.patient_problems (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  description TEXT NOT NULL,
  icd10_code TEXT,
  status TEXT NOT NULL DEFAULT 'active',
  onset_date DATE,
  resolved_date DATE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.patient_problems ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Clinicians can view patient problems"
  ON public.patient_problems FOR SELECT
  USING (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clinicians can insert patient problems"
  ON public.patient_problems FOR INSERT
  WITH CHECK (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

CREATE POLICY "Clinicians can update patient problems"
  ON public.patient_problems FOR UPDATE
  USING (has_role(auth.uid(), 'clinician'::app_role) OR has_role(auth.uid(), 'admin'::app_role));

-- Enable realtime for new tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_medications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_allergies;
ALTER PUBLICATION supabase_realtime ADD TABLE public.patient_problems;
