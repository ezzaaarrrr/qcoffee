import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * ── SINKRONISASI STOK LINTAS MENU ─────────────────────────────────────────────
 * Menyamakan qty stok suatu barang di tiga sumber data menu:
 *   1. "products"     → menu OBS Sparepart
 *   2. "spareparts"   → menu Master Barang (import Excel, ±2.735 item)
 *   3. "buffer_stock" → menu Buffer Stock
 *
 * Aturan penting:
 *  - Hanya kolom qty stok yang diubah. Parameter kontrol OBS/Buffer
 *    (min_stock, safe_stock, max_stock) TIDAK pernah disentuh sehingga
 *    batas minimum masing-masing menu tetap terjaga.
 *  - Stok tidak boleh minus (dibatasi 0).
 *  - Matching barang antar tabel: id → kode material (termasuk varian
 *    tanpa leading zero) → nama (case-insensitive).
 */

export type StockSyncTable = "products" | "spareparts" | "buffer_stock";

export type StockSyncRef = {
  id?: string | null;
  code?: string | null;
  name?: string | null;
};

type TableSpec = {
  codeCol: string;
  nameCol: string;
  /** Kolom stok numerik (products & buffer_stock) atau string "10 PCS" (spareparts) */
  stockCol: string;
  stockIsString: boolean;
};

const TABLE_SPECS: Record<StockSyncTable, TableSpec> = {
  products: { codeCol: "code", nameCol: "name", stockCol: "current_stock", stockIsString: false },
  spareparts: {
    codeCol: "material_number",
    nameCol: "material_description",
    stockCol: "qty_stock",
    stockIsString: true,
  },
  buffer_stock: {
    codeCol: "code",
    nameCol: "name",
    stockCol: "current_stock",
    stockIsString: false,
  },
};

