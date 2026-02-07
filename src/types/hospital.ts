// Hospital and EMR-related types

export type EmrSystem = 'epic' | 'meditech' | 'cerner';

export type OrderStatus = 'staged' | 'approved' | 'sent' | 'cancelled';

export type NoteStatus = 'draft' | 'pending_signature' | 'signed' | 'amended';

export type NoteType = 'progress' | 'consult' | 'discharge' | 'procedure';

export type BillingStatus = 'pending' | 'submitted' | 'accepted' | 'rejected';

export type ChatRole = 'clinician' | 'consultant' | 'alis';

export interface Hospital {
  id: string;
  name: string;
  code: string;
  emr_system: EmrSystem;
  address: string | null;
  logo_url: string | null;
  connection_status: string;
  created_at: string;
  updated_at: string;
}

export interface Consultant {
  id: string;
  hospital_id: string;
  specialty: string;
  name: string;
  pager: string | null;
  phone: string | null;
  on_call_status: boolean;
  avatar_url: string | null;
  created_at: string;
  updated_at: string;
}

export interface StagedOrder {
  id: string;
  conversation_id: string | null;
  patient_id: string;
  order_type: string;
  order_data: Record<string, unknown>;
  rationale: string | null;
  status: OrderStatus;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClinicalNote {
  id: string;
  conversation_id: string | null;
  patient_id: string;
  note_type: NoteType;
  content: {
    subjective?: string;
    objective?: string;
    assessment?: string;
    plan?: string;
  };
  status: NoteStatus;
  author_id: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BillingEvent {
  id: string;
  patient_id: string;
  note_id: string | null;
  cpt_codes: string[];
  icd10_codes: string[];
  estimated_revenue: number | null;
  status: BillingStatus;
  submitted_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatParticipant {
  id: string;
  conversation_id: string;
  user_id: string | null;
  consultant_id: string | null;
  role: ChatRole;
  joined_at: string;
  is_active: boolean;
}
