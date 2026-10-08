import * as XLSX from "xlsx";
import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useRef, useEffect, useMemo } from "react";
import {
  Plus,
  Pencil,
  Trash2,
  PackageSearch,
  ToggleLeft,
  ToggleRight,
  Package,
  ArrowDownLeft,
  ArrowUpRight,
  History,
  FileSpreadsheet,
  UploadCloud,
  FileText,
  Warehouse,
  Tags,
  MapPin,
  Ruler,
  AlertTriangle,
  Image as ImageIcon,
  Layers,
  Search,
  Filter,
  Check,
  X,
  ChevronsUpDown,
  ExternalLink,
  Clock,
  Download,
  Printer,
  Eye,
  ArrowUpDown,
  Calendar as CalendarIcon,
  ShieldCheck,
  BoxSelect,
  TrendingDown,
  CircleAlert,
  Boxes,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { formatDate } from "@/lib/domain";
import { exportSparepartInventoryExcel } from "@/lib/exportUtils";

type ProductsSearch = {
  tab?: string | undefined;
  action?: string | undefined;
  type?: "IN" | "OUT" | undefined;
};

export const Route = createFileRoute("/_authenticated/products")({
  validateSearch: (search: Record<string, unknown>): ProductsSearch => {
    return {
      tab: typeof search["tab"] === "string" ? search["tab"] : undefined,
      action: typeof search["action"] === "string" ? search["action"] : undefined,
      type:
        search["type"] === "IN" || search["type"] === "OUT"
          ? (search["type"] as "IN" | "OUT")
          : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Buffer Stok" },
      {
        name: "description",
        content:
          "Memantau stok cadangan untuk menjaga ketersediaan barang dan mengantisipasi kebutuhan yang tidak terduga.",
      },
    ],
  }),
  component: WarehouseAndProductsPage,
});

type ProductItem = {
  id: string;
  name: string;
  code: string | null;
  category?: string | null;
  unit?: string | null;
  location?: string | null;
  shelf?: string | null;
  min_stock?: number | null;
  safe_stock?: number | null;
  max_stock?: number | null;
  current_stock?: number | null;
  qty_in?: number | string | null;
  qty_out?: number | string | null;
  image_url?: string | null;
  doc_url?: string | null;
  description?: string | null;
  is_active: boolean;
  created_at?: string;
};

// Tipe data Buffer Stok — tabel terpisah dari OBS Sparepart
type BufferStockItem = {
  id: string;
  name: string;
  code: string | null;
  category?: string | null;
  unit?: string | null;
  location?: string | null;
  shelf?: string | null;
  min_stock?: number | null;
  safe_stock?: number | null;
  max_stock?: number | null;
  current_stock?: number | null;
  qty_in?: number | string | null;
  qty_out?: number | string | null;
  description?: string | null;
  image_url?: string | null;
  doc_url?: string | null;
  is_active: boolean;
  created_at?: string;
};

type WarehouseTransaction = {
  id: string;
  transaction_number: string;
  tx_type: "IN" | "OUT" | "ADJUSTMENT";
  product_id: string;
  product_name: string;
  quantity: number;
  unit: string;
  batch_number?: string | null;
  reference_no?: string | null;
  supplier_or_dest?: string | null;
  notes?: string | null;
  document_url?: string | null;
  created_by_name?: string | null;
  created_at: string;
};

type ActivityLog = {
  id: string;
  action: string;
  description: string;
  user_name?: string | null;
  created_at: string;
};

// Komponen Pencarian Barang Interaktif (Searchable Combobox) untuk Catat Masuk & Keluar
function ProductSearchCombobox({
  products,
  value,
  onChange,
  itemNumber,
}: {
  products: ProductItem[];
  value: string;
  onChange: (productId: string, unit: string) => void;
  itemNumber: number;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");

  const activeProducts = products.filter((p) => p.is_active);
  const selectedProduct = activeProducts.find((p) => p.id === value);

  const filtered = activeProducts.filter((p) => {
    if (!search.trim()) return true;
    const term = search.toLowerCase();
    return (
      p.name.toLowerCase().includes(term) ||
      (p.code && p.code.toLowerCase().includes(term)) ||
      (p.category && p.category.toLowerCase().includes(term)) ||
      (p.location && p.location.toLowerCase().includes(term))
    );
  });

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className={cn(
            "h-9 w-full justify-between text-xs font-normal bg-background hover:bg-surface-muted border-input text-left",
            !selectedProduct && "text-muted-foreground",
          )}
        >
          <span className="truncate">
            {selectedProduct
              ? `${selectedProduct.name} ${selectedProduct.code ? `(${selectedProduct.code})` : ""} — Stok: ${selectedProduct.current_stock ?? 0} ${selectedProduct.unit || "kg"}`
              : `Cari & pilih barang #${itemNumber}...`}
          </span>
          <ChevronsUpDown className="ml-2 size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[340px] sm:w-[420px] p-0 shadow-lg" align="start">
        <div className="flex items-center border-b px-3 py-2">
          <Search className="mr-2 size-4 shrink-0 text-muted-foreground" />
          <input
            placeholder="Ketik nama barang, kode SKU, kategori..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex h-8 w-full rounded-md bg-transparent text-xs outline-none placeholder:text-muted-foreground disabled:cursor-not-allowed disabled:opacity-50"
            autoFocus
          />
          {search && (
            <button
              onClick={() => setSearch("")}
              className="size-4 p-0.5 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3" />
            </button>
          )}
        </div>
        <div className="max-h-60 overflow-y-auto p-1 divide-y divide-border/40">
          {filtered.length === 0 ? (
            <div className="py-6 text-center text-xs text-muted-foreground">
              Barang tidak ditemukan.
            </div>
          ) : (
            filtered.map((p) => {
              const isSelected = p.id === value;
              return (
                <div
                  key={p.id}
                  onClick={() => {
                    onChange(p.id, p.unit || "kg");
                    setOpen(false);
                  }}
                  className={cn(
                    "flex items-center justify-between p-2 rounded cursor-pointer text-xs transition-colors hover:bg-primary/10 hover:text-primary",
                    isSelected && "bg-primary/15 font-semibold text-primary",
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-foreground truncate">{p.name}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                      {p.code && (
                        <span className="font-mono bg-surface-muted px-1 rounded">{p.code}</span>
                      )}
                      {p.category && <span>• {p.category}</span>}
                      {p.location && <span>• {p.location}</span>}
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <span className="font-mono font-bold text-foreground">
                      {p.current_stock ?? 0} {p.unit || "kg"}
                    </span>
                    {isSelected && <Check className="ml-2 size-3.5 inline text-primary" />}
                  </div>
                </div>
              );
            })
          )}
        </div>
      </PopoverContent>
    </Popover>
  );
}

interface ParsedExcelColumn {
  key: string;
  label: string;
  align?: "left" | "center" | "right";
  rawIndex?: number;
}

interface ParsedExcelSheet {
  name: string;
  count: number;
  items: any[];
  columns?: ParsedExcelColumn[];
}

function parseExcelWorkbookToSheets(
  workbook: XLSX.WorkBook,
  defaultCategory: string = "Sparepart & Tools",
): ParsedExcelSheet[] {
  const resultSheets: ParsedExcelSheet[] = [];

  for (const sheetName of workbook.SheetNames) {
    const worksheet = workbook.Sheets[sheetName];
    if (!worksheet) continue;

    const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });
    if (!rawRows || rawRows.length < 2) continue;

    // Detect header row in first 8 rows
    let headerRowIdx = -1;
    for (let i = 0; i < Math.min(rawRows.length, 8); i++) {
      const rowStr = (rawRows[i] || []).map((c: any) => String(c || "").toLowerCase()).join(" ");
      if (
        rowStr.includes("kode") ||
        rowStr.includes("material") ||
        rowStr.includes("nama") ||
        rowStr.includes("barang") ||
        rowStr.includes("part") ||
        rowStr.includes("stok") ||
        rowStr.includes("stock") ||
        rowStr.includes("qty") ||
        rowStr.includes("balance") ||
        rowStr.includes("ending") ||
        rowStr.includes("saldo") ||
        rowStr.includes("jumlah")
      ) {
        headerRowIdx = i;
        break;
      }
    }

    if (headerRowIdx === -1) headerRowIdx = 0;

    const selectedHeaderRow = rawRows[headerRowIdx] || [];
    const headers = selectedHeaderRow.map((h: any) =>
      String(h || "")
        .toLowerCase()
        .trim()
        .replace(/\r?\n|\r/g, " ")
        .replace(/\s+/g, " "),
    );

    const isSparepart = defaultCategory === "Sparepart & Tools";

    const safeStockIdx = headers.findIndex(
      (h: string) =>
        h.includes("batas minimal") ||
        h.includes("batas min") ||
        h.includes("safe stock") ||
        h.includes("safety stock") ||
        h.includes("safety") ||
        h.includes("limit"),
    );

    const minStockIdx = headers.findIndex(
      (h: string, idx: number) =>
        idx !== safeStockIdx &&
        (h.includes("minimal stok") ||
          h.includes("min stok") ||
          h.includes("minimal stock") ||
          h.includes("min stock") ||
          h === "min" ||
          h === "minimum"),
    );

    const maxStockIdx = headers.findIndex(
      (h: string, idx: number) =>
        idx !== safeStockIdx &&
        idx !== minStockIdx &&
        (h.includes("maksimal") ||
          h.includes("maks.") ||
          h.includes("maks") ||
          h.includes("max stock") ||
          h.includes("max.stock") ||
          h.includes("max_stock") ||
          h.includes("maximum") ||
          h.includes("max.") ||
          h.includes("stok max") ||
          h.includes("stock max") ||
          h.includes("stok maks") ||
          h.includes("stock maks") ||
          h === "max" ||
          h === "maks"),
    );

    // Kolom Mutasi Stok OBS: BEGINNING BALANCE
    const beginningBalanceIdx = headers.findIndex(
      (h: string) =>
        h.includes("beginning") ||
        h.includes("beg balance") ||
        h.includes("beg. balance") ||
        h.includes("beg bal") ||
        h.includes("saldo awal") ||
        h.includes("stok awal") ||
        h.includes("opening") ||
        h === "beg" ||
        h === "awal",
    );

    // Kolom Mutasi Stok OBS: RECEIPT
    const receiptIdx = headers.findIndex(
      (h: string) =>
        h.includes("receipt") ||
        h.includes("masuk") ||
        h.includes("penerimaan") ||
        h.includes("qty in") ||
        h === "in" ||
        h === "rcpt",
    );

    // Kolom Mutasi Stok OBS: ISSUED
    const issuedIdx = headers.findIndex(
      (h: string) =>
        h.includes("issued") ||
        h.includes("issue") ||
        h.includes("keluar") ||
        h.includes("pengeluaran") ||
        h.includes("qty out") ||
        h === "out" ||
        h.includes("pemakaian") ||
        h === "iss",
    );

    // Kolom Mutasi Stok OBS: ENDING BALANCE / STOK SAAT INI
    const endingBalanceIdx = headers.findIndex(
      (h: string, idx: number) =>
        idx !== beginningBalanceIdx &&
        idx !== safeStockIdx &&
        idx !== minStockIdx &&
        idx !== maxStockIdx &&
        (h.includes("ending balance") ||
          h.includes("ending") ||
          h.includes("end balance") ||
          h.includes("end. balance") ||
          h.includes("saldo akhir") ||
          h.includes("stok akhir") ||
          h.includes("saat ini") ||
          h.includes("current") ||
          h.includes("stok fisik") ||
          h.includes("saldo") ||
          h.includes("balance") ||
          h.includes("closing") ||
          h.includes("qty stock") ||
          h.includes("qty") ||
          h.includes("quantity") ||
          h.includes("jumlah") ||
          h === "stok" ||
          h === "stock"),
    );

    const currentStockIdx = endingBalanceIdx;

    let codeIdx = headers.findIndex(
      (h: string) =>
        h.includes("kode") ||
        h.includes("code") ||
        h.includes("sku") ||
        h.includes("part no") ||
        h.includes("part_no") ||
        (h.includes("material") &&
          !h.includes("nama") &&
          !h.includes("type") &&
          !h.includes("desc")),
    );

    let nameIdx = headers.findIndex(
      (h: string, idx: number) =>
        idx !== codeIdx &&
        (h.includes("nama") ||
          h.includes("material") ||
          h.includes("deskripsi") ||
          h.includes("description") ||
          h.includes("barang") ||
          h.includes("item")),
    );

    const uomIdx = headers.findIndex(
      (h: string) =>
        h.includes("satuan") ||
        h.includes("uom") ||
        h.includes("u.o.m") ||
        h.includes("unit") ||
        h.includes("meins") ||
        h.includes("bunn") ||
        h === "sat" ||
        h === "sat.",
    );
    const locIdx = headers.findIndex(
      (h: string) => h.includes("lokasi") || h.includes("location") || h.includes("gudang"),
    );
    const shelfIdx = headers.findIndex(
      (h: string) => h.includes("rak") || h.includes("shelf") || h.includes("bin"),
    );

    const parseNum = (val: any, fallback: number | null = null): number | null => {
      if (
        val === undefined ||
        val === null ||
        String(val).trim() === "" ||
        String(val).trim() === "—" ||
        String(val).trim() === "-"
      ) {
        return fallback;
      }
      const normalized = String(val).trim().replace(",", ".");
      const cleanStr = normalized.replace(/[^0-9.-]/g, "");
      const num = parseFloat(cleanStr);
      return !isNaN(num) ? num : fallback;
    };

    // Bangun daftar kolom yang ada di file Excel ini sesuai urutan header file
    const sheetColumns: ParsedExcelColumn[] = [];
    const hasStockInFile =
      endingBalanceIdx >= 0 || beginningBalanceIdx >= 0 || receiptIdx >= 0 || issuedIdx >= 0;

    for (let c = 0; c < selectedHeaderRow.length; c++) {
      const hRaw = String(selectedHeaderRow[c] || "").trim();
      const hLower = headers[c] || "";

      // Jangan masukkan jika kolom kosong tanpa data dan bukan code/name/uom
      if (!hRaw && c !== codeIdx && c !== nameIdx && c !== uomIdx) continue;

      if (c === codeIdx) {
        sheetColumns.push({
          key: "code",
          label: hRaw || "Kode",
          align: "center",
          rawIndex: c,
        });
      } else if (c === nameIdx) {
        sheetColumns.push({
          key: "name",
          label: hRaw || "Material",
          align: "left",
          rawIndex: c,
        });
      } else if (c === uomIdx) {
        sheetColumns.push({
          key: "unit",
          label: hRaw || "Satuan",
          align: "center",
          rawIndex: c,
        });
      } else if (c === beginningBalanceIdx) {
        sheetColumns.push({
          key: "beginning_balance",
          label: hRaw || "BEGINNING BALANCE",
          align: "center",
          rawIndex: c,
        });
      } else if (c === receiptIdx) {
        sheetColumns.push({
          key: "receipt",
          label: hRaw || "RECEIPT",
          align: "center",
          rawIndex: c,
        });
      } else if (c === issuedIdx) {
        sheetColumns.push({
          key: "issued",
          label: hRaw || "ISSUED",
          align: "center",
          rawIndex: c,
        });
      } else if (c === endingBalanceIdx) {
        sheetColumns.push({
          key: "ending_balance",
          label: hRaw || "ENDING BALANCE",
          align: "center",
          rawIndex: c,
        });
      } else if (c === minStockIdx) {
        sheetColumns.push({
          key: "min_stock",
          label: hRaw || "MINIMUM STOCK",
          align: "center",
          rawIndex: c,
        });
      } else if (c === maxStockIdx) {
        sheetColumns.push({
          key: "max_stock",
          label: hRaw || "MAKS. STOCK",
          align: "center",
          rawIndex: c,
        });
      } else if (hRaw && !hLower.includes("no") && hLower !== "#") {
        sheetColumns.push({
          key: `col_${c}`,
          label: hRaw,
          align: "center",
          rawIndex: c,
        });
      }
    }

    // Pastikan code dan name selalu ada di list kolom pratinjau
    if (!sheetColumns.some((col) => col.key === "code") && codeIdx >= 0) {
      sheetColumns.unshift({ key: "code", label: "Kode", align: "center", rawIndex: codeIdx });
    }
    if (!sheetColumns.some((col) => col.key === "name") && nameIdx >= 0) {
      const cIdx = sheetColumns.findIndex((col) => col.key === "code");
      sheetColumns.splice(cIdx >= 0 ? cIdx + 1 : 0, 0, {
        key: "name",
        label: "Material",
        align: "left",
        rawIndex: nameIdx,
      });
    }

    const parsedItems: any[] = [];
    for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
      const row = rawRows[r];
      if (!row || row.length === 0) continue;

      let rawCode = codeIdx >= 0 && row[codeIdx] !== undefined ? String(row[codeIdx]).trim() : "";
      let rawName = nameIdx >= 0 && row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : "";

      // Fallback if headers were absent or columns merged
      if ((codeIdx < 0 || nameIdx < 0) && row.length >= 2) {
        const c0 = String(row[0] || "").trim();
        const c1 = String(row[1] || "").trim();
        const c2 = String(row[2] || "").trim();

        // Sequence number check (1, 2, 3...)
        const isSequenceNo = /^\d{1,4}$/.test(c0) && parseInt(c0, 10) === parsedItems.length + 1;
        if (isSequenceNo) {
          rawCode = c1;
          rawName = c2;
        } else {
          if (c0 && c1 && isNaN(Number(c1))) {
            rawCode = c0;
            rawName = c1;
          } else if (c0 && !rawCode) {
            rawCode = c0;
          }
        }
      }

      // Ignore subheaders and invalid lines
      const lowerCode = rawCode.toLowerCase();
      const lowerName = rawName.toLowerCase();
      if (
        lowerCode === "material type" ||
        lowerCode === "kode" ||
        lowerCode === "material" ||
        lowerCode === "no" ||
        lowerName === "material type" ||
        lowerName === "material" ||
        lowerName === "nama barang" ||
        lowerName === "%" ||
        lowerName === "item material type"
      ) {
        continue;
      }

      if (!rawName && !rawCode) continue;

      // Clean SAP 18-digit material numbers: 000000007100111044 -> 7100111044
      if (/^00000000\d+$/.test(rawCode)) {
        rawCode = rawCode.replace(/^0+/, "");
      }

      if (!rawName && rawCode) {
        rawName = `Item ${rawCode}`;
      }

      // Determine Unit
      let unit = "pcs";
      if (uomIdx >= 0 && row[uomIdx]) {
        unit = String(row[uomIdx]).trim().toLowerCase();
      } else if (
        row[2] &&
        typeof row[2] === "string" &&
        ["pcs", "unit", "set", "rol", "CAN", "LMR", "pack"].includes(row[2].trim().toLowerCase())
      ) {
        unit = row[2].trim().toLowerCase();
      }

      const rawBeginning =
        beginningBalanceIdx >= 0 ? parseNum(row[beginningBalanceIdx], null) : null;
      const rawReceipt = receiptIdx >= 0 ? parseNum(row[receiptIdx], null) : null;
      const rawIssued = issuedIdx >= 0 ? parseNum(row[issuedIdx], null) : null;
      const rawEnding = endingBalanceIdx >= 0 ? parseNum(row[endingBalanceIdx], null) : null;

      let receipt = rawReceipt;
      let issued = rawIssued;
      let beginningBalance = rawBeginning;
      let endingBalance = rawEnding;

      if (hasStockInFile) {
        receipt = rawReceipt ?? 0;
        issued = rawIssued ?? 0;
        beginningBalance = rawBeginning ?? 0;
        endingBalance = rawEnding ?? 0;

        if (rawEnding === null && rawBeginning !== null) {
          endingBalance = Math.max(0, beginningBalance + receipt - issued);
        } else if (rawBeginning === null && rawEnding !== null) {
          beginningBalance = Math.max(0, endingBalance - receipt + issued);
        } else if (rawBeginning === null && rawEnding === null) {
          const fallbackStock = currentStockIdx >= 0 ? (parseNum(row[currentStockIdx], 0) ?? 0) : 0;
          endingBalance = fallbackStock;
          beginningBalance = fallbackStock;
        }
      }

      const itemObj: any = {
        name: rawName,
        code: rawCode || null,
        beginning_balance: beginningBalance,
        receipt: receipt,
        issued: issued,
        ending_balance: endingBalance,
        current_stock: endingBalance,
        safe_stock: safeStockIdx >= 0 ? (parseNum(row[safeStockIdx], 1) ?? 1) : 1,
        min_stock: minStockIdx >= 0 ? parseNum(row[minStockIdx], null) : null,
        max_stock: maxStockIdx >= 0 ? parseNum(row[maxStockIdx], null) : null,
        category: defaultCategory,
        unit: unit || "pcs",
        location: locIdx >= 0 && row[locIdx] ? String(row[locIdx]).trim() : "Gudang Utama",
        shelf: shelfIdx >= 0 && row[shelfIdx] ? String(row[shelfIdx]).trim() : "Rak A-1",
        is_active: true,
        sheet_source: sheetName,
      };

      for (const col of sheetColumns) {
        if (col.key.startsWith("col_") && col.rawIndex !== undefined) {
          itemObj[col.key] =
            row[col.rawIndex] !== undefined ? String(row[col.rawIndex]).trim() : "";
        }
      }

      parsedItems.push(itemObj);
    }

    if (parsedItems.length > 0) {
      resultSheets.push({
        name: sheetName,
        count: parsedItems.length,
        items: parsedItems,
        columns: sheetColumns,
      });
    }
  }

  return resultSheets;
}

