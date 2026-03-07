
-- Consultation thread status enum
CREATE TYPE public.consultation_thread_status AS ENUM ('active', 'completed', 'cancelled');

-- Consultation message sender role
CREATE TYPE public.consultation_sender_role AS ENUM ('primary_clinician', 'specialist', 'ai');

-- Consultation insight target
CREATE TYPE public.consultation_insight_target AS ENUM ('primary_clinician', 'specialist', 'shared');

-- 1. consultation_threads: Three-participant consultation model
CREATE TABLE public.consultation_threads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  hospital_id uuid NOT NULL REFERENCES public.hospitals(id),
  primary_clinician_id uuid NOT NULL,
  specialist_id uuid REFERENCES public.consultants(id),
  ai_participant_id text NOT NULL DEFAULT 'alis',
  consult_request_id uuid REFERENCES public.consult_requests(id),
  specialty text NOT NULL,
  reason text NOT NULL,
  shared_context jsonb NOT NULL DEFAULT '{}'::jsonb,
  status consultation_thread_status NOT NULL DEFAULT 'active',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- 2. consultation_messages: Messages within a thread
CREATE TABLE public.consultation_messages (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.consultation_threads(id) ON DELETE CASCADE,
  sender_id text NOT NULL,
  sender_role consultation_sender_role NOT NULL,
  content text NOT NULL,
  metadata jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 3. ai_intelligence_log: Role-differentiated AI reasoning
CREATE TABLE public.ai_intelligence_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.consultation_threads(id) ON DELETE CASCADE,
  trigger_message_id uuid REFERENCES public.consultation_messages(id),
  target consultation_insight_target NOT NULL,
  insight_type text NOT NULL DEFAULT 'clinical_reasoning',
  content jsonb NOT NULL DEFAULT '{}',
  model_version text,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- 4. consultation_notes: Auto-generated consultation summaries
CREATE TABLE public.consultation_notes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  thread_id uuid NOT NULL REFERENCES public.consultation_threads(id) ON DELETE CASCADE,
  patient_id uuid NOT NULL REFERENCES public.patients(id),
  consultation_question text,
  clinical_summary text,
  specialist_recommendation text,
  treatment_plan text,
  generated_by text NOT NULL DEFAULT 'alis',
  status public.note_status NOT NULL DEFAULT 'draft',
  signed_by uuid,
  signed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indexes
CREATE INDEX idx_consultation_threads_patient ON public.consultation_threads(patient_id);
CREATE INDEX idx_consultation_threads_clinician ON public.consultation_threads(primary_clinician_id);
CREATE INDEX idx_consultation_messages_thread ON public.consultation_messages(thread_id);
CREATE INDEX idx_ai_intelligence_log_thread ON public.ai_intelligence_log(thread_id);
CREATE INDEX idx_consultation_notes_thread ON public.consultation_notes(thread_id);

-- Enable realtime for messages
ALTER PUBLICATION supabase_realtime ADD TABLE public.consultation_messages;

-- RLS
ALTER TABLE public.consultation_threads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ai_intelligence_log ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consultation_notes ENABLE ROW LEVEL SECURITY;

-- consultation_threads policies
CREATE POLICY "Clinicians can create threads" ON public.consultation_threads
  FOR INSERT TO authenticated
  WITH CHECK (
    (has_role(auth.uid(), 'clinician') OR has_role(auth.uid(), 'admin'))
    AND primary_clinician_id = auth.uid()
  );

CREATE POLICY "Thread participants can view" ON public.consultation_threads
  FOR SELECT TO authenticated
  USING (
    primary_clinician_id = auth.uid()
    OR has_role(auth.uid(), 'admin')
    OR EXISTS (
      SELECT 1 FROM hospital_users hu
      WHERE hu.user_id = auth.uid() AND hu.hospital_id = consultation_threads.hospital_id
    )
  );

CREATE POLICY "Thread creator can update" ON public.consultation_threads
  FOR UPDATE TO authenticated
  USING (primary_clinician_id = auth.uid() OR has_role(auth.uid(), 'admin'));

-- consultation_messages policies
CREATE POLICY "Thread participants can send messages" ON public.consultation_messages
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM consultation_threads ct
      WHERE ct.id = consultation_messages.thread_id
      AND (ct.primary_clinician_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

CREATE POLICY "Thread participants can view messages" ON public.consultation_messages
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consultation_threads ct
      WHERE ct.id = consultation_messages.thread_id
      AND (
        ct.primary_clinician_id = auth.uid()
        OR has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = ct.hospital_id
        )
      )
    )
  );

-- ai_intelligence_log policies
CREATE POLICY "Thread participants can view insights" ON public.ai_intelligence_log
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consultation_threads ct
      WHERE ct.id = ai_intelligence_log.thread_id
      AND (
        ct.primary_clinician_id = auth.uid()
        OR has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = ct.hospital_id
        )
      )
    )
  );

-- consultation_notes policies
CREATE POLICY "Thread participants can view notes" ON public.consultation_notes
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consultation_threads ct
      WHERE ct.id = consultation_notes.thread_id
      AND (
        ct.primary_clinician_id = auth.uid()
        OR has_role(auth.uid(), 'admin')
        OR EXISTS (
          SELECT 1 FROM hospital_users hu
          WHERE hu.user_id = auth.uid() AND hu.hospital_id = ct.hospital_id
        )
      )
    )
  );

CREATE POLICY "Clinicians can sign notes" ON public.consultation_notes
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM consultation_threads ct
      WHERE ct.id = consultation_notes.thread_id
      AND (ct.primary_clinician_id = auth.uid() OR has_role(auth.uid(), 'admin'))
    )
  );

-- Updated_at triggers
CREATE TRIGGER update_consultation_threads_updated_at
  BEFORE UPDATE ON public.consultation_threads
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE TRIGGER update_consultation_notes_updated_at
  BEFORE UPDATE ON public.consultation_notes
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();
