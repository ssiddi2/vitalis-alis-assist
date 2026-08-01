ALTER TABLE public.acuity_scores
  ADD COLUMN IF NOT EXISTS service_category text,
  ADD COLUMN IF NOT EXISTS hospital_priority text,
  ADD COLUMN IF NOT EXISTS risk_level text,
  ADD COLUMN IF NOT EXISTS estimated_response_time text,
  ADD COLUMN IF NOT EXISTS extracted_keywords jsonb,
  ADD COLUMN IF NOT EXISTS immediate_actions jsonb,
  ADD COLUMN IF NOT EXISTS suggested_specialty text,
  ADD COLUMN IF NOT EXISTS suggested_specialties jsonb;