function WarehouseAndProductsPage() {
  const { profile, roles, isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  // Hak akses Departemen Warehouse Sparepart & Continuous Improvement
  const isWarehouseAdmin =
    isAdmin || roles.includes("prod_process_uh") || roles.includes("admin_process");
  const canManageWarehouse = isWarehouseAdmin || roles.includes("qc_field");
  const canDeleteMaster = isAdmin || roles.includes("prod_process_uh");

  // Tab State
  const [activeTab, setActiveTab] = useState<string>(search.tab || "items");
  const [searchQuery, setSearchQuery] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("ALL");
  const [productDateFilter, setProductDateFilter] = useState<string>("");
  const [sortOption, setSortOption] = useState<string>("RECENT_MUTATION");

  // State Modal Tambah Barang (OBS Sparepart)
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Array<any>>([]);
  const [importSheets, setImportSheets] = useState<ParsedExcelSheet[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>("ALL");
  const [importSortOption, setImportSortOption] = useState<string>("DEFAULT");
  const [isImporting, setIsImporting] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // State Modal Buffer Stok (tabel sendiri, independen)
  const [isBufferAddOpen, setIsBufferAddOpen] = useState(false);
  const [bufferFormData, setBufferFormData] = useState({
    name: "",
    code: "",
    unit: "Roll",
    location: "Gudang Utama",
    shelf: "Rak A-1",
    qty_in: "0",
    qty_out: "0",
    min_stock: "10",
    safe_stock: "1",
    max_stock: "",
    current_stock: "0",
    description: "",
  });
  const [editingBufferItem, setEditingBufferItem] = useState<BufferStockItem | null>(null);
  const [selectedBufferItem, setSelectedBufferItem] = useState<BufferStockItem | null>(null);
  const [deletingBufferItem, setDeletingBufferItem] = useState<BufferStockItem | null>(null);
  const [bufferSearchQuery, setBufferSearchQuery] = useState("");
  const [bufferStatusFilter, setBufferStatusFilter] = useState<string>("ALL");
  const [bufferDateFilter, setBufferDateFilter] = useState<string>("");
  const [bufferSortOption, setBufferSortOption] = useState<string>("RECENT_MUTATION");

  // State Import File Buffer Stok (terpisah dari OBS)
  const [bufferImportFile, setBufferImportFile] = useState<File | null>(null);
  const [bufferImportPreview, setBufferImportPreview] = useState<Array<any>>([]);
  const [bufferImportSheets, setBufferImportSheets] = useState<ParsedExcelSheet[]>([]);
  const [bufferSelectedSheet, setBufferSelectedSheet] = useState<string>("ALL");
  const [bufferImportSortOption, setBufferImportSortOption] = useState<string>("DEFAULT");
  const [isBufferImporting, setIsBufferImporting] = useState(false);
  const bufferBulkFileInputRef = useRef<HTMLInputElement>(null);

  // Sorting pratinjau barang OBS (angka terkecil-terbesar, nama, stok)
  const sortedImportPreview = useMemo(() => {
    if (!importPreview || importPreview.length === 0) return [];
    if (importSortOption === "DEFAULT") return importPreview;

    const copy = [...importPreview];
    copy.sort((a, b) => {
      if (importSortOption === "CODE_ASC") {
        return String(a.code || "").localeCompare(String(b.code || ""), undefined, {
          numeric: true,
        });
      }
      if (importSortOption === "CODE_DESC") {
        return String(b.code || "").localeCompare(String(a.code || ""), undefined, {
          numeric: true,
        });
      }
      if (importSortOption === "STOCK_ASC") {
        return (
          (a.ending_balance ?? a.current_stock ?? 0) - (b.ending_balance ?? b.current_stock ?? 0)
        );
      }
      if (importSortOption === "STOCK_DESC") {
        return (
          (b.ending_balance ?? b.current_stock ?? 0) - (a.ending_balance ?? a.current_stock ?? 0)
        );
      }
      if (importSortOption === "NAME_ASC") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (importSortOption === "NAME_DESC") {
        return String(b.name || "").localeCompare(String(a.name || ""));
      }
      return 0;
    });
    return copy;
  }, [importPreview, importSortOption]);

  // Sorting pratinjau barang Buffer Stok
  const sortedBufferImportPreview = useMemo(() => {
    if (!bufferImportPreview || bufferImportPreview.length === 0) return [];
    if (bufferImportSortOption === "DEFAULT") return bufferImportPreview;

    const copy = [...bufferImportPreview];
    copy.sort((a, b) => {
      if (bufferImportSortOption === "CODE_ASC") {
        return String(a.code || "").localeCompare(String(b.code || ""), undefined, {
          numeric: true,
        });
      }
      if (bufferImportSortOption === "CODE_DESC") {
        return String(b.code || "").localeCompare(String(a.code || ""), undefined, {
          numeric: true,
        });
      }
      if (bufferImportSortOption === "STOCK_ASC") {
        return (a.current_stock ?? 0) - (b.current_stock ?? 0);
      }
      if (bufferImportSortOption === "STOCK_DESC") {
        return (b.current_stock ?? 0) - (a.current_stock ?? 0);
      }
      if (bufferImportSortOption === "NAME_ASC") {
        return String(a.name || "").localeCompare(String(b.name || ""));
      }
      if (bufferImportSortOption === "NAME_DESC") {
        return String(b.name || "").localeCompare(String(a.name || ""));
      }
      return 0;
    });
    return copy;
  }, [bufferImportPreview, bufferImportSortOption]);

  // Helper membaca file Excel (.xlsx / .xls) dan CSV dengan dukungan Multi-Sheet
  const handleBulkFileSelect = (file: File) => {
    setImportFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) return;

        const workbook = XLSX.read(buffer, { type: "array" });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          toast.error("File tidak memiliki lembar kerja (sheet)");
          return;
        }

        const sheets = parseExcelWorkbookToSheets(workbook, "Sparepart & Tools");

        if (sheets.length === 0) {
          toast.error("Tidak ada baris data barang yang valid ditemukan dalam file");
          setImportSheets([]);
          setImportPreview([]);
          return;
        }

        setImportSheets(sheets);

        const deduplicateParsedItems = (items: any[]) => {
          const seen = new Set<string>();
          const result: any[] = [];
          for (const it of items) {
            const nName = String(it.name || "")
              .replace(/\u00a0/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            const nCode = String(it.code || "")
              .replace(/\u00a0/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            const key = nName ? `n_${nName}` : nCode ? `c_${nCode}` : "";
            if (!key || !seen.has(key)) {
              if (key) seen.add(key);
              result.push(it);
            }
          }
          return result;
        };

        const firstSheet = sheets[0];
        if (sheets.length === 1 && firstSheet) {
          const uniqueFirstSheetItems = deduplicateParsedItems(firstSheet.items);
          setSelectedSheet(firstSheet.name);
          setImportPreview(uniqueFirstSheetItems);
          toast.success(
            `Berhasil membaca ${uniqueFirstSheetItems.length} barang dari sheet "${firstSheet.name}"`,
          );
        } else {
          // Gabungkan semua sheet dengan deduplikasi
          const allItems = sheets.flatMap((s) => s.items);
          const uniqueItems = deduplicateParsedItems(allItems);
          setSelectedSheet("ALL");
          setImportPreview(uniqueItems);
          toast.success(
            `Berhasil membaca ${uniqueItems.length} barang dari ${sheets.length} sheet`,
          );
        }
      } catch (err: any) {
        console.error("Error reading file:", err);
        toast.error("Gagal membaca file: " + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Unduh Template Resmi Excel/CSV Buffer Stok & OBS
  const downloadImportTemplate = () => {
    const templateData = [
      [
        "No",
        "Kode",
        "Material",
        "Satuan",
        "BEGINNING BALANCE",
        "RECEIPT",
        "ISSUED",
        "ENDING BALANCE",
        "Maks. Stock",
      ],
      [1, "7100110213", "BEARING 32004", "PCS", 10, 0, 0, 10, 50],
      [2, "7100110339", "BEARING 6001 2Z", "PCS", 40, 26, 7, 59, 100],
      [3, "7100110345", "BEARING 6003 2Z", "PCS", 40, 31, 23, 48, 80],
      [4, "7100110347", "BEARING 6004 2Z", "PCS", 60, 18, 32, 46, 75],
      [5, "7100110351", "BEARING 6005 2Z", "PCS", 50, 3, 1, 52, 90],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 34 },
      { wch: 10 },
      { wch: 20 },
      { wch: 14 },
      { wch: 14 },
      { wch: 20 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Master OBS");

    XLSX.writeFile(workbook, "template_import_barang_obs.xlsx");
    toast.success("Template Excel OBS berhasil diunduh");
  };

  // ── IMPORT FILE BUFFER STOK (EXCEL / CSV) ─────────────────────────────────────
  const handleBufferBulkFileSelect = (file: File) => {
    setBufferImportFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) return;

        const workbook = XLSX.read(buffer, { type: "array" });
        if (!workbook.SheetNames || workbook.SheetNames.length === 0) {
          toast.error("File tidak memiliki lembar kerja (sheet)");
          return;
        }

        const sheets = parseExcelWorkbookToSheets(workbook, "Buffer Stok");

        if (sheets.length === 0) {
          toast.error("Tidak ada baris data barang buffer yang valid ditemukan dalam file");
          setBufferImportSheets([]);
          setBufferImportPreview([]);
          return;
        }

        setBufferImportSheets(sheets);

        const deduplicateParsedBufItems = (items: any[]) => {
          const seen = new Set<string>();
          const result: any[] = [];
          for (const it of items) {
            const nName = String(it.name || "")
              .replace(/\u00a0/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            const nCode = String(it.code || "")
              .replace(/\u00a0/g, " ")
              .replace(/\s+/g, " ")
              .trim()
              .toLowerCase();
            const key = nName ? `n_${nName}` : nCode ? `c_${nCode}` : "";
            if (!key || !seen.has(key)) {
              if (key) seen.add(key);
              result.push(it);
            }
          }
          return result;
        };

        const firstBufSheet = sheets[0];
        if (sheets.length === 1 && firstBufSheet) {
          const uniqueFirstBufItems = deduplicateParsedBufItems(firstBufSheet.items);
          setBufferSelectedSheet(firstBufSheet.name);
          setBufferImportPreview(uniqueFirstBufItems);
          toast.success(
            `Berhasil membaca ${uniqueFirstBufItems.length} barang buffer dari sheet "${firstBufSheet.name}"`,
          );
        } else {
          const allItems = sheets.flatMap((s) => s.items);
          const uniqueItems = deduplicateParsedBufItems(allItems);
          setBufferSelectedSheet("ALL");
          setBufferImportPreview(uniqueItems);
          toast.success(
            `Berhasil membaca ${uniqueItems.length} barang buffer dari ${sheets.length} sheet`,
          );
        }
      } catch (err: any) {
        console.error("Error reading buffer file:", err);
        toast.error("Gagal membaca file: " + err.message);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Unduh Template Excel/CSV khusus Buffer Stok
  const downloadBufferImportTemplate = () => {
    const templateData = [
      [
        "No",
        "Kode",
        "Material",
        "Batas Minimal Stok",
        "Minimal Stok",
        "Maks. Stok",
        "Stok Saat Ini",
      ],
      [1, "BUF-001", "BEARING 6204-2RS", 1, 10, 50, 0],
      [2, "BUF-002", "HEATER ELEMENT 2000W", 1, 5, 20, 0],
      [3, "BUF-003", "V-BELT A-52", 2, 8, 30, 0],
    ];

    const worksheet = XLSX.utils.aoa_to_sheet(templateData);
    worksheet["!cols"] = [
      { wch: 6 },
      { wch: 18 },
      { wch: 32 },
      { wch: 16 },
      { wch: 12 },
      { wch: 18 },
      { wch: 14 },
      { wch: 14 },
      { wch: 14 },
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Buffer Stok");

    XLSX.writeFile(workbook, "template_import_buffer_stok.xlsx");
    toast.success("Template Buffer Stok berhasil diunduh");
  };

  // Eksekusi Import Batch Data Buffer Stok (Smart Upsert Batch)
  const executeBufferBulkImport = async () => {
    if (bufferImportPreview.length === 0) {
      toast.error("Tidak ada data barang buffer yang akan diimport");
      return;
    }
    setIsBufferImporting(true);
    try {
      const { data: existingItems, error: fetchErr } = await (supabase as any)
        .from("buffer_stock")
        .select(
          "id, name, code, unit, location, shelf, min_stock, safe_stock, max_stock, current_stock",
        );

      if (fetchErr) {
        console.warn("Could not fetch existing buffer items:", fetchErr.message);
      }

      const normStr = (s: any) =>
        String(s || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const existingByName = new Map<string, any>();
      const existingByCode = new Map<string, any>();

      (existingItems || []).forEach((p: any) => {
        const nName = normStr(p.name);
        const nCode = normStr(p.code);
        if (nName) existingByName.set(nName, p);
        if (nCode) existingByCode.set(nCode, p);
      });

      const toUpdate: any[] = [];
      const toInsert: any[] = [];
      const seenNamesInBatch = new Set<string>();
      const seenCodesInBatch = new Set<string>();

      for (const item of bufferImportPreview) {
        const cleanName = String(item.name || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const cleanCode = item.code
          ? String(item.code)
              .replace(/\u00a0/g, " ")
              .replace(/\s+/g, " ")
              .trim()
          : null;

        if (!cleanName && !cleanCode) continue;

        const finalName = cleanName || (cleanCode ? `Item ${cleanCode}` : "Unnamed Item");
        const normName = normStr(finalName);
        const normCode = cleanCode ? normStr(cleanCode) : "";

        // Cegah duplikasi di dalam batch
        if (normName && seenNamesInBatch.has(normName)) continue;
        if (normCode && seenCodesInBatch.has(normCode)) continue;

        if (normName) seenNamesInBatch.add(normName);
        if (normCode) seenCodesInBatch.add(normCode);

        // Cocokkan data di database: cek nama atau kode
        const found =
          (normName ? existingByName.get(normName) : null) ||
          (normCode ? existingByCode.get(normCode) : null);

        if (found) {
          toUpdate.push({
            id: found.id,
            name: found.name || finalName,
            code: cleanCode || found.code || null,
            unit: item.unit || found.unit || "pcs",
            location: item.location || found.location || "Gudang Utama",
            shelf: item.shelf || found.shelf || "Rak A-1",
            current_stock: item.current_stock ?? found.current_stock ?? 0,
            safe_stock: item.safe_stock ?? found.safe_stock ?? 1,
            min_stock: item.min_stock ?? found.min_stock ?? 10,
            max_stock: item.max_stock ?? found.max_stock ?? null,
            is_active: true,
          });
        } else {
          toInsert.push({
            name: finalName,
            code: cleanCode || null,
            unit: item.unit || "pcs",
            location: item.location || "Gudang Utama",
            shelf: item.shelf || "Rak A-1",
            current_stock: item.current_stock ?? 0,
            safe_stock: item.safe_stock ?? 1,
            min_stock: item.min_stock ?? 10,
            max_stock: item.max_stock ?? null,
            is_active: true,
          });
        }
      }

      const CHUNK_SIZE = 100;
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
        const { error: updErr } = await (supabase as any)
          .from("buffer_stock")
          .upsert(chunk, { onConflict: "id" });
        if (updErr) {
          console.warn("Buffer batch upsert on ID fallback due to:", updErr.message);
          for (const it of chunk) {
            const { error: singleErr } = await (supabase as any)
              .from("buffer_stock")
              .upsert(it, { onConflict: "id" });
            if (singleErr) {
              console.error("Failed to upsert buffer item:", it.name, singleErr.message);
            }
          }
        }
      }

      for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
        const chunk = toInsert.slice(i, i + CHUNK_SIZE);
        const { error: insErr } = await (supabase as any)
          .from("buffer_stock")
          .upsert(chunk, { onConflict: "name" });
        if (insErr) {
          console.warn("Buffer batch upsert fallback due to:", insErr.message);
          for (const it of chunk) {
            const { error: singleErr } = await (supabase as any)
              .from("buffer_stock")
              .upsert(it, { onConflict: "name" });
            if (singleErr) {
              console.error("Failed to upsert buffer item:", it.name, singleErr.message);
            }
          }
        }
      }

      const totalCount = toInsert.length + toUpdate.length;
      if (typeof recordActivity === "function") {
        await recordActivity(
          "IMPORT_BUFFER",
          `Mengimport ${toInsert.length} buffer baru & memperbarui ${toUpdate.length} buffer via Excel/CSV`,
        );
      }
      toast.success(
        `Berhasil mengimport ${totalCount} data buffer stok (${toInsert.length} baru, ${toUpdate.length} diperbarui)!`,
      );
      queryClient.invalidateQueries({ queryKey: ["buffer_stock"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
      setBufferImportPreview([]);
      setBufferImportFile(null);
      setBufferImportSheets([]);
      setBufferSelectedSheet("ALL");
      setBufferImportSortOption("DEFAULT");
      setIsBufferAddOpen(false);
    } catch (err: any) {
      console.error("Buffer bulk import error:", err);
      toast.error("Gagal mengimport data buffer: " + err.message);
    } finally {
      setIsBufferImporting(false);
    }
  };

  // Eksekusi Import Batch Data Barang OBS Sparepart (Smart Upsert Batch)
  const executeBulkImport = async () => {
    if (importPreview.length === 0) {
      toast.error("Tidak ada data barang yang akan diimport");
      return;
    }
    setIsImporting(true);
    try {
      const { data: existingProducts, error: fetchErr } = await supabase
        .from("products")
        .select(
          "id, name, code, category, unit, location, shelf, min_stock, safe_stock, max_stock, current_stock",
        )
        .range(0, 4999);

      if (fetchErr) {
        console.warn("Could not fetch existing products:", fetchErr.message);
      }

      const normStr = (s: any) =>
        String(s || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim()
          .toLowerCase();

      const existingByName = new Map<string, any>();
      const existingByCode = new Map<string, any>();

      (existingProducts || []).forEach((p: any) => {
        const nName = normStr(p.name);
        const nCode = normStr(p.code);
        if (nName) existingByName.set(nName, p);
        if (nCode) existingByCode.set(nCode, p);
      });

      const toUpdate: any[] = [];
      const toInsert: any[] = [];
      const seenNamesInBatch = new Set<string>();
      const seenCodesInBatch = new Set<string>();

      for (const item of importPreview) {
        const cleanName = String(item.name || "")
          .replace(/\u00a0/g, " ")
          .replace(/\s+/g, " ")
          .trim();
        const cleanCode = item.code
          ? String(item.code)
              .replace(/\u00a0/g, " ")
              .replace(/\s+/g, " ")
              .trim()
          : null;

        if (!cleanName && !cleanCode) continue;

        const finalName = cleanName || (cleanCode ? `Item ${cleanCode}` : "Unnamed Item");
        const normName = normStr(finalName);
        const normCode = cleanCode ? normStr(cleanCode) : "";

        // Cegah duplikasi di dalam batch (hindari error PostgreSQL: cannot affect row a second time)
        if (normName && seenNamesInBatch.has(normName)) continue;
        if (normCode && seenCodesInBatch.has(normCode)) continue;

        if (normName) seenNamesInBatch.add(normName);
        if (normCode) seenCodesInBatch.add(normCode);

        // Cari di database: cek nama terlebih dahulu (karena unique constraint ada pada name), lalu cek code
        const found =
          (normName ? existingByName.get(normName) : null) ||
          (normCode ? existingByCode.get(normCode) : null);

        const hasEndingInFile = item.ending_balance !== null && item.ending_balance !== undefined;
        const hasMaxInFile = item.max_stock !== null && item.max_stock !== undefined;
        const hasMinInFile = item.min_stock !== null && item.min_stock !== undefined;

        if (found) {
          // Data master barang: sertakan nama agar memenuhi NOT NULL constraint PostgreSQL saat upsert
          toUpdate.push({
            id: found.id,
            name: found.name || finalName,
            code: cleanCode || found.code || null,
            category: found.category || item.category || "Sparepart & Tools",
            unit: item.unit || found.unit || "pcs",
            location: item.location || found.location || "Gudang Utama",
            shelf: item.shelf || found.shelf || "Rak A-1",
            // Jika file memuat ending balance, perbarui stok. Jika file HANYA update maks stock/master, pertahankan stok yang ada di database
            current_stock: hasEndingInFile
              ? Number(item.ending_balance)
              : (found.current_stock ?? 0),
            safe_stock: found.safe_stock ?? 1,
            // Rekam kolom minimal stock jika ada di file
            min_stock: hasMinInFile ? Number(item.min_stock) : (found.min_stock ?? 10),
            // Rekam kolom maksimal stock jika ada di file, jika tidak pertahankan dari database
            max_stock: hasMaxInFile ? Number(item.max_stock) : (found.max_stock ?? null),
            is_active: true,
          });
        } else {
          toInsert.push({
            name: finalName,
            code: cleanCode || null,
            category: item.category || "Sparepart & Tools",
            unit: item.unit || "pcs",
            location: item.location || "Gudang Utama",
            shelf: item.shelf || "Rak A-1",
            current_stock: hasEndingInFile ? Number(item.ending_balance) : 0,
            safe_stock: 1,
            // Rekam minimal stock jika ada di file
            min_stock: hasMinInFile ? Number(item.min_stock) : 10,
            // Rekam maksimal stock jika ada di file
            max_stock: hasMaxInFile ? Number(item.max_stock) : null,
            is_active: true,
          });
        }
      }

      const CHUNK_SIZE = 100;
      // 1. Eksekusi update untuk barang yang sudah ada berdasarkan ID
      for (let i = 0; i < toUpdate.length; i += CHUNK_SIZE) {
        const chunk = toUpdate.slice(i, i + CHUNK_SIZE);
        const { error: updErr } = await supabase
          .from("products")
          .upsert(chunk as any, { onConflict: "id" });
        if (updErr) {
          console.warn("Products batch upsert on ID fallback due to:", updErr.message);
          for (const it of chunk) {
            const { error: singleErr } = await supabase
              .from("products")
              .upsert(it as any, { onConflict: "id" });
            if (singleErr) {
              console.error("Failed to upsert existing product item:", it.name, singleErr.message);
            }
          }
        }
      }

      // 2. Eksekusi insert/upsert untuk barang baru dengan onConflict "name"
      // Ini mencegah crash "duplicate key value violates unique constraint products_name_key"
      for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
        const chunk = toInsert.slice(i, i + CHUNK_SIZE);
        const { error: insErr } = await supabase
          .from("products")
          .upsert(chunk as any, { onConflict: "name" });
        if (insErr) {
          console.warn("Products batch upsert on name fallback due to:", insErr.message);
          for (const it of chunk) {
            const { error: singleErr } = await supabase
              .from("products")
              .upsert(it as any, { onConflict: "name" });
            if (singleErr) {
              console.error("Failed to upsert product item:", it.name, singleErr.message);
            }
          }
        }
      }

      const totalCount = toInsert.length + toUpdate.length;
      if (typeof recordActivity === "function") {
        await recordActivity(
          "IMPORT_BARANG",
          `Mengimport ${toInsert.length} barang baru & memperbarui ${toUpdate.length} stok via Excel/CSV`,
        );
      }
      toast.success(
        `Berhasil mengimport ${totalCount} data barang (${toInsert.length} baru, ${toUpdate.length} diperbarui)!`,
      );
      queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
      setImportPreview([]);
      setImportFile(null);
      setImportSheets([]);
      setSelectedSheet("ALL");
      setImportSortOption("DEFAULT");
      setIsAddOpen(false);
    } catch (err: any) {
      console.error("Bulk import error:", err);
      toast.error("Gagal mengimport data: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

  const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "Sparepart & Tools",
    unit: "Roll",
    location: "Gudang Utama",
    shelf: "Rak A-1",
    qty_in: "0",
    qty_out: "0",
    min_stock: "10",
    safe_stock: "1",
    max_stock: "",
    current_stock: "0",
    description: "",
    image_url: "",
    doc_url: "",
  });

  // State Modal Edit Barang
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);

  // State Modal Detail Barang
  const [selectedProduct, setSelectedProduct] = useState<ProductItem | null>(null);

  // State Modal Hapus Barang
  const [deletingItem, setDeletingItem] = useState<ProductItem | null>(null);

  // State Modal Transaksi Masuk/Keluar
  const [isTxOpen, setIsTxOpen] = useState(false);
  const [txType, setTxType] = useState<"IN" | "OUT">("IN");

  // Auto-open modal jika diarahkan dari dashboard dengan search parameter
  useEffect(() => {
    if (search.action === "tx" && (search.type === "IN" || search.type === "OUT")) {
      setTxType(search.type);
      setIsTxOpen(true);
    }
    if (search.tab) {
      // buffer_stock sekarang adalah tab tersendiri, tidak perlu redirect ke "items"
      setActiveTab(search.tab);
    }
  }, [search.action, search.type, search.tab]);
  const [txItems, setTxItems] = useState<
    Array<{ productId: string; quantity: string; unit: string }>
  >([{ productId: "", quantity: "1", unit: "kg" }]);
  const [txHeader, setTxHeader] = useState({
    batchNumber: new Date().toISOString().split("T")[0],
    referenceNo: "",
    supplierOrDest: "",
    notes: "",
    docUrl: "",
  });
  const [selectedTx, setSelectedTx] = useState<GroupedTransaction | null>(null);

  // State Filter Tab Mutasi (In/Out & Tanggal)
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const [txFilterType, setTxFilterType] = useState<"ALL" | "IN" | "OUT">("ALL");
  const [txDateFilter, setTxDateFilter] = useState<string>("");

  // Upload file refs
  const [isUploading, setIsUploading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const txDocInputRef = useRef<HTMLInputElement>(null);

  // ── QUERY DATA BARANG ──────────────────────────────────────────────────────────
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["warehouse_products"],
    queryFn: async () => {
      const { data, error } = await supabase.from("products").select("*").order("name");
      if (error) throw error;
      return (data ?? []) as ProductItem[];
    },
  });

  // ── QUERY DATA KATEGORI ────────────────────────────────────────────────────────
  const { data: categories = [] } = useQuery({
    queryKey: ["warehouse_categories"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("warehouse_categories")
        .select("*")
        .eq("name", "Sparepart & Tools")
        .order("name");
      if (error || !data || data.length === 0) {
        return [{ id: "5", name: "Sparepart & Tools" }];
      }
      return data ?? [];
    },
  });

  // ── QUERY DATA SATUAN ─────────────────────────────────────────────────────────
  const { data: units = [] } = useQuery({
    queryKey: ["warehouse_units"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("warehouse_units")
        .select("*")
        .order("code");
      if (error) {
        return [
          { id: "1", code: "ROLL", name: "ROLL" },
          { id: "2", code: "LMBR", name: "LEMBAR" },
          { id: "3", code: "CAN", name: "CAN" },
          { id: "4", code: "PCS", name: "Pieces" },
        ];
      }
      return data ?? [];
    },
  });

  // ── QUERY DATA TRANSAKSI MUTASI ───────────────────────────────────────────────
  const { data: transactions = [], isLoading: loadingTx } = useQuery({
    queryKey: ["warehouse_transactions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("warehouse_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as WarehouseTransaction[];
    },
  });

  // ── QUERY ACTIVITY LOG ─────────────────────────────────────────────────────────
  const { data: activityLogs = [], isLoading: loadingLogs } = useQuery({
    queryKey: ["warehouse_activity_logs"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("warehouse_activity_logs")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(50);
      if (error) return [];
      return (data ?? []) as ActivityLog[];
    },
  });

  // ── QUERY DATA BUFFER STOK (TABEL SENDIRI, INDEPENDEN) ────────────────────────
  const { data: bufferItems = [], isLoading: loadingBuffer } = useQuery({
    queryKey: ["buffer_stock"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("buffer_stock")
        .select("*")
        .order("name");
      if (error) {
        // Jika tabel belum ada, kembalikan array kosong tanpa error
        if (error.message?.includes("does not exist") || error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as BufferStockItem[];
    },
  });

  // ── MUTATION: TAMBAH BUFFER STOK ─────────────────────────────────────────────
  const addBufferItem = useMutation({
    mutationFn: async () => {
      if (!bufferFormData.name.trim()) throw new Error("Nama barang wajib diisi");
      const { error } = await (supabase as any).from("buffer_stock").insert({
        name: bufferFormData.name.trim(),
        code: bufferFormData.code.trim() || null,
        unit: bufferFormData.unit,
        location: bufferFormData.location,
        shelf: bufferFormData.shelf,
        min_stock: Number(bufferFormData.min_stock) || 10,
        safe_stock: Number(bufferFormData.safe_stock) || 1,
        max_stock: bufferFormData.max_stock ? Number(bufferFormData.max_stock) : null,
        current_stock: Number(bufferFormData.current_stock) || 0,
        description: bufferFormData.description.trim() || null,
        is_active: true,
      });
      if (error) throw error;
      await recordActivity(
        "TAMBAH_BUFFER",
        `Menambahkan buffer stok baru: "${bufferFormData.name.trim()}"`,
      );
    },
    onSuccess: () => {
      toast.success("Barang buffer stok berhasil ditambahkan");
      setIsBufferAddOpen(false);
      setBufferFormData({
        name: "",
        code: "",
        unit: "Roll",
        location: "Gudang Utama",
        shelf: "Rak A-1",
        qty_in: "0",
        qty_out: "0",
        min_stock: "10",
        safe_stock: "1",
        max_stock: "",
        current_stock: "0",
        description: "",
      });
      queryClient.invalidateQueries({ queryKey: ["buffer_stock"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
    },
    onError: (e: Error) => toast.error("Gagal menambah buffer stok", { description: e.message }),
  });

  // ── MUTATION: EDIT BUFFER STOK ────────────────────────────────────────────────
  const updateBufferItem = useMutation({
    mutationFn: async () => {
      if (!editingBufferItem) return;
      if (!editingBufferItem.name.trim()) throw new Error("Nama barang wajib diisi");
      const { error } = await (supabase as any)
        .from("buffer_stock")
        .update({
          name: editingBufferItem.name.trim(),
          code: editingBufferItem.code?.trim() || null,
          unit: editingBufferItem.unit,
          location: editingBufferItem.location,
          shelf: editingBufferItem.shelf,
          min_stock: Number(editingBufferItem.min_stock) || 10,
          safe_stock: Number(editingBufferItem.safe_stock) || 1,
          max_stock: editingBufferItem.max_stock ? Number(editingBufferItem.max_stock) : null,
          current_stock: Number(editingBufferItem.current_stock) || 0,
          description: editingBufferItem.description?.trim() || null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", editingBufferItem.id);
      if (error) throw error;
      await recordActivity("EDIT_BUFFER", `Memperbarui buffer stok: "${editingBufferItem.name}"`);
    },
    onSuccess: () => {
      toast.success("Buffer stok berhasil diperbarui");
      setEditingBufferItem(null);
      queryClient.invalidateQueries({ queryKey: ["buffer_stock"] });
    },
    onError: (e: Error) => toast.error("Gagal mengubah buffer stok", { description: e.message }),
  });

  // ── MUTATION: HAPUS BUFFER STOK ───────────────────────────────────────────────
  const deleteBufferItem = useMutation({
    mutationFn: async (item: BufferStockItem) => {
      const { error } = await (supabase as any).from("buffer_stock").delete().eq("id", item.id);
      if (error) throw error;
      await recordActivity("HAPUS_BUFFER", `Menghapus buffer stok: "${item.name}"`);
    },
    onSuccess: () => {
      toast.success("Buffer stok berhasil dihapus");
      setDeletingBufferItem(null);
      queryClient.invalidateQueries({ queryKey: ["buffer_stock"] });
    },
    onError: (e: Error) => toast.error("Gagal menghapus buffer stok", { description: e.message }),
  });

  // ── HELPER UPLOAD KE SUPABASE STORAGE ──────────────────────────────────────────
  async function handleFileUpload(file: File, folder: string = "items") {
    setIsUploading(true);
    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `${folder}/${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
      const { data, error } = await supabase.storage
        .from("warehouse-docs")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (error) {
        toast.error("Upload storage: pastikan bucket 'warehouse-docs' telah dibuat", {
          description: error.message,
        });
        return null;
      }

      const { data: publicUrlData } = supabase.storage
        .from("warehouse-docs")
        .getPublicUrl(data.path);

      toast.success("File berhasil diupload ke Supabase Storage");
      return publicUrlData.publicUrl;
    } catch (err: any) {
      toast.error("Gagal mengunggah file: " + err.message);
      return null;
    } finally {
      setIsUploading(false);
    }
  }

  // ── HELPER: FORMAT NAMA PETUGAS SHIFT ─────────────────────────────────────────
  const getShiftOfficer = (dateInput?: string | Date, rawOfficerName?: string | null) => {
    if (rawOfficerName && rawOfficerName.toLowerCase().includes("shift")) {
      return rawOfficerName;
    }
    const d = dateInput ? new Date(dateInput) : new Date();
    const h = d.getHours();
    let shiftName = "Shift 1";
    if (h >= 7 && h < 15) {
      shiftName = "Shift 1";
    } else if (h >= 15 && h < 23) {
      shiftName = "Shift 2";
    } else {
      shiftName = "Shift 3";
    }
    const name = rawOfficerName || profile?.full_name || profile?.email || "Petugas Sparepart";
    return `${shiftName} / ${name}`;
  };

  // ── HELPER MUTATION: CATAT AKTIVITAS ──────────────────────────────────────────
  const recordActivity = async (action: string, description: string, customOfficer?: string) => {
    try {
      const officer = customOfficer?.trim()
        ? (customOfficer.toLowerCase().includes("shift") ? customOfficer : `${getShiftOfficer()} / ${customOfficer}`)
        : getShiftOfficer();

      await (supabase as any).from("warehouse_activity_logs").insert({
        action,
        description,
        user_id: profile?.id,
        user_name: officer,
      });
      queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
    } catch {
      // Abaikan jika tabel log belum dimigrasi
    }
  };

  // ── MUTATION: TAMBAH DATA BARANG ──────────────────────────────────────────────
  const addProduct = useMutation({
    mutationFn: async () => {
      if (!formData.name.trim()) throw new Error("Nama barang wajib diisi");

      const initialStock = Number(formData.current_stock) || 0;

      const { error } = await supabase.from("products").insert({
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        category: formData.category,
        unit: formData.unit,
        location: formData.location,
        shelf: formData.shelf,
        min_stock: Number(formData.min_stock) || 10,
        // Rekam nilai maksimal stok saat penambahan barang jika diisi
        max_stock: formData.max_stock ? Number(formData.max_stock) : null,
        current_stock: initialStock,
        description: formData.description.trim() || null,
        image_url: formData.image_url || null,
        doc_url: formData.doc_url || null,
        is_active: true,
      } as any);

      if (error) throw error;

      await recordActivity(
        "TAMBAH_BARANG",
        `Menambahkan master barang baru: "${formData.name.trim()}" (${formData.category})${initialStock > 0 ? ` — Stok awal: ${initialStock} ${formData.unit}` : ""}`,
      );
    },
    onSuccess: () => {
      toast.success("Barang baru berhasil ditambahkan");
      setIsAddOpen(false);
      setFormData({
        name: "",
        code: "",
        category: "Sparepart & Tools",
        unit: "Roll",
        location: "Gudang Utama",
        shelf: "Rak A-1",
        qty_in: "0",
        qty_out: "0",
        min_stock: "10",
        safe_stock: "1",
        max_stock: "",
        current_stock: "0",
        description: "",
        image_url: "",
        doc_url: "",
      });
      queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse_transactions"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
    },
    onError: (e: Error) => toast.error("Gagal menambah barang", { description: e.message }),
  });

  // ── MUTATION: EDIT DATA BARANG ─────────────────────────────────────────────────
  const updateProduct = useMutation({
    mutationFn: async () => {
      if (!editingItem) return;
      if (!editingItem.name.trim()) throw new Error("Nama barang wajib diisi");

      const originalProduct = products.find((p) => p.id === editingItem.id);
      const minStockToSave = isAdmin
        ? (Number(editingItem.min_stock) || 10)
        : (originalProduct?.min_stock ?? (Number(editingItem.min_stock) || 10));
      const maxStockToSave = isAdmin
        ? (editingItem.max_stock !== null &&
           editingItem.max_stock !== undefined &&
           (editingItem.max_stock as any) !== ""
            ? Number(editingItem.max_stock)
            : null)
        : (originalProduct?.max_stock ?? null);

      const { error } = await supabase
        .from("products")
        .update({
          name: editingItem.name.trim(),
          code: editingItem.code?.trim() || null,
          category: editingItem.category,
          unit: editingItem.unit,
          location: editingItem.location,
          shelf: editingItem.shelf,
          min_stock: minStockToSave,
          max_stock: maxStockToSave,
          current_stock: Number(editingItem.current_stock) || 0,
          description: editingItem.description?.trim() || null,
          image_url: editingItem.image_url || null,
          doc_url: editingItem.doc_url || null,
        } as any)
        .eq("id", editingItem.id);

      if (error) throw error;

      await recordActivity("EDIT_BARANG", `Memperbarui data barang: "${editingItem.name}"`);
    },
    onSuccess: () => {
      toast.success("Data barang berhasil diperbarui");
      setEditingItem(null);
      queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
    },
    onError: (e: Error) => toast.error("Gagal mengubah data barang", { description: e.message }),
  });

  // ── MUTATION: TOGGLE STATUS AKTIF / NONAKTIF ──────────────────────────────────
  const toggleActive = useMutation({
    mutationFn: async ({
      id,
      is_active,
      name,
    }: {
      id: string;
      is_active: boolean;
      name: string;
    }) => {
      const { error } = await supabase
        .from("products")
        .update({ is_active: !is_active } as any)
        .eq("id", id);
      if (error) throw error;

      await recordActivity(
        "TOGGLE_STATUS",
        `Mengubah status barang "${name}" menjadi ${!is_active ? "Aktif" : "Nonaktif"}`,
      );
    },
    onSuccess: () => {
      toast.success("Status barang berhasil diubah");
      queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
    },
    onError: (e: Error) => toast.error("Gagal mengubah status barang", { description: e.message }),
  });

  // ── MUTATION: HAPUS BARANG ────────────────────────────────────────────────────
  const deleteProduct = useMutation({
    mutationFn: async (item: ProductItem) => {
      const { error } = await supabase.from("products").delete().eq("id", item.id);
      if (error) throw error;

      await recordActivity("HAPUS_BARANG", `Menghapus barang: "${item.name}"`);
    },
    onSuccess: () => {
      toast.success("Data barang berhasil dihapus");
      setDeletingItem(null);
      queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
    },
    onError: (e: Error) => toast.error("Gagal menghapus barang", { description: e.message }),
  });

  // ── CREATE TRANSACTION (MASUK / KELUAR) - MULTI ITEM (S.D 6 BARANG) ─────────────
  const createTransaction = useMutation({
    mutationFn: async () => {
      const validItems = txItems.filter((it) => it.productId.trim() !== "");
      if (validItems.length === 0) {
        throw new Error("Silakan pilih minimal satu barang");
      }

      // Validasi tiap baris
      for (let i = 0; i < validItems.length; i++) {
        const it = validItems[i];
        if (!it) continue;
        const targetProduct = products.find((p) => p.id === it.productId);
        if (!targetProduct) {
          throw new Error(`Barang pada baris ke-${i + 1} tidak ditemukan`);
        }
        const qty = Number(it.quantity);
        if (!qty || qty <= 0) {
          throw new Error(`Jumlah untuk barang "${targetProduct.name}" harus lebih besar dari 0`);
        }
        if (txType === "OUT" && (targetProduct.current_stock ?? 0) < qty) {
          throw new Error(
            `Stok untuk "${targetProduct.name}" tidak mencukupi! Stok saat ini: ${targetProduct.current_stock ?? 0} ${targetProduct.unit || "kg"}`,
          );
        }
      }

      // Ambil start sequence nomor transaksi urut tunggal untuk 1 batch transaksi ini
      let nextSeq = 1;
      try {
        const { data: latestTx, error: countErr } = await (supabase as any)
          .from("warehouse_transactions")
          .select("transaction_number")
          .order("created_at", { ascending: false });

        if (!countErr && latestTx && latestTx.length > 0) {
          // Cari nomor sequence tertinggi yang sudah ada
          const seqs = latestTx
            .map((t: any) => {
              const m = (t.transaction_number || "").match(/TES\s*-\s*GROUND\s*2\s*-\s*(\d+)/i);
              return m ? parseInt(m[1], 10) : 0;
            })
            .filter((n: number) => !isNaN(n));
          if (seqs.length > 0) {
            nextSeq = Math.max(...seqs) + 1;
          } else {
            nextSeq = latestTx.length + 1;
          }
        }
      } catch {
        nextSeq = transactions.length + 1;
      }

      const formattedSeq = String(nextSeq).padStart(2, "0");
      const txNumber = `TES - GROUND 2 - ${formattedSeq}`;
      const recordedNames: string[] = [];

      // Loop simpan transaksi untuk setiap barang dengan NOMOR TRANSAKSI SAMA (1 Bon / Pencatatan)
      for (let i = 0; i < validItems.length; i++) {
        const it = validItems[i];
        if (!it) continue;
        const targetProduct = products.find((p) => p.id === it.productId)!;
        const qty = Number(it.quantity);

        const { error: txErr } = await (supabase as any).from("warehouse_transactions").insert({
          transaction_number: txNumber,
          tx_type: txType,
          product_id: targetProduct.id,
          product_name: targetProduct.name,
          quantity: qty,
          unit: targetProduct.unit || it.unit,
          batch_number: txHeader.batchNumber?.trim() || new Date().toISOString().split("T")[0],
          reference_no: txHeader.referenceNo?.trim() || null,
          supplier_or_dest: txHeader.supplierOrDest?.trim() || null,
          notes: txHeader.notes?.trim() || null,
          document_url: txHeader.docUrl || null,
          created_by: profile?.id,
          created_by_name: profile?.full_name || profile?.email || "Admin Gudang",
        });

        // Fallback update stok manual
        const newStock =
          txType === "IN"
            ? (targetProduct.current_stock ?? 0) + qty
            : Math.max(0, (targetProduct.current_stock ?? 0) - qty);

        await supabase
          .from("products")
          .update({ current_stock: newStock } as any)
          .eq("id", targetProduct.id);

        if (txErr && !txErr.message.includes("does not exist")) {
          throw txErr;
        }

        recordedNames.push(`${qty} ${targetProduct.unit || "kg"} ${targetProduct.name}`);
      }

      await recordActivity(
        txType === "IN" ? "BARANG_MASUK" : "BARANG_KELUAR",
        `Pencatatan ${txType === "IN" ? "Masuk" : "Keluar"} (${validItems.length} barang): ${recordedNames.join(", ")} (${txHeader.supplierOrDest || "-"})`,
        txHeader.notes || undefined,
      );
    },
    onSuccess: () => {
      toast.success(`Berhasil mencatat transaksi barang ${txType === "IN" ? "masuk" : "keluar"}`);
      setIsTxOpen(false);
      setTxItems([{ productId: "", quantity: "1", unit: "PCS" }]);
      setTxHeader({
        batchNumber: new Date().toISOString().split("T")[0],
        referenceNo: "",
        supplierOrDest: "",
        notes: "",
        docUrl: "",
      });
      queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
      queryClient.invalidateQueries({ queryKey: ["warehouse_transactions"] });
    },
    onError: (e: Error) => toast.error("Gagal mencatat transaksi", { description: e.message }),
  });

  // ── MAP TRANSAKSI MASUK & KELUAR TERAKHIR SERTA TOTAL MUTASI PER BARANG ──
  const { latestInTxMap, latestOutTxMap, totalInQtyMap, totalOutQtyMap } = useMemo(() => {
    const inMap: Record<string, WarehouseTransaction> = {};
    const outMap: Record<string, WarehouseTransaction> = {};
    const inQty: Record<string, number> = {};
    const outQty: Record<string, number> = {};

    transactions.forEach((tx) => {
      const qty = Number(tx.quantity) || 0;
      const idKey = tx.product_id;
      const nameKey = tx.product_name ? tx.product_name.trim().toLowerCase() : "";

      if (tx.tx_type === "IN") {
        if (idKey && !inMap[idKey]) inMap[idKey] = tx;
        if (nameKey && !inMap[nameKey]) inMap[nameKey] = tx;
        if (idKey) inQty[idKey] = (inQty[idKey] || 0) + qty;
        if (nameKey) inQty[nameKey] = (inQty[nameKey] || 0) + qty;
      } else if (tx.tx_type === "OUT") {
        if (idKey && !outMap[idKey]) outMap[idKey] = tx;
        if (nameKey && !outMap[nameKey]) outMap[nameKey] = tx;
        if (idKey) outQty[idKey] = (outQty[idKey] || 0) + qty;
        if (nameKey) outQty[nameKey] = (outQty[nameKey] || 0) + qty;
      }
    });

    return {
      latestInTxMap: inMap,
      latestOutTxMap: outMap,
      totalInQtyMap: inQty,
      totalOutQtyMap: outQty,
    };
  }, [transactions]);

  // ── MAP MUTASI HARIAN (DAILY RECEIPT & ISSUED) UNTUK TABEL OBS SPAREPART ──────
  // Kolom Receipt dan Issued harian: jika transaksi sudah beda hari, bernilai 0 sehingga tampil (-)
  const { dailyInQtyMap, dailyOutQtyMap } = useMemo(() => {
    const inQty: Record<string, number> = {};
    const outQty: Record<string, number> = {};

    // Tanggal target: jika filter kalender diisi gunakan itu, jika kosong gunakan tanggal hari ini (daily)
    const today = new Date();
    const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
    const targetDate = productDateFilter || todayStr;

    transactions.forEach((tx) => {
      let txDate = "";
      if (tx.created_at) {
        const d = new Date(tx.created_at);
        if (!isNaN(d.getTime())) {
          txDate = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
        }
      }

      // Cocokkan apakah transaksi terjadi pada target tanggal (hari ini / tanggal terpilih)
      const isTargetDay =
        txDate === targetDate ||
        (tx.batch_number && tx.batch_number.trim() === targetDate);

      // Jika transaksi berasal dari hari lain (sudah beda hari), tidak dimasukkan ke Receipt & Issued harian
      if (!isTargetDay) return;

      const qty = Number(tx.quantity) || 0;
      const idKey = tx.product_id;
      const nameKey = tx.product_name ? tx.product_name.trim().toLowerCase() : "";

      if (tx.tx_type === "IN") {
        if (idKey) inQty[idKey] = (inQty[idKey] || 0) + qty;
        if (nameKey) inQty[nameKey] = (inQty[nameKey] || 0) + qty;
      } else if (tx.tx_type === "OUT") {
        if (idKey) outQty[idKey] = (outQty[idKey] || 0) + qty;
        if (nameKey) outQty[nameKey] = (outQty[nameKey] || 0) + qty;
      }
    });

    return {
      dailyInQtyMap: inQty,
      dailyOutQtyMap: outQty,
    };
  }, [transactions, productDateFilter]);

  // ── GROUPING LOKASI & RAK BERDASARKAN MASTER BARANG & CATATAN MASUK ──────────────
  const shelfLocationGroups = useMemo(() => {
    const map: Record<
      string,
      {
        shelf: string;
        location: string;
        items: ProductItem[];
        totalStock: number;
        latestInbound: WarehouseTransaction | null;
      }
    > = {};

    products.forEach((p) => {
      const shelfName = p.shelf?.trim() || "Belum Ditentukan";
      const locName = p.location?.trim() || "Gudang Utama";
      const groupKey = `${locName}__${shelfName}`;

      if (!map[groupKey]) {
        map[groupKey] = {
          shelf: shelfName,
          location: locName,
          items: [],
          totalStock: 0,
          latestInbound: null,
        };
      }

      map[groupKey].items.push(p);
      map[groupKey].totalStock += Number(p.current_stock) || 0;

      // Cek catatan transaksi masuk terakhir pada barang di rak ini
      const nameKey = p.name ? p.name.trim().toLowerCase() : "";
      const inTx = latestInTxMap[p.id] || (nameKey ? latestInTxMap[nameKey] : null);
      if (inTx) {
        if (
          !map[groupKey].latestInbound ||
          new Date(inTx.created_at) > new Date(map[groupKey].latestInbound!.created_at)
        ) {
          map[groupKey].latestInbound = inTx;
        }
      }
    });

    return Object.values(map).sort((a, b) => a.shelf.localeCompare(b.shelf));
  }, [products, latestInTxMap]);

  // ── EXPORT DATA LAPORAN INVENTARIS & STOK SPAREPART (.XLS EXCEL RESMI) ────────
  const exportToExcel = () => {
    const dataToExport = filteredProducts.length > 0 ? filteredProducts : products;
    if (dataToExport.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const periodStr = productDateFilter || txDateFilter
      ? new Date(productDateFilter || txDateFilter).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : new Date().toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    exportSparepartInventoryExcel({
      products: dataToExport,
      latestInTxMap,
      latestOutTxMap,
      totalInQtyMap: dailyInQtyMap,
      totalOutQtyMap: dailyOutQtyMap,
      generatedByName: profile?.full_name || profile?.email || "Petugas Warehouse Sparepart",
      categoryFilter: "Sparepart & Tools",
      plant: "1201",
      storageLocation: "GDSP",
      materialType: "ERSA",
      period: periodStr,
    });

    toast.success("Laporan inventaris sparepart berhasil diekspor (.xls)");
    recordActivity("EXPORT_DATA", "Mengekspor laporan inventaris & stok sparepart ke Excel");
  };

  // ── EXPORT DATA LAPORAN INVENTARIS SPAREPART RESMI (.CSV) ──────────────────────
  const exportToCSV = () => {
    const dataToExport = filteredProducts.length > 0 ? filteredProducts : products;
    if (dataToExport.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const today = new Date();
    const periodStr = productDateFilter || txDateFilter
      ? new Date(productDateFilter || txDateFilter).toLocaleDateString("id-ID", {
          day: "numeric",
          month: "long",
          year: "numeric",
        })
      : today.toLocaleDateString("id-ID", { month: "long", year: "numeric" });

    let totalBeginningAll = 0;
    let totalReceiptAll = 0;
    let totalIssuedAll = 0;
    let totalEndingStock = 0;

    const rows = dataToExport.map((p, idx) => {
      const minStock = p.min_stock ?? 10;
      const endingStock = p.current_stock ?? 0;
      const rawMax = (p as any).max_stock;
      const maxStock =
        rawMax !== null && rawMax !== undefined && rawMax !== ""
          ? Number(rawMax)
          : null;

      const nameKey = p.name ? p.name.trim().toLowerCase() : "";
      const codeKey = p.code ? p.code.trim().toLowerCase() : "";

      const dailyIn =
        (dailyInQtyMap[p.id] ?? 0) ||
        (nameKey ? (dailyInQtyMap[nameKey] ?? 0) : 0) ||
        (codeKey ? (dailyInQtyMap[codeKey] ?? 0) : 0);

      const dailyOut =
        (dailyOutQtyMap[p.id] ?? 0) ||
        (nameKey ? (dailyOutQtyMap[nameKey] ?? 0) : 0) ||
        (codeKey ? (dailyOutQtyMap[codeKey] ?? 0) : 0);

      const beginningBalance = Math.max(0, endingStock - dailyIn + dailyOut);

      totalBeginningAll += beginningBalance;
      totalReceiptAll += dailyIn;
      totalIssuedAll += dailyOut;
      totalEndingStock += endingStock;

      const statusStr = endingStock <= minStock ? "LIMIT / KRITIS" : "AMAN";
      const maxStockStr = maxStock !== null && !isNaN(maxStock) && maxStock > 0 ? String(maxStock) : "-";

      return [
        String(idx + 1),
        `"${(p.code || "-").replace(/"/g, '""')}"`,
        `"${(p.name || "").replace(/"/g, '""')}"`,
        String(beginningBalance),
        String(minStock),
        dailyIn > 0 ? String(dailyIn) : "-",
        dailyOut > 0 ? String(dailyOut) : "-",
        String(endingStock),
        maxStockStr,
        `"${statusStr}"`,
      ].join(",");
    });

    const metaInfoLines = [
      `"1. PLANT   : 1201"`,
      `"2. S.LOCATION : GDSP"`,
      `"3. MAT.TYPE   : ERSA"`,
      `"4. PERIOD     : ${periodStr}"`,
      "",
    ];

    const headers = [
      "No",
      "Kode",
      "MATERIAL",
      "BEGINNING BALANCE",
      "MIN.STOK",
      "RECEIPT",
      "ISSUED",
      "ENDING BALANCE",
      "MAKS.STOK",
      "STATUS STOCK",
    ].map((h) => `"${h}"`).join(",");

    const signatureLines = [
      "",
      "",
      `"Dibuat oleh User,","","Diperiksa oleh UH/SH,","","","Disetujui oleh Departement Head,","","","",""`,
      "",
      "",
      "",
      `"( ............................................ )","","( ............................................ )","","","( ............................................ )","","","",""`,
    ];

    const csvContent = [
      ...metaInfoLines,
      headers,
      ...rows,
      ...signatureLines,
    ].join("\r\n");

    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const fileDateStr = today.toISOString().split("T")[0];
    const filename = `laporan_stok_sparepart_${fileDateStr}.csv`;
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", filename);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Laporan inventaris sparepart berhasil diekspor (.csv)");
    recordActivity("EXPORT_DATA", "Mengekspor laporan inventaris & stok gudang ke CSV Resmi");
  };

  // ── CETAK / UNDUH PDF KARTU MASTER & STOK BARANG ─────────────────────────────
  const downloadProductPDF = (p: ProductItem | BufferStockItem) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up diblokir browser. Mohon izinkan pop-up untuk mencetak dokumen PDF.");
      return;
    }

    const lastIn = latestInTxMap[p.id];
    const lastInTime = lastIn
      ? formatDate(lastIn.created_at)
      : p.created_at
        ? formatDate(p.created_at)
        : "—";
    const lastOut = latestOutTxMap[p.id];
    const lastOutTime = lastOut ? formatDate(lastOut.created_at) : "—";
    const totalOut = totalOutQtyMap[p.id] ?? 0;
    const isLow = (p.current_stock ?? 0) <= (p.min_stock ?? 10);

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>Kartu Barang - ${p.name} (${p.code || "NO-CODE"})</title>
        <style>
          @page { size: A4 portrait; margin: 20mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .company-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .company-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .doc-badge {
            background-color: #0f172a;
            color: white;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 14px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 20px;
          }
          .meta-item {
            font-size: 12px;
          }
          .meta-label {
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          .meta-value {
            font-weight: 700;
            color: #0f172a;
            margin-top: 2px;
            font-size: 13px;
          }
          .table-box {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .table-box th {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #475569;
          }
          .table-box td {
            border: 1px solid #e2e8f0;
            padding: 10px 12px;
            font-size: 13px;
          }
          .stock-highlight {
            font-size: 16px;
            font-weight: 800;
            font-family: monospace;
            color: ${isLow ? "#e11d48" : "#059669"};
          }
          .status-tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            background-color: ${p.is_active ? "#dcfce7" : "#f1f5f9"};
            color: ${p.is_active ? "#15803d" : "#64748b"};
          }
          .signatures {
            margin-top: 45px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            text-align: center;
          }
          .sig-line {
            border-top: 1px dashed #94a3b8;
            margin-top: 65px;
            padding-top: 6px;
            font-weight: 700;
            font-size: 12px;
          }
          .footer-note {
            margin-top: 35px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 12px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <div class="company-title">GD-SPAREPART M2</div>
            <div class="company-sub">Departement Warehouse - Sparepart Inventory</div>
          </div>
          <div class="doc-badge">KARTU MASTER BARANG</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Kode SKU / Barang</div>
            <div class="meta-value" style="font-family: monospace;">${p.code || "NO-CODE"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Nama Barang / Material</div>
            <div class="meta-value">${p.name}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Kategori</div>
            <div class="meta-value">${p.category || "Sparepart & Tools"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Satuan Ukur</div>
            <div class="meta-value">${p.unit || "pcs"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Lokasi Gudang</div>
            <div class="meta-value">${p.location || "Gudang Utama"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Nomor Rak / Shelf</div>
            <div class="meta-value">${p.shelf || "Rak A-1"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Status Inventaris</div>
            <div class="meta-value">
              <span class="status-tag">${p.is_active ? "Aktif" : "Nonaktif"}</span>
            </div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Tanggal Masuk Barang</div>
            <div class="meta-value">${lastInTime}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Tanggal Keluar Barang</div>
            <div class="meta-value">${lastOutTime}</div>
          </div>
        </div>

        <table class="table-box">
          <thead>
            <tr>
              <th style="width: 35%;">Parameter Stok</th>
              <th style="width: 30%;">Nilai / Kuantitas</th>
              <th style="width: 35%;">Keterangan</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Stok Saat Ini (Current Stock)</strong></td>
              <td>
                <span class="stock-highlight">${(p.current_stock ?? 0).toLocaleString("id-ID")} ${p.unit || "kg"}</span>
              </td>
              <td>${isLow ? '<span style="color: #e11d48; font-weight: 600;">⚠️ Di Bawah Batas Minimum</span>' : '<span style="color: #15803d; font-weight: 600;">✓ Stok Aman</span>'}</td>
            </tr>
            <tr>
              <td><strong>Total Jumlah Pengeluaran</strong></td>
              <td><strong style="color: #e11d48; font-family: monospace;">${totalOut > 0 ? `-${totalOut.toLocaleString("id-ID")}` : "0"} ${p.unit || "kg"}</strong></td>
              <td>Akumulasi pengeluaran barang</td>
            </tr>
            <tr>
              <td><strong>Batas Minimum Stok (Re-order)</strong></td>
              <td><strong>${(p.min_stock ?? 10).toLocaleString("id-ID")} ${p.unit || "kg"}</strong></td>
              <td>Batas pengingat restock barang</td>
            </tr>
            ${
              p.description
                ? `
            <tr>
              <td><strong>Deskripsi / Catatan</strong></td>
              <td colspan="2">${p.description}</td>
            </tr>
            `
                : ""
            }
          </tbody>
        </table>

        <div class="signatures">
          <div>
            <div style="font-size: 11px; color: #64748b;">Dibuat oleh Unit Head,</div>
            <div class="sig-line">( ............................................ )</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #64748b;">Diperiksa oleh Section Head,</div>
            <div class="sig-line">( Section Head )</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #64748b;">Disetujui oleh Departement Head,</div>
            <div class="sig-line">( Departement Head )</div>
          </div>
        </div>

        <div class="footer-note">
          Dokumen resmi hasil cetak sistem manajemen. Dicetak pada: ${new Date().toLocaleString("id-ID")}.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // ── GROUP TRANSAKSI BERDASARKAN NO. TRANSAKSI (1 NOMOR = 1 BON / TRANSAKSI) ──
  type GroupedTransaction = {
    transaction_number: string;
    tx_type: "IN" | "OUT" | "ADJUSTMENT";
    batch_number?: string | null | undefined;
    reference_no?: string | null | undefined;
    supplier_or_dest?: string | null | undefined;
    notes?: string | null | undefined;
    document_url?: string | null | undefined;
    created_by_name?: string | null | undefined;
    created_at: string;
    items: Array<{
      id: string;
      product_id: string;
      product_name: string;
      quantity: number;
      unit: string;
    }>;
  };

  const groupedTransactions: GroupedTransaction[] = transactions.reduce(
    (acc: GroupedTransaction[], tx) => {
      let existing = acc.find((g) => g.transaction_number === tx.transaction_number);
      if (!existing) {
        existing = {
          transaction_number: tx.transaction_number,
          tx_type: tx.tx_type,
          batch_number: tx.batch_number ?? null,
          reference_no: tx.reference_no ?? null,
          supplier_or_dest: tx.supplier_or_dest ?? null,
          notes: tx.notes ?? null,
          document_url: tx.document_url ?? null,
          created_by_name: tx.created_by_name ?? null,
          created_at: tx.created_at,
          items: [],
        };
        acc.push(existing);
      }
      existing.items.push({
        id: tx.id,
        product_id: tx.product_id,
        product_name: tx.product_name,
        quantity: tx.quantity,
        unit: tx.unit,
      });
      return acc;
    },
    [],
  );

  // ── STATISTIK TOTAL MUTASI DAILY (HARI INI) ──────────────────────────────────
  const { dailyInCount, dailyOutCount, dailyTotalCount } = useMemo(() => {
    const today = new Date();
    const todayYear = today.getFullYear();
    const todayMonth = today.getMonth();
    const todayDate = today.getDate();

    let inCount = 0;
    let outCount = 0;

    groupedTransactions.forEach((tx) => {
      const d = new Date(tx.created_at);
      if (
        d.getFullYear() === todayYear &&
        d.getMonth() === todayMonth &&
        d.getDate() === todayDate
      ) {
        if (tx.tx_type === "IN") {
          inCount += 1;
        } else if (tx.tx_type === "OUT") {
          outCount += 1;
        }
      }
    });

    return {
      dailyInCount: inCount,
      dailyOutCount: outCount,
      dailyTotalCount: inCount + outCount,
    };
  }, [groupedTransactions]);

  // ── STATISTIK MUTASI GLOBAL (Berdasarkan filter tanggal atau keseluruhan) ──
  const globalMutasiStats = useMemo(() => {
    let inCount = 0;
    let outCount = 0;
    let totalQtyIn = 0;
    let totalQtyOut = 0;

    groupedTransactions.forEach((tx) => {
      // Jika ada filter tanggal, cocokkan YYYY-MM-DD
      if (txDateFilter) {
        const txDate = new Date(tx.created_at).toISOString().split("T")[0] || "";
        if (txDate !== txDateFilter) return;
      }

      if (tx.tx_type === "IN") {
        inCount += 1;
        tx.items.forEach((it) => {
          totalQtyIn += Number(it.quantity) || 0;
        });
      } else if (tx.tx_type === "OUT") {
        outCount += 1;
        tx.items.forEach((it) => {
          totalQtyOut += Number(it.quantity) || 0;
        });
      }
    });

    return {
      inCount,
      outCount,
      totalCount: inCount + outCount,
      totalQtyIn,
      totalQtyOut,
    };
  }, [groupedTransactions, txDateFilter]);

  // ── FILTERED GROUPED TRANSACTIONS (TAB MUTASI) ───────────────────────────────
  const filteredGroupedTransactions = useMemo(() => {
    return groupedTransactions.filter((tx) => {
      if (txFilterType !== "ALL" && tx.tx_type !== txFilterType) {
        return false;
      }
      if (txDateFilter) {
        const txDate = new Date(tx.created_at).toISOString().split("T")[0] || "";
        if (txDate !== txDateFilter) {
          return false;
        }
      }
      if (!txSearchQuery.trim()) return true;
      const q = txSearchQuery.toLowerCase();
      const matchNo = tx.transaction_number.toLowerCase().includes(q);
      const matchBatch = (tx.batch_number || "").toLowerCase().includes(q);
      const matchRef = (tx.reference_no || "").toLowerCase().includes(q);
      const matchDest = (tx.supplier_or_dest || "").toLowerCase().includes(q);
      const matchPetugas = (tx.created_by_name || "").toLowerCase().includes(q);
      const matchNotes = (tx.notes || "").toLowerCase().includes(q);
      const matchItems = tx.items.some((it) => it.product_name.toLowerCase().includes(q));
      return (
        matchNo || matchBatch || matchRef || matchDest || matchPetugas || matchNotes || matchItems
      );
    });
  }, [groupedTransactions, txFilterType, txDateFilter, txSearchQuery]);

  // ── CETAK & UNDUH PDF BUKTI MUTASI BARANG (1 BON / PENCATATAN TRANSAKSI) ────
  const downloadTransactionPDF = (tx: GroupedTransaction) => {
    const isMasuk = tx.tx_type === "IN";
    const titleType = isMasuk ? "BUKTI PENERIMAAN BARANG" : "BUKTI PENGELUARAN BARANG";
    const colorHeader = isMasuk ? "#059669" : "#e11d48";
    const dateFormatted = formatDate(tx.created_at);

    const receiptDate = tx.batch_number ? formatDate(tx.batch_number) : dateFormatted;

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up diblokir browser. Mohon izinkan pop-up untuk mencetak dokumen PDF.");
      return;
    }

    const itemRowsHtml = tx.items
      .map((it, idx) => {
        const foundProd =
          products.find(
            (p) =>
              p.id === it.product_id ||
              p.name.trim().toLowerCase() === it.product_name.trim().toLowerCase(),
          ) ||
          bufferItems.find(
            (b) =>
              b.id === it.product_id ||
              b.name.trim().toLowerCase() === it.product_name.trim().toLowerCase(),
          );
        const itemCode = (it as any).product_code || foundProd?.code || "—";

        return `
        <tr>
          <td style="text-align: center; color: #64748b; font-size: 11px;">${idx + 1}</td>
          <td style="text-align: center; font-family: monospace; font-size: 12px; font-weight: 600; color: #334155;">
            ${itemCode}
          </td>
          <td>
            <strong style="font-size: 13px; color: #0f172a;">${it.product_name}</strong>
          </td>
          ${
            isMasuk
              ? `<td>
            <div style="font-weight: 600; color: #0f172a; font-family: monospace;">${tx.reference_no || "—"}</div>
          </td>`
              : ""
          }
          <td style="text-align: center;">
            <span style="font-weight: 700; font-size: 11px; color: ${colorHeader};">${isMasuk ? "IN" : "OUT"}</span>
          </td>
          <td style="text-align: right;">
            <span class="qty-highlight">${isMasuk ? "+" : "-"}${it.quantity} ${it.unit}</span>
          </td>
        </tr>
      `;
      })
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>BUKTI TRANSAKSI</title>
        <style>
          @page { size: A4 portrait; margin: 20mm; }
          body {
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 24px;
            font-size: 13px;
            line-height: 1.5;
          }
          .header-box {
            display: flex;
            justify-content: space-between;
            align-items: center;
            border-bottom: 2px solid #e2e8f0;
            padding-bottom: 16px;
            margin-bottom: 20px;
          }
          .company-title {
            font-size: 20px;
            font-weight: 800;
            color: #0f172a;
            letter-spacing: -0.5px;
          }
          .company-sub {
            font-size: 11px;
            color: #64748b;
            margin-top: 2px;
          }
          .doc-badge {
            background-color: ${colorHeader};
            color: white;
            padding: 6px 14px;
            border-radius: 6px;
            font-size: 12px;
            font-weight: 700;
            letter-spacing: 0.5px;
            text-transform: uppercase;
          }
          .meta-grid {
            display: grid;
            grid-template-columns: 1fr 1fr;
            gap: 16px;
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 8px;
            padding: 16px;
            margin-bottom: 24px;
          }
          .meta-item {
            font-size: 12px;
          }
          .meta-label {
            color: #64748b;
            font-size: 11px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
            font-weight: 600;
          }
          .meta-value {
            font-weight: 700;
            color: #0f172a;
            margin-top: 2px;
            font-size: 13px;
          }
          .table-box {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 24px;
          }
          .table-box th {
            background-color: #f1f5f9;
            border: 1px solid #cbd5e1;
            padding: 10px 12px;
            text-align: left;
            font-size: 11px;
            font-weight: 700;
            text-transform: uppercase;
            color: #475569;
          }
          .table-box td {
            border: 1px solid #e2e8f0;
            padding: 10px 12px;
            font-size: 12px;
          }
          .qty-highlight {
            font-size: 14px;
            font-weight: 800;
            color: ${colorHeader};
            font-family: monospace;
          }
          .signatures {
            margin-top: 50px;
            display: grid;
            grid-template-columns: 1fr 1fr 1fr;
            gap: 20px;
            text-align: center;
          }
          .sig-line {
            margin-top: 65px;
            padding-top: 6px;
            font-weight: 700;
            font-size: 12px;
          }
          .footer-note {
            margin-top: 40px;
            text-align: center;
            font-size: 10px;
            color: #94a3b8;
            border-top: 1px solid #f1f5f9;
            padding-top: 12px;
          }
          @media print {
            body { padding: 0; }
          }
        </style>
      </head>
      <body>
        <div class="header-box">
          <div>
            <div class="company-title">GD-SPAREPART M2</div>
            <div class="company-sub">Sistem Manajemen Mutasi Gudang & Inventaris Terintegrasi</div>
          </div>
          <div class="doc-badge">${titleType}</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Tanggal Pencatatan</div>
            <div class="meta-value">${dateFormatted}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">${isMasuk ? "Nama Vendor" : "Alasan Permintaan Barang"}</div>
            <div class="meta-value">${tx.supplier_or_dest || "—"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">PETUGAS SPAREPART SHIFT 1/2/3:</div>
            <div class="meta-value">${tx.notes || "Petugas Sparepart"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">${isMasuk ? "Tanggal Penerimaan" : "Tanggal Pengeluaran"}</div>
            <div class="meta-value">${receiptDate}</div>
          </div>
        </div>

        <div style="font-size: 12px; font-weight: 700; margin-bottom: 8px; color: #334155;">
          DAFTAR BARANG YANG DIMUTASIKAN (${tx.items.length} ITEM):
        </div>

        <table class="table-box">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: ${isMasuk ? "18%" : "20%"}; text-align: center;">Kode Material</th>
              <th style="width: ${isMasuk ? "37%" : "55%"};">Nama Barang</th>
              ${isMasuk ? `<th style="width: 20%;">No. PO</th>` : ""}
              <th style="width: 8%; text-align: center;">Tipe</th>
              <th style="width: 12%; text-align: right;">Qty</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>

        <div class="signatures">
          <div>
            <div style="font-size: 11px; color: #64748b;">Dibuat oleh User,</div>
            <div class="sig-line">( ............................................ )</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #64748b;">Diperiksa oleh UH/SH,</div>
            <div class="sig-line">( ............................................ )</div>
          </div>
          <div>
            <div style="font-size: 11px; color: #64748b;">Disetujui oleh Departement Head,</div>
            <div class="sig-line">( ............................................ )</div>
          </div>
        </div>

        <div class="footer-note">
          Dokumen resmi hasil cetak otomatis dari sistem. Dicetak pada: ${new Date().toLocaleString("id-ID")}.
        </div>

        <script>
          window.onload = function() {
            setTimeout(function() {
              window.print();
            }, 300);
          };
        </script>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(htmlContent);
    printWindow.document.close();
  };

  // Filter & Search Logic with Sorting
  const filteredProducts = useMemo(() => {
    const list = products.filter((p) => {
      const q = searchQuery.toLowerCase().trim();
      const matchSearch =
        !q ||
        p.name.toLowerCase().includes(q) ||
        (p.code && p.code.toLowerCase().includes(q)) ||
        (p.shelf && p.shelf.toLowerCase().includes(q)) ||
        (p.location && p.location.toLowerCase().includes(q));

      const current = p.current_stock ?? 0;
      const minStock = p.min_stock ?? 10;
      const rawMax = (p as any).max_stock;
      const maxStock =
        rawMax !== null && rawMax !== undefined && rawMax !== "" ? Number(rawMax) : null;

      const isOutOfStock = maxStock !== null && !isNaN(maxStock) && current > maxStock;
      const isOrder = current <= minStock;
      const isSafetyStock = !isOutOfStock && !isOrder;

      const matchStock =
        stockStatusFilter === "ALL" ||
        (stockStatusFilter === "ORDER" && isOrder) ||
        (stockStatusFilter === "SAFETY" && isSafetyStock) ||
        (stockStatusFilter === "OUT_OF_STOCK" && isOutOfStock);

      const matchDate =
        !productDateFilter ||
        (() => {
          const pDate = p.created_at ? p.created_at.slice(0, 10) : "";
          const nameKey = p.name ? p.name.trim().toLowerCase() : "";
          const tx = latestInTxMap[p.id] || (nameKey ? latestInTxMap[nameKey] : undefined);
          const txDate = tx?.created_at ? tx.created_at.slice(0, 10) : "";
          return pDate === productDateFilter || txDate === productDateFilter;
        })();

      return matchSearch && matchStock && matchDate;
    });

    // Urutkan list barang
    return list.sort((a, b) => {
      if (sortOption === "RECENT_MUTATION") {
        const nameA = a.name ? a.name.trim().toLowerCase() : "";
        const nameB = b.name ? b.name.trim().toLowerCase() : "";

        // Cari transaksi mutasi masuk terakhir (atau mutasi apapun) untuk barang A dan B
        const txAIn = latestInTxMap[a.id] || (nameA ? latestInTxMap[nameA] : undefined);
        const txBIn = latestInTxMap[b.id] || (nameB ? latestInTxMap[nameB] : undefined);

        const timeA = txAIn
          ? new Date(txAIn.created_at).getTime()
          : a.created_at
            ? new Date(a.created_at).getTime()
            : 0;
        const timeB = txBIn
          ? new Date(txBIn.created_at).getTime()
          : b.created_at
            ? new Date(b.created_at).getTime()
            : 0;

        if (timeA !== timeB) {
          return timeB - timeA; // Waktu penambahan quantity / mutasi terbaru berada paling awal
        }
        return a.name.localeCompare(b.name);
      }

      if (sortOption === "CODE_ASC") {
        return String(a.code || "").localeCompare(String(b.code || ""), undefined, {
          numeric: true,
        });
      }
      if (sortOption === "CODE_DESC") {
        return String(b.code || "").localeCompare(String(a.code || ""), undefined, {
          numeric: true,
        });
      }
      if (sortOption === "NAME_ASC") {
        return a.name.localeCompare(b.name);
      }
      if (sortOption === "NAME_DESC") {
        return b.name.localeCompare(a.name);
      }
      if (sortOption === "STOCK_DESC") {
        return (b.current_stock ?? 0) - (a.current_stock ?? 0);
      }
      if (sortOption === "STOCK_ASC") {
        return (a.current_stock ?? 0) - (b.current_stock ?? 0);
      }
      return 0;
    });
  }, [products, searchQuery, stockStatusFilter, productDateFilter, sortOption, latestInTxMap]);

  // Stats
  const totalStockItems = products.reduce((acc, p) => acc + (p.current_stock ?? 0), 0);
  const lowStockItems = products.filter(
    (p) => (p.current_stock ?? 0) <= (p.min_stock ?? 10) && p.is_active,
  );

  // ── OBS MONITORING CARD STATS ─────────────────────────────────────────────────
  const activeProductsObs = products.filter((p) => p.is_active);
  const totalActiveItemsObs = activeProductsObs.length;
  const totalStockQtyObs = activeProductsObs.reduce((acc, p) => acc + (p.current_stock ?? 0), 0);

  // Classify each item into ORDER / SAFETY / OUT_OF_STOK / ZERO
  const obsOrderItems = activeProductsObs.filter((p) => {
    const current = p.current_stock ?? 0;
    const minStock = p.min_stock ?? 10;
    const rawMax = (p as any).max_stock;
    const maxStock =
      rawMax !== null && rawMax !== undefined && rawMax !== "" ? Number(rawMax) : null;
    const isOutOfStock = maxStock !== null && !isNaN(maxStock) && current > maxStock;
    return !isOutOfStock && current <= minStock;
  });
  const obsSafetyItems = activeProductsObs.filter((p) => {
    const current = p.current_stock ?? 0;
    const minStock = p.min_stock ?? 10;
    const rawMax = (p as any).max_stock;
    const maxStock =
      rawMax !== null && rawMax !== undefined && rawMax !== "" ? Number(rawMax) : null;
    const isOutOfStock = maxStock !== null && !isNaN(maxStock) && current > maxStock;
    return !isOutOfStock && current > minStock;
  });
  const obsOutOfStockItems = activeProductsObs.filter((p) => {
    const current = p.current_stock ?? 0;
    const rawMax = (p as any).max_stock;
    const maxStock =
      rawMax !== null && rawMax !== undefined && rawMax !== "" ? Number(rawMax) : null;
    return maxStock !== null && !isNaN(maxStock) && current > maxStock;
  });
  const obsZeroStockItems = activeProductsObs.filter((p) => (p.current_stock ?? 0) <= 0);

  const obsOrderCount = obsOrderItems.length;
  const obsSafetyCount = obsSafetyItems.length;
  const obsOutOfStockCount = obsOutOfStockItems.length;
  const obsZeroStockCount = obsZeroStockItems.length;

  // Percentages for progress bar
  const obsOrderPct =
    totalActiveItemsObs > 0 ? Math.round((obsOrderCount / totalActiveItemsObs) * 100) : 0;
  const obsSafetyPct =
    totalActiveItemsObs > 0 ? Math.round((obsSafetyCount / totalActiveItemsObs) * 100) : 0;
  const obsOutOfStockPct =
    totalActiveItemsObs > 0 ? Math.max(0, 100 - obsOrderPct - obsSafetyPct) : 0;

  // Map untuk lookup kode produk berdasarkan id atau nama
  const productMap = useMemo(() => {
    const map = new Map<string, ProductItem>();
    products.forEach((p) => {
      if (p.id) map.set(p.id, p);
      if (p.name) map.set(p.name.trim().toLowerCase(), p);
    });
    return map;
  }, [products]);

  return (
    <AppShell
      breadcrumb={
        activeTab === "buffer_stock"
          ? "Buffer Stock"
          : activeTab === "transactions"
            ? "Riwayat Mutasi"
            : activeTab === "logs"
              ? "Aktivitas Seluruh Kegiatan"
              : "Manajemen & Master Barang"
      }
    >
      {/* Header Halaman */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1
            className="text-2xl font-bold tracking-[0.5em] text-black"
            style={{
              fontFamily: "'Montserrat', sans-serif",
              fontWeight: 700,
              letterSpacing: "0.5em",
            }}
          >
            {activeTab === "buffer_stock"
              ? "Buffer Stock"
              : activeTab === "transactions"
                ? "Riwayat Mutasi"
                : activeTab === "logs"
                  ? "Aktivitas Seluruh Kegiatan"
                  : "Manajemen & Master Barang"}
          </h1>
          <p className="mt-1 text-sm text-black/80" style={{ fontFamily: "'Inter', sans-serif" }}>
            {activeTab === "buffer_stock"
              ? "Memantau dan mengelola stok cadangan sparepart untuk menjaga ketersediaan dan mendukung kebutuhan operasional."
              : activeTab === "transactions"
                ? "Mencatat riwayat mutasi masuk dan keluar"
                : activeTab === "logs"
                  ? "Rekap jejak audit dan riwayat seluruh aktivitas operasional gudang."
                  : "Kelola data master barang, pencatatan masuk/keluar, audit stok, kategori, rak, dan dokumen."}
          </p>
        </div>

        <div className="flex items-center gap-2.5 shrink-0">
          {activeTab === "logs" ? null : activeTab === "transactions" || search.tab === "transactions" ? (
            /* Layout Sejajar Horizontal 1 Baris khusus Riwayat Mutasi */
            <div className="flex items-center gap-2">
              {canManageWarehouse && (
                <>
                  <Button
                    size="sm"
                    onClick={() => {
                      setTxType("IN");
                      setIsTxOpen(true);
                    }}
                    className="gap-1.5 bg-emerald-600 font-medium text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all h-8 text-xs px-3"
                  >
                    <ArrowDownLeft className="size-3.5" />
                    Catat Masuk
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => {
                      setTxType("OUT");
                      setIsTxOpen(true);
                    }}
                    className="gap-1.5 bg-rose-600 font-medium text-white shadow-sm hover:bg-rose-700 active:scale-[0.98] transition-all h-8 text-xs px-3"
                  >
                    <ArrowUpRight className="size-3.5" />
                    Catat Keluar
                  </Button>
                </>
              )}

              <Button
                size="sm"
                onClick={exportToExcel}
                className="gap-1.5 bg-slate-900 dark:bg-slate-800 text-white font-medium shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all h-8 text-xs px-3"
                title="Unduh Laporan Stok Sparepart (.xls Excel resmi & tanda tangan)"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-400" />
                Export Laporan
              </Button>
            </div>
          ) : (
            /* Layout 2 Kolom saat tombol Tambah Barang aktif */
            <>
              {/* Kolom 1: Catat Masuk (Atas) & Catat Keluar (Bawah) */}
              <div className="flex flex-col gap-1.5">
                {canManageWarehouse && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setTxType("IN");
                      setIsTxOpen(true);
                    }}
                    className="gap-1.5 bg-emerald-600 font-medium text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all h-8 text-xs px-3 justify-start min-w-[130px]"
                  >
                    <ArrowDownLeft className="size-3.5" />
                    Catat Masuk
                  </Button>
                )}
                {canManageWarehouse && (
                  <Button
                    size="sm"
                    onClick={() => {
                      setTxType("OUT");
                      setIsTxOpen(true);
                    }}
                    className="gap-1.5 bg-rose-600 font-medium text-white shadow-sm hover:bg-rose-700 active:scale-[0.98] transition-all h-8 text-xs px-3 justify-start min-w-[130px]"
                  >
                    <ArrowUpRight className="size-3.5" />
                    Catat Keluar
                  </Button>
                )}
              </div>

              {/* Kolom 2: Tambah Barang (Atas) & Export Laporan (Bawah) */}
              <div className="flex flex-col gap-1.5">
                {canManageWarehouse && (
                  <Button
                    size="sm"
                    onClick={() => {
                      if (activeTab === "buffer_stock") {
                        setBufferFormData({
                          name: "",
                          code: "",
                          unit: "Roll",
                          location: "Gudang Utama",
                          shelf: "Rak A-1",
                          qty_in: "0",
                          qty_out: "0",
                          min_stock: "10",
                          safe_stock: "1",
                          max_stock: "",
                          current_stock: "0",
                          description: "",
                        });
                        setIsBufferAddOpen(true);
                      } else {
                        setFormData((prev) => ({ ...prev, category: "Sparepart & Tools" }));
                        setIsAddOpen(true);
                      }
                    }}
                    className="gap-1.5 bg-white text-slate-900 font-semibold shadow-sm hover:bg-slate-100 active:scale-[0.98] transition-all h-8 text-xs px-3 justify-start min-w-[155px]"
                  >
                    <Plus className="size-3.5 text-slate-900" />
                    {activeTab === "buffer_stock" ? "Tambah Barang Buffer" : "Tambah Barang OBS"}
                  </Button>
                )}

                <Button
                  size="sm"
                  onClick={exportToExcel}
                  className="gap-1.5 bg-slate-900 dark:bg-slate-800 text-white font-medium shadow-sm hover:bg-slate-800 active:scale-[0.98] transition-all h-8 text-xs px-3 justify-start min-w-[155px]"
                  title="Unduh Laporan Stok Sparepart (.xls Excel resmi & tanda tangan)"
                >
                  <FileSpreadsheet className="size-3.5 text-emerald-400" />
                  Export Laporan
                </Button>
              </div>
            </>
          )}
        </div>
      </div>

      {/* Tabs Menu Gudang */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        {/* ── TAB 1: MASTER & STOK BARANG ─────────────────────────────────────── */}
        <TabsContent value="items" className="space-y-4">
          {/* Filter & Search Bar */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-surface border border-border p-3">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama sparepart, kode SKU, atau nomor rak..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="flex items-center gap-1.5">
                <Filter className="size-3.5 text-muted-foreground" />
                <Select value={stockStatusFilter} onValueChange={setStockStatusFilter}>
                  <SelectTrigger className="w-48 h-9 text-xs">
                    <SelectValue placeholder="Kondisi Stok" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">
                      Semua Kondisi
                    </SelectItem>
                    <SelectItem value="ORDER" className="text-xs font-semibold text-rose-600">
                      ⚠ ORDER (≤ Minimal Stok)
                    </SelectItem>
                    <SelectItem value="SAFETY" className="text-xs font-semibold text-emerald-600">
                      ✓ SAFETY STOK (&gt; Minimal Stok)
                    </SelectItem>
                    <SelectItem
                      value="OUT_OF_STOCK"
                      className="text-xs font-semibold text-amber-600"
                    >
                      ⚡ OUT OF STOK (&gt; Maksimal Stok)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Kalender Tanggal Tarik Data */}
              <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-2.5 h-9 text-xs shadow-sm hover:border-primary/50 transition-colors">
                <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={productDateFilter}
                  onChange={(e) => setProductDateFilter(e.target.value)}
                  className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer font-medium"
                  title="Tarik data berdasarkan tanggal kalender"
                />
                {productDateFilter && (
                  <button
                    type="button"
                    onClick={() => setProductDateFilter("")}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors"
                    title="Reset filter tanggal"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Urutan List Barang */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="w-48 h-9 text-xs font-medium">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="RECENT_MUTATION"
                      className="text-xs font-semibold text-primary"
                    >
                      ✦ Baru Ditambah / Mutasi
                    </SelectItem>
                    <SelectItem value="CODE_ASC" className="text-xs">
                      Kode Barang (Angka Terkecil ke Terbesar)
                    </SelectItem>
                    <SelectItem value="CODE_DESC" className="text-xs">
                      Kode Barang (Angka Terbesar ke Terkecil)
                    </SelectItem>
                    <SelectItem value="NAME_ASC" className="text-xs">
                      Nama Barang (A - Z)
                    </SelectItem>
                    <SelectItem value="NAME_DESC" className="text-xs">
                      Nama Barang (Z - A)
                    </SelectItem>
                    <SelectItem value="STOCK_DESC" className="text-xs">
                      Stok Terbanyak
                    </SelectItem>
                    <SelectItem value="STOCK_ASC" className="text-xs">
                      Stok Paling Sedikit
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── MONITORING INFO CARDS OBS SPAREPART ────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
            {/* Card 1: Total Item OBS */}
            <div className="rise-in group relative overflow-hidden rounded-lg border border-blue-500 bg-blue-600 p-4 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg cursor-pointer active:scale-[0.99]">
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center size-8 rounded-md bg-blue-500 text-white border border-blue-400">
                  <Boxes className="size-4" />
                </div>

                <span className="label-caps !text-white">Total Item</span>
              </div>

              <div className="font-mono text-2xl font-bold tabular-nums text-white">
                {loadingProducts ? "—" : totalActiveItemsObs}
              </div>

              <div className="mt-1 text-[10px] text-white">Barang aktif terdaftar</div>
            </div>

            {/* Card 2: Total Stok Qty */}
            <div
              className="rise-in group relative overflow-hidden rounded-lg border p-4 text-white shadow-md transition-all hover:shadow-lg cursor-pointer active:scale-[0.99]"
              style={{
                animationDelay: "50ms",
                backgroundColor: "#0092B8",
                borderColor: "#0083A6",
              }}
            >
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="flex items-center justify-center size-8 rounded-md text-white border"
                  style={{
                    backgroundColor: "#00ACCF",
                    borderColor: "#00A0C2",
                  }}
                >
                  <Package className="size-4" />
                </div>

                <span className="label-caps !text-white">Total Stok</span>
              </div>

              <div className="font-mono text-2xl font-bold tabular-nums text-white">
                {loadingProducts ? "—" : totalStockQtyObs.toLocaleString("id-ID")}
              </div>

              <div className="mt-1 text-[10px] text-white">Jumlah seluruh pcs/unit</div>
            </div>

            {/* Card 3: ORDER — Perlu Restock */}
            <div
              className="rise-in group relative overflow-hidden rounded-lg border border-red-500 bg-red-600 p-4 text-white shadow-md transition-all hover:bg-red-700 hover:shadow-lg cursor-pointer active:scale-[0.99]"
              style={{ animationDelay: "100ms" }}
              onClick={() => setStockStatusFilter(stockStatusFilter === "ORDER" ? "ALL" : "ORDER")}
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center size-8 rounded-md bg-rose-500 text-white border border-rose-400">
                  <CircleAlert className="size-4" />
                </div>

                <span className="label-caps !text-white">Order</span>
              </div>

              <div className="font-mono text-2xl font-bold tabular-nums text-white">
                {loadingProducts ? "—" : obsOrderCount}
              </div>

              <div className="mt-1 text-[10px] text-white">Stok ≤ batas minimum</div>

              {stockStatusFilter === "ORDER" && (
                <div className="absolute top-2 right-2 size-2 rounded-full bg-white animate-pulse" />
              )}
            </div>

            {/* Card 4: SAFETY STOK */}
            <div
              className="rise-in group relative overflow-hidden rounded-lg border border-green-500 bg-green-600 p-4 text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg cursor-pointer active:scale-[0.99]"
              style={{ animationDelay: "150ms" }}
              onClick={() =>
                setStockStatusFilter(stockStatusFilter === "SAFETY" ? "ALL" : "SAFETY")
              }
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center size-8 rounded-md bg-green-500 text-white border border-green-400">
                  <ShieldCheck className="size-4" />
                </div>

                <span className="label-caps !text-white">Safety Stok</span>
              </div>

              <div className="font-mono text-2xl font-bold tabular-nums text-white">
                {loadingProducts ? "—" : obsSafetyCount}
              </div>

              <div className="mt-1 text-[10px] text-white">Stok aman &gt; minimum</div>

              {stockStatusFilter === "SAFETY" && (
                <div className="absolute top-2 right-2 size-2 rounded-full bg-white animate-pulse" />
              )}
            </div>

            {/* Card 5: OUT OF STOK */}
            <div
              className="rise-in group relative overflow-hidden rounded-lg border border-amber-500 bg-amber-600 p-4 text-white shadow-md transition-all hover:bg-amber-700 hover:shadow-lg cursor-pointer active:scale-[0.99]"
              style={{ animationDelay: "200ms" }}
              onClick={() =>
                setStockStatusFilter(stockStatusFilter === "OUT_OF_STOCK" ? "ALL" : "OUT_OF_STOCK")
              }
            >
              <div className="flex items-center gap-2 mb-3">
                <div className="flex items-center justify-center size-8 rounded-md bg-amber-500 text-white border border-amber-400">
                  <TrendingDown className="size-4" />
                </div>

                <span className="label-caps !text-white">Out of Stok</span>
              </div>

              <div className="font-mono text-2xl font-bold tabular-nums text-white">
                {loadingProducts ? "—" : obsOutOfStockCount}
              </div>

              <div className="mt-1 text-[10px] text-white">Melebihi maks. stok</div>

              {stockStatusFilter === "OUT_OF_STOCK" && (
                <div className="absolute top-2 right-2 size-2 rounded-full bg-white animate-pulse" />
              )}
            </div>
          </div>

          {/* ── PROGRESS BAR DISTRIBUSI KONDISI STOK ──────────────────────── */}
          {!loadingProducts && totalActiveItemsObs > 0 && (
            <div
              className="rise-in border border-border bg-surface p-4"
              style={{ animationDelay: "300ms" }}
            >
              <div className="flex items-center justify-between mb-2.5">
                <span className="label-caps">Distribusi Kondisi Stok</span>
                <span className="text-[10px] font-mono text-muted-foreground">
                  {totalActiveItemsObs} item aktif
                </span>
              </div>
              <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                {obsSafetyPct > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
                    style={{ width: `${obsSafetyPct}%` }}
                    title={`Safety Stok: ${obsSafetyCount} item (${obsSafetyPct}%)`}
                  />
                )}
                {obsOrderPct > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-700 ease-out"
                    style={{ width: `${obsOrderPct}%` }}
                    title={`Order: ${obsOrderCount} item (${obsOrderPct}%)`}
                  />
                )}
                {obsOutOfStockPct > 0 && (
                  <div
                    className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700 ease-out"
                    style={{ width: `${obsOutOfStockPct}%` }}
                    title={`Out of Stok: ${obsOutOfStockCount} item (${obsOutOfStockPct}%)`}
                  />
                )}
              </div>
              <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-emerald-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Safety{" "}
                    <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                      {obsSafetyPct}%
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-rose-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Order{" "}
                    <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                      {obsOrderPct}%
                    </span>
                  </span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="size-2.5 rounded-full bg-amber-500" />
                  <span className="text-[10px] text-muted-foreground">
                    Out of Stok{" "}
                    <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                      {obsOutOfStockPct}%
                    </span>
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Tabel Barang */}
          <div className="border border-border bg-surface overflow-x-auto rounded-lg shadow-2xs">
            {loadingProducts ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                Memuat data inventaris sparepart gudang...
              </div>
            ) : filteredProducts.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <PackageSearch className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">Tidak ada sparepart yang cocok dengan filter</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  Coba ubah kata kunci pencarian atau sesuaikan opsi filter kondisi stok.
                </p>
              </div>
            ) : (
              <table className="w-full min-w-[880px] text-xs border-collapse border border-slate-300 dark:border-slate-700">
                <thead>
                  <tr className="bg-[#0f274a] text-white border-b border-slate-300 dark:border-slate-700 divide-x divide-slate-600/60">
                    <th className="label-caps px-3 py-3 text-center w-12 whitespace-nowrap text-white font-semibold">
                      No
                    </th>
                    <th className="label-caps px-3 py-3 text-left min-w-[130px] whitespace-nowrap text-white font-semibold">
                      Kode
                    </th>
                    <th className="label-caps px-3 py-3 text-left min-w-[220px] whitespace-nowrap text-white font-semibold">
                      Material
                    </th>
                    <th className="label-caps px-3 py-3 text-center min-w-[85px] whitespace-nowrap text-white font-semibold">
                      Satuan
                    </th>
                    <th className="label-caps px-3 py-3 text-center min-w-[100px] whitespace-nowrap text-white font-semibold">
                      Minimal Stok
                    </th>
                    <th className="label-caps px-3 py-3 text-center min-w-[130px] whitespace-nowrap text-white font-semibold">
                      BEGINNING BALANCE
                    </th>
                    <th className="label-caps px-3 py-3 text-center min-w-[100px] whitespace-nowrap text-white font-semibold">
                      RECEIPT
                    </th>
                    <th className="label-caps px-3 py-3 text-center min-w-[100px] whitespace-nowrap text-white font-semibold">
                      ISSUED
                    </th>
                    <th className="label-caps px-3 py-3 text-right min-w-[120px] whitespace-nowrap text-white font-semibold">
                      ENDING BALANCE
                    </th>
                    <th className="label-caps px-3 py-3 text-center min-w-[100px] whitespace-nowrap text-white font-semibold">
                      Maksimal Stok
                    </th>
                    <th className="label-caps px-3 py-3 text-center min-w-[120px] whitespace-nowrap text-white font-semibold">
                      Kondisi
                    </th>
                    <th className="label-caps px-3 py-3 text-center min-w-[100px] whitespace-nowrap text-white font-semibold">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredProducts.map((p, index) => {
                    const current = p.current_stock ?? 0;
                    const minStock = p.min_stock ?? 10;
                    const rawMax = (p as any).max_stock;
                    const maxStock =
                      rawMax !== null && rawMax !== undefined && rawMax !== ""
                        ? Number(rawMax)
                        : null;

                    const nameKey = p.name ? p.name.trim().toLowerCase() : "";
                    const codeKey = p.code ? p.code.trim().toLowerCase() : "";

                    // Mutasi Harian (Daily): Kolom Receipt & Issued hanya menampilkan transaksi hari ini
                    // Jika mutasi sudah beda hari, bernilai 0 sehingga otomatis kembali menjadi (-)
                    const dailyReceipt =
                      (dailyInQtyMap[p.id] ?? 0) ||
                      (nameKey ? (dailyInQtyMap[nameKey] ?? 0) : 0) ||
                      (codeKey ? (dailyInQtyMap[codeKey] ?? 0) : 0);

                    const dailyIssued =
                      (dailyOutQtyMap[p.id] ?? 0) ||
                      (nameKey ? (dailyOutQtyMap[nameKey] ?? 0) : 0) ||
                      (codeKey ? (dailyOutQtyMap[codeKey] ?? 0) : 0);

                    // BEGINNING BALANCE = Ending Balance - Receipt + Issued
                    // Jika sudah beda hari (dailyReceipt === 0 & dailyIssued === 0),
                    // maka Beginning Balance otomatis sama dengan Ending Balance (current)
                    const beginningBalance = Math.max(0, current - dailyReceipt + dailyIssued);

                    // Logika Kondisi:
                    // 1. Order warna merah (current <= minStock)
                    // 2. Safety stok warna hijau (current > minStock dan <= maxStock)
                    // 3. Out of stok warna kuning (current > maxStock)
                    let kondisiText = "SAFETY STOK";
                    let kondisiStyle =
                      "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";

                    if (maxStock !== null && !isNaN(maxStock) && current > maxStock) {
                      kondisiText = "OUT OF STOK";
                      kondisiStyle =
                        "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700";
                    } else if (current <= minStock) {
                      kondisiText = "ORDER";
                      kondisiStyle =
                        "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
                    }

                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 divide-x divide-slate-200 dark:divide-slate-700",
                          !p.is_active && "opacity-55 bg-surface-muted/20",
                        )}
                      >
                        {/* 1. No */}
                        <td className="px-3 py-3 text-center font-mono text-muted-foreground w-12 bg-slate-50/40 dark:bg-slate-900/20">
                          {index + 1}
                        </td>

                        {/* 2. Kode */}
                        <td className="px-3 py-3 text-left whitespace-nowrap font-mono font-medium">
                          <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                            {p.code || "—"}
                          </span>
                        </td>

                        {/* 3. Material */}
                        <td className="px-3 py-3 text-left min-w-[220px]">
                          <div className="flex items-center gap-2">
                            {p.image_url ? (
                              <a
                                href={p.image_url}
                                target="_blank"
                                rel="noreferrer"
                                title="Lihat Gambar"
                                className="shrink-0"
                              >
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="size-7 rounded object-cover border border-border hover:scale-105 transition-transform"
                                />
                              </a>
                            ) : null}
                            <span className="font-semibold text-foreground break-words leading-tight">
                              {p.name}
                            </span>
                          </div>
                        </td>

                        {/* 4. Satuan */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span className="font-mono text-xs font-semibold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800/80 border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-300 uppercase">
                            {p.unit || "pcs"}
                          </span>
                        </td>

                        {/* 5. Minimal Stok */}
                        <td className="px-3 py-3 text-center font-mono text-muted-foreground whitespace-nowrap">
                          {minStock.toLocaleString("id-ID")}
                        </td>

                        {/* 6. BEGINNING BALANCE */}
                        <td className="px-3 py-3 text-center font-mono font-semibold text-slate-700 dark:text-slate-300 whitespace-nowrap">
                          {beginningBalance.toLocaleString("id-ID")}
                        </td>

                        {/* 7. RECEIPT */}
                        <td className="px-3 py-3 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400 whitespace-nowrap">
                          {dailyReceipt > 0 ? (
                            Number(dailyReceipt).toLocaleString("id-ID")
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* 8. ISSUED */}
                        <td className="px-3 py-3 text-center font-mono font-semibold text-rose-600 dark:text-rose-400 whitespace-nowrap">
                          {dailyIssued > 0 ? (
                            Number(dailyIssued).toLocaleString("id-ID")
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* 9. ENDING BALANCE */}
                        <td className="px-3 py-3 text-right font-mono font-bold whitespace-nowrap">
                          <span
                            className={cn(
                              "tabular-nums text-sm",
                              current <= 0
                                ? "text-rose-600 dark:text-rose-400 font-extrabold"
                                : current <= minStock
                                  ? "text-rose-600 dark:text-rose-400"
                                  : "text-emerald-600 dark:text-emerald-400",
                            )}
                          >
                            {current.toLocaleString("id-ID")}
                          </span>
                        </td>

                        {/* 10. Maksimal Stok */}
                        <td className="px-3 py-3 text-center font-mono text-muted-foreground whitespace-nowrap">
                          {maxStock !== null && !isNaN(maxStock)
                            ? maxStock.toLocaleString("id-ID")
                            : "—"}
                        </td>

                        {/* 8. Kondisi */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center w-28 h-6 rounded-full text-[11px] font-semibold border tracking-wide uppercase shadow-2xs",
                              kondisiStyle,
                            )}
                          >
                            {kondisiText}
                          </span>
                        </td>

                        {/* 9. Aksi (detail, delete) */}
                        <td className="px-3 py-3 text-center whitespace-nowrap bg-slate-50/30 dark:bg-slate-900/10">
                          <div className="flex items-center justify-center gap-1.5">
                            {/* Tombol Detail */}
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2.5 text-xs gap-1 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                              onClick={() => setSelectedProduct(p)}
                              title="Lihat Detail & Edit Barang"
                            >
                              <Eye className="size-3 text-primary" />
                              <span>Detail</span>
                            </Button>

                            {/* Tombol Hapus (Khusus Admin/Authorized) */}
                            {canDeleteMaster && (
                              <Button
                                size="sm"
                                variant="ghost"
                                className="size-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                onClick={() => setDeletingItem(p)}
                                title="Hapus Barang"
                              >
                                <Trash2 className="size-3.5" />
                              </Button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 2: RIWAYAT MUTASI (IN / OUT) ────────────────────────────────── */}
        <TabsContent value="transactions" className="space-y-4">
          {/* Ringkasan Statistik Mutasi (Khusus Tab Riwayat Mutasi) */}
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {/* Card 1: Total Mutasi Daily (Split: Masuk & Keluar) */}
            <div
              onClick={() => {
                setTxFilterType("ALL");
                setTxDateFilter("");
              }}
              className="border border-border bg-surface p-4 flex flex-col justify-between cursor-pointer hover:border-blue-500/60 hover:shadow-md transition-all active:scale-[0.99] group"
              title="Klik untuk melihat riwayat transaksi mutasi hari ini"
            >
              <div>
                <div className="flex items-center justify-between text-muted-foreground group-hover:text-blue-600 transition-colors">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-blue-500 animate-pulse" />
                    Total Mutasi Daily
                  </span>
                  <History className="size-4 text-blue-500 group-hover:scale-110 transition-transform" />
                </div>
                <div className="mt-2 flex items-baseline gap-2">
                  <p className="text-2xl font-bold text-foreground group-hover:text-blue-600 transition-colors">
                    {dailyTotalCount}
                  </p>
                  <span className="text-xs text-muted-foreground">transaksi hari ini</span>
                </div>
              </div>
              <div className="mt-3 pt-2.5 border-t border-border/80 grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTxFilterType("IN");
                    setTxDateFilter("");
                  }}
                  className="flex items-center gap-1.5 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1.5 rounded-sm transition-colors text-left"
                  title="Klik untuk filter transaksi masuk hari ini"
                >
                  <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-300 leading-none">
                      Mutasi Masuk
                    </p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {dailyInCount}
                    </p>
                  </div>
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setTxFilterType("OUT");
                    setTxDateFilter("");
                  }}
                  className="flex items-center gap-1.5 bg-rose-500/10 hover:bg-rose-500/20 px-2 py-1.5 rounded-sm transition-colors text-left"
                  title="Klik untuk filter transaksi keluar hari ini"
                >
                  <ArrowUpRight className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-semibold text-rose-700 dark:text-rose-300 leading-none">
                      Mutasi Keluar
                    </p>
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                      {dailyOutCount}
                    </p>
                  </div>
                </button>
              </div>
            </div>

            {/* Card 2: Monitoring Mutasi Global & Tarik Data Kalender */}
            <div className="border border-border bg-surface p-4 flex flex-col justify-between hover:border-indigo-500/60 hover:shadow-md transition-all">
              <div>
                <div className="flex items-center justify-between text-muted-foreground">
                  <span className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                    <CalendarIcon className="size-3.5 text-indigo-500" />
                    Monitoring Mutasi Global
                  </span>
                  {txDateFilter && (
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0 bg-indigo-500/10 text-indigo-600 dark:text-indigo-400 border border-indigo-200 dark:border-indigo-800"
                    >
                      Terfilter
                    </Badge>
                  )}
                </div>

                {/* Input Kalender untuk Tarik Data Tanggal Tertentu */}
                <div className="mt-2.5 flex items-center gap-2">
                  <div className="relative flex-1">
                    <input
                      type="date"
                      value={txDateFilter}
                      onChange={(e) => {
                        setTxDateFilter(e.target.value);
                      }}
                      className="w-full h-8 text-xs px-2.5 py-1 bg-surface-muted/60 border border-input rounded text-foreground focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      title="Pilih tanggal untuk memonitor & menarik riwayat mutasi"
                    />
                  </div>
                  {txDateFilter ? (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => setTxDateFilter("")}
                      className="h-8 px-2 text-[11px] text-muted-foreground hover:text-foreground border-dashed"
                      title="Reset filter tanggal (kembali ke semua mutasi)"
                    >
                      <X className="size-3.5 mr-1" />
                      Reset
                    </Button>
                  ) : (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => {
                        const todayStr = new Date().toISOString().split("T")[0] || "";
                        setTxDateFilter(todayStr);
                      }}
                      className="h-8 px-2.5 text-[11px] text-indigo-600 dark:text-indigo-400 border-indigo-200 dark:border-indigo-800 hover:bg-indigo-50 dark:hover:bg-indigo-950/40"
                      title="Tarik data hari ini"
                    >
                      Hari Ini
                    </Button>
                  )}
                </div>

                <div className="mt-2 flex items-baseline justify-between">
                  <div className="flex items-baseline gap-1.5">
                    <p className="text-2xl font-bold text-foreground">
                      {globalMutasiStats.totalCount}
                    </p>
                    <span className="text-xs text-muted-foreground">
                      {txDateFilter ? "transaksi pada tanggal ini" : "total akumulasi transaksi"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="mt-3 pt-2.5 border-t border-border/80 grid grid-cols-2 gap-2">
                <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1.5 rounded-sm">
                  <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-300 leading-none">
                      Masuk ({globalMutasiStats.inCount})
                    </p>
                    <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">
                      {globalMutasiStats.totalQtyIn} pcs
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 bg-rose-500/10 px-2 py-1.5 rounded-sm">
                  <ArrowUpRight className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
                  <div className="min-w-0">
                    <p className="text-[10px] uppercase font-semibold text-rose-700 dark:text-rose-300 leading-none">
                      Keluar ({globalMutasiStats.outCount})
                    </p>
                    <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">
                      {globalMutasiStats.totalQtyOut} pcs
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Header Bar Alat Tab Mutasi (Pencarian & Filter Tipe) */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between border border-border bg-surface p-3 sm:p-4">
            <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 flex-1 max-w-2xl">
              {/* Search Box */}
              <div className="relative flex-1">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-3.5 text-muted-foreground" />
                <Input
                  placeholder="Cari no. bon, sparepart, vendor, ref no, batch..."
                  value={txSearchQuery}
                  onChange={(e) => setTxSearchQuery(e.target.value)}
                  className="pl-9 h-8 text-xs bg-surface-muted/50 border-input"
                />
                {txSearchQuery && (
                  <button
                    onClick={() => setTxSearchQuery("")}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>

              {/* Filter Tipe Mutasi: Semua / Masuk / Keluar */}
              <div className="flex items-center gap-1 bg-surface-muted p-0.5 rounded border border-border text-xs">
                <button
                  type="button"
                  onClick={() => setTxFilterType("ALL")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors",
                    txFilterType === "ALL"
                      ? "bg-surface text-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  Semua ({groupedTransactions.length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxFilterType("IN")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
                    txFilterType === "IN"
                      ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ArrowDownLeft className="size-3 text-emerald-600" />
                  Masuk ({groupedTransactions.filter((t) => t.tx_type === "IN").length})
                </button>
                <button
                  type="button"
                  onClick={() => setTxFilterType("OUT")}
                  className={cn(
                    "px-2.5 py-1 rounded text-xs font-medium transition-colors flex items-center gap-1",
                    txFilterType === "OUT"
                      ? "bg-rose-500/15 text-rose-700 dark:text-rose-300 font-semibold shadow-xs"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  <ArrowUpRight className="size-3 text-rose-600" />
                  Keluar ({groupedTransactions.filter((t) => t.tx_type === "OUT").length})
                </button>
              </div>

              {/* Filter Tanggal Kalender Tab Mutasi */}
              <div className="flex items-center gap-1.5 bg-surface-muted px-2 py-1 rounded border border-border text-xs">
                <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={txDateFilter}
                  onChange={(e) => setTxDateFilter(e.target.value)}
                  className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer"
                  title="Filter riwayat mutasi berdasarkan tanggal"
                />
                {txDateFilter && (
                  <button
                    type="button"
                    onClick={() => setTxDateFilter("")}
                    className="text-muted-foreground hover:text-foreground ml-1"
                    title="Hapus filter tanggal"
                  >
                    <X className="size-3.5" />
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Tabel Riwayat Mutasi yang Rapih */}
          <div className="border border-border bg-surface overflow-x-auto shadow-xs">
            {loadingTx ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                Memuat riwayat transaksi mutasi...
              </div>
            ) : filteredGroupedTransactions.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <History className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">
                  {txSearchQuery || txFilterType !== "ALL"
                    ? "Tidak ada transaksi mutasi yang cocok"
                    : "Belum ada riwayat transaksi mutasi"}
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  {txSearchQuery || txFilterType !== "ALL"
                    ? "Silakan coba kata kunci pencarian lain atau reset filter transaksi."
                    : 'Gunakan tombol "Catat Masuk" atau "Catat Keluar" di atas untuk mencatat perpindahan stok.'}
                </p>
                {(txSearchQuery || txFilterType !== "ALL") && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setTxSearchQuery("");
                      setTxFilterType("ALL");
                    }}
                    className="mt-3 text-xs h-7"
                  >
                    Reset Filter
                  </Button>
                )}
              </div>
            ) : (
              <table className="w-full text-xs text-left border-collapse border border-slate-200 dark:border-slate-800">
                <thead>
                  <tr className="border-b border-border bg-[#0f274a] text-white text-[11px] tracking-wider font-semibold divide-x divide-slate-600/60 text-center">
                    <th className="px-3 py-3 whitespace-nowrap text-white text-center">Tanggal</th>
                    <th className="px-3 py-3 whitespace-nowrap text-white w-28 text-center">
                      (Tipe Mutasi)
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap text-white min-w-[120px] text-center">
                      KODE
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap text-white min-w-[220px] text-center">
                      MATERIAL
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap text-white min-w-[110px] text-center">
                      QTY
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap text-white min-w-[140px] text-center">
                      Vendor
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap text-white min-w-[140px] text-center">
                      Alasan Permintaan Barang
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap text-white min-w-[130px] text-center">
                      No. PO
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap text-white min-w-[140px] text-center">
                      User
                    </th>
                    <th className="px-3 py-3 whitespace-nowrap text-white text-center w-28">
                      Aksi
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                  {filteredGroupedTransactions.map((tx) => {
                    const isMasuk = tx.tx_type === "IN";
                    const isToday =
                      new Date(tx.created_at).toDateString() === new Date().toDateString();

                    return (
                      <tr
                        key={tx.transaction_number}
                        className="hover:bg-surface-muted/40 transition-colors align-top divide-x divide-slate-200 dark:divide-slate-800"
                      >
                        {/* 1. Tanggal */}
                        <td className="px-3 py-3 whitespace-nowrap">
                          <div className="flex items-center gap-1 font-semibold text-foreground text-xs">
                            <Clock className="size-3 text-muted-foreground shrink-0" />
                            <span>{formatDate(tx.created_at)}</span>
                            {isToday && (
                              <span
                                className="size-1.5 rounded-full bg-blue-500 inline-block ml-1"
                                title="Hari ini"
                              />
                            )}
                          </div>
                        </td>

                        {/* 2. (Tipe Mutasi) */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center gap-1 w-16 h-6 rounded text-[11px] font-bold uppercase tracking-wide",
                              isMasuk
                                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25"
                                : "bg-rose-500/15 text-rose-700 dark:text-rose-300 border border-rose-500/25",
                            )}
                          >
                            {isMasuk ? (
                              <ArrowDownLeft className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                            ) : (
                              <ArrowUpRight className="size-3 shrink-0 text-rose-600 dark:text-rose-400" />
                            )}
                            {isMasuk ? "IN" : "OUT"}
                          </span>
                        </td>

                        {/* 3. KODE (Tanpa kotak) */}
                        <td className="px-3 py-3 font-mono text-xs">
                          <div className="space-y-1.5">
                            {tx.items.map((it, idx) => {
                              const foundProd =
                                productMap.get(it.product_id) ||
                                productMap.get(it.product_name.trim().toLowerCase());
                              const itemCode = foundProd?.code || "—";
                              return (
                                <div
                                  key={it.id || idx}
                                  className="py-0.5 font-medium text-foreground"
                                >
                                  {itemCode}
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* 4. MATERIAL */}
                        <td className="px-3 py-3">
                          <div className="space-y-1.5">
                            {tx.items.map((it, idx) => (
                              <div key={it.id || idx} className="py-0.5">
                                <span className="font-medium text-foreground leading-snug">
                                  {it.product_name}
                                </span>
                              </div>
                            ))}
                            {tx.items.length > 1 && (
                              <p className="text-[10px] text-muted-foreground px-1 font-medium">
                                Total {tx.items.length} material dalam transaksi ini
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 5. QTY (Tanpa kotak) */}
                        <td className="px-3 py-3 text-center whitespace-nowrap">
                          <div className="space-y-1.5">
                            {tx.items.map((it, idx) => (
                              <div key={it.id || idx} className="py-0.5">
                                <span
                                  className={cn(
                                    "font-mono font-bold text-xs inline-block",
                                    isMasuk
                                      ? "text-emerald-600 dark:text-emerald-400"
                                      : "text-rose-600 dark:text-rose-400",
                                  )}
                                >
                                  {isMasuk ? "+" : "-"}
                                  {it.quantity.toLocaleString("id-ID")} {it.unit || "pcs"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* 6. Vendor */}
                        <td className="px-3 py-3 text-xs">
                          {isMasuk ? (
                            <span className="font-medium text-foreground block">
                              {tx.supplier_or_dest || "—"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 block">—</span>
                          )}
                        </td>

                        {/* 7. Alasan Permintaan Barang */}
                        <td className="px-3 py-3 text-xs">
                          {!isMasuk ? (
                            <span className="font-medium text-foreground block">
                              {tx.supplier_or_dest || "—"}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60 block">—</span>
                          )}
                        </td>

                        {/* 8. No. PO */}
                        <td className="px-3 py-3 text-xs">
                          {isMasuk && tx.reference_no ? (
                            <span className="font-mono text-xs text-foreground font-semibold">
                              {tx.reference_no}
                            </span>
                          ) : isMasuk && tx.batch_number ? (
                            <span className="font-mono text-[11px] text-muted-foreground">
                              {tx.batch_number}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* 9. User (Nama Petugas Shift) */}
                        <td className="px-3 py-3 text-xs">
                          <span className="font-medium text-foreground block">
                            {tx.notes || tx.created_by_name || "Petugas Sparepart"}
                          </span>
                        </td>

                        {/* 9. Aksi */}
                        <td className="px-3 py-3 text-center whitespace-nowrap bg-slate-50/30 dark:bg-slate-900/10">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => setSelectedTx(tx)}
                              className="h-7 text-xs px-2 gap-1"
                              title="Lihat rincian lengkap mutasi"
                            >
                              <Eye className="size-3.5 text-primary" />
                              <span>Detail</span>
                            </Button>
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => downloadTransactionPDF(tx)}
                              className="h-7 text-xs px-2 gap-1 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                              title="Cetak & Unduh Bukti Mutasi Barang PDF (1 Bon)"
                            >
                              <Download className="size-3.5" />
                              <span>PDF</span>
                            </Button>
                            {tx.document_url && (
                              <a
                                href={tx.document_url}
                                target="_blank"
                                rel="noreferrer"
                                className="inline-flex items-center justify-center size-7 rounded border border-border bg-surface hover:bg-surface-muted text-muted-foreground hover:text-foreground"
                                title="Buka lampiran surat jalan/bukti fisik"
                              >
                                <FileText className="size-3.5 text-blue-500" />
                              </a>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 3: LOKASI GUDANG & RAK (DINAMIS SESUAI MASTER & CATATAN MASUK) ── */}
        <TabsContent value="locations" className="space-y-4">
          <div className="border border-border bg-surface p-4 sm:p-5">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-4 border-b border-border">
              <div className="flex items-center gap-2.5">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-5" />
                </div>
                <div>
                  <h3 className="font-semibold text-base">Daftar Shelf & Lokasi Rak Gudang</h3>
                  <p className="text-xs text-muted-foreground">
                    Monitoring penataan lokasi rak, daftar sparepart tersimpan, dan riwayat catatan
                    masuk.
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <Badge variant="outline" className="text-xs font-mono">
                  {shelfLocationGroups.length} Posisi Rak Terdata
                </Badge>
              </div>
            </div>

            {shelfLocationGroups.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 text-center">
                <MapPin className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-semibold text-foreground">
                  Belum Ada Data Shelf / Rak yang Tercatat
                </p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  Daftar lokasi rak akan otomatis terisi dan dikelompokkan sesuai data input master
                  barang serta catatan transaksi barang masuk.
                </p>
              </div>
            ) : (
              <div className="space-y-5 pt-4">
                {shelfLocationGroups.map((group, idx) => (
                  <div
                    key={idx}
                    className="rounded-lg border border-border bg-surface-muted/20 overflow-hidden shadow-2xs"
                  >
                    {/* Header Rak */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3.5 bg-surface-muted/50 border-b border-border">
                      <div className="flex items-center gap-2.5">
                        <Badge className="font-mono text-xs font-semibold px-2.5 py-0.5 bg-slate-800 text-white dark:bg-slate-700">
                          {group.shelf}
                        </Badge>
                        <span className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                          <Warehouse className="size-3.5" />
                          {group.location}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 text-xs">
                        <span className="text-muted-foreground">
                          <strong className="text-foreground font-semibold">
                            {group.items.length}
                          </strong>{" "}
                          SKU Sparepart
                        </span>
                        <span className="text-border">|</span>
                        <span className="text-muted-foreground">
                          Total Saldo:{" "}
                          <strong className="text-primary font-bold font-mono">
                            {group.totalStock.toLocaleString("id-ID")}
                          </strong>{" "}
                          Unit
                        </span>
                      </div>
                    </div>

                    {/* Catatan Masuk Terakhir jika ada */}
                    {group.latestInbound && (
                      <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                        <div className="flex items-center gap-2">
                          <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            <strong>Catatan Masuk Terakhir:</strong>{" "}
                            {formatDate(group.latestInbound.created_at)}
                            {group.latestInbound.supplier_or_dest
                              ? ` (Dari: ${group.latestInbound.supplier_or_dest})`
                              : ""}
                          </span>
                        </div>
                        <span className="font-mono text-[11px] opacity-80">
                          No. Bon: {group.latestInbound.transaction_number}
                        </span>
                      </div>
                    )}

                    {/* Tabel Item di Rak */}
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs">
                        <thead>
                          <tr className="border-b border-border bg-surface-muted/30 text-muted-foreground">
                            <th className="px-3.5 py-2 text-left font-medium w-10">No</th>
                            <th className="px-3.5 py-2 text-left font-medium w-32">Kode SKU</th>
                            <th className="px-3.5 py-2 text-left font-medium min-w-[320px] md:min-w-[420px]">
                              Nama Sparepart
                            </th>
                            <th className="px-3.5 py-2 text-center font-medium w-20">Satuan</th>
                            <th className="px-3.5 py-2 text-right font-medium w-24">
                              Stok Terkini
                            </th>
                            <th className="px-3.5 py-2 text-right font-medium w-20">Min.</th>
                            <th className="px-3.5 py-2 text-center font-medium w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {group.items.map((item, itIdx) => {
                            const isLimit = (item.current_stock ?? 0) <= (item.min_stock ?? 10);
                            return (
                              <tr
                                key={item.id || itIdx}
                                className="hover:bg-surface-muted/40 transition-colors"
                              >
                                <td className="px-3.5 py-2 text-muted-foreground">{itIdx + 1}</td>
                                <td className="px-3.5 py-2 font-mono font-medium text-foreground">
                                  {item.code || "—"}
                                </td>
                                <td className="px-3.5 py-2 font-medium text-foreground min-w-[320px] md:min-w-[420px]">
                                  {item.name}
                                </td>
                                <td className="px-3.5 py-2 text-center font-mono text-muted-foreground">
                                  {item.unit || "pcs"}
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono font-bold">
                                  <span
                                    className={
                                      isLimit
                                        ? "text-rose-600 dark:text-rose-400"
                                        : "text-emerald-600 dark:text-emerald-400"
                                    }
                                  >
                                    {(item.current_stock ?? 0).toLocaleString("id-ID")}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono text-muted-foreground">
                                  {(item.min_stock ?? 10).toLocaleString("id-ID")}
                                </td>
                                <td className="px-3.5 py-2 text-center">
                                  {isLimit ? (
                                    <Badge
                                      variant="destructive"
                                      className="text-[10px] px-1.5 py-0 h-5"
                                    >
                                      Limit
                                    </Badge>
                                  ) : (
                                    <Badge
                                      variant="outline"
                                      className="text-[10px] px-1.5 py-0 h-5 text-emerald-600 border-emerald-500/30 bg-emerald-500/10"
                                    >
                                      Aman
                                    </Badge>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </TabsContent>

        {/* ── TAB 4: ACTIVITY LOG PERGUDANGAN ─────────────────────────────────── */}
        <TabsContent value="logs" className="space-y-4">
          <div className="border border-border bg-surface">
            {loadingLogs ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                Memuat riwayat log gudang...
              </div>
            ) : activityLogs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-20 text-center">
                <FileText className="mb-3 size-10 text-muted-foreground/40" />
                <p className="text-sm font-medium">Belum ada aktivitas log</p>
              </div>
            ) : (
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50">
                    <th className="label-caps px-4 py-3 text-left">Aksi</th>
                    <th className="label-caps px-4 py-3 text-left">Deskripsi Aktivitas</th>
                    <th className="label-caps px-4 py-3 text-left">Petugas Shift</th>
                    <th className="label-caps px-4 py-3 text-right">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activityLogs.map((log) => {
                    const shiftOfficerName = getShiftOfficer(log.created_at, log.user_name);
                    return (
                      <tr key={log.id} className="hover:bg-surface-muted/30">
                        <td className="px-4 py-3">
                          <Badge variant="outline" className="font-mono text-xs">
                            {log.action}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 font-medium">{log.description}</td>
                        <td className="px-4 py-3 text-xs font-semibold text-foreground">
                          {shiftOfficerName}
                        </td>
                        <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                          {formatDate(log.created_at)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
        {/* ── TAB 5: BUFFER STOK (TABEL MANDIRI, TIDAK NGELINK OBS) ────────────── */}
        <TabsContent value="buffer_stock" className="space-y-4">
          {/* Header & Filter Buffer Stok */}
          <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between bg-surface border border-border p-3">
            <div className="relative flex-1 lg:max-w-md">
              <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
              <Input
                placeholder="Cari nama barang, kode, atau nomor rak..."
                value={bufferSearchQuery}
                onChange={(e) => setBufferSearchQuery(e.target.value)}
                className="pl-9 h-9 text-xs sm:text-sm"
              />
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Filter Kondisi Stok */}
              <div className="flex items-center gap-1.5">
                <Filter className="size-3.5 text-muted-foreground" />
                <Select value={bufferStatusFilter} onValueChange={setBufferStatusFilter}>
                  <SelectTrigger className="w-48 h-9 text-xs">
                    <SelectValue placeholder="Kondisi Stok" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="ALL" className="text-xs">
                      Semua Kondisi
                    </SelectItem>
                    <SelectItem value="ORDER" className="text-xs font-semibold text-rose-600">
                      ⚠ ORDER (≤ Minimal Stok)
                    </SelectItem>
                    <SelectItem value="SAFETY" className="text-xs font-semibold text-emerald-600">
                      ✓ SAFETY STOK (&gt; Minimal Stok)
                    </SelectItem>
                    <SelectItem
                      value="OUT_OF_STOCK"
                      className="text-xs font-semibold text-amber-600"
                    >
                      ⚡ OUT OF STOK (&gt; Maksimal Stok)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {/* Filter Kalender Tanggal Tarik Data */}
              <div className="flex items-center gap-1.5 bg-background border border-input rounded-md px-2.5 h-9 text-xs shadow-sm hover:border-primary/50 transition-colors">
                <CalendarIcon className="size-3.5 text-muted-foreground shrink-0" />
                <input
                  type="date"
                  value={bufferDateFilter}
                  onChange={(e) => setBufferDateFilter(e.target.value)}
                  className="bg-transparent text-xs text-foreground focus:outline-none cursor-pointer font-medium"
                  title="Tarik data berdasarkan tanggal kalender"
                />
                {bufferDateFilter && (
                  <button
                    type="button"
                    onClick={() => setBufferDateFilter("")}
                    className="text-muted-foreground hover:text-foreground p-0.5 rounded-full hover:bg-muted transition-colors"
                    title="Reset filter tanggal"
                  >
                    <X className="size-3" />
                  </button>
                )}
              </div>

              {/* Urutan List Barang Buffer */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <Select value={bufferSortOption} onValueChange={setBufferSortOption}>
                  <SelectTrigger className="w-48 h-9 text-xs font-medium">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem
                      value="RECENT_MUTATION"
                      className="text-xs font-semibold text-primary"
                    >
                      ✦ Baru Ditambah / Mutasi
                    </SelectItem>
                    <SelectItem value="CODE_ASC" className="text-xs">
                      Kode Barang (Angka Terkecil ke Terbesar)
                    </SelectItem>
                    <SelectItem value="CODE_DESC" className="text-xs">
                      Kode Barang (Angka Terbesar ke Terkecil)
                    </SelectItem>
                    <SelectItem value="NAME_ASC" className="text-xs">
                      Nama Barang (A - Z)
                    </SelectItem>
                    <SelectItem value="NAME_DESC" className="text-xs">
                      Nama Barang (Z - A)
                    </SelectItem>
                    <SelectItem value="STOCK_DESC" className="text-xs">
                      Stok Terbanyak
                    </SelectItem>
                    <SelectItem value="STOCK_ASC" className="text-xs">
                      Stok Paling Sedikit
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {/* ── MONITORING INFO CARDS BUFFER STOK ──────────────────────────── */}
          {(() => {
            const activeBuffers = bufferItems.filter((b) => b.is_active);
            const totalBufferItems = activeBuffers.length;
            const totalBufferQty = activeBuffers.reduce(
              (acc, b) => acc + (b.current_stock ?? 0),
              0,
            );

            const bufOrderItems = activeBuffers.filter((b) => {
              const current = b.current_stock ?? 0;
              const minStock = b.min_stock ?? 10;
              const rawMax = b.max_stock;
              const maxStock = rawMax !== null && rawMax !== undefined ? Number(rawMax) : null;
              const isOut = maxStock !== null && !isNaN(maxStock) && current > maxStock;
              return !isOut && current <= minStock;
            });
            const bufSafetyItems = activeBuffers.filter((b) => {
              const current = b.current_stock ?? 0;
              const minStock = b.min_stock ?? 10;
              const rawMax = b.max_stock;
              const maxStock = rawMax !== null && rawMax !== undefined ? Number(rawMax) : null;
              const isOut = maxStock !== null && !isNaN(maxStock) && current > maxStock;
              return !isOut && current > minStock;
            });
            const bufOutOfStockItems = activeBuffers.filter((b) => {
              const current = b.current_stock ?? 0;
              const rawMax = b.max_stock;
              const maxStock = rawMax !== null && rawMax !== undefined ? Number(rawMax) : null;
              return maxStock !== null && !isNaN(maxStock) && current > maxStock;
            });

            const bufOrderCount = bufOrderItems.length;
            const bufSafetyCount = bufSafetyItems.length;
            const bufOutOfStockCount = bufOutOfStockItems.length;

            const bufOrderPct =
              totalBufferItems > 0 ? Math.round((bufOrderCount / totalBufferItems) * 100) : 0;
            const bufSafetyPct =
              totalBufferItems > 0 ? Math.round((bufSafetyCount / totalBufferItems) * 100) : 0;
            const bufOutOfStockPct =
              totalBufferItems > 0 ? Math.max(0, 100 - bufOrderPct - bufSafetyPct) : 0;

            return (
              <>
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                  {/* Card 1: Total Item Buffer */}
                  <div className="rise-in group relative overflow-hidden rounded-lg border border-blue-500 bg-blue-600 p-4 text-white shadow-md transition-all hover:bg-blue-700 hover:shadow-lg cursor-pointer active:scale-[0.99]">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center size-8 rounded-md bg-blue-500 text-white border border-blue-400">
                        <Boxes className="size-4" />
                      </div>

                      <span className="label-caps !text-white">Total Item</span>
                    </div>

                    <div className="font-mono text-2xl font-bold tabular-nums text-white">
                      {loadingBuffer ? "—" : totalBufferItems}
                    </div>

                    <div className="mt-1 text-[10px] text-white">Item buffer aktif</div>
                  </div>

                  {/* Card 2: Total Stok Qty */}
                  <div
                    className="rise-in group relative overflow-hidden rounded-lg border p-4 text-white shadow-md transition-all hover:shadow-lg cursor-pointer active:scale-[0.99]"
                    style={{
                      animationDelay: "50ms",
                      backgroundColor: "#0092B8",
                      borderColor: "#0083A6",
                    }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div
                        className="flex items-center justify-center size-8 rounded-md text-white border"
                        style={{
                          backgroundColor: "#00ACCF",
                          borderColor: "#00A0C2",
                        }}
                      >
                        <Package className="size-4" />
                      </div>

                      <span className="label-caps !text-white">Total Stok</span>
                    </div>

                    <div className="font-mono text-2xl font-bold tabular-nums text-white">
                      {loadingBuffer ? "—" : totalBufferQty.toLocaleString("id-ID")}
                    </div>

                    <div className="mt-1 text-[10px] text-white">Jumlah seluruh pcs/unit</div>
                  </div>

                  {/* Card 3: ORDER */}
                  <div
                    className="rise-in group relative overflow-hidden rounded-lg border border-red-500 bg-red-600 p-4 text-white shadow-md transition-all hover:bg-red-700 hover:shadow-lg cursor-pointer active:scale-[0.99]"
                    style={{ animationDelay: "100ms" }}
                    onClick={() =>
                      setBufferStatusFilter(bufferStatusFilter === "ORDER" ? "ALL" : "ORDER")
                    }
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center size-8 rounded-md bg-rose-500 text-white border border-rose-400">
                        <CircleAlert className="size-4" />
                      </div>

                      <span className="label-caps !text-white">Order</span>
                    </div>

                    <div className="font-mono text-2xl font-bold tabular-nums text-white">
                      {loadingBuffer ? "—" : bufOrderCount}
                    </div>

                    <div className="mt-1 text-[10px] text-white">Stok ≤ batas minimum</div>

                    {bufferStatusFilter === "ORDER" && (
                      <div className="absolute top-2 right-2 size-2 rounded-full bg-white animate-pulse" />
                    )}
                  </div>

                  {/* Card 4: SAFETY STOK */}
                  <div
                    className="rise-in group relative overflow-hidden rounded-lg border border-green-500 bg-green-600 p-4 text-white shadow-md transition-all hover:bg-green-700 hover:shadow-lg cursor-pointer active:scale-[0.99]"
                    style={{ animationDelay: "150ms" }}
                    onClick={() =>
                      setBufferStatusFilter(bufferStatusFilter === "SAFETY" ? "ALL" : "SAFETY")
                    }
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center size-8 rounded-md bg-green-500 text-white border border-green-400">
                        <ShieldCheck className="size-4" />
                      </div>

                      <span className="label-caps !text-white">Safety Stok</span>
                    </div>

                    <div className="font-mono text-2xl font-bold tabular-nums text-white">
                      {loadingBuffer ? "—" : bufSafetyCount}
                    </div>

                    <div className="mt-1 text-[10px] text-white">Stok aman &gt; minimum</div>

                    {bufferStatusFilter === "SAFETY" && (
                      <div className="absolute top-2 right-2 size-2 rounded-full bg-white animate-pulse" />
                    )}
                  </div>

                  {/* Card 5: OUT OF STOK */}
                  <div
                    className="rise-in group relative overflow-hidden rounded-lg border border-amber-500 bg-amber-600 p-4 text-white shadow-md transition-all hover:bg-amber-700 hover:shadow-lg cursor-pointer active:scale-[0.99]"
                    style={{ animationDelay: "200ms" }}
                    onClick={() =>
                      setBufferStatusFilter(
                        bufferStatusFilter === "OUT_OF_STOCK" ? "ALL" : "OUT_OF_STOCK",
                      )
                    }
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="flex items-center justify-center size-8 rounded-md bg-amber-500 text-white border border-amber-400">
                        <TrendingDown className="size-4" />
                      </div>

                      <span className="label-caps !text-white">Out of Stok</span>
                    </div>

                    <div className="font-mono text-2xl font-bold tabular-nums text-white">
                      {loadingBuffer ? "—" : bufOutOfStockCount}
                    </div>

                    <div className="mt-1 text-[10px] text-white">Melebihi maks. stok</div>

                    {bufferStatusFilter === "OUT_OF_STOCK" && (
                      <div className="absolute top-2 right-2 size-2 rounded-full bg-white animate-pulse" />
                    )}
                  </div>
                </div>

                {/* Progress Bar Distribusi Kondisi Buffer Stok */}
                {!loadingBuffer && totalBufferItems > 0 && (
                  <div
                    className="rise-in border border-border bg-surface p-4"
                    style={{ animationDelay: "250ms" }}
                  >
                    <div className="flex items-center justify-between mb-2.5">
                      <span className="label-caps">Distribusi Kondisi Buffer Stok</span>
                      <span className="text-[10px] font-mono text-muted-foreground">
                        {totalBufferItems} item aktif
                      </span>
                    </div>
                    <div className="flex h-3 w-full overflow-hidden rounded-full bg-slate-100 dark:bg-slate-800">
                      {bufSafetyPct > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-emerald-500 to-emerald-400 transition-all duration-700 ease-out"
                          style={{ width: `${bufSafetyPct}%` }}
                          title={`Safety Stok: ${bufSafetyCount} item (${bufSafetyPct}%)`}
                        />
                      )}
                      {bufOrderPct > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-rose-500 to-rose-400 transition-all duration-700 ease-out"
                          style={{ width: `${bufOrderPct}%` }}
                          title={`Order: ${bufOrderCount} item (${bufOrderPct}%)`}
                        />
                      )}
                      {bufOutOfStockPct > 0 && (
                        <div
                          className="h-full bg-gradient-to-r from-amber-500 to-amber-400 transition-all duration-700 ease-out"
                          style={{ width: `${bufOutOfStockPct}%` }}
                          title={`Out of Stok: ${bufOutOfStockCount} item (${bufOutOfStockPct}%)`}
                        />
                      )}
                    </div>
                    <div className="flex items-center gap-4 mt-2.5 flex-wrap">
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full bg-emerald-500" />
                        <span className="text-[10px] text-muted-foreground">
                          Safety{" "}
                          <span className="font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                            {bufSafetyPct}%
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full bg-rose-500" />
                        <span className="text-[10px] text-muted-foreground">
                          Order{" "}
                          <span className="font-mono font-semibold text-rose-600 dark:text-rose-400">
                            {bufOrderPct}%
                          </span>
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <div className="size-2.5 rounded-full bg-amber-500" />
                        <span className="text-[10px] text-muted-foreground">
                          Out of Stok{" "}
                          <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">
                            {bufOutOfStockPct}%
                          </span>
                        </span>
                      </div>
                    </div>
                  </div>
                )}
              </>
            );
          })()}

          {/* Tabel Buffer Stok */}
          <div className="border border-border bg-surface overflow-x-auto rounded-lg shadow-2xs">
            {loadingBuffer ? (
              <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
                Memuat data buffer stok...
              </div>
            ) : (
              (() => {
                const filtered = bufferItems.filter((item) => {
                  const q = bufferSearchQuery.toLowerCase().trim();
                  const matchSearch =
                    !q ||
                    item.name.toLowerCase().includes(q) ||
                    (item.code && item.code.toLowerCase().includes(q)) ||
                    (item.shelf && item.shelf.toLowerCase().includes(q));
                  const current = item.current_stock ?? 0;
                  const minStock = item.min_stock ?? 10;
                  const maxStock = item.max_stock ? Number(item.max_stock) : null;
                  const isOutOfStock = maxStock !== null && !isNaN(maxStock) && current > maxStock;
                  const isOrder = !isOutOfStock && current <= minStock;
                  const isSafety = !isOutOfStock && !isOrder;
                  const matchStock =
                    bufferStatusFilter === "ALL" ||
                    (bufferStatusFilter === "ORDER" && isOrder) ||
                    (bufferStatusFilter === "SAFETY" && isSafety) ||
                    (bufferStatusFilter === "OUT_OF_STOCK" && isOutOfStock);

                  const matchDate =
                    !bufferDateFilter ||
                    (() => {
                      const pDate = item.created_at ? item.created_at.slice(0, 10) : "";
                      const nameKey = item.name ? item.name.trim().toLowerCase() : "";
                      const tx =
                        latestInTxMap[item.id] || (nameKey ? latestInTxMap[nameKey] : undefined);
                      const txDate = tx?.created_at ? tx.created_at.slice(0, 10) : "";
                      return pDate === bufferDateFilter || txDate === bufferDateFilter;
                    })();

                  return matchSearch && matchStock && matchDate;
                });

                // Urutkan list barang buffer
                const sortedFiltered = [...filtered].sort((a, b) => {
                  if (bufferSortOption === "RECENT_MUTATION") {
                    const nameA = a.name ? a.name.trim().toLowerCase() : "";
                    const nameB = b.name ? b.name.trim().toLowerCase() : "";

                    const txAIn = latestInTxMap[a.id] || (nameA ? latestInTxMap[nameA] : undefined);
                    const txBIn = latestInTxMap[b.id] || (nameB ? latestInTxMap[nameB] : undefined);

                    const timeA = txAIn
                      ? new Date(txAIn.created_at).getTime()
                      : a.created_at
                        ? new Date(a.created_at).getTime()
                        : 0;
                    const timeB = txBIn
                      ? new Date(txBIn.created_at).getTime()
                      : b.created_at
                        ? new Date(b.created_at).getTime()
                        : 0;

                    if (timeA !== timeB) {
                      return timeB - timeA;
                    }
                    return a.name.localeCompare(b.name);
                  }
                  if (bufferSortOption === "CODE_ASC") {
                    return String(a.code || "").localeCompare(String(b.code || ""), undefined, {
                      numeric: true,
                    });
                  }
                  if (bufferSortOption === "CODE_DESC") {
                    return String(b.code || "").localeCompare(String(a.code || ""), undefined, {
                      numeric: true,
                    });
                  }
                  if (bufferSortOption === "NAME_ASC") {
                    return a.name.localeCompare(b.name);
                  }
                  if (bufferSortOption === "NAME_DESC") {
                    return b.name.localeCompare(a.name);
                  }
                  if (bufferSortOption === "STOCK_DESC") {
                    return (b.current_stock ?? 0) - (a.current_stock ?? 0);
                  }
                  if (bufferSortOption === "STOCK_ASC") {
                    return (a.current_stock ?? 0) - (b.current_stock ?? 0);
                  }
                  return 0;
                });

                if (sortedFiltered.length === 0)
                  return (
                    <div className="flex flex-col items-center justify-center py-20 text-center">
                      <Package className="mb-3 size-10 text-muted-foreground/40" />
                      <p className="text-sm font-medium">
                        {bufferSearchQuery || bufferStatusFilter !== "ALL" || bufferDateFilter
                          ? "Tidak ada item buffer stok yang cocok"
                          : "Belum ada data buffer stok"}
                      </p>
                      <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                        {bufferSearchQuery || bufferStatusFilter !== "ALL" || bufferDateFilter
                          ? "Coba ubah kata kunci atau reset filter."
                          : 'Klik "Tambah Barang Buffer" untuk menambahkan item baru ke buffer stok (tidak akan muncul di OBS Sparepart).'}
                      </p>
                      {canManageWarehouse &&
                        !bufferSearchQuery &&
                        bufferStatusFilter === "ALL" &&
                        !bufferDateFilter && (
                          <Button
                            size="sm"
                            onClick={() => {
                              setBufferFormData({
                                name: "",
                                code: "",
                                unit: "Roll",
                                location: "Gudang Utama",
                                shelf: "Rak A-1",
                                qty_in: "0",
                                qty_out: "0",
                                min_stock: "10",
                                safe_stock: "1",
                                max_stock: "",
                                current_stock: "0",
                                description: "",
                              });
                              setIsBufferAddOpen(true);
                            }}
                            className="mt-4 gap-1.5 bg-primary text-primary-foreground text-xs h-8"
                          >
                            <Plus className="size-3.5" />
                            Tambah Barang Buffer
                          </Button>
                        )}
                    </div>
                  );

                return (
                  <table className="w-full min-w-[780px] text-xs border-collapse border border-slate-300 dark:border-slate-700">
                    <thead>
                      <tr className="bg-[#0f274a] text-white border-b border-slate-300 dark:border-slate-700 divide-x divide-slate-600/60">
                        <th className="label-caps px-3 py-3 text-center w-10 text-white font-semibold">
                          No
                        </th>
                        <th className="label-caps px-3 py-3 text-left min-w-[120px] text-white font-semibold">
                          Kode
                        </th>
                        <th className="label-caps px-3 py-3 text-left min-w-[220px] text-white font-semibold">
                          Nama Barang
                        </th>
                        <th className="label-caps px-3 py-3 text-center min-w-[100px] text-white font-semibold">
                          Batas Min
                        </th>
                        <th className="label-caps px-3 py-3 text-center min-w-[90px] text-white font-semibold">
                          Min Stok
                        </th>
                        <th className="label-caps px-3 py-3 text-center min-w-[90px] text-white font-semibold">
                          Maks Stok
                        </th>
                        <th className="label-caps px-3 py-3 text-right min-w-[100px] text-white font-semibold">
                          Stok Saat Ini
                        </th>
                        <th className="label-caps px-3 py-3 text-center min-w-[100px] text-white font-semibold">
                          Kondisi
                        </th>
                        <th className="label-caps px-3 py-3 text-center min-w-[90px] text-white font-semibold">
                          Aksi
                        </th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
                      {sortedFiltered.map((item, index) => {
                        const current = item.current_stock ?? 0;
                        const minStock = item.min_stock ?? 10;
                        const maxStock = item.max_stock ? Number(item.max_stock) : null;
                        const isOrder = current <= minStock;
                        const isOutOfStock = maxStock !== null && current > maxStock;
                        let kondisiText = "AMAN";
                        let kondisiStyle =
                          "bg-emerald-50 text-emerald-700 border-emerald-300 dark:bg-emerald-950/40 dark:text-emerald-300 dark:border-emerald-800";
                        if (isOutOfStock) {
                          kondisiText = "OUT OF STOK";
                          kondisiStyle =
                            "bg-amber-50 text-amber-800 border-amber-300 dark:bg-amber-950/40 dark:text-amber-300 dark:border-amber-700";
                        } else if (isOrder) {
                          kondisiText = "ORDER";
                          kondisiStyle =
                            "bg-rose-50 text-rose-700 border-rose-300 dark:bg-rose-950/40 dark:text-rose-300 dark:border-rose-800";
                        }
                        return (
                          <tr
                            key={item.id}
                            className={cn(
                              "group transition-colors hover:bg-slate-50 dark:hover:bg-slate-800/50 divide-x divide-slate-200 dark:divide-slate-700",
                              !item.is_active && "opacity-55 bg-surface-muted/20",
                            )}
                          >
                            <td className="px-3 py-3 text-center font-mono text-muted-foreground w-10 bg-slate-50/40 dark:bg-slate-900/20">
                              {index + 1}
                            </td>
                            <td className="px-3 py-3 font-mono font-medium">
                              <span className="bg-slate-100 dark:bg-slate-800 text-slate-800 dark:text-slate-200 px-2 py-0.5 rounded border border-slate-200 dark:border-slate-700">
                                {item.code || "—"}
                              </span>
                            </td>
                            <td className="px-3 py-3 font-semibold text-foreground min-w-[220px]">
                              {item.name}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-muted-foreground">
                              {item.safe_stock ?? 1} {item.unit || "pcs"}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-muted-foreground">
                              {minStock} {item.unit || "pcs"}
                            </td>
                            <td className="px-3 py-3 text-center font-mono text-muted-foreground">
                              {maxStock !== null ? `${maxStock} ${item.unit || "pcs"}` : "—"}
                            </td>
                            <td className="px-3 py-3 text-right font-mono font-bold">
                              <span
                                className={cn(
                                  "tabular-nums text-sm",
                                  current <= 0
                                    ? "text-rose-600 dark:text-rose-400 font-extrabold"
                                    : isOrder
                                      ? "text-rose-600 dark:text-rose-400"
                                      : "text-emerald-600 dark:text-emerald-400",
                                )}
                              >
                                {current.toLocaleString("id-ID")} {item.unit || "pcs"}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center">
                              <span
                                className={cn(
                                  "inline-flex items-center justify-center w-24 h-6 rounded-full text-[11px] font-semibold border tracking-wide uppercase shadow-2xs",
                                  kondisiStyle,
                                )}
                              >
                                {kondisiText}
                              </span>
                            </td>
                            <td className="px-3 py-3 text-center whitespace-nowrap bg-slate-50/30 dark:bg-slate-900/10">
                              <div className="flex items-center justify-center gap-1.5">
                                {/* Tombol Detail */}
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs gap-1 text-slate-700 dark:text-slate-200 border-slate-300 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-800 font-medium"
                                  onClick={() => setSelectedBufferItem(item)}
                                  title="Lihat Detail & Edit Barang"
                                >
                                  <Eye className="size-3 text-primary" />
                                  <span>Detail</span>
                                </Button>

                                {/* Tombol Hapus (Khusus Admin/Authorized) */}
                                {canDeleteMaster && (
                                  <Button
                                    size="sm"
                                    variant="ghost"
                                    className="size-7 p-0 text-rose-500 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                                    onClick={() => setDeletingBufferItem(item)}
                                    title="Hapus Barang"
                                  >
                                    <Trash2 className="size-3.5" />
                                  </Button>
                                )}
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                );
              })()
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── MODAL DIALOG: TAMBAH BARANG BUFFER STOK (INDEPENDEN) ─────────────── */}
      <Dialog open={isBufferAddOpen} onOpenChange={setIsBufferAddOpen}>
        <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-lg font-bold">Tambah Data Barang Buffer Stok</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tambahkan data buffer stok secara manual atau upload file Excel / CSV. Data hanya
              masuk ke tabel Buffer Stok, tidak muncul di OBS Sparepart.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Mode: Manual vs Upload File Excel/CSV */}
          <Tabs
            defaultValue="manual"
            className="w-full flex-1 flex flex-col min-h-0 overflow-hidden mt-3"
          >
            <div className="flex items-center justify-between border-b pb-2 mb-3 shrink-0">
              <TabsList className="grid w-72 grid-cols-2">
                <TabsTrigger value="manual" className="text-xs">
                  Manual Input
                </TabsTrigger>
                <TabsTrigger value="upload" className="text-xs gap-1.5">
                  <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Upload Excel/CSV
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Container Scrollable */}
            <div className="flex-1 overflow-y-auto pr-1">
              {/* TAB 1: FORM MANUAL */}
              <TabsContent value="manual" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="buf-name" className="text-xs font-semibold">
                      Nama Barang *
                    </Label>
                    <Input
                      id="buf-name"
                      value={bufferFormData.name}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, name: e.target.value })
                      }
                      placeholder="cth. BEARING 6204-2RS / HEATER ELEMENT 2000W"
                      className="h-9 text-xs"
                      autoFocus
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="buf-code" className="text-xs font-semibold">
                      Kode Material
                    </Label>
                    <Input
                      id="buf-code"
                      value={bufferFormData.code}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, code: e.target.value })
                      }
                      placeholder="cth. 7100110213 / SP-BRG-6204"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Satuan (UoM)</Label>
                    <Select
                      value={bufferFormData.unit}
                      onValueChange={(v) => setBufferFormData({ ...bufferFormData, unit: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Roll" className="text-xs">
                          Roll
                        </SelectItem>
                        <SelectItem value="Lmbr" className="text-xs">
                          Lmbr
                        </SelectItem>
                        <SelectItem value="CAN" className="text-xs">
                          CAN
                        </SelectItem>
                        <SelectItem value="PCS" className="text-xs">
                          PIECES
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Qty Masuk</Label>
                    <Input
                      type="number"
                      value={bufferFormData.qty_in}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, qty_in: e.target.value })
                      }
                      placeholder="0"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Qty Keluar</Label>
                    <Input
                      type="number"
                      value={bufferFormData.qty_out}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, qty_out: e.target.value })
                      }
                      placeholder="0"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Stok Awal / Saat Ini</Label>
                    <Input
                      type="number"
                      value={bufferFormData.current_stock}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, current_stock: e.target.value })
                      }
                      placeholder="0"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Batas Minimum Stok</Label>
                    <Input
                      type="number"
                      value={bufferFormData.safe_stock}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, safe_stock: e.target.value })
                      }
                      placeholder="1"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Minimal Stok (Trigger Order)</Label>
                    <Input
                      type="number"
                      value={bufferFormData.min_stock}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, min_stock: e.target.value })
                      }
                      placeholder="10"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Maksimal Stok</Label>
                    <Input
                      type="number"
                      value={bufferFormData.max_stock}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, max_stock: e.target.value })
                      }
                      placeholder="opsional"
                      className="h-9 text-xs font-mono"
                    />
                  </div>
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label className="text-xs font-semibold">Keterangan (Opsional)</Label>
                    <Input
                      value={bufferFormData.description}
                      onChange={(e) =>
                        setBufferFormData({ ...bufferFormData, description: e.target.value })
                      }
                      placeholder="Keterangan tambahan..."
                      className="h-9 text-xs"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
                  <Button variant="outline" size="sm" onClick={() => setIsBufferAddOpen(false)}>
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => addBufferItem.mutate()}
                    disabled={addBufferItem.isPending || !bufferFormData.name.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    {addBufferItem.isPending ? "Menyimpan..." : "Simpan Buffer Stok"}
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 2: UPLOAD FILE EXCEL / CSV BUFFER STOK */}
              <TabsContent value="upload" className="mt-0 space-y-4">
                <input
                  type="file"
                  ref={bufferBulkFileInputRef}
                  accept=".csv,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBufferBulkFileSelect(f);
                  }}
                />

                {/* Tampilan Box Upload */}
                {!bufferImportFile ? (
                  <div className="rounded-xl border-2 border-dashed border-border p-6 text-center bg-surface hover:bg-surface-muted/60 transition-colors">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <FileSpreadsheet className="size-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Pilih File Excel / CSV (.xlsx, .xls, .csv)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Format kolom: <strong>Kode</strong>, <strong>Material</strong>,{" "}
                          <strong>Batas Minimal Stok</strong>, <strong>Minimal Stok</strong>,{" "}
                          <strong>Maks. Stok</strong>, dan <strong>Stok Saat Ini</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => bufferBulkFileInputRef.current?.click()}
                          className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                          <UploadCloud className="size-3.5" />
                          Pilih File Dokumen
                        </Button>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={downloadBufferImportTemplate}
                          className="gap-1.5 text-xs h-8 text-primary hover:text-primary hover:bg-primary/10 border-primary/25"
                        >
                          <Download className="size-3.5" />
                          Unduh Template Buffer (.xlsx)
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-600 dark:text-emerald-400">
                        <FileSpreadsheet className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300 text-sm truncate">
                          <Check className="size-4 shrink-0 text-emerald-600" />
                          <span className="truncate">{bufferImportFile.name}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Total {bufferImportPreview.length} item buffer terdeteksi &bull; Total
                          Stok:{" "}
                          {bufferImportPreview
                            .reduce((acc: number, it: any) => acc + (it.current_stock || 0), 0)
                            .toLocaleString("id-ID")}{" "}
                          pcs
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={downloadBufferImportTemplate}
                        className="h-7 px-2.5 text-xs gap-1 hover:bg-emerald-500/20"
                        title="Unduh format template buffer"
                      >
                        <Download className="size-3" />
                        Template
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => bufferBulkFileInputRef.current?.click()}
                        className="h-7 px-2.5 text-xs gap-1 hover:bg-emerald-500/20"
                      >
                        <UploadCloud className="size-3" />
                        Ganti File
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setBufferImportFile(null);
                          setBufferImportPreview([]);
                          setBufferImportSheets([]);
                          setBufferSelectedSheet("ALL");
                        }}
                        className="h-7 px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Hapus File"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Pemilih Sheet jika file memiliki banyak lembar kerja */}
                {bufferImportSheets.length > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          Pilih Lembar Kerja (Sheet)
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          File memiliki {bufferImportSheets.length} sheet dengan data yang siap
                          diimport
                        </p>
                      </div>
                    </div>
                    <Select
                      value={bufferSelectedSheet}
                      onValueChange={(val) => {
                        setBufferSelectedSheet(val);
                        const deduplicateBuf = (items: any[]) => {
                          const seen = new Set<string>();
                          const result: any[] = [];
                          for (const it of items) {
                            const nName = String(it.name || "")
                              .replace(/\u00a0/g, " ")
                              .replace(/\s+/g, " ")
                              .trim()
                              .toLowerCase();
                            const nCode = String(it.code || "")
                              .replace(/\u00a0/g, " ")
                              .replace(/\s+/g, " ")
                              .trim()
                              .toLowerCase();
                            const key = nName ? `n_${nName}` : nCode ? `c_${nCode}` : "";
                            if (!key || !seen.has(key)) {
                              if (key) seen.add(key);
                              result.push(it);
                            }
                          }
                          return result;
                        };
                        if (val === "ALL") {
                          const allItems = bufferImportSheets.flatMap((s) => s.items);
                          setBufferImportPreview(deduplicateBuf(allItems));
                        } else {
                          const target = bufferImportSheets.find((s) => s.name === val);
                          setBufferImportPreview(deduplicateBuf(target?.items || []));
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs min-w-[240px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem
                          value="ALL"
                          className="text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                        >
                          ✨ Gabungkan Semua Sheet (
                          {bufferImportSheets.reduce((a, b) => a + b.count, 0)} barang)
                        </SelectItem>
                        {bufferImportSheets.map((s) => (
                          <SelectItem key={s.name} value={s.name} className="text-xs">
                            {s.name} ({s.count} barang)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Pratinjau Data yang Terbaca */}
                {bufferImportPreview.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Check className="size-3.5 text-emerald-600" />
                        Pratinjau {sortedBufferImportPreview.length} Barang Buffer Terdeteksi
                      </span>

                      {/* Urutan Pratinjau Angka / Teks */}
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="size-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Urutkan:</span>
                        <Select
                          value={bufferImportSortOption}
                          onValueChange={setBufferImportSortOption}
                        >
                          <SelectTrigger className="h-8 text-xs min-w-[220px] bg-background font-medium">
                            <SelectValue placeholder="Urutkan..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DEFAULT" className="text-xs">
                              Sesuai File Excel (Default)
                            </SelectItem>
                            <SelectItem value="CODE_ASC" className="text-xs font-medium">
                              Kode (Angka Terkecil ke Terbesar)
                            </SelectItem>
                            <SelectItem value="CODE_DESC" className="text-xs font-medium">
                              Kode (Angka Terbesar ke Terkecil)
                            </SelectItem>
                            <SelectItem value="STOCK_ASC" className="text-xs">
                              Stok (Angka Terkecil ke Terbesar)
                            </SelectItem>
                            <SelectItem value="STOCK_DESC" className="text-xs">
                              Stok (Angka Terbesar ke Terkecil)
                            </SelectItem>
                            <SelectItem value="NAME_ASC" className="text-xs">
                              Nama Barang (A - Z)
                            </SelectItem>
                            <SelectItem value="NAME_DESC" className="text-xs">
                              Nama Barang (Z - A)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-lg border border-border text-xs bg-background">
                      <table className="w-full text-left border-collapse min-w-[600px]">
                        <thead className="bg-surface-muted text-[11px] font-semibold text-muted-foreground sticky top-0 z-10 border-b border-border">
                          <tr>
                            <th
                              className="p-2.5 w-12 text-center cursor-pointer hover:bg-surface-muted/80 transition-colors select-none"
                              onClick={() => setBufferImportSortOption("DEFAULT")}
                              title="Reset ke urutan asli file"
                            >
                              No
                            </th>
                            <th
                              className="p-2.5 w-36 text-center cursor-pointer hover:bg-surface-muted/80 transition-colors select-none"
                              onClick={() =>
                                setBufferImportSortOption(
                                  bufferImportSortOption === "CODE_ASC" ? "CODE_DESC" : "CODE_ASC",
                                )
                              }
                              title="Urutkan kode angka terkecil / terbesar"
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>Kode</span>
                                <ArrowUpDown
                                  className={`size-3 ${bufferImportSortOption.startsWith("CODE") ? "text-primary font-bold" : "text-muted-foreground/60"}`}
                                />
                              </div>
                            </th>
                            <th
                              className="p-2.5 min-w-[200px] cursor-pointer hover:bg-surface-muted/80 transition-colors select-none"
                              onClick={() =>
                                setBufferImportSortOption(
                                  bufferImportSortOption === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC",
                                )
                              }
                              title="Urutkan nama A-Z / Z-A"
                            >
                              <div className="flex items-center gap-1">
                                <span>Material</span>
                                <ArrowUpDown
                                  className={`size-3 ${bufferImportSortOption.startsWith("NAME") ? "text-primary font-bold" : "text-muted-foreground/60"}`}
                                />
                              </div>
                            </th>
                            <th
                              className="p-2.5 text-center w-28 cursor-pointer hover:bg-surface-muted/80 transition-colors select-none"
                              onClick={() =>
                                setBufferImportSortOption(
                                  bufferImportSortOption === "STOCK_ASC"
                                    ? "STOCK_DESC"
                                    : "STOCK_ASC",
                                )
                              }
                              title="Urutkan stok angka terkecil / terbesar"
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>Stok Saat Ini</span>
                                <ArrowUpDown
                                  className={`size-3 ${bufferImportSortOption.startsWith("STOCK") ? "text-primary font-bold" : "text-muted-foreground/60"}`}
                                />
                              </div>
                            </th>
                            <th className="p-2.5 text-center w-24">Min. Stok</th>
                            <th className="p-2.5 text-center w-24">Maks. Stok</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {sortedBufferImportPreview.slice(0, 100).map((it: any, idx: number) => (
                            <tr key={idx} className="hover:bg-surface-muted/50 transition-colors">
                              <td className="p-2.5 text-center text-muted-foreground font-mono">
                                {idx + 1}
                              </td>
                              <td className="p-2.5 text-center font-mono text-primary font-medium">
                                {it.code || "-"}
                              </td>
                              <td className="p-2.5 font-medium text-foreground">{it.name}</td>
                              <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {it.current_stock ?? 0} {it.unit || "pcs"}
                              </td>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">
                                {it.min_stock !== null && it.min_stock !== undefined
                                  ? `${it.min_stock} ${it.unit || "pcs"}`
                                  : "-"}
                              </td>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">
                                {it.max_stock !== null && it.max_stock !== undefined
                                  ? `${it.max_stock} ${it.unit || "pcs"}`
                                  : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between text-xs px-1 text-muted-foreground pt-1.5 border-t border-border/40">
                      <span>
                        Menampilkan {Math.min(sortedBufferImportPreview.length, 100)} dari seluruh{" "}
                        <strong>{sortedBufferImportPreview.length}</strong> barang buffer yang siap
                        ditambahkan
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        Total Stok:{" "}
                        {sortedBufferImportPreview
                          .reduce((acc: number, it: any) => acc + (it.current_stock || 0), 0)
                          .toLocaleString("id-ID")}{" "}
                        pcs
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setBufferImportFile(null);
                      setBufferImportPreview([]);
                      setBufferImportSheets([]);
                      setBufferSelectedSheet("ALL");
                      setBufferImportSortOption("DEFAULT");
                      setIsBufferAddOpen(false);
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    onClick={executeBufferBulkImport}
                    disabled={isBufferImporting || bufferImportPreview.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium"
                  >
                    <FileSpreadsheet className="size-4" />
                    {isBufferImporting
                      ? "Mengimport..."
                      : "Import " + bufferImportPreview.length + " Barang Buffer"}
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: EDIT BARANG BUFFER STOK ────────────────────────────── */}
      <Dialog
        open={!!editingBufferItem}
        onOpenChange={(o) => {
          if (!o) setEditingBufferItem(null);
        }}
      >
        <DialogContent className="sm:max-w-2xl w-full max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-lg font-bold">Edit Data Buffer Stok</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Perubahan hanya berlaku di tabel Buffer Stok, tidak mempengaruhi OBS Sparepart.
            </DialogDescription>
          </DialogHeader>
          {editingBufferItem && (
            <div className="flex-1 overflow-y-auto pr-1 mt-3">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold">Nama Barang *</Label>
                  <Input
                    value={editingBufferItem.name}
                    onChange={(e) =>
                      setEditingBufferItem({ ...editingBufferItem, name: e.target.value })
                    }
                    className="h-9 text-xs"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Kode Material</Label>
                  <Input
                    value={editingBufferItem.code || ""}
                    onChange={(e) =>
                      setEditingBufferItem({ ...editingBufferItem, code: e.target.value })
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Satuan (UoM)</Label>
                  <Select
                    value={editingBufferItem.unit || "Roll"}
                    onValueChange={(v) => setEditingBufferItem({ ...editingBufferItem, unit: v })}
                  >
                    <SelectTrigger className="h-9 text-xs">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Roll" className="text-xs">
                        Roll
                      </SelectItem>
                      <SelectItem value="Lmbr" className="text-xs">
                        Lmbr
                      </SelectItem>
                      <SelectItem value="CAN" className="text-xs">
                        CAN
                      </SelectItem>
                      <SelectItem value="PCS" className="text-xs">
                        PIECES
                      </SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Qty Masuk</Label>
                  <Input
                    type="number"
                    value={editingBufferItem.qty_in ?? ""}
                    onChange={(e) =>
                      setEditingBufferItem({
                        ...editingBufferItem,
                        qty_in: e.target.value !== "" ? Number(e.target.value) : "",
                      })
                    }
                    placeholder="0"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Qty Keluar</Label>
                  <Input
                    type="number"
                    value={editingBufferItem.qty_out ?? ""}
                    onChange={(e) =>
                      setEditingBufferItem({
                        ...editingBufferItem,
                        qty_out: e.target.value !== "" ? Number(e.target.value) : "",
                      })
                    }
                    placeholder="0"
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Stok Saat Ini</Label>
                  <Input
                    type="number"
                    value={editingBufferItem.current_stock ?? 0}
                    onChange={(e) =>
                      setEditingBufferItem({
                        ...editingBufferItem,
                        current_stock: Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label className="text-xs font-semibold">Batas Minimum</Label>
                  <Input
                    type="number"
                    value={editingBufferItem.safe_stock ?? 1}
                    onChange={(e) =>
                      setEditingBufferItem({
                        ...editingBufferItem,
                        safe_stock: Number(e.target.value),
                      })
                    }
                    className="h-9 text-xs font-mono"
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Minimal Stok</Label>
                    {!isAdmin && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        (Hanya Super Admin)
                      </span>
                    )}
                  </div>
                  <Input
                    type="number"
                    value={editingBufferItem.min_stock ?? 10}
                    disabled={!isAdmin}
                    onChange={(e) =>
                      setEditingBufferItem({
                        ...editingBufferItem,
                        min_stock: Number(e.target.value),
                      })
                    }
                    className={cn("h-9 text-xs font-mono", !isAdmin && "bg-muted/50 cursor-not-allowed opacity-80")}
                    title={!isAdmin ? "Hanya Super Admin yang dapat mengubah batas minimum stok" : undefined}
                  />
                </div>
                <div className="space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-semibold">Maksimal Stok</Label>
                    {!isAdmin && (
                      <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                        (Hanya Super Admin)
                      </span>
                    )}
                  </div>
                  <Input
                    type="number"
                    value={editingBufferItem.max_stock ?? ""}
                    disabled={!isAdmin}
                    onChange={(e) =>
                      setEditingBufferItem({
                        ...editingBufferItem,
                        max_stock: e.target.value ? Number(e.target.value) : null,
                      })
                    }
                    placeholder="opsional"
                    className={cn("h-9 text-xs font-mono", !isAdmin && "bg-muted/50 cursor-not-allowed opacity-80")}
                    title={!isAdmin ? "Hanya Super Admin yang dapat mengubah batas maksimal stok" : undefined}
                  />
                </div>
                <div className="space-y-1.5 sm:col-span-2">
                  <Label className="text-xs font-semibold">Keterangan</Label>
                  <Input
                    value={editingBufferItem.description || ""}
                    onChange={(e) =>
                      setEditingBufferItem({ ...editingBufferItem, description: e.target.value })
                    }
                    className="h-9 text-xs"
                  />
                </div>
              </div>
            </div>
          )}
          <div className="flex items-center justify-end gap-2 pt-4 border-t mt-2 shrink-0">
            <Button variant="outline" size="sm" onClick={() => setEditingBufferItem(null)}>
              Batal
            </Button>
            <Button
              size="sm"
              onClick={() => updateBufferItem.mutate()}
              disabled={updateBufferItem.isPending}
              className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
            >
              {updateBufferItem.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* ── MODAL KONFIRMASI HAPUS BUFFER STOK ───────────────────────────────── */}
      <AlertDialog
        open={!!deletingBufferItem}
        onOpenChange={(o) => {
          if (!o) setDeletingBufferItem(null);
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Item Buffer Stok?</AlertDialogTitle>
            <AlertDialogDescription>
              Item <strong>"{deletingBufferItem?.name}"</strong> akan dihapus dari buffer stok
              secara permanen. Tindakan ini tidak dapat dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => deletingBufferItem && deleteBufferItem.mutate(deletingBufferItem)}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── MODAL DIALOG: TAMBAH BARANG OBS SPAREPART ────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-lg font-bold">
              Tambah Data Barang OBS Sparepart
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tambahkan data master inventaris secara manual atau upload file Excel / CSV (khusus
              kategori Sparepart & Tools).
            </DialogDescription>
          </DialogHeader>

          {/* Tab Mode: Manual vs Upload File Excel/CSV */}
          <Tabs
            defaultValue="manual"
            className="w-full flex-1 flex flex-col min-h-0 overflow-hidden mt-3"
          >
            <div className="flex items-center justify-between border-b pb-2 mb-3 shrink-0">
              <TabsList className="grid w-72 grid-cols-2">
                <TabsTrigger value="manual" className="text-xs">
                  Manual Input
                </TabsTrigger>
                <TabsTrigger value="upload" className="text-xs gap-1.5">
                  <FileSpreadsheet className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Upload Excel/CSV
                </TabsTrigger>
              </TabsList>
            </div>

            {/* Container Scrollable Isi Tab */}
            <div className="flex-1 overflow-y-auto pr-1">
              {/* TAB 1: FORM MANUAL */}
              <TabsContent value="manual" className="mt-0 space-y-4">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs">
                  <div className="space-y-1.5 sm:col-span-2">
                    <Label htmlFor="add-name" className="text-xs font-semibold">
                      Nama Barang *
                    </Label>
                    <Input
                      id="add-name"
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      placeholder="cth. BEARING 6204-2RS / HEATER ELEMENT 2000W"
                      className="h-9 text-xs"
                      autoFocus
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="add-code" className="text-xs font-semibold">
                      Kode Material
                    </Label>
                    <Input
                      id="add-code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="cth. 7100110213 / SP-BRG-6204"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Satuan (UoM)</Label>
                    <Select
                      value={formData.unit}
                      onValueChange={(v) => setFormData({ ...formData, unit: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Roll" className="text-xs">
                          Roll
                        </SelectItem>
                        <SelectItem value="Lmbr" className="text-xs">
                          Lmbr
                        </SelectItem>
                        <SelectItem value="CAN" className="text-xs">
                          CAN
                        </SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Qty Masuk</Label>
                    <Input
                      type="number"
                      value={formData.qty_in}
                      onChange={(e) => setFormData({ ...formData, qty_in: e.target.value })}
                      placeholder="0"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Qty Keluar</Label>
                    <Input
                      type="number"
                      value={formData.qty_out}
                      onChange={(e) => setFormData({ ...formData, qty_out: e.target.value })}
                      placeholder="0"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Stok Awal / Saat Ini</Label>
                    <Input
                      type="number"
                      value={formData.current_stock}
                      onChange={(e) => setFormData({ ...formData, current_stock: e.target.value })}
                      placeholder="0"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Batas Minimum Stok</Label>
                    <Input
                      type="number"
                      value={formData.safe_stock}
                      onChange={(e) => setFormData({ ...formData, safe_stock: e.target.value })}
                      placeholder="1"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Minimal Stok</Label>
                    <Input
                      type="number"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                      placeholder="10"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold text-muted-foreground">
                      Maksimal Stok (Terkunci)
                    </Label>
                    <Input
                      type="number"
                      value={formData.max_stock}
                      placeholder="Terkunci (atur via Edit Barang)"
                      disabled
                      className="h-9 text-xs font-mono bg-muted/40 cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="flex items-center justify-end gap-2 pt-4 border-t mt-4">
                  <Button variant="outline" size="sm" onClick={() => setIsAddOpen(false)}>
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    onClick={() => addProduct.mutate()}
                    disabled={addProduct.isPending || !formData.name.trim()}
                    className="bg-primary hover:bg-primary/90 text-primary-foreground font-medium"
                  >
                    {addProduct.isPending ? "Menyimpan..." : "Simpan Barang"}
                  </Button>
                </div>
              </TabsContent>

              {/* TAB 2: UPLOAD FILE EXCEL / CSV */}
              <TabsContent value="upload" className="mt-0 space-y-4">
                <input
                  type="file"
                  ref={bulkFileInputRef}
                  accept=".csv,.xls,.xlsx,.txt"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) handleBulkFileSelect(f);
                  }}
                />

                {/* Tampilan Box Upload */}
                {!importFile ? (
                  <div className="rounded-xl border-2 border-dashed border-border p-6 text-center bg-surface hover:bg-surface-muted/60 transition-colors">
                    <div className="flex flex-col items-center justify-center gap-2.5">
                      <div className="flex size-12 items-center justify-center rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
                        <FileSpreadsheet className="size-6" />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-foreground">
                          Pilih File Excel / CSV (.xlsx, .xls, .csv)
                        </p>
                        <p className="text-xs text-muted-foreground mt-1">
                          Format kolom yang didukung: <strong>Kode</strong>,{" "}
                          <strong>Material</strong>, <strong>Satuan</strong>,{" "}
                          <strong>BEGINNING BALANCE</strong>, <strong>RECEIPT</strong>,{" "}
                          <strong>ISSUED</strong>, <strong>ENDING BALANCE</strong>, dan{" "}
                          <strong>Maks. Stock</strong>
                        </p>
                      </div>

                      <div className="flex flex-wrap items-center justify-center gap-2.5 mt-2">
                        <Button
                          type="button"
                          size="sm"
                          variant="default"
                          onClick={() => bulkFileInputRef.current?.click()}
                          className="gap-1.5 text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-medium"
                        >
                          <UploadCloud className="size-3.5" />
                          Pilih File Dokumen
                        </Button>
                      </div>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center justify-between rounded-xl border border-emerald-500/30 bg-emerald-500/10 px-4 py-3 text-xs">
                    <div className="flex items-center gap-3 min-w-0 pr-2">
                      <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-emerald-600/20 text-emerald-600 dark:text-emerald-400">
                        <FileSpreadsheet className="size-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5 font-semibold text-emerald-800 dark:text-emerald-300 text-sm truncate">
                          <Check className="size-4 shrink-0 text-emerald-600" />
                          <span className="truncate">{importFile.name}</span>
                        </div>
                        <p className="text-[11px] text-muted-foreground mt-0.5">
                          Total {importPreview.length} item barang terdeteksi • Total Ending
                          Balance:{" "}
                          {importPreview
                            .reduce(
                              (acc, it) => acc + (it.ending_balance ?? it.current_stock ?? 0),
                              0,
                            )
                            .toLocaleString("id-ID")}{" "}
                          pcs
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={downloadImportTemplate}
                        className="h-7 px-2.5 text-xs gap-1 hover:bg-emerald-500/20"
                        title="Unduh format template"
                      >
                        <Download className="size-3" />
                        Template
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        onClick={() => bulkFileInputRef.current?.click()}
                        className="h-7 px-2.5 text-xs gap-1 hover:bg-emerald-500/20"
                      >
                        <UploadCloud className="size-3" />
                        Ganti File
                      </Button>
                      <Button
                        type="button"
                        size="sm"
                        variant="ghost"
                        onClick={() => {
                          setImportFile(null);
                          setImportPreview([]);
                          setImportSheets([]);
                          setSelectedSheet("ALL");
                        }}
                        className="h-7 px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Hapus File"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Pemilih Sheet jika file memiliki banyak lembar kerja */}
                {importSheets.length > 1 && (
                  <div className="flex flex-wrap items-center justify-between gap-2.5 p-3 rounded-xl border border-emerald-500/20 bg-emerald-500/5">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
                        <Layers className="size-4" />
                      </div>
                      <div>
                        <p className="text-xs font-semibold text-foreground">
                          Pilih Lembar Kerja (Sheet)
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          File memiliki {importSheets.length} sheet dengan data yang siap diimport
                        </p>
                      </div>
                    </div>
                    <Select
                      value={selectedSheet}
                      onValueChange={(val) => {
                        setSelectedSheet(val);
                        const deduplicateProd = (items: any[]) => {
                          const seen = new Set<string>();
                          const result: any[] = [];
                          for (const it of items) {
                            const nName = String(it.name || "")
                              .replace(/\u00a0/g, " ")
                              .replace(/\s+/g, " ")
                              .trim()
                              .toLowerCase();
                            const nCode = String(it.code || "")
                              .replace(/\u00a0/g, " ")
                              .replace(/\s+/g, " ")
                              .trim()
                              .toLowerCase();
                            const key = nName ? `n_${nName}` : nCode ? `c_${nCode}` : "";
                            if (!key || !seen.has(key)) {
                              if (key) seen.add(key);
                              result.push(it);
                            }
                          }
                          return result;
                        };
                        if (val === "ALL") {
                          const allItems = importSheets.flatMap((s) => s.items);
                          setImportPreview(deduplicateProd(allItems));
                        } else {
                          const target = importSheets.find((s) => s.name === val);
                          setImportPreview(deduplicateProd(target?.items || []));
                        }
                      }}
                    >
                      <SelectTrigger className="h-8 text-xs min-w-[240px] bg-background">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem
                          value="ALL"
                          className="text-xs font-semibold text-emerald-700 dark:text-emerald-400"
                        >
                          ✨ Gabungkan Semua Sheet ({importSheets.reduce((a, b) => a + b.count, 0)}{" "}
                          barang)
                        </SelectItem>
                        {importSheets.map((s) => (
                          <SelectItem key={s.name} value={s.name} className="text-xs">
                            {s.name} ({s.count} barang)
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Pratinjau Data yang Terbaca */}
                {importPreview.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Check className="size-3.5 text-emerald-600" />
                        Pratinjau {sortedImportPreview.length} Barang Terdeteksi
                      </span>

                      {/* Urutan Pratinjau Angka / Teks */}
                      <div className="flex items-center gap-1.5">
                        <ArrowUpDown className="size-3.5 text-muted-foreground" />
                        <span className="text-xs text-muted-foreground">Urutkan:</span>
                        <Select value={importSortOption} onValueChange={setImportSortOption}>
                          <SelectTrigger className="h-8 text-xs min-w-[220px] bg-background font-medium">
                            <SelectValue placeholder="Urutkan..." />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="DEFAULT" className="text-xs">
                              Sesuai File Excel (Default)
                            </SelectItem>
                            <SelectItem value="CODE_ASC" className="text-xs font-medium">
                              Kode (Angka Terkecil ke Terbesar)
                            </SelectItem>
                            <SelectItem value="CODE_DESC" className="text-xs font-medium">
                              Kode (Angka Terbesar ke Terkecil)
                            </SelectItem>
                            <SelectItem value="STOCK_ASC" className="text-xs">
                              Ending Balance (Terkecil ke Terbesar)
                            </SelectItem>
                            <SelectItem value="STOCK_DESC" className="text-xs">
                              Ending Balance (Terbesar ke Terkecil)
                            </SelectItem>
                            <SelectItem value="NAME_ASC" className="text-xs">
                              Nama Barang (A - Z)
                            </SelectItem>
                            <SelectItem value="NAME_DESC" className="text-xs">
                              Nama Barang (Z - A)
                            </SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-lg border border-border text-xs bg-background">
                      <table className="w-full text-left border-collapse min-w-[840px]">
                        <thead className="bg-[#0f274a] text-white text-[11px] font-semibold sticky top-0 z-10 border-b border-border">
                          <tr>
                            <th
                              className="p-2.5 w-12 text-center cursor-pointer hover:bg-[#1a3a66] transition-colors select-none text-white font-semibold"
                              onClick={() => setImportSortOption("DEFAULT")}
                              title="Reset ke urutan asli file"
                            >
                              No
                            </th>
                            <th
                              className="p-2.5 w-36 text-center cursor-pointer hover:bg-[#1a3a66] transition-colors select-none text-white font-semibold"
                              onClick={() =>
                                setImportSortOption(
                                  importSortOption === "CODE_ASC" ? "CODE_DESC" : "CODE_ASC",
                                )
                              }
                              title="Urutkan kode angka terkecil / terbesar"
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>Kode</span>
                                <ArrowUpDown
                                  className={`size-3 ${importSortOption.startsWith("CODE") ? "text-amber-300 font-bold" : "text-white/60"}`}
                                />
                              </div>
                            </th>
                            <th
                              className="p-2.5 min-w-[200px] cursor-pointer hover:bg-[#1a3a66] transition-colors select-none text-white font-semibold"
                              onClick={() =>
                                setImportSortOption(
                                  importSortOption === "NAME_ASC" ? "NAME_DESC" : "NAME_ASC",
                                )
                              }
                              title="Urutkan nama A-Z / Z-A"
                            >
                              <div className="flex items-center gap-1">
                                <span>Material</span>
                                <ArrowUpDown
                                  className={`size-3 ${importSortOption.startsWith("NAME") ? "text-amber-300 font-bold" : "text-white/60"}`}
                                />
                              </div>
                            </th>
                            <th className="p-2.5 text-center w-20 font-semibold text-white">
                              Satuan
                            </th>
                            <th className="p-2.5 text-center w-36 font-semibold text-white">
                              BEGINNING BALANCE
                            </th>
                            <th className="p-2.5 text-center w-28 font-semibold text-white">
                              RECEIPT
                            </th>
                            <th className="p-2.5 text-center w-28 font-semibold text-white">
                              ISSUED
                            </th>
                            <th
                              className="p-2.5 text-center w-36 cursor-pointer hover:bg-[#1a3a66] transition-colors select-none text-white font-semibold"
                              onClick={() =>
                                setImportSortOption(
                                  importSortOption === "STOCK_ASC" ? "STOCK_DESC" : "STOCK_ASC",
                                )
                              }
                              title="Urutkan ending balance angka terkecil / terbesar"
                            >
                              <div className="flex items-center justify-center gap-1">
                                <span>ENDING BALANCE</span>
                                <ArrowUpDown
                                  className={`size-3 ${importSortOption.startsWith("STOCK") ? "text-amber-300 font-bold" : "text-white/60"}`}
                                />
                              </div>
                            </th>
                            <th className="p-2.5 text-center w-28 font-semibold text-white">
                              Maks. Stock
                            </th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {sortedImportPreview.slice(0, 100).map((it, idx) => (
                            <tr key={idx} className="hover:bg-surface-muted/50 transition-colors">
                              <td className="p-2.5 text-center text-muted-foreground font-mono">
                                {idx + 1}
                              </td>
                              <td className="p-2.5 text-center font-mono text-primary font-medium">
                                {it.code || "-"}
                              </td>
                              <td className="p-2.5 font-medium text-foreground">{it.name}</td>
                              <td className="p-2.5 text-center font-mono font-semibold uppercase text-slate-700 dark:text-slate-300">
                                <span className="bg-slate-100 dark:bg-slate-800 px-1.5 py-0.5 rounded text-[11px] border border-slate-200 dark:border-slate-700">
                                  {it.unit || "pcs"}
                                </span>
                              </td>
                              <td className="p-2.5 text-center font-mono font-semibold text-slate-700 dark:text-slate-300">
                                {Number(it.beginning_balance ?? 0).toLocaleString("id-ID")}
                              </td>
                              <td className="p-2.5 text-center font-mono font-semibold text-emerald-600 dark:text-emerald-400">
                                {Number(it.receipt ?? 0).toLocaleString("id-ID")}
                              </td>
                              <td className="p-2.5 text-center font-mono font-semibold text-rose-600 dark:text-rose-400">
                                {Number(it.issued ?? 0).toLocaleString("id-ID")}
                              </td>
                              <td className="p-2.5 text-center font-mono font-bold text-emerald-700 dark:text-emerald-300">
                                {Number(it.ending_balance ?? it.current_stock ?? 0).toLocaleString(
                                  "id-ID",
                                )}
                              </td>
                              <td className="p-2.5 text-center font-mono font-medium text-slate-700 dark:text-slate-300">
                                {it.max_stock !== null && it.max_stock !== undefined
                                  ? Number(it.max_stock).toLocaleString("id-ID")
                                  : "—"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between text-xs px-1 text-muted-foreground pt-1.5 border-t border-border/40">
                      <span>
                        Menampilkan {Math.min(sortedImportPreview.length, 100)} dari seluruh{" "}
                        <strong>{sortedImportPreview.length}</strong> barang yang siap ditambahkan
                      </span>
                      <span className="font-mono font-bold text-foreground">
                        Total Ending Balance:{" "}
                        {sortedImportPreview
                          .reduce(
                            (acc, it) => acc + (it.ending_balance ?? it.current_stock ?? 0),
                            0,
                          )
                          .toLocaleString("id-ID")}{" "}
                        pcs
                      </span>
                    </div>
                  </div>
                )}

                <div className="flex items-center justify-end gap-2 pt-4 border-t">
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      setImportFile(null);
                      setImportPreview([]);
                      setImportSheets([]);
                      setSelectedSheet("ALL");
                      setIsAddOpen(false);
                    }}
                  >
                    Batal
                  </Button>
                  <Button
                    size="sm"
                    onClick={executeBulkImport}
                    disabled={isImporting || importPreview.length === 0}
                    className="bg-emerald-600 hover:bg-emerald-700 text-white gap-1.5 font-medium"
                  >
                    <FileSpreadsheet className="size-4" />
                    {isImporting ? "Mengimport..." : "Import " + importPreview.length + " Barang"}
                  </Button>
                </div>
              </TabsContent>
            </div>
          </Tabs>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: EDIT BARANG ─────────────────────────────────────────── */}
      <Dialog open={!!editingItem} onOpenChange={(open) => !open && setEditingItem(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <DialogTitle>Edit Data Barang</DialogTitle>
            <DialogDescription>Perbarui informasi master barang dan lokasi rak.</DialogDescription>
          </DialogHeader>
          {editingItem && (
            <div className="grid grid-cols-2 gap-4 py-2 text-sm">
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Nama Barang *</Label>
                <Input
                  value={editingItem.name}
                  onChange={(e) => setEditingItem({ ...editingItem, name: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Kode Material</Label>
                <Input
                  value={editingItem.code || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, code: e.target.value })}
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Satuan (UoM)</Label>
                <Select
                  value={editingItem.unit || "Roll"}
                  onValueChange={(v) => setEditingItem({ ...editingItem, unit: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Roll">Roll</SelectItem>
                    <SelectItem value="Lmbr">Lmbr</SelectItem>
                    <SelectItem value="CAN">CAN</SelectItem>
                    <SelectItem value="PCS">Pieces</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <Label>Stok Saat Ini</Label>
                <Input
                  type="number"
                  value={editingItem.current_stock ?? ""}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      current_stock: e.target.value !== "" ? Number(e.target.value) : 0,
                    })
                  }
                  placeholder="Contoh: 0"
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <Label>Batas Minimum Stok</Label>
                  {!isAdmin && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      (Hanya Super Admin)
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  value={editingItem.min_stock ?? 10}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setEditingItem({ ...editingItem, min_stock: Number(e.target.value) })
                  }
                  placeholder="Contoh: 10"
                  className={cn(!isAdmin && "bg-muted/50 cursor-not-allowed opacity-80")}
                  title={!isAdmin ? "Hanya Super Admin yang dapat mengubah batas minimum stok" : undefined}
                />
              </div>
              <div className="space-y-1.5 col-span-2 sm:col-span-1">
                <div className="flex items-center justify-between">
                  <Label>Maksimal Stok</Label>
                  {!isAdmin && (
                    <span className="text-[10px] text-amber-600 dark:text-amber-400 font-medium">
                      (Hanya Super Admin)
                    </span>
                  )}
                </div>
                <Input
                  type="number"
                  value={editingItem.max_stock ?? ""}
                  disabled={!isAdmin}
                  onChange={(e) =>
                    setEditingItem({
                      ...editingItem,
                      max_stock: e.target.value ? Number(e.target.value) : null,
                    })
                  }
                  placeholder="Contoh: 50 (opsional)"
                  className={cn(!isAdmin && "bg-muted/50 cursor-not-allowed opacity-80")}
                  title={!isAdmin ? "Hanya Super Admin yang dapat mengubah batas maksimal stok" : undefined}
                />
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Batal
            </Button>
            <Button
              onClick={() => updateProduct.mutate()}
              disabled={updateProduct.isPending}
              className="bg-primary hover:bg-primary/90 min-w-[80px]"
            >
              {updateProduct.isPending ? "Saving..." : "Save"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: PENCATATAN TRANSAKSI MASUK / KELUAR ─────────────────── */}
      <Dialog open={isTxOpen} onOpenChange={setIsTxOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {txType === "IN" ? "Catat Barang Masuk (Inbound)" : "Catat Barang Keluar (Outbound)"}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2 text-sm">
            {/* Bagian List Barang (Multi-item hingga 15) */}
            <div className="space-y-3 rounded-lg border border-border bg-surface-muted/30 p-3.5">
              <div className="flex items-center justify-between">
                <div>
                  <Label className="text-xs font-bold uppercase tracking-wider text-foreground">
                    Daftar Barang ({txItems.length}/15 Barang)
                  </Label>
                  <p className="text-[11px] text-muted-foreground">
                    Pilih barang dan tentukan kuantitas yang dicatat
                  </p>
                </div>
                {txItems.length < 15 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => {
                      if (txItems.length < 15) {
                        setTxItems([...txItems, { productId: "", quantity: "1", unit: "kg" }]);
                      }
                    }}
                    className="h-7 text-xs gap-1 border-primary/30 text-primary hover:bg-primary/10"
                  >
                    <Plus className="size-3.5" />
                    Tambah Barang
                  </Button>
                )}
              </div>

              <div className="space-y-2.5">
                {txItems.map((item, idx) => {
                  const selectedProd = products.find((p) => p.id === item.productId);
                  return (
                    <div
                      key={idx}
                      className="flex flex-col gap-2 rounded-md border border-border/80 bg-surface p-2.5 sm:flex-row sm:items-end"
                    >
                      {/* Nomor Urut Item */}
                      <div className="flex items-center gap-1 sm:hidden">
                        <Badge variant="outline" className="text-[10px]">
                          Barang #{idx + 1}
                        </Badge>
                      </div>

                      {/* Search & Pilih Barang */}
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs font-medium">
                          Cari & Pilih Barang #{idx + 1} *
                        </Label>
                        <ProductSearchCombobox
                          products={products}
                          value={item.productId}
                          itemNumber={idx + 1}
                          onChange={(productId, unit) => {
                            setTxItems((prev) =>
                              prev.map((it, i) =>
                                i === idx ? { productId, unit, quantity: it.quantity } : it,
                              ),
                            );
                          }}
                        />
                      </div>

                      {/* Jumlah Kuantitas */}
                      <div className="w-full sm:w-28 space-y-1">
                        <Label className="text-xs font-medium">Jumlah *</Label>
                        <Input
                          type="number"
                          min="0.01"
                          step="any"
                          value={item.quantity}
                          onChange={(e) => {
                            const newQty = e.target.value;
                            setTxItems((prev) =>
                              prev.map((it, i) =>
                                i === idx
                                  ? { productId: it.productId, unit: it.unit, quantity: newQty }
                                  : it,
                              ),
                            );
                          }}
                          placeholder="cth. 10"
                          className="h-9 text-xs"
                        />
                      </div>

                      {/* Satuan (Readonly) */}
                      <div className="w-full sm:w-24 space-y-1">
                        <Label className="text-xs font-medium">Satuan</Label>
                        <Input
                          value={item.unit}
                          disabled
                          className="h-9 text-xs bg-surface-muted/60 text-muted-foreground font-mono"
                        />
                      </div>

                      {/* Tombol Hapus Baris (jika > 1) */}
                      {txItems.length > 1 && (
                        <div className="flex justify-end sm:pb-0.5">
                          <Button
                            type="button"
                            variant="ghost"
                            size="icon"
                            onClick={() => {
                              const updated = txItems.filter((_, i) => i !== idx);
                              setTxItems(updated);
                            }}
                            className="size-8 text-muted-foreground hover:text-destructive hover:bg-destructive/10 shrink-0"
                            title="Hapus baris barang ini"
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Info bila mencapai batas 15 barang */}
              {txItems.length >= 15 && (
                <p className="text-[11px] text-amber-600 dark:text-amber-400 font-medium">
                  * Telah mencapai batas maksimal 15 barang dalam satu pencatatan mutasi.
                </p>
              )}
            </div>

            {/* Form Informasi Tambahan Mutasi */}
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <Label>{txType === "IN" ? "Tanggal Terima" : "Tanggal Keluar"}</Label>
                <Input
                  type="date"
                  value={txHeader.batchNumber || new Date().toISOString().split("T")[0]}
                  onChange={(e) => setTxHeader({ ...txHeader, batchNumber: e.target.value })}
                  className="h-9 text-xs"
                />
              </div>
              <div className="space-y-1.5">
                <Label>No. Referensi (PO / SPK / Surat Jalan)</Label>
                <Input
                  value={txHeader.referenceNo}
                  onChange={(e) => setTxHeader({ ...txHeader, referenceNo: e.target.value })}
                  placeholder="cth. SJ-99120"
                  className="h-9 text-xs"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>{txType === "IN" ? "Nama Vendor" : "Alasan Permintaan Barang"}</Label>
              <Input
                value={txHeader.supplierOrDest}
                onChange={(e) => setTxHeader({ ...txHeader, supplierOrDest: e.target.value })}
                placeholder={
                  txType === "IN"
                    ? "cth. PT Kopi Nusantara"
                    : "cth. Penggantian Bearing Rusak Line Roasting 1"
                }
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Petugas Sparepart Shift 1/2/3</Label>
              <Input
                value={txHeader.notes}
                onChange={(e) => setTxHeader({ ...txHeader, notes: e.target.value })}
                placeholder="contoh: Shift 1 / Sultan"
                className="h-9 text-xs"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsTxOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => createTransaction.mutate()}
              disabled={createTransaction.isPending || txItems.every((it) => !it.productId)}
              className={
                txType === "IN"
                  ? "bg-emerald-600 hover:bg-emerald-700"
                  : "bg-rose-600 hover:bg-rose-700"
              }
            >
              {createTransaction.isPending
                ? "Menyimpan..."
                : `Simpan ${txItems.filter((it) => it.productId).length || 1} Barang ${txType === "IN" ? "Masuk" : "Keluar"}`}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: HAPUS BARANG ────────────────────────────────────────── */}
      <AlertDialog open={!!deletingItem} onOpenChange={(open) => !open && setDeletingItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Data Barang?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus barang{" "}
              <strong>&ldquo;{deletingItem?.name}&rdquo;</strong>? Tindakan ini tidak dapat
              dibatalkan.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingItem && deleteProduct.mutate(deletingItem)}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* ── MODAL DIALOG: DETAIL TRANSAKSI MUTASI ────────────────────────────── */}
      <Dialog open={!!selectedTx} onOpenChange={(open) => !open && setSelectedTx(null)}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-4">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Detail Transaksi Mutasi</span>
                {selectedTx && (
                  <Badge
                    variant={selectedTx.tx_type === "IN" ? "default" : "destructive"}
                    className={cn(
                      "text-[10px] font-mono uppercase",
                      selectedTx.tx_type === "IN"
                        ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                        : "bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                    )}
                  >
                    {selectedTx.tx_type === "IN" ? "Barang Masuk" : "Barang Keluar"}
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Informasi lengkap bon perpindahan stok barang inventaris
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 py-2">
              {/* Info Header Bon */}
              <div className="rounded-lg border border-border bg-surface-muted/40 p-3.5 space-y-3">
                <div className="grid grid-cols-2 gap-3 text-xs">
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {selectedTx.tx_type === "IN" ? "Tanggal Terima:" : "Tanggal Keluar:"}
                    </span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {selectedTx.batch_number
                        ? formatDate(selectedTx.batch_number)
                        : formatDate(selectedTx.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">User:</span>
                    <span className="font-medium text-foreground">
                      {selectedTx.created_by_name || "Warehouse Sparepart"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {selectedTx.tx_type === "IN"
                        ? "Vendor / Supplier:"
                        : "Alasan Permintaan / Tujuan:"}
                    </span>
                    <span className="font-medium text-foreground">
                      {selectedTx.supplier_or_dest || "—"}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Tanggal Pencatatan:
                    </span>
                    <span className="font-mono font-bold text-foreground text-sm">
                      {formatDate(selectedTx.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      Petugas Sparepart Shift 1/2/3:
                    </span>
                    <span className="font-medium text-foreground">
                      {selectedTx.notes || selectedTx.reference_no || "—"}
                    </span>
                  </div>
                  {selectedTx.tx_type === "IN" && (
                    <div>
                      <span className="text-muted-foreground block text-[11px]">No. PO:</span>
                      <span className="font-mono font-semibold text-foreground">
                        {selectedTx.reference_no || "—"}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              {/* Daftar Barang Dalam Bon */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-foreground flex items-center justify-between">
                  <span>Daftar Sparepart Terdaftar ({selectedTx.items.length} item):</span>
                </div>
                <div className="rounded-lg border border-border bg-surface overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                        <th className="px-3 py-2 text-left w-8">No</th>
                        <th className="px-3 py-2 text-left">Nama Sparepart</th>
                        <th className="px-3 py-2 text-right w-24">Jumlah</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border/60">
                      {selectedTx.items.map((it, idx) => (
                        <tr key={it.id || idx} className="hover:bg-surface-muted/30">
                          <td className="px-3 py-2 text-muted-foreground font-mono">{idx + 1}</td>
                          <td className="px-3 py-2 font-medium text-foreground">
                            {it.product_name}
                          </td>
                          <td className="px-3 py-2 text-right font-mono font-bold">
                            <span
                              className={
                                selectedTx.tx_type === "IN"
                                  ? "text-emerald-600 dark:text-emerald-400"
                                  : "text-rose-600 dark:text-rose-400"
                              }
                            >
                              {selectedTx.tx_type === "IN" ? "+" : "-"}
                              {it.quantity} {it.unit || "pcs"}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row justify-between sm:justify-end items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedTx(null)}>
              Tutup
            </Button>
            {selectedTx && (
              <Button
                size="sm"
                onClick={() => downloadTransactionPDF(selectedTx)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Unduh Dokumen PDF</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: DETAIL BARANG & SPESIFIKASI BUFFER STOK ─────────────── */}
      <Dialog open={!!selectedProduct} onOpenChange={(open) => !open && setSelectedProduct(null)}>
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-4">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Detail Spesifikasi Barang</span>
                {selectedProduct && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedProduct.code || "SPAREPART"}
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Informasi lengkap master sparepart dan parameter buffer stok
            </DialogDescription>
          </DialogHeader>

          {selectedProduct &&
            (() => {
              const current = selectedProduct.current_stock ?? 0;
              const minStock = selectedProduct.min_stock ?? 10;
              const rawMax = (selectedProduct as any).max_stock;
              const maxStock =
                rawMax !== null && rawMax !== undefined && rawMax !== "" ? Number(rawMax) : null;

              let kondisiText = "SAFETY STOK";
              let kondisiBadgeClass =
                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
              let stokSaatIniBoxClass =
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

              if (maxStock !== null && !isNaN(maxStock) && current > maxStock) {
                kondisiText = "OUT OF STOK";
                kondisiBadgeClass =
                  "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
                stokSaatIniBoxClass =
                  "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
              } else if (current <= minStock) {
                kondisiText = "ORDER";
                kondisiBadgeClass =
                  "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
                stokSaatIniBoxClass =
                  "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400";
              }

              const formattedDate = selectedProduct.created_at
                ? new Date(selectedProduct.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "23 September 2026";

              return (
                <div className="space-y-4 py-2 text-xs">
                  {/* Info Utama Layout Baru */}
                  <div className="rounded-lg border border-border bg-surface-muted/40 p-3.5 space-y-3">
                    {/* 1. Tanggal Input Header */}
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarIcon className="size-3.5 text-primary shrink-0" />
                        <span>Tanggal Input:</span>
                        <span className="font-semibold text-foreground">{formattedDate}</span>
                      </div>
                    </div>

                    {/* 2. Nama Material > Kode Material */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Nama Material / Sparepart:
                        </span>
                        <span className="text-sm font-bold text-foreground leading-tight block">
                          {selectedProduct.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Kode Material:
                        </span>
                        <span className="font-mono font-bold text-sm text-foreground">
                          {selectedProduct.code || "—"}
                        </span>
                      </div>
                    </div>

                    {/* 3. Status Kondisi */}
                    <div className="flex items-center gap-3 pt-2 border-t border-border/60">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Status Kondisi:
                        </span>
                        <div className="mt-1">
                          <Badge
                            className={cn("text-[10px] font-bold uppercase", kondisiBadgeClass)}
                          >
                            {kondisiText}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parameter Buffer Stok */}
                  <div className="space-y-1.5">
                    <div className="font-semibold text-foreground">Parameter OBS Sparepart:</div>
                    <div className="grid grid-cols-3 gap-2 text-center">
                      <div className="p-2 rounded border border-rose-500/30 bg-rose-500/5">
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                          Min. Stok (Order)
                        </div>
                        <div className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400 mt-0.5">
                          {minStock} {selectedProduct.unit || "pcs"}
                        </div>
                      </div>
                      <div className="p-2 rounded border border-border bg-surface">
                        <div className="text-[10px] text-muted-foreground">Maks. Stok</div>
                        <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                          {maxStock !== null && !isNaN(maxStock)
                            ? `${maxStock} ${selectedProduct.unit || "pcs"}`
                            : "—"}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "p-2 rounded border text-center transition-colors",
                          stokSaatIniBoxClass,
                        )}
                      >
                        <div className="text-[10px] font-medium">Stok Saat Ini</div>
                        <div className="font-mono font-bold text-sm mt-0.5">
                          {current} {selectedProduct.unit || "pcs"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deskripsi Tambahan jika ada */}
                  {selectedProduct.description && (
                    <div className="space-y-1">
                      <div className="font-semibold text-foreground">
                        Deskripsi / Catatan Teknis:
                      </div>
                      <p className="p-2.5 rounded border border-border bg-surface text-muted-foreground leading-relaxed">
                        {selectedProduct.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

          <DialogFooter className="flex flex-col-reverse sm:flex-row justify-between sm:justify-end items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedProduct(null)}>
              Tutup
            </Button>
            {selectedProduct && canManageWarehouse && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingItem(selectedProduct);
                  setSelectedProduct(null);
                }}
                className="gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60 font-medium text-xs"
                title="Edit data master barang & batas stok"
              >
                <Pencil className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>Edit Barang</span>
              </Button>
            )}
            {selectedProduct && (
              <Button
                size="sm"
                onClick={() => downloadProductPDF(selectedProduct)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Unduh Kartu Kontrol PDF</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: DETAIL BARANG BUFFER STOK (4 KOTAK PARAMETER) ───────── */}
      <Dialog
        open={!!selectedBufferItem}
        onOpenChange={(open) => !open && setSelectedBufferItem(null)}
      >
        <DialogContent className="max-w-xl">
          <DialogHeader>
            <div className="flex items-center justify-between gap-2 pr-4">
              <DialogTitle className="text-base font-bold flex items-center gap-2">
                <span>Detail Spesifikasi Barang</span>
                {selectedBufferItem && (
                  <Badge variant="outline" className="font-mono text-xs">
                    {selectedBufferItem.code || "BUFFER"}
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Informasi lengkap master sparepart dan parameter buffer stok
            </DialogDescription>
          </DialogHeader>

          {selectedBufferItem &&
            (() => {
              const current = selectedBufferItem.current_stock ?? 0;
              const minStock = selectedBufferItem.min_stock ?? 10;
              const safeStock = selectedBufferItem.safe_stock ?? 1;
              const rawMax = (selectedBufferItem as any).max_stock;
              const maxStock =
                rawMax !== null && rawMax !== undefined && rawMax !== "" ? Number(rawMax) : null;

              let kondisiText = "SAFETY STOK";
              let kondisiBadgeClass =
                "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30";
              let stokSaatIniBoxClass =
                "border-emerald-500/30 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";

              if (maxStock !== null && !isNaN(maxStock) && current > maxStock) {
                kondisiText = "OUT OF STOK";
                kondisiBadgeClass =
                  "bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30";
                stokSaatIniBoxClass =
                  "border-amber-500/30 bg-amber-500/10 text-amber-600 dark:text-amber-400";
              } else if (current <= minStock) {
                kondisiText = "ORDER";
                kondisiBadgeClass =
                  "bg-rose-500/15 text-rose-700 dark:text-rose-300 border-rose-500/30";
                stokSaatIniBoxClass =
                  "border-rose-500/30 bg-rose-500/10 text-rose-600 dark:text-rose-400";
              }

              const formattedDate = selectedBufferItem.created_at
                ? new Date(selectedBufferItem.created_at).toLocaleDateString("id-ID", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })
                : "23 September 2026";

              return (
                <div className="space-y-4 py-2 text-xs">
                  {/* Info Utama Layout Baru */}
                  <div className="rounded-lg border border-border bg-surface-muted/40 p-3.5 space-y-3">
                    {/* 1. Tanggal Input Header */}
                    <div className="flex items-center justify-between border-b border-border/60 pb-2 text-[11px]">
                      <div className="flex items-center gap-1.5 text-muted-foreground">
                        <CalendarIcon className="size-3.5 text-primary shrink-0" />
                        <span>Tanggal Input:</span>
                        <span className="font-semibold text-foreground">{formattedDate}</span>
                      </div>
                    </div>

                    {/* 2. Nama Material > Kode Material */}
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Nama Material / Sparepart:
                        </span>
                        <span className="text-sm font-bold text-foreground leading-tight block">
                          {selectedBufferItem.name}
                        </span>
                      </div>
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Kode Material:
                        </span>
                        <span className="font-mono font-bold text-sm text-foreground">
                          {selectedBufferItem.code || "—"}
                        </span>
                      </div>
                    </div>

                    {/* 3. Status Kondisi */}
                    <div className="flex items-center gap-3 pt-2 border-t border-border/60">
                      <div>
                        <span className="text-muted-foreground block text-[11px]">
                          Status Kondisi:
                        </span>
                        <div className="mt-1">
                          <Badge
                            className={cn("text-[10px] font-bold uppercase", kondisiBadgeClass)}
                          >
                            {kondisiText}
                          </Badge>
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Parameter Buffer Stok (4 KOTAK) */}
                  <div className="space-y-1.5">
                    <div className="font-semibold text-foreground">Parameter Buffer Stok:</div>
                    <div className="grid grid-cols-4 gap-2 text-center">
                      <div className="p-2 rounded border border-border bg-surface">
                        <div className="text-[10px] text-muted-foreground">Batas Min.</div>
                        <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                          {safeStock} {selectedBufferItem.unit || "pcs"}
                        </div>
                      </div>
                      <div className="p-2 rounded border border-rose-500/30 bg-rose-500/5">
                        <div className="text-[10px] text-rose-600 dark:text-rose-400 font-medium">
                          Min. Stok (Order)
                        </div>
                        <div className="font-mono font-bold text-sm text-rose-600 dark:text-rose-400 mt-0.5">
                          {minStock} {selectedBufferItem.unit || "pcs"}
                        </div>
                      </div>
                      <div className="p-2 rounded border border-border bg-surface">
                        <div className="text-[10px] text-muted-foreground">Maks. Stok</div>
                        <div className="font-mono font-bold text-sm text-foreground mt-0.5">
                          {maxStock !== null && !isNaN(maxStock)
                            ? `${maxStock} ${selectedBufferItem.unit || "pcs"}`
                            : "—"}
                        </div>
                      </div>
                      <div
                        className={cn(
                          "p-2 rounded border text-center transition-colors",
                          stokSaatIniBoxClass,
                        )}
                      >
                        <div className="text-[10px] font-medium">Stok Saat Ini</div>
                        <div className="font-mono font-bold text-sm mt-0.5">
                          {current} {selectedBufferItem.unit || "pcs"}
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Deskripsi Tambahan jika ada */}
                  {selectedBufferItem.description && (
                    <div className="space-y-1">
                      <div className="font-semibold text-foreground">
                        Deskripsi / Catatan Teknis:
                      </div>
                      <p className="p-2.5 rounded border border-border bg-surface text-muted-foreground leading-relaxed">
                        {selectedBufferItem.description}
                      </p>
                    </div>
                  )}
                </div>
              );
            })()}

          <DialogFooter className="flex flex-col-reverse sm:flex-row justify-between sm:justify-end items-center gap-2">
            <Button variant="outline" size="sm" onClick={() => setSelectedBufferItem(null)}>
              Tutup
            </Button>
            {selectedBufferItem && canManageWarehouse && (
              <Button
                size="sm"
                variant="outline"
                onClick={() => {
                  setEditingBufferItem(selectedBufferItem);
                  setSelectedBufferItem(null);
                }}
                className="gap-1.5 border-amber-500/40 text-amber-700 dark:text-amber-400 hover:bg-amber-500/10 hover:border-amber-500/60 font-medium text-xs"
                title="Edit data master barang & batas stok"
              >
                <Pencil className="size-3.5 text-amber-600 dark:text-amber-400" />
                <span>Edit Barang</span>
              </Button>
            )}
            {selectedBufferItem && (
              <Button
                size="sm"
                onClick={() => downloadProductPDF(selectedBufferItem)}
                className="bg-primary hover:bg-primary/90 text-primary-foreground text-xs gap-1.5"
              >
                <Download className="size-3.5" />
                <span>Unduh Kartu Kontrol PDF</span>
              </Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
