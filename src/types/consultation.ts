export type ConsultationThreadStatus = 'active' | 'completed' | 'cancelled';
export type ConsultationSenderRole = 'primary_clinician' | 'specialist' | 'ai';
export type ConsultationInsightTarget = 'primary_clinician' | 'specialist' | 'shared';

export interface ConsultationThread {
  id: string;
  patient_id: string;
  hospital_id: string;
  primary_clinician_id: string;
  specialist_id: string | null;
  ai_participant_id: string;
  consult_request_id: string | null;
  specialty: string;
  reason: string;
  shared_context: SharedPatientContext;
  status: ConsultationThreadStatus;
  created_at: string;
  updated_at: string;
}

export interface ConsultationMessage {
  id: string;
  thread_id: string;
  sender_id: string;
  sender_role: ConsultationSenderRole;
  content: string;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface AIIntelligenceLog {
  id: string;
  thread_id: string;
  trigger_message_id: string | null;
  target: ConsultationInsightTarget;
  insight_type: string;
  content: { text: string };
  model_version: string | null;
  created_at: string;
}

export interface ConsultationNote {
  id: string;
  thread_id: string;
  patient_id: string;
  consultation_question: string | null;
  clinical_summary: string | null;
  specialist_recommendation: string | null;
  treatment_plan: string | null;
  generated_by: string;
  status: string;
  signed_by: string | null;
  signed_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface SharedPatientContext {
  vitals: Record<string, unknown> | null;
  medications: Array<Record<string, unknown>>;
  allergies: Array<Record<string, unknown>>;
  problems: Array<Record<string, unknown>>;
  imaging: Array<Record<string, unknown>>;
  recent_notes: Array<Record<string, unknown>>;
}
