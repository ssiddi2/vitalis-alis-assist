
CREATE TABLE public.workflow_metrics (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  encounter_id UUID REFERENCES public.encounters(id) ON DELETE SET NULL,
  user_id UUID NOT NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id UUID REFERENCES public.hospitals(id) ON DELETE SET NULL,
  click_count INTEGER NOT NULL DEFAULT 0,
  time_on_task_seconds INTEGER NOT NULL DEFAULT 0,
  notes_generated INTEGER NOT NULL DEFAULT 0,
  orders_staged INTEGER NOT NULL DEFAULT 0,
  orders_signed INTEGER NOT NULL DEFAULT 0,
  billing_codes_suggested INTEGER NOT NULL DEFAULT 0,
  voice_commands_used INTEGER NOT NULL DEFAULT 0,
  workflow_steps JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.workflow_metrics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can insert own metrics"
  ON public.workflow_metrics FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own metrics"
  ON public.workflow_metrics FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can view own metrics"
  ON public.workflow_metrics FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR has_role(auth.uid(), 'admin'::app_role));

CREATE TRIGGER update_workflow_metrics_updated_at
  BEFORE UPDATE ON public.workflow_metrics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();
