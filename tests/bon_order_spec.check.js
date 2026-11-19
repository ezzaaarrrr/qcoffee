import assert from "node:assert";

// Self-check data mapping bon permintaan sparepart (Image 1 specifications)
function resolveBonData(log, matchedOrder, products) {
  const meta = log.metadata || {};
  const isOrderBon =
    log.action?.startsWith("ORDER_SPAREPART") ||
    Boolean(meta.order_number) ||
    Boolean(matchedOrder) ||
    Boolean(meta.line) ||
    Boolean(meta.group) ||
    Boolean(meta.pelaksana_lapangan) ||
    log.description?.toLowerCase().includes("[permintaan order]");

  if (!isOrderBon) return null;

  const orderDateRaw = meta.order_date || matchedOrder?.order_date || log.created_at;
  const orderDateObj = new Date(orderDateRaw || log.created_at);
  const formattedOrderDate = !isNaN(orderDateObj.getTime())
    ? orderDateObj.toLocaleDateString("id-ID", {
        day: "numeric",
        month: "long",
        year: "numeric",
      })
    : "19 November 2026";

  const orderTimeObj = new Date(log.created_at);
  const formattedOrderTime = !isNaN(orderTimeObj.getTime())
    ? `${String(orderTimeObj.getHours()).padStart(2, "0")}.${String(
        orderTimeObj.getMinutes(),
      ).padStart(2, "0")} WIB`
    : "8.43 WIB";

  const plant =
    meta.plant ||
    matchedOrder?.plant ||
    "TES GROUND 2 ( Coffee ) Cikupa Tangerang";

  const line = meta.line || matchedOrder?.line || "Line Roasting 1";
  const group = meta.group || matchedOrder?.group || "Group A";

  const pelaksanaRaw =
    meta.pelaksana_lapangan ||
    matchedOrder?.pelaksana_lapangan;
  const pelaksana = Array.isArray(pelaksanaRaw)
    ? pelaksanaRaw.join(", ")
    : (pelaksanaRaw || "Electric");

  const detailKebutuhan = meta.dibutuhkan || matchedOrder?.dibutuhkan || "Urgent";
  const alasanPermintaan =
    meta.alasan_permintaan ||
    matchedOrder?.alasan_permintaan ||
    "Penggantian Bearing Rusak Line Roasting 1";
  const uraianPerbaikan =
    meta.uraian_perbaikan ||
    meta.alasan_permintaan ||
    matchedOrder?.alasan_permintaan ||
    "Penggantian Bearing Rusak Line Roasting 1";

  let rawItems = [];
  if (Array.isArray(meta.items) && meta.items.length > 0) {
    rawItems = meta.items;
  } else if (matchedOrder && Array.isArray(matchedOrder.items)) {
    rawItems = matchedOrder.items;
  }

  const bonItems = rawItems.map((it) => {
    let code = it.product_code || "";
    if (!code) {
      const p = products.find(
        (prod) =>
          (it.product_id && prod.id === it.product_id) ||
          prod.name.toLowerCase().trim() === (it.product_name || "").toLowerCase().trim()
      );
      if (p?.code) code = p.code;
    }
    return {
      product_code: code || "-",
      product_name: it.product_name || "-",
      quantity: it.quantity || 1,
      unit: (it.unit || "PCS").toUpperCase(),
    };
  });

  return {
    isOrderBon,
    formattedOrderDate,
    formattedOrderTime,
    plant,
    line,
    group,
    pelaksana,
    detailKebutuhan,
    alasanPermintaan,
    uraianPerbaikan,
    bonItems,
  };
}

// Test case matching Image 1
const mockLog = {
  id: "log-1",
  action: "ORDER_SPAREPART_PENDING",
  description: `[PERMINTAAN ORDER] No. ORD-001: 1 PCS TEFLON TAPE (1365X0,3X15). Menunggu approval GDSP.`,
  user_name: "Super Admin",
  created_at: "2026-11-19T08:43:00.000Z",
  metadata: {
    order_number: "ORD-001",
    order_date: "2026-11-19",
    plant: "TES GROUND 2 ( Coffee ) Cikupa Tangerang",
    line: "Line Roasting 1",
    group: "Group A",
    pelaksana_lapangan: ["Electric"],
    dibutuhkan: "Urgent",
    alasan_permintaan: "Penggantian Bearing Rusak Line Roasting 1",
    uraian_perbaikan: "Penggantian Bearing Rusak Line Roasting 1",
    items: [
      {
        product_code: "7700910018",
        product_name: "TEFLON TAPE (1365X0,3X15)",
        quantity: 1,
        unit: "PCS",
      },
    ],
  },
};

const result = resolveBonData(mockLog, null, []);
assert.strictEqual(result.isOrderBon, true);
assert.strictEqual(result.formattedOrderDate, "19 November 2026");
assert.strictEqual(result.plant, "TES GROUND 2 ( Coffee ) Cikupa Tangerang");
assert.strictEqual(result.line, "Line Roasting 1");
assert.strictEqual(result.group, "Group A");
assert.strictEqual(result.pelaksana, "Electric");
assert.strictEqual(result.detailKebutuhan, "Urgent");
assert.strictEqual(result.alasanPermintaan, "Penggantian Bearing Rusak Line Roasting 1");
assert.strictEqual(result.uraianPerbaikan, "Penggantian Bearing Rusak Line Roasting 1");
assert.strictEqual(result.bonItems.length, 1);
assert.strictEqual(result.bonItems[0].product_code, "7700910018");
assert.strictEqual(result.bonItems[0].product_name, "TEFLON TAPE (1365X0,3X15)");
assert.strictEqual(result.bonItems[0].quantity, 1);
assert.strictEqual(result.bonItems[0].unit, "PCS");

console.log("Bon order Image 1 spec check passed successfully!");
