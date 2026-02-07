-- Create EMR system enum
CREATE TYPE public.emr_system AS ENUM ('epic', 'meditech', 'cerner');

-- Create order status enum
CREATE TYPE public.order_status AS ENUM ('staged', 'approved', 'sent', 'cancelled');

-- Create note status enum
CREATE TYPE public.note_status AS ENUM ('draft', 'pending_signature', 'signed', 'amended');

-- Create note type enum
CREATE TYPE public.note_type AS ENUM ('progress', 'consult', 'discharge', 'procedure');

-- Create billing status enum
CREATE TYPE public.billing_status AS ENUM ('pending', 'submitted', 'accepted', 'rejected');

-- Create chat participant role enum
CREATE TYPE public.chat_role AS ENUM ('clinician', 'consultant', 'alis');

-- ============================================
-- HOSPITALS TABLE
-- ============================================
CREATE TABLE public.hospitals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  emr_system emr_system NOT NULL,
  address TEXT,
  logo_url TEXT,
  connection_status TEXT DEFAULT 'connected',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.hospitals ENABLE ROW LEVEL SECURITY;

-- Anyone authenticated can view hospitals
CREATE POLICY "Authenticated users can view hospitals"
  ON public.hospitals FOR SELECT
  TO authenticated
  USING (true);

-- Only admins can manage hospitals
CREATE POLICY "Admins can manage hospitals"
  ON public.hospitals FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- HOSPITAL_USERS TABLE (Access Control)
-- ============================================
CREATE TABLE public.hospital_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  access_level TEXT NOT NULL DEFAULT 'view',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(user_id, hospital_id)
);

ALTER TABLE public.hospital_users ENABLE ROW LEVEL SECURITY;

-- Users can view their own hospital access
CREATE POLICY "Users can view own hospital access"
  ON public.hospital_users FOR SELECT
  USING (auth.uid() = user_id);

-- Admins can manage all hospital access
CREATE POLICY "Admins can manage hospital access"
  ON public.hospital_users FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- ENHANCE PATIENTS TABLE
-- ============================================
ALTER TABLE public.patients 
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id),
  ADD COLUMN IF NOT EXISTS unit TEXT,
  ADD COLUMN IF NOT EXISTS attending_physician TEXT,
  ADD COLUMN IF NOT EXISTS care_team JSONB DEFAULT '[]'::jsonb;

-- ============================================
-- CONSULTANTS TABLE
-- ============================================
CREATE TABLE public.consultants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  specialty TEXT NOT NULL,
  name TEXT NOT NULL,
  pager TEXT,
  phone TEXT,
  on_call_status BOOLEAN DEFAULT false,
  avatar_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.consultants ENABLE ROW LEVEL SECURITY;

-- Users with hospital access can view consultants
CREATE POLICY "Users can view consultants at their hospitals"
  ON public.consultants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.hospital_users
      WHERE hospital_users.user_id = auth.uid()
        AND hospital_users.hospital_id = consultants.hospital_id
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Admins can manage consultants
CREATE POLICY "Admins can manage consultants"
  ON public.consultants FOR ALL
  USING (public.has_role(auth.uid(), 'admin'));

-- ============================================
-- ENHANCE CONVERSATIONS TABLE
-- ============================================
ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS hospital_id UUID REFERENCES public.hospitals(id);

-- ============================================
-- CHAT_PARTICIPANTS TABLE
-- ============================================
CREATE TABLE public.chat_participants (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  consultant_id UUID REFERENCES public.consultants(id) ON DELETE CASCADE,
  role chat_role NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active BOOLEAN DEFAULT true,
  CONSTRAINT participant_has_identity CHECK (user_id IS NOT NULL OR consultant_id IS NOT NULL OR role = 'alis')
);

ALTER TABLE public.chat_participants ENABLE ROW LEVEL SECURITY;

-- Users can view participants in their conversations
CREATE POLICY "Users can view chat participants"
  ON public.chat_participants FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = chat_participants.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- Users can add participants to their conversations
