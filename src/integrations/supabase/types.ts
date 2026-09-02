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
      activity_log: {
        Row: {
          created_at: string
          id: string
          kind: string
          label: string | null
          ref: string | null
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          kind: string
          label?: string | null
          ref?: string | null
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          kind?: string
          label?: string | null
          ref?: string | null
          user_id?: string
        }
        Relationships: []
      }
      affiliate_commissions: {
        Row: {
          affiliate_id: string
          amount_cents: number
          created_at: string
          id: string
          order_id: string
          status: string
        }
        Insert: {
          affiliate_id: string
          amount_cents: number
          created_at?: string
          id?: string
          order_id: string
          status?: string
        }
        Update: {
          affiliate_id?: string
          amount_cents?: number
          created_at?: string
          id?: string
          order_id?: string
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "affiliate_commissions_affiliate_id_fkey"
            columns: ["affiliate_id"]
            isOneToOne: false
            referencedRelation: "affiliates"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "affiliate_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: true
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      affiliates: {
        Row: {
          active: boolean
          code: string
          commission_percent: number
          created_at: string
          id: string
          user_id: string
        }
        Insert: {
          active?: boolean
          code: string
          commission_percent?: number
          created_at?: string
          id?: string
          user_id: string
        }
        Update: {
          active?: boolean
          code?: string
          commission_percent?: number
          created_at?: string
          id?: string
          user_id?: string
        }
        Relationships: []
      }
      ambassador_emails: {
        Row: {
          created_at: string
          created_by: string | null
          email: string
          note: string | null
        }
        Insert: {
          created_at?: string
          created_by?: string | null
          email: string
          note?: string | null
        }
        Update: {
          created_at?: string
          created_by?: string | null
          email?: string
          note?: string | null
        }
        Relationships: []
      }
      ambassadors: {
        Row: {
          code: string
          created_at: string
          notes: string | null
          pix_key: string | null
          pix_key_type: string | null
          status: Database["public"]["Enums"]["ambassador_status"]
          terms_accepted_at: string | null
          tier: Database["public"]["Enums"]["ambassador_tier"]
          updated_at: string
          user_id: string
        }
        Insert: {
          code: string
          created_at?: string
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          status?: Database["public"]["Enums"]["ambassador_status"]
          terms_accepted_at?: string | null
          tier?: Database["public"]["Enums"]["ambassador_tier"]
          updated_at?: string
          user_id: string
        }
        Update: {
          code?: string
          created_at?: string
          notes?: string | null
          pix_key?: string | null
          pix_key_type?: string | null
          status?: Database["public"]["Enums"]["ambassador_status"]
          terms_accepted_at?: string | null
          tier?: Database["public"]["Enums"]["ambassador_tier"]
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      antenna_unlocks: {
        Row: {
          id: string
          level_key: string
          seen: boolean
          threshold: number
          unlocked_at: string
          user_id: string
        }
        Insert: {
          id?: string
          level_key: string
          seen?: boolean
          threshold?: number
          unlocked_at?: string
          user_id: string
        }
        Update: {
          id?: string
          level_key?: string
          seen?: boolean
          threshold?: number
          unlocked_at?: string
          user_id?: string
        }
        Relationships: []
      }
      capture_items: {
        Row: {
          bucket: string
          created_at: string
          done: boolean
          due_date: string | null
          due_label: string | null
          due_time: string | null
          id: string
          source_text: string | null
          title: string
          user_id: string
        }
        Insert: {
          bucket: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          due_label?: string | null
          due_time?: string | null
          id?: string
          source_text?: string | null
          title: string
          user_id: string
        }
        Update: {
          bucket?: string
          created_at?: string
          done?: boolean
          due_date?: string | null
          due_label?: string | null
          due_time?: string | null
          id?: string
          source_text?: string | null
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      checklist_state: {
        Row: {
          done: boolean
          item_key: string
          updated_at: string
          user_id: string
        }
        Insert: {
          done?: boolean
          item_key: string
          updated_at?: string
          user_id: string
        }
        Update: {
          done?: boolean
          item_key?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      circle_direction_checkins: {
        Row: {
          circle_id: string
          created_at: string
          direction_id: string
          id: string
          note: string | null
          user_id: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          direction_id: string
          id?: string
          note?: string | null
          user_id: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          direction_id?: string
          id?: string
          note?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_direction_checkins_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "circle_direction_checkins_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "circle_directions"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_directions: {
        Row: {
          circle_id: string
          created_at: string
          created_by: string | null
          id: string
          local_date: string
          text: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          created_by?: string | null
          id?: string
          local_date: string
          text: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          created_by?: string | null
          id?: string
          local_date?: string
          text?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_directions_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_invites: {
        Row: {
          circle_id: string
          created_at: string
          id: string
          invited_by: string
          invited_user_id: string
          responded_at: string | null
          status: string
        }
        Insert: {
          circle_id: string
          created_at?: string
          id?: string
          invited_by: string
          invited_user_id: string
          responded_at?: string | null
          status?: string
        }
        Update: {
          circle_id?: string
          created_at?: string
          id?: string
          invited_by?: string
          invited_user_id?: string
          responded_at?: string | null
          status?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_invites_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circle_members: {
        Row: {
          circle_id: string
          id: string
          joined_at: string
          role: string
          user_id: string
        }
        Insert: {
          circle_id: string
          id?: string
          joined_at?: string
          role?: string
          user_id: string
        }
        Update: {
          circle_id?: string
          id?: string
          joined_at?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "circle_members_circle_id_fkey"
            columns: ["circle_id"]
            isOneToOne: false
            referencedRelation: "circles"
            referencedColumns: ["id"]
          },
        ]
      }
      circles: {
        Row: {
          challenge_kind: string
          challenge_text: string
          created_at: string
          duration_days: number
          ends_at: string
          focus_label: string | null
          id: string
          invite_code: string
          name: string
          owner_id: string
          starts_at: string
          status: string
          target_count: number | null
          updated_at: string
        }
        Insert: {
          challenge_kind?: string
          challenge_text: string
          created_at?: string
          duration_days?: number
          ends_at: string
          focus_label?: string | null
          id?: string
          invite_code: string
          name: string
          owner_id: string
          starts_at?: string
          status?: string
          target_count?: number | null
          updated_at?: string
        }
        Update: {
          challenge_kind?: string
          challenge_text?: string
          created_at?: string
          duration_days?: number
          ends_at?: string
          focus_label?: string | null
          id?: string
          invite_code?: string
          name?: string
          owner_id?: string
          starts_at?: string
          status?: string
          target_count?: number | null
          updated_at?: string
        }
        Relationships: []
      }
      connected_accounts: {
        Row: {
          access_token_encrypted: string | null
          connected_at: string | null
          connection_status: string
          created_at: string
          disconnected_at: string | null
          id: string
          provider: string
          provider_account_id: string | null
          provider_username: string | null
          token_expires_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          provider?: string
          provider_account_id?: string | null
          provider_username?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          access_token_encrypted?: string | null
          connected_at?: string | null
          connection_status?: string
          created_at?: string
          disconnected_at?: string | null
          id?: string
          provider?: string
          provider_account_id?: string | null
          provider_username?: string | null
          token_expires_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      coupons: {
        Row: {
          active: boolean
          code: string
          created_at: string
          discount_type: string
          discount_value: number
          expires_at: string | null
          max_uses: number | null
          used_count: number
        }
        Insert: {
          active?: boolean
          code: string
          created_at?: string
          discount_type: string
          discount_value: number
          expires_at?: string | null
          max_uses?: number | null
          used_count?: number
        }
        Update: {
          active?: boolean
          code?: string
          created_at?: string
          discount_type?: string
          discount_value?: number
          expires_at?: string | null
          max_uses?: number | null
          used_count?: number
        }
        Relationships: []
      }
      daily_checkins: {
        Row: {
          checkin_date: string
          created_at: string
          energy: string | null
          id: string
          mag_recommends: boolean
          priority: string | null
          skipped: boolean
          time_available: string | null
          user_id: string
        }
        Insert: {
          checkin_date: string
          created_at?: string
          energy?: string | null
          id?: string
          mag_recommends?: boolean
          priority?: string | null
          skipped?: boolean
          time_available?: string | null
          user_id: string
        }
        Update: {
          checkin_date?: string
          created_at?: string
          energy?: string | null
          id?: string
          mag_recommends?: boolean
          priority?: string | null
          skipped?: boolean
          time_available?: string | null
          user_id?: string
        }
        Relationships: []
      }
      day_closures: {
        Row: {
          closed_at: string
          created_at: string
          day_date: string
          id: string
          moved_count: number
          rating: string
          removed_count: number
          user_id: string
        }
        Insert: {
          closed_at?: string
          created_at?: string
          day_date: string
          id?: string
          moved_count?: number
          rating: string
          removed_count?: number
          user_id: string
        }
        Update: {
          closed_at?: string
          created_at?: string
          day_date?: string
          id?: string
          moved_count?: number
          rating?: string
          removed_count?: number
          user_id?: string
        }
        Relationships: []
      }
      day_events: {
        Row: {
          created_at: string
          day_date: string
          icon: string | null
          id: string
          source: string
          start_time: string
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_date: string
          icon?: string | null
          id?: string
          source?: string
          start_time: string
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_date?: string
          icon?: string | null
          id?: string
          source?: string
          start_time?: string
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      day_notes: {
        Row: {
          body: string
          created_at: string
          day_date: string
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          day_date: string
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          day_date?: string
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      day_priorities: {
        Row: {
          created_at: string
          day_date: string
          done: boolean
          id: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          day_date: string
          done?: boolean
          id?: string
          position?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          day_date?: string
          done?: boolean
          id?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direction_arcs: {
        Row: {
          bottleneck: string | null
          closed_at: string | null
          closed_reason: string | null
          created_at: string
          id: string
          objective: string | null
          opened_at: string
          progress: Json
          status: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          bottleneck?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          objective?: string | null
          opened_at?: string
          progress?: Json
          status?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          bottleneck?: string | null
          closed_at?: string | null
          closed_reason?: string | null
          created_at?: string
          id?: string
          objective?: string | null
          opened_at?: string
          progress?: Json
          status?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      direction_impacts: {
        Row: {
          author_name: string | null
          created_at: string
          direction_title: string | null
          goal_id: string | null
          id: string
          outcome_text: string | null
          profession: string | null
          published: boolean
          useful: boolean
          user_id: string
        }
        Insert: {
          author_name?: string | null
          created_at?: string
          direction_title?: string | null
          goal_id?: string | null
          id?: string
          outcome_text?: string | null
          profession?: string | null
          published?: boolean
          useful: boolean
          user_id: string
        }
        Update: {
          author_name?: string | null
          created_at?: string
          direction_title?: string | null
          goal_id?: string | null
          id?: string
          outcome_text?: string | null
          profession?: string | null
          published?: boolean
          useful?: boolean
          user_id?: string
        }
        Relationships: []
      }
      direction_responses: {
        Row: {
          content: Json
          context: string | null
          created_at: string
          direction_title: string | null
          id: string
          influences_future: boolean
          learning: string | null
          life_area: string | null
          plan_id: string | null
          response_type: string
          updated_at: string
          user_id: string
        }
        Insert: {
          content?: Json
          context?: string | null
          created_at?: string
          direction_title?: string | null
          id?: string
          influences_future?: boolean
          learning?: string | null
          life_area?: string | null
          plan_id?: string | null
          response_type?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          content?: Json
          context?: string | null
          created_at?: string
          direction_title?: string | null
          id?: string
          influences_future?: boolean
          learning?: string | null
          life_area?: string | null
          plan_id?: string | null
          response_type?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "direction_responses_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      direction_signals: {
        Row: {
          created_at: string
          executed: boolean
          id: string
          objective: string | null
          positive: boolean | null
          profession: string | null
          strategy_key: string
          time_bucket: string | null
        }
        Insert: {
          created_at?: string
          executed?: boolean
          id?: string
          objective?: string | null
          positive?: boolean | null
          profession?: string | null
          strategy_key: string
          time_bucket?: string | null
        }
        Update: {
          created_at?: string
          executed?: boolean
          id?: string
          objective?: string | null
          positive?: boolean | null
          profession?: string | null
          strategy_key?: string
          time_bucket?: string | null
        }
        Relationships: []
      }
      entitlements: {
        Row: {
          expires_at: string | null
          granted_at: string
          id: string
          product_id: string
          source: string
          source_ref: string | null
          status: string
          user_id: string
        }
        Insert: {
          expires_at?: string | null
          granted_at?: string
          id?: string
          product_id: string
          source: string
          source_ref?: string | null
          status?: string
          user_id: string
        }
        Update: {
          expires_at?: string | null
          granted_at?: string
          id?: string
          product_id?: string
          source?: string
          source_ref?: string | null
          status?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "entitlements_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      favorites: {
        Row: {
          created_at: string
          module_slug: string
          user_id: string
        }
        Insert: {
          created_at?: string
          module_slug: string
          user_id: string
        }
        Update: {
          created_at?: string
          module_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      fraud_flags: {
        Row: {
          ambassador_user_id: string | null
          commission_id: string | null
          created_at: string
          id: string
          notes: string | null
          reason: Database["public"]["Enums"]["fraud_reason"]
          resolved_at: string | null
          resolved_by: string | null
          severity: string
        }
        Insert: {
          ambassador_user_id?: string | null
          commission_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          reason: Database["public"]["Enums"]["fraud_reason"]
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Update: {
          ambassador_user_id?: string | null
          commission_id?: string | null
          created_at?: string
          id?: string
          notes?: string | null
          reason?: Database["public"]["Enums"]["fraud_reason"]
          resolved_at?: string | null
          resolved_by?: string | null
          severity?: string
        }
        Relationships: [
          {
            foreignKeyName: "fraud_flags_commission_id_fkey"
            columns: ["commission_id"]
            isOneToOne: false
            referencedRelation: "referral_commissions"
            referencedColumns: ["id"]
          },
        ]
      }
      future_goals: {
        Row: {
          created_at: string
          id: string
          source_focus_id: string | null
          status: string
          text: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          source_focus_id?: string | null
          status?: string
          text: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          source_focus_id?: string | null
          status?: string
          text?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "future_goals_source_focus_id_fkey"
            columns: ["source_focus_id"]
            isOneToOne: false
            referencedRelation: "weekly_focus"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_community_baseline: {
        Row: {
          base_applied: number
          id: number
          metas_month: number
          new_clients: number
          professionals_today: number
          updated_at: string
          useful_pct: number
        }
        Insert: {
          base_applied?: number
          id?: number
          metas_month?: number
          new_clients?: number
          professionals_today?: number
          updated_at?: string
          useful_pct?: number
        }
        Update: {
          base_applied?: number
          id?: number
          metas_month?: number
          new_clients?: number
          professionals_today?: number
          updated_at?: string
          useful_pct?: number
        }
        Relationships: []
      }
      impact_reactions: {
        Row: {
          created_at: string
          id: string
          impact_id: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          impact_id: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          impact_id?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "impact_reactions_impact_id_fkey"
            columns: ["impact_id"]
            isOneToOne: false
            referencedRelation: "direction_impacts"
            referencedColumns: ["id"]
          },
        ]
      }
      impact_stories: {
        Row: {
          active: boolean
          created_at: string
          direction_text: string | null
          full_result: string | null
          hours_ago: number
          how_applied: string | null
          id: string
          position: number
          profession: string
          story: string
          validations: number
        }
        Insert: {
          active?: boolean
          created_at?: string
          direction_text?: string | null
          full_result?: string | null
          hours_ago?: number
          how_applied?: string | null
          id?: string
          position?: number
          profession: string
          story: string
          validations?: number
        }
        Update: {
          active?: boolean
          created_at?: string
          direction_text?: string | null
          full_result?: string | null
          hours_ago?: number
          how_applied?: string | null
          id?: string
          position?: number
          profession?: string
          story?: string
          validations?: number
        }
        Relationships: []
      }
      impact_weekly_directions: {
        Row: {
          active: boolean
          created_at: string
          id: string
          position: number
          success_pct: number
          title: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          id?: string
          position: number
          success_pct: number
          title: string
        }
        Update: {
          active?: boolean
          created_at?: string
          id?: string
          position?: number
          success_pct?: number
          title?: string
        }
        Relationships: []
      }
      login_attempts: {
        Row: {
          attempted_at: string
          id: number
          identifier_hash: string | null
          ip_hash: string | null
        }
        Insert: {
          attempted_at?: string
          id?: number
          identifier_hash?: string | null
          ip_hash?: string | null
        }
        Update: {
          attempted_at?: string
          id?: number
          identifier_hash?: string | null
          ip_hash?: string | null
        }
        Relationships: []
      }
      mag_goal_feedback: {
        Row: {
          created_at: string
          feedback: string
          goal_category: string | null
          goal_context: string | null
          goal_id: string
          goal_title: string | null
          id: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          feedback: string
          goal_category?: string | null
          goal_context?: string | null
          goal_id: string
          goal_title?: string | null
          id?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          feedback?: string
          goal_category?: string | null
          goal_context?: string | null
          goal_id?: string
          goal_title?: string | null
          id?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mag_goal_feedback_goal_id_fkey"
            columns: ["goal_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      mag_memory: {
        Row: {
          category: string
          confidence: number
          created_at: string
          evidence_count: number
          id: string
          key: string
          label: string
          source: string
          status: string
          updated_at: string
          user_id: string
          value: string
        }
        Insert: {
          category?: string
          confidence?: number
          created_at?: string
          evidence_count?: number
          id?: string
          key: string
          label: string
          source?: string
          status?: string
          updated_at?: string
          user_id: string
          value: string
        }
        Update: {
          category?: string
          confidence?: number
          created_at?: string
          evidence_count?: number
          id?: string
          key?: string
          label?: string
          source?: string
          status?: string
          updated_at?: string
          user_id?: string
          value?: string
        }
        Relationships: []
      }
      mag_memory_questions: {
        Row: {
          answer: string | null
          answered_at: string | null
          asked_at: string
          fact_key: string
          id: string
          options: Json
          question: string
          status: string
          user_id: string
        }
        Insert: {
          answer?: string | null
          answered_at?: string | null
          asked_at?: string
          fact_key: string
          id?: string
          options?: Json
          question: string
          status?: string
          user_id: string
        }
        Update: {
          answer?: string | null
          answered_at?: string | null
          asked_at?: string
          fact_key?: string
          id?: string
          options?: Json
          question?: string
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      mag_signals: {
        Row: {
          created_at: string
          hour: number | null
          id: string
          kind: string
          local_date: string | null
          subject: string | null
          user_id: string
          value: Json
        }
        Insert: {
          created_at?: string
          hour?: number | null
          id?: string
          kind: string
          local_date?: string | null
          subject?: string | null
          user_id: string
          value?: Json
        }
        Update: {
          created_at?: string
          hour?: number | null
          id?: string
          kind?: string
          local_date?: string | null
          subject?: string | null
          user_id?: string
          value?: Json
        }
        Relationships: []
      }
      magnet_transactions: {
        Row: {
          amount: number
          created_at: string
          dedupe_key: string | null
          direction_id: string | null
          id: string
          reason: string
          user_id: string
        }
        Insert: {
          amount?: number
          created_at?: string
          dedupe_key?: string | null
          direction_id?: string | null
          id?: string
          reason?: string
          user_id: string
        }
        Update: {
          amount?: number
          created_at?: string
          dedupe_key?: string | null
          direction_id?: string | null
          id?: string
          reason?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "magnet_transactions_direction_id_fkey"
            columns: ["direction_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      magnetic_profile: {
        Row: {
          audience: Json
          business: Json
          communication: Json
          completeness: number
          created_at: string
          id: string
          identity: Json
          instagram: Json
          mindset: Json
          notes: string | null
          objectives: Json
          onboarding_finished_at: string | null
          onboarding_state: string
          updated_at: string
          user_id: string
        }
        Insert: {
          audience?: Json
          business?: Json
          communication?: Json
          completeness?: number
          created_at?: string
          id?: string
          identity?: Json
          instagram?: Json
          mindset?: Json
          notes?: string | null
          objectives?: Json
          onboarding_finished_at?: string | null
          onboarding_state?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          audience?: Json
          business?: Json
          communication?: Json
          completeness?: number
          created_at?: string
          id?: string
          identity?: Json
          instagram?: Json
          mindset?: Json
          notes?: string | null
          objectives?: Json
          onboarding_finished_at?: string | null
          onboarding_state?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      magneto_awards: {
        Row: {
          created_at: string
          id: string
          plan_id: string | null
          points: number
          source: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          plan_id?: string | null
          points?: number
          source?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          plan_id?: string | null
          points?: number
          source?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_conversations: {
        Row: {
          created_at: string
          id: string
          last_message_at: string
          pinned: boolean
          title: string
          user_id: string
        }
        Insert: {
          created_at?: string
          id?: string
          last_message_at?: string
          pinned?: boolean
          title?: string
          user_id: string
        }
        Update: {
          created_at?: string
          id?: string
          last_message_at?: string
          pinned?: boolean
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      mentor_messages: {
        Row: {
          content: string
          conversation_id: string | null
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          conversation_id?: string | null
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "mentor_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "mentor_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      module_audio: {
        Row: {
          content_type: string | null
          created_at: string
          duration_seconds: number | null
          error_message: string | null
          generation_started_at: string | null
          last_generated_at: string | null
          module_slug: string
          progress: number
          size_bytes: number | null
          status: string
          storage_path: string | null
          text_hash: string | null
          updated_at: string
          uploaded_by: string | null
          voice_id: string | null
        }
        Insert: {
          content_type?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          generation_started_at?: string | null
          last_generated_at?: string | null
          module_slug: string
          progress?: number
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          text_hash?: string | null
          updated_at?: string
          uploaded_by?: string | null
          voice_id?: string | null
        }
        Update: {
          content_type?: string | null
          created_at?: string
          duration_seconds?: number | null
          error_message?: string | null
          generation_started_at?: string | null
          last_generated_at?: string | null
          module_slug?: string
          progress?: number
          size_bytes?: number | null
          status?: string
          storage_path?: string | null
          text_hash?: string | null
          updated_at?: string
          uploaded_by?: string | null
          voice_id?: string | null
        }
        Relationships: []
      }
      module_progress: {
        Row: {
          completed: boolean
          last_read_at: string
          module_slug: string
          user_id: string
        }
        Insert: {
          completed?: boolean
          last_read_at?: string
          module_slug: string
          user_id: string
        }
        Update: {
          completed?: boolean
          last_read_at?: string
          module_slug?: string
          user_id?: string
        }
        Relationships: []
      }
      money_records: {
        Row: {
          amount_cents: number
          category: string
          created_at: string
          description: string | null
          due_day: number | null
          entry_date: string
          id: string
          is_pending: boolean
          is_recurring: boolean
          kind: string
          recurrence_parent: string | null
          recurrence_status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount_cents: number
          category: string
          created_at?: string
          description?: string | null
          due_day?: number | null
          entry_date?: string
          id?: string
          is_pending?: boolean
          is_recurring?: boolean
          kind: string
          recurrence_parent?: string | null
          recurrence_status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount_cents?: number
          category?: string
          created_at?: string
          description?: string | null
          due_day?: number | null
          entry_date?: string
          id?: string
          is_pending?: boolean
          is_recurring?: boolean
          kind?: string
          recurrence_parent?: string | null
          recurrence_status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "money_records_recurrence_parent_fkey"
            columns: ["recurrence_parent"]
            isOneToOne: false
            referencedRelation: "money_records"
            referencedColumns: ["id"]
          },
        ]
      }
      notes: {
        Row: {
          body: string
          created_at: string
          id: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string
          created_at?: string
          id?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_events: {
        Row: {
          body: string
          cancellation_reason: string | null
          cancelled_at: string | null
          created_at: string
          deduplication_key: string
          entity_id: string | null
          expires_at: string | null
          id: string
          opened_at: string | null
          scheduled_for: string
          sent_at: string | null
          target_route: string
          title: string
          type: string
          user_id: string
        }
        Insert: {
          body: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          deduplication_key: string
          entity_id?: string | null
          expires_at?: string | null
          id?: string
          opened_at?: string | null
          scheduled_for?: string
          sent_at?: string | null
          target_route: string
          title: string
          type: string
          user_id: string
        }
        Update: {
          body?: string
          cancellation_reason?: string | null
          cancelled_at?: string | null
          created_at?: string
          deduplication_key?: string
          entity_id?: string | null
          expires_at?: string | null
          id?: string
          opened_at?: string | null
          scheduled_for?: string
          sent_at?: string | null
          target_route?: string
          title?: string
          type?: string
          user_id?: string
        }
        Relationships: []
      }
      notification_logs: {
        Row: {
          body: string | null
          created_at: string
          dedupe_key: string | null
          error: string | null
          id: string
          kind: string
          payload: Json
          status: string
          title: string | null
          user_id: string | null
        }
        Insert: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          kind: string
          payload?: Json
          status?: string
          title?: string | null
          user_id?: string | null
        }
        Update: {
          body?: string | null
          created_at?: string
          dedupe_key?: string | null
          error?: string | null
          id?: string
          kind?: string
          payload?: Json
          status?: string
          title?: string | null
          user_id?: string | null
        }
        Relationships: []
      }
      notification_preferences: {
        Row: {
          appointments_enabled: boolean
          checkin_enabled: boolean
          circle_notifications: boolean
          consented_at: string | null
          created_at: string
          daily_limit: number
          day_close_enabled: boolean
          day_close_hour: number
          direction_enabled: boolean
          enabled: boolean
          impact_notifications: boolean
          insights_enabled: boolean
          lock_screen_privacy: string
          priorities_enabled: boolean
          quiet_hours_end: number
          quiet_hours_start: number
          timezone: string
          updated_at: string
          user_id: string
        }
        Insert: {
          appointments_enabled?: boolean
          checkin_enabled?: boolean
          circle_notifications?: boolean
          consented_at?: string | null
          created_at?: string
          daily_limit?: number
          day_close_enabled?: boolean
          day_close_hour?: number
          direction_enabled?: boolean
          enabled?: boolean
          impact_notifications?: boolean
          insights_enabled?: boolean
          lock_screen_privacy?: string
          priorities_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          appointments_enabled?: boolean
          checkin_enabled?: boolean
          circle_notifications?: boolean
          consented_at?: string | null
          created_at?: string
          daily_limit?: number
          day_close_enabled?: boolean
          day_close_hour?: number
          direction_enabled?: boolean
          enabled?: boolean
          impact_notifications?: boolean
          insights_enabled?: boolean
          lock_screen_privacy?: string
          priorities_enabled?: boolean
          quiet_hours_end?: number
          quiet_hours_start?: number
          timezone?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      notifications: {
        Row: {
          body: string | null
          count: number
          created_at: string
          group_key: string | null
          id: string
          kind: string
          link: string | null
          read_at: string | null
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          body?: string | null
          count?: number
          created_at?: string
          group_key?: string | null
          id?: string
          kind: string
          link?: string | null
          read_at?: string | null
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          body?: string | null
          count?: number
          created_at?: string
          group_key?: string | null
          id?: string
          kind?: string
          link?: string | null
          read_at?: string | null
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      onboarding_messages: {
        Row: {
          content: string
          created_at: string
          id: string
          role: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          role: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          role?: string
          user_id?: string
        }
        Relationships: []
      }
      orders: {
        Row: {
          coupon_code: string | null
          created_at: string
          currency: string
          discount_cents: number
          email: string
          id: string
          metadata: Json
          order_nsu: string
          price_id: string
          product_id: string
          referral_attribution_id: string | null
          referral_code: string | null
          referrer_user_id: string | null
          status: string
          subtotal_cents: number
          total_cents: number
          updated_at: string
          user_id: string | null
        }
        Insert: {
          coupon_code?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          email: string
          id?: string
          metadata?: Json
          order_nsu: string
          price_id: string
          product_id: string
          referral_attribution_id?: string | null
          referral_code?: string | null
          referrer_user_id?: string | null
          status?: string
          subtotal_cents: number
          total_cents: number
          updated_at?: string
          user_id?: string | null
        }
        Update: {
          coupon_code?: string | null
          created_at?: string
          currency?: string
          discount_cents?: number
          email?: string
          id?: string
          metadata?: Json
          order_nsu?: string
          price_id?: string
          product_id?: string
          referral_attribution_id?: string | null
          referral_code?: string | null
          referrer_user_id?: string | null
          status?: string
          subtotal_cents?: number
          total_cents?: number
          updated_at?: string
          user_id?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "orders_coupon_code_fkey"
            columns: ["coupon_code"]
            isOneToOne: false
            referencedRelation: "coupons"
            referencedColumns: ["code"]
          },
          {
            foreignKeyName: "orders_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "orders_referral_attribution_id_fkey"
            columns: ["referral_attribution_id"]
            isOneToOne: false
            referencedRelation: "referral_attributions"
            referencedColumns: ["id"]
          },
        ]
      }
      payment_transactions: {
        Row: {
          amount: number
          capture_method: string | null
          checkout_url: string | null
          created_at: string
          currency: string
          external_order_id: string
          external_transaction_id: string | null
          id: string
          installments: number | null
          invoice_slug: string | null
          paid_amount: number | null
          paid_at: string | null
          plan: string
          provider: string
          raw_provider_status: Json | null
          receipt_url: string | null
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          amount: number
          capture_method?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          external_order_id: string
          external_transaction_id?: string | null
          id?: string
          installments?: number | null
          invoice_slug?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          plan: string
          provider?: string
          raw_provider_status?: Json | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          amount?: number
          capture_method?: string | null
          checkout_url?: string | null
          created_at?: string
          currency?: string
          external_order_id?: string
          external_transaction_id?: string | null
          id?: string
          installments?: number | null
          invoice_slug?: string | null
          paid_amount?: number | null
          paid_at?: string | null
          plan?: string
          provider?: string
          raw_provider_status?: Json | null
          receipt_url?: string | null
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      payments: {
        Row: {
          amount_cents: number
          created_at: string
          currency: string
          id: string
          method: string
          order_id: string
          paid_at: string | null
          pix_copy_paste: string | null
          pix_qr_code: string | null
          provider: string
          provider_intent_id: string | null
          raw_payload: Json | null
          status: string
          updated_at: string
        }
        Insert: {
          amount_cents: number
          created_at?: string
          currency?: string
          id?: string
          method: string
          order_id: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider: string
          provider_intent_id?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          method?: string
          order_id?: string
          paid_at?: string | null
          pix_copy_paste?: string | null
          pix_qr_code?: string | null
          provider?: string
          provider_intent_id?: string | null
          raw_payload?: Json | null
          status?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "payments_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
        ]
      }
      payouts: {
        Row: {
          ambassador_user_id: string
          amount_cents: number
          created_at: string
          id: string
          method: Database["public"]["Enums"]["payout_method"]
          notes: string | null
          paid_at: string | null
          pix_key_snapshot: string | null
          provider_ref: string | null
          status: Database["public"]["Enums"]["payout_status"]
          updated_at: string
        }
        Insert: {
          ambassador_user_id: string
          amount_cents: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_method"]
          notes?: string | null
          paid_at?: string | null
          pix_key_snapshot?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Update: {
          ambassador_user_id?: string
          amount_cents?: number
          created_at?: string
          id?: string
          method?: Database["public"]["Enums"]["payout_method"]
          notes?: string | null
          paid_at?: string | null
          pix_key_snapshot?: string | null
          provider_ref?: string | null
          status?: Database["public"]["Enums"]["payout_status"]
          updated_at?: string
        }
        Relationships: []
      }
      plan_items: {
        Row: {
          created_at: string
          done: boolean
          due_date: string | null
          due_time: string | null
          icon: string | null
          id: string
          info: string | null
          kind: string
          source: string
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          due_time?: string | null
          icon?: string | null
          id?: string
          info?: string | null
          kind?: string
          source?: string
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          due_date?: string | null
          due_time?: string | null
          icon?: string | null
          id?: string
          info?: string | null
          kind?: string
          source?: string
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      plan_reflections: {
        Row: {
          activity_text: string | null
          created_at: string
          energy: number | null
          id: string
          note: string | null
          outcome: string
          plan_id: string | null
          reflected_for: string
          signal_answer: string | null
          signal_key: string | null
          user_id: string
        }
        Insert: {
          activity_text?: string | null
          created_at?: string
          energy?: number | null
          id?: string
          note?: string | null
          outcome: string
          plan_id?: string | null
          reflected_for?: string
          signal_answer?: string | null
          signal_key?: string | null
          user_id: string
        }
        Update: {
          activity_text?: string | null
          created_at?: string
          energy?: number | null
          id?: string
          note?: string | null
          outcome?: string
          plan_id?: string | null
          reflected_for?: string
          signal_answer?: string | null
          signal_key?: string | null
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "plan_reflections_plan_id_fkey"
            columns: ["plan_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
        ]
      }
      podcast_settings: {
        Row: {
          default_voice: string
          id: number
          updated_at: string
        }
        Insert: {
          default_voice?: string
          id?: number
          updated_at?: string
        }
        Update: {
          default_voice?: string
          id?: number
          updated_at?: string
        }
        Relationships: []
      }
      prices: {
        Row: {
          active: boolean
          amount_cents: number
          created_at: string
          currency: string
          id: string
          interval: string | null
          product_id: string
        }
        Insert: {
          active?: boolean
          amount_cents: number
          created_at?: string
          currency?: string
          id: string
          interval?: string | null
          product_id: string
        }
        Update: {
          active?: boolean
          amount_cents?: number
          created_at?: string
          currency?: string
          id?: string
          interval?: string | null
          product_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "prices_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          active: boolean
          created_at: string
          description: string | null
          id: string
          name: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          created_at?: string
          description?: string | null
          id: string
          name: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          created_at?: string
          description?: string | null
          id?: string
          name?: string
          updated_at?: string
        }
        Relationships: []
      }
      professional_context: {
        Row: {
          created_at: string
          execution_profile: Json
          last_built_at: string | null
          narrative: string | null
          state: Json
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          execution_profile?: Json
          last_built_at?: string | null
          narrative?: string | null
          state?: Json
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          execution_profile?: Json
          last_built_at?: string | null
          narrative?: string | null
          state?: Json
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          access_granted_at: string | null
          access_type: string | null
          area: string | null
          avatar_url: string | null
          challenge: string | null
          circle_visible: boolean
          city: string | null
          created_at: string
          email: string | null
          full_name: string | null
          goal: string | null
          handle: string | null
          handle_updated_at: string | null
          has_access: boolean
          id: string
          language: string | null
          onboarding_completed_at: string | null
          organize_areas: string | null
          profession: string | null
          referral_attributed_at: string | null
          referral_attribution_id: string | null
          referral_code: string | null
          referral_status: string | null
          referrer_user_id: string | null
          stripe_customer_id_live: string | null
          stripe_customer_id_sandbox: string | null
          subscription_renews_at: string | null
          subscription_started_at: string | null
          subscription_status: string
          tour_completed_at: string | null
          trial_ends_at: string | null
          trial_started_at: string | null
          trial_used: boolean
          updated_at: string
        }
        Insert: {
          access_granted_at?: string | null
          access_type?: string | null
          area?: string | null
          avatar_url?: string | null
          challenge?: string | null
          circle_visible?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          goal?: string | null
          handle?: string | null
          handle_updated_at?: string | null
          has_access?: boolean
          id: string
          language?: string | null
          onboarding_completed_at?: string | null
          organize_areas?: string | null
          profession?: string | null
          referral_attributed_at?: string | null
          referral_attribution_id?: string | null
          referral_code?: string | null
          referral_status?: string | null
          referrer_user_id?: string | null
          stripe_customer_id_live?: string | null
          stripe_customer_id_sandbox?: string | null
          subscription_renews_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string
          tour_completed_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean
          updated_at?: string
        }
        Update: {
          access_granted_at?: string | null
          access_type?: string | null
          area?: string | null
          avatar_url?: string | null
          challenge?: string | null
          circle_visible?: boolean
          city?: string | null
          created_at?: string
          email?: string | null
          full_name?: string | null
          goal?: string | null
          handle?: string | null
          handle_updated_at?: string | null
          has_access?: boolean
          id?: string
          language?: string | null
          onboarding_completed_at?: string | null
          organize_areas?: string | null
          profession?: string | null
          referral_attributed_at?: string | null
          referral_attribution_id?: string | null
          referral_code?: string | null
          referral_status?: string | null
          referrer_user_id?: string | null
          stripe_customer_id_live?: string | null
          stripe_customer_id_sandbox?: string | null
          subscription_renews_at?: string | null
          subscription_started_at?: string | null
          subscription_status?: string
          tour_completed_at?: string | null
          trial_ends_at?: string | null
          trial_started_at?: string | null
          trial_used?: boolean
          updated_at?: string
        }
        Relationships: []
      }
      purchases: {
        Row: {
          amount_cents: number
          created_at: string
          paid_at: string | null
          status: string
          stripe_session_id: string | null
          user_id: string
        }
        Insert: {
          amount_cents?: number
          created_at?: string
          paid_at?: string | null
          status?: string
          stripe_session_id?: string | null
          user_id: string
        }
        Update: {
          amount_cents?: number
          created_at?: string
          paid_at?: string | null
          status?: string
          stripe_session_id?: string | null
          user_id?: string
        }
        Relationships: []
      }
      push_subscriptions: {
        Row: {
          auth: string | null
          created_at: string
          device_label: string | null
          enabled: boolean
          endpoint: string | null
          id: string
          last_success_at: string | null
          p256dh: string | null
          platform: string
          revoked_at: string | null
          subscription_id: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          auth?: string | null
          created_at?: string
          device_label?: string | null
          enabled?: boolean
          endpoint?: string | null
          id?: string
          last_success_at?: string | null
          p256dh?: string | null
          platform?: string
          revoked_at?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          auth?: string | null
          created_at?: string
          device_label?: string | null
          enabled?: boolean
          endpoint?: string | null
          id?: string
          last_success_at?: string | null
          p256dh?: string | null
          platform?: string
          revoked_at?: string | null
          subscription_id?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      referral_attributions: {
        Row: {
          ambassador_user_id: string
          code: string
          consumed_order_id: string | null
          created_at: string
          expires_at: string
          id: string
          visitor_id: string
        }
        Insert: {
          ambassador_user_id: string
          code: string
          consumed_order_id?: string | null
          created_at?: string
          expires_at: string
          id?: string
          visitor_id: string
        }
        Update: {
          ambassador_user_id?: string
          code?: string
          consumed_order_id?: string | null
          created_at?: string
          expires_at?: string
          id?: string
          visitor_id?: string
        }
        Relationships: []
      }
      referral_campaigns: {
        Row: {
          active: boolean
          code: string | null
          created_at: string
          ends_at: string
          id: string
          name: string
          rate_bps: number
          starts_at: string
          updated_at: string
        }
        Insert: {
          active?: boolean
          code?: string | null
          created_at?: string
          ends_at: string
          id?: string
          name: string
          rate_bps: number
          starts_at: string
          updated_at?: string
        }
        Update: {
          active?: boolean
          code?: string | null
          created_at?: string
          ends_at?: string
          id?: string
          name?: string
          rate_bps?: number
          starts_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      referral_clicks: {
        Row: {
          code: string
          created_at: string
          id: string
          ip_hash: string | null
          landing_path: string | null
          referer: string | null
          user_agent: string | null
        }
        Insert: {
          code: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          referer?: string | null
          user_agent?: string | null
        }
        Update: {
          code?: string
          created_at?: string
          id?: string
          ip_hash?: string | null
          landing_path?: string | null
          referer?: string | null
          user_agent?: string | null
        }
        Relationships: []
      }
      referral_commissions: {
        Row: {
          ambassador_user_id: string
          amount_cents: number
          buyer_user_id: string | null
          created_at: string
          eligible_amount_cents: number
          environment: string | null
          gross_amount_cents: number
          id: string
          order_id: string | null
          payment_id: string | null
          payout_id: string | null
          rate_bps: number
          release_at: string
          released_at: string | null
          reversal_reason: string | null
          reversed_at: string | null
          source: string
          status: Database["public"]["Enums"]["commission_status"]
          stripe_invoice_id: string | null
          stripe_subscription_id: string | null
          updated_at: string
        }
        Insert: {
          ambassador_user_id: string
          amount_cents: number
          buyer_user_id?: string | null
          created_at?: string
          eligible_amount_cents: number
          environment?: string | null
          gross_amount_cents: number
          id?: string
          order_id?: string | null
          payment_id?: string | null
          payout_id?: string | null
          rate_bps: number
          release_at: string
          released_at?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["commission_status"]
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Update: {
          ambassador_user_id?: string
          amount_cents?: number
          buyer_user_id?: string | null
          created_at?: string
          eligible_amount_cents?: number
          environment?: string | null
          gross_amount_cents?: number
          id?: string
          order_id?: string | null
          payment_id?: string | null
          payout_id?: string | null
          rate_bps?: number
          release_at?: string
          released_at?: string | null
          reversal_reason?: string | null
          reversed_at?: string | null
          source?: string
          status?: Database["public"]["Enums"]["commission_status"]
          stripe_invoice_id?: string | null
          stripe_subscription_id?: string | null
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "referral_commissions_order_id_fkey"
            columns: ["order_id"]
            isOneToOne: false
            referencedRelation: "orders"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_payment_id_fkey"
            columns: ["payment_id"]
            isOneToOne: true
            referencedRelation: "payments"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "referral_commissions_payout_fk"
            columns: ["payout_id"]
            isOneToOne: false
            referencedRelation: "payouts"
            referencedColumns: ["id"]
          },
        ]
      }
      referral_settings: {
        Row: {
          cookie_days: number
          default_rate_bps: number
          guarantee_days: number
          id: number
          min_payout_cents: number
          updated_at: string
          updated_by: string | null
        }
        Insert: {
          cookie_days?: number
          default_rate_bps?: number
          guarantee_days?: number
          id?: number
          min_payout_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Update: {
          cookie_days?: number
          default_rate_bps?: number
          guarantee_days?: number
          id?: number
          min_payout_cents?: number
          updated_at?: string
          updated_by?: string | null
        }
        Relationships: []
      }
      saved_directions: {
        Row: {
          created_at: string
          direction_text: string
          id: string
          source_id: string | null
          strategy_key: string | null
          user_id: string
          why_text: string | null
        }
        Insert: {
          created_at?: string
          direction_text: string
          id?: string
          source_id?: string | null
          strategy_key?: string | null
          user_id: string
          why_text?: string | null
        }
        Update: {
          created_at?: string
          direction_text?: string
          id?: string
          source_id?: string | null
          strategy_key?: string | null
          user_id?: string
          why_text?: string | null
        }
        Relationships: []
      }
      saved_templates: {
        Row: {
          content: string
          created_at: string
          id: string
          kind: string
          title: string
          user_id: string
        }
        Insert: {
          content: string
          created_at?: string
          id?: string
          kind: string
          title?: string
          user_id: string
        }
        Update: {
          content?: string
          created_at?: string
          id?: string
          kind?: string
          title?: string
          user_id?: string
        }
        Relationships: []
      }
      shared_directions: {
        Row: {
          added_at: string | null
          created_at: string
          description: string
          executed_at: string | null
          id: string
          message: string | null
          plan_id: string | null
          reason: string | null
          recipient_id: string
          responded_at: string | null
          sender_id: string
          status: string
          title: string
        }
        Insert: {
          added_at?: string | null
          created_at?: string
          description: string
          executed_at?: string | null
          id?: string
          message?: string | null
          plan_id?: string | null
          reason?: string | null
          recipient_id: string
          responded_at?: string | null
          sender_id: string
          status?: string
          title: string
        }
        Update: {
          added_at?: string | null
          created_at?: string
          description?: string
          executed_at?: string | null
          id?: string
          message?: string | null
          plan_id?: string | null
          reason?: string | null
          recipient_id?: string
          responded_at?: string | null
          sender_id?: string
          status?: string
          title?: string
        }
        Relationships: []
      }
      stripe_subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          environment: string
          first_invoice_paid_at: string | null
          id: string
          past_due_since: string | null
          price_lookup_key: string
          raw_metadata: Json | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment: string
          first_invoice_paid_at?: string | null
          id?: string
          past_due_since?: string | null
          price_lookup_key: string
          raw_metadata?: Json | null
          status: string
          stripe_customer_id: string
          stripe_subscription_id: string
          trial_end?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          environment?: string
          first_invoice_paid_at?: string | null
          id?: string
          past_due_since?: string | null
          price_lookup_key?: string
          raw_metadata?: Json | null
          status?: string
          stripe_customer_id?: string
          stripe_subscription_id?: string
          trial_end?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      stripe_webhook_events: {
        Row: {
          created_at: string
          environment: string
          error: string | null
          event_type: string
          id: string
          payload: Json | null
          processed_at: string | null
          stripe_event_id: string
        }
        Insert: {
          created_at?: string
          environment: string
          error?: string | null
          event_type: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          stripe_event_id: string
        }
        Update: {
          created_at?: string
          environment?: string
          error?: string | null
          event_type?: string
          id?: string
          payload?: Json | null
          processed_at?: string | null
          stripe_event_id?: string
        }
        Relationships: []
      }
      subscriptions: {
        Row: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_payment_id: string | null
          id: string
          payment_provider: string | null
          plan: string
          price_id: string | null
          product_id: string | null
          provider: string
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        Insert: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_payment_id?: string | null
          id?: string
          payment_provider?: string | null
          plan?: string
          price_id?: string | null
          product_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id: string
        }
        Update: {
          cancel_at_period_end?: boolean
          canceled_at?: string | null
          created_at?: string
          current_period_end?: string | null
          current_period_start?: string | null
          external_payment_id?: string | null
          id?: string
          payment_provider?: string | null
          plan?: string
          price_id?: string | null
          product_id?: string | null
          provider?: string
          provider_subscription_id?: string | null
          status?: string
          trial_ends_at?: string | null
          trial_started_at?: string | null
          updated_at?: string
          user_id?: string
        }
        Relationships: [
          {
            foreignKeyName: "subscriptions_price_id_fkey"
            columns: ["price_id"]
            isOneToOne: false
            referencedRelation: "prices"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "subscriptions_product_id_fkey"
            columns: ["product_id"]
            isOneToOne: false
            referencedRelation: "products"
            referencedColumns: ["id"]
          },
        ]
      }
      support_conversations: {
        Row: {
          admin_last_read_at: string
          created_at: string
          id: string
          last_message_at: string
          last_message_preview: string | null
          status: string
          updated_at: string
          user_id: string
          user_last_read_at: string
        }
        Insert: {
          admin_last_read_at?: string
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          updated_at?: string
          user_id: string
          user_last_read_at?: string
        }
        Update: {
          admin_last_read_at?: string
          created_at?: string
          id?: string
          last_message_at?: string
          last_message_preview?: string | null
          status?: string
          updated_at?: string
          user_id?: string
          user_last_read_at?: string
        }
        Relationships: []
      }
      support_messages: {
        Row: {
          attachment_name: string | null
          attachment_url: string | null
          body: string | null
          conversation_id: string
          created_at: string
          id: string
          sender_id: string
          sender_role: string
        }
        Insert: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_id: string
          created_at?: string
          id?: string
          sender_id: string
          sender_role: string
        }
        Update: {
          attachment_name?: string | null
          attachment_url?: string | null
          body?: string | null
          conversation_id?: string
          created_at?: string
          id?: string
          sender_id?: string
          sender_role?: string
        }
        Relationships: [
          {
            foreignKeyName: "support_messages_conversation_id_fkey"
            columns: ["conversation_id"]
            isOneToOne: false
            referencedRelation: "support_conversations"
            referencedColumns: ["id"]
          },
        ]
      }
      user_focus_shifts: {
        Row: {
          created_at: string
          duration: string
          finished_at: string | null
          focus_key: string
          focus_label: string
          id: string
          note: string | null
          status: string
          user_id: string
        }
        Insert: {
          created_at?: string
          duration?: string
          finished_at?: string | null
          focus_key: string
          focus_label: string
          id?: string
          note?: string | null
          status?: string
          user_id: string
        }
        Update: {
          created_at?: string
          duration?: string
          finished_at?: string | null
          focus_key?: string
          focus_label?: string
          id?: string
          note?: string | null
          status?: string
          user_id?: string
        }
        Relationships: []
      }
      user_plans: {
        Row: {
          adapted_at: string | null
          alignment_score: number | null
          arc_id: string | null
          completed_at: string | null
          context_summary: string | null
          context_version: string | null
          continuity_mode: string | null
          decision: Json | null
          difficulty: number | null
          engine_version: string | null
          expected_signal: string | null
          first_action: string | null
          generated_at: string
          id: string
          interaction_config: Json | null
          interaction_type: string | null
          invalidated_at: string | null
          invalidation_reason: string | null
          is_active: boolean
          meta_date: string | null
          needs_professional: boolean
          next_actions: Json
          orchestration: Json | null
          origin_kind: string
          origin_label: string | null
          outcome: string | null
          outcome_at: string | null
          parent_plan_id: string | null
          priority_reason: string | null
          priority_title: string
          request_id: string | null
          risk_level: string | null
          shared_direction_id: string | null
          skip_reason: string | null
          source: string
          started_at: string | null
          status: string
          strategy_key: string | null
          timezone: string | null
          updated_at: string
          user_id: string
          weekly_focus_id: string | null
          weekly_focus_text: string | null
        }
        Insert: {
          adapted_at?: string | null
          alignment_score?: number | null
          arc_id?: string | null
          completed_at?: string | null
          context_summary?: string | null
          context_version?: string | null
          continuity_mode?: string | null
          decision?: Json | null
          difficulty?: number | null
          engine_version?: string | null
          expected_signal?: string | null
          first_action?: string | null
          generated_at?: string
          id?: string
          interaction_config?: Json | null
          interaction_type?: string | null
          invalidated_at?: string | null
          invalidation_reason?: string | null
          is_active?: boolean
          meta_date?: string | null
          needs_professional?: boolean
          next_actions?: Json
          orchestration?: Json | null
          origin_kind?: string
          origin_label?: string | null
          outcome?: string | null
          outcome_at?: string | null
          parent_plan_id?: string | null
          priority_reason?: string | null
          priority_title: string
          request_id?: string | null
          risk_level?: string | null
          shared_direction_id?: string | null
          skip_reason?: string | null
          source?: string
          started_at?: string | null
          status?: string
          strategy_key?: string | null
          timezone?: string | null
          updated_at?: string
          user_id: string
          weekly_focus_id?: string | null
          weekly_focus_text?: string | null
        }
        Update: {
          adapted_at?: string | null
          alignment_score?: number | null
          arc_id?: string | null
          completed_at?: string | null
          context_summary?: string | null
          context_version?: string | null
          continuity_mode?: string | null
          decision?: Json | null
          difficulty?: number | null
          engine_version?: string | null
          expected_signal?: string | null
          first_action?: string | null
          generated_at?: string
          id?: string
          interaction_config?: Json | null
          interaction_type?: string | null
          invalidated_at?: string | null
          invalidation_reason?: string | null
          is_active?: boolean
          meta_date?: string | null
          needs_professional?: boolean
          next_actions?: Json
          orchestration?: Json | null
          origin_kind?: string
          origin_label?: string | null
          outcome?: string | null
          outcome_at?: string | null
          parent_plan_id?: string | null
          priority_reason?: string | null
          priority_title?: string
          request_id?: string | null
          risk_level?: string | null
          shared_direction_id?: string | null
          skip_reason?: string | null
          source?: string
          started_at?: string | null
          status?: string
          strategy_key?: string | null
          timezone?: string | null
          updated_at?: string
          user_id?: string
          weekly_focus_id?: string | null
          weekly_focus_text?: string | null
        }
        Relationships: [
          {
            foreignKeyName: "user_plans_arc_id_fkey"
            columns: ["arc_id"]
            isOneToOne: false
            referencedRelation: "direction_arcs"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plans_parent_plan_id_fkey"
            columns: ["parent_plan_id"]
            isOneToOne: false
            referencedRelation: "user_plans"
            referencedColumns: ["id"]
          },
          {
            foreignKeyName: "user_plans_shared_direction_id_fkey"
            columns: ["shared_direction_id"]
            isOneToOne: false
            referencedRelation: "shared_directions"
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
      webhook_events: {
        Row: {
          created_at: string
          error: string | null
          event_id: string
          event_type: string | null
          id: string
          payload: Json
          processed_at: string | null
          provider: string
        }
        Insert: {
          created_at?: string
          error?: string | null
          event_id: string
          event_type?: string | null
          id?: string
          payload: Json
          processed_at?: string | null
          provider: string
        }
        Update: {
          created_at?: string
          error?: string | null
          event_id?: string
          event_type?: string | null
          id?: string
          payload?: Json
          processed_at?: string | null
          provider?: string
        }
        Relationships: []
      }
      weekly_focus: {
        Row: {
          advances: number
          clarified_at: string | null
          clarify_answer: string | null
          clarify_options: Json
          clarify_question: string | null
          completed_at: string | null
          created_at: string
          end_date: string
          end_reason: string | null
          focus_kind: string
          id: string
          interpreted: string
          main_goal: string | null
          metric_label: string | null
          metric_progress: number
          metric_target: number | null
          pending_options: Json
          raw_text: string
          recommendation: string | null
          review_summary: string | null
          start_date: string
          status: string
          updated_at: string
          user_id: string
        }
        Insert: {
          advances?: number
          clarified_at?: string | null
          clarify_answer?: string | null
          clarify_options?: Json
          clarify_question?: string | null
          completed_at?: string | null
          created_at?: string
          end_date: string
          end_reason?: string | null
          focus_kind?: string
          id?: string
          interpreted: string
          main_goal?: string | null
          metric_label?: string | null
          metric_progress?: number
          metric_target?: number | null
          pending_options?: Json
          raw_text: string
          recommendation?: string | null
          review_summary?: string | null
          start_date: string
          status?: string
          updated_at?: string
          user_id: string
        }
        Update: {
          advances?: number
          clarified_at?: string | null
          clarify_answer?: string | null
          clarify_options?: Json
          clarify_question?: string | null
          completed_at?: string | null
          created_at?: string
          end_date?: string
          end_reason?: string | null
          focus_kind?: string
          id?: string
          interpreted?: string
          main_goal?: string | null
          metric_label?: string | null
          metric_progress?: number
          metric_target?: number | null
          pending_options?: Json
          raw_text?: string
          recommendation?: string | null
          review_summary?: string | null
          start_date?: string
          status?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
      weekly_tasks: {
        Row: {
          created_at: string
          done: boolean
          id: string
          position: number
          title: string
          updated_at: string
          user_id: string
        }
        Insert: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          title: string
          updated_at?: string
          user_id: string
        }
        Update: {
          created_at?: string
          done?: boolean
          id?: string
          position?: number
          title?: string
          updated_at?: string
          user_id?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      activate_trial_for_current_user: { Args: never; Returns: Json }
      award_magnetos: {
        Args: {
          _amount: number
          _dedupe_key: string
          _reason: string
          _user_id: string
        }
        Returns: boolean
      }
      check_handle_available: { Args: { _handle: string }; Returns: boolean }
      checkin_circle_direction: {
        Args: { _circle_id: string; _local_date: string; _note?: string }
        Returns: Json
      }
      circle_goal_per_member: {
        Args: { _c: Database["public"]["Tables"]["circles"]["Row"] }
        Returns: number
      }
      circle_member_stats: {
        Args: { _end: string; _start: string; _uid: string }
        Returns: {
          active_days: number
          steps: number
          streak: number
        }[]
      }
      claim_magnet_rewards: { Args: { _local_date?: string }; Returns: Json }
      complete_direction_with_reward: {
        Args: { _plan_id: string }
        Returns: Json
      }
      create_circle: {
        Args: {
          _challenge_kind: string
          _challenge_text: string
          _duration_days: number
          _name: string
          _target_count: number
        }
        Returns: Json
      }
      end_circle: { Args: { _circle_id: string }; Returns: Json }
      ensure_trial_subscription: {
        Args: { _user_id: string }
        Returns: {
          cancel_at_period_end: boolean
          canceled_at: string | null
          created_at: string
          current_period_end: string | null
          current_period_start: string | null
          external_payment_id: string | null
          id: string
          payment_provider: string | null
          plan: string
          price_id: string | null
          product_id: string | null
          provider: string
          provider_subscription_id: string | null
          status: string
          trial_ends_at: string | null
          trial_started_at: string | null
          updated_at: string
          user_id: string
        }
        SetofOptions: {
          from: "*"
          to: "subscriptions"
          isOneToOne: true
          isSetofReturn: false
        }
      }
      ensure_user_bootstrap: { Args: never; Returns: Json }
      get_access_decision: { Args: { _user_id: string }; Returns: Json }
      get_access_state: { Args: { _user_id: string }; Returns: Json }
      get_active_circle_summary: { Args: never; Returns: Json }
      get_circle_detail: { Args: { _circle_id: string }; Returns: Json }
      get_direction_confidence: { Args: { _title: string }; Returns: Json }
      get_impact_overview: { Args: never; Returns: Json }
      get_magnet_balance: { Args: never; Returns: number }
      get_my_access_status: { Args: never; Returns: Json }
      get_my_circles: { Args: never; Returns: Json }
      has_active_access: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
      invite_to_circle: {
        Args: { _circle_id: string; _user_ids: string[] }
        Returns: Json
      }
      is_ambassador: { Args: { _user_id: string }; Returns: boolean }
      is_ambassador_email: { Args: { _email: string }; Returns: boolean }
      is_circle_member: {
        Args: { _circle_id: string; _user_id: string }
        Returns: boolean
      }
      join_circle_by_code: { Args: { _code: string }; Returns: Json }
      leave_circle: { Args: { _circle_id: string }; Returns: Json }
      link_referral_from_visitor: {
        Args: { _visitor_id: string }
        Returns: Json
      }
      mark_unconverted_referrals: { Args: never; Returns: number }
      normalize_email: { Args: { _raw: string }; Returns: string }
      normalize_handle_body: { Args: { _raw: string }; Returns: string }
      partial_direction_with_reward: {
        Args: { _plan_id: string }
        Returns: Json
      }
      push_notification: {
        Args: {
          _body: string
          _group_key: string
          _kind: string
          _link: string
          _title: string
          _user_id: string
        }
        Returns: undefined
      }
      recent_direction_contacts: {
        Args: never
        Returns: {
          avatar_url: string
          full_name: string
          handle: string
          id: string
          profession: string
        }[]
      }
      repair_trial_window: { Args: { _user_id: string }; Returns: Json }
      respond_circle_invite: {
        Args: { _accept: boolean; _invite_id: string }
        Returns: Json
      }
      search_imag_people: {
        Args: { _q: string }
        Returns: {
          avatar_url: string
          full_name: string
          handle: string
          id: string
          profession: string
        }[]
      }
      set_circle_direction: {
        Args: { _circle_id: string; _local_date: string; _text: string }
        Returns: Json
      }
      set_circle_focus: {
        Args: { _circle_id: string; _focus: string }
        Returns: Json
      }
      set_my_handle: { Args: { _handle: string }; Returns: Json }
      start_trial_for_current_user: { Args: never; Returns: Json }
      suggest_handles: { Args: { _base: string }; Returns: string[] }
      toggle_impact_reaction: { Args: { _impact_id: string }; Returns: Json }
      update_circle_challenge: {
        Args: {
          _challenge_kind: string
          _challenge_text: string
          _circle_id: string
          _target_count: number
        }
        Returns: Json
      }
    }
    Enums: {
      ambassador_status: "active" | "blocked" | "pending_review"
      ambassador_tier: "ambassador" | "pro" | "partner"
      app_role: "admin" | "user"
      commission_status:
        | "pending"
        | "available"
        | "paid"
        | "reversed"
        | "cancelled"
      fraud_reason:
        | "self_referral"
        | "duplicate_account"
        | "suspicious_ip"
        | "velocity"
        | "manual"
      payout_method: "pix" | "manual"
      payout_status: "requested" | "processing" | "paid" | "failed"
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
      ambassador_status: ["active", "blocked", "pending_review"],
      ambassador_tier: ["ambassador", "pro", "partner"],
      app_role: ["admin", "user"],
      commission_status: [
        "pending",
        "available",
        "paid",
        "reversed",
        "cancelled",
      ],
      fraud_reason: [
        "self_referral",
        "duplicate_account",
        "suspicious_ip",
        "velocity",
        "manual",
      ],
      payout_method: ["pix", "manual"],
      payout_status: ["requested", "processing", "paid", "failed"],
    },
  },
} as const
