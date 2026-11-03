// GENERATED from migrated PostgreSQL catalog by scripts/generate-types.mjs. Do not edit.
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];
export type Database = {
  public: {
    Tables: {
      absence_private_notes: {
        Row: {
          id: string;
          notes: string | null;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      activity_logs: {
        Row: {
          id: string;
          actor_id: string | null;
          action: string;
          entity: string;
          entity_id: string;
          before_data: Json | null;
          after_data: Json | null;
          created_at: string;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          actor_id?: string | null;
          action: string;
          entity: string;
          entity_id: string;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          actor_id?: string | null;
          action?: string;
          entity?: string;
          entity_id?: string;
          before_data?: Json | null;
          after_data?: Json | null;
          created_at?: string;
          workspace_id?: string;
        };
        Relationships: [];
      };
      contract_monthly_payments: {
        Row: {
          id: string;
          workspace_id: string;
          worker_id: string;
          month_start: string;
          salary_net: number;
          advance_net: number;
          notes: string;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          workspace_id?: string;
          worker_id: string;
          month_start: string;
          salary_net: number;
          advance_net?: number;
          notes?: string;
          created_by?: string;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          worker_id?: string;
          month_start?: string;
          salary_net?: number;
          advance_net?: number;
          notes?: string;
          created_by?: string;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      logbook_attachments: {
        Row: {
          id: string;
          entry_id: string;
          path: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          entry_id: string;
          path: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          entry_id?: string;
          path?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      logbook_entries: {
        Row: {
          id: string;
          title: string;
          description: string;
          type: string;
          period: string;
          entry_date: string;
          visibility: string;
          pinned: boolean;
          worker_id: string | null;
          shift_id: string | null;
          task_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          description: string;
          type?: string;
          period?: string;
          entry_date: string;
          visibility?: string;
          pinned?: boolean;
          worker_id?: string | null;
          shift_id?: string | null;
          task_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string;
          type?: string;
          period?: string;
          entry_date?: string;
          visibility?: string;
          pinned?: boolean;
          worker_id?: string | null;
          shift_id?: string | null;
          task_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      operation_requests: {
        Row: { id: string; actor_id: string; created_at: string; workspace_id: string };
        Insert: { id: string; actor_id?: string; created_at?: string; workspace_id?: string };
        Update: { id?: string; actor_id?: string; created_at?: string; workspace_id?: string };
        Relationships: [];
      };
      payment_entries: {
        Row: {
          id: string;
          workspace_id: string;
          worker_id: string;
          week_start: string;
          overtime_minutes: number;
          additions: number;
          deductions: number;
          contract_net: number | null;
          notes: string;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          workspace_id?: string;
          worker_id: string;
          week_start: string;
          overtime_minutes?: number;
          additions?: number;
          deductions?: number;
          contract_net?: number | null;
          notes?: string;
          created_by?: string;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          worker_id?: string;
          week_start?: string;
          overtime_minutes?: number;
          additions?: number;
          deductions?: number;
          contract_net?: number | null;
          notes?: string;
          created_by?: string;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      profiles: {
        Row: {
          id: string;
          worker_id: string | null;
          role: string;
          display_name: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id: string;
          worker_id?: string | null;
          role?: string;
          display_name: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          worker_id?: string | null;
          role?: string;
          display_name?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      shift_attendance: {
        Row: {
          id: string;
          workspace_id: string;
          shift_id: string;
          worker_id: string;
          status: string;
          notes: string;
          created_by: string;
          updated_by: string;
          created_at: string;
          updated_at: string;
          version: number;
        };
        Insert: {
          id?: string;
          workspace_id?: string;
          shift_id: string;
          worker_id: string;
          status: string;
          notes?: string;
          created_by?: string;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          workspace_id?: string;
          shift_id?: string;
          worker_id?: string;
          status?: string;
          notes?: string;
          created_by?: string;
          updated_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Relationships: [];
      };
      shift_series: {
        Row: {
          id: string;
          description: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          description: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          description?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      shift_types: {
        Row: {
          id: string;
          name: string;
          color: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      shifts: {
        Row: {
          id: string;
          worker_id: string | null;
          type_id: string;
          starts_at: string;
          ends_at: string;
          break_minutes: number;
          location: string | null;
          notes: string | null;
          status: string;
          series_id: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          worker_id?: string | null;
          type_id: string;
          starts_at: string;
          ends_at: string;
          break_minutes?: number;
          location?: string | null;
          notes?: string | null;
          status?: string;
          series_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          worker_id?: string | null;
          type_id?: string;
          starts_at?: string;
          ends_at?: string;
          break_minutes?: number;
          location?: string | null;
          notes?: string | null;
          status?: string;
          series_id?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      task_assignees: {
        Row: {
          id: string;
          task_id: string;
          worker_id: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          worker_id: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          worker_id?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      task_attachments: {
        Row: {
          id: string;
          task_id: string;
          path: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          path: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          path?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      task_comments: {
        Row: {
          id: string;
          task_id: string;
          body: string;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          task_id: string;
          body: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          task_id?: string;
          body?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      tasks: {
        Row: {
          id: string;
          title: string;
          description: string | null;
          priority: string;
          status: string;
          due_at: string | null;
          location: string | null;
          completed_at: string | null;
          completed_by: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          title: string;
          description?: string | null;
          priority?: string;
          status?: string;
          due_at?: string | null;
          location?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          title?: string;
          description?: string | null;
          priority?: string;
          status?: string;
          due_at?: string | null;
          location?: string | null;
          completed_at?: string | null;
          completed_by?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      worker_absences: {
        Row: {
          id: string;
          worker_id: string;
          type: string;
          all_day: boolean;
          start_date: string | null;
          end_date: string | null;
          starts_at: string | null;
          ends_at: string | null;
          shared_note: string | null;
          created_by: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          type: string;
          all_day?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          shared_note?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          type?: string;
          all_day?: boolean;
          start_date?: string | null;
          end_date?: string | null;
          starts_at?: string | null;
          ends_at?: string | null;
          shared_note?: string | null;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      worker_invitations: {
        Row: {
          id: string;
          worker_id: string;
          email: string;
          auth_user_id: string | null;
          status: string;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          worker_id: string;
          email: string;
          auth_user_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          worker_id?: string;
          email?: string;
          auth_user_id?: string | null;
          status?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      worker_private_details: {
        Row: {
          id: string;
          phone: string | null;
          email: string | null;
          notes: string | null;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
          employment_type: string | null;
        };
        Insert: {
          id: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
          employment_type?: string | null;
        };
        Update: {
          id?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
          employment_type?: string | null;
        };
        Relationships: [];
      };
      workers: {
        Row: {
          id: string;
          full_name: string;
          nickname: string | null;
          job_title: string | null;
          color: string;
          active: boolean;
          joined_on: string | null;
          avatar_path: string | null;
          created_at: string;
          updated_at: string;
          version: number;
          workspace_id: string;
        };
        Insert: {
          id?: string;
          full_name: string;
          nickname?: string | null;
          job_title?: string | null;
          color?: string;
          active?: boolean;
          joined_on?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Update: {
          id?: string;
          full_name?: string;
          nickname?: string | null;
          job_title?: string | null;
          color?: string;
          active?: boolean;
          joined_on?: string | null;
          avatar_path?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
          workspace_id?: string;
        };
        Relationships: [];
      };
      workspaces: {
        Row: { id: string; owner_id: string | null; name: string; created_at: string };
        Insert: { id: string; owner_id?: string | null; name: string; created_at?: string };
        Update: { id?: string; owner_id?: string | null; name?: string; created_at?: string };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      can_edit_entry: { Args: { target: string }; Returns: boolean };
      is_active: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      can_task: { Args: { target: string }; Returns: boolean };
      can_entry: { Args: { target: string }; Returns: boolean };
      save_shift_batch: {
        Args: { request_id: string; items: Json; series_description?: string };
        Returns: number;
      };
      team_authors: { Args: Record<string, never>; Returns: { user_id: string; name: string }[] };
      my_contact: {
        Args: Record<string, never>;
        Returns: { email: string | null; phone: string | null }[];
      };
      save_attendance: {
        Args: {
          target_shift: string;
          attendance_status: string;
          attendance_notes: string;
          expected_version: number;
        };
        Returns: undefined;
      };
      save_payment_entry: { Args: { payload: Json; expected_version: number }; Returns: undefined };
      set_avatar: { Args: { target_worker: string; object_path: string }; Returns: undefined };
      save_contract_month: {
        Args: { payload: Json; expected_version: number };
        Returns: undefined;
      };
      save_absence: { Args: { payload: Json; private_note: string }; Returns: string };
      my_worker_id: { Args: Record<string, never>; Returns: string };
      save_task: {
        Args: { payload: Json; assignees: string[]; expected_version?: number };
        Returns: string;
      };
      invitee_account: { Args: { target_worker: string }; Returns: string };
      save_worker: {
        Args: { payload: Json; private_data: Json; expected_version?: number };
        Returns: string;
      };
      grant_administrator: {
        Args: { account_email: string; administrator_name: string };
        Returns: string;
      };
      current_workspace: { Args: Record<string, never>; Returns: string };
      attendance_week: { Args: { week_start: string }; Returns: Json };
      payment_week: { Args: { week_start: string }; Returns: Json };
      contract_payment_month: { Args: { month_start: string }; Returns: Json };
      delete_operational_record: {
        Args: { record_kind: string; target_id: string; expected_version: number };
        Returns: Json;
      };
      dashboard_summary: { Args: { day: string; week_start: string }; Returns: Json };
      worker_impact: { Args: { target: string }; Returns: Json };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
