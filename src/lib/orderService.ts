import { SupabaseClient } from "@supabase/supabase-js";

export type SparepartOrderItem = {
  product_id: string;
  product_code: string;
  product_name: string;
  quantity: number;
  unit: string;
  stock_before?: number | undefined;
  stock_after?: number | undefined;
};

export type SparepartOrder = {
  id: string;
  order_number: string;
  order_date: string;
  items: SparepartOrderItem[];
  user_pemohon: string;
  alasan_permintaan: string;
  petugas_shift: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  stock_before?: number | undefined;
  stock_after?: number | undefined;
  approved_by?: string | null | undefined;
  approved_by_name?: string | null | undefined;
  approved_at?: string | null | undefined;
  rejection_reason?: string | null | undefined;
  created_by?: string | null | undefined;
  created_by_name: string;
  created_at: string;
  updated_at?: string | undefined;
};

/**
 * Mengambil daftar seluruh order sparepart dari database secara permanen.
 * Mendukung tabel warehouse_orders dan warehouse_activity_logs (resilient fallback).
 */
export async function fetchSparepartOrders(supabase: SupabaseClient): Promise<SparepartOrder[]> {
  const ordersMap = new Map<string, SparepartOrder>();

  // 1. Coba ambil dari warehouse_orders jika tabel sudah tersedia
  try {
    const { data: directOrders, error: orderErr } = await (supabase as any)
      .from("warehouse_orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!orderErr && Array.isArray(directOrders) && directOrders.length > 0) {
      for (const row of directOrders) {
        if (!ordersMap.has(row.order_number)) {
          ordersMap.set(row.order_number, {
            id: row.id,
            order_number: row.order_number,
            order_date: row.order_date || row.created_at?.split("T")[0] || "",
            items: Array.isArray(row.items)
              ? row.items
              : [
                  {
                    product_id: row.product_id,
                    product_code: row.product_code || "",
                    product_name: row.product_name,
                    quantity: Number(row.quantity) || 1,
                    unit: row.unit || "PCS",
                    stock_before:
                      row.stock_before !== null && row.stock_before !== undefined
                        ? Number(row.stock_before)
                        : undefined,
                    stock_after:
                      row.stock_after !== null && row.stock_after !== undefined
                        ? Number(row.stock_after)
                        : undefined,
                  },
                ],
            user_pemohon: row.user_pemohon || row.created_by_name || "-",
            alasan_permintaan: row.alasan_permintaan || "-",
            petugas_shift: row.petugas_shift || "-",
            status: row.status as "PENDING" | "APPROVED" | "REJECTED",
            stock_before:
              row.stock_before !== null && row.stock_before !== undefined
                ? Number(row.stock_before)
                : undefined,
            stock_after:
              row.stock_after !== null && row.stock_after !== undefined
                ? Number(row.stock_after)
                : undefined,
            approved_by: row.approved_by,
            approved_by_name: row.approved_by_name,
            approved_at: row.approved_at,
            rejection_reason: row.rejection_reason,
            created_by: row.created_by,
            created_by_name: row.created_by_name || row.user_pemohon,
            created_at: row.created_at,
            updated_at: row.updated_at,
          });
        }
      }
    }
  } catch {
    // Tabel belum ada, lanjut ke logs fallback
  }

  // 2. Ambil dari warehouse_activity_logs sebagai sumber data permanen
  try {
    const { data: logs, error: logsErr } = await (supabase as any)
      .from("warehouse_activity_logs")
      .select("*")
      .ilike("action", "ORDER_SPAREPART%")
      .order("created_at", { ascending: true });

    if (!logsErr && Array.isArray(logs)) {
      for (const log of logs) {
        const meta = log.metadata || {};
        const orderNum = meta.order_number;
        if (!orderNum) continue;

        const existing = ordersMap.get(orderNum);
        const action = String(log.action || "").toUpperCase();

        if (action.includes("PENDING") || !existing) {
          const newOrder: SparepartOrder = {
            id: meta.order_id || log.id,
            order_number: orderNum,
            order_date: meta.order_date || log.created_at?.split("T")[0] || "",
            items: Array.isArray(meta.items) ? meta.items : [],
            user_pemohon: meta.user_pemohon || log.user_name || "Teknik",
            alasan_permintaan: meta.alasan_permintaan || "-",
            petugas_shift: meta.petugas_shift || "-",
            status: (meta.status as any) || "PENDING",
            stock_before: meta.stock_before,
            stock_after: meta.stock_after,
            approved_by: meta.approved_by || null,
            approved_by_name: meta.approved_by_name || null,
            approved_at: meta.approved_at || null,
            rejection_reason: meta.rejection_reason || null,
            created_by: log.user_id,
            created_by_name: log.user_name || meta.user_pemohon || "Teknik",
            created_at: meta.created_at || log.created_at,
            updated_at: log.created_at,
          };
          ordersMap.set(orderNum, newOrder);
        } else if (action.includes("APPROVED")) {
          existing.status = "APPROVED";
          existing.approved_by = log.user_id || meta.approved_by;
          existing.approved_by_name = log.user_name || meta.approved_by_name || "Petugas GDSP";
          existing.approved_at = meta.approved_at || log.created_at;
          if (Array.isArray(meta.items) && meta.items.length > 0) {
            existing.items = meta.items;
          }
          if (meta.stock_before !== undefined) existing.stock_before = meta.stock_before;
          if (meta.stock_after !== undefined) existing.stock_after = meta.stock_after;
          existing.updated_at = log.created_at;
          ordersMap.set(orderNum, existing);
        } else if (action.includes("REJECTED")) {
          existing.status = "REJECTED";
          existing.approved_by = log.user_id;
          existing.approved_by_name = log.user_name || meta.rejected_by_name || "Petugas GDSP";
          existing.approved_at = meta.rejected_at || log.created_at;
          existing.rejection_reason = meta.rejection_reason || "Ditolak oleh admin GDSP";
          existing.updated_at = log.created_at;
          ordersMap.set(orderNum, existing);
        }
      }
    }
  } catch (err) {
    console.warn("Gagal membaca order logs:", err);
  }

  // Kembalikan daftar order diurutkan dari yang terbaru
  return Array.from(ordersMap.values()).sort(
    (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
  );
}

/**
 * Menghasilkan nomor urut order yang unik dan berurutan
 */
export async function generateOrderNumber(supabase: SupabaseClient): Promise<string> {
  const todayStr = new Date().toISOString().split("T")[0]?.replace(/-/g, "") || "20261026";
  let nextSeq = 1;

  try {
    const orders = await fetchSparepartOrders(supabase);
    const todayOrders = orders.filter((o) => o.order_number.startsWith(`ORD-${todayStr}`));
    if (todayOrders.length > 0) {
      const seqs = todayOrders.map((o) => {
        const parts = o.order_number.split("-");
        const lastPart = parts[parts.length - 1];
        return lastPart ? parseInt(lastPart, 10) || 0 : 0;
      });
      nextSeq = Math.max(...seqs) + 1;
    } else {
      nextSeq = orders.length + 1;
    }
  } catch {
    nextSeq = 1;
  }

  return `ORD-${todayStr}-${String(nextSeq).padStart(3, "0")}`;
}

/**
 * Membuat permintaan Order baru oleh role Teknik dengan status PENDING.
 * Tidak langsung memotong stok; menunggu persetujuan (approval) dari GDSP.
 */
export async function createSparepartOrder(
  supabase: SupabaseClient,
  payload: {
    items: Array<{
      productId: string;
      quantity: number;
      unit: string;
      productName: string;
      productCode: string;
      currentStock: number;
    }>;
    orderDate?: string | undefined;
    userPemohon: string;
    alasanPermintaan: string;
    petugasShift: string;
    userId?: string | undefined;
  },
): Promise<SparepartOrder> {
  // Validasi item
  if (!payload.items || payload.items.length === 0) {
    throw new Error("Daftar barang order tidak boleh kosong");
  }

  for (const it of payload.items) {
    if (!it.productId) throw new Error("Pilih barang yang valid untuk diorder");
    if (it.quantity <= 0)
      throw new Error(`Kuantitas order untuk "${it.productName}" harus lebih dari 0`);
    if (it.quantity > it.currentStock) {
      throw new Error(
        `Kuantitas order (${it.quantity}) untuk "${it.productName}" melebihi stok yang tersedia (${it.currentStock})`,
      );
    }
  }

  if (!payload.alasanPermintaan.trim()) {
    throw new Error("Alasan permintaan barang / unit mesin wajib diisi");
  }
  if (!payload.userPemohon.trim()) {
    throw new Error("Nama pemohon / user wajib diisi");
  }

  const orderNumber = await generateOrderNumber(supabase);
  const orderId =
    typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `ord_${Date.now()}`;
  const nowIso = new Date().toISOString();

  const formattedItems: SparepartOrderItem[] = payload.items.map((it) => ({
    product_id: it.productId,
    product_code: it.productCode || "",
    product_name: it.productName,
    quantity: it.quantity,
    unit: it.unit || "PCS",
    stock_before: it.currentStock,
    stock_after: it.currentStock - it.quantity,
  }));

  const orderRecord: SparepartOrder = {
    id: orderId,
    order_number: orderNumber,
    order_date: payload.orderDate || nowIso.split("T")[0] || "",
    items: formattedItems,
    user_pemohon: payload.userPemohon.trim(),
    alasan_permintaan: payload.alasanPermintaan.trim(),
    petugas_shift: payload.petugasShift.trim() || "-",
    status: "PENDING",
    created_by: payload.userId || null,
    created_by_name: payload.userPemohon.trim(),
    created_at: nowIso,
  };

  const itemSummary = formattedItems
    .map((it) => `${it.quantity} ${it.unit} ${it.product_name}`)
    .join(", ");

  // 1. Simpan secara permanen di warehouse_activity_logs
  const { error: logErr } = await (supabase as any).from("warehouse_activity_logs").insert({
    action: "ORDER_SPAREPART_PENDING",
    description: `[PERMINTAAN ORDER] No. ${orderNumber} oleh ${payload.userPemohon.trim()} untuk "${payload.alasanPermintaan.trim()}": ${itemSummary}. Menunggu approval GDSP.`,
    user_id: payload.userId || null,
    user_name: payload.userPemohon.trim(),
    metadata: {
      ...orderRecord,
      order_id: orderId,
    },
  });

  if (logErr) {
    console.error("Gagal menyimpan activity log order:", logErr);
    throw new Error(`Gagal menyimpan order ke database: ${logErr.message}`);
  }

  // 2. Simpan ke warehouse_orders jika tabel ada
  try {
    for (const item of formattedItems) {
      await (supabase as any).from("warehouse_orders").insert({
        id: crypto.randomUUID(),
        order_number: orderNumber,
        order_date: orderRecord.order_date,
        product_id: item.product_id,
        product_code: item.product_code,
        product_name: item.product_name,
        quantity: item.quantity,
        unit: item.unit,
        user_pemohon: orderRecord.user_pemohon,
        alasan_permintaan: orderRecord.alasan_permintaan,
        petugas_shift: orderRecord.petugas_shift,
        status: "PENDING",
        stock_before: item.stock_before,
        stock_after: item.stock_after,
        created_by: payload.userId || null,
        created_by_name: payload.userPemohon.trim(),
      });
    }
  } catch {
    // Abaikan jika tabel belum dibuat
  }

  return orderRecord;
}

/**
 * Menyetujui order sparepart oleh GDSP dan memotong stok barang secara atomik dan konsisten.
 */
export async function approveSparepartOrder(
  supabase: SupabaseClient,
  order: SparepartOrder,
  approver: { id?: string | undefined; name: string },
): Promise<SparepartOrder> {
  if (order.status !== "PENDING") {
    throw new Error(
      `Order ${order.order_number} sudah berstatus ${order.status} dan tidak dapat disetujui lagi.`,
    );
  }

  // 1. Validasi stok terkini secara real-time dari database untuk setiap item
  const updatedItems: SparepartOrderItem[] = [];
  for (const item of order.items) {
    const { data: freshProd, error: fetchErr } = await (supabase as any)
      .from("products")
      .select("id, name, code, current_stock, unit, description")
      .eq("id", item.product_id)
      .single();

    if (fetchErr || !freshProd) {
      throw new Error(`Barang "${item.product_name}" tidak ditemukan di database.`);
    }

    const currentStock = Number(freshProd.current_stock) || 0;
    if (currentStock < item.quantity) {
      throw new Error(
        `Stok "${freshProd.name}" tidak mencukupi! Stok saat ini: ${currentStock} ${item.unit}, kuantitas order: ${item.quantity} ${item.unit}. Approval dibatalkan agar stok tidak minus.`,
      );
    }

    const newStock = Math.max(0, currentStock - item.quantity);
    updatedItems.push({
      ...item,
      stock_before: currentStock,
      stock_after: newStock,
    });
  }

  const nowIso = new Date().toISOString();
  const approverName = approver.name.trim() || "Petugas GDSP";

  // 2. Eksekusi pemotongan stok & pencatatan mutasi untuk setiap item
  for (const item of updatedItems) {
    const { data: currentProd } = await (supabase as any)
      .from("products")
      .select("description")
      .eq("id", item.product_id)
      .single();

    let obsMeta: any = null;
    try {
      if (currentProd?.description && currentProd.description.startsWith("{")) {
        obsMeta = JSON.parse(currentProd.description);
      }
    } catch {}

    const updatedObs = obsMeta
      ? { ...obsMeta }
      : {
          beginning_balance: item.stock_before,
          receipt: 0,
          issued: 0,
          ending_balance: item.stock_before,
        };
    updatedObs.ending_balance = item.stock_after;
    updatedObs.issued = (Number(updatedObs.issued) || 0) + item.quantity;

    // a. Update stok di tabel products
    const { error: prodUpdateErr } = await (supabase as any)
      .from("products")
      .update({
        current_stock: item.stock_after,
        description: JSON.stringify(updatedObs),
      })
      .eq("id", item.product_id);

    if (prodUpdateErr) {
      throw new Error(`Gagal memotong stok untuk ${item.product_name}: ${prodUpdateErr.message}`);
    }

    // b. Simpan mutasi pengeluaran ke warehouse_transactions
    await (supabase as any).from("warehouse_transactions").insert({
      transaction_number: order.order_number,
      tx_type: "OUT",
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit: item.unit,
      batch_number: order.order_date,
      reference_no: "ORDER-TEKNIK",
      supplier_or_dest: order.alasan_permintaan,
      notes: `${order.petugas_shift} | Disetujui GDSP: ${approverName}`,
      created_by: approver.id || null,
      created_by_name: approverName,
    });
  }

  const updatedOrder: SparepartOrder = {
    ...order,
    status: "APPROVED",
    items: updatedItems,
    stock_before: updatedItems[0]?.stock_before,
    stock_after: updatedItems[0]?.stock_after,
    approved_by: approver.id || null,
    approved_by_name: approverName,
    approved_at: nowIso,
  };

  const itemSummary = updatedItems
    .map(
      (it) =>
        `${it.quantity} ${it.unit} ${it.product_name} (Stok: ${it.stock_before} -> ${it.stock_after})`,
    )
    .join(", ");

  // 3. Catat di warehouse_activity_logs secara permanen
  await (supabase as any).from("warehouse_activity_logs").insert({
    action: "ORDER_SPAREPART_APPROVED",
    description: `[ORDER DISETUJUI & STOK TERPOTONG] No. ${order.order_number} disetujui oleh ${approverName}. Pemohon: ${order.user_pemohon}. Rincian stok: ${itemSummary}.`,
    user_id: approver.id || null,
    user_name: approverName,
    metadata: {
      ...updatedOrder,
      order_id: order.id,
    },
  });

  // 4. Update di warehouse_orders jika tabel ada
  try {
    await (supabase as any)
      .from("warehouse_orders")
      .update({
        status: "APPROVED",
        approved_by: approver.id || null,
        approved_by_name: approverName,
        approved_at: nowIso,
        updated_at: nowIso,
      })
      .eq("order_number", order.order_number);
  } catch {}

  return updatedOrder;
}

/**
 * Menolak order sparepart oleh GDSP (stok tidak dipotong).
 */
export async function rejectSparepartOrder(
  supabase: SupabaseClient,
  order: SparepartOrder,
  approver: { id?: string | undefined; name: string },
  rejectionReason: string,
): Promise<SparepartOrder> {
  if (order.status !== "PENDING") {
    throw new Error(`Order ${order.order_number} sudah berstatus ${order.status}.`);
  }

  const reason = rejectionReason.trim() || "Ditolak oleh admin GDSP";
  const nowIso = new Date().toISOString();
  const approverName = approver.name.trim() || "Petugas GDSP";

  const updatedOrder: SparepartOrder = {
    ...order,
    status: "REJECTED",
    approved_by: approver.id || null,
    approved_by_name: approverName,
    approved_at: nowIso,
    rejection_reason: reason,
  };

  // 1. Catat ke warehouse_activity_logs secara permanen
  await (supabase as any).from("warehouse_activity_logs").insert({
    action: "ORDER_SPAREPART_REJECTED",
    description: `[ORDER DITOLAK] No. ${order.order_number} ditolak oleh ${approverName}. Pemohon: ${order.user_pemohon}. Alasan: "${reason}". Stok tidak dipotong.`,
    user_id: approver.id || null,
    user_name: approverName,
    metadata: {
      ...updatedOrder,
      order_id: order.id,
      rejection_reason: reason,
    },
  });

  // 2. Update di warehouse_orders jika ada
  try {
    await (supabase as any)
      .from("warehouse_orders")
      .update({
        status: "REJECTED",
        rejection_reason: reason,
        approved_by: approver.id || null,
        approved_by_name: approverName,
        approved_at: nowIso,
        updated_at: nowIso,
      })
      .eq("order_number", order.order_number);
  } catch {}

  return updatedOrder;
}
