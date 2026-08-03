CREATE TABLE public.lab_results (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  patient_id uuid NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  panel text,
  test_name text NOT NULL,
  value text,
  unit text,
  reference_range text,
  is_abnormal boolean NOT NULL DEFAULT false,
  resulted_at timestamptz
);

CREATE INDEX idx_lab_results_patient ON public.lab_results (patient_id, resulted_at DESC);

GRANT SELECT, INSERT ON public.lab_results TO authenticated;
GRANT ALL ON public.lab_results TO service_role;

ALTER TABLE public.lab_results ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Hospital members can view lab results"
ON public.lab_results FOR SELECT TO authenticated
USING (
  (EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = lab_results.patient_id AND hu.user_id = auth.uid()
  )) OR public.has_role(auth.uid(), 'admin'::app_role)
);

CREATE POLICY "Hospital members can insert lab results"
ON public.lab_results FOR INSERT TO authenticated
WITH CHECK (
  (EXISTS (
    SELECT 1 FROM public.patients p
    JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
    WHERE p.id = lab_results.patient_id AND hu.user_id = auth.uid()
  )) OR public.has_role(auth.uid(), 'admin'::app_role)
);