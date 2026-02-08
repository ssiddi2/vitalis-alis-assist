-- Create enums for team communication
CREATE TYPE public.channel_type AS ENUM ('patient_care', 'department', 'consult');
CREATE TYPE public.team_message_type AS ENUM ('text', 'handoff', 'urgent', 'order_link');
CREATE TYPE public.consult_urgency AS ENUM ('routine', 'urgent', 'stat');
CREATE TYPE public.consult_status AS ENUM ('pending', 'accepted', 'completed', 'cancelled');

-- Team Channels - Patient-linked or topic-based chat rooms
CREATE TABLE public.team_channels (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  channel_type public.channel_type NOT NULL DEFAULT 'patient_care',
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Team Messages - Secure messages within channels
CREATE TABLE public.team_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  message_type public.team_message_type NOT NULL DEFAULT 'text',
  reply_to_id UUID REFERENCES public.team_messages(id) ON DELETE SET NULL,
  read_by JSONB DEFAULT '[]'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Channel Members - Track who has access to each channel
CREATE TABLE public.channel_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  channel_id UUID NOT NULL REFERENCES public.team_channels(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  joined_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(channel_id, user_id)
);

-- Direct Conversations - 1:1 private chats
CREATE TABLE public.direct_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  participant_1 UUID NOT NULL,
  participant_2 UUID NOT NULL,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  patient_id UUID REFERENCES public.patients(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(participant_1, participant_2, hospital_id)
);

-- Direct Messages - Private messages between two users
CREATE TABLE public.direct_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES public.direct_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL,
  content TEXT NOT NULL,
  is_read BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Consult Requests - Formal consultation tracking
CREATE TABLE public.consult_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id UUID NOT NULL REFERENCES public.patients(id) ON DELETE CASCADE,
  hospital_id UUID NOT NULL REFERENCES public.hospitals(id) ON DELETE CASCADE,
  requesting_user_id UUID NOT NULL,
  specialty TEXT NOT NULL,
  consultant_id UUID REFERENCES public.consultants(id) ON DELETE SET NULL,
  urgency public.consult_urgency NOT NULL DEFAULT 'routine',
  reason TEXT NOT NULL,
  status public.consult_status NOT NULL DEFAULT 'pending',
  channel_id UUID REFERENCES public.team_channels(id) ON DELETE SET NULL,
  response_time_minutes INTEGER,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on all tables
ALTER TABLE public.team_channels ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.channel_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.direct_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.consult_requests ENABLE ROW LEVEL SECURITY;

-- RLS Policies for team_channels
CREATE POLICY "Users can view channels at their hospital"
ON public.team_channels FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = team_channels.hospital_id
  ) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Clinicians can create channels"
ON public.team_channels FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'clinician') OR has_role(auth.uid(), 'admin'))
  AND auth.uid() = created_by
);

CREATE POLICY "Channel creators can update"
ON public.team_channels FOR UPDATE
USING (created_by = auth.uid() OR has_role(auth.uid(), 'admin'));

-- RLS Policies for team_messages
CREATE POLICY "Users can view messages in their channels"
ON public.team_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = team_messages.channel_id AND cm.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Channel members can send messages"
ON public.team_messages FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = team_messages.channel_id AND cm.user_id = auth.uid()
  ) AND sender_id = auth.uid()
);

CREATE POLICY "Users can update read status"
ON public.team_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.channel_members cm
    WHERE cm.channel_id = team_messages.channel_id AND cm.user_id = auth.uid()
  )
);

-- RLS Policies for channel_members
CREATE POLICY "Users can view channel members"
ON public.channel_members FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.channel_members cm2
    WHERE cm2.channel_id = channel_members.channel_id AND cm2.user_id = auth.uid()
  ) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Channel creators can add members"
ON public.channel_members FOR INSERT
WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.team_channels tc
    WHERE tc.id = channel_members.channel_id AND tc.created_by = auth.uid()
  ) OR has_role(auth.uid(), 'admin')
);

-- RLS Policies for direct_conversations
CREATE POLICY "Participants can view their conversations"
ON public.direct_conversations FOR SELECT
USING (participant_1 = auth.uid() OR participant_2 = auth.uid());

CREATE POLICY "Users can create direct conversations"
ON public.direct_conversations FOR INSERT
WITH CHECK (participant_1 = auth.uid() OR participant_2 = auth.uid());

-- RLS Policies for direct_messages
CREATE POLICY "Participants can view messages"
ON public.direct_messages FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.direct_conversations dc
    WHERE dc.id = direct_messages.conversation_id
    AND (dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid())
  )
);

CREATE POLICY "Participants can send messages"
ON public.direct_messages FOR INSERT
WITH CHECK (
  sender_id = auth.uid() AND
  EXISTS (
    SELECT 1 FROM public.direct_conversations dc
    WHERE dc.id = direct_messages.conversation_id
    AND (dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid())
  )
);

CREATE POLICY "Recipients can mark as read"
ON public.direct_messages FOR UPDATE
USING (
  EXISTS (
    SELECT 1 FROM public.direct_conversations dc
    WHERE dc.id = direct_messages.conversation_id
    AND (dc.participant_1 = auth.uid() OR dc.participant_2 = auth.uid())
  )
);

-- RLS Policies for consult_requests
CREATE POLICY "Users can view consults at their hospital"
ON public.consult_requests FOR SELECT
USING (
  EXISTS (
    SELECT 1 FROM public.hospital_users hu
    WHERE hu.user_id = auth.uid() AND hu.hospital_id = consult_requests.hospital_id
  ) OR has_role(auth.uid(), 'admin')
);

CREATE POLICY "Clinicians can create consult requests"
ON public.consult_requests FOR INSERT
WITH CHECK (
  (has_role(auth.uid(), 'clinician') OR has_role(auth.uid(), 'admin'))
  AND requesting_user_id = auth.uid()
);

CREATE POLICY "Involved parties can update consults"
ON public.consult_requests FOR UPDATE
USING (
  requesting_user_id = auth.uid() 
  OR EXISTS (
    SELECT 1 FROM public.consultants c
    WHERE c.id = consult_requests.consultant_id
  )
  OR has_role(auth.uid(), 'admin')
);

-- Enable realtime for messaging tables
ALTER PUBLICATION supabase_realtime ADD TABLE public.team_messages;
ALTER PUBLICATION supabase_realtime ADD TABLE public.direct_messages;

-- Create updated_at triggers
CREATE TRIGGER update_team_channels_updated_at
  BEFORE UPDATE ON public.team_channels
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

CREATE TRIGGER update_consult_requests_updated_at
  BEFORE UPDATE ON public.consult_requests
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- Audit triggers for HIPAA compliance
CREATE TRIGGER audit_team_messages_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.team_messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();

CREATE TRIGGER audit_direct_messages_changes
  AFTER INSERT OR UPDATE OR DELETE ON public.direct_messages
  FOR EACH ROW EXECUTE FUNCTION public.audit_phi_changes();