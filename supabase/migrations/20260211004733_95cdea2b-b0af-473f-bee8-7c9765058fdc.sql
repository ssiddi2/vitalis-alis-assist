
-- Create imaging_studies table for PACS integration
CREATE TABLE public.imaging_studies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  patient_id UUID NOT NULL REFERENCES public.patients(id),
  study_type TEXT NOT NULL,
  study_date TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  accession_number TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  modality TEXT,
  body_part TEXT,
  reading_radiologist TEXT,
  impression TEXT,
  report_text TEXT,
  viewer_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.imaging_studies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view imaging studies" ON public.imaging_studies
  FOR SELECT USING (true);

CREATE POLICY "Authenticated users can insert imaging studies" ON public.imaging_studies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Authenticated users can update imaging studies" ON public.imaging_studies
  FOR UPDATE USING (auth.uid() IS NOT NULL);

CREATE TRIGGER update_imaging_studies_updated_at
  BEFORE UPDATE ON public.imaging_studies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Add RCM columns to billing_events
ALTER TABLE public.billing_events
  ADD COLUMN IF NOT EXISTS coding_confidence NUMERIC,
  ADD COLUMN IF NOT EXISTS coder_reviewed BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS denial_reason TEXT,
  ADD COLUMN IF NOT EXISTS appeal_status TEXT;

-- Create notifications table
CREATE TABLE public.notifications (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  hospital_id UUID REFERENCES public.hospitals(id),
  patient_id UUID REFERENCES public.patients(id),
  type TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT,
  read BOOLEAN NOT NULL DEFAULT false,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" ON public.notifications
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Authenticated users can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "Users can update their own notifications" ON public.notifications
  FOR UPDATE USING (auth.uid() = user_id);

-- Enable realtime for notifications
ALTER PUBLICATION supabase_realtime ADD TABLE public.notifications;
ALTER PUBLICATION supabase_realtime ADD TABLE public.imaging_studies;
