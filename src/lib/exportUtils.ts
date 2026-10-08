/**
 * Utility untuk Export Laporan Resmi Departemen Warehouse & Sparepart (Q-Coffee M2)
 * Menghasilkan file Excel (.xls berbasis HTML Office Spreadsheet) & CSV yang rapi,
 * terstruktur, memiliki kop instansi, kartu KPI ringkasan, format cell yang tepat,
 * baris total, serta kolom tanda tangan pengesahan resmi.
 */

export interface ExportProductItem {
  id: string;
  code?: string | null;
  name: string;
  category?: string | null;
  unit?: string | null;
  current_stock?: number | null;
  min_stock?: number | null;
  max_stock?: number | null;
  location?: string | null;
  shelf?: string | null;
  is_active?: boolean;
  created_at?: string;
}

export interface ExportGroupedTransaction {
  id?: string | undefined;
  transaction_number: string;
  tx_type: "IN" | "OUT" | "ADJUSTMENT";
  batch_number?: string | null | undefined;
  reference_no?: string | null | undefined;
  supplier_or_dest?: string | null | undefined;
  notes?: string | null | undefined;
  created_by_name?: string | null | undefined;
  created_at: string;
  items: Array<{
    id?: string | undefined;
    product_id?: string | undefined;
    product_name: string;
    quantity: number;
    unit: string;
  }>;
}

/**
 * Format tanggal standar Indonesia yang ramah pembacaan laporan (misal: "11 September 2026, 14:30 WIB")
 */
export function formatReportDateTime(dateStr?: string | Date | null): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "long",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    }) + " WIB";
  } catch {
    return "—";
  }
}

/**
 * Format tanggal ringkas (misal: "11 Sep 2026")
 */
export function formatReportDateShort(dateStr?: string | Date | null): string {
  if (!dateStr) return "—";
  try {
    const d = typeof dateStr === "string" ? new Date(dateStr) : dateStr;
    if (isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("id-ID", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    });
  } catch {
    return "—";
  }
}

/**
 * Helper untuk men-download blob ke komputer user
 */
export function triggerFileDownload(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.setAttribute("href", url);
  link.setAttribute("download", filename);
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  setTimeout(() => {
    if (document.body.contains(link)) {
      document.body.removeChild(link);
    }
    URL.revokeObjectURL(url);
  }, 1000);
}

/**
 * Template wrapper untuk file Excel (.xls) berstandar Microsoft Office HTML
 */
