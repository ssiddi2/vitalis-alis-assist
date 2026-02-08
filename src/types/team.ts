// Team Communication Types for HIPAA-compliant secure messaging

export type ChannelType = 'patient_care' | 'department' | 'consult';
export type TeamMessageType = 'text' | 'handoff' | 'urgent' | 'order_link';
export type ConsultUrgency = 'routine' | 'urgent' | 'stat';
export type ConsultStatus = 'pending' | 'accepted' | 'completed' | 'cancelled';

export interface TeamChannel {
  id: string;
  hospital_id: string;
  patient_id: string | null;
  name: string;
  channel_type: ChannelType;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface TeamMessage {
  id: string;
  channel_id: string;
  sender_id: string;
  content: string;
  message_type: TeamMessageType;
  reply_to_id: string | null;
  read_by: string[];
  created_at: string;
  // Joined data
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ChannelMember {
  id: string;
  channel_id: string;
  user_id: string;
  joined_at: string;
  // Joined data
  profile?: {
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface DirectConversation {
  id: string;
  participant_1: string;
  participant_2: string;
  hospital_id: string;
  patient_id: string | null;
  created_at: string;
  // Joined data
  other_participant?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
  last_message?: DirectMessage;
  unread_count?: number;
}

export interface DirectMessage {
  id: string;
  conversation_id: string;
  sender_id: string;
  content: string;
  is_read: boolean;
  created_at: string;
  // Joined data
  sender?: {
    id: string;
    full_name: string | null;
    avatar_url: string | null;
  };
}

export interface ConsultRequest {
  id: string;
  patient_id: string;
  hospital_id: string;
  requesting_user_id: string;
  specialty: string;
  consultant_id: string | null;
  urgency: ConsultUrgency;
  reason: string;
  status: ConsultStatus;
  channel_id: string | null;
  response_time_minutes: number | null;
  created_at: string;
  updated_at: string;
  // Joined data
  patient?: {
    name: string;
    mrn: string;
  };
  requester?: {
    full_name: string | null;
  };
  consultant?: {
    name: string;
    specialty: string;
  };
}

// Input types for creating/updating
export interface CreateChannelInput {
  hospital_id: string;
  patient_id?: string;
  name: string;
  channel_type: ChannelType;
}

export interface SendMessageInput {
  channel_id: string;
  content: string;
  message_type?: TeamMessageType;
  reply_to_id?: string;
}

export interface CreateDirectMessageInput {
  recipient_id: string;
  hospital_id: string;
  patient_id?: string;
  content: string;
}

export interface CreateConsultInput {
  patient_id: string;
  hospital_id: string;
  specialty: string;
  urgency: ConsultUrgency;
  reason: string;
}