CREATE POLICY "Users can add chat participants"
  ON public.chat_participants FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.conversations
      WHERE conversations.id = chat_participants.conversation_id
        AND conversations.user_id = auth.uid()
    )
  );

-- ============================================
-- STAGED_ORDERS TABLE
-- ============================================
CREATE TABLE public.staged_orders (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE CASCADE,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  order_type TEXT NOT NULL,
  order_data JSONB NOT NULL DEFAULT '{}'::jsonb,
  rationale TEXT,
  status order_status NOT NULL DEFAULT 'staged',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.staged_orders ENABLE ROW LEVEL SECURITY;

-- Users can view orders for patients at their hospitals
CREATE POLICY "Users can view staged orders"
  ON public.staged_orders FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
      WHERE p.id = staged_orders.patient_id
        AND hu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Users can create orders
CREATE POLICY "Users can create staged orders"
  ON public.staged_orders FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients p
      JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
      WHERE p.id = staged_orders.patient_id
        AND hu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Users can update orders they created
CREATE POLICY "Users can update own staged orders"
  ON public.staged_orders FOR UPDATE
  TO authenticated
  USING (created_by = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================
-- CLINICAL_NOTES TABLE
-- ============================================
CREATE TABLE public.clinical_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES public.conversations(id) ON DELETE SET NULL,
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  note_type note_type NOT NULL DEFAULT 'progress',
  content JSONB NOT NULL DEFAULT '{}'::jsonb,
  status note_status NOT NULL DEFAULT 'draft',
  author_id UUID REFERENCES auth.users(id),
  signed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.clinical_notes ENABLE ROW LEVEL SECURITY;

-- Users can view notes for patients at their hospitals
CREATE POLICY "Users can view clinical notes"
  ON public.clinical_notes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
      WHERE p.id = clinical_notes.patient_id
        AND hu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Users can create notes
CREATE POLICY "Users can create clinical notes"
  ON public.clinical_notes FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.patients p
      JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
      WHERE p.id = clinical_notes.patient_id
        AND hu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- Authors can update their notes
CREATE POLICY "Authors can update clinical notes"
  ON public.clinical_notes FOR UPDATE
  TO authenticated
  USING (author_id = auth.uid() OR public.has_role(auth.uid(), 'admin'));

-- ============================================
-- BILLING_EVENTS TABLE
-- ============================================
CREATE TABLE public.billing_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  note_id UUID REFERENCES public.clinical_notes(id) ON DELETE SET NULL,
  cpt_codes TEXT[] DEFAULT '{}',
  icd10_codes TEXT[] DEFAULT '{}',
  estimated_revenue DECIMAL(10, 2),
  status billing_status NOT NULL DEFAULT 'pending',
  submitted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.billing_events ENABLE ROW LEVEL SECURITY;

-- Users can view billing for patients at their hospitals
CREATE POLICY "Users can view billing events"
  ON public.billing_events FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.patients p
      JOIN public.hospital_users hu ON hu.hospital_id = p.hospital_id
      WHERE p.id = billing_events.patient_id
        AND hu.user_id = auth.uid()
    )
    OR public.has_role(auth.uid(), 'admin')
  );

-- ============================================
-- UPDATE TRIGGERS
-- ============================================
CREATE TRIGGER update_hospitals_updated_at
  BEFORE UPDATE ON public.hospitals
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_consultants_updated_at
  BEFORE UPDATE ON public.consultants
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_staged_orders_updated_at
  BEFORE UPDATE ON public.staged_orders
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_clinical_notes_updated_at
  BEFORE UPDATE ON public.clinical_notes
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_billing_events_updated_at
  BEFORE UPDATE ON public.billing_events
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- ============================================
-- ENABLE REALTIME FOR KEY TABLES
-- ============================================
ALTER PUBLICATION supabase_realtime ADD TABLE public.staged_orders;
ALTER PUBLICATION supabase_realtime ADD TABLE public.clinical_notes;
ALTER PUBLICATION supabase_realtime ADD TABLE public.chat_participants;