function wrapOfficeExcelHtml(worksheetName: string, innerHtml: string): string {
  return `
    <html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
    <head>
      <meta http-equiv="Content-Type" content="text/html; charset=utf-8" />
      <!--[if gte mso 9]>
      <xml>
        <x:ExcelWorkbook>
          <x:ExcelWorksheets>
            <x:ExcelWorksheet>
              <x:Name>${worksheetName.slice(0, 31)}</x:Name>
              <x:WorksheetOptions>
                <x:DisplayGridlines/>
                <x:Print>
                  <x:ValidPrinterInfo/>
                  <x:PaperSizeIndex>9</x:PaperSizeIndex>
                  <x:HorizontalResolution>600</x:HorizontalResolution>
                  <x:VerticalResolution>600</x:VerticalResolution>
                </x:Print>
              </x:WorksheetOptions>
            </x:ExcelWorksheet>
          </x:ExcelWorksheets>
        </x:ExcelWorkbook>
      </xml>
      <![endif]-->
      <style>
        body {
          font-family: 'Segoe UI', Calibri, Arial, Helvetica, sans-serif;
          font-size: 11pt;
          color: #0f172a;
          margin: 0;
          padding: 20px;
        }
        .header-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 16px;
        }
        .header-title {
          font-size: 16pt;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: -0.5px;
        }
        .header-subtitle {
          font-size: 12pt;
          font-weight: 700;
          color: #0369a1;
          margin-top: 4px;
        }
        .header-meta {
          font-size: 9.5pt;
          color: #64748b;
          margin-top: 6px;
        }
        .card-table {
          border-collapse: collapse;
          margin-bottom: 20px;
        }
        .card-cell {
          border: 1px solid #cbd5e1;
          background-color: #f8fafc;
          padding: 10px 14px;
          vertical-align: top;
        }
        .card-label {
          font-size: 8.5pt;
          text-transform: uppercase;
          font-weight: 700;
          color: #64748b;
        }
        .card-value {
          font-size: 14pt;
          font-weight: 800;
          color: #0f172a;
          margin-top: 2px;
        }
        .main-table {
          width: 100%;
          border-collapse: collapse;
          margin-bottom: 24px;
        }
        .main-table th {
          background-color: #0f172a;
          color: #ffffff;
          font-weight: 700;
          border: 1px solid #0f172a;
          padding: 10px 12px;
          text-align: left;
          font-size: 9.5pt;
          text-transform: uppercase;
          letter-spacing: 0.5px;
        }
        .main-table td {
          border: 1px solid #cbd5e1;
          padding: 8px 10px;
          font-size: 10pt;
          vertical-align: middle;
        }
        .main-table tr.even {
          background-color: #f8fafc;
        }
        .main-table tr.odd {
          background-color: #ffffff;
        }
        .main-table tr.limit-row {
          background-color: #fff1f2;
        }
        .badge-safe {
          background-color: #dcfce7;
          color: #15803d;
          font-weight: 700;
          font-size: 8.5pt;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #bbf7d0;
          text-align: center;
          display: inline-block;
        }
        .badge-limit {
          background-color: #ffe4e6;
          color: #be123c;
          font-weight: 700;
          font-size: 8.5pt;
          padding: 3px 8px;
          border-radius: 4px;
          border: 1px solid #fecdd3;
          text-align: center;
          display: inline-block;
        }
        .badge-in {
          background-color: #d1fae5;
          color: #047857;
          font-weight: 700;
          font-size: 8.5pt;
          padding: 3px 8px;
          border-radius: 4px;
          text-align: center;
          display: inline-block;
        }
        .badge-out {
          background-color: #ffe4e6;
          color: #be123c;
          font-weight: 700;
          font-size: 8.5pt;
          padding: 3px 8px;
          border-radius: 4px;
          text-align: center;
          display: inline-block;
        }
        .footer-total {
          background-color: #f1f5f9;
          font-weight: 800;
          border: 1px solid #94a3b8;
          padding: 10px 12px;
          font-size: 10.5pt;
        }
        .sig-table {
          width: 100%;
          border-collapse: collapse;
          margin-top: 36px;
        }
        .sig-cell {
          text-align: center;
          vertical-align: top;
          padding: 0 16px;
          width: 33.33%;
        }
        .sig-title {
          font-size: 9.5pt;
          color: #475569;
          margin-bottom: 60px;
        }
        .sig-line {
          font-weight: 700;
          font-size: 10.5pt;
          color: #0f172a;
          border-top: 1px solid #94a3b8;
          padding-top: 6px;
          margin: 0 20px;
        }
        .sig-role {
          font-size: 8.5pt;
          color: #64748b;
          margin-top: 2px;
        }
        .doc-footer-note {
          margin-top: 30px;
          font-size: 8.5pt;
          color: #94a3b8;
          border-top: 1px solid #e2e8f0;
          padding-top: 8px;
          text-align: center;
        }
      </style>
    </head>
    <body>
      ${innerHtml}
    </body>
    </html>
  `;
}

// ─────────────────────────────────────────────────────────────────────────────
// 1. EXPORT LAPORAN INVENTARIS & STOK SPAREPART (.XLS EXCEL)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportInventoryOptions {
  products: ExportProductItem[];
  latestInTxMap?: Record<string, { created_at: string }>;
  latestOutTxMap?: Record<string, { created_at: string }>;
  totalInQtyMap?: Record<string, number>;
  totalOutQtyMap?: Record<string, number>;
  generatedByName?: string;
  categoryFilter?: string;
  plant?: string;
  storageLocation?: string;
  materialType?: string;
  period?: string;
}

