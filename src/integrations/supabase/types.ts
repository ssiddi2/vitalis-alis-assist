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
          cpt_codes: string[] | null
          created_at: string
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
          cpt_codes?: string[] | null
          created_at?: string
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
          cpt_codes?: string[] | null
          created_at?: string
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
            foreignKeyName: "clinical_notes_patient_id_fkey"
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
      patients: {
        Row: {
          admission_day: number
          admission_diagnosis: string | null
          age: number
          attending_physician: string | null
          bed: string
          care_team: Json | null
          created_at: string
          expected_los: number
          hospital_id: string | null
          id: string
          location: string
          mrn: string
          name: string
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
          bed: string
          care_team?: Json | null
          created_at?: string
          expected_los?: number
          hospital_id?: string | null
          id?: string
          location: string
          mrn: string
          name: string
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
          bed?: string
          care_team?: Json | null
          created_at?: string
          expected_los?: number
          hospital_id?: string | null
          id?: string
          location?: string
          mrn?: string
          name?: string
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
      staged_orders: {
        Row: {
          conversation_id: string | null
          created_at: string
          created_by: string | null
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
            foreignKeyName: "staged_orders_patient_id_fkey"
            columns: ["patient_id"]
            isOneToOne: false
            referencedRelation: "patients"
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
      log_audit_event:
        | {
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
        | {
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
      chat_role: "clinician" | "consultant" | "alis"
      emr_system: "epic" | "meditech" | "cerner"
      note_status: "draft" | "pending_signature" | "signed" | "amended"
      note_type: "progress" | "consult" | "discharge" | "procedure"
      order_status: "staged" | "approved" | "sent" | "cancelled"
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
      chat_role: ["clinician", "consultant", "alis"],
      emr_system: ["epic", "meditech", "cerner"],
      note_status: ["draft", "pending_signature", "signed", "amended"],
      note_type: ["progress", "consult", "discharge", "procedure"],
      order_status: ["staged", "approved", "sent", "cancelled"],
    },
  },
} as const