function normalizeText(value: unknown): string {
  return String(value ?? "")
    .replace(/\u00a0/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

function normalizeCode(value: unknown): string {
  const raw = String(value ?? "")
    .replace(/\u00a0/g, "")
    .replace(/\s+/g, "")
    .trim();
  // CSV/Excel kadang mengubah kode material menjadi 7100110339.0.
  if (/^\d+\.0+$/.test(raw)) return String(parseInt(raw, 10));
  if (/^\d+$/.test(raw)) return String(parseInt(raw, 10));
  return raw.toLowerCase();
}

function parseStockNumber(value: unknown): number {
  const cleaned = String(value ?? "").replace(/[^0-9.\-]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

/** Format ulang qty string "10 PCS" → "9 PCS" dengan mempertahankan satuan. */
function formatStringStock(raw: unknown, newStock: number, fallbackUnit: string): string {
  const rawStr = String(raw ?? "").trim();
  if (rawStr) {
    const m = rawStr.match(/-?\d+(?:\.\d+)?/);
    if (m) return rawStr.replace(m[0], String(newStock));
    return `${newStock} ${rawStr}`;
  }
  return `${newStock} ${fallbackUnit}`;
}

/** Cari baris barang di satu tabel berdasarkan id → kode material → nama. */
async function findRowInTable(
  supabase: SupabaseClient,
  table: StockSyncTable,
  ref: StockSyncRef,
): Promise<any | null> {
  const spec = TABLE_SPECS[table];

  // Sinkronisasi lintas tabel TIDAK menggunakan ID karena setiap tabel
  // memiliki identitas baris yang berbeda. Gunakan kode material lalu nama.
  // Match berdasarkan kode material (termasuk varian tanpa leading zero)
  const code = String(ref.code ?? "").trim();
  if (code) {
    const clean = normalizeCode(code);
    const variants = clean !== code ? [code, clean] : [code];
    for (const variant of variants) {
      const { data } = await (supabase as any)
        .from(table)
        .select("*")
        .eq(spec.codeCol, variant)
        .limit(1);
      if (Array.isArray(data) && data.length > 0) return data[0];
    }
    // Query seluruh kode hanya sebagai fallback untuk data lama dengan
    // representasi leading zero yang berbeda; pencocokan dilakukan lokal.
    const candidates: any[] = [];
    for (let page = 0; page < 20; page++) {
      const { data } = await (supabase as any)
        .from(table)
        .select("*")
        .not(spec.codeCol, "is", null)
        .range(page * 1000, page * 1000 + 999);
      if (!Array.isArray(data) || data.length === 0) break;
      candidates.push(...data);
      if (data.length < 1000) break;
    }
    const matched = candidates.find((row: any) => normalizeCode(row[spec.codeCol]) === clean);
    if (matched) return matched;
  }

  // 3. Match berdasarkan nama (case-insensitive)
  const name = normalizeText(ref.name);
  if (name) {
    const { data } = await (supabase as any)
      .from(table)
      .select("*")
      .ilike(spec.nameCol, name)
      .limit(1);
    if (Array.isArray(data) && data.length > 0) return data[0];

    // Fallback untuk perbedaan spasi, kapitalisasi, atau nama kolom lama.
    const candidates: any[] = [];
    for (let page = 0; page < 20; page++) {
      const { data } = await (supabase as any)
        .from(table)
        .select("*")
        .not(spec.nameCol, "is", null)
        .range(page * 1000, page * 1000 + 999);
      if (!Array.isArray(data) || data.length === 0) break;
      candidates.push(...data);
      if (data.length < 1000) break;
    }
    const matched = candidates.find(
      (row: any) => normalizeText(row[spec.nameCol]) === name,
    );
    if (matched) return matched;
  }

  return null;
}

/** Terapkan perubahan stok (+delta masuk / −delta keluar) pada satu baris tabel. */
async function applyDeltaToRow(
  supabase: SupabaseClient,
  table: StockSyncTable,
  row: any,
  delta: number,
  fallbackUnit: string,
): Promise<void> {
  if (!row) return;
  const spec = TABLE_SPECS[table];
  const current = spec.stockIsString
    ? parseStockNumber(row[spec.stockCol])
    : Number(row[spec.stockCol]) || 0;
  const next = Math.max(0, current + delta); // stok tidak boleh minus
  if (next === current) return;

  const update: Record<string, any> = {};

  if (spec.stockIsString) {
    update[spec.stockCol] = formatStringStock(row[spec.stockCol], next, fallbackUnit);
  } else {
    update[spec.stockCol] = next;
    // Untuk tabel products: bila metadata OBS tersimpan di kolom description,
    // sinkronkan juga ending_balance agar tampilan OBS tetap akurat.
    if (row["description"] && String(row["description"]).trim().startsWith("{")) {
      try {
        const meta = JSON.parse(row["description"]);
        if (meta && typeof meta === "object") {
          meta.ending_balance = next;
          if (delta < 0) meta.issued = (Number(meta.issued) || 0) + -delta;
          if (delta > 0) meta.receipt = (Number(meta.receipt) || 0) + delta;
          update["description"] = JSON.stringify(meta);
        }
      } catch {
        /* description bukan JSON — biarkan apa adanya */
      }
    }
  }

  const { error } = await (supabase as any).from(table).update(update).eq("id", row.id);
  if (error) {
    console.warn(`syncStock gagal (${table}, id=${row.id}):`, error.message);
  }
}

/**
 * Sinkronkan PERUBAHAN DATA ITEM (bukan sekadar mutasi stok) ke seluruh menu:
 * kode material, nama material, stok saat ini, min stock (batas minimal) &
 * max stock — dipakai handler EDIT BARANG agar 3 tabel Supabase (products,
 * spareparts, buffer_stock) dan Dashboard selalu menampilkan data yang sama.
 *
 * @param ref      Identitas barang SEBELUM diedit (untuk mencari baris lama)
 * @param changes  Nilai TERBARU (absolut). Kolom yang tidak ingin diubah
 *                 cukup diisi undefined.
 */
export async function syncItemUpdateAcrossMenus(
  supabase: SupabaseClient,
  ref: StockSyncRef,
  changes: {
    code?: string | null;
    name?: string | null;
    stock?: number | null;
    minStock?: number | null;
    maxStock?: number | null;
  },
  options?: { skipTables?: StockSyncTable[] },
): Promise<void> {
  const hasRef =
    Boolean(String(ref.code ?? "").trim()) || Boolean(normalizeText(ref.name));
  if (!hasRef) return;
  const skip = new Set<StockSyncTable>(options?.skipTables ?? []);

  const tables: StockSyncTable[] = (["products", "spareparts", "buffer_stock"] as const).filter(
    (t) => !skip.has(t),
  );

  await Promise.all(
    tables.map(async (table) => {
      const row = await findRowInTable(supabase, table, ref);
      if (!row) return;

      const spec = TABLE_SPECS[table];
      const update: Record<string, any> = {};

      // Kode material baru
      if (changes.code !== undefined && changes.code !== null && String(changes.code).trim()) {
        update[spec.codeCol] = String(changes.code).trim();
      }
      // Nama material baru
      if (changes.name !== undefined && changes.name !== null && String(changes.name).trim()) {
        update[spec.nameCol] = String(changes.name).trim();
      }
      // Stok saat ini (absolut)
      if (changes.stock !== undefined && changes.stock !== null) {
        const stock = Number(changes.stock) || 0;
        if (spec.stockIsString) {
          update[spec.stockCol] = formatStringStock(row[spec.stockCol], stock, row.unit || "PCS");
        } else {
          update[spec.stockCol] = stock;
          // Metadata OBS di kolom description: ending_balance mengikuti stok terbaru
          if (row["description"] && String(row["description"]).trim().startsWith("{")) {
            try {
              const meta = JSON.parse(row["description"]);
              if (meta && typeof meta === "object") {
                meta.ending_balance = stock;
                update["description"] = JSON.stringify(meta);
              }
            } catch {
              /* description bukan JSON — biarkan */
            }
          }
        }
      }
      // Min stock / Batas minimal
      if (changes.minStock !== undefined && changes.minStock !== null) {
        update["min_stock"] = Number(changes.minStock);
      }
      // Max stock (bisa sengaja dikosongkan → null)
      if (changes.maxStock !== undefined) {
        update["max_stock"] = changes.maxStock === null ? null : Number(changes.maxStock) || null;
      }

      if (Object.keys(update).length === 0) return;

      const { error } = await (supabase as any).from(table).update(update).eq("id", row.id);
      if (error) {
        console.warn(`syncItemUpdate gagal (${table}, id=${row.id}):`, error.message);
      }
    }),
  );
}

/**
 * Menetapkan stok absolut yang sama pada semua tabel menu.
 * Berbeda dari syncStockAcrossMenus (delta), fungsi ini aman dipakai setelah
 * import CSV atau edit langsung karena nilai sumber dianggap sebagai nilai final.
 */
export async function syncAbsoluteStockAcrossMenus(
  supabase: SupabaseClient,
  ref: StockSyncRef,
  stock: number,
  options?: { skipTables?: StockSyncTable[] },
): Promise<void> {
  const hasRef =
    Boolean(String(ref.code ?? "").trim()) || Boolean(normalizeText(ref.name));
  if (!hasRef) return;
  const nextStock = Math.max(0, Number(stock) || 0);
  const skip = new Set<StockSyncTable>(options?.skipTables ?? []);

  await Promise.all(
    (["products", "spareparts", "buffer_stock"] as const)
      .filter((table) => !skip.has(table))
      .map(async (table) => {
        const row = await findRowInTable(supabase, table, ref);
        if (!row) return;
        const spec = TABLE_SPECS[table];
        const update: Record<string, any> = {
          [spec.stockCol]: spec.stockIsString
            ? formatStringStock(row[spec.stockCol], nextStock, row.unit || "PCS")
            : nextStock,
        };

        if (table === "products" && row.description && String(row.description).trim().startsWith("{")) {
          try {
            const meta = JSON.parse(row.description);
            if (meta && typeof meta === "object") {
              meta.ending_balance = nextStock;
              update.description = JSON.stringify(meta);
            }
          } catch {
            /* description bukan metadata JSON */
          }
        }

        const matchColumn = row[spec.codeCol] ? spec.codeCol : spec.nameCol;
        const matchValue = row[matchColumn];
        const { data: updatedRows, error } = await (supabase as any)
          .from(table)
          .update(update)
          .eq(matchColumn, matchValue)
          .select("*");
        if (error) {
          console.warn(`syncAbsoluteStock gagal (${table}):`, error.message);
        } else if (!updatedRows || updatedRows.length === 0) {
          // UPDATE tanpa SELECT dapat terlihat sukses walau RLS memfilter baris.
          console.warn(`syncAbsoluteStock tidak mengubah baris (${table}); kemungkinan RLS atau baris tidak terlihat`);
        } else {
          console.info(`syncAbsoluteStock berhasil (${table})`, nextStock);
        }
      }),
  );
}

/**
 * Sinkronkan perubahan qty stok satu barang ke SELURUH menu
 * ("products", "spareparts", "buffer_stock") berdasarkan id/kode/nama.
 *
 * @param delta  +qty untuk barang MASUK / penambahan stok, −qty untuk KELUAR/order
 * @param options.skipTables         Tabel yang jangan disentuh sama sekali
 *                                   (mis. tabel sumber yang sudah diubah, atau tabel baru
 *                                   dibuat oleh flow tersebut)
 * @param options.productsViaTrigger true bila trigger DB akan/sudah memperbarui baris
 *                                   products berdasarkan id (alur mutasi). Jika id TIDAK
 *                                   ditemukan di products, lookup tetap lanjut via kode/nama.
 */
export async function syncStockAcrossMenus(
  supabase: SupabaseClient,
  ref: StockSyncRef,
  delta: number,
  options?: {
    skipTables?: StockSyncTable[];
    productsViaTrigger?: boolean;
  },
): Promise<void> {
  const hasRef =
    Boolean(String(ref.code ?? "").trim()) || Boolean(normalizeText(ref.name));
  if (!delta || !hasRef) return;
  const skip = new Set<StockSyncTable>(options?.skipTables ?? []);

  const tables: StockSyncTable[] = (["products", "spareparts", "buffer_stock"] as const).filter(
    (t) => !skip.has(t),
  );

  // Lookup & update ketiga tabel berjalan PARALEL agar penambahan/heal barang
  // baru tidak menunggu query beruntun antar tabel.
  await Promise.all(
    tables.map(async (table) => {
      const row = await findRowInTable(supabase, table, ref);
      if (!row) return;

      // products: bila trigger DB sudah meng-update baris yang dicocokkan via id,
      // jangan update dua kali; tapi jika id TIDAK ada di products (id berasal dari
      // tabel spareparts/buffer_stock), tetap update via kode/nama → tetap jalan.
      if (
        table === "products" &&
        options?.productsViaTrigger &&
        ref.id &&
        String(row.id) === String(ref.id)
      ) {
        return;
      }

      await applyDeltaToRow(supabase, table, row, delta, row.unit || "PCS");
    }),
  );
}