export function exportSparepartInventoryExcel(options: ExportInventoryOptions) {
  const {
    products,
    totalInQtyMap = {},
    totalOutQtyMap = {},
    plant = "1201",
    storageLocation = "GDSP",
    materialType = "ERSA",
    period,
  } = options;

  const fileDate = new Date().toISOString().split("T")[0];
  const periodText = period || new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

  let totalMasukAll = 0;
  let totalPengeluaranAll = 0;
  let totalBeginningAll = 0;
  let totalEndingStock = 0;

  const rowsHtml = products
    .map((p, idx) => {
      const minStock = p.min_stock ?? 10;
      const endingStock = p.current_stock ?? 0;
      totalEndingStock += endingStock;

      const rawMax = (p as any).max_stock;
      const maxStock =
        rawMax !== null && rawMax !== undefined && rawMax !== ""
          ? Number(rawMax)
          : null;
      const maxStockStr = maxStock !== null && !isNaN(maxStock) && maxStock > 0 ? String(maxStock) : "-";

      const nameKey = p.name ? p.name.trim().toLowerCase() : "";
      const codeKey = p.code ? p.code.trim().toLowerCase() : "";

      // 1. Data Riwayat Keluar (ISSUED)
      const totalOut =
        (totalOutQtyMap[p.id] ?? 0) ||
        (nameKey ? totalOutQtyMap[nameKey] ?? 0 : 0) ||
        (codeKey ? totalOutQtyMap[codeKey] ?? 0 : 0);
      totalPengeluaranAll += totalOut;

      // 2. Data Riwayat Masuk (RECEIPT)
      const totalIn =
        (totalInQtyMap[p.id] ?? 0) ||
        (nameKey ? totalInQtyMap[nameKey] ?? 0 : 0) ||
        (codeKey ? totalInQtyMap[codeKey] ?? 0 : 0);
      totalMasukAll += totalIn;

      // 3. BEGINNING BALANCE = Ending Balance - Receipt + Issued
      const beginningBalance = Math.max(0, endingStock - totalIn + totalOut);
      totalBeginningAll += beginningBalance;

      // 4. STATUS STOCK (AMAN jika di atas minStock, LIMIT / KRITIS jika <= minStock)
      const isLimit = endingStock <= minStock;
      const statusStockStr = isLimit ? "LIMIT / KRITIS" : "AMAN";

      const codeVal = p.code || "-";

      return `
        <tr style="height: 22px;">
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 4px 6px;">${idx + 1}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: left; vertical-align: middle; padding: 4px 6px; mso-number-format:'\\@';" x:str>${codeVal}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: left; vertical-align: middle; padding: 4px 6px;">${p.name}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: right; vertical-align: middle; padding: 4px 6px; mso-number-format:'0';">${beginningBalance}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: right; vertical-align: middle; padding: 4px 6px; mso-number-format:'0';">${minStock}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 4px 6px;">${totalIn > 0 ? totalIn : "-"}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 4px 6px;">${totalOut > 0 ? totalOut : "-"}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: right; vertical-align: middle; padding: 4px 6px; mso-number-format:'0'; font-weight: bold;">${endingStock}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: right; vertical-align: middle; padding: 4px 6px;">${maxStockStr}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 4px 6px; font-weight: bold;">${statusStockStr}</td>
        </tr>
      `;
    })
    .join("");

  const contentHtml = `
    <!-- Header Informasi Parameter SAP / Gudang Sesuai Format Scan -->
    <table style="border-collapse: collapse; font-family: Calibri, Arial, sans-serif; font-size: 11pt; margin-bottom: 14px;">
      <tr>
        <td colspan="10" style="font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; padding: 2px 0; color: #000000;">. PLANT &nbsp;&nbsp;: ${plant}</td>
      </tr>
      <tr>
        <td colspan="10" style="font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; padding: 2px 0; color: #000000;">2. S.LOCATION : ${storageLocation}</td>
      </tr>
      <tr>
        <td colspan="10" style="font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; padding: 2px 0; color: #000000;">3. MAT.TYPE &nbsp;: ${materialType}</td>
      </tr>
      <tr>
        <td colspan="10" style="font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; padding: 2px 0; color: #000000;">4. PERIOD &nbsp;&nbsp;&nbsp;: ${periodText}</td>
      </tr>
      <tr style="height: 14px;">
        <td colspan="10"></td>
      </tr>
    </table>

    <!-- Tabel Data Utama Laporan (Header Kuning #FFFF00 & Border Hitam Sesuai Gambar Scan) -->
    <table style="border-collapse: collapse; width: 100%; font-family: Calibri, Arial, sans-serif;">
      <thead>
        <tr style="height: 28px;">
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 4px; width: 45px;">No</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 8px; width: 130px;">Kode</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 10px; width: 340px;">MATERIAL</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 8px; width: 160px;">BEGINNING BALANCE</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 8px; width: 100px;">MIN.STOK</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 8px; width: 100px;">RECEIPT</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 8px; width: 100px;">ISSUED</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 8px; width: 160px;">ENDING BALANCE</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 8px; width: 110px;">MAKS.STOK</th>
          <th style="background-color: #FFFF00; color: #000000; border: 1px solid #000000; font-weight: bold; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; vertical-align: middle; padding: 6px 8px; width: 130px;">STATUS STOCK</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
      <tfoot>
        <tr style="height: 26px; font-weight: bold; background-color: #F8FAFC;">
          <td colspan="3" style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: right; font-weight: bold; padding: 5px 8px;">TOTAL:</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: right; font-weight: bold; padding: 5px 8px; mso-number-format:'0';">${totalBeginningAll}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; padding: 5px 8px;">-</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; font-weight: bold; padding: 5px 8px;">${totalMasukAll > 0 ? totalMasukAll : "-"}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; font-weight: bold; padding: 5px 8px;">${totalPengeluaranAll > 0 ? totalPengeluaranAll : "-"}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: right; font-weight: bold; padding: 5px 8px; mso-number-format:'0';">${totalEndingStock}</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; padding: 5px 8px;">-</td>
          <td style="border: 1px solid #000000; font-family: Calibri, Arial, sans-serif; font-size: 11pt; text-align: center; font-weight: bold; padding: 5px 8px;">-</td>
        </tr>
      </tfoot>
    </table>

    <!-- Lembar Tanda Tangan & Pengesahan Sesuai Permintaan Gambar -->
    <table style="width: 100%; border-collapse: collapse; margin-top: 35px; font-family: Calibri, Arial, sans-serif; font-size: 11pt;">
      <tr>
        <td colspan="3" style="text-align: center; font-weight: bold; padding: 4px 0;">Dibuat oleh User,</td>
        <td></td>
        <td colspan="3" style="text-align: center; font-weight: bold; padding: 4px 0;">Diperiksa oleh UH/SH,</td>
        <td></td>
        <td colspan="2" style="text-align: center; font-weight: bold; padding: 4px 0;">Disetujui oleh Departement Head,</td>
      </tr>
      <tr style="height: 65px;">
        <td colspan="3"></td>
        <td></td>
        <td colspan="3"></td>
        <td></td>
        <td colspan="2"></td>
      </tr>
      <tr>
        <td colspan="3" style="text-align: center; font-weight: bold; padding: 4px 0;">( ............................................ )</td>
        <td></td>
        <td colspan="3" style="text-align: center; font-weight: bold; padding: 4px 0;">( ............................................ )</td>
        <td></td>
        <td colspan="2" style="text-align: center; font-weight: bold; padding: 4px 0;">( ............................................ )</td>
      </tr>
    </table>
  `;

  const excelHtml = wrapOfficeExcelHtml("Laporan Stok Sparepart", contentHtml);
  const blob = new Blob(["\uFEFF" + excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  triggerFileDownload(blob, `laporan_stok_sparepart_${fileDate}.xls`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 2. EXPORT LAPORAN RIWAYAT MUTASI GUDANG IN/OUT (.XLS EXCEL)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportMutasiOptions {
  groupedTransactions: ExportGroupedTransaction[];
  generatedByName?: string;
  startDate?: string;
  endDate?: string;
  plant?: string;
  storageLocation?: string;
  materialType?: string;
  period?: string;
}

export function exportSparepartMutasiExcel(options: ExportMutasiOptions) {
  const {
    groupedTransactions,
    generatedByName = "Petugas Gudang",
    startDate,
    endDate,
    plant = "2000",
    storageLocation = "Gudang Sparepart & Tools",
    materialType = "Sparepart",
    period,
  } = options;

  const printDate = formatReportDateTime(new Date());
  const fileDate = new Date().toISOString().split("T")[0];
  const periodText =
    period ||
    (startDate && endDate
      ? `${startDate} s/d ${endDate}`
      : new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" }));

  const totalTx = groupedTransactions.length;
  const inTx = groupedTransactions.filter((t) => t.tx_type === "IN");
  const outTx = groupedTransactions.filter((t) => t.tx_type === "OUT");
  const adjTx = groupedTransactions.filter((t) => t.tx_type === "ADJUSTMENT");

  const totalQtyIn = inTx.reduce(
    (acc, t) => acc + t.items.reduce((s, it) => s + (it.quantity || 0), 0),
    0
  );
  const totalQtyOut = outTx.reduce(
    (acc, t) => acc + t.items.reduce((s, it) => s + (it.quantity || 0), 0),
    0
  );

  const rowsHtml = groupedTransactions
    .map((tx, idx) => {
      const isMasuk = tx.tx_type === "IN";
      const tipeLabel = isMasuk ? "MASUK (INBOUND)" : tx.tx_type === "OUT" ? "KELUAR (OUTBOUND)" : "PENYESUAIAN";
      const tipeClass = isMasuk ? "badge-in" : "badge-out";
      const rowClass = idx % 2 === 0 ? "even" : "odd";

      const itemsHtml = tx.items
        .map(
          (it, i) =>
            `<div style="margin-bottom: 3px;">
              <strong>${i + 1}. ${it.product_name}</strong> 
              <span style="font-weight: bold; color: ${isMasuk ? "#047857" : "#be123c"};">
                (${isMasuk ? "+" : "-"}${it.quantity.toLocaleString("id-ID")} ${it.unit})
              </span>
            </div>`
        )
        .join("");

      const batchStr = tx.batch_number ? `Batch: <strong>${tx.batch_number}</strong>` : "Batch: —";
      const refStr = tx.reference_no ? `Ref: <strong>${tx.reference_no}</strong>` : "Ref: —";
      const pihakStr = tx.supplier_or_dest || "—";
      const noteStr = tx.notes ? `<div style="font-size: 8.5pt; color: #64748b; margin-top: 2px;"><em>Ket: ${tx.notes}</em></div>` : "";

      return `
        <tr class="${rowClass}">
          <td style="text-align: center; color: #64748b; font-size: 9pt;">${idx + 1}</td>
          <td style="font-family: Consolas, 'Courier New', monospace; font-weight: bold; font-size: 9.5pt; vertical-align: top; mso-number-format:'\\@';">
            ${tx.transaction_number}
          </td>
          <td style="text-align: center; vertical-align: top;">
            <span class="${tipeClass}">${tipeLabel}</span>
          </td>
          <td style="vertical-align: top;">
            ${itemsHtml}
            ${noteStr}
          </td>
          <td style="vertical-align: top; font-size: 9pt;">
            <div>${batchStr}</div>
            <div style="color: #64748b; margin-top: 2px;">${refStr}</div>
          </td>
          <td style="vertical-align: top; font-weight: 600; color: #1e293b;">
            ${pihakStr}
          </td>
          <td style="vertical-align: top; font-size: 9pt;">
            <div style="font-weight: 600; color: #0f172a;">${formatReportDateTime(tx.created_at)}</div>
            <div style="color: #64748b; margin-top: 2px;">Petugas: ${tx.created_by_name || "Petugas Gudang"}</div>
          </td>
        </tr>
      `;
    })
    .join("");

  const contentHtml = `
    <!-- Kop & Judul Laporan -->
    <table class="header-table">
      <tr>
        <td style="width: 70%; vertical-align: top;">
          <div class="header-title">DEPARTEMEN WAREHOUSE — LAPORAN RIWAYAT TRANSAKSI & MUTASI GUDANG</div>
          <div class="header-meta">
            Sistem Informasi Operasional Q-Coffee M2 &bull; 
            Periode: <strong>${startDate && endDate ? `${startDate} s/d ${endDate}` : "Seluruh Riwayat Mutasi"}</strong> &bull; 
            Dicetak: <strong>${printDate}</strong> &bull; 
            Petugas: <strong>${generatedByName}</strong>
          </div>
        </td>
        <td style="width: 30%; text-align: right; vertical-align: top;">
          <div style="display: inline-block; background-color: #0f172a; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 10pt; text-align: right;">
            DOKUMEN MUTASI RESMI
          </div>
        </td>
      </tr>
    </table>

    <!-- Ringkasan Eksekutif Mutasi -->
    <table class="card-table" style="width: 100%;">
      <tr>
        <td class="card-cell" style="width: 25%;">
          <div class="card-label">Total Transaksi Mutasi</div>
          <div class="card-value">${totalTx} <span style="font-size: 9pt; font-weight: normal; color: #64748b;">Transaksi</span></div>
        </td>
        <td class="card-cell" style="width: 25%; background-color: #f0fdf4; border-color: #bbf7d0;">
          <div class="card-label" style="color: #15803d;">Mutasi Masuk (Inbound)</div>
          <div class="card-value" style="color: #15803d;">${inTx.length} <span style="font-size: 9pt; font-weight: normal;">Bon (${totalQtyIn.toLocaleString("id-ID")} Qty)</span></div>
        </td>
        <td class="card-cell" style="width: 25%; background-color: #fff1f2; border-color: #fecdd3;">
          <div class="card-label" style="color: #be123c;">Mutasi Keluar (Outbound)</div>
          <div class="card-value" style="color: #be123c;">${outTx.length} <span style="font-size: 9pt; font-weight: normal;">Bon (${totalQtyOut.toLocaleString("id-ID")} Qty)</span></div>
        </td>
        <td class="card-cell" style="width: 25%;">
          <div class="card-label">Penyesuaian (Adjustment)</div>
          <div class="card-value" style="color: #475569;">${adjTx.length} <span style="font-size: 9pt; font-weight: normal;">Transaksi</span></div>
        </td>
      </tr>
    </table>

    <!-- Parameter & Informasi Laporan SAP/ERP Sesuai Ketentuan -->
    <table style="width: 100%; max-width: 600px; margin-top: 16px; margin-bottom: 16px; border-collapse: collapse; font-family: Calibri, 'Segoe UI', Arial, sans-serif; font-size: 10pt;">
      <tr>
        <td style="width: 140px; font-weight: bold; padding: 3px 0; color: #0f172a;">1. PLANT</td>
        <td style="padding: 3px 0; font-weight: 600; color: #334155;">: ${plant}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 3px 0; color: #0f172a;">2. S.LOCATION</td>
        <td style="padding: 3px 0; font-weight: 600; color: #334155;">: ${storageLocation}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 3px 0; color: #0f172a;">3. MAT.TYPE</td>
        <td style="padding: 3px 0; font-weight: 600; color: #334155;">: ${materialType}</td>
      </tr>
      <tr>
        <td style="font-weight: bold; padding: 3px 0; color: #0f172a;">4. PERIOD</td>
        <td style="padding: 3px 0; font-weight: 600; color: #334155;">: ${periodText}</td>
      </tr>
    </table>

    <!-- Tabel Data Mutasi -->
    <table class="main-table">
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">No</th>
          <th style="width: 150px;">No. Transaksi / Bon</th>
          <th style="width: 130px; text-align: center;">Tipe Mutasi</th>
          <th style="width: 320px;">Rincian Barang / Sparepart Dimutasikan</th>
          <th style="width: 180px;">No. Batch & Referensi</th>
          <th style="width: 200px;">Supplier / Tujuan Pemesan</th>
          <th style="width: 180px;">Waktu Eksekusi & Petugas</th>
        </tr>
      </thead>
      <tbody>
        ${rowsHtml}
      </tbody>
    </table>

    <!-- Lembar Tanda Tangan & Pengesahan -->
    <table class="sig-table">
      <tr>
        <td class="sig-cell">
          <div class="sig-title">Dibuat Oleh,<br /><strong>Unit Head</strong></div>
          <div class="sig-line">( ............................................ )</div>
          <div class="sig-role">Tanggal: .............................</div>
        </td>
        <td class="sig-cell">
          <div class="sig-title">Diperiksa Oleh,<br /><strong>Section Head</strong></div>
          <div class="sig-line">( ............................................ )</div>
          <div class="sig-role">Tanggal: .............................</div>
        </td>
        <td class="sig-cell">
          <div class="sig-title">Disetujui Oleh,<br /><strong>Departement Head</strong></div>
          <div class="sig-line">( ............................................ )</div>
          <div class="sig-role">Tanggal: .............................</div>
        </td>
      </tr>
    </table>

    <div class="doc-footer-note">
      Dokumen ini dicetak secara otomatis melalui Sistem Q-Coffee M2. Seluruh histori mutasi tercatat secara digital dan terintegrasi dalam database operasional.
    </div>
  `;

  const excelHtml = wrapOfficeExcelHtml("Riwayat Mutasi", contentHtml);
  const blob = new Blob(["\uFEFF" + excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  triggerFileDownload(blob, `laporan_mutasi_in_out_${fileDate}.xls`);
}

// ─────────────────────────────────────────────────────────────────────────────
// 3. EXPORT LAPORAN RINGKASAN EXECUTIVE DASHBOARD OBS SPAREPART (.XLS EXCEL)
// ─────────────────────────────────────────────────────────────────────────────

export interface ExportDashboardOptions {
  products: ExportProductItem[];
  groupedTransactions: ExportGroupedTransaction[];
  limitProducts: ExportProductItem[];
  barangMasukCount: number;
  barangKeluarCount: number;
  generatedByName?: string;
  userRoleLabel?: string;
}

export function exportDashboardSparepartExecutiveExcel(options: ExportDashboardOptions) {
  const {
    products,
    groupedTransactions,
    limitProducts,
    barangMasukCount,
    barangKeluarCount,
    generatedByName = "Pengguna Sistem",
    userRoleLabel = "Department Warehouse - Sparepart",
  } = options;

  const printDate = formatReportDateTime(new Date());
  const fileDate = new Date().toISOString().split("T")[0];

  const totalSKU = products.length;
  const safeCount = totalSKU - limitProducts.length;
  const totalStokFisik = products.reduce((acc, p) => acc + (p.current_stock ?? 0), 0);

  // Bagian 1: Tabel Barang Limit / Kritis
  const limitRowsHtml = limitProducts.length > 0
    ? limitProducts.map((p, idx) => `
        <tr class="limit-row">
          <td style="text-align: center; color: #be123c; font-weight: bold;">${idx + 1}</td>
          <td style="font-family: Consolas, monospace; font-weight: bold; mso-number-format:'\\@';">${p.code || "—"}</td>
          <td style="font-weight: bold; color: #be123c;">${p.name}</td>
          <td>${p.category || "Sparepart"}</td>
          <td style="text-align: center;">${p.unit || "pcs"}</td>
          <td>${p.location || "Gudang Utama"} / ${p.shelf || "Rak A-1"}</td>
          <td style="text-align: right; font-weight: bold; color: #be123c;">${(p.current_stock ?? 0).toLocaleString("id-ID")}</td>
          <td style="text-align: right; color: #64748b;">${(p.min_stock ?? 10).toLocaleString("id-ID")}</td>
          <td style="text-align: center;"><span class="badge-limit">PERLU RESTOCK</span></td>
        </tr>
      `).join("")
    : `<tr><td colspan="9" style="text-align: center; padding: 14px; color: #15803d; font-weight: bold;">Semua stok sparepart berada dalam batas aman normal (tidak ada barang kritis).</td></tr>`;

  // Bagian 2: Ringkasan Seluruh Stok Barang
  const allProductRowsHtml = products.slice(0, 100).map((p, idx) => {
    const isLimit = (p.current_stock ?? 0) <= (p.min_stock ?? 10);
    return `
      <tr class="${isLimit ? "limit-row" : (idx % 2 === 0 ? "even" : "odd")}">
        <td style="text-align: center; color: #64748b; font-size: 9pt;">${idx + 1}</td>
        <td style="font-family: Consolas, monospace; font-weight: bold; font-size: 9pt; mso-number-format:'\\@';">${p.code || "—"}</td>
        <td style="font-weight: 600;">${p.name}</td>
        <td>${p.category || "Sparepart"}</td>
        <td style="text-align: center;">${p.unit || "pcs"}</td>
        <td>${p.location || "Gudang"} (${p.shelf || "Rak"})</td>
        <td style="text-align: right; font-weight: bold; ${isLimit ? "color: #be123c;" : "color: #047857;"}">
          ${(p.current_stock ?? 0).toLocaleString("id-ID")}
        </td>
        <td style="text-align: right; color: #64748b;">${(p.min_stock ?? 10).toLocaleString("id-ID")}</td>
        <td style="text-align: center;">
          <span class="${isLimit ? "badge-limit" : "badge-safe"}">${isLimit ? "LIMIT" : "AMAN"}</span>
        </td>
      </tr>
    `;
  }).join("");

  // Bagian 3: Riwayat Mutasi Terkini
  const latestTxRowsHtml = groupedTransactions.slice(0, 25).map((tx, idx) => {
    const isMasuk = tx.tx_type === "IN";
    const itemsSummary = tx.items.map((it) => `${it.product_name} (${isMasuk ? "+" : "-"}${it.quantity} ${it.unit})`).join(", ");
    return `
      <tr class="${idx % 2 === 0 ? "even" : "odd"}">
        <td style="text-align: center; color: #64748b; font-size: 9pt;">${idx + 1}</td>
        <td style="font-family: Consolas, monospace; font-weight: bold; mso-number-format:'\\@';">${tx.transaction_number}</td>
        <td style="text-align: center;"><span class="${isMasuk ? "badge-in" : "badge-out"}">${isMasuk ? "MASUK" : "KELUAR"}</span></td>
        <td>${itemsSummary}</td>
        <td>${tx.supplier_or_dest || "—"}</td>
        <td style="font-size: 9pt;">${formatReportDateTime(tx.created_at)}</td>
        <td style="font-size: 9pt;">${tx.created_by_name || "Petugas"}</td>
      </tr>
    `;
  }).join("");

  const contentHtml = `
    <!-- Kop & Judul Laporan -->
    <table class="header-table">
      <tr>
        <td style="width: 70%; vertical-align: top;">
          <div class="header-title">EXECUTIVE REPORT — DASHBOARD OBS SPAREPART & INVENTARIS</div>
          <div class="header-meta">
            Ringkasan Statistik & Pergerakan Operasional &bull; 
            Role: <strong>${userRoleLabel}</strong> &bull; 
            Dicetak: <strong>${printDate}</strong> &bull; 
            Petugas: <strong>${generatedByName}</strong>
          </div>
        </td>
        <td style="width: 30%; text-align: right; vertical-align: top;">
          <div style="display: inline-block; background-color: #0369a1; color: white; padding: 8px 16px; border-radius: 6px; font-weight: 700; font-size: 10pt; text-align: right;">
            DASHBOARD EXECUTIVE SUMMARY
          </div>
        </td>
      </tr>
    </table>

    <!-- Ringkasan Eksekutif KPI Cards -->
    <table class="card-table" style="width: 100%;">
      <tr>
        <td class="card-cell" style="width: 20%;">
          <div class="card-label">Total Master SKU</div>
          <div class="card-value">${totalSKU} <span style="font-size: 9pt; font-weight: normal; color: #64748b;">Item</span></div>
        </td>
        <td class="card-cell" style="width: 20%;">
          <div class="card-label">Total Saldo Stok</div>
          <div class="card-value" style="color: #0369a1;">${totalStokFisik.toLocaleString("id-ID")} <span style="font-size: 9pt; font-weight: normal; color: #64748b;">Unit</span></div>
        </td>
        <td class="card-cell" style="width: 20%;">
          <div class="card-label">Stok Aman / Normal</div>
          <div class="card-value" style="color: #15803d;">${safeCount} <span style="font-size: 9pt; font-weight: normal; color: #64748b;">SKU</span></div>
        </td>
        <td class="card-cell" style="width: 20%; background-color: #fff1f2; border-color: #fecdd3;">
          <div class="card-label" style="color: #be123c;">Stok Limit / Perlu Restock</div>
          <div class="card-value" style="color: #be123c;">${limitProducts.length} <span style="font-size: 9pt; font-weight: normal; color: #be123c;">SKU</span></div>
        </td>
        <td class="card-cell" style="width: 20%;">
          <div class="card-label">Total Transaksi Mutasi</div>
          <div class="card-value">${groupedTransactions.length} <span style="font-size: 9pt; font-weight: normal; color: #64748b;">Bon</span></div>
        </td>
      </tr>
    </table>

    <!-- BAGIAN 1: SPAREPART KRITIS / PERLU RESTOCK -->
    <div style="margin-top: 16px; margin-bottom: 8px; font-weight: 800; font-size: 11pt; color: #be123c;">
      DAFTAR SPAREPART & BARANG KRITIS / LIMIT (${limitProducts.length} ITEM PERLU PERHATIAN)
    </div>
    <table class="main-table">
      <thead>
        <tr style="background-color: #881337;">
          <th style="width: 35px; text-align: center; background-color: #881337;">No</th>
          <th style="width: 130px; background-color: #881337;">Kode Part</th>
          <th style="width: 260px; background-color: #881337;">Nama Barang</th>
          <th style="width: 130px; background-color: #881337;">Kategori</th>
          <th style="width: 70px; text-align: center; background-color: #881337;">Satuan</th>
          <th style="width: 150px; background-color: #881337;">Lokasi / Rak</th>
          <th style="width: 100px; text-align: right; background-color: #881337;">Stok Terkini</th>
          <th style="width: 90px; text-align: right; background-color: #881337;">Batas Min.</th>
          <th style="width: 120px; text-align: center; background-color: #881337;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${limitRowsHtml}
      </tbody>
    </table>

    <!-- BAGIAN 2: MASTER DATA STOK SPAREPART -->
    <div style="margin-top: 24px; margin-bottom: 8px; font-weight: 800; font-size: 11pt; color: #0f172a;">
      RINGKASAN MASTER DATA STOK SPAREPART & BARANG GUDANG (${products.length} ITEM)
    </div>
    <table class="main-table">
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">No</th>
          <th style="width: 130px;">Kode SKU</th>
          <th style="width: 260px;">Nama Produk / Sparepart</th>
          <th style="width: 130px;">Kategori</th>
          <th style="width: 70px; text-align: center;">Satuan</th>
          <th style="width: 150px;">Lokasi & Posisi</th>
          <th style="width: 100px; text-align: right;">Stok Terkini</th>
          <th style="width: 90px; text-align: right;">Batas Min.</th>
          <th style="width: 110px; text-align: center;">Status</th>
        </tr>
      </thead>
      <tbody>
        ${allProductRowsHtml}
      </tbody>
    </table>

    <!-- BAGIAN 3: RIWAYAT MUTASI TERKINI -->
    <div style="margin-top: 24px; margin-bottom: 8px; font-weight: 800; font-size: 11pt; color: #0f172a;">
      HISTORI MUTASI TRANSAKSI GUDANG TERKINI
    </div>
    <table class="main-table">
      <thead>
        <tr>
          <th style="width: 35px; text-align: center;">No</th>
          <th style="width: 140px;">No. Bon Transaksi</th>
          <th style="width: 100px; text-align: center;">Tipe</th>
          <th style="width: 320px;">Rincian Barang Mutasi</th>
          <th style="width: 180px;">Supplier / Tujuan</th>
          <th style="width: 140px;">Waktu</th>
          <th style="width: 130px;">Petugas</th>
        </tr>
      </thead>
      <tbody>
        ${latestTxRowsHtml}
      </tbody>
    </table>

    <!-- Tanda Tangan & Pengesahan -->
    <table class="sig-table">
      <tr>
        <td class="sig-cell">
          <div class="sig-title">Dibuat Oleh,<br /><strong>Unit Head</strong></div>
          <div class="sig-line">( ............................................ )</div>
          <div class="sig-role">Tanggal: .............................</div>
        </td>
        <td class="sig-cell">
          <div class="sig-title">Diperiksa Oleh,<br /><strong>Section Head</strong></div>
          <div class="sig-line">( ............................................ )</div>
          <div class="sig-role">Tanggal: .............................</div>
        </td>
        <td class="sig-cell">
          <div class="sig-title">Disetujui Oleh,<br /><strong>Departement Head</strong></div>
          <div class="sig-line">( ............................................ )</div>
          <div class="sig-role">Tanggal: .............................</div>
        </td>
      </tr>
    </table>

    <div class="doc-footer-note">
      Dokumen ini dicetak dari Dashboard OBS Sparepart Q-Coffee M2.
    </div>
  `;

  const excelHtml = wrapOfficeExcelHtml("Dashboard Executive", contentHtml);
  const blob = new Blob(["\uFEFF" + excelHtml], {
    type: "application/vnd.ms-excel;charset=utf-8;",
  });
  triggerFileDownload(blob, `laporan_dashboard_sparepart_${fileDate}.xls`);
}
