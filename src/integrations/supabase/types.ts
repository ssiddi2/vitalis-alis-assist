export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.5"
  }
  public: {
    Tables: {
      access_attestations: {
        Row: {
          attested_at: string
          attested_by: string
          hospital_id: string
          id: string
          kind: string
          notes: string | null
          roles_granted: string[]
          user_id: string
        }
        Insert: {
          attested_at?: string
          attested_by: string
          hospital_id: string
          id?: string
          kind: string
          notes?: string | null
          roles_granted?: string[]
          user_id: string
        }
        Update: {
          attested_at?: string
          attested_by?: string
          hospital_id?: string
          id?: string
          kind?: string
          notes?: string | null
          roles_granted?: string[]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "access_attestations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      acuity_feedback: {
        Row: {
          acuity_id: string | null
          created_at: string
          hospital_id: string
          id: string
          metric_type: string | null
          metric_value: string | null
          recorded_by: string | null
        }
        Insert: {
          acuity_id?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          metric_type?: string | null
          metric_value?: string | null
          recorded_by?: string | null
        }
        Update: {
          acuity_id?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          metric_type?: string | null
          metric_value?: string | null
          recorded_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "acuity_feedback_acuity_id_fkey"
            columns: ["acuity_id"]
            isOneToOne: false
            referencedRelation: "acuity_scores"
            referencedColumns: ["id"]
          },
        ]
      }
      acuity_scores: {
        Row: {
          acuity_level: string | null
          classification: string | null
          color: string | null
          confidence: number | null
          created_at: string
          created_by: string | null
          estimated_response_time: string | null
          extracted_keywords: Json | null
          hospital_id: string
          hospital_priority: string | null
          id: string
          immediate_actions: Json | null
          message_text: string | null
          model_name: string | null
          model_provider: string | null
          patient_id: string | null
          rationale: string | null
          recommendation: string | null
          risk_level: string | null
          score: number | null
          service_category: string | null
          source_id: string | null
          source_layer: string | null
          source_table: string | null
          suggested_specialties: Json | null
          suggested_specialty: string | null
        }
        Insert: {
          acuity_level?: string | null
          classification?: string | null
          color?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          estimated_response_time?: string | null
          extracted_keywords?: Json | null
          hospital_id: string
          hospital_priority?: string | null
          id?: string
          immediate_actions?: Json | null
          message_text?: string | null
          model_name?: string | null
          model_provider?: string | null
          patient_id?: string | null
          rationale?: string | null
          recommendation?: string | null
          risk_level?: string | null
          score?: number | null
          service_category?: string | null
          source_id?: string | null
          source_layer?: string | null
          source_table?: string | null
          suggested_specialties?: Json | null
          suggested_specialty?: string | null
        }
        Update: {
          acuity_level?: string | null
          classification?: string | null
          color?: string | null
          confidence?: number | null
          created_at?: string
          created_by?: string | null
          estimated_response_time?: string | null
          extracted_keywords?: Json | null
          hospital_id?: string
          hospital_priority?: string | null
          id?: string
          immediate_actions?: Json | null
          message_text?: string | null
          model_name?: string | null
          model_provider?: string | null
          patient_id?: string | null
          rationale?: string | null
          recommendation?: string | null
          risk_level?: string | null
          score?: number | null
          service_category?: string | null
          source_id?: string | null
          source_layer?: string | null
          source_table?: string | null
          suggested_specialties?: Json | null
          suggested_specialty?: string | null
        }
        Relationships: []
      }
      ai_intelligence_log: {
        Row: {
          content: Json
          created_at: string
          id: string
          insight_type: string
          model_version: string | null
          target: Database["public"]["Enums"]["consultation_insight_target"]
          thread_id: string
          trigger_message_id: string | null
        }
        Insert: {
          content?: Json
          created_at?: string
          id?: string
          insight_type?: string
          model_version?: string | null
          target: Database["public"]["Enums"]["consultation_insight_target"]
          thread_id: string
          trigger_message_id?: string | null
        }
        Update: {
          content?: Json
          created_at?: string
          id?: string
          insight_type?: string
          model_version?: string | null
          target?: Database["public"]["Enums"]["consultation_insight_target"]
          thread_id?: string
          trigger_message_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "ai_intelligence_log_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "consultation_threads"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "ai_intelligence_log_trigger_message_id_fkey"
            columns: ["trigger_message_id"]
            isOneToOne: false
            referencedRelation: "consultation_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      appointments: {
        Row: {
          created_at: string
          duration_minutes: number
          encounter_id: string | null
          encounter_type: Database["public"]["Enums"]["encounter_type"]
          end_time: string
          hospital_id: string
          id: string
          notes: string | null
          patient_id: string
          provider_id: string
          recurring_rule: Json | null
          start_time: string
          status: Database["public"]["Enums"]["appointment_status"]
          updated_at: string
          visit_reason: string | null
        }
        Insert: {
          created_at?: string
          duration_minutes?: number
          encounter_id?: string | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"]
          end_time: string
          hospital_id: string
          id?: string
          notes?: string | null
          patient_id: string
          provider_id: string
          recurring_rule?: Json | null
          start_time: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          visit_reason?: string | null
        }
        Update: {
          created_at?: string
          duration_minutes?: number
          encounter_id?: string | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"]
          end_time?: string
          hospital_id?: string
          id?: string
          notes?: string | null
          patient_id?: string
          provider_id?: string
          recurring_rule?: Json | null
          start_time?: string
          status?: Database["public"]["Enums"]["appointment_status"]
          updated_at?: string
          visit_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "appointments_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action_type: Database["public"]["Enums"]["audit_action_type"]
          created_at: string
          hospital_id: string | null
          id: string
          ip_address: unknown
          metadata: Json | null
          patient_id: string | null
          resource_id: string | null
          resource_type: string
          session_id: string | null
          user_agent: string | null
          user_id: string | null
        }
        Insert: {
          action_type: Database["public"]["Enums"]["audit_action_type"]
          created_at?: string
          hospital_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          patient_id?: string | null
          resource_id?: string | null
          resource_type: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Update: {
          action_type?: Database["public"]["Enums"]["audit_action_type"]
          created_at?: string
          hospital_id?: string | null
          id?: string
          ip_address?: unknown
          metadata?: Json | null
          patient_id?: string | null
          resource_id?: string | null
          resource_type?: string
          session_id?: string | null
          user_agent?: string | null
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      billing_events: {
        Row: {
          appeal_status: string | null
          coder_reviewed: boolean | null
          coding_confidence: number | null
          cpt_codes: string[] | null
          created_at: string
          denial_reason: string | null
          estimated_revenue: number | null
          icd10_codes: string[] | null
          id: string
          note_id: string | null
          patient_id: string
          status: Database["public"]["Enums"]["billing_status"]
          submitted_at: string | null
          updated_at: string
        }
        Insert: {
          appeal_status?: string | null
          coder_reviewed?: boolean | null
          coding_confidence?: number | null
          cpt_codes?: string[] | null
          created_at?: string
          denial_reason?: string | null
          estimated_revenue?: number | null
          icd10_codes?: string[] | null
          id?: string
          note_id?: string | null
          patient_id: string
          status?: Database["public"]["Enums"]["billing_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Update: {
          appeal_status?: string | null
          coder_reviewed?: boolean | null
          coding_confidence?: number | null
          cpt_codes?: string[] | null
          created_at?: string
          denial_reason?: string | null
          estimated_revenue?: number | null
          icd10_codes?: string[] | null
          id?: string
          note_id?: string | null
          patient_id?: string
          status?: Database["public"]["Enums"]["billing_status"]
          submitted_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "billing_events_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "billing_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      care_request_events: {
        Row: {
          actor_id: string | null
          care_request_id: string
          created_at: string
          event_code: string
          from_status: string | null
          hospital_id: string
          id: string
          metadata: Json
          patient_id: string
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          care_request_id: string
          created_at?: string
          event_code: string
          from_status?: string | null
          hospital_id: string
          id?: string
          metadata?: Json
          patient_id: string
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          care_request_id?: string
          created_at?: string
          event_code?: string
          from_status?: string | null
          hospital_id?: string
          id?: string
          metadata?: Json
          patient_id?: string
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "care_request_events_care_request_id_fkey"
            columns: ["care_request_id"]
            isOneToOne: false
            referencedRelation: "care_requests"
            referencedColumns: ["id"]
          },
        ]
      }
      care_requests: {
        Row: {
          accessibility_needs: string | null
          appointment_id: string | null
          assigned_provider_id: string | null
          callback_phone: string | null
          callback_verified_at: string | null
          consent_accepted_at: string | null
          consent_version: string | null
          created_at: string
          created_by: string
          decline_reason: string | null
          emergency_ack_at: string | null
          encounter_id: string | null
          hospital_id: string
          id: string
          is_established_patient: boolean
          lock_version: number
          patient_id: string
          patient_state_code: string | null
          payer_preference: Database["public"]["Enums"]["payer_preference"]
          preferred_language: string | null
          reason_text: string | null
          records_status: string
          red_flag: boolean
          red_flag_codes: string[]
          referral_status: string
          requested_urgency: string
          safety_screen_completed_at: string | null
          safety_screen_version: number | null
          service_line_id: string
          status: Database["public"]["Enums"]["care_request_status"]
          submitted_at: string | null
          symptom_duration: string | null
          triage_disposition: string | null
          triage_reason: string | null
          triaged_at: string | null
          triaged_by: string | null
          updated_at: string
        }
        Insert: {
          accessibility_needs?: string | null
          appointment_id?: string | null
          assigned_provider_id?: string | null
          callback_phone?: string | null
          callback_verified_at?: string | null
          consent_accepted_at?: string | null
          consent_version?: string | null
          created_at?: string
          created_by: string
          decline_reason?: string | null
          emergency_ack_at?: string | null
          encounter_id?: string | null
          hospital_id: string
          id?: string
          is_established_patient?: boolean
          lock_version?: number
          patient_id: string
          patient_state_code?: string | null
          payer_preference?: Database["public"]["Enums"]["payer_preference"]
          preferred_language?: string | null
          reason_text?: string | null
          records_status?: string
          red_flag?: boolean
          red_flag_codes?: string[]
          referral_status?: string
          requested_urgency?: string
          safety_screen_completed_at?: string | null
          safety_screen_version?: number | null
          service_line_id: string
          status?: Database["public"]["Enums"]["care_request_status"]
          submitted_at?: string | null
          symptom_duration?: string | null
          triage_disposition?: string | null
          triage_reason?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Update: {
          accessibility_needs?: string | null
          appointment_id?: string | null
          assigned_provider_id?: string | null
          callback_phone?: string | null
          callback_verified_at?: string | null
          consent_accepted_at?: string | null
          consent_version?: string | null
          created_at?: string
          created_by?: string
          decline_reason?: string | null
          emergency_ack_at?: string | null
          encounter_id?: string | null
          hospital_id?: string
          id?: string
          is_established_patient?: boolean
          lock_version?: number
          patient_id?: string
          patient_state_code?: string | null
          payer_preference?: Database["public"]["Enums"]["payer_preference"]
          preferred_language?: string | null
          reason_text?: string | null
          records_status?: string
          red_flag?: boolean
          red_flag_codes?: string[]
          referral_status?: string
          requested_urgency?: string
          safety_screen_completed_at?: string | null
          safety_screen_version?: number | null
          service_line_id?: string
          status?: Database["public"]["Enums"]["care_request_status"]
          submitted_at?: string | null
          symptom_duration?: string | null
          triage_disposition?: string | null
          triage_reason?: string | null
          triaged_at?: string | null
          triaged_by?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "care_requests_appointment_id_fkey"
            columns: ["appointment_id"]
            isOneToOne: false
            referencedRelation: "appointments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_requests_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_requests_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "care_requests_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      cash_pay_service_fees: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          created_by: string | null
          currency: string
          effective_end: string | null
          effective_start: string
          fee_reference: string
          hospital_id: string
          id: string
          service_line_id: string
          state_code: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_end?: string | null
          effective_start?: string
          fee_reference: string
          hospital_id: string
          id?: string
          service_line_id: string
          state_code?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          created_by?: string | null
          currency?: string
          effective_end?: string | null
          effective_start?: string
          fee_reference?: string
          hospital_id?: string
          id?: string
          service_line_id?: string
          state_code?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "cash_pay_service_fees_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "cash_pay_service_fees_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_members: {
        Row: {
          channel_id: string
          id: string
          joined_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          id?: string
          joined_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          id?: string
          joined_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
        ]
      }
      chat_participants: {
        Row: {
          consultant_id: string | null
          conversation_id: string
          id: string
          is_active: boolean | null
          joined_at: string
          role: Database["public"]["Enums"]["chat_role"]
          user_id: string | null
        }
        Insert: {
          consultant_id?: string | null
          conversation_id: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          role: Database["public"]["Enums"]["chat_role"]
          user_id?: string | null
        }
        Update: {
          consultant_id?: string | null
          conversation_id?: string
          id?: string
          is_active?: boolean | null
          joined_at?: string
          role?: Database["public"]["Enums"]["chat_role"]
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "chat_participants_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "chat_participants_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_events: {
        Row: {
          actor_id: string | null
          claim_id: string
          created_at: string
          event_code: string
          from_status: string | null
          hospital_id: string
          id: string
          metadata: Json
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          claim_id: string
          created_at?: string
          event_code: string
          from_status?: string | null
          hospital_id: string
          id?: string
          metadata?: Json
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          claim_id?: string
          created_at?: string
          event_code?: string
          from_status?: string | null
          hospital_id?: string
          id?: string
          metadata?: Json
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "claim_events_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_inbox: {
        Row: {
          claim_id: string | null
          correlation_id: string | null
          created_at: string
          error_code: string | null
          event_id: string
          hospital_id: string
          id: string
          message_type: string
          payload_hash: string
          signature_verified: boolean
          status: string
        }
        Insert: {
          claim_id?: string | null
          correlation_id?: string | null
          created_at?: string
          error_code?: string | null
          event_id: string
          hospital_id: string
          id?: string
          message_type: string
          payload_hash: string
          signature_verified?: boolean
          status?: string
        }
        Update: {
          claim_id?: string | null
          correlation_id?: string | null
          created_at?: string
          error_code?: string | null
          event_id?: string
          hospital_id?: string
          id?: string
          message_type?: string
          payload_hash?: string
          signature_verified?: boolean
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_inbox_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_inbox_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_lines: {
        Row: {
          charge_amount: number
          claim_id: string
          code_set: string
          code_version: string
          cpt_code: string
          created_at: string
          diagnosis_pointers: number[]
          hospital_id: string
          id: string
          line_number: number
          modifiers: string[]
          service_date: string | null
          units: number
        }
        Insert: {
          charge_amount?: number
          claim_id: string
          code_set?: string
          code_version?: string
          cpt_code: string
          created_at?: string
          diagnosis_pointers?: number[]
          hospital_id: string
          id?: string
          line_number: number
          modifiers?: string[]
          service_date?: string | null
          units?: number
        }
        Update: {
          charge_amount?: number
          claim_id?: string
          code_set?: string
          code_version?: string
          cpt_code?: string
          created_at?: string
          diagnosis_pointers?: number[]
          hospital_id?: string
          id?: string
          line_number?: number
          modifiers?: string[]
          service_date?: string | null
          units?: number
        }
        Relationships: [
          {
            foreignKeyName: "claim_lines_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_lines_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_outbox: {
        Row: {
          claim_id: string
          correlation_id: string
          created_at: string
          error_code: string | null
          event_id: string
          hospital_id: string
          id: string
          message_type: string
          payload_hash: string
          retry_count: number
          status: string
          vendor_reference: string | null
          x12_version: string
        }
        Insert: {
          claim_id: string
          correlation_id: string
          created_at?: string
          error_code?: string | null
          event_id: string
          hospital_id: string
          id?: string
          message_type: string
          payload_hash: string
          retry_count?: number
          status?: string
          vendor_reference?: string | null
          x12_version?: string
        }
        Update: {
          claim_id?: string
          correlation_id?: string
          created_at?: string
          error_code?: string | null
          event_id?: string
          hospital_id?: string
          id?: string
          message_type?: string
          payload_hash?: string
          retry_count?: number
          status?: string
          vendor_reference?: string | null
          x12_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_outbox_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_outbox_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_remittances: {
        Row: {
          adjustment_codes: string[]
          allowed_amount: number | null
          claim_id: string
          control_number: string | null
          correlation_id: string | null
          denial_code: string | null
          hospital_id: string
          id: string
          paid_amount: number | null
          patient_responsibility: number | null
          payer_id: string | null
          payload_hash: string | null
          received_at: string
          reconciled_at: string | null
          reconciled_by: string | null
          status: string
          summary: Json
          transaction_type: string
        }
        Insert: {
          adjustment_codes?: string[]
          allowed_amount?: number | null
          claim_id: string
          control_number?: string | null
          correlation_id?: string | null
          denial_code?: string | null
          hospital_id: string
          id?: string
          paid_amount?: number | null
          patient_responsibility?: number | null
          payer_id?: string | null
          payload_hash?: string | null
          received_at?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          status: string
          summary?: Json
          transaction_type: string
        }
        Update: {
          adjustment_codes?: string[]
          allowed_amount?: number | null
          claim_id?: string
          control_number?: string | null
          correlation_id?: string | null
          denial_code?: string | null
          hospital_id?: string
          id?: string
          paid_amount?: number | null
          patient_responsibility?: number | null
          payer_id?: string | null
          payload_hash?: string | null
          received_at?: string
          reconciled_at?: string | null
          reconciled_by?: string | null
          status?: string
          summary?: Json
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_remittances_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_remittances_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_remittances_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_scrub_overrides: {
        Row: {
          claim_id: string
          created_at: string
          hospital_id: string
          id: string
          overridden_by: string
          rationale: string
          result_id: string
        }
        Insert: {
          claim_id: string
          created_at?: string
          hospital_id: string
          id?: string
          overridden_by: string
          rationale: string
          result_id: string
        }
        Update: {
          claim_id?: string
          created_at?: string
          hospital_id?: string
          id?: string
          overridden_by?: string
          rationale?: string
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_scrub_overrides_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_scrub_overrides_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_scrub_overrides_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: true
            referencedRelation: "claim_scrub_results"
            referencedColumns: ["id"]
          },
        ]
      }
      claim_scrub_results: {
        Row: {
          checked_at: string
          claim_id: string
          hospital_id: string
          id: string
          message: string
          rule_code: string
          severity: string
          source: string
          source_version: string
        }
        Insert: {
          checked_at?: string
          claim_id: string
          hospital_id: string
          id?: string
          message: string
          rule_code: string
          severity: string
          source: string
          source_version: string
        }
        Update: {
          checked_at?: string
          claim_id?: string
          hospital_id?: string
          id?: string
          message?: string
          rule_code?: string
          severity?: string
          source?: string
          source_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "claim_scrub_results_claim_id_fkey"
            columns: ["claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claim_scrub_results_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      claims: {
        Row: {
          acknowledged_at: string | null
          adjudicated_at: string | null
          allowed_amount: number | null
          appeal_filed_at: string | null
          appeal_notes: string | null
          appeal_status: string | null
          billing_provider_npi: string | null
          billing_type: string
          claim_type: string
          control_number: string | null
          correction_reason: string | null
          correlation_id: string | null
          coverage_id: string | null
          created_at: string
          created_by: string | null
          denial_code: string | null
          denial_reason: string | null
          encounter_id: string
          enrollment_id: string | null
          hospital_id: string
          id: string
          idempotency_key: string | null
          lock_version: number
          medical_necessity_note_id: string | null
          medical_necessity_rationale: string | null
          paid_amount: number | null
          paid_at: string | null
          patient_id: string
          patient_responsibility: number | null
          payer_id: string | null
          place_of_service: string | null
          rendering_provider_id: string
          rendering_provider_npi: string | null
          replaces_claim_id: string | null
          status: Database["public"]["Enums"]["claim_status"]
          submitted_at: string | null
          submitted_by: string | null
          submitted_hash: string | null
          submitted_snapshot: Json | null
          total_charge: number
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          adjudicated_at?: string | null
          allowed_amount?: number | null
          appeal_filed_at?: string | null
          appeal_notes?: string | null
          appeal_status?: string | null
          billing_provider_npi?: string | null
          billing_type?: string
          claim_type?: string
          control_number?: string | null
          correction_reason?: string | null
          correlation_id?: string | null
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          denial_code?: string | null
          denial_reason?: string | null
          encounter_id: string
          enrollment_id?: string | null
          hospital_id: string
          id?: string
          idempotency_key?: string | null
          lock_version?: number
          medical_necessity_note_id?: string | null
          medical_necessity_rationale?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          patient_id: string
          patient_responsibility?: number | null
          payer_id?: string | null
          place_of_service?: string | null
          rendering_provider_id: string
          rendering_provider_npi?: string | null
          replaces_claim_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_hash?: string | null
          submitted_snapshot?: Json | null
          total_charge?: number
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          adjudicated_at?: string | null
          allowed_amount?: number | null
          appeal_filed_at?: string | null
          appeal_notes?: string | null
          appeal_status?: string | null
          billing_provider_npi?: string | null
          billing_type?: string
          claim_type?: string
          control_number?: string | null
          correction_reason?: string | null
          correlation_id?: string | null
          coverage_id?: string | null
          created_at?: string
          created_by?: string | null
          denial_code?: string | null
          denial_reason?: string | null
          encounter_id?: string
          enrollment_id?: string | null
          hospital_id?: string
          id?: string
          idempotency_key?: string | null
          lock_version?: number
          medical_necessity_note_id?: string | null
          medical_necessity_rationale?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          patient_id?: string
          patient_responsibility?: number | null
          payer_id?: string | null
          place_of_service?: string | null
          rendering_provider_id?: string
          rendering_provider_npi?: string | null
          replaces_claim_id?: string | null
          status?: Database["public"]["Enums"]["claim_status"]
          submitted_at?: string | null
          submitted_by?: string | null
          submitted_hash?: string | null
          submitted_snapshot?: Json | null
          total_charge?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "claims_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "patient_insurance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "provider_payer_enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_medical_necessity_note_id_fkey"
            columns: ["medical_necessity_note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "claims_replaces_claim_id_fkey"
            columns: ["replaces_claim_id"]
            isOneToOne: false
            referencedRelation: "claims"
            referencedColumns: ["id"]
          },
        ]
      }
      clearinghouse_profiles: {
        Row: {
          capabilities: Json
          created_at: string
          environment: string
          hospital_id: string
          id: string
          last_test_at: string | null
          last_test_result: string | null
          notes: string | null
          secret_ref_names: string[]
          updated_at: string
          vendor: string
          verification_status: string
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          environment?: string
          hospital_id: string
          id?: string
          last_test_at?: string | null
          last_test_result?: string | null
          notes?: string | null
          secret_ref_names?: string[]
          updated_at?: string
          vendor: string
          verification_status?: string
        }
        Update: {
          capabilities?: Json
          created_at?: string
          environment?: string
          hospital_id?: string
          id?: string
          last_test_at?: string | null
          last_test_result?: string | null
          notes?: string | null
          secret_ref_names?: string[]
          updated_at?: string
          vendor?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "clearinghouse_profiles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_notes: {
        Row: {
          author_id: string | null
          content: Json
          content_hash: string | null
          conversation_id: string | null
          cosign_required: boolean
          cosigned_at: string | null
          cosigned_by: string | null
          created_at: string
          encounter_id: string | null
          id: string
          lock_version: number
          note_type: Database["public"]["Enums"]["note_type"]
          patient_id: string
          signed_at: string | null
          signed_by: string | null
          status: Database["public"]["Enums"]["note_status"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: Json
          content_hash?: string | null
          conversation_id?: string | null
          cosign_required?: boolean
          cosigned_at?: string | null
          cosigned_by?: string | null
          created_at?: string
          encounter_id?: string | null
          id?: string
          lock_version?: number
          note_type?: Database["public"]["Enums"]["note_type"]
          patient_id: string
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["note_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: Json
          content_hash?: string | null
          conversation_id?: string | null
          cosign_required?: boolean
          cosigned_at?: string | null
          cosigned_by?: string | null
          created_at?: string
          encounter_id?: string | null
          id?: string
          lock_version?: number
          note_type?: Database["public"]["Enums"]["note_type"]
          patient_id?: string
          signed_at?: string | null
          signed_by?: string | null
          status?: Database["public"]["Enums"]["note_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "clinical_notes_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      clinical_protocols: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          change_summary: string | null
          content: Json
          created_at: string
          created_by: string | null
          effective_end: string | null
          effective_start: string | null
          generated_by_ai: boolean
          hospital_id: string
          id: string
          kind: string
          lock_version: number
          next_review_date: string | null
          owner_user_id: string | null
          review_cadence_months: number
          scope: string | null
          service_line_id: string | null
          source_evidence: string | null
          state_code: string | null
          status: string
          supersedes_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          change_summary?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          effective_end?: string | null
          effective_start?: string | null
          generated_by_ai?: boolean
          hospital_id: string
          id?: string
          kind: string
          lock_version?: number
          next_review_date?: string | null
          owner_user_id?: string | null
          review_cadence_months?: number
          scope?: string | null
          service_line_id?: string | null
          source_evidence?: string | null
          state_code?: string | null
          status?: string
          supersedes_id?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          change_summary?: string | null
          content?: Json
          created_at?: string
          created_by?: string | null
          effective_end?: string | null
          effective_start?: string | null
          generated_by_ai?: boolean
          hospital_id?: string
          id?: string
          kind?: string
          lock_version?: number
          next_review_date?: string | null
          owner_user_id?: string | null
          review_cadence_months?: number
          scope?: string | null
          service_line_id?: string | null
          source_evidence?: string | null
          state_code?: string | null
          status?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "clinical_protocols_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocols_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "clinical_protocols_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      complaints: {
        Row: {
          acknowledged_at: string | null
          category: string
          created_at: string
          created_by: string
          hospital_id: string
          id: string
          owner_id: string | null
          patient_ref: string | null
          received_at: string
          resolution: string | null
          resolved_at: string | null
          source: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          acknowledged_at?: string | null
          category: string
          created_at?: string
          created_by: string
          hospital_id: string
          id?: string
          owner_id?: string | null
          patient_ref?: string | null
          received_at?: string
          resolution?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          acknowledged_at?: string | null
          category?: string
          created_at?: string
          created_by?: string
          hospital_id?: string
          id?: string
          owner_id?: string | null
          patient_ref?: string | null
          received_at?: string
          resolution?: string | null
          resolved_at?: string | null
          source?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "complaints_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "complaints_patient_ref_fkey"
            columns: ["patient_ref"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_assessments: {
        Row: {
          assessor_id: string | null
          assessor_org: string | null
          authority: string | null
          blocker: string | null
          created_at: string
          created_by: string | null
          evidence_hash: string | null
          evidence_ref: string | null
          expires_at: string | null
          hospital_id: string
          id: string
          lock_version: number
          requirement_id: string
          status: Database["public"]["Enums"]["compliance_status"]
          target_date: string | null
          test_method: string | null
          test_version: string | null
          tested_at: string | null
          updated_at: string
        }
        Insert: {
          assessor_id?: string | null
          assessor_org?: string | null
          authority?: string | null
          blocker?: string | null
          created_at?: string
          created_by?: string | null
          evidence_hash?: string | null
          evidence_ref?: string | null
          expires_at?: string | null
          hospital_id: string
          id?: string
          lock_version?: number
          requirement_id: string
          status?: Database["public"]["Enums"]["compliance_status"]
          target_date?: string | null
          test_method?: string | null
          test_version?: string | null
          tested_at?: string | null
          updated_at?: string
        }
        Update: {
          assessor_id?: string | null
          assessor_org?: string | null
          authority?: string | null
          blocker?: string | null
          created_at?: string
          created_by?: string | null
          evidence_hash?: string | null
          evidence_ref?: string | null
          expires_at?: string | null
          hospital_id?: string
          id?: string
          lock_version?: number
          requirement_id?: string
          status?: Database["public"]["Enums"]["compliance_status"]
          target_date?: string | null
          test_method?: string | null
          test_version?: string | null
          tested_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_assessments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_assessments_requirement_id_fkey"
            columns: ["requirement_id"]
            isOneToOne: true
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_attestations: {
        Row: {
          assessment_id: string
          attestor_id: string
          attestor_org: string | null
          attestor_role: Database["public"]["Enums"]["attestor_role"]
          created_at: string
          effective_at: string
          evidence_hash: string | null
          evidence_ref: string | null
          expires_at: string | null
          hospital_id: string
          id: string
          statement: string
        }
        Insert: {
          assessment_id: string
          attestor_id: string
          attestor_org?: string | null
          attestor_role: Database["public"]["Enums"]["attestor_role"]
          created_at?: string
          effective_at?: string
          evidence_hash?: string | null
          evidence_ref?: string | null
          expires_at?: string | null
          hospital_id: string
          id?: string
          statement: string
        }
        Update: {
          assessment_id?: string
          attestor_id?: string
          attestor_org?: string | null
          attestor_role?: Database["public"]["Enums"]["attestor_role"]
          created_at?: string
          effective_at?: string
          evidence_hash?: string | null
          evidence_ref?: string | null
          expires_at?: string | null
          hospital_id?: string
          id?: string
          statement?: string
        }
        Relationships: [
          {
            foreignKeyName: "compliance_attestations_assessment_id_fkey"
            columns: ["assessment_id"]
            isOneToOne: false
            referencedRelation: "compliance_assessments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_attestations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      compliance_requirements: {
        Row: {
          applicability: Database["public"]["Enums"]["compliance_applicability"]
          applicability_decided_at: string | null
          applicability_decided_by: string | null
          applicability_rationale: string | null
          created_at: string
          created_by: string | null
          criterion: string
          description: string | null
          domain: string
          external_dependency: boolean
          framework_ref: string
          hospital_id: string
          id: string
          owner_user_id: string | null
          retired: boolean
          supersedes_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          applicability?: Database["public"]["Enums"]["compliance_applicability"]
          applicability_decided_at?: string | null
          applicability_decided_by?: string | null
          applicability_rationale?: string | null
          created_at?: string
          created_by?: string | null
          criterion: string
          description?: string | null
          domain: string
          external_dependency?: boolean
          framework_ref: string
          hospital_id: string
          id?: string
          owner_user_id?: string | null
          retired?: boolean
          supersedes_id?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          applicability?: Database["public"]["Enums"]["compliance_applicability"]
          applicability_decided_at?: string | null
          applicability_decided_by?: string | null
          applicability_rationale?: string | null
          created_at?: string
          created_by?: string | null
          criterion?: string
          description?: string | null
          domain?: string
          external_dependency?: boolean
          framework_ref?: string
          hospital_id?: string
          id?: string
          owner_user_id?: string | null
          retired?: boolean
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "compliance_requirements_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "compliance_requirements_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "compliance_requirements"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_documents: {
        Row: {
          approved_at: string | null
          approved_by: string | null
          body_hash: string
          change_summary: string | null
          created_at: string
          created_by: string | null
          effective_end: string | null
          effective_start: string | null
          hospital_id: string
          id: string
          jurisdiction_state_code: string | null
          lock_version: number
          next_review_date: string | null
          owner_user_id: string | null
          purpose: string
          review_cadence_months: number
          service_line_id: string | null
          source_evidence: string | null
          status: string
          supersedes_id: string | null
          title: string
          updated_at: string
          version: number
        }
        Insert: {
          approved_at?: string | null
          approved_by?: string | null
          body_hash: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          effective_end?: string | null
          effective_start?: string | null
          hospital_id: string
          id?: string
          jurisdiction_state_code?: string | null
          lock_version?: number
          next_review_date?: string | null
          owner_user_id?: string | null
          purpose: string
          review_cadence_months?: number
          service_line_id?: string | null
          source_evidence?: string | null
          status?: string
          supersedes_id?: string | null
          title: string
          updated_at?: string
          version?: number
        }
        Update: {
          approved_at?: string | null
          approved_by?: string | null
          body_hash?: string
          change_summary?: string | null
          created_at?: string
          created_by?: string | null
          effective_end?: string | null
          effective_start?: string | null
          hospital_id?: string
          id?: string
          jurisdiction_state_code?: string | null
          lock_version?: number
          next_review_date?: string | null
          owner_user_id?: string | null
          purpose?: string
          review_cadence_months?: number
          service_line_id?: string | null
          source_evidence?: string | null
          status?: string
          supersedes_id?: string | null
          title?: string
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "consent_documents_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_documents_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_documents_supersedes_id_fkey"
            columns: ["supersedes_id"]
            isOneToOne: false
            referencedRelation: "consent_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      consent_records: {
        Row: {
          accepted_at: string | null
          consent_document_id: string
          created_at: string
          created_by: string | null
          declined_at: string | null
          evidence_hash: string
          hospital_id: string
          id: string
          method: string
          patient_id: string
          presented_at: string
          purpose: string
          signer_name: string | null
          signer_relationship: string
          updated_at: string
          withdrawal_reason: string | null
          withdrawn_at: string | null
        }
        Insert: {
          accepted_at?: string | null
          consent_document_id: string
          created_at?: string
          created_by?: string | null
          declined_at?: string | null
          evidence_hash: string
          hospital_id: string
          id?: string
          method?: string
          patient_id: string
          presented_at?: string
          purpose: string
          signer_name?: string | null
          signer_relationship?: string
          updated_at?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Update: {
          accepted_at?: string | null
          consent_document_id?: string
          created_at?: string
          created_by?: string | null
          declined_at?: string | null
          evidence_hash?: string
          hospital_id?: string
          id?: string
          method?: string
          patient_id?: string
          presented_at?: string
          purpose?: string
          signer_name?: string | null
          signer_relationship?: string
          updated_at?: string
          withdrawal_reason?: string | null
          withdrawn_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "consent_records_consent_document_id_fkey"
            columns: ["consent_document_id"]
            isOneToOne: false
            referencedRelation: "consent_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consent_records_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      consult_requests: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          channel_id: string | null
          consultant_id: string | null
          created_at: string
          hospital_id: string
          id: string
          patient_id: string
          reason: string
          requesting_user_id: string
          response_time_minutes: number | null
          specialty: string
          status: Database["public"]["Enums"]["consult_status"]
          updated_at: string
          urgency: Database["public"]["Enums"]["consult_urgency"]
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          channel_id?: string | null
          consultant_id?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          patient_id: string
          reason: string
          requesting_user_id: string
          response_time_minutes?: number | null
          specialty: string
          status?: Database["public"]["Enums"]["consult_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["consult_urgency"]
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          channel_id?: string | null
          consultant_id?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          patient_id?: string
          reason?: string
          requesting_user_id?: string
          response_time_minutes?: number | null
          specialty?: string
          status?: Database["public"]["Enums"]["consult_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["consult_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "consult_requests_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consult_requests_consultant_id_fkey"
            columns: ["consultant_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consult_requests_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consult_requests_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      consultants: {
        Row: {
          avatar_url: string | null
          created_at: string
          hospital_id: string
          id: string
          name: string
          on_call_status: boolean | null
          pager: string | null
          phone: string | null
          specialty: string
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          name: string
          on_call_status?: boolean | null
          pager?: string | null
          phone?: string | null
          specialty: string
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          name?: string
          on_call_status?: boolean | null
          pager?: string | null
          phone?: string | null
          specialty?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultants_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          metadata: Json | null
          sender_id: string
          sender_role: Database["public"]["Enums"]["consultation_sender_role"]
          thread_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender_id: string
          sender_role: Database["public"]["Enums"]["consultation_sender_role"]
          thread_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          metadata?: Json | null
          sender_id?: string
          sender_role?: Database["public"]["Enums"]["consultation_sender_role"]
          thread_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_messages_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "consultation_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_notes: {
        Row: {
          clinical_summary: string | null
          consultation_question: string | null
          created_at: string
          created_by: string | null
          generated_by: string
          id: string
          patient_id: string
          signed_at: string | null
          signed_by: string | null
          specialist_recommendation: string | null
          status: Database["public"]["Enums"]["note_status"]
          thread_id: string
          treatment_plan: string | null
          updated_at: string
        }
        Insert: {
          clinical_summary?: string | null
          consultation_question?: string | null
          created_at?: string
          created_by?: string | null
          generated_by?: string
          id?: string
          patient_id: string
          signed_at?: string | null
          signed_by?: string | null
          specialist_recommendation?: string | null
          status?: Database["public"]["Enums"]["note_status"]
          thread_id: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Update: {
          clinical_summary?: string | null
          consultation_question?: string | null
          created_at?: string
          created_by?: string | null
          generated_by?: string
          id?: string
          patient_id?: string
          signed_at?: string | null
          signed_by?: string | null
          specialist_recommendation?: string | null
          status?: Database["public"]["Enums"]["note_status"]
          thread_id?: string
          treatment_plan?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_notes_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_notes_thread_id_fkey"
            columns: ["thread_id"]
            isOneToOne: false
            referencedRelation: "consultation_threads"
            referencedColumns: ["id"]
          },
        ]
      }
      consultation_threads: {
        Row: {
          ai_participant_id: string
          consult_request_id: string | null
          created_at: string
          hospital_id: string
          id: string
          patient_id: string
          primary_clinician_id: string
          reason: string
          shared_context: Json
          specialist_id: string | null
          specialty: string
          status: Database["public"]["Enums"]["consultation_thread_status"]
          updated_at: string
        }
        Insert: {
          ai_participant_id?: string
          consult_request_id?: string | null
          created_at?: string
          hospital_id: string
          id?: string
          patient_id: string
          primary_clinician_id: string
          reason: string
          shared_context?: Json
          specialist_id?: string | null
          specialty: string
          status?: Database["public"]["Enums"]["consultation_thread_status"]
          updated_at?: string
        }
        Update: {
          ai_participant_id?: string
          consult_request_id?: string | null
          created_at?: string
          hospital_id?: string
          id?: string
          patient_id?: string
          primary_clinician_id?: string
          reason?: string
          shared_context?: Json
          specialist_id?: string | null
          specialty?: string
          status?: Database["public"]["Enums"]["consultation_thread_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "consultation_threads_consult_request_id_fkey"
            columns: ["consult_request_id"]
            isOneToOne: false
            referencedRelation: "consult_requests"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_threads_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_threads_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "consultation_threads_specialist_id_fkey"
            columns: ["specialist_id"]
            isOneToOne: false
            referencedRelation: "consultants"
            referencedColumns: ["id"]
          },
        ]
      }
      continuity_exercises: {
        Row: {
          created_at: string
          findings: string | null
          hospital_id: string
          id: string
          kind: string
          next_due_date: string | null
          performed_at: string
          performed_by: string
          result: string
          rpo_minutes: number | null
          rto_minutes: number | null
        }
        Insert: {
          created_at?: string
          findings?: string | null
          hospital_id: string
          id?: string
          kind: string
          next_due_date?: string | null
          performed_at?: string
          performed_by: string
          result: string
          rpo_minutes?: number | null
          rto_minutes?: number | null
        }
        Update: {
          created_at?: string
          findings?: string | null
          hospital_id?: string
          id?: string
          kind?: string
          next_due_date?: string | null
          performed_at?: string
          performed_by?: string
          result?: string
          rpo_minutes?: number | null
          rto_minutes?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "continuity_exercises_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      conversations: {
        Row: {
          created_at: string
          hospital_id: string | null
          id: string
          is_ai_mode: boolean | null
          patient_id: string | null
          title: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          hospital_id?: string | null
          id?: string
          is_ai_mode?: boolean | null
          patient_id?: string | null
          title?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          hospital_id?: string | null
          id?: string
          is_ai_mode?: boolean | null
          patient_id?: string | null
          title?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "conversations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_order_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_code: string
          from_status: string | null
          hospital_id: string
          id: string
          metadata: Json
          order_id: string
          patient_id: string
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_code: string
          from_status?: string | null
          hospital_id: string
          id?: string
          metadata?: Json
          order_id: string
          patient_id: string
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_code?: string
          from_status?: string | null
          hospital_id?: string
          id?: string
          metadata?: Json
          order_id?: string
          patient_id?: string
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_order_events_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_orders"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_orders: {
        Row: {
          body_site: string | null
          clinical_indication: string | null
          code: string
          code_system: string
          code_version: string | null
          correlation_id: string | null
          created_at: string
          created_by: string | null
          display: string
          encounter_id: string | null
          error_code: string | null
          filler_order_number: string | null
          hospital_id: string
          id: string
          idempotency_key: string | null
          kind: Database["public"]["Enums"]["diagnostic_kind"]
          lock_version: number
          message_profile: string | null
          modality: string | null
          ordering_provider_id: string
          patient_id: string
          payload_hash: string | null
          placer_order_number: string | null
          priority: string
          signed_snapshot: Json | null
          staged_order_id: string | null
          status: Database["public"]["Enums"]["diagnostic_order_status"]
          transmitted_at: string | null
          updated_at: string
          vendor_profile_id: string | null
        }
        Insert: {
          body_site?: string | null
          clinical_indication?: string | null
          code: string
          code_system: string
          code_version?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          display: string
          encounter_id?: string | null
          error_code?: string | null
          filler_order_number?: string | null
          hospital_id: string
          id?: string
          idempotency_key?: string | null
          kind: Database["public"]["Enums"]["diagnostic_kind"]
          lock_version?: number
          message_profile?: string | null
          modality?: string | null
          ordering_provider_id: string
          patient_id: string
          payload_hash?: string | null
          placer_order_number?: string | null
          priority?: string
          signed_snapshot?: Json | null
          staged_order_id?: string | null
          status?: Database["public"]["Enums"]["diagnostic_order_status"]
          transmitted_at?: string | null
          updated_at?: string
          vendor_profile_id?: string | null
        }
        Update: {
          body_site?: string | null
          clinical_indication?: string | null
          code?: string
          code_system?: string
          code_version?: string | null
          correlation_id?: string | null
          created_at?: string
          created_by?: string | null
          display?: string
          encounter_id?: string | null
          error_code?: string | null
          filler_order_number?: string | null
          hospital_id?: string
          id?: string
          idempotency_key?: string | null
          kind?: Database["public"]["Enums"]["diagnostic_kind"]
          lock_version?: number
          message_profile?: string | null
          modality?: string | null
          ordering_provider_id?: string
          patient_id?: string
          payload_hash?: string | null
          placer_order_number?: string | null
          priority?: string
          signed_snapshot?: Json | null
          staged_order_id?: string | null
          status?: Database["public"]["Enums"]["diagnostic_order_status"]
          transmitted_at?: string | null
          updated_at?: string
          vendor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_orders_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_orders_staged_order_id_fkey"
            columns: ["staged_order_id"]
            isOneToOne: false
            referencedRelation: "staged_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_orders_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_result_versions: {
        Row: {
          amendment_reason: string | null
          content_hash: string
          created_at: string
          hospital_id: string
          id: string
          patient_id: string
          result_id: string
          snapshot: Json
          source_system: string | null
          status: Database["public"]["Enums"]["diagnostic_result_status"]
          version: number
        }
        Insert: {
          amendment_reason?: string | null
          content_hash: string
          created_at?: string
          hospital_id: string
          id?: string
          patient_id: string
          result_id: string
          snapshot: Json
          source_system?: string | null
          status: Database["public"]["Enums"]["diagnostic_result_status"]
          version: number
        }
        Update: {
          amendment_reason?: string | null
          content_hash?: string
          created_at?: string
          hospital_id?: string
          id?: string
          patient_id?: string
          result_id?: string
          snapshot?: Json
          source_system?: string | null
          status?: Database["public"]["Enums"]["diagnostic_result_status"]
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_result_versions_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_results"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_results: {
        Row: {
          acknowledged_at: string | null
          acknowledged_by: string | null
          code: string
          code_system: string
          code_version: string | null
          created_at: string
          dicomweb_study_ref: string | null
          display: string
          escalation_level: number
          hospital_id: string
          id: string
          imaging_study_id: string | null
          interpretation: string | null
          is_abnormal: boolean
          is_critical: boolean
          kind: Database["public"]["Enums"]["diagnostic_kind"]
          lab_result_id: string | null
          observed_at: string | null
          order_id: string | null
          patient_id: string
          patient_release_status: string
          payload_hash: string | null
          provenance: Json
          reference_range: string | null
          released_at: string | null
          released_by: string | null
          reported_at: string
          sensitive_category: string | null
          signature_verified: boolean
          source_system: string
          source_version: string | null
          status: Database["public"]["Enums"]["diagnostic_result_status"]
          study_instance_uid: string | null
          unit: string | null
          updated_at: string
          value_text: string | null
          version: number
        }
        Insert: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          code: string
          code_system: string
          code_version?: string | null
          created_at?: string
          dicomweb_study_ref?: string | null
          display: string
          escalation_level?: number
          hospital_id: string
          id?: string
          imaging_study_id?: string | null
          interpretation?: string | null
          is_abnormal?: boolean
          is_critical?: boolean
          kind: Database["public"]["Enums"]["diagnostic_kind"]
          lab_result_id?: string | null
          observed_at?: string | null
          order_id?: string | null
          patient_id: string
          patient_release_status?: string
          payload_hash?: string | null
          provenance?: Json
          reference_range?: string | null
          released_at?: string | null
          released_by?: string | null
          reported_at?: string
          sensitive_category?: string | null
          signature_verified?: boolean
          source_system: string
          source_version?: string | null
          status?: Database["public"]["Enums"]["diagnostic_result_status"]
          study_instance_uid?: string | null
          unit?: string | null
          updated_at?: string
          value_text?: string | null
          version?: number
        }
        Update: {
          acknowledged_at?: string | null
          acknowledged_by?: string | null
          code?: string
          code_system?: string
          code_version?: string | null
          created_at?: string
          dicomweb_study_ref?: string | null
          display?: string
          escalation_level?: number
          hospital_id?: string
          id?: string
          imaging_study_id?: string | null
          interpretation?: string | null
          is_abnormal?: boolean
          is_critical?: boolean
          kind?: Database["public"]["Enums"]["diagnostic_kind"]
          lab_result_id?: string | null
          observed_at?: string | null
          order_id?: string | null
          patient_id?: string
          patient_release_status?: string
          payload_hash?: string | null
          provenance?: Json
          reference_range?: string | null
          released_at?: string | null
          released_by?: string | null
          reported_at?: string
          sensitive_category?: string | null
          signature_verified?: boolean
          source_system?: string
          source_version?: string | null
          status?: Database["public"]["Enums"]["diagnostic_result_status"]
          study_instance_uid?: string | null
          unit?: string | null
          updated_at?: string
          value_text?: string | null
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_results_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_results_imaging_study_id_fkey"
            columns: ["imaging_study_id"]
            isOneToOne: false
            referencedRelation: "imaging_studies"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_results_lab_result_id_fkey"
            columns: ["lab_result_id"]
            isOneToOne: false
            referencedRelation: "lab_results"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_results_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "diagnostic_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      diagnostic_vendor_profiles: {
        Row: {
          capabilities: Json
          created_at: string
          created_by: string | null
          environment: string
          hospital_id: string
          id: string
          kind: string
          last_test_at: string | null
          last_test_result: string | null
          notes: string | null
          secret_ref_names: string[]
          standards: Json
          updated_at: string
          vendor: string
          verification_status: string
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          created_by?: string | null
          environment?: string
          hospital_id: string
          id?: string
          kind: string
          last_test_at?: string | null
          last_test_result?: string | null
          notes?: string | null
          secret_ref_names?: string[]
          standards?: Json
          updated_at?: string
          vendor: string
          verification_status?: string
        }
        Update: {
          capabilities?: Json
          created_at?: string
          created_by?: string | null
          environment?: string
          hospital_id?: string
          id?: string
          kind?: string
          last_test_at?: string | null
          last_test_result?: string | null
          notes?: string | null
          secret_ref_names?: string[]
          standards?: Json
          updated_at?: string
          vendor?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "diagnostic_vendor_profiles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_conversations: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          participant_1: string
          participant_2: string
          patient_id: string | null
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          participant_1: string
          participant_2: string
          patient_id?: string | null
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          participant_1?: string
          participant_2?: string
          patient_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "direct_conversations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "direct_conversations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      direct_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          is_read: boolean
          read_at: string | null
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
          read_at?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direct_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "direct_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      eligibility_checks: {
        Row: {
          coinsurance_percent: number | null
          control_number: string
          copay_amount: number | null
          correlation_id: string
          coverage_active: boolean | null
          coverage_id: string | null
          deductible_remaining: number | null
          encounter_id: string | null
          hospital_id: string
          id: string
          patient_id: string
          payer_id: string | null
          payload_hash: string | null
          plan_summary: Json
          requested_at: string
          requested_by: string
          responded_at: string | null
          response_code: string | null
          service_date: string | null
          status: string
          transaction_type: string
        }
        Insert: {
          coinsurance_percent?: number | null
          control_number: string
          copay_amount?: number | null
          correlation_id: string
          coverage_active?: boolean | null
          coverage_id?: string | null
          deductible_remaining?: number | null
          encounter_id?: string | null
          hospital_id: string
          id?: string
          patient_id: string
          payer_id?: string | null
          payload_hash?: string | null
          plan_summary?: Json
          requested_at?: string
          requested_by: string
          responded_at?: string | null
          response_code?: string | null
          service_date?: string | null
          status?: string
          transaction_type?: string
        }
        Update: {
          coinsurance_percent?: number | null
          control_number?: string
          copay_amount?: number | null
          correlation_id?: string
          coverage_active?: boolean | null
          coverage_id?: string | null
          deductible_remaining?: number | null
          encounter_id?: string | null
          hospital_id?: string
          id?: string
          patient_id?: string
          payer_id?: string | null
          payload_hash?: string | null
          plan_summary?: Json
          requested_at?: string
          requested_by?: string
          responded_at?: string | null
          response_code?: string | null
          service_date?: string | null
          status?: string
          transaction_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "eligibility_checks_coverage_id_fkey"
            columns: ["coverage_id"]
            isOneToOne: false
            referencedRelation: "patient_insurance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "eligibility_checks_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_cash_pay: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          encounter_id: string
          fee_reference: string
          hospital_id: string
          id: string
          patient_id: string
          payment_reference: string | null
          payment_status: string
          processor: string
          receipt_status: string
          recorded_by: string | null
          refund_status: string
          service_line_id: string | null
          settled_at: string | null
          updated_at: string
          waived_at: string | null
          waived_by: string | null
          waiver_reason: string | null
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          encounter_id: string
          fee_reference: string
          hospital_id: string
          id?: string
          patient_id: string
          payment_reference?: string | null
          payment_status?: string
          processor?: string
          receipt_status?: string
          recorded_by?: string | null
          refund_status?: string
          service_line_id?: string | null
          settled_at?: string | null
          updated_at?: string
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          encounter_id?: string
          fee_reference?: string
          hospital_id?: string
          id?: string
          patient_id?: string
          payment_reference?: string | null
          payment_status?: string
          processor?: string
          receipt_status?: string
          recorded_by?: string | null
          refund_status?: string
          service_line_id?: string | null
          settled_at?: string | null
          updated_at?: string
          waived_at?: string | null
          waived_by?: string | null
          waiver_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_cash_pay_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: true
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_cash_pay_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_cash_pay_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_cash_pay_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_diagnoses: {
        Row: {
          code_set: string
          code_version: string
          created_at: string
          created_by: string | null
          description: string
          encounter_id: string
          hospital_id: string
          icd10_code: string
          id: string
          patient_id: string
          rank: number
          updated_at: string
        }
        Insert: {
          code_set?: string
          code_version?: string
          created_at?: string
          created_by?: string | null
          description: string
          encounter_id: string
          hospital_id: string
          icd10_code: string
          id?: string
          patient_id: string
          rank?: number
          updated_at?: string
        }
        Update: {
          code_set?: string
          code_version?: string
          created_at?: string
          created_by?: string | null
          description?: string
          encounter_id?: string
          hospital_id?: string
          icd10_code?: string
          id?: string
          patient_id?: string
          rank?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "encounter_diagnoses_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_diagnoses_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounter_diagnoses_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      encounter_events: {
        Row: {
          actor_id: string | null
          created_at: string
          encounter_id: string
          event_code: string
          from_status: string | null
          hospital_id: string
          id: string
          metadata: Json
          patient_id: string
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          encounter_id: string
          event_code: string
          from_status?: string | null
          hospital_id: string
          id?: string
          metadata?: Json
          patient_id: string
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          encounter_id?: string
          event_code?: string
          from_status?: string | null
          hospital_id?: string
          id?: string
          metadata?: Json
          patient_id?: string
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounter_events_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
        ]
      }
      encounters: {
        Row: {
          allergy_review_at: string | null
          allergy_review_by: string | null
          billing_event_id: string | null
          callback_phone: string | null
          callback_verified_at: string | null
          check_in_at: string | null
          check_out_at: string | null
          chief_complaint: string | null
          completed_at: string | null
          completed_by: string | null
          consent_accepted_at: string | null
          consent_method: string | null
          consent_recorded_by: string | null
          consent_version: string | null
          created_at: string
          disposition: string | null
          duration_minutes: number | null
          encounter_type: Database["public"]["Enums"]["encounter_type"]
          follow_up_instructions: string | null
          hospital_id: string
          id: string
          identity_verification_method: string | null
          identity_verified_at: string | null
          identity_verified_by: string | null
          lock_version: number
          med_rec_by: string | null
          med_rec_completed_at: string | null
          patient_address_text: string | null
          patient_country: string | null
          patient_id: string
          patient_state_code: string | null
          provider_authorization_id: string | null
          provider_authorization_snapshot: Json | null
          provider_id: string
          room_number: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["encounter_status"]
          updated_at: string
          visit_reason: string | null
        }
        Insert: {
          allergy_review_at?: string | null
          allergy_review_by?: string | null
          billing_event_id?: string | null
          callback_phone?: string | null
          callback_verified_at?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          chief_complaint?: string | null
          completed_at?: string | null
          completed_by?: string | null
          consent_accepted_at?: string | null
          consent_method?: string | null
          consent_recorded_by?: string | null
          consent_version?: string | null
          created_at?: string
          disposition?: string | null
          duration_minutes?: number | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"]
          follow_up_instructions?: string | null
          hospital_id: string
          id?: string
          identity_verification_method?: string | null
          identity_verified_at?: string | null
          identity_verified_by?: string | null
          lock_version?: number
          med_rec_by?: string | null
          med_rec_completed_at?: string | null
          patient_address_text?: string | null
          patient_country?: string | null
          patient_id: string
          patient_state_code?: string | null
          provider_authorization_id?: string | null
          provider_authorization_snapshot?: Json | null
          provider_id: string
          room_number?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["encounter_status"]
          updated_at?: string
          visit_reason?: string | null
        }
        Update: {
          allergy_review_at?: string | null
          allergy_review_by?: string | null
          billing_event_id?: string | null
          callback_phone?: string | null
          callback_verified_at?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          chief_complaint?: string | null
          completed_at?: string | null
          completed_by?: string | null
          consent_accepted_at?: string | null
          consent_method?: string | null
          consent_recorded_by?: string | null
          consent_version?: string | null
          created_at?: string
          disposition?: string | null
          duration_minutes?: number | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"]
          follow_up_instructions?: string | null
          hospital_id?: string
          id?: string
          identity_verification_method?: string | null
          identity_verified_at?: string | null
          identity_verified_by?: string | null
          lock_version?: number
          med_rec_by?: string | null
          med_rec_completed_at?: string | null
          patient_address_text?: string | null
          patient_country?: string | null
          patient_id?: string
          patient_state_code?: string | null
          provider_authorization_id?: string | null
          provider_authorization_snapshot?: Json | null
          provider_id?: string
          room_number?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["encounter_status"]
          updated_at?: string
          visit_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "encounters_billing_event_id_fkey"
            columns: ["billing_event_id"]
            isOneToOne: false
            referencedRelation: "billing_events"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "encounters_provider_authorization_id_fkey"
            columns: ["provider_authorization_id"]
            isOneToOne: false
            referencedRelation: "provider_licenses"
            referencedColumns: ["id"]
          },
        ]
      }
      erx_inbox: {
        Row: {
          correlation_id: string | null
          error_code: string | null
          event_id: string
          hospital_id: string | null
          id: string
          message_type: string
          payload_hash: string
          received_at: string
          signature_verified: boolean
          status: string
          vendor_reference: string | null
        }
        Insert: {
          correlation_id?: string | null
          error_code?: string | null
          event_id: string
          hospital_id?: string | null
          id?: string
          message_type: string
          payload_hash: string
          received_at?: string
          signature_verified?: boolean
          status?: string
          vendor_reference?: string | null
        }
        Update: {
          correlation_id?: string | null
          error_code?: string | null
          event_id?: string
          hospital_id?: string | null
          id?: string
          message_type?: string
          payload_hash?: string
          received_at?: string
          signature_verified?: boolean
          status?: string
          vendor_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erx_inbox_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      erx_integration_profiles: {
        Row: {
          capabilities: Json
          created_at: string
          environment: string
          epcs_enabled: boolean
          hospital_id: string
          id: string
          last_test_at: string | null
          last_test_result: string | null
          notes: string | null
          secret_ref_names: string[]
          updated_at: string
          vendor: string
          verification_status: string
        }
        Insert: {
          capabilities?: Json
          created_at?: string
          environment?: string
          epcs_enabled?: boolean
          hospital_id: string
          id?: string
          last_test_at?: string | null
          last_test_result?: string | null
          notes?: string | null
          secret_ref_names?: string[]
          updated_at?: string
          vendor: string
          verification_status?: string
        }
        Update: {
          capabilities?: Json
          created_at?: string
          environment?: string
          epcs_enabled?: boolean
          hospital_id?: string
          id?: string
          last_test_at?: string | null
          last_test_result?: string | null
          notes?: string | null
          secret_ref_names?: string[]
          updated_at?: string
          vendor?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "erx_integration_profiles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      erx_outbox: {
        Row: {
          correlation_id: string
          created_at: string
          error_code: string | null
          event_id: string
          hospital_id: string
          id: string
          message_type: string
          payload_hash: string
          prescription_id: string
          retry_count: number
          script_version: string
          status: string
          updated_at: string
          vendor_reference: string | null
        }
        Insert: {
          correlation_id: string
          created_at?: string
          error_code?: string | null
          event_id: string
          hospital_id: string
          id?: string
          message_type: string
          payload_hash: string
          prescription_id: string
          retry_count?: number
          script_version?: string
          status?: string
          updated_at?: string
          vendor_reference?: string | null
        }
        Update: {
          correlation_id?: string
          created_at?: string
          error_code?: string | null
          event_id?: string
          hospital_id?: string
          id?: string
          message_type?: string
          payload_hash?: string
          prescription_id?: string
          retry_count?: number
          script_version?: string
          status?: string
          updated_at?: string
          vendor_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "erx_outbox_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "erx_outbox_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      external_record_staging: {
        Row: {
          accepted_target_id: string | null
          accepted_target_table: string | null
          candidate_patient_id: string | null
          consent_basis: string
          created_at: string
          fhir_profile: string | null
          hospital_id: string
          id: string
          match_basis: Json
          match_confidence: number
          patient_id: string | null
          payload_hash: string
          provenance: Json
          resource_type: string
          review_reason: string | null
          reviewed_at: string | null
          reviewed_by: string | null
          signature_verified: boolean
          source_system: string
          source_version: string | null
          status: Database["public"]["Enums"]["record_staging_status"]
          summary: Json
          updated_at: string
        }
        Insert: {
          accepted_target_id?: string | null
          accepted_target_table?: string | null
          candidate_patient_id?: string | null
          consent_basis: string
          created_at?: string
          fhir_profile?: string | null
          hospital_id: string
          id?: string
          match_basis?: Json
          match_confidence?: number
          patient_id?: string | null
          payload_hash: string
          provenance?: Json
          resource_type: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_verified?: boolean
          source_system: string
          source_version?: string | null
          status?: Database["public"]["Enums"]["record_staging_status"]
          summary?: Json
          updated_at?: string
        }
        Update: {
          accepted_target_id?: string | null
          accepted_target_table?: string | null
          candidate_patient_id?: string | null
          consent_basis?: string
          created_at?: string
          fhir_profile?: string | null
          hospital_id?: string
          id?: string
          match_basis?: Json
          match_confidence?: number
          patient_id?: string | null
          payload_hash?: string
          provenance?: Json
          resource_type?: string
          review_reason?: string | null
          reviewed_at?: string | null
          reviewed_by?: string | null
          signature_verified?: boolean
          source_system?: string
          source_version?: string | null
          status?: Database["public"]["Enums"]["record_staging_status"]
          summary?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "external_record_staging_candidate_patient_id_fkey"
            columns: ["candidate_patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_record_staging_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "external_record_staging_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      fee_schedule: {
        Row: {
          active: boolean
          amount: number
          code: string
          code_type: string
          created_at: string
          description: string
          hospital_id: string
          id: string
          modifier: string | null
          updated_at: string
        }
        Insert: {
          active?: boolean
          amount: number
          code: string
          code_type?: string
          created_at?: string
          description: string
          hospital_id: string
          id?: string
          modifier?: string | null
          updated_at?: string
        }
        Update: {
          active?: boolean
          amount?: number
          code?: string
          code_type?: string
          created_at?: string
          description?: string
          hospital_id?: string
          id?: string
          modifier?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "fee_schedule_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      fhir_resources: {
        Row: {
          created_at: string
          hospital_id: string | null
          id: string
          patient_id: string | null
          payload: Json
          resource_id: string
          resource_type: string
          source: string
        }
        Insert: {
          created_at?: string
          hospital_id?: string | null
          id?: string
          patient_id?: string | null
          payload: Json
          resource_id: string
          resource_type: string
          source?: string
        }
        Update: {
          created_at?: string
          hospital_id?: string | null
          id?: string
          patient_id?: string | null
          payload?: Json
          resource_id?: string
          resource_type?: string
          source?: string
        }
        Relationships: []
      }
      governance_approvals: {
        Row: {
          approver_id: string
          approver_role: string
          created_at: string
          decision: string
          hospital_id: string
          id: string
          rationale: string
          subject_id: string
          subject_type: string
        }
        Insert: {
          approver_id: string
          approver_role: string
          created_at?: string
          decision: string
          hospital_id: string
          id?: string
          rationale: string
          subject_id: string
          subject_type: string
        }
        Update: {
          approver_id?: string
          approver_role?: string
          created_at?: string
          decision?: string
          hospital_id?: string
          id?: string
          rationale?: string
          subject_id?: string
          subject_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_approvals_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      governance_roles: {
        Row: {
          granted_at: string
          granted_by: string | null
          hospital_id: string
          id: string
          revoked_at: string | null
          role: string
          user_id: string
        }
        Insert: {
          granted_at?: string
          granted_by?: string | null
          hospital_id: string
          id?: string
          revoked_at?: string | null
          role: string
          user_id: string
        }
        Update: {
          granted_at?: string
          granted_by?: string | null
          hospital_id?: string
          id?: string
          revoked_at?: string | null
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "governance_roles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospital_users: {
        Row: {
          access_level: string
          created_at: string
          hospital_id: string
          id: string
          user_id: string
        }
        Insert: {
          access_level?: string
          created_at?: string
          hospital_id: string
          id?: string
          user_id: string
        }
        Update: {
          access_level?: string
          created_at?: string
          hospital_id?: string
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "hospital_users_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      hospitals: {
        Row: {
          address: string | null
          code: string
          connection_status: string | null
          created_at: string
          emr_system: Database["public"]["Enums"]["emr_system"]
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          address?: string | null
          code: string
          connection_status?: string | null
          created_at?: string
          emr_system: Database["public"]["Enums"]["emr_system"]
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          address?: string | null
          code?: string
          connection_status?: string | null
          created_at?: string
          emr_system?: Database["public"]["Enums"]["emr_system"]
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      identity_verification_profiles: {
        Row: {
          assurance_level: string
          capabilities: Json
          created_at: string
          environment: string
          hospital_id: string
          id: string
          last_test_at: string | null
          last_test_result: string | null
          secret_ref_names: string[]
          updated_at: string
          vendor: string
          verification_status: string
        }
        Insert: {
          assurance_level?: string
          capabilities?: Json
          created_at?: string
          environment?: string
          hospital_id: string
          id?: string
          last_test_at?: string | null
          last_test_result?: string | null
          secret_ref_names?: string[]
          updated_at?: string
          vendor: string
          verification_status?: string
        }
        Update: {
          assurance_level?: string
          capabilities?: Json
          created_at?: string
          environment?: string
          hospital_id?: string
          id?: string
          last_test_at?: string | null
          last_test_result?: string | null
          secret_ref_names?: string[]
          updated_at?: string
          vendor?: string
          verification_status?: string
        }
        Relationships: [
          {
            foreignKeyName: "identity_verification_profiles_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      identity_verifications: {
        Row: {
          assurance_level: string
          created_at: string
          created_by: string | null
          exception_reason: string | null
          expires_at: string | null
          hospital_id: string
          id: string
          metadata: Json
          patient_id: string | null
          profile_id: string | null
          reference_id: string | null
          result: string
          reviewer_id: string | null
          subject_type: string
          subject_user_id: string | null
          verified_at: string | null
        }
        Insert: {
          assurance_level?: string
          created_at?: string
          created_by?: string | null
          exception_reason?: string | null
          expires_at?: string | null
          hospital_id: string
          id?: string
          metadata?: Json
          patient_id?: string | null
          profile_id?: string | null
          reference_id?: string | null
          result: string
          reviewer_id?: string | null
          subject_type: string
          subject_user_id?: string | null
          verified_at?: string | null
        }
        Update: {
          assurance_level?: string
          created_at?: string
          created_by?: string | null
          exception_reason?: string | null
          expires_at?: string | null
          hospital_id?: string
          id?: string
          metadata?: Json
          patient_id?: string | null
          profile_id?: string | null
          reference_id?: string | null
          result?: string
          reviewer_id?: string | null
          subject_type?: string
          subject_user_id?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "identity_verifications_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "identity_verifications_profile_id_fkey"
            columns: ["profile_id"]
            isOneToOne: false
            referencedRelation: "identity_verification_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      imaging_studies: {
        Row: {
          accession_number: string | null
          body_part: string | null
          created_at: string
          dicomweb_study_ref: string | null
          id: string
          impression: string | null
          instance_count: number | null
          modality: string | null
          patient_id: string
          reading_radiologist: string | null
          report_text: string | null
          series_count: number | null
          status: string
          study_date: string
          study_instance_uid: string | null
          study_type: string
          updated_at: string
          viewer_url: string | null
        }
        Insert: {
          accession_number?: string | null
          body_part?: string | null
          created_at?: string
          dicomweb_study_ref?: string | null
          id?: string
          impression?: string | null
          instance_count?: number | null
          modality?: string | null
          patient_id: string
          reading_radiologist?: string | null
          report_text?: string | null
          series_count?: number | null
          status?: string
          study_date?: string
          study_instance_uid?: string | null
          study_type: string
          updated_at?: string
          viewer_url?: string | null
        }
        Update: {
          accession_number?: string | null
          body_part?: string | null
          created_at?: string
          dicomweb_study_ref?: string | null
          id?: string
          impression?: string | null
          instance_count?: number | null
          modality?: string | null
          patient_id?: string
          reading_radiologist?: string | null
          report_text?: string | null
          series_count?: number | null
          status?: string
          study_date?: string
          study_instance_uid?: string | null
          study_type?: string
          updated_at?: string
          viewer_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "imaging_studies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      immunizations: {
        Row: {
          administered_by: string | null
          administered_date: string
          created_at: string
          cvx_code: string | null
          id: string
          lot_number: string | null
          manufacturer: string | null
          next_due_date: string | null
          patient_id: string
          route: string | null
          site: string | null
          updated_at: string
          vaccine_name: string
        }
        Insert: {
          administered_by?: string | null
          administered_date?: string
          created_at?: string
          cvx_code?: string | null
          id?: string
          lot_number?: string | null
          manufacturer?: string | null
          next_due_date?: string | null
          patient_id: string
          route?: string | null
          site?: string | null
          updated_at?: string
          vaccine_name: string
        }
        Update: {
          administered_by?: string | null
          administered_date?: string
          created_at?: string
          cvx_code?: string | null
          id?: string
          lot_number?: string | null
          manufacturer?: string | null
          next_due_date?: string | null
          patient_id?: string
          route?: string | null
          site?: string | null
          updated_at?: string
          vaccine_name?: string
        }
        Relationships: [
          {
            foreignKeyName: "immunizations_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      incident_reports: {
        Row: {
          affected_record_estimate: number | null
          closed_at: string | null
          contained_at: string | null
          created_at: string
          discovered_at: string
          hospital_id: string
          id: string
          kind: string
          notification_assessment: string | null
          notification_required: boolean | null
          reported_by: string
          risk_assessment: Json
          severity: string
          status: string
          summary: string
          updated_at: string
        }
        Insert: {
          affected_record_estimate?: number | null
          closed_at?: string | null
          contained_at?: string | null
          created_at?: string
          discovered_at?: string
          hospital_id: string
          id?: string
          kind: string
          notification_assessment?: string | null
          notification_required?: boolean | null
          reported_by: string
          risk_assessment?: Json
          severity?: string
          status?: string
          summary: string
          updated_at?: string
        }
        Update: {
          affected_record_estimate?: number | null
          closed_at?: string | null
          contained_at?: string | null
          created_at?: string
          discovered_at?: string
          hospital_id?: string
          id?: string
          kind?: string
          notification_assessment?: string | null
          notification_required?: boolean | null
          reported_by?: string
          risk_assessment?: Json
          severity?: string
          status?: string
          summary?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "incident_reports_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      interop_inbox: {
        Row: {
          correlation_id: string | null
          hospital_id: string
          id: string
          message_control_id: string
          message_type: string
          outcome: string
          payload_hash: string
          processed_at: string | null
          received_at: string
          reject_code: string | null
          signature_verified: boolean
          standard: string
          standard_version: string | null
          vendor_profile_id: string | null
        }
        Insert: {
          correlation_id?: string | null
          hospital_id: string
          id?: string
          message_control_id: string
          message_type: string
          outcome?: string
          payload_hash: string
          processed_at?: string | null
          received_at?: string
          reject_code?: string | null
          signature_verified?: boolean
          standard: string
          standard_version?: string | null
          vendor_profile_id?: string | null
        }
        Update: {
          correlation_id?: string | null
          hospital_id?: string
          id?: string
          message_control_id?: string
          message_type?: string
          outcome?: string
          payload_hash?: string
          processed_at?: string | null
          received_at?: string
          reject_code?: string | null
          signature_verified?: boolean
          standard?: string
          standard_version?: string | null
          vendor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interop_inbox_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      interop_outbox: {
        Row: {
          attempts: number
          blocked_reason: string | null
          correlation_id: string
          created_at: string
          hospital_id: string
          id: string
          idempotency_key: string
          message_type: string
          order_id: string | null
          payload_hash: string
          standard: string
          standard_version: string | null
          status: string
          vendor_profile_id: string | null
        }
        Insert: {
          attempts?: number
          blocked_reason?: string | null
          correlation_id: string
          created_at?: string
          hospital_id: string
          id?: string
          idempotency_key: string
          message_type: string
          order_id?: string | null
          payload_hash: string
          standard: string
          standard_version?: string | null
          status?: string
          vendor_profile_id?: string | null
        }
        Update: {
          attempts?: number
          blocked_reason?: string | null
          correlation_id?: string
          created_at?: string
          hospital_id?: string
          id?: string
          idempotency_key?: string
          message_type?: string
          order_id?: string | null
          payload_hash?: string
          standard?: string
          standard_version?: string | null
          status?: string
          vendor_profile_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "interop_outbox_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "interop_outbox_vendor_profile_id_fkey"
            columns: ["vendor_profile_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_vendor_profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      lab_results: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          is_abnormal: boolean
          panel: string | null
          patient_id: string
          reference_range: string | null
          resulted_at: string | null
          test_name: string
          unit: string | null
          value: string | null
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          is_abnormal?: boolean
          panel?: string | null
          patient_id: string
          reference_range?: string | null
          resulted_at?: string | null
          test_name: string
          unit?: string | null
          value?: string | null
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          is_abnormal?: boolean
          panel?: string | null
          patient_id?: string
          reference_range?: string | null
          resulted_at?: string | null
          test_name?: string
          unit?: string | null
          value?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "lab_results_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "lab_results_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      launch_readiness_gates: {
        Row: {
          blocker: string | null
          created_at: string
          created_by: string | null
          evidence_ref: string | null
          gate_key: string
          gate_type: string
          hospital_id: string
          id: string
          service_line_id: string | null
          state_code: string
          status: string
          updated_at: string
          verified_at: string | null
          verified_by: string | null
        }
        Insert: {
          blocker?: string | null
          created_at?: string
          created_by?: string | null
          evidence_ref?: string | null
          gate_key: string
          gate_type?: string
          hospital_id: string
          id?: string
          service_line_id?: string | null
          state_code: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Update: {
          blocker?: string | null
          created_at?: string
          created_by?: string | null
          evidence_ref?: string | null
          gate_key?: string
          gate_type?: string
          hospital_id?: string
          id?: string
          service_line_id?: string | null
          state_code?: string
          status?: string
          updated_at?: string
          verified_at?: string | null
          verified_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "launch_readiness_gates_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "launch_readiness_gates_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_history_candidates: {
        Row: {
          created_at: string
          dose: string | null
          external_id: string | null
          frequency: string | null
          id: string
          medication_text: string
          patient_id: string
          reviewed_at: string | null
          reviewed_by: string | null
          route: string | null
          rxcui: string | null
          source: string
          source_version: string | null
          status: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          external_id?: string | null
          frequency?: string | null
          id?: string
          medication_text: string
          patient_id: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          route?: string | null
          rxcui?: string | null
          source: string
          source_version?: string | null
          status?: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          external_id?: string | null
          frequency?: string | null
          id?: string
          medication_text?: string
          patient_id?: string
          reviewed_at?: string | null
          reviewed_by?: string | null
          route?: string | null
          rxcui?: string | null
          source?: string
          source_version?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_history_candidates_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_safety_checks: {
        Row: {
          check_type: string
          checked_at: string
          created_at: string
          created_by: string | null
          detail_code: string | null
          id: string
          message: string
          patient_id: string
          prescription_id: string
          severity: string
          source: string
          source_version: string
        }
        Insert: {
          check_type: string
          checked_at?: string
          created_at?: string
          created_by?: string | null
          detail_code?: string | null
          id?: string
          message: string
          patient_id: string
          prescription_id: string
          severity: string
          source: string
          source_version: string
        }
        Update: {
          check_type?: string
          checked_at?: string
          created_at?: string
          created_by?: string | null
          detail_code?: string | null
          id?: string
          message?: string
          patient_id?: string
          prescription_id?: string
          severity?: string
          source?: string
          source_version?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_safety_checks_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_safety_checks_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      medication_safety_overrides: {
        Row: {
          check_id: string
          created_at: string
          id: string
          overridden_by: string
          patient_id: string
          prescription_id: string
          rationale: string
        }
        Insert: {
          check_id: string
          created_at?: string
          id?: string
          overridden_by: string
          patient_id: string
          prescription_id: string
          rationale: string
        }
        Update: {
          check_id?: string
          created_at?: string
          id?: string
          overridden_by?: string
          patient_id?: string
          prescription_id?: string
          rationale?: string
        }
        Relationships: [
          {
            foreignKeyName: "medication_safety_overrides_check_id_fkey"
            columns: ["check_id"]
            isOneToOne: false
            referencedRelation: "medication_safety_checks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_safety_overrides_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "medication_safety_overrides_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          id: string
          role: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          role: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          role?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      note_addenda: {
        Row: {
          author_id: string
          content: Json
          content_hash: string
          created_at: string
          id: string
          note_id: string
          reason: string
          sequence: number
        }
        Insert: {
          author_id: string
          content: Json
          content_hash: string
          created_at?: string
          id?: string
          note_id: string
          reason: string
          sequence: number
        }
        Update: {
          author_id?: string
          content?: Json
          content_hash?: string
          created_at?: string
          id?: string
          note_id?: string
          reason?: string
          sequence?: number
        }
        Relationships: [
          {
            foreignKeyName: "note_addenda_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      note_templates: {
        Row: {
          created_at: string
          created_by: string | null
          encounter_type: Database["public"]["Enums"]["encounter_type"] | null
          hospital_id: string | null
          id: string
          name: string
          specialty: string | null
          template_content: Json
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"] | null
          hospital_id?: string | null
          id?: string
          name: string
          specialty?: string | null
          template_content?: Json
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"] | null
          hospital_id?: string | null
          id?: string
          name?: string
          specialty?: string | null
          template_content?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "note_templates_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      note_versions: {
        Row: {
          author_id: string | null
          content: Json
          content_hash: string
          created_at: string
          id: string
          note_id: string
          signed_at: string
          version: number
        }
        Insert: {
          author_id?: string | null
          content: Json
          content_hash: string
          created_at?: string
          id?: string
          note_id: string
          signed_at?: string
          version: number
        }
        Update: {
          author_id?: string | null
          content?: Json
          content_hash?: string
          created_at?: string
          id?: string
          note_id?: string
          signed_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "note_versions_note_id_fkey"
            columns: ["note_id"]
            isOneToOne: false
            referencedRelation: "clinical_notes"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          body: string | null
          created_at: string
          hospital_id: string | null
          id: string
          metadata: Json | null
          patient_id: string | null
          read: boolean
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body?: string | null
          created_at?: string
          hospital_id?: string | null
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          read?: boolean
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string | null
          created_at?: string
          hospital_id?: string | null
          id?: string
          metadata?: Json | null
          patient_id?: string | null
          read?: boolean
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      obesity_intake_screens: {
        Row: {
          answers: Json
          completed_at: string
          completed_by: string | null
          created_at: string
          encounter_id: string
          hospital_id: string
          id: string
          patient_id: string
          pregnancy_applicable: boolean
          provenance: Json
          red_flags: string[]
          template_protocol_id: string
          template_version: number
        }
        Insert: {
          answers?: Json
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          encounter_id: string
          hospital_id: string
          id?: string
          patient_id: string
          pregnancy_applicable?: boolean
          provenance?: Json
          red_flags?: string[]
          template_protocol_id: string
          template_version: number
        }
        Update: {
          answers?: Json
          completed_at?: string
          completed_by?: string | null
          created_at?: string
          encounter_id?: string
          hospital_id?: string
          id?: string
          patient_id?: string
          pregnancy_applicable?: boolean
          provenance?: Json
          red_flags?: string[]
          template_protocol_id?: string
          template_version?: number
        }
        Relationships: [
          {
            foreignKeyName: "obesity_intake_screens_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obesity_intake_screens_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obesity_intake_screens_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "obesity_intake_screens_template_protocol_id_fkey"
            columns: ["template_protocol_id"]
            isOneToOne: false
            referencedRelation: "clinical_protocols"
            referencedColumns: ["id"]
          },
        ]
      }
      order_sets: {
        Row: {
          category: string
          created_at: string
          created_by: string | null
          description: string | null
          hospital_id: string | null
          id: string
          name: string
          orders_template: Json
          updated_at: string
        }
        Insert: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          hospital_id?: string | null
          id?: string
          name: string
          orders_template?: Json
          updated_at?: string
        }
        Update: {
          category?: string
          created_at?: string
          created_by?: string | null
          description?: string | null
          hospital_id?: string | null
          id?: string
          name?: string
          orders_template?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "order_sets_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_allergies: {
        Row: {
          allergen: string
          created_at: string
          id: string
          onset_date: string | null
          patient_id: string
          reaction: string | null
          severity: string
          updated_at: string
        }
        Insert: {
          allergen: string
          created_at?: string
          id?: string
          onset_date?: string | null
          patient_id: string
          reaction?: string | null
          severity?: string
          updated_at?: string
        }
        Update: {
          allergen?: string
          created_at?: string
          id?: string
          onset_date?: string | null
          patient_id?: string
          reaction?: string | null
          severity?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_allergies_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_insurance: {
        Row: {
          active: boolean
          copay_amount: number | null
          created_at: string
          effective_date: string | null
          group_number: string | null
          hospital_id: string | null
          id: string
          member_id: string
          patient_id: string
          payer_id: string | null
          payer_name: string
          plan_name: string | null
          rank: string
          relationship_to_subscriber: string | null
          subscriber_dob: string | null
          subscriber_name: string | null
          termination_date: string | null
          updated_at: string
          verification_status: string
          verified_at: string | null
        }
        Insert: {
          active?: boolean
          copay_amount?: number | null
          created_at?: string
          effective_date?: string | null
          group_number?: string | null
          hospital_id?: string | null
          id?: string
          member_id: string
          patient_id: string
          payer_id?: string | null
          payer_name: string
          plan_name?: string | null
          rank?: string
          relationship_to_subscriber?: string | null
          subscriber_dob?: string | null
          subscriber_name?: string | null
          termination_date?: string | null
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
        }
        Update: {
          active?: boolean
          copay_amount?: number | null
          created_at?: string
          effective_date?: string | null
          group_number?: string | null
          hospital_id?: string | null
          id?: string
          member_id?: string
          patient_id?: string
          payer_id?: string | null
          payer_name?: string
          plan_name?: string | null
          rank?: string
          relationship_to_subscriber?: string | null
          subscriber_dob?: string | null
          subscriber_name?: string | null
          termination_date?: string | null
          updated_at?: string
          verification_status?: string
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "patient_insurance_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_insurance_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "patient_insurance_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_medications: {
        Row: {
          created_at: string
          dose: string | null
          end_date: string | null
          frequency: string | null
          id: string
          name: string
          patient_id: string
          prescriber: string | null
          route: string | null
          start_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name: string
          patient_id: string
          prescriber?: string | null
          route?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          dose?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          name?: string
          patient_id?: string
          prescriber?: string | null
          route?: string | null
          start_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_medications_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_problems: {
        Row: {
          created_at: string
          description: string
          icd10_code: string | null
          id: string
          onset_date: string | null
          patient_id: string
          resolved_date: string | null
          status: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description: string
          icd10_code?: string | null
          id?: string
          onset_date?: string | null
          patient_id: string
          resolved_date?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string
          icd10_code?: string | null
          id?: string
          onset_date?: string | null
          patient_id?: string
          resolved_date?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_problems_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patient_vitals: {
        Row: {
          id: string
          insights: Json
          patient_id: string
          trends: Json
          updated_at: string
        }
        Insert: {
          id?: string
          insights?: Json
          patient_id: string
          trends?: Json
          updated_at?: string
        }
        Update: {
          id?: string
          insights?: Json
          patient_id?: string
          trends?: Json
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patient_vitals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: true
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      patients: {
        Row: {
          admission_day: number
          admission_diagnosis: string | null
          age: number
          attending_physician: string | null
          bed: string | null
          care_team: Json | null
          created_at: string
          emergency_contact: Json | null
          expected_los: number
          hospital_id: string | null
          id: string
          insurance_id: string | null
          insurance_provider: string | null
          location: string | null
          mrn: string
          name: string
          patient_type: Database["public"]["Enums"]["patient_type"] | null
          pcp_provider_id: string | null
          preferred_language: string | null
          preferred_pharmacy: string | null
          sex: string
          status: string | null
          unit: string | null
          updated_at: string
        }
        Insert: {
          admission_day?: number
          admission_diagnosis?: string | null
          age: number
          attending_physician?: string | null
          bed?: string | null
          care_team?: Json | null
          created_at?: string
          emergency_contact?: Json | null
          expected_los?: number
          hospital_id?: string | null
          id?: string
          insurance_id?: string | null
          insurance_provider?: string | null
          location?: string | null
          mrn: string
          name: string
          patient_type?: Database["public"]["Enums"]["patient_type"] | null
          pcp_provider_id?: string | null
          preferred_language?: string | null
          preferred_pharmacy?: string | null
          sex: string
          status?: string | null
          unit?: string | null
          updated_at?: string
        }
        Update: {
          admission_day?: number
          admission_diagnosis?: string | null
          age?: number
          attending_physician?: string | null
          bed?: string | null
          care_team?: Json | null
          created_at?: string
          emergency_contact?: Json | null
          expected_los?: number
          hospital_id?: string | null
          id?: string
          insurance_id?: string | null
          insurance_provider?: string | null
          location?: string | null
          mrn?: string
          name?: string
          patient_type?: Database["public"]["Enums"]["patient_type"] | null
          pcp_provider_id?: string | null
          preferred_language?: string | null
          preferred_pharmacy?: string | null
          sex?: string
          status?: string | null
          unit?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "patients_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      payers: {
        Row: {
          active: boolean
          claim_rules: Json
          created_at: string
          hospital_id: string
          id: string
          name: string
          payer_code: string | null
          updated_at: string
          x12_payer_id: string | null
        }
        Insert: {
          active?: boolean
          claim_rules?: Json
          created_at?: string
          hospital_id: string
          id?: string
          name: string
          payer_code?: string | null
          updated_at?: string
          x12_payer_id?: string | null
        }
        Update: {
          active?: boolean
          claim_rules?: Json
          created_at?: string
          hospital_id?: string
          id?: string
          name?: string
          payer_code?: string | null
          updated_at?: string
          x12_payer_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "payers_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      pdmp_access_events: {
        Row: {
          actor_id: string
          created_at: string
          event_code: string
          hospital_id: string
          id: string
          pdmp_query_id: string
        }
        Insert: {
          actor_id: string
          created_at?: string
          event_code: string
          hospital_id: string
          id?: string
          pdmp_query_id: string
        }
        Update: {
          actor_id?: string
          created_at?: string
          event_code?: string
          hospital_id?: string
          id?: string
          pdmp_query_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "pdmp_access_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdmp_access_events_pdmp_query_id_fkey"
            columns: ["pdmp_query_id"]
            isOneToOne: false
            referencedRelation: "pdmp_queries"
            referencedColumns: ["id"]
          },
        ]
      }
      pdmp_queries: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          legal_basis: string
          patient_id: string
          purpose: string
          queried_at: string
          requested_by: string
          result_summary_flag: string | null
          state_code: string
          status: string
          vendor_request_id: string | null
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          legal_basis: string
          patient_id: string
          purpose: string
          queried_at?: string
          requested_by: string
          result_summary_flag?: string | null
          state_code: string
          status?: string
          vendor_request_id?: string | null
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          legal_basis?: string
          patient_id?: string
          purpose?: string
          queried_at?: string
          requested_by?: string
          result_summary_flag?: string | null
          state_code?: string
          status?: string
          vendor_request_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "pdmp_queries_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "pdmp_queries_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      prescription_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_code: string
          from_status: string | null
          id: string
          metadata: Json
          patient_id: string
          prescription_id: string
          reason: string | null
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_code: string
          from_status?: string | null
          id?: string
          metadata?: Json
          patient_id: string
          prescription_id: string
          reason?: string | null
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_code?: string
          from_status?: string | null
          id?: string
          metadata?: Json
          patient_id?: string
          prescription_id?: string
          reason?: string | null
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "prescription_events_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescription_events_prescription_id_fkey"
            columns: ["prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      prescriptions: {
        Row: {
          authored_at: string
          created_at: string
          days_supply: number | null
          dea_schedule: string | null
          dispense_as_written: boolean
          dose: string | null
          duration_days: number | null
          encounter_id: string | null
          end_date: string | null
          frequency: string | null
          id: string
          indication_code: string | null
          indication_text: string | null
          lock_version: number
          medication_name: string
          ndc: string | null
          no_encounter_reason: string | null
          patient_id: string
          pharmacy_name: string | null
          pharmacy_ncpdp_id: string | null
          pharmacy_npi: string | null
          prescriber_id: string
          prescriber_state_code: string | null
          quantity: number | null
          refills: number | null
          replaces_prescription_id: string | null
          route: string | null
          rx_kind: string
          rxcui: string | null
          rxnorm_name: string | null
          sig: string | null
          signed_at: string | null
          signed_by: string | null
          signed_hash: string | null
          signed_snapshot: Json | null
          start_date: string | null
          status: Database["public"]["Enums"]["prescription_status"]
          transmitted_at: string | null
          units: string | null
          updated_at: string
        }
        Insert: {
          authored_at?: string
          created_at?: string
          days_supply?: number | null
          dea_schedule?: string | null
          dispense_as_written?: boolean
          dose?: string | null
          duration_days?: number | null
          encounter_id?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          indication_code?: string | null
          indication_text?: string | null
          lock_version?: number
          medication_name: string
          ndc?: string | null
          no_encounter_reason?: string | null
          patient_id: string
          pharmacy_name?: string | null
          pharmacy_ncpdp_id?: string | null
          pharmacy_npi?: string | null
          prescriber_id: string
          prescriber_state_code?: string | null
          quantity?: number | null
          refills?: number | null
          replaces_prescription_id?: string | null
          route?: string | null
          rx_kind?: string
          rxcui?: string | null
          rxnorm_name?: string | null
          sig?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_hash?: string | null
          signed_snapshot?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["prescription_status"]
          transmitted_at?: string | null
          units?: string | null
          updated_at?: string
        }
        Update: {
          authored_at?: string
          created_at?: string
          days_supply?: number | null
          dea_schedule?: string | null
          dispense_as_written?: boolean
          dose?: string | null
          duration_days?: number | null
          encounter_id?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          indication_code?: string | null
          indication_text?: string | null
          lock_version?: number
          medication_name?: string
          ndc?: string | null
          no_encounter_reason?: string | null
          patient_id?: string
          pharmacy_name?: string | null
          pharmacy_ncpdp_id?: string | null
          pharmacy_npi?: string | null
          prescriber_id?: string
          prescriber_state_code?: string | null
          quantity?: number | null
          refills?: number | null
          replaces_prescription_id?: string | null
          route?: string | null
          rx_kind?: string
          rxcui?: string | null
          rxnorm_name?: string | null
          sig?: string | null
          signed_at?: string | null
          signed_by?: string | null
          signed_hash?: string | null
          signed_snapshot?: Json | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["prescription_status"]
          transmitted_at?: string | null
          units?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "prescriptions_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "prescriptions_replaces_prescription_id_fkey"
            columns: ["replaces_prescription_id"]
            isOneToOne: false
            referencedRelation: "prescriptions"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          full_name: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          full_name?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      provider_licenses: {
        Row: {
          created_at: string
          effective_date: string
          expiration_date: string | null
          hospital_id: string
          id: string
          license_number: string
          provider_user_id: string
          state_code: string
          status: string
          telehealth_permitted: boolean
          updated_at: string
          verification_source: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          effective_date?: string
          expiration_date?: string | null
          hospital_id: string
          id?: string
          license_number: string
          provider_user_id: string
          state_code: string
          status?: string
          telehealth_permitted?: boolean
          updated_at?: string
          verification_source?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          effective_date?: string
          expiration_date?: string | null
          hospital_id?: string
          id?: string
          license_number?: string
          provider_user_id?: string
          state_code?: string
          status?: string
          telehealth_permitted?: boolean
          updated_at?: string
          verification_source?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_licenses_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_payer_enrollments: {
        Row: {
          created_at: string
          effective_date: string | null
          end_date: string | null
          enrollment_status: string
          hospital_id: string
          id: string
          npi: string | null
          payer_id: string
          provider_user_id: string
          taxonomy_code: string | null
          updated_at: string
          verification_source: string | null
          verified_at: string | null
        }
        Insert: {
          created_at?: string
          effective_date?: string | null
          end_date?: string | null
          enrollment_status?: string
          hospital_id: string
          id?: string
          npi?: string | null
          payer_id: string
          provider_user_id: string
          taxonomy_code?: string | null
          updated_at?: string
          verification_source?: string | null
          verified_at?: string | null
        }
        Update: {
          created_at?: string
          effective_date?: string | null
          end_date?: string | null
          enrollment_status?: string
          hospital_id?: string
          id?: string
          npi?: string | null
          payer_id?: string
          provider_user_id?: string
          taxonomy_code?: string | null
          updated_at?: string
          verification_source?: string | null
          verified_at?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "provider_payer_enrollments_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_payer_enrollments_payer_id_fkey"
            columns: ["payer_id"]
            isOneToOne: false
            referencedRelation: "payers"
            referencedColumns: ["id"]
          },
        ]
      }
      provider_service_lines: {
        Row: {
          active: boolean
          created_at: string
          daily_capacity: number
          effective_date: string
          end_date: string | null
          hospital_id: string
          id: string
          provider_user_id: string
          service_line_id: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          daily_capacity?: number
          effective_date?: string
          end_date?: string | null
          hospital_id: string
          id?: string
          provider_user_id: string
          service_line_id: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          daily_capacity?: number
          effective_date?: string
          end_date?: string | null
          hospital_id?: string
          id?: string
          provider_user_id?: string
          service_line_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "provider_service_lines_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "provider_service_lines_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      rate_limits: {
        Row: {
          bucket: string
          count: number
          id: string
          user_id: string
          window_start: string
        }
        Insert: {
          bucket: string
          count?: number
          id?: string
          user_id: string
          window_start?: string
        }
        Update: {
          bucket?: string
          count?: number
          id?: string
          user_id?: string
          window_start?: string
        }
        Relationships: []
      }
      readiness_events: {
        Row: {
          actor_id: string | null
          created_at: string
          event_code: string
          from_status: string | null
          gate_id: string | null
          hospital_id: string
          id: string
          metadata: Json
          to_status: string | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          event_code: string
          from_status?: string | null
          gate_id?: string | null
          hospital_id: string
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          event_code?: string
          from_status?: string | null
          gate_id?: string | null
          hospital_id?: string
          id?: string
          metadata?: Json
          to_status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "readiness_events_gate_id_fkey"
            columns: ["gate_id"]
            isOneToOne: false
            referencedRelation: "launch_readiness_gates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "readiness_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      referrals: {
        Row: {
          completed_date: string | null
          created_at: string
          encounter_id: string | null
          id: string
          notes: string | null
          patient_id: string
          reason: string
          referred_to_provider: string | null
          referred_to_specialty: string
          referring_provider_id: string
          report_received: boolean | null
          scheduled_date: string | null
          status: Database["public"]["Enums"]["referral_status"]
          updated_at: string
          urgency: Database["public"]["Enums"]["referral_urgency"]
        }
        Insert: {
          completed_date?: string | null
          created_at?: string
          encounter_id?: string | null
          id?: string
          notes?: string | null
          patient_id: string
          reason: string
          referred_to_provider?: string | null
          referred_to_specialty: string
          referring_provider_id: string
          report_received?: boolean | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["referral_urgency"]
        }
        Update: {
          completed_date?: string | null
          created_at?: string
          encounter_id?: string | null
          id?: string
          notes?: string | null
          patient_id?: string
          reason?: string
          referred_to_provider?: string | null
          referred_to_specialty?: string
          referring_provider_id?: string
          report_received?: boolean | null
          scheduled_date?: string | null
          status?: Database["public"]["Enums"]["referral_status"]
          updated_at?: string
          urgency?: Database["public"]["Enums"]["referral_urgency"]
        }
        Relationships: [
          {
            foreignKeyName: "referrals_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referrals_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      result_acknowledgements: {
        Row: {
          action: string
          actor_id: string
          callback_method: string | null
          created_at: string
          documentation: string | null
          hospital_id: string
          id: string
          patient_id: string
          result_id: string
        }
        Insert: {
          action: string
          actor_id: string
          callback_method?: string | null
          created_at?: string
          documentation?: string | null
          hospital_id: string
          id?: string
          patient_id: string
          result_id: string
        }
        Update: {
          action?: string
          actor_id?: string
          callback_method?: string | null
          created_at?: string
          documentation?: string | null
          hospital_id?: string
          id?: string
          patient_id?: string
          result_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_acknowledgements_result_id_fkey"
            columns: ["result_id"]
            isOneToOne: false
            referencedRelation: "diagnostic_results"
            referencedColumns: ["id"]
          },
        ]
      }
      result_release_rules: {
        Row: {
          auto_release: boolean
          category: string
          created_at: string
          delay_hours: number
          hospital_id: string
          id: string
          prohibited: boolean
          rationale: string | null
          updated_at: string
        }
        Insert: {
          auto_release?: boolean
          category: string
          created_at?: string
          delay_hours?: number
          hospital_id: string
          id?: string
          prohibited?: boolean
          rationale?: string | null
          updated_at?: string
        }
        Update: {
          auto_release?: boolean
          category?: string
          created_at?: string
          delay_hours?: number
          hospital_id?: string
          id?: string
          prohibited?: boolean
          rationale?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "result_release_rules_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      safety_screen_templates: {
        Row: {
          active: boolean
          approval_required: boolean
          approved_at: string | null
          approved_by: string | null
          created_at: string
          disclaimer: string
          hospital_id: string
          id: string
          questions: Json
          service_line_id: string | null
          updated_at: string
          version: number
        }
        Insert: {
          active?: boolean
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          disclaimer?: string
          hospital_id: string
          id?: string
          questions?: Json
          service_line_id?: string | null
          updated_at?: string
          version: number
        }
        Update: {
          active?: boolean
          approval_required?: boolean
          approved_at?: string | null
          approved_by?: string | null
          created_at?: string
          disclaimer?: string
          hospital_id?: string
          id?: string
          questions?: Json
          service_line_id?: string | null
          updated_at?: string
          version?: number
        }
        Relationships: [
          {
            foreignKeyName: "safety_screen_templates_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "safety_screen_templates_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      service_lines: {
        Row: {
          active: boolean
          allows_established_patients: boolean
          allows_new_patients: boolean
          code: string
          created_at: string
          hospital_id: string
          id: string
          min_age: number
          modality: Database["public"]["Enums"]["visit_modality"]
          name: string
          patient_description: string
          requires_records: boolean
          requires_referral: boolean
          response_window: string
          sort_order: number
          updated_at: string
          visible_to_patients: boolean
        }
        Insert: {
          active?: boolean
          allows_established_patients?: boolean
          allows_new_patients?: boolean
          code: string
          created_at?: string
          hospital_id: string
          id?: string
          min_age?: number
          modality?: Database["public"]["Enums"]["visit_modality"]
          name: string
          patient_description: string
          requires_records?: boolean
          requires_referral?: boolean
          response_window?: string
          sort_order?: number
          updated_at?: string
          visible_to_patients?: boolean
        }
        Update: {
          active?: boolean
          allows_established_patients?: boolean
          allows_new_patients?: boolean
          code?: string
          created_at?: string
          hospital_id?: string
          id?: string
          min_age?: number
          modality?: Database["public"]["Enums"]["visit_modality"]
          name?: string
          patient_description?: string
          requires_records?: boolean
          requires_referral?: boolean
          response_window?: string
          sort_order?: number
          updated_at?: string
          visible_to_patients?: boolean
        }
        Relationships: [
          {
            foreignKeyName: "service_lines_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      smart_app_registrations: {
        Row: {
          app_name: string
          client_id: string
          created_at: string
          created_by: string | null
          environment: string
          fhir_version: string
          hospital_id: string
          id: string
          jwks_uri: string | null
          launch_type: string
          scopes: string[]
          secret_ref_names: string[]
          status: string
          updated_at: string
        }
        Insert: {
          app_name: string
          client_id: string
          created_at?: string
          created_by?: string | null
          environment?: string
          fhir_version?: string
          hospital_id: string
          id?: string
          jwks_uri?: string | null
          launch_type?: string
          scopes?: string[]
          secret_ref_names?: string[]
          status?: string
          updated_at?: string
        }
        Update: {
          app_name?: string
          client_id?: string
          created_at?: string
          created_by?: string | null
          environment?: string
          fhir_version?: string
          hospital_id?: string
          id?: string
          jwks_uri?: string | null
          launch_type?: string
          scopes?: string[]
          secret_ref_names?: string[]
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "smart_app_registrations_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      staff_credentials: {
        Row: {
          created_at: string
          created_by: string | null
          credential_type: string
          effective_date: string | null
          expiration_date: string | null
          hospital_id: string
          id: string
          issuing_authority: string | null
          notes: string | null
          psv_evidence_ref: string | null
          psv_source: string | null
          psv_verified_at: string | null
          state_code: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          credential_type: string
          effective_date?: string | null
          expiration_date?: string | null
          hospital_id: string
          id?: string
          issuing_authority?: string | null
          notes?: string | null
          psv_evidence_ref?: string | null
          psv_source?: string | null
          psv_verified_at?: string | null
          state_code?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          credential_type?: string
          effective_date?: string | null
          expiration_date?: string | null
          hospital_id?: string
          id?: string
          issuing_authority?: string | null
          notes?: string | null
          psv_evidence_ref?: string | null
          psv_source?: string | null
          psv_verified_at?: string | null
          state_code?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "staff_credentials_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      staged_orders: {
        Row: {
          conversation_id: string | null
          created_at: string
          created_by: string | null
          encounter_id: string | null
          id: string
          order_data: Json
          order_type: string
          patient_id: string
          rationale: string | null
          status: Database["public"]["Enums"]["order_status"]
          updated_at: string
        }
        Insert: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id?: string | null
          id?: string
          order_data?: Json
          order_type: string
          patient_id: string
          rationale?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Update: {
          conversation_id?: string | null
          created_at?: string
          created_by?: string | null
          encounter_id?: string | null
          id?: string
          order_data?: Json
          order_type?: string
          patient_id?: string
          rationale?: string | null
          status?: Database["public"]["Enums"]["order_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "staged_orders_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staged_orders_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "staged_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      state_service_availability: {
        Row: {
          created_at: string
          hospital_id: string
          id: string
          launch_date: string | null
          max_age: number | null
          min_age: number | null
          modality: Database["public"]["Enums"]["visit_modality"] | null
          reason: string | null
          service_line_id: string
          state_code: string
          status: Database["public"]["Enums"]["service_availability_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          hospital_id: string
          id?: string
          launch_date?: string | null
          max_age?: number | null
          min_age?: number | null
          modality?: Database["public"]["Enums"]["visit_modality"] | null
          reason?: string | null
          service_line_id: string
          state_code: string
          status?: Database["public"]["Enums"]["service_availability_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          hospital_id?: string
          id?: string
          launch_date?: string | null
          max_age?: number | null
          min_age?: number | null
          modality?: Database["public"]["Enums"]["visit_modality"] | null
          reason?: string | null
          service_line_id?: string
          state_code?: string
          status?: Database["public"]["Enums"]["service_availability_status"]
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "state_service_availability_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "state_service_availability_service_line_id_fkey"
            columns: ["service_line_id"]
            isOneToOne: false
            referencedRelation: "service_lines"
            referencedColumns: ["id"]
          },
        ]
      }
      superbills: {
        Row: {
          cpt_lines: Json
          created_at: string
          encounter_id: string | null
          generated_at: string | null
          generated_by: string | null
          hospital_id: string
          icd10_codes: string[]
          id: string
          insurance_snapshot: Json | null
          patient_id: string
          pdf_url: string | null
          provider_id: string | null
          service_date: string
          status: string
          total_amount: number
          updated_at: string
        }
        Insert: {
          cpt_lines?: Json
          created_at?: string
          encounter_id?: string | null
          generated_at?: string | null
          generated_by?: string | null
          hospital_id: string
          icd10_codes?: string[]
          id?: string
          insurance_snapshot?: Json | null
          patient_id: string
          pdf_url?: string | null
          provider_id?: string | null
          service_date: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Update: {
          cpt_lines?: Json
          created_at?: string
          encounter_id?: string | null
          generated_at?: string | null
          generated_by?: string | null
          hospital_id?: string
          icd10_codes?: string[]
          id?: string
          insurance_snapshot?: Json | null
          patient_id?: string
          pdf_url?: string | null
          provider_id?: string | null
          service_date?: string
          status?: string
          total_amount?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "superbills_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "superbills_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "superbills_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      support_cases: {
        Row: {
          assignee_id: string | null
          category: string
          created_at: string
          description: string
          hospital_id: string
          id: string
          patient_ref: string | null
          priority: string
          requester_id: string
          resolution: string | null
          resolved_at: string | null
          status: string
          subject: string
          updated_at: string
        }
        Insert: {
          assignee_id?: string | null
          category: string
          created_at?: string
          description: string
          hospital_id: string
          id?: string
          patient_ref?: string | null
          priority?: string
          requester_id: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          subject: string
          updated_at?: string
        }
        Update: {
          assignee_id?: string | null
          category?: string
          created_at?: string
          description?: string
          hospital_id?: string
          id?: string
          patient_ref?: string | null
          priority?: string
          requester_id?: string
          resolution?: string | null
          resolved_at?: string | null
          status?: string
          subject?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_cases_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "support_cases_patient_ref_fkey"
            columns: ["patient_ref"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_channels: {
        Row: {
          channel_type: Database["public"]["Enums"]["channel_type"]
          created_at: string
          created_by: string
          hospital_id: string
          id: string
          name: string
          patient_id: string | null
          updated_at: string
        }
        Insert: {
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          created_by: string
          hospital_id: string
          id?: string
          name: string
          patient_id?: string | null
          updated_at?: string
        }
        Update: {
          channel_type?: Database["public"]["Enums"]["channel_type"]
          created_at?: string
          created_by?: string
          hospital_id?: string
          id?: string
          name?: string
          patient_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_channels_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_channels_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      team_messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          id: string
          message_type: Database["public"]["Enums"]["team_message_type"]
          read_by: Json | null
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["team_message_type"]
          read_by?: Json | null
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          id?: string
          message_type?: Database["public"]["Enums"]["team_message_type"]
          read_by?: Json | null
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "team_messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "team_channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "team_messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "team_messages"
            referencedColumns: ["id"]
          },
        ]
      }
      terminology_mappings: {
        Row: {
          canonical_code: string
          canonical_system: string
          canonical_version: string | null
          created_at: string
          display: string | null
          domain: string
          hospital_id: string
          id: string
          local_code: string
          local_system: string
          updated_at: string
          validated: boolean
          validated_at: string | null
          validated_by: string | null
        }
        Insert: {
          canonical_code: string
          canonical_system: string
          canonical_version?: string | null
          created_at?: string
          display?: string | null
          domain: string
          hospital_id: string
          id?: string
          local_code: string
          local_system: string
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
        }
        Update: {
          canonical_code?: string
          canonical_system?: string
          canonical_version?: string | null
          created_at?: string
          display?: string | null
          domain?: string
          hospital_id?: string
          id?: string
          local_code?: string
          local_system?: string
          updated_at?: string
          validated?: boolean
          validated_at?: string | null
          validated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "terminology_mappings_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      user_roles: {
        Row: {
          created_at: string
          id: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          role: Database["public"]["Enums"]["app_role"]
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          role?: Database["public"]["Enums"]["app_role"]
          user_id?: string
        }
        Relationships: []
      }
      vendor_agreements: {
        Row: {
          baa_executed_at: string | null
          baa_status: string
          created_at: string
          created_by: string | null
          expires_at: string | null
          hospital_id: string
          id: string
          notes: string | null
          phi_access: boolean
          risk_review_at: string | null
          service: string
          status: string
          updated_at: string
          vendor: string
        }
        Insert: {
          baa_executed_at?: string | null
          baa_status?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hospital_id: string
          id?: string
          notes?: string | null
          phi_access?: boolean
          risk_review_at?: string | null
          service: string
          status?: string
          updated_at?: string
          vendor: string
        }
        Update: {
          baa_executed_at?: string | null
          baa_status?: string
          created_at?: string
          created_by?: string | null
          expires_at?: string | null
          hospital_id?: string
          id?: string
          notes?: string | null
          phi_access?: boolean
          risk_review_at?: string | null
          service?: string
          status?: string
          updated_at?: string
          vendor?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_agreements_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_callback_quarantine: {
        Row: {
          correlation_id: string | null
          created_at: string
          environment: string | null
          event_type: string | null
          hospital_id: string | null
          id: string
          payload_hash: string
          quarantine_reason: string
          resolved_at: string | null
          vendor_key: string
          vendor_reference: string | null
        }
        Insert: {
          correlation_id?: string | null
          created_at?: string
          environment?: string | null
          event_type?: string | null
          hospital_id?: string | null
          id?: string
          payload_hash: string
          quarantine_reason: string
          resolved_at?: string | null
          vendor_key: string
          vendor_reference?: string | null
        }
        Update: {
          correlation_id?: string | null
          created_at?: string
          environment?: string | null
          event_type?: string | null
          hospital_id?: string | null
          id?: string
          payload_hash?: string
          quarantine_reason?: string
          resolved_at?: string | null
          vendor_key?: string
          vendor_reference?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_callback_quarantine_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_identity_mappings: {
        Row: {
          created_at: string
          created_by: string | null
          environment: string
          evidence_ref: string | null
          hospital_id: string
          id: string
          subject_id: string
          subject_type: string
          vendor_identifier: string
          vendor_key: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          environment: string
          evidence_ref?: string | null
          hospital_id: string
          id?: string
          subject_id: string
          subject_type: string
          vendor_identifier: string
          vendor_key: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          environment?: string
          evidence_ref?: string | null
          hospital_id?: string
          id?: string
          subject_id?: string
          subject_type?: string
          vendor_identifier?: string
          vendor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_identity_mappings_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_onboarding: {
        Row: {
          approval_evidence_hash: string | null
          approved_by: string | null
          blocker: string | null
          capabilities: Json
          certification_evidence_hash: string | null
          checklist: Json
          contract_evidence_hash: string | null
          created_at: string
          credential_evidence_hash: string | null
          environment: string
          evidence_expires_at: string | null
          hospital_id: string
          id: string
          last_test_at: string | null
          last_test_result: string | null
          next_action: string | null
          owner_email: string | null
          owner_name: string | null
          secret_ref_names: string[]
          state: Database["public"]["Enums"]["vendor_integration_state"]
          updated_at: string
          vendor_key: string
        }
        Insert: {
          approval_evidence_hash?: string | null
          approved_by?: string | null
          blocker?: string | null
          capabilities?: Json
          certification_evidence_hash?: string | null
          checklist?: Json
          contract_evidence_hash?: string | null
          created_at?: string
          credential_evidence_hash?: string | null
          environment: string
          evidence_expires_at?: string | null
          hospital_id: string
          id?: string
          last_test_at?: string | null
          last_test_result?: string | null
          next_action?: string | null
          owner_email?: string | null
          owner_name?: string | null
          secret_ref_names?: string[]
          state?: Database["public"]["Enums"]["vendor_integration_state"]
          updated_at?: string
          vendor_key: string
        }
        Update: {
          approval_evidence_hash?: string | null
          approved_by?: string | null
          blocker?: string | null
          capabilities?: Json
          certification_evidence_hash?: string | null
          checklist?: Json
          contract_evidence_hash?: string | null
          created_at?: string
          credential_evidence_hash?: string | null
          environment?: string
          evidence_expires_at?: string | null
          hospital_id?: string
          id?: string
          last_test_at?: string | null
          last_test_result?: string | null
          next_action?: string | null
          owner_email?: string | null
          owner_name?: string | null
          secret_ref_names?: string[]
          state?: Database["public"]["Enums"]["vendor_integration_state"]
          updated_at?: string
          vendor_key?: string
        }
        Relationships: [
          {
            foreignKeyName: "vendor_onboarding_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
      vendor_onboarding_events: {
        Row: {
          actor_id: string | null
          created_at: string
          detail: Json
          event_type: string
          from_state:
            | Database["public"]["Enums"]["vendor_integration_state"]
            | null
          hospital_id: string
          id: string
          onboarding_id: string
          to_state:
            | Database["public"]["Enums"]["vendor_integration_state"]
            | null
        }
        Insert: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          event_type: string
          from_state?:
            | Database["public"]["Enums"]["vendor_integration_state"]
            | null
          hospital_id: string
          id?: string
          onboarding_id: string
          to_state?:
            | Database["public"]["Enums"]["vendor_integration_state"]
            | null
        }
        Update: {
          actor_id?: string | null
          created_at?: string
          detail?: Json
          event_type?: string
          from_state?:
            | Database["public"]["Enums"]["vendor_integration_state"]
            | null
          hospital_id?: string
          id?: string
          onboarding_id?: string
          to_state?:
            | Database["public"]["Enums"]["vendor_integration_state"]
            | null
        }
        Relationships: [
          {
            foreignKeyName: "vendor_onboarding_events_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "vendor_onboarding_events_onboarding_id_fkey"
            columns: ["onboarding_id"]
            isOneToOne: false
            referencedRelation: "vendor_onboarding"
            referencedColumns: ["id"]
          },
        ]
      }
      workflow_metrics: {
        Row: {
          billing_codes_suggested: number
          click_count: number
          created_at: string
          encounter_id: string | null
          hospital_id: string | null
          id: string
          notes_generated: number
          orders_signed: number
          orders_staged: number
          patient_id: string
          time_on_task_seconds: number
          updated_at: string
          user_id: string
          voice_commands_used: number
          workflow_steps: Json
        }
        Insert: {
          billing_codes_suggested?: number
          click_count?: number
          created_at?: string
          encounter_id?: string | null
          hospital_id?: string | null
          id?: string
          notes_generated?: number
          orders_signed?: number
          orders_staged?: number
          patient_id: string
          time_on_task_seconds?: number
          updated_at?: string
          user_id: string
          voice_commands_used?: number
          workflow_steps?: Json
        }
        Update: {
          billing_codes_suggested?: number
          click_count?: number
          created_at?: string
          encounter_id?: string | null
          hospital_id?: string | null
          id?: string
          notes_generated?: number
          orders_signed?: number
          orders_staged?: number
          patient_id?: string
          time_on_task_seconds?: number
          updated_at?: string
          user_id?: string
          voice_commands_used?: number
          workflow_steps?: Json
        }
        Relationships: [
          {
            foreignKeyName: "workflow_metrics_encounter_id_fkey"
            columns: ["encounter_id"]
            isOneToOne: false
            referencedRelation: "encounters"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_metrics_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workflow_metrics_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
            referencedColumns: ["id"]
          },
        ]
      }
      workforce_training: {
        Row: {
          completed_at: string | null
          created_at: string
          created_by: string | null
          curriculum: string
          evidence_ref: string | null
          expires_at: string | null
          hospital_id: string
          id: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          curriculum: string
          evidence_ref?: string | null
          expires_at?: string | null
          hospital_id: string
          id?: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          completed_at?: string | null
          created_at?: string
          created_by?: string | null
          curriculum?: string
          evidence_ref?: string | null
          expires_at?: string | null
          hospital_id?: string
          id?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workforce_training_hospital_id_fkey"
            columns: ["hospital_id"]
            isOneToOne: false
            referencedRelation: "hospitals"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      care_routing_status: {
        Args: {
          p_hospital_id: string
          p_service_line_id: string
          p_state_code: string
        }
        Returns: Json
      }
      claim_readiness: { Args: { p_claim_id: string }; Returns: Json }
      compliance_readiness: { Args: { p_hospital_id: string }; Returns: Json }
      consent_status: {
        Args: {
          _hospital_id: string
          _patient_id: string
          _state_code?: string
        }
        Returns: Json
      }
      diagnostic_order_readiness: {
        Args: { p_order_id: string }
        Returns: Json
      }
      dosespot_prescriber_epcs_ok: {
        Args: { p_hospital_id: string; p_state_code: string; p_user_id: string }
        Returns: boolean
      }
      dosespot_rest_blocker: {
        Args: { caps: Json; gate: string; secret_refs: string[] }
        Returns: string
      }
      encounter_readiness: { Args: { p_encounter_id: string }; Returns: Json }
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_governance_role: {
        Args: { _hospital_id: string; _role: string; _user_id: string }
        Returns: boolean
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      is_my_hospital: { Args: { _hospital_id: string }; Returns: boolean }
      jsonb_is_true: { Args: { v: Json }; Returns: boolean }
      jsonb_nonempty_text: { Args: { v: Json }; Returns: boolean }
      launch_readiness: {
        Args: {
          p_hospital_id: string
          p_service_line_id: string
          p_state_code: string
        }
        Returns: Json
      }
      log_audit_event: {
        Args: {
          p_action_type: Database["public"]["Enums"]["audit_action_type"]
          p_hospital_id?: string
          p_ip_address?: unknown
          p_metadata?: Json
          p_patient_id?: string
          p_resource_id?: string
          p_resource_type: string
          p_session_id?: string
          p_user_agent?: string
        }
        Returns: string
      }
      obesity_intake_schema_blocker: {
        Args: { content: Json }
        Returns: string
      }
      obesity_intake_template: {
        Args: { p_encounter_id: string }
        Returns: Json
      }
      obesity_intake_template_for: {
        Args: { p_encounter_id: string }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          change_summary: string | null
          content: Json
          created_at: string
          created_by: string | null
          effective_end: string | null
          effective_start: string | null
          generated_by_ai: boolean
          hospital_id: string
          id: string
          kind: string
          lock_version: number
          next_review_date: string | null
          owner_user_id: string | null
          review_cadence_months: number
          scope: string | null
          service_line_id: string | null
          source_evidence: string | null
          state_code: string | null
          status: string
          supersedes_id: string | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "clinical_protocols"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      obesity_intake_template_scoped: {
        Args: {
          p_hospital_id: string
          p_service_line_id: string
          p_state_code: string
        }
        Returns: {
          approved_at: string | null
          approved_by: string | null
          change_summary: string | null
          content: Json
          created_at: string
          created_by: string | null
          effective_end: string | null
          effective_start: string | null
          generated_by_ai: boolean
          hospital_id: string
          id: string
          kind: string
          lock_version: number
          next_review_date: string | null
          owner_user_id: string | null
          review_cadence_months: number
          scope: string | null
          service_line_id: string | null
          source_evidence: string | null
          state_code: string | null
          status: string
          supersedes_id: string | null
          title: string
          updated_at: string
          version: number
        }
        SetofOptions: {
          from: "*"
          to: "clinical_protocols"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      obesity_launch_readiness: {
        Args: {
          p_controlled?: boolean
          p_hospital_id: string
          p_prescribing?: boolean
          p_service_line_id: string
          p_state_code: string
        }
        Returns: Json
      }
      obesity_launch_readiness_internal: {
        Args: {
          p_controlled?: boolean
          p_hospital_id: string
          p_prescribing?: boolean
          p_service_line_id: string
          p_state_code: string
        }
        Returns: Json
      }
      obesity_prescribing_readiness: {
        Args: { p_controlled?: boolean; p_encounter_id: string }
        Returns: Json
      }
      patient_in_my_hospital: {
        Args: { _patient_id: string }
        Returns: boolean
      }
      record_cash_pay: {
        Args: {
          p_action: string
          p_encounter_id: string
          p_payment_reference?: string
          p_reason?: string
        }
        Returns: Json
      }
      reopen_encounter: {
        Args: { p_encounter_id: string; p_reason: string }
        Returns: {
          allergy_review_at: string | null
          allergy_review_by: string | null
          billing_event_id: string | null
          callback_phone: string | null
          callback_verified_at: string | null
          check_in_at: string | null
          check_out_at: string | null
          chief_complaint: string | null
          completed_at: string | null
          completed_by: string | null
          consent_accepted_at: string | null
          consent_method: string | null
          consent_recorded_by: string | null
          consent_version: string | null
          created_at: string
          disposition: string | null
          duration_minutes: number | null
          encounter_type: Database["public"]["Enums"]["encounter_type"]
          follow_up_instructions: string | null
          hospital_id: string
          id: string
          identity_verification_method: string | null
          identity_verified_at: string | null
          identity_verified_by: string | null
          lock_version: number
          med_rec_by: string | null
          med_rec_completed_at: string | null
          patient_address_text: string | null
          patient_country: string | null
          patient_id: string
          patient_state_code: string | null
          provider_authorization_id: string | null
          provider_authorization_snapshot: Json | null
          provider_id: string
          room_number: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["encounter_status"]
          updated_at: string
          visit_reason: string | null
        }
        SetofOptions: {
          from: "*"
          to: "encounters"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      reset_demo_data: { Args: never; Returns: string }
      submit_obesity_intake: {
        Args: { p_answers: Json; p_encounter_id: string }
        Returns: Json
      }
    }
    Enums: {
      app_role: "admin" | "clinician" | "viewer"
      appointment_status:
        | "scheduled"
        | "confirmed"
        | "checked_in"
        | "completed"
        | "cancelled"
        | "no_show"
      attestor_role:
        | "independent_assessor"
        | "external_counsel"
        | "compliance_officer"
        | "medical_director"
        | "vendor"
      audit_action_type:
        | "view"
        | "create"
        | "update"
        | "delete"
        | "export"
        | "sign"
        | "approve"
        | "login"
        | "logout"
      billing_status: "pending" | "submitted" | "accepted" | "rejected"
      care_request_status:
        | "draft"
        | "submitted"
        | "waitlisted"
        | "triaged"
        | "scheduled"
        | "declined"
        | "cancelled"
      channel_type: "patient_care" | "department" | "consult"
      chat_role: "clinician" | "consultant" | "alis"
      claim_status:
        | "draft"
        | "scrubbed"
        | "approved"
        | "submission_pending"
        | "submitted"
        | "acknowledged"
        | "accepted"
        | "rejected"
        | "adjudicated"
        | "paid"
        | "denied"
        | "voided"
      compliance_applicability: "undetermined" | "applicable" | "not_applicable"
      compliance_status:
        | "not_started"
        | "in_progress"
        | "internally_ready"
        | "ready_for_external_test"
        | "externally_verified"
        | "not_applicable"
      consult_status: "pending" | "accepted" | "completed" | "cancelled"
      consult_urgency: "routine" | "urgent" | "stat"
      consultation_insight_target: "primary_clinician" | "specialist" | "shared"
      consultation_sender_role: "primary_clinician" | "specialist" | "ai"
      consultation_thread_status: "active" | "completed" | "cancelled"
      diagnostic_kind: "lab" | "imaging"
      diagnostic_order_status:
        | "draft"
        | "ready"
        | "transmission_pending"
        | "transmitted"
        | "acknowledged"
        | "errored"
        | "cancelled"
        | "resulted"
      diagnostic_result_status:
        | "preliminary"
        | "final"
        | "corrected"
        | "amended"
        | "cancelled"
      emr_system: "epic" | "meditech" | "cerner"
      encounter_status:
        | "scheduled"
        | "checked_in"
        | "in_progress"
        | "completed"
        | "cancelled"
        | "no_show"
      encounter_type:
        | "office_visit"
        | "telehealth"
        | "follow_up"
        | "annual_physical"
        | "urgent"
        | "procedure"
      note_status: "draft" | "pending_signature" | "signed" | "amended"
      note_type: "progress" | "consult" | "discharge" | "procedure"
      order_status:
        | "staged"
        | "approved"
        | "sent"
        | "cancelled"
        | "signed"
        | "pushed"
        | "push_failed"
        | "rejected"
      patient_type: "inpatient" | "outpatient" | "both"
      payer_preference: "insurance" | "self_pay" | "unknown"
      prescription_status:
        | "draft"
        | "signed"
        | "sent"
        | "filled"
        | "cancelled"
        | "ready_for_review"
        | "transmission_pending"
        | "transmitted"
        | "accepted"
        | "errored"
        | "discontinued"
      record_staging_status: "pending" | "accepted" | "rejected" | "corrected"
      referral_status:
        | "draft"
        | "sent"
        | "scheduled"
        | "completed"
        | "cancelled"
      referral_urgency: "routine" | "urgent" | "stat"
      service_availability_status: "available" | "waitlist" | "unavailable"
      team_message_type: "text" | "handoff" | "urgent" | "order_link"
      vendor_integration_state:
        | "not_contracted"
        | "baa_pending"
        | "sandbox_pending"
        | "sandbox_configured"
        | "certification_testing"
        | "production_review"
        | "production_verified"
        | "suspended"
      visit_modality: "video" | "phone" | "async" | "in_person"
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] &
        DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] &
        DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R
      }
      ? R
      : never
    : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I
      }
      ? I
      : never
    : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends (DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never) = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U
      }
      ? U
      : never
    : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends (DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never) = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends (PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never) = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never

export const Constants = {
  public: {
    Enums: {
      app_role: ["admin", "clinician", "viewer"],
      appointment_status: [
        "scheduled",
        "confirmed",
        "checked_in",
        "completed",
        "cancelled",
        "no_show",
      ],
      attestor_role: [
        "independent_assessor",
        "external_counsel",
        "compliance_officer",
        "medical_director",
        "vendor",
      ],
      audit_action_type: [
        "view",
        "create",
        "update",
        "delete",
        "export",
        "sign",
        "approve",
        "login",
        "logout",
      ],
      billing_status: ["pending", "submitted", "accepted", "rejected"],
      care_request_status: [
        "draft",
        "submitted",
        "waitlisted",
        "triaged",
        "scheduled",
        "declined",
        "cancelled",
      ],
      channel_type: ["patient_care", "department", "consult"],
      chat_role: ["clinician", "consultant", "alis"],
      claim_status: [
        "draft",
        "scrubbed",
        "approved",
        "submission_pending",
        "submitted",
        "acknowledged",
        "accepted",
        "rejected",
        "adjudicated",
        "paid",
        "denied",
        "voided",
      ],
      compliance_applicability: [
        "undetermined",
        "applicable",
        "not_applicable",
      ],
      compliance_status: [
        "not_started",
        "in_progress",
        "internally_ready",
        "ready_for_external_test",
        "externally_verified",
        "not_applicable",
      ],
      consult_status: ["pending", "accepted", "completed", "cancelled"],
      consult_urgency: ["routine", "urgent", "stat"],
      consultation_insight_target: [
        "primary_clinician",
        "specialist",
        "shared",
      ],
      consultation_sender_role: ["primary_clinician", "specialist", "ai"],
      consultation_thread_status: ["active", "completed", "cancelled"],
      diagnostic_kind: ["lab", "imaging"],
      diagnostic_order_status: [
        "draft",
        "ready",
        "transmission_pending",
        "transmitted",
        "acknowledged",
        "errored",
        "cancelled",
        "resulted",
      ],
      diagnostic_result_status: [
        "preliminary",
        "final",
        "corrected",
        "amended",
        "cancelled",
      ],
      emr_system: ["epic", "meditech", "cerner"],
      encounter_status: [
        "scheduled",
        "checked_in",
        "in_progress",
        "completed",
        "cancelled",
        "no_show",
      ],
      encounter_type: [
        "office_visit",
        "telehealth",
        "follow_up",
        "annual_physical",
        "urgent",
        "procedure",
      ],
      note_status: ["draft", "pending_signature", "signed", "amended"],
      note_type: ["progress", "consult", "discharge", "procedure"],
      order_status: [
        "staged",
        "approved",
        "sent",
        "cancelled",
        "signed",
        "pushed",
        "push_failed",
        "rejected",
      ],
      patient_type: ["inpatient", "outpatient", "both"],
      payer_preference: ["insurance", "self_pay", "unknown"],
      prescription_status: [
        "draft",
        "signed",
        "sent",
        "filled",
        "cancelled",
        "ready_for_review",
        "transmission_pending",
        "transmitted",
        "accepted",
        "errored",
        "discontinued",
      ],
      record_staging_status: ["pending", "accepted", "rejected", "corrected"],
      referral_status: ["draft", "sent", "scheduled", "completed", "cancelled"],
      referral_urgency: ["routine", "urgent", "stat"],
      service_availability_status: ["available", "waitlist", "unavailable"],
      team_message_type: ["text", "handoff", "urgent", "order_link"],
      vendor_integration_state: [
        "not_contracted",
        "baa_pending",
        "sandbox_pending",
        "sandbox_configured",
        "certification_testing",
        "production_review",
        "production_verified",
        "suspended",
      ],
      visit_modality: ["video", "phone", "async", "in_person"],
    },
  },
} as const
