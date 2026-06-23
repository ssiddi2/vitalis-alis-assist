
CREATE TABLE public.fhir_resources (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID,
  hospital_id UUID,
  resource_type TEXT NOT NULL,
  resource_id TEXT NOT NULL,
  payload JSONB NOT NULL,
  source TEXT NOT NULL DEFAULT 'alis',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_fhir_resources_patient ON public.fhir_resources(patient_id, created_at DESC);
CREATE INDEX idx_fhir_resources_type ON public.fhir_resources(resource_type, created_at DESC);

GRANT SELECT ON public.fhir_resources TO authenticated, anon;
GRANT ALL ON public.fhir_resources TO service_role;

ALTER TABLE public.fhir_resources ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Demo: anyone can read fhir mirror"
ON public.fhir_resources FOR SELECT
USING (true);
