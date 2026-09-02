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
  graphql_public: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      graphql: {
        Args: {
          extensions?: Json
          operationName?: string
          query?: string
          variables?: Json
        }
        Returns: Json
      }
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
  public: {
    Tables: {
      appointments: {
        Row: {
          appointment_date: string
          assigned_professional: string | null
          consultation_reason: string | null
          converted_beneficiary_id: string | null
          created_at: string
          deposit_amount: number
          email: string | null
          id: string
          organization_id: string
          patient_name: string
          phone: string | null
          representative_identification: string | null
          representative_name: string
          status: string
          therapy_type: string
          time_slot: string
          updated_at: string
        }
        Insert: {
          appointment_date: string
          assigned_professional?: string | null
          consultation_reason?: string | null
          converted_beneficiary_id?: string | null
          created_at?: string
          deposit_amount?: number
          email?: string | null
          id?: string
          organization_id: string
          patient_name: string
          phone?: string | null
          representative_identification?: string | null
          representative_name: string
          status?: string
          therapy_type?: string
          time_slot?: string
          updated_at?: string
        }
        Update: {
          appointment_date?: string
          assigned_professional?: string | null
          consultation_reason?: string | null
          converted_beneficiary_id?: string | null
          created_at?: string
          deposit_amount?: number
          email?: string | null
          id?: string
          organization_id?: string
          patient_name?: string
          phone?: string | null
          representative_identification?: string | null
          representative_name?: string
          status?: string
          therapy_type?: string
          time_slot?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "appointments_converted_beneficiary_id_fkey"
            columns: ["converted_beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "appointments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      attendance: {
        Row: {
          actual_arrival_time: string | null
          beneficiary_id: string
          created_at: string
          enrollment_schedule_id: string | null
          id: string
          notes: string | null
          organization_id: string
          recorded_by: string | null
          representative_signature: boolean | null
          scheduled_time: string | null
          service_id: string | null
          session_date: string
          status: string
          therapy_type: string | null
        }
        Insert: {
          actual_arrival_time?: string | null
          beneficiary_id: string
          created_at?: string
          enrollment_schedule_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          recorded_by?: string | null
          representative_signature?: boolean | null
          scheduled_time?: string | null
          service_id?: string | null
          session_date?: string
          status?: string
          therapy_type?: string | null
        }
        Update: {
          actual_arrival_time?: string | null
          beneficiary_id?: string
          created_at?: string
          enrollment_schedule_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          recorded_by?: string | null
          representative_signature?: boolean | null
          scheduled_time?: string | null
          service_id?: string | null
          session_date?: string
          status?: string
          therapy_type?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "attendance_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_enrollment_schedule_id_fkey"
            columns: ["enrollment_schedule_id"]
            isOneToOne: false
            referencedRelation: "enrollment_schedules"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "attendance_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      audit_logs: {
        Row: {
          action: string
          created_at: string
          entity: string
          entity_id: string
          id: string
          organization_id: string
          user_id: string | null
        }
        Insert: {
          action: string
          created_at?: string
          entity: string
          entity_id: string
          id?: string
          organization_id: string
          user_id?: string | null
        }
        Update: {
          action?: string
          created_at?: string
          entity?: string
          entity_id?: string
          id?: string
          organization_id?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "audit_logs_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "audit_logs_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiaries: {
        Row: {
          birth_date: string | null
          consultation_reason: string | null
          created_at: string
          first_name: string
          id: string
          is_active: boolean
          last_name: string
          notes: string | null
          organization_id: string
          photo_consent: boolean | null
          photo_url: string | null
          updated_at: string
        }
        Insert: {
          birth_date?: string | null
          consultation_reason?: string | null
          created_at?: string
          first_name: string
          id?: string
          is_active?: boolean
          last_name: string
          notes?: string | null
          organization_id: string
          photo_consent?: boolean | null
          photo_url?: string | null
          updated_at?: string
        }
        Update: {
          birth_date?: string | null
          consultation_reason?: string | null
          created_at?: string
          first_name?: string
          id?: string
          is_active?: boolean
          last_name?: string
          notes?: string | null
          organization_id?: string
          photo_consent?: boolean | null
          photo_url?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiaries_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      beneficiary_representatives: {
        Row: {
          beneficiary_id: string
          created_at: string
          is_primary: boolean
          representative_id: string
        }
        Insert: {
          beneficiary_id: string
          created_at?: string
          is_primary?: boolean
          representative_id: string
        }
        Update: {
          beneficiary_id?: string
          created_at?: string
          is_primary?: boolean
          representative_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "beneficiary_representatives_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "beneficiary_representatives_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      charges: {
        Row: {
          amount: number
          beneficiary_id: string | null
          created_at: string
          description: string
          due_date: string | null
          enrollment_id: string | null
          id: string
          notes: string | null
          organization_id: string
          period_label: string | null
          service_id: string | null
          status: string
          updated_at: string
        }
        Insert: {
          amount: number
          beneficiary_id?: string | null
          created_at?: string
          description: string
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          period_label?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount?: number
          beneficiary_id?: string | null
          created_at?: string
          description?: string
          due_date?: string | null
          enrollment_id?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          period_label?: string | null
          service_id?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "charges_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "charges_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      commitments: {
        Row: {
          beneficiary_id: string
          created_at: string
          id: string
          max_justified_absences: number
          organization_id: string
          payment_frequency: string
          photo_consent: boolean
          representative_id: string | null
          schedule_label: string | null
          selected_therapies: Json
          session_duration_minutes: number
          signed_at: string | null
          status: string
          updated_at: string
        }
        Insert: {
          beneficiary_id: string
          created_at?: string
          id?: string
          max_justified_absences?: number
          organization_id: string
          payment_frequency?: string
          photo_consent?: boolean
          representative_id?: string | null
          schedule_label?: string | null
          selected_therapies?: Json
          session_duration_minutes?: number
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Update: {
          beneficiary_id?: string
          created_at?: string
          id?: string
          max_justified_absences?: number
          organization_id?: string
          payment_frequency?: string
          photo_consent?: boolean
          representative_id?: string | null
          schedule_label?: string | null
          selected_therapies?: Json
          session_duration_minutes?: number
          signed_at?: string | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "commitments_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "commitments_representative_id_fkey"
            columns: ["representative_id"]
            isOneToOne: false
            referencedRelation: "representatives"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_schedules: {
        Row: {
          created_at: string
          day_of_week: number
          end_time: string
          enrollment_service_id: string
          id: string
          is_active: boolean
          organization_id: string
          start_time: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          day_of_week: number
          end_time: string
          enrollment_service_id: string
          id?: string
          is_active?: boolean
          organization_id: string
          start_time: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          day_of_week?: number
          end_time?: string
          enrollment_service_id?: string
          id?: string
          is_active?: boolean
          organization_id?: string
          start_time?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_schedules_enrollment_service_id_fkey"
            columns: ["enrollment_service_id"]
            isOneToOne: false
            referencedRelation: "enrollment_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_schedules_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollment_services: {
        Row: {
          created_at: string
          enrollment_id: string
          id: string
          notes: string | null
          service_id: string
          session_duration_min: number
          sessions_completed: number
          sessions_per_week: number
          status: string
          total_sessions: number | null
          unit_price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          enrollment_id: string
          id?: string
          notes?: string | null
          service_id: string
          session_duration_min?: number
          sessions_completed?: number
          sessions_per_week?: number
          status?: string
          total_sessions?: number | null
          unit_price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          enrollment_id?: string
          id?: string
          notes?: string | null
          service_id?: string
          session_duration_min?: number
          sessions_completed?: number
          sessions_per_week?: number
          status?: string
          total_sessions?: number | null
          unit_price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollment_services_enrollment_id_fkey"
            columns: ["enrollment_id"]
            isOneToOne: false
            referencedRelation: "enrollments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollment_services_service_id_fkey"
            columns: ["service_id"]
            isOneToOne: false
            referencedRelation: "services"
            referencedColumns: ["id"]
          },
        ]
      }
      enrollments: {
        Row: {
          beneficiary_id: string
          created_at: string
          end_date: string | null
          id: string
          notes: string | null
          organization_id: string
          start_date: string
          status: string
          updated_at: string
        }
        Insert: {
          beneficiary_id: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          organization_id: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Update: {
          beneficiary_id?: string
          created_at?: string
          end_date?: string | null
          id?: string
          notes?: string | null
          organization_id?: string
          start_date?: string
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "enrollments_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "enrollments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      internal_payments: {
        Row: {
          amount: number
          charge_id: string
          created_at: string
          created_by: string | null
          id: string
          method: string | null
          notes: string | null
          organization_id: string
          payment_date: string
          reference: string | null
          sri_document_id: string | null
          voided_at: string | null
          voided_by: string | null
          voided_reason: string | null
        }
        Insert: {
          amount: number
          charge_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          organization_id: string
          payment_date?: string
          reference?: string | null
          sri_document_id?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Update: {
          amount?: number
          charge_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          method?: string | null
          notes?: string | null
          organization_id?: string
          payment_date?: string
          reference?: string | null
          sri_document_id?: string | null
          voided_at?: string | null
          voided_by?: string | null
          voided_reason?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "internal_payments_charge_id_fkey"
            columns: ["charge_id"]
            isOneToOne: false
            referencedRelation: "charges"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "internal_payments_sri_document_id_fkey"
            columns: ["sri_document_id"]
            isOneToOne: false
            referencedRelation: "sri_documents"
            referencedColumns: ["id"]
          },
        ]
      }
      invitations: {
        Row: {
          accepted_at: string | null
          accepted_by: string | null
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: string
          token_hash: string
        }
        Insert: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: string
          token_hash: string
        }
        Update: {
          accepted_at?: string | null
          accepted_by?: string | null
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: string
          token_hash?: string
        }
        Relationships: [
          {
            foreignKeyName: "invitations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      organization_members: {
        Row: {
          created_at: string
          id: string
          organization_id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          organization_id: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          organization_id?: string
          role?: Database["public"]["Enums"]["organization_role"]
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "organization_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      organizations: {
        Row: {
          address: string | null
          city: string | null
          created_at: string
          email: string | null
          id: string
          name: string
          phone: string | null
          ruc: string | null
          updated_at: string
        }
        Insert: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name: string
          phone?: string | null
          ruc?: string | null
          updated_at?: string
        }
        Update: {
          address?: string | null
          city?: string | null
          created_at?: string
          email?: string | null
          id?: string
          name?: string
          phone?: string | null
          ruc?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount: number
          billing_cycle: string | null
          created_at: string
          id: string
          notes: string | null
          organization_id: string
          payment_date: string
          reference: string | null
          status: string
        }
        Insert: {
          amount: number
          billing_cycle?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id: string
          payment_date?: string
          reference?: string | null
          status?: string
        }
        Update: {
          amount?: number
          billing_cycle?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          organization_id?: string
          payment_date?: string
          reference?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      platform_admins: {
        Row: {
          created_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          user_id?: string
        }
        Relationships: []
      }
      platform_settings: {
        Row: {
          brevo_api_key: string | null
          brevo_sender_email: string | null
          brevo_sender_name: string | null
          id: boolean
          iva_percentage: number
          updated_at: string
        }
        Insert: {
          brevo_api_key?: string | null
          brevo_sender_email?: string | null
          brevo_sender_name?: string | null
          id?: boolean
          iva_percentage?: number
          updated_at?: string
        }
        Update: {
          brevo_api_key?: string | null
          brevo_sender_email?: string | null
          brevo_sender_name?: string | null
          id?: boolean
          iva_percentage?: number
          updated_at?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          first_name: string
          id: string
          last_name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          first_name: string
          id: string
          last_name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          first_name?: string
          id?: string
          last_name?: string
          updated_at?: string
        }
        Relationships: []
      }
      representatives: {
        Row: {
          created_at: string
          email: string | null
          first_name: string
          id: string
          identification: string | null
          is_active: boolean
          last_name: string
          notes: string | null
          organization_id: string
          phone: string | null
          relationship: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          email?: string | null
          first_name: string
          id?: string
          identification?: string | null
          is_active?: boolean
          last_name: string
          notes?: string | null
          organization_id: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          email?: string | null
          first_name?: string
          id?: string
          identification?: string | null
          is_active?: boolean
          last_name?: string
          notes?: string | null
          organization_id?: string
          phone?: string | null
          relationship?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "representatives_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      services: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_active: boolean
          name: string
          organization_id: string
          price: number
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name: string
          organization_id: string
          price?: number
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_active?: boolean
          name?: string
          organization_id?: string
          price?: number
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "services_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      session_notes: {
        Row: {
          attendance_id: string | null
          beneficiary_id: string
          created_at: string
          created_by: string | null
          enrollment_service_id: string | null
          goals_achieved: string | null
          id: string
          next_steps: string | null
          observations: string | null
          organization_id: string
          rating: number | null
          session_date: string
          therapist_name: string | null
          updated_at: string
        }
        Insert: {
          attendance_id?: string | null
          beneficiary_id: string
          created_at?: string
          created_by?: string | null
          enrollment_service_id?: string | null
          goals_achieved?: string | null
          id?: string
          next_steps?: string | null
          observations?: string | null
          organization_id: string
          rating?: number | null
          session_date?: string
          therapist_name?: string | null
          updated_at?: string
        }
        Update: {
          attendance_id?: string | null
          beneficiary_id?: string
          created_at?: string
          created_by?: string | null
          enrollment_service_id?: string | null
          goals_achieved?: string | null
          id?: string
          next_steps?: string | null
          observations?: string | null
          organization_id?: string
          rating?: number | null
          session_date?: string
          therapist_name?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "session_notes_attendance_id_fkey"
            columns: ["attendance_id"]
            isOneToOne: false
            referencedRelation: "attendance"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_beneficiary_id_fkey"
            columns: ["beneficiary_id"]
            isOneToOne: false
            referencedRelation: "beneficiaries"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_enrollment_service_id_fkey"
            columns: ["enrollment_service_id"]
            isOneToOne: false
            referencedRelation: "enrollment_services"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "session_notes_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sri_configurations: {
        Row: {
          cert_password_encrypted: string | null
          cert_storage_path: string | null
          cert_uploaded_at: string | null
          created_at: string
          environment: string
          establecimiento: string
          id: string
          organization_id: string
          punto_emision: string
          regimen_fiscal: string
          sri_api_emisor_id: string | null
          updated_at: string
        }
        Insert: {
          cert_password_encrypted?: string | null
          cert_storage_path?: string | null
          cert_uploaded_at?: string | null
          created_at?: string
          environment: string
          establecimiento?: string
          id?: string
          organization_id: string
          punto_emision?: string
          regimen_fiscal?: string
          sri_api_emisor_id?: string | null
          updated_at?: string
        }
        Update: {
          cert_password_encrypted?: string | null
          cert_storage_path?: string | null
          cert_uploaded_at?: string | null
          created_at?: string
          environment?: string
          establecimiento?: string
          id?: string
          organization_id?: string
          punto_emision?: string
          regimen_fiscal?: string
          sri_api_emisor_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sri_configurations_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sri_documents: {
        Row: {
          authorization_date: string | null
          authorization_number: string | null
          clave_acceso: string | null
          cliente_email: string | null
          cliente_identificacion: string
          cliente_razon_social: string | null
          created_at: string
          document_type: string
          documento_modificado_id: string | null
          email_sent_at: string | null
          email_sent_to: string | null
          environment_aplicado: string
          fecha_emision: string
          id: string
          motivo: string | null
          organization_id: string
          pdf_url: string | null
          regimen_fiscal_aplicado: string
          secuencial: string
          status: string
          total: number
          updated_at: string
          xml_url: string | null
        }
        Insert: {
          authorization_date?: string | null
          authorization_number?: string | null
          clave_acceso?: string | null
          cliente_email?: string | null
          cliente_identificacion: string
          cliente_razon_social?: string | null
          created_at?: string
          document_type?: string
          documento_modificado_id?: string | null
          email_sent_at?: string | null
          email_sent_to?: string | null
          environment_aplicado?: string
          fecha_emision?: string
          id?: string
          motivo?: string | null
          organization_id: string
          pdf_url?: string | null
          regimen_fiscal_aplicado?: string
          secuencial: string
          status?: string
          total?: number
          updated_at?: string
          xml_url?: string | null
        }
        Update: {
          authorization_date?: string | null
          authorization_number?: string | null
          clave_acceso?: string | null
          cliente_email?: string | null
          cliente_identificacion?: string
          cliente_razon_social?: string | null
          created_at?: string
          document_type?: string
          documento_modificado_id?: string | null
          email_sent_at?: string | null
          email_sent_to?: string | null
          environment_aplicado?: string
          fecha_emision?: string
          id?: string
          motivo?: string | null
          organization_id?: string
          pdf_url?: string | null
          regimen_fiscal_aplicado?: string
          secuencial?: string
          status?: string
          total?: number
          updated_at?: string
          xml_url?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "sri_documents_documento_modificado_id_fkey"
            columns: ["documento_modificado_id"]
            isOneToOne: false
            referencedRelation: "sri_documents"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "sri_documents_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      sri_emission_sequences: {
        Row: {
          document_type: string
          establecimiento: string
          id: string
          last_sequence: number
          organization_id: string
          punto_emision: string
          updated_at: string
        }
        Insert: {
          document_type?: string
          establecimiento: string
          id?: string
          last_sequence?: number
          organization_id: string
          punto_emision: string
          updated_at?: string
        }
        Update: {
          document_type?: string
          establecimiento?: string
          id?: string
          last_sequence?: number
          organization_id?: string
          punto_emision?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "sri_emission_sequences_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: false
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          created_at: string
          features: Json | null
          id: string
          max_members: number | null
          name: string
          price_annual: number | null
          price_monthly: number | null
        }
        Insert: {
          created_at?: string
          features?: Json | null
          id?: string
          max_members?: number | null
          name: string
          price_annual?: number | null
          price_monthly?: number | null
        }
        Update: {
          created_at?: string
          features?: Json | null
          id?: string
          max_members?: number | null
          name?: string
          price_annual?: number | null
          price_monthly?: number | null
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          created_at: string
          current_period_end: string | null
          id: string
          organization_id: string
          plan_id: string
          status: string
          trial_end: string | null
          trial_start: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id: string
          plan_id: string
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          current_period_end?: string | null
          id?: string
          organization_id?: string
          plan_id?: string
          status?: string
          trial_end?: string | null
          trial_start?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_organization_id_fkey"
            columns: ["organization_id"]
            isOneToOne: true
            referencedRelation: "organizations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      accept_invitation: { Args: { p_token: string }; Returns: string }
      cancel_invitation: {
        Args: { p_invitation_id: string }
        Returns: undefined
      }
      create_invitation: {
        Args: {
          p_email: string
          p_organization_id: string
          p_role: Database["public"]["Enums"]["organization_role"]
        }
        Returns: string
      }
      create_organization: { Args: { org_name: string }; Returns: string }
      get_organization_invitations: {
        Args: { p_organization_id: string }
        Returns: {
          created_at: string
          email: string
          expires_at: string
          id: string
          role: Database["public"]["Enums"]["organization_role"]
          status: string
        }[]
      }
      get_organization_users: {
        Args: { p_organization_id: string }
        Returns: {
          created_at: string
          email: string
          first_name: string
          id: string
          last_name: string
          role: Database["public"]["Enums"]["organization_role"]
          status: string
        }[]
      }
      has_organization_role: {
        Args: {
          org_id: string
          required_roles: Database["public"]["Enums"]["organization_role"][]
        }
        Returns: boolean
      }
      is_organization_active: { Args: { p_org_id: string }; Returns: boolean }
      is_platform_admin: { Args: { p_user_id?: string }; Returns: boolean }
      superadmin_assign_plan: {
        Args: { p_org_id: string; p_plan_id: string }
        Returns: undefined
      }
      superadmin_create_organization: {
        Args: { p_org_name: string; p_plan_id?: string }
        Returns: string
      }
      superadmin_register_payment:
        | {
            Args: {
              p_amount: number
              p_billing_cycle: string
              p_notes: string
              p_org_id: string
              p_reference: string
            }
            Returns: string
          }
        | {
            Args: {
              p_amount: number
              p_notes: string
              p_org_id: string
              p_reference: string
            }
            Returns: string
          }
      superadmin_set_subscription_status: {
        Args: { p_org_id: string; p_status: string }
        Returns: undefined
      }
      superadmin_upsert_plan: {
        Args: {
          p_has_electronic_billing: boolean
          p_max_members: number
          p_name: string
          p_plan_id: string
          p_price_annual: number
          p_price_monthly: number
        }
        Returns: string
      }
    }
    Enums: {
      organization_role: "owner" | "admin" | "professional" | "staff"
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
  graphql_public: {
    Enums: {},
  },
  public: {
    Enums: {
      organization_role: ["owner", "admin", "professional", "staff"],
    },
  },
} as const
