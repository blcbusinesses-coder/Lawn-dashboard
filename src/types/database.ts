export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          full_name: string
          role: 'owner' | 'employee'
          hourly_rate: number | null
          phone: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          full_name: string
          role: 'owner' | 'employee'
          hourly_rate?: number | null
          phone?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          role?: 'owner' | 'employee'
          hourly_rate?: number | null
          phone?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      customers: {
        Row: {
          id: string
          full_name: string
          email: string | null
          phone: string | null
          address: string | null
          notes: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          full_name: string
          email?: string | null
          phone?: string | null
          address?: string | null
          notes?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          full_name?: string
          email?: string | null
          phone?: string | null
          address?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      properties: {
        Row: {
          id: string
          customer_id: string
          address: string
          price_per_mow: number
          notes: string | null
          is_active: boolean
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          address: string
          price_per_mow?: number
          notes?: string | null
          is_active?: boolean
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          address?: string
          price_per_mow?: number
          notes?: string | null
          is_active?: boolean
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'properties_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          }
        ]
      }
      job_logs: {
        Row: {
          id: string
          property_id: string
          week_start: string
          status: 'done' | 'skipped'
          completed_by: string | null
          completed_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          property_id: string
          week_start: string
          status: 'done' | 'skipped'
          completed_by?: string | null
          completed_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          property_id?: string
          week_start?: string
          status?: 'done' | 'skipped'
          completed_by?: string | null
          completed_at?: string | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'job_logs_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          }
        ]
      }
      expenses: {
        Row: {
          id: string
          merchant: string
          amount: number
          category: string
          expense_date: string
          notes: string | null
          receipt_url: string | null
          raw_ocr_json: Json | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          merchant: string
          amount: number
          category?: string
          expense_date: string
          notes?: string | null
          receipt_url?: string | null
          raw_ocr_json?: Json | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          merchant?: string
          amount?: number
          category?: string
          expense_date?: string
          notes?: string | null
          receipt_url?: string | null
          raw_ocr_json?: Json | null
          updated_at?: string
        }
        Relationships: []
      }
      invoices: {
        Row: {
          id: string
          customer_id: string
          period_start: string
          period_end: string
          status: 'draft' | 'sent' | 'paid' | 'void'
          subtotal: number
          tax_rate: number
          tax_amount: number
          total_amount: number
          ai_message: string | null
          sent_at: string | null
          paid_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id: string
          period_start: string
          period_end: string
          status?: 'draft' | 'sent' | 'paid' | 'void'
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          ai_message?: string | null
          sent_at?: string | null
          paid_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string
          period_start?: string
          period_end?: string
          status?: 'draft' | 'sent' | 'paid' | 'void'
          subtotal?: number
          tax_rate?: number
          tax_amount?: number
          total_amount?: number
          ai_message?: string | null
          sent_at?: string | null
          paid_at?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'invoices_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          }
        ]
      }
      invoice_line_items: {
        Row: {
          id: string
          invoice_id: string
          property_id: string | null
          description: string
          quantity: number
          unit_price: number
          line_total: number
          created_at: string
        }
        Insert: {
          id?: string
          invoice_id: string
          property_id?: string | null
          description: string
          quantity?: number
          unit_price: number
          line_total?: number
          created_at?: string
        }
        Update: {
          id?: string
          invoice_id?: string
          property_id?: string | null
          description?: string
          quantity?: number
          unit_price?: number
          line_total?: number
        }
        Relationships: [
          {
            foreignKeyName: 'invoice_line_items_invoice_id_fkey'
            columns: ['invoice_id']
            isOneToOne: false
            referencedRelation: 'invoices'
            referencedColumns: ['id']
          }
        ]
      }
      time_logs: {
        Row: {
          id: string
          employee_id: string
          clock_in: string
          clock_out: string | null
          duration_minutes: number | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          employee_id: string
          clock_in: string
          clock_out?: string | null
          duration_minutes?: number | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          id?: string
          employee_id?: string
          clock_in?: string
          clock_out?: string | null
          duration_minutes?: number | null
          notes?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'time_logs_employee_id_fkey'
            columns: ['employee_id']
            isOneToOne: false
            referencedRelation: 'profiles'
            referencedColumns: ['id']
          }
        ]
      }
      sms_messages: {
        Row: {
          id: string
          customer_id: string | null
          to_phone: string
          body: string
          twilio_sid: string | null
          status: string | null
          sent_by: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          to_phone: string
          body: string
          twilio_sid?: string | null
          status?: string | null
          sent_by?: string | null
          sent_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          to_phone?: string
          body?: string
          twilio_sid?: string | null
          status?: string | null
          sent_by?: string | null
          sent_at?: string
        }
        Relationships: []
      }
      scheduled_tasks: {
        Row: {
          id: string
          title: string
          description: string | null
          trigger_type: 'once' | 'monthly' | 'weekly' | 'reminder'
          trigger_date: string | null
          action_type: string | null
          action_params: Json | null
          status: 'pending' | 'done' | 'cancelled'
          created_by: string | null
          created_at: string
        }
        Insert: {
          id?: string
          title: string
          description?: string | null
          trigger_type: 'once' | 'monthly' | 'weekly' | 'reminder'
          trigger_date?: string | null
          action_type?: string | null
          action_params?: Json | null
          status?: 'pending' | 'done' | 'cancelled'
          created_by?: string | null
          created_at?: string
        }
        Update: {
          title?: string
          description?: string | null
          trigger_type?: 'once' | 'monthly' | 'weekly' | 'reminder'
          trigger_date?: string | null
          action_type?: string | null
          action_params?: Json | null
          status?: 'pending' | 'done' | 'cancelled'
        }
        Relationships: []
      }
      one_off_jobs: {
        Row: {
          id: string
          customer_id: string | null
          property_id: string | null
          title: string
          description: string | null
          amount: number
          status: 'pending' | 'done' | 'cancelled'
          scheduled_date: string | null
          completed_date: string | null
          notes: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          customer_id?: string | null
          property_id?: string | null
          title: string
          description?: string | null
          amount?: number
          status?: 'pending' | 'done' | 'cancelled'
          scheduled_date?: string | null
          completed_date?: string | null
          notes?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          customer_id?: string | null
          property_id?: string | null
          title?: string
          description?: string | null
          amount?: number
          status?: 'pending' | 'done' | 'cancelled'
          scheduled_date?: string | null
          completed_date?: string | null
          notes?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'one_off_jobs_customer_id_fkey'
            columns: ['customer_id']
            isOneToOne: false
            referencedRelation: 'customers'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'one_off_jobs_property_id_fkey'
            columns: ['property_id']
            isOneToOne: false
            referencedRelation: 'properties'
            referencedColumns: ['id']
          }
        ]
      }
      leads: {
        Row: {
          id: string
          name: string
          phone: string
          email: string | null
          address: string
          preferred_date: string | null
          status: 'new' | 'quoted' | 'converted' | 'lost'
          property_data: Json | null
          lot_size_sqft: number | null
          quoted_amount: number | null
          quote_sent_at: string | null
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          phone: string
          email?: string | null
          address: string
          preferred_date?: string | null
          status?: 'new' | 'quoted' | 'converted' | 'lost'
          property_data?: Json | null
          lot_size_sqft?: number | null
          quoted_amount?: number | null
          quote_sent_at?: string | null
          notes?: string | null
          created_at?: string
        }
        Update: {
          name?: string
          phone?: string
          email?: string | null
          address?: string
          preferred_date?: string | null
          status?: 'new' | 'quoted' | 'converted' | 'lost'
          property_data?: Json | null
          lot_size_sqft?: number | null
          quoted_amount?: number | null
          quote_sent_at?: string | null
          notes?: string | null
        }
        Relationships: []
      }
      availability_dates: {
        Row: {
          id: string
          available_date: string
          notes: string | null
          created_at: string
        }
        Insert: {
          id?: string
          available_date: string
          notes?: string | null
          created_at?: string
        }
        Update: {
          available_date?: string
          notes?: string | null
        }
        Relationships: []
      }
      conversations: {
        Row: {
          id: string
          phone: string
          lead_id: string | null
          customer_id: string | null
          display_name: string | null
          ai_enabled: boolean
          ai_state: string
          last_message_at: string | null
          unread_count: number
          created_at: string
        }
        Insert: {
          id?: string
          phone: string
          lead_id?: string | null
          customer_id?: string | null
          display_name?: string | null
          ai_enabled?: boolean
          ai_state?: string
          last_message_at?: string | null
          unread_count?: number
          created_at?: string
        }
        Update: {
          phone?: string
          lead_id?: string | null
          customer_id?: string | null
          display_name?: string | null
          ai_enabled?: boolean
          ai_state?: string
          last_message_at?: string | null
          unread_count?: number
        }
        Relationships: []
      }
      conversation_messages: {
        Row: {
          id: string
          conversation_id: string
          direction: 'inbound' | 'outbound'
          body: string
          twilio_sid: string | null
          status: string | null
          sent_at: string
        }
        Insert: {
          id?: string
          conversation_id: string
          direction: 'inbound' | 'outbound'
          body: string
          twilio_sid?: string | null
          status?: string | null
          sent_at?: string
        }
        Update: {
          direction?: 'inbound' | 'outbound'
          body?: string
          twilio_sid?: string | null
          status?: string | null
        }
        Relationships: [
          {
            foreignKeyName: 'conversation_messages_conversation_id_fkey'
            columns: ['conversation_id']
            isOneToOne: false
            referencedRelation: 'conversations'
            referencedColumns: ['id']
          }
        ]
      }
      important_items: {
        Row: {
          id: string
          type: 'document' | 'instruction' | 'link'
          title: string
          body: string | null
          url: string | null
          file_name: string | null
          file_size: number | null
          file_mime: string | null
          created_by: string | null
          sort_order: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          type: 'document' | 'instruction' | 'link'
          title: string
          body?: string | null
          url?: string | null
          file_name?: string | null
          file_size?: number | null
          file_mime?: string | null
          created_by?: string | null
          sort_order?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          type?: 'document' | 'instruction' | 'link'
          title?: string
          body?: string | null
          url?: string | null
          file_name?: string | null
          file_size?: number | null
          file_mime?: string | null
          sort_order?: number
          updated_at?: string
        }
        Relationships: []
      }
    }
    Views: Record<string, never>
    Functions: {
      get_my_role: {
        Args: Record<string, never>
        Returns: string
      }
    }
    Enums: Record<string, never>
  }
}
