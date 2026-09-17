export type AppRole = "admin_process" | "qc_field" | "prod_process_uh" | "admin";
export type FormStatus = "Draft" | "Pending QC" | "Approved" | "Rejected";
export type Shift = "Shift 1" | "Shift 2" | "Shift 3";

export const ROLE_LABELS: Record<AppRole, string> = {
  admin_process: "Departemen Produksi Cheking",
  qc_field: "Departemen Countinous Improvment",
  prod_process_uh: "Department Warehouse - Sparepart",
  admin: "Super Admin",
};

export const SHIFTS: Shift[] = ["Shift 1", "Shift 2", "Shift 3"];
export const STATUSES: FormStatus[] = ["Draft", "Pending QC", "Approved", "Rejected"];

export type FormKind = "formulasi" | "grinding" | "roasting";

export const FORM_LABELS: Record<FormKind, string> = {
  formulasi: "Formulasi",
  grinding: "Proses Grinding",
  roasting: "Proses Roasting",
};

/** Selisih dua jam (HH:mm atau HH:mm:ss) dalam menit; melewati tengah malam dihitung +24 jam. */
export function minutesBetween(start?: string | null, finish?: string | null): number | null {
  if (!start || !finish) return null;
  const toMin = (t: string) => {
    const parts = t.split(":");
    const hh = Number(parts[0]);
    const mm = Number(parts[1]);
    const ss = parts[2] ? Number(parts[2]) : 0;
    if (Number.isNaN(hh) || Number.isNaN(mm) || Number.isNaN(ss)) return null;
    return hh * 60 + mm + ss / 60;
  };
  const a = toMin(start);
  const b = toMin(finish);
  if (a === null || b === null) return null;
  return b >= a ? b - a : b + 24 * 60 - a;
}

export function hoursBetween(start?: string | null, finish?: string | null): number | null {
  const mins = minutesBetween(start, finish);
  return mins === null ? null : Math.round((mins / 60) * 100) / 100;
}

export function num(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

export function formatNumber(value: number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || Number.isNaN(value)) return "—";
  return value.toLocaleString("id-ID", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatDate(value?: string | null): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return value;
  return d.toLocaleDateString("id-ID", { day: "2-digit", month: "short", year: "numeric" });
}

/** Standar organoleptik grinding: aroma khas kopi, pH 4.8–5.6, MC ≤ 5%. */
export function organoleptikSesuai(item: {
  aroma?: string | null;
  ph?: number | null;
  moisture_mc?: number | null;
}): boolean {
  const aromaOk = !item.aroma || item.aroma.toLowerCase() !== "menyimpang";
  const phOk = item.ph === null || item.ph === undefined || (item.ph >= 4.8 && item.ph <= 5.6);
  const mcOk = item.moisture_mc === null || item.moisture_mc === undefined || item.moisture_mc <= 5;
  return aromaOk && phOk && mcOk;
}
