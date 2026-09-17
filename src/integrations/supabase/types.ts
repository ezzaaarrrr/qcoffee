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
    PostgrestVersion: "14.15"
  }
  public: {
    Tables: {
      form_formulasi: {
        Row: {
          approved_by_qc: string | null
          approved_by_uh: string | null
          approved_qc_at: string | null
          approved_uh_at: string | null
          created_at: string
          created_by: string
          id: string
          keterangan: string | null
          line: string | null
          material: string | null
          no_mixer: string | null
          no_urut_batch: string | null
          operator_premix: string | null
          produk: string | null
          qan_premix: string | null
          qan_rm: string | null
          qc_notes: string | null
          quantity: number | null
          selesai_mixing: string | null
          shift_regu: string | null
          start_mixing: string | null
          status: Database["public"]["Enums"]["status_enum"]
          tanggal_mixing: string
          updated_at: string
        }
        Insert: {
          approved_by_qc?: string | null
          approved_by_uh?: string | null
          approved_qc_at?: string | null
          approved_uh_at?: string | null
          created_at?: string
          created_by: string
          id?: string
          keterangan?: string | null
          line?: string | null
          material?: string | null
          no_mixer?: string | null
          no_urut_batch?: string | null
          operator_premix?: string | null
          produk?: string | null
          qan_premix?: string | null
          qan_rm?: string | null
          qc_notes?: string | null
          quantity?: number | null
          selesai_mixing?: string | null
          shift_regu?: string | null
          start_mixing?: string | null
          status?: Database["public"]["Enums"]["status_enum"]
          tanggal_mixing: string
          updated_at?: string
        }
        Update: {
          approved_by_qc?: string | null
          approved_by_uh?: string | null
          approved_qc_at?: string | null
          approved_uh_at?: string | null
          created_at?: string
          created_by?: string
          id?: string
          keterangan?: string | null
          line?: string | null
          material?: string | null
          no_mixer?: string | null
          no_urut_batch?: string | null
          operator_premix?: string | null
          produk?: string | null
          qan_premix?: string | null
          qan_rm?: string | null
          qc_notes?: string | null
          quantity?: number | null
          selesai_mixing?: string | null
          shift_regu?: string | null
          start_mixing?: string | null
          status?: Database["public"]["Enums"]["status_enum"]
          tanggal_mixing?: string
          updated_at?: string
        }
        Relationships: []
      }
      form_grinding: {
        Row: {
          approved_qc_at: string | null
          approved_uh_at: string | null
          created_at: string
          created_by: string
          dibuat_by: string | null
          diperiksa_qc_by: string | null
          disetujui_uh_by: string | null
          hari_tanggal: string
          id: string
          keterangan_petunjuk: string | null
          nama_produk: string | null
          no_batch: string | null
          no_grinder: string | null
          no_urut_batch: string | null
          qc_notes: string | null
          raw_material: string | null
          shift: Database["public"]["Enums"]["shift_enum"]
          status: Database["public"]["Enums"]["status_enum"]
          updated_at: string
        }
        Insert: {
          approved_qc_at?: string | null
          approved_uh_at?: string | null
          created_at?: string
          created_by: string
          dibuat_by?: string | null
          diperiksa_qc_by?: string | null
          disetujui_uh_by?: string | null
          hari_tanggal: string
          id?: string
          keterangan_petunjuk?: string | null
          nama_produk?: string | null
          no_batch?: string | null
          no_grinder?: string | null
          no_urut_batch?: string | null
          qc_notes?: string | null
          raw_material?: string | null
          shift?: Database["public"]["Enums"]["shift_enum"]
          status?: Database["public"]["Enums"]["status_enum"]
          updated_at?: string
        }
        Update: {
          approved_qc_at?: string | null
          approved_uh_at?: string | null
          created_at?: string
          created_by?: string
          dibuat_by?: string | null
          diperiksa_qc_by?: string | null
          disetujui_uh_by?: string | null
          hari_tanggal?: string
          id?: string
          keterangan_petunjuk?: string | null
          nama_produk?: string | null
          no_batch?: string | null
          no_grinder?: string | null
          no_urut_batch?: string | null
          qc_notes?: string | null
          raw_material?: string | null
          shift?: Database["public"]["Enums"]["shift_enum"]
          status?: Database["public"]["Enums"]["status_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      form_grinding_items: {
        Row: {
          aktual_qty: number | null
          aroma: string | null
          created_at: string
          density: number | null
          finish_time: string | null
          grinding_id: string
          id: string
          jam_kerja: number | null
          kehalusan_mesin: string | null
          keterangan: string | null
          moisture_mc: number | null
          ph: number | null
          qty_grinding: number | null
          qty_roasting: number | null
          start_time: string | null
          station: string | null
          total_qty: number | null
          urutan: number
          waste: number | null
        }
        Insert: {
          aktual_qty?: number | null
          aroma?: string | null
          created_at?: string
          density?: number | null
          finish_time?: string | null
          grinding_id: string
          id?: string
          jam_kerja?: number | null
          kehalusan_mesin?: string | null
          keterangan?: string | null
          moisture_mc?: number | null
          ph?: number | null
          qty_grinding?: number | null
          qty_roasting?: number | null
          start_time?: string | null
          station?: string | null
          total_qty?: number | null
          urutan?: number
          waste?: number | null
        }
        Update: {
          aktual_qty?: number | null
          aroma?: string | null
          created_at?: string
          density?: number | null
          finish_time?: string | null
          grinding_id?: string
          id?: string
          jam_kerja?: number | null
          kehalusan_mesin?: string | null
          keterangan?: string | null
          moisture_mc?: number | null
          ph?: number | null
          qty_grinding?: number | null
          qty_roasting?: number | null
          start_time?: string | null
          station?: string | null
          total_qty?: number | null
          urutan?: number
          waste?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_grinding_items_grinding_id_fkey"
            columns: ["grinding_id"]
            isOneToOne: false
            referencedRelation: "form_grinding"
            referencedColumns: ["id"]
          },
        ]
      }
      form_roasting: {
        Row: {
          approved_qc_at: string | null
          approved_uh_at: string | null
          created_at: string
          created_by: string
          dibuat_by: string | null
          diperiksa_qc_by: string | null
          disetujui_uh_by: string | null
          hari_tanggal: string
          id: string
          keterangan_tambahan: string | null
          nama_produk: string | null
          no_roaster: string | null
          qc_notes: string | null
          shift_regu: string | null
          status: Database["public"]["Enums"]["status_enum"]
          updated_at: string
        }
        Insert: {
          approved_qc_at?: string | null
          approved_uh_at?: string | null
          created_at?: string
          created_by: string
          dibuat_by?: string | null
          diperiksa_qc_by?: string | null
          disetujui_uh_by?: string | null
          hari_tanggal: string
          id?: string
          keterangan_tambahan?: string | null
          nama_produk?: string | null
          no_roaster?: string | null
          qc_notes?: string | null
          shift_regu?: string | null
          status?: Database["public"]["Enums"]["status_enum"]
          updated_at?: string
        }
        Update: {
          approved_qc_at?: string | null
          approved_uh_at?: string | null
          created_at?: string
          created_by?: string
          dibuat_by?: string | null
          diperiksa_qc_by?: string | null
          disetujui_uh_by?: string | null
          hari_tanggal?: string
          id?: string
          keterangan_tambahan?: string | null
          nama_produk?: string | null
          no_roaster?: string | null
          qc_notes?: string | null
          shift_regu?: string | null
          status?: Database["public"]["Enums"]["status_enum"]
          updated_at?: string
        }
        Relationships: []
      }
      departments: {
        Row: {
          code: string | null
          created_at: string
          description: string | null
          id: string
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          description?: string | null
          id?: string
          name?: string
        }
        Relationships: []
      }
      form_roasting_items: {
        Row: {
          cooling_finish: string | null
          cooling_start: string | null
          created_at: string
          id: string
          jumlah_matang_kg: number | null
          jumlah_mentah_kg: number | null
          mc_percent: number | null
          no_item: number
          no_qar_barang: string | null
          no_silo_kopi_matang: string | null
          no_silo_kopi_mentah: string | null
          ph: number | null
          qar_roasting: string | null
          roasting_finish: string | null
          roasting_id: string
          roasting_start: string | null
          temp_cooling_c: number | null
          temp_roasting_c: number | null
          waktu_cooling_menit: number | null
          waktu_roasting_menit: number | null
          waste: number | null
        }
        Insert: {
          cooling_finish?: string | null
          cooling_start?: string | null
          created_at?: string
          id?: string
          jumlah_matang_kg?: number | null
          jumlah_mentah_kg?: number | null
          mc_percent?: number | null
          no_item?: number
          no_qar_barang?: string | null
          no_silo_kopi_matang?: string | null
          no_silo_kopi_mentah?: string | null
          ph?: number | null
          qar_roasting?: string | null
          roasting_finish?: string | null
          roasting_id: string
          roasting_start?: string | null
          temp_cooling_c?: number | null
          temp_roasting_c?: number | null
          waktu_cooling_menit?: number | null
          waktu_roasting_menit?: number | null
          waste?: number | null
        }
        Update: {
          cooling_finish?: string | null
          cooling_start?: string | null
          created_at?: string
          id?: string
          jumlah_matang_kg?: number | null
          jumlah_mentah_kg?: number | null
          mc_percent?: number | null
          no_item?: number
          no_qar_barang?: string | null
          no_silo_kopi_matang?: string | null
          no_silo_kopi_mentah?: string | null
          ph?: number | null
          qar_roasting?: string | null
          roasting_finish?: string | null
          roasting_id?: string
          roasting_start?: string | null
          temp_cooling_c?: number | null
          temp_roasting_c?: number | null
          waktu_cooling_menit?: number | null
          waktu_roasting_menit?: number | null
          waste?: number | null
        }
        Relationships: [
          {
            foreignKeyName: "form_roasting_items_roasting_id_fkey"
            columns: ["roasting_id"]
            isOneToOne: false
            referencedRelation: "form_roasting"
            referencedColumns: ["id"]
          },
        ]
      }
      products: {
        Row: {
          code: string | null
          created_at: string
          id: string
          is_active: boolean
          name: string
        }
        Insert: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name: string
        }
        Update: {
          code?: string | null
          created_at?: string
          id?: string
          is_active?: boolean
          name?: string
        }
        Relationships: []
      }
      profiles: {
        Row: {
          created_at: string
          department: string | null
          email: string
          full_name: string
          id: string
          signature_url: string | null
          updated_at: string
        }
        Insert: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id: string
          signature_url?: string | null
          updated_at?: string
        }
        Update: {
          created_at?: string
          department?: string | null
          email?: string
          full_name?: string
          id?: string
          signature_url?: string | null
          updated_at?: string
        }
        Relationships: []
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
      can_create_forms: { Args: { _user_id: string }; Returns: boolean }
      can_review_forms: { Args: { _user_id: string }; Returns: boolean }
      has_role: {
        Args: {
          _role: Database["public"]["Enums"]["app_role"]
          _user_id: string
        }
        Returns: boolean
      }
    }
    Enums: {
      app_role: "admin_process" | "qc_field" | "prod_process_uh" | "admin"
      shift_enum: "Shift 1" | "Shift 2" | "Shift 3"
      status_enum: "Draft" | "Pending QC" | "Approved" | "Rejected"
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
      app_role: ["admin_process", "qc_field", "prod_process_uh", "admin"],
      shift_enum: ["Shift 1", "Shift 2", "Shift 3"],
      status_enum: ["Draft", "Pending QC", "Approved", "Rejected"],
    },
  },
} as const
