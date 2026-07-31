CREATE TABLE public.acuity_scores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  hospital_id uuid NOT NULL,
  patient_id uuid,
  source_table text,
  source_id text,
  message_text text,
  classification text,
  acuity_level text,
  score int,
  color text,
  rationale text,
  recommendation text,
  confidence numeric,
  source_layer text,
  model_provider text,
  model_name text,
  created_by uuid
);

CREATE TABLE public.acuity_feedback (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  acuity_id uuid REFERENCES public.acuity_scores(id) ON DELETE CASCADE,
  hospital_id uuid NOT NULL,
  metric_type text,
  metric_value text,
  recorded_by uuid
);

GRANT SELECT, INSERT ON public.acuity_scores TO authenticated;
GRANT ALL ON public.acuity_scores TO service_role;
GRANT SELECT, INSERT ON public.acuity_feedback TO authenticated;
GRANT ALL ON public.acuity_feedback TO service_role;

ALTER TABLE public.acuity_scores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.acuity_feedback ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Members can view acuity scores"
ON public.acuity_scores FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.hospital_id = acuity_scores.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Members can insert acuity scores"
ON public.acuity_scores FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.hospital_id = acuity_scores.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Members can view acuity feedback"
ON public.acuity_feedback FOR SELECT TO authenticated
USING (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.hospital_id = acuity_feedback.hospital_id AND hu.user_id = auth.uid()));

CREATE POLICY "Members can insert acuity feedback"
ON public.acuity_feedback FOR INSERT TO authenticated
WITH CHECK (EXISTS (SELECT 1 FROM public.hospital_users hu WHERE hu.hospital_id = acuity_feedback.hospital_id AND hu.user_id = auth.uid()));

CREATE INDEX idx_acuity_scores_hospital ON public.acuity_scores(hospital_id, created_at DESC);
CREATE INDEX idx_acuity_feedback_acuity ON public.acuity_feedback(acuity_id);