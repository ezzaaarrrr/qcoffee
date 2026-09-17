import { supabase } from "@/integrations/supabase/client";
import type { FormStatus } from "@/lib/domain";

export type FormulasiRow = {
  id: string;
  created_by: string;
  tanggal_mixing: string;
  no_mixer: string | null;
  produk: string | null;
  no_urut_batch: string | null;
  shift_regu: string | null;
  line: string | null;
  start_mixing: string | null;
  selesai_mixing: string | null;
  material: string | null;
  quantity: number | null;
  qan_rm: string | null;
  qan_premix: string | null;
  operator_premix: string | null;
  keterangan: string | null;
  status: FormStatus;
  qc_notes: string | null;
  approved_by_qc: string | null;
  approved_by_uh: string | null;
  created_at: string;
};

export type GrindingRow = {
  id: string;
  created_by: string;
  hari_tanggal: string;
  shift: string;
  no_grinder: string | null;
  nama_produk: string | null;
  no_batch: string | null;
  no_urut_batch: string | null;
  raw_material: string | null;
  keterangan_petunjuk: string | null;
  status: FormStatus;
  qc_notes: string | null;
  diperiksa_qc_by: string | null;
  disetujui_uh_by: string | null;
  created_at: string;
};

export type GrindingItem = {
  id?: string;
  grinding_id?: string;
  urutan: number;
  start_time: string | null;
  finish_time: string | null;
  jam_kerja: number | null;
  qty_roasting: number | null;
  total_qty: number | null;
  qty_grinding: number | null;
  aktual_qty: number | null;
  waste: number | null;
  kehalusan_mesin: string | null;
  density: number | null;
  aroma: string | null;
  ph: number | null;
  moisture_mc: number | null;
  station: string | null;
  keterangan: string | null;
};

export type RoastingRow = {
  id: string;
  created_by: string;
  hari_tanggal: string;
  shift_regu: string | null;
  no_roaster: string | null;
  nama_produk: string | null;
  keterangan_tambahan: string | null;
  status: FormStatus;
  qc_notes: string | null;
  diperiksa_qc_by: string | null;
  disetujui_uh_by: string | null;
  created_at: string;
};

export type RoastingItem = {
  id?: string;
  roasting_id?: string;
  no_item: number;
  no_qar_barang: string | null;
  no_silo_kopi_mentah: string | null;
  jumlah_mentah_kg: number | null;
  jumlah_matang_kg: number | null;
  roasting_start: string | null;
  roasting_finish: string | null;
  waktu_roasting_menit: number | null;
  temp_roasting_c: number | null;
  cooling_start: string | null;
  cooling_finish: string | null;
  waktu_cooling_menit: number | null;
  temp_cooling_c: number | null;
  waste: number | null;
  ph: number | null;
  mc_percent: number | null;
  qar_roasting: string | null;
  no_silo_kopi_matang: string | null;
};

export async function fetchFormulasi() {
  const { data, error } = await supabase
    .from("form_formulasi")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as FormulasiRow[];
}

export async function fetchGrinding() {
  const { data, error } = await supabase
    .from("form_grinding")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as GrindingRow[];
}

export async function fetchGrindingItems(grindingId: string) {
  const { data, error } = await supabase
    .from("form_grinding_items")
    .select("*")
    .eq("grinding_id", grindingId)
    .order("urutan");
  if (error) throw error;
  return (data ?? []) as GrindingItem[];
}

export async function fetchRoasting() {
  const { data, error } = await supabase
    .from("form_roasting")
    .select("*")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data ?? []) as RoastingRow[];
}

export async function fetchRoastingItems(roastingId: string) {
  const { data, error } = await supabase
    .from("form_roasting_items")
    .select("*")
    .eq("roasting_id", roastingId)
    .order("no_item");
  if (error) throw error;
  return (data ?? []) as RoastingItem[];
}

export async function fetchProducts() {
  const { data, error } = await (supabase as any)
    .from("products")
    .select("id, name, code, is_active, current_stock, min_stock")
    .order("name");
  if (error) throw error;
  return (data ?? []) as {
    id: string;
    name: string;
    code: string | null;
    is_active: boolean;
    current_stock?: number | null;
    min_stock?: number | null;
  }[];
}

export async function fetchProfiles() {
  const { data, error } = await supabase
    .from("profiles")
    .select("id, full_name, email, department, signature_url")
    .order("full_name");
  if (error) throw error;
  return data ?? [];
}

export async function fetchUserRoles() {
  const { data, error } = await supabase.from("user_roles").select("id, user_id, role");
  if (error) throw error;
  return data ?? [];
}
