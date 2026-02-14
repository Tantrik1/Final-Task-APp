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
      channel_members: {
        Row: {
          added_by: string | null
          channel_id: string
          id: string
          joined_at: string
          role: Database["public"]["Enums"]["channel_member_role"]
          user_id: string
        }
        Insert: {
          added_by?: string | null
          channel_id: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["channel_member_role"]
          user_id: string
        }
        Update: {
          added_by?: string | null
          channel_id?: string
          id?: string
          joined_at?: string
          role?: Database["public"]["Enums"]["channel_member_role"]
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_members_added_by_fkey"
            columns: ["added_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channel_read_status: {
        Row: {
          channel_id: string
          created_at: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          channel_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          channel_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channel_read_status_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channel_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      channels: {
        Row: {
          created_at: string
          created_by: string | null
          description: string | null
          id: string
          name: string
          type: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name: string
          type?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          description?: string | null
          id?: string
          name?: string
          type?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "channels_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "channels_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      custom_field_definitions: {
        Row: {
          created_at: string
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_required: boolean
          name: string
          options: Json | null
          position: number
          project_id: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          name: string
          options?: Json | null
          position?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          name?: string
          options?: Json | null
          position?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "custom_field_definitions_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_conversations: {
        Row: {
          created_at: string
          id: string
          participant_1: string
          participant_2: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          participant_1: string
          participant_2: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          id?: string
          participant_1?: string
          participant_2?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_conversations_participant_1_fkey"
            columns: ["participant_1"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_conversations_participant_2_fkey"
            columns: ["participant_2"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_conversations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_messages: {
        Row: {
          content: string
          conversation_id: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean
          sender_id: string
        }
        Insert: {
          content: string
          conversation_id: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          sender_id: string
        }
        Update: {
          content?: string
          conversation_id?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      dm_read_status: {
        Row: {
          conversation_id: string
          created_at: string
          id: string
          last_read_at: string
          user_id: string
        }
        Insert: {
          conversation_id: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id: string
        }
        Update: {
          conversation_id?: string
          created_at?: string
          id?: string
          last_read_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "dm_read_status_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "dm_conversations"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "dm_read_status_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      feature_flags: {
        Row: {
          created_at: string
          description: string | null
          id: string
          is_enabled: boolean
          key: string
          min_plan_position: number
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          key: string
          min_plan_position?: number
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          description?: string | null
          id?: string
          is_enabled?: boolean
          key?: string
          min_plan_position?: number
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      messages: {
        Row: {
          channel_id: string
          content: string
          created_at: string
          edited_at: string | null
          id: string
          is_edited: boolean
          reply_to_id: string | null
          sender_id: string
        }
        Insert: {
          channel_id: string
          content: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          reply_to_id?: string | null
          sender_id: string
        }
        Update: {
          channel_id?: string
          content?: string
          created_at?: string
          edited_at?: string | null
          id?: string
          is_edited?: boolean
          reply_to_id?: string | null
          sender_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "messages_channel_id_fkey"
            columns: ["channel_id"]
            isOneToOne: false
            referencedRelation: "channels"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_reply_to_id_fkey"
            columns: ["reply_to_id"]
            isOneToOne: false
            referencedRelation: "messages"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "messages_sender_id_fkey"
            columns: ["sender_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_logs: {
        Row: {
          created_at: string | null
          event_data: Json | null
          event_type: string
          id: string
          notification_id: string | null
        }
        Insert: {
          created_at?: string | null
          event_data?: Json | null
          event_type: string
          id?: string
          notification_id?: string | null
        }
        Update: {
          created_at?: string | null
          event_data?: Json | null
          event_type?: string
          id?: string
          notification_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "notification_logs_notification_id_fkey"
            columns: ["notification_id"]
            isOneToOne: false
            referencedRelation: "notifications"
            referencedColumns: ["id"]
          },
        ]
      }
      notification_preferences: {
        Row: {
          chat_mentions: boolean
          comment_added: boolean
          comment_reply: boolean
          created_at: string
          due_date_reminders: boolean
          id: string
          member_updates: boolean
          project_updates: boolean
          push_enabled: boolean | null
          push_soft_declined_at: string | null
          quiet_hours_enabled: boolean | null
          quiet_hours_end: number | null
          quiet_hours_start: number | null
          task_assigned: boolean
          task_completed: boolean
          task_status_changed: boolean
          timezone: string | null
          updated_at: string
          user_id: string
          workspace_id: string
        }
        Insert: {
          chat_mentions?: boolean
          comment_added?: boolean
          comment_reply?: boolean
          created_at?: string
          due_date_reminders?: boolean
          id?: string
          member_updates?: boolean
          project_updates?: boolean
          push_enabled?: boolean | null
          push_soft_declined_at?: string | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          task_assigned?: boolean
          task_completed?: boolean
          task_status_changed?: boolean
          timezone?: string | null
          updated_at?: string
          user_id: string
          workspace_id: string
        }
        Update: {
          chat_mentions?: boolean
          comment_added?: boolean
          comment_reply?: boolean
          created_at?: string
          due_date_reminders?: boolean
          id?: string
          member_updates?: boolean
          project_updates?: boolean
          push_enabled?: boolean | null
          push_soft_declined_at?: string | null
          quiet_hours_enabled?: boolean | null
          quiet_hours_end?: number | null
          quiet_hours_start?: number | null
          task_assigned?: boolean
          task_completed?: boolean
          task_status_changed?: boolean
          timezone?: string | null
          updated_at?: string
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notification_preferences_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notification_preferences_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      notifications: {
        Row: {
          actor_id: string | null
          body: string
          created_at: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id: string
          is_read: boolean
          metadata: Json | null
          pushed: boolean | null
          pushed_at: string | null
          read_at: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          actor_id?: string | null
          body: string
          created_at?: string
          entity_id: string
          entity_type: Database["public"]["Enums"]["entity_type"]
          id?: string
          is_read?: boolean
          metadata?: Json | null
          pushed?: boolean | null
          pushed_at?: string | null
          read_at?: string | null
          title: string
          type: Database["public"]["Enums"]["notification_type"]
          user_id: string
          workspace_id: string
        }
        Update: {
          actor_id?: string | null
          body?: string
          created_at?: string
          entity_id?: string
          entity_type?: Database["public"]["Enums"]["entity_type"]
          id?: string
          is_read?: boolean
          metadata?: Json | null
          pushed?: boolean | null
          pushed_at?: string | null
          read_at?: string | null
          title?: string
          type?: Database["public"]["Enums"]["notification_type"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "notifications_actor_id_fkey"
            columns: ["actor_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "notifications_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_history: {
        Row: {
          amount_npr: number
          created_at: string
          id: string
          months_paid: number
          paid_at: string
          payment_method: string | null
          payment_submission_id: string | null
          plan_name: string
          receipt_url: string | null
          workspace_id: string
        }
        Insert: {
          amount_npr: number
          created_at?: string
          id?: string
          months_paid?: number
          paid_at?: string
          payment_method?: string | null
          payment_submission_id?: string | null
          plan_name: string
          receipt_url?: string | null
          workspace_id: string
        }
        Update: {
          amount_npr?: number
          created_at?: string
          id?: string
          months_paid?: number
          paid_at?: string
          payment_method?: string | null
          payment_submission_id?: string | null
          plan_name?: string
          receipt_url?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_history_payment_submission_id_fkey"
            columns: ["payment_submission_id"]
            isOneToOne: false
            referencedRelation: "payment_submissions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_history_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_methods: {
        Row: {
          created_at: string
          id: string
          instructions: string | null
          is_active: boolean
          name: string
          position: number
          qr_image_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name: string
          position?: number
          qr_image_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          id?: string
          instructions?: string | null
          is_active?: boolean
          name?: string
          position?: number
          qr_image_url?: string | null
          updated_at?: string
        }
        Relationships: []
      }
      payment_submissions: {
        Row: {
          admin_notes: string | null
          amount_npr: number
          created_at: string
          id: string
          months_paid: number
          payment_method_id: string | null
          plan_id: string
          screenshot_url: string
          status: Database["public"]["Enums"]["payment_status"]
          submitted_by: string
          verified_at: string | null
          verified_by: string | null
          workspace_id: string
        }
        Insert: {
          admin_notes?: string | null
          amount_npr: number
          created_at?: string
          id?: string
          months_paid?: number
          payment_method_id?: string | null
          plan_id: string
          screenshot_url: string
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_by: string
          verified_at?: string | null
          verified_by?: string | null
          workspace_id: string
        }
        Update: {
          admin_notes?: string | null
          amount_npr?: number
          created_at?: string
          id?: string
          months_paid?: number
          payment_method_id?: string | null
          plan_id?: string
          screenshot_url?: string
          status?: Database["public"]["Enums"]["payment_status"]
          submitted_by?: string
          verified_at?: string | null
          verified_by?: string | null
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "payment_submissions_payment_method_id_fkey"
            columns: ["payment_method_id"]
            isOneToOne: false
            referencedRelation: "payment_methods"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_submitted_by_fkey"
            columns: ["submitted_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_verified_by_fkey"
            columns: ["verified_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "payment_submissions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      profiles: {
        Row: {
          avatar_url: string | null
          created_at: string
          email: string
          full_name: string | null
          id: string
          needs_password_reset: boolean | null
          updated_at: string
        }
        Insert: {
          avatar_url?: string | null
          created_at?: string
          email: string
          full_name?: string | null
          id: string
          needs_password_reset?: boolean | null
          updated_at?: string
        }
        Update: {
          avatar_url?: string | null
          created_at?: string
          email?: string
          full_name?: string | null
          id?: string
          needs_password_reset?: boolean | null
          updated_at?: string
        }
        Relationships: []
      }
      project_statuses: {
        Row: {
          color: string
          created_at: string
          id: string
          is_completed: boolean
          is_default: boolean
          name: string
          position: number
          project_id: string
          updated_at: string
        }
        Insert: {
          color?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          is_default?: boolean
          name: string
          position?: number
          project_id: string
          updated_at?: string
        }
        Update: {
          color?: string
          created_at?: string
          id?: string
          is_completed?: boolean
          is_default?: boolean
          name?: string
          position?: number
          project_id?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_statuses_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      project_templates: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          icon: string | null
          id: string
          is_public: boolean
          is_system: boolean | null
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          is_system?: boolean | null
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_public?: boolean
          is_system?: boolean | null
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_templates_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "project_templates_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      project_views: {
        Row: {
          config: Json | null
          created_at: string
          id: string
          is_default: boolean
          name: string
          position: number
          project_id: string
          updated_at: string
          view_type: string
        }
        Insert: {
          config?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean
          name: string
          position?: number
          project_id: string
          updated_at?: string
          view_type: string
        }
        Update: {
          config?: Json | null
          created_at?: string
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          project_id?: string
          updated_at?: string
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "project_views_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      projects: {
        Row: {
          color: string | null
          created_at: string
          created_by: string
          description: string | null
          icon: string | null
          id: string
          is_archived: boolean
          name: string
          updated_at: string
          workspace_id: string
        }
        Insert: {
          color?: string | null
          created_at?: string
          created_by: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          name: string
          updated_at?: string
          workspace_id: string
        }
        Update: {
          color?: string | null
          created_at?: string
          created_by?: string
          description?: string | null
          icon?: string | null
          id?: string
          is_archived?: boolean
          name?: string
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "projects_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "projects_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      push_subscriptions: {
        Row: {
          auth: string
          created_at: string
          endpoint: string
          failed_count: number
          id: string
          is_active: boolean
          last_used_at: string | null
          p256dh: string
          platform: string
          user_agent: string | null
          user_id: string
        }
        Insert: {
          auth: string
          created_at?: string
          endpoint: string
          failed_count?: number
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          p256dh: string
          platform?: string
          user_agent?: string | null
          user_id: string
        }
        Update: {
          auth?: string
          created_at?: string
          endpoint?: string
          failed_count?: number
          id?: string
          is_active?: boolean
          last_used_at?: string | null
          p256dh?: string
          platform?: string
          user_agent?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "push_subscriptions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      site_pages: {
        Row: {
          category: string
          content: Json
          created_at: string
          icon: string | null
          id: string
          is_published: boolean
          meta_description: string | null
          position: number
          slug: string
          title: string
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          category: string
          content?: Json
          created_at?: string
          icon?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          position?: number
          slug: string
          title: string
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          category?: string
          content?: Json
          created_at?: string
          icon?: string | null
          id?: string
          is_published?: boolean
          meta_description?: string | null
          position?: number
          slug?: string
          title?: string
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "site_pages_updated_by_fkey"
            columns: ["updated_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      subscription_plans: {
        Row: {
          badge_text: string | null
          created_at: string
          description: string | null
          features: Json
          id: string
          is_active: boolean
          max_members: number | null
          max_projects: number | null
          name: string
          position: number
          price_npr: number
          updated_at: string
        }
        Insert: {
          badge_text?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_members?: number | null
          max_projects?: number | null
          name: string
          position?: number
          price_npr?: number
          updated_at?: string
        }
        Update: {
          badge_text?: string | null
          created_at?: string
          description?: string | null
          features?: Json
          id?: string
          is_active?: boolean
          max_members?: number | null
          max_projects?: number | null
          name?: string
          position?: number
          price_npr?: number
          updated_at?: string
        }
        Relationships: []
      }
      super_admins: {
        Row: {
          created_at: string
          created_by: string | null
          id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          id?: string
          user_id: string
        }
        Update: {
          created_at?: string
          created_by?: string | null
          id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "super_admins_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "super_admins_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: true
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_attachments: {
        Row: {
          created_at: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          file_name: string
          file_size: number
          file_type: string
          file_url: string
          id?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          file_name?: string
          file_size?: number
          file_type?: string
          file_url?: string
          id?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_attachments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_attachments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_comments: {
        Row: {
          content: string
          created_at: string
          id: string
          parent_id: string | null
          task_id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          parent_id?: string | null
          task_id: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          parent_id?: string | null
          task_id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_comments_parent_id_fkey"
            columns: ["parent_id"]
            isOneToOne: false
            referencedRelation: "task_comments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_comments_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_custom_field_values: {
        Row: {
          created_at: string
          field_id: string
          id: string
          task_id: string
          updated_at: string
          value_boolean: boolean | null
          value_date: string | null
          value_number: number | null
          value_text: string | null
        }
        Insert: {
          created_at?: string
          field_id: string
          id?: string
          task_id: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Update: {
          created_at?: string
          field_id?: string
          id?: string
          task_id?: string
          updated_at?: string
          value_boolean?: boolean | null
          value_date?: string | null
          value_number?: number | null
          value_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "task_custom_field_values_field_id_fkey"
            columns: ["field_id"]
            isOneToOne: false
            referencedRelation: "custom_field_definitions"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_custom_field_values_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
        ]
      }
      task_links: {
        Row: {
          created_at: string
          id: string
          task_id: string
          title: string
          url: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          task_id: string
          title: string
          url: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          task_id?: string
          title?: string
          url?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_links_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_links_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      task_sessions: {
        Row: {
          created_at: string
          duration_seconds: number | null
          ended_at: string | null
          id: string
          session_type: string
          started_at: string
          task_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          session_type?: string
          started_at?: string
          task_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration_seconds?: number | null
          ended_at?: string | null
          id?: string
          session_type?: string
          started_at?: string
          task_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "task_sessions_task_id_fkey"
            columns: ["task_id"]
            isOneToOne: false
            referencedRelation: "tasks"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "task_sessions_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
      tasks: {
        Row: {
          assigned_to: string | null
          completed_at: string | null
          created_at: string
          created_by: string
          custom_status_id: string | null
          description: string | null
          due_date: string | null
          first_started_at: string | null
          id: string
          is_timer_running: boolean | null
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          project_id: string
          status: Database["public"]["Enums"]["task_status"]
          title: string
          total_work_time: number | null
          updated_at: string
        }
        Insert: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by: string
          custom_status_id?: string | null
          description?: string | null
          due_date?: string | null
          first_started_at?: string | null
          id?: string
          is_timer_running?: boolean | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id: string
          status?: Database["public"]["Enums"]["task_status"]
          title: string
          total_work_time?: number | null
          updated_at?: string
        }
        Update: {
          assigned_to?: string | null
          completed_at?: string | null
          created_at?: string
          created_by?: string
          custom_status_id?: string | null
          description?: string | null
          due_date?: string | null
          first_started_at?: string | null
          id?: string
          is_timer_running?: boolean | null
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          project_id?: string
          status?: Database["public"]["Enums"]["task_status"]
          title?: string
          total_work_time?: number | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "tasks_assigned_to_fkey"
            columns: ["assigned_to"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_custom_status_id_fkey"
            columns: ["custom_status_id"]
            isOneToOne: false
            referencedRelation: "project_statuses"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "tasks_project_id_fkey"
            columns: ["project_id"]
            isOneToOne: false
            referencedRelation: "projects"
            referencedColumns: ["id"]
          },
        ]
      }
      template_custom_fields: {
        Row: {
          field_type: Database["public"]["Enums"]["custom_field_type"]
          id: string
          is_required: boolean
          name: string
          options: Json | null
          position: number
          template_id: string
        }
        Insert: {
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          name: string
          options?: Json | null
          position?: number
          template_id: string
        }
        Update: {
          field_type?: Database["public"]["Enums"]["custom_field_type"]
          id?: string
          is_required?: boolean
          name?: string
          options?: Json | null
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_custom_fields_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_statuses: {
        Row: {
          color: string
          id: string
          is_completed: boolean
          is_default: boolean
          name: string
          position: number
          template_id: string
        }
        Insert: {
          color?: string
          id?: string
          is_completed?: boolean
          is_default?: boolean
          name: string
          position?: number
          template_id: string
        }
        Update: {
          color?: string
          id?: string
          is_completed?: boolean
          is_default?: boolean
          name?: string
          position?: number
          template_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_statuses_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_tasks: {
        Row: {
          days_offset: number | null
          description: string | null
          id: string
          position: number
          priority: Database["public"]["Enums"]["task_priority"]
          status_position: number
          template_id: string
          title: string
        }
        Insert: {
          days_offset?: number | null
          description?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          status_position?: number
          template_id: string
          title: string
        }
        Update: {
          days_offset?: number | null
          description?: string | null
          id?: string
          position?: number
          priority?: Database["public"]["Enums"]["task_priority"]
          status_position?: number
          template_id?: string
          title?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_tasks_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      template_views: {
        Row: {
          config: Json | null
          id: string
          is_default: boolean
          name: string
          position: number
          template_id: string
          view_type: string
        }
        Insert: {
          config?: Json | null
          id?: string
          is_default?: boolean
          name: string
          position?: number
          template_id: string
          view_type: string
        }
        Update: {
          config?: Json | null
          id?: string
          is_default?: boolean
          name?: string
          position?: number
          template_id?: string
          view_type?: string
        }
        Relationships: [
          {
            foreignKeyName: "template_views_template_id_fkey"
            columns: ["template_id"]
            isOneToOne: false
            referencedRelation: "project_templates"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_invitations: {
        Row: {
          created_at: string
          email: string
          expires_at: string
          id: string
          invited_by: string
          role: Database["public"]["Enums"]["workspace_role"]
          token: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          email: string
          expires_at?: string
          id?: string
          invited_by: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          email?: string
          expires_at?: string
          id?: string
          invited_by?: string
          role?: Database["public"]["Enums"]["workspace_role"]
          token?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_invitations_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_invitations_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_members: {
        Row: {
          id: string
          invited_by: string | null
          joined_at: string
          last_active_at: string | null
          role: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Insert: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          last_active_at?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id: string
          workspace_id: string
        }
        Update: {
          id?: string
          invited_by?: string | null
          joined_at?: string
          last_active_at?: string | null
          role?: Database["public"]["Enums"]["workspace_role"]
          user_id?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_members_invited_by_fkey"
            columns: ["invited_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_user_id_fkey"
            columns: ["user_id"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_members_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: false
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspace_subscriptions: {
        Row: {
          created_at: string
          expires_at: string | null
          id: string
          member_count: number
          plan_id: string
          starts_at: string
          status: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at: string | null
          updated_at: string
          workspace_id: string
        }
        Insert: {
          created_at?: string
          expires_at?: string | null
          id?: string
          member_count?: number
          plan_id: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          workspace_id: string
        }
        Update: {
          created_at?: string
          expires_at?: string | null
          id?: string
          member_count?: number
          plan_id?: string
          starts_at?: string
          status?: Database["public"]["Enums"]["subscription_status"]
          trial_ends_at?: string | null
          updated_at?: string
          workspace_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspace_subscriptions_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "subscription_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "workspace_subscriptions_workspace_id_fkey"
            columns: ["workspace_id"]
            isOneToOne: true
            referencedRelation: "workspaces"
            referencedColumns: ["id"]
          },
        ]
      }
      workspaces: {
        Row: {
          created_at: string
          created_by: string
          description: string | null
          id: string
          logo_url: string | null
          name: string
          updated_at: string
        }
        Insert: {
          created_at?: string
          created_by: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name: string
          updated_at?: string
        }
        Update: {
          created_at?: string
          created_by?: string
          description?: string | null
          id?: string
          logo_url?: string | null
          name?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "workspaces_created_by_fkey"
            columns: ["created_by"]
            isOneToOne: false
            referencedRelation: "profiles"
            referencedColumns: ["id"]
          },
        ]
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      cleanup_expired_invitations: { Args: never; Returns: number }
      create_notification: {
        Args: {
          p_actor_id: string
          p_body: string
          p_entity_id: string
          p_entity_type: Database["public"]["Enums"]["entity_type"]
          p_metadata?: Json
          p_title: string
          p_type: Database["public"]["Enums"]["notification_type"]
          p_user_id: string
          p_workspace_id: string
        }
        Returns: string
      }
      get_channel_unread_count: {
        Args: { p_channel_id: string; p_user_id: string }
        Returns: number
      }
      get_channel_workspace: { Args: { p_channel_id: string }; Returns: string }
      get_dm_unread_count: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: number
      }
      get_dm_workspace: { Args: { p_conversation_id: string }; Returns: string }
      get_project_workspace: { Args: { p_project_id: string }; Returns: string }
      get_task_project: { Args: { p_task_id: string }; Returns: string }
      get_template_workspace: {
        Args: { p_template_id: string }
        Returns: string
      }
      get_workspace_role: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: Database["public"]["Enums"]["workspace_role"]
      }
      has_workspace_role: {
        Args: {
          p_min_role: Database["public"]["Enums"]["workspace_role"]
          p_user_id: string
          p_workspace_id: string
        }
        Returns: boolean
      }
      is_channel_admin: {
        Args: { p_channel_id: string; p_user_id: string }
        Returns: boolean
      }
      is_channel_member: {
        Args: { p_channel_id: string; p_user_id: string }
        Returns: boolean
      }
      is_dm_participant: {
        Args: { p_conversation_id: string; p_user_id: string }
        Returns: boolean
      }
      is_super_admin: { Args: { user_uuid: string }; Returns: boolean }
      is_workspace_member: {
        Args: { p_user_id: string; p_workspace_id: string }
        Returns: boolean
      }
      log_notification_event: {
        Args: {
          p_event_data?: Json
          p_event_type: string
          p_notification_id: string
        }
        Returns: string
      }
      send_due_date_reminders: { Args: never; Returns: number }
      should_notify: {
        Args: {
          p_notification_type: string
          p_user_id: string
          p_workspace_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      channel_member_role: "admin" | "member"
      custom_field_type:
        | "text"
        | "number"
        | "date"
        | "select"
        | "checkbox"
        | "url"
        | "currency"
        | "user"
        | "multiselect"
        | "file"
      entity_type: "task" | "project" | "comment" | "chat" | "workspace"
      notification_type:
        | "task_assigned"
        | "task_status_changed"
        | "task_completed"
        | "comment_added"
        | "comment_reply"
        | "project_created"
        | "project_updated"
        | "member_joined"
        | "member_invited"
        | "chat_mention"
        | "due_date_reminder"
      payment_status: "pending" | "approved" | "rejected"
      subscription_status:
        | "active"
        | "expired"
        | "cancelled"
        | "trial"
        | "grace_period"
      task_priority: "low" | "medium" | "high" | "urgent"
      task_status: "todo" | "in_progress" | "review" | "done"
      workspace_role: "owner" | "admin" | "member" | "viewer"
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
      channel_member_role: ["admin", "member"],
      custom_field_type: [
        "text",
        "number",
        "date",
        "select",
        "checkbox",
        "url",
        "currency",
        "user",
        "multiselect",
        "file",
      ],
      entity_type: ["task", "project", "comment", "chat", "workspace"],
      notification_type: [
        "task_assigned",
        "task_status_changed",
        "task_completed",
        "comment_added",
        "comment_reply",
        "project_created",
        "project_updated",
        "member_joined",
        "member_invited",
        "chat_mention",
        "due_date_reminder",
      ],
      payment_status: ["pending", "approved", "rejected"],
      subscription_status: [
        "active",
        "expired",
        "cancelled",
        "trial",
        "grace_period",
      ],
      task_priority: ["low", "medium", "high", "urgent"],
      task_status: ["todo", "in_progress", "review", "done"],
      workspace_role: ["owner", "admin", "member", "viewer"],
    },
  },
} as const
