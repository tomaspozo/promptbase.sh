export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export type Database = {
  api: {
    Tables: {
      [_ in never]: never
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      _admin_enqueue_task: {
        Args: { delay_seconds?: number; function_name: string; payload?: Json }
        Returns: number
      }
      _admin_environment_create: {
        Args: {
          p_name: string
          p_project_ref: string
          p_secret: string
          p_tenant_id: string
          p_url: string
          p_user_id: string
          p_version: string
        }
        Returns: Json
      }
      _admin_environment_proxy: {
        Args: { p_env_id: string; p_user_id: string }
        Returns: Json
      }
      _admin_organization_connect: {
        Args: {
          p_access_token: string
          p_refresh_token: string
          p_supabase_org_id: string
          p_supabase_org_name: string
          p_tenant_id: string
          p_user_id: string
        }
        Returns: Json
      }
      _admin_organization_token: {
        Args: { p_org_id: string; p_user_id: string }
        Returns: string
      }
      _admin_queue_archive: { Args: { id: number }; Returns: boolean }
      _admin_queue_delete: { Args: { id: number }; Returns: boolean }
      _admin_queue_read: {
        Args: { qty?: number; vt?: number }
        Returns: {
          enqueued_at: string
          message: Json
          msg_id: number
          read_ct: number
          vt: string
        }[]
      }
      _admin_tenant_org_token: {
        Args: { p_tenant_id: string; p_user_id: string }
        Returns: string
      }
      environment_get: { Args: { p_env_id: string }; Returns: Json }
      environment_list: { Args: never; Returns: Json }
      invitation_accept: { Args: { p_token: string }; Returns: Json }
      invitation_create: {
        Args: { p_email: string; p_role?: string }
        Returns: Json
      }
      invitation_list: { Args: never; Returns: Json }
      invitation_preview: { Args: { p_token: string }; Returns: Json }
      invitation_resend: { Args: { p_invitation_id: string }; Returns: Json }
      invitation_revoke: { Args: { p_invitation_id: string }; Returns: Json }
      membership_list: { Args: never; Returns: Json }
      membership_remove: { Args: { p_membership_id: string }; Returns: Json }
      membership_update_role: {
        Args: { p_membership_id: string; p_role: string }
        Returns: Json
      }
      organization_list: { Args: never; Returns: Json }
      organization_read_for_tenant: {
        Args: { p_tenant_id: string }
        Returns: Json
      }
      profile_get: { Args: never; Returns: Json }
      profile_update: {
        Args: { p_avatar_url?: string; p_display_name?: string }
        Returns: Json
      }
      tenant_create: { Args: { p_name: string; p_slug: string }; Returns: Json }
      tenant_list: { Args: never; Returns: Json }
      tenant_rename: {
        Args: { p_name: string; p_tenant_id: string }
        Returns: Json
      }
      tenant_select: { Args: { p_tenant_id: string }; Returns: Json }
      tenant_upgrade: { Args: { p_tenant_id: string }; Returns: Json }
    }
    Enums: {
      [_ in never]: never
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
  api: {
    Enums: {},
  },
} as const