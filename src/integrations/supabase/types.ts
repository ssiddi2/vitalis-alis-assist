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
    PostgrestVersion: "14.1"
  }
  public: {
    Tables: {
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
      clinical_notes: {
        Row: {
          author_id: string | null
          content: Json
          conversation_id: string | null
          created_at: string
          encounter_id: string | null
          id: string
          note_type: Database["public"]["Enums"]["note_type"]
          patient_id: string
          signed_at: string | null
          status: Database["public"]["Enums"]["note_status"]
          updated_at: string
        }
        Insert: {
          author_id?: string | null
          content?: Json
          conversation_id?: string | null
          created_at?: string
          encounter_id?: string | null
          id?: string
          note_type?: Database["public"]["Enums"]["note_type"]
          patient_id: string
          signed_at?: string | null
          status?: Database["public"]["Enums"]["note_status"]
          updated_at?: string
        }
        Update: {
          author_id?: string | null
          content?: Json
          conversation_id?: string | null
          created_at?: string
          encounter_id?: string | null
          id?: string
          note_type?: Database["public"]["Enums"]["note_type"]
          patient_id?: string
          signed_at?: string | null
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
      consult_requests: {
        Row: {
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
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          id?: string
          is_read?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          id?: string
          is_read?: boolean
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
      encounters: {
        Row: {
          billing_event_id: string | null
          check_in_at: string | null
          check_out_at: string | null
          chief_complaint: string | null
          created_at: string
          duration_minutes: number | null
          encounter_type: Database["public"]["Enums"]["encounter_type"]
          hospital_id: string
          id: string
          patient_id: string
          provider_id: string
          room_number: string | null
          scheduled_at: string | null
          status: Database["public"]["Enums"]["encounter_status"]
          updated_at: string
          visit_reason: string | null
        }
        Insert: {
          billing_event_id?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          chief_complaint?: string | null
          created_at?: string
          duration_minutes?: number | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"]
          hospital_id: string
          id?: string
          patient_id: string
          provider_id: string
          room_number?: string | null
          scheduled_at?: string | null
          status?: Database["public"]["Enums"]["encounter_status"]
          updated_at?: string
          visit_reason?: string | null
        }
        Update: {
          billing_event_id?: string | null
          check_in_at?: string | null
          check_out_at?: string | null
          chief_complaint?: string | null
          created_at?: string
          duration_minutes?: number | null
          encounter_type?: Database["public"]["Enums"]["encounter_type"]
          hospital_id?: string
          id?: string
          patient_id?: string
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
      imaging_studies: {
        Row: {
          accession_number: string | null
          body_part: string | null
          created_at: string
          id: string
          impression: string | null
          modality: string | null
          patient_id: string
          reading_radiologist: string | null
          report_text: string | null
          status: string
          study_date: string
          study_type: string
          updated_at: string
          viewer_url: string | null
        }
        Insert: {
          accession_number?: string | null
          body_part?: string | null
          created_at?: string
          id?: string
          impression?: string | null
          modality?: string | null
          patient_id: string
          reading_radiologist?: string | null
          report_text?: string | null
          status?: string
          study_date?: string
          study_type: string
          updated_at?: string
          viewer_url?: string | null
        }
        Update: {
          accession_number?: string | null
          body_part?: string | null
          created_at?: string
          id?: string
          impression?: string | null
          modality?: string | null
          patient_id?: string
          reading_radiologist?: string | null
          report_text?: string | null
          status?: string
          study_date?: string
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
      prescriptions: {
        Row: {
          created_at: string
          dea_schedule: string | null
          dose: string | null
          encounter_id: string | null
          end_date: string | null
          frequency: string | null
          id: string
          medication_name: string
          patient_id: string
          pharmacy_name: string | null
          pharmacy_npi: string | null
          prescriber_id: string
          quantity: number | null
          refills: number | null
          route: string | null
          sig: string | null
          start_date: string | null
          status: Database["public"]["Enums"]["prescription_status"]
          updated_at: string
        }
        Insert: {
          created_at?: string
          dea_schedule?: string | null
          dose?: string | null
          encounter_id?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          medication_name: string
          patient_id: string
          pharmacy_name?: string | null
          pharmacy_npi?: string | null
          prescriber_id: string
          quantity?: number | null
          refills?: number | null
          route?: string | null
          sig?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["prescription_status"]
          updated_at?: string
        }
        Update: {
          created_at?: string
          dea_schedule?: string | null
          dose?: string | null
          encounter_id?: string | null
          end_date?: string | null
          frequency?: string | null
          id?: string
          medication_name?: string
          patient_id?: string
          pharmacy_name?: string | null
          pharmacy_npi?: string | null
          prescriber_id?: string
          quantity?: number | null
          refills?: number | null
          route?: string | null
          sig?: string | null
          start_date?: string | null
          status?: Database["public"]["Enums"]["prescription_status"]
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
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      get_user_role: {
        Args: { _user_id: string }
        Returns: Database["public"]["Enums"]["app_role"]
      }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
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
      channel_type: "patient_care" | "department" | "consult"
      chat_role: "clinician" | "consultant" | "alis"
      consult_status: "pending" | "accepted" | "completed" | "cancelled"
      consult_urgency: "routine" | "urgent" | "stat"
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
      order_status: "staged" | "approved" | "sent" | "cancelled"
      patient_type: "inpatient" | "outpatient" | "both"
      prescription_status: "draft" | "signed" | "sent" | "filled" | "cancelled"
      referral_status:
        | "draft"
        | "sent"
        | "scheduled"
        | "completed"
        | "cancelled"
      referral_urgency: "routine" | "urgent" | "stat"
      team_message_type: "text" | "handoff" | "urgent" | "order_link"
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
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
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
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
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
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
      channel_type: ["patient_care", "department", "consult"],
      chat_role: ["clinician", "consultant", "alis"],
      consult_status: ["pending", "accepted", "completed", "cancelled"],
      consult_urgency: ["routine", "urgent", "stat"],
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
      order_status: ["staged", "approved", "sent", "cancelled"],
      patient_type: ["inpatient", "outpatient", "both"],
      prescription_status: ["draft", "signed", "sent", "filled", "cancelled"],
      referral_status: ["draft", "sent", "scheduled", "completed", "cancelled"],
      referral_urgency: ["routine", "urgent", "stat"],
      team_message_type: ["text", "handoff", "urgent", "order_link"],
    },
  },
} as const
