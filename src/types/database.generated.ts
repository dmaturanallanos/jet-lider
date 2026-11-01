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
        };
        Insert: {
          id: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
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
        };
        Insert: {
          id?: string;
          entry_id: string;
          path: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          entry_id?: string;
          path?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
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
        };
        Relationships: [];
      };
      operation_requests: {
        Row: { id: string; actor_id: string; created_at: string };
        Insert: { id: string; actor_id?: string; created_at?: string };
        Update: { id?: string; actor_id?: string; created_at?: string };
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
        };
        Insert: {
          id: string;
          worker_id?: string | null;
          role?: string;
          display_name: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          worker_id?: string | null;
          role?: string;
          display_name?: string;
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
        };
        Insert: {
          id?: string;
          description: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          description?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
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
        };
        Insert: {
          id?: string;
          name: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          name?: string;
          color?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
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
        };
        Insert: {
          id?: string;
          task_id: string;
          worker_id: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          task_id?: string;
          worker_id?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
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
        };
        Insert: {
          id?: string;
          task_id: string;
          path: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          task_id?: string;
          path?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
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
        };
        Insert: {
          id?: string;
          task_id: string;
          body: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          task_id?: string;
          body?: string;
          created_by?: string;
          created_at?: string;
          updated_at?: string;
          version?: number;
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
        };
        Insert: {
          id: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
        };
        Update: {
          id?: string;
          phone?: string | null;
          email?: string | null;
          notes?: string | null;
          created_at?: string;
          updated_at?: string;
          version?: number;
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
        };
        Relationships: [];
      };
    };
    Views: { [_ in never]: never };
    Functions: {
      save_absence: { Args: { payload: Json; private_note: string }; Returns: string };
      my_contact: {
        Args: Record<string, never>;
        Returns: { email: string | null; phone: string | null }[];
      };
      is_active: { Args: Record<string, never>; Returns: boolean };
      is_admin: { Args: Record<string, never>; Returns: boolean };
      my_worker_id: { Args: Record<string, never>; Returns: string };
      can_task: { Args: { target: string }; Returns: boolean };
      can_entry: { Args: { target: string }; Returns: boolean };
      set_avatar: { Args: { target_worker: string; object_path: string }; Returns: undefined };
      worker_impact: { Args: { target: string }; Returns: Json };
      save_shift_batch: {
        Args: { request_id: string; items: Json; series_description?: string };
        Returns: number;
      };
      save_task: {
        Args: { payload: Json; assignees: string[]; expected_version?: number };
        Returns: string;
      };
      invitee_account: { Args: { target_worker: string }; Returns: string };
      dashboard_summary: { Args: { day: string; week_start: string }; Returns: Json };
      can_edit_entry: { Args: { target: string }; Returns: boolean };
      team_authors: { Args: Record<string, never>; Returns: { user_id: string; name: string }[] };
      save_worker: {
        Args: { payload: Json; private_data: Json; expected_version?: number };
        Returns: string;
      };
    };
    Enums: { [_ in never]: never };
    CompositeTypes: { [_ in never]: never };
  };
};
