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
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
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
import {
  exportSparepartInventoryExcel,
  exportSparepartMutasiExcel,
} from "@/lib/exportUtils";

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
      type: search["type"] === "IN" || search["type"] === "OUT" ? (search["type"] as "IN" | "OUT") : undefined,
    };
  },
  head: () => ({
    meta: [
      { title: "Gudang & Master Barang — Q-Coffee M2" },
      {
        name: "description",
        content: "Kelola data master barang, stok gudang, transaksi masuk/keluar, kategori, rak, dan dokumen barang.",
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
  current_stock?: number | null;
  image_url?: string | null;
  doc_url?: string | null;
  description?: string | null;
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
            !selectedProduct && "text-muted-foreground"
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
                    isSelected && "bg-primary/15 font-semibold text-primary"
                  )}
                >
                  <div className="min-w-0 pr-2">
                    <div className="font-medium text-foreground truncate">{p.name}</div>
                    <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground mt-0.5">
                      {p.code && <span className="font-mono bg-surface-muted px-1 rounded">{p.code}</span>}
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

function WarehouseAndProductsPage() {
  const { profile, roles, isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();
  const search = Route.useSearch();

  // Hak akses Departemen Warehouse Sparepart & Continuous Improvement
  const isWarehouseAdmin = isAdmin || roles.includes("prod_process_uh") || roles.includes("admin_process");
  const canManageWarehouse = isWarehouseAdmin || roles.includes("qc_field");
  const canDeleteMaster = isAdmin || roles.includes("prod_process_uh");

  // Tab State
  const [activeTab, setActiveTab] = useState<string>(search.tab || "items");
  const [searchQuery, setSearchQuery] = useState("");
  const [stockStatusFilter, setStockStatusFilter] = useState<string>("ALL");
  const [activeStatusFilter, setActiveStatusFilter] = useState<string>("ALL");
  const [sortOption, setSortOption] = useState<string>("RECENT_MUTATION");

  // State Modal Tambah Barang
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [importFile, setImportFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<Array<any>>([]);
  const [isImporting, setIsImporting] = useState(false);
  const bulkFileInputRef = useRef<HTMLInputElement>(null);

  // Helper membaca file Excel (.xlsx / .xls) dan CSV dengan pustaka XLSX
  const handleBulkFileSelect = (file: File) => {
    setImportFile(file);
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const buffer = e.target?.result;
        if (!buffer) return;

        // Baca file menggunakan pustaka XLSX (mendukung format biner Excel .xlsx, .xls, dan CSV)
        const workbook = XLSX.read(buffer, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          toast.error("File tidak memiliki sheet/halaman data");
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        if (!worksheet) {
          toast.error("Lembar kerja tidak ditemukan");
          return;
        }

        // Konversi ke format array baris
        const rawRows = XLSX.utils.sheet_to_json<any[]>(worksheet, { header: 1, defval: "" });

        if (!rawRows || rawRows.length < 2) {
          toast.error("File kosong atau hanya memiliki baris judul");
          return;
        }

        // Cari baris header yang mengandung kata kunci kolom
        let headerRowIdx = 0;
        for (let i = 0; i < Math.min(rawRows.length, 5); i++) {
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
            rowStr.includes("jumlah")
          ) {
            headerRowIdx = i;
            break;
          }
        }

        const selectedHeaderRow = rawRows[headerRowIdx] || [];
        const headers = selectedHeaderRow.map((h: any) =>
          String(h || "")
            .toLowerCase()
            .trim()
            .replace(/\r?\n|\r/g, " ")
            .replace(/\s+/g, " ")
        );

        // Pencocokan kolom spesifik (prioritaskan yang lebih spesifik agar tidak tertukar)
        const safeStockIdx = headers.findIndex(
          (h: string) =>
            h.includes("batas minimal") ||
            h.includes("batas min") ||
            h.includes("safe stock") ||
            h.includes("safety stock") ||
            h.includes("safety") ||
            h.includes("limit")
        );

        const minStockIdx = headers.findIndex(
          (h: string, idx: number) =>
            idx !== safeStockIdx &&
            (h.includes("minimal stok") ||
              h.includes("min stok") ||
              h.includes("minimal stock") ||
              h.includes("min stock") ||
              h === "min" ||
              h === "minimum")
        );

        const maxStockIdx = headers.findIndex(
          (h: string) =>
            h.includes("maksimal") ||
            h.includes("maks.") ||
            h.includes("maks") ||
            h.includes("max stock") ||
            h.includes("max") ||
            h.includes("maximum")
        );

        const currentStockIdx = headers.findIndex(
          (h: string, idx: number) =>
            idx !== safeStockIdx &&
            idx !== minStockIdx &&
            idx !== maxStockIdx &&
            (h.includes("saat ini") ||
              h.includes("current") ||
              h.includes("stok fisik") ||
              h.includes("saldo") ||
              h.includes("qty") ||
              h.includes("quantity") ||
              h.includes("jumlah") ||
              h === "stok" ||
              h === "stock")
        );

        const codeIdx = headers.findIndex(
          (h: string) =>
            h.includes("kode") ||
            h.includes("code") ||
            h.includes("sku") ||
            h.includes("part no") ||
            h.includes("part_no") ||
            (h.includes("material") && !h.includes("nama"))
        );

        const nameIdx = headers.findIndex((h: string, idx: number) => {
          if (idx === codeIdx) return false;
          return (
            h.includes("nama") ||
            h.includes("material") ||
            h.includes("deskripsi") ||
            h.includes("description") ||
            h.includes("barang") ||
            h.includes("item")
          );
        });

        const parsedItems: any[] = [];
        for (let r = headerRowIdx + 1; r < rawRows.length; r++) {
          const row = rawRows[r];
          if (!row || row.length === 0) continue;

          // Ambil nilai per kolom sesuai index yang terdeteksi atau fallback urutan kolom standar
          let rawCode = codeIdx >= 0 && row[codeIdx] !== undefined ? String(row[codeIdx]).trim() : "";
          let rawName = nameIdx >= 0 && row[nameIdx] !== undefined ? String(row[nameIdx]).trim() : "";

          // Fallback cerdas jika header tidak terpetakan sempurna (misal: Col 0 = No, Col 1 = Kode, Col 2 = Material)
          if (!rawCode && !rawName && row.length >= 3) {
            if (/^\d+$/.test(String(row[0]).trim())) {
              rawCode = String(row[1] || "").trim();
              rawName = String(row[2] || "").trim();
            } else {
              rawCode = String(row[0] || "").trim();
              rawName = String(row[1] || "").trim();
            }
          } else if (!rawName && row[1]) {
            rawName = String(row[1]).trim();
          } else if (!rawName && row[2]) {
            rawName = String(row[2]).trim();
          }

          // Lewati baris jika tidak ada identitas barang (kode & nama kosong)
          if (!rawName && !rawCode) continue;
          if (!rawName && rawCode) {
            rawName = `Item ${rawCode}`;
          }

          // Helper parsing angka
          const parseNum = (val: any, fallback: number | null = null): number | null => {
            if (val === undefined || val === null || String(val).trim() === "" || String(val).trim() === "—" || String(val).trim() === "-") {
              return fallback;
            }
            const cleanStr = String(val).replace(/[^0-9.-]/g, "");
            const num = parseFloat(cleanStr);
            return !isNaN(num) ? num : fallback;
          };

          const rawCurrentStock = currentStockIdx >= 0 ? parseNum(row[currentStockIdx], 0) : 0;
          const rawSafeStock = safeStockIdx >= 0 ? parseNum(row[safeStockIdx], 1) : 1;
          const rawMinStock = minStockIdx >= 0 ? parseNum(row[minStockIdx], 10) : 10;
          const rawMaxStock = maxStockIdx >= 0 ? parseNum(row[maxStockIdx], null) : null;

          parsedItems.push({
            name: rawName,
            code: rawCode || null,
            current_stock: rawCurrentStock ?? 0,
            safe_stock: rawSafeStock ?? 1,
            min_stock: rawMinStock ?? 10,
            max_stock: rawMaxStock,
            category: "Sparepart & Tools",
            unit: "pcs",
            location: "Gudang Utama",
            shelf: "Rak A-1",
            is_active: true,
          });
        }

        if (parsedItems.length === 0) {
          toast.error("Tidak ada baris data barang yang valid ditemukan");
          return;
        }

        setImportPreview(parsedItems);
        toast.success("Berhasil membaca " + parsedItems.length + " barang dari file Excel/CSV");
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
      ["No", "Kode", "Material", "Lokasi", "Rak", "Batas Minimal Stok", "Minimal Stok", "Maks. Stok", "Stok Saat Ini"],
      [1, "7100110213", "BEARING 32004", "Gudang Utama", "Rak A-1", 1, 1, 10, 0],
      [2, "7100110339", "BEARING 6001 2Z", "Gudang Utama", "Rak A-1", 10, 1, 40, 0],
      [3, "7100110345", "BEARING 6003 2Z", "Gudang Utama", "Rak A-1", 20, 1, 40, 0],
      [4, "7100110347", "BEARING 6004 2Z", "Gudang Utama", "Rak A-1", 12, 1, 60, 0],
      [5, "7100110351", "BEARING 6005 2Z", "Gudang Utama", "Rak A-1", 18, 1, 50, 0],
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
    XLSX.utils.book_append_sheet(workbook, worksheet, "Template Master");

    XLSX.writeFile(workbook, "template_import_barang.xlsx");
    toast.success("Template Excel berhasil diunduh");
  };

  // Eksekusi Import Batch Data Barang
  const executeBulkImport = async () => {
    if (importPreview.length === 0) {
      toast.error("Tidak ada data barang yang akan diimport");
      return;
    }
    setIsImporting(true);
    try {
      const { error } = await supabase.from("products").insert(importPreview as any);
      if (error) throw error;

      await recordActivity("IMPORT_BARANG", "Mengimport " + importPreview.length + " data barang via Excel/CSV");
      toast.success("Berhasil mengimport " + importPreview.length + " data barang baru!");
      queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
      setImportPreview([]);
      setImportFile(null);
      setIsAddOpen(false);
    } catch (err: any) {
      toast.error("Gagal mengimport data: " + err.message);
    } finally {
      setIsImporting(false);
    }
  };

    const [formData, setFormData] = useState({
    name: "",
    code: "",
    category: "Sparepart & Tools",
    unit: "pcs",
    location: "Gudang Utama",
    shelf: "Rak A-1",
    min_stock: "10",
    current_stock: "0",
    description: "",
    image_url: "",
    doc_url: "",
  });

  // State Modal Edit Barang
  const [editingItem, setEditingItem] = useState<ProductItem | null>(null);

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
      setActiveTab(search.tab);
    }
  }, [search.action, search.type, search.tab]);
  const [txItems, setTxItems] = useState<Array<{ productId: string; quantity: string; unit: string }>>([
    { productId: "", quantity: "1", unit: "kg" },
  ]);
  const [txHeader, setTxHeader] = useState({
    batchNumber: "",
    referenceNo: "",
    supplierOrDest: "",
    notes: "",
    docUrl: "",
  });
  const [selectedTx, setSelectedTx] = useState<GroupedTransaction | null>(null);

  // State Filter Tab Mutasi (In/Out)
  const [txSearchQuery, setTxSearchQuery] = useState("");
  const [txFilterType, setTxFilterType] = useState<"ALL" | "IN" | "OUT">("ALL");

  // Upload file refs
  const [isUploading, setIsUploading] = useState(false);
  const imgInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const txDocInputRef = useRef<HTMLInputElement>(null);

  // ── QUERY DATA BARANG ──────────────────────────────────────────────────────────
  const { data: products = [], isLoading: loadingProducts } = useQuery({
    queryKey: ["warehouse_products"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("products")
        .select("*")
        .order("name");
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
        return [
          { id: "5", name: "Sparepart & Tools" },
        ];
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
          { id: "1", code: "kg", name: "Kilogram" },
          { id: "2", code: "gram", name: "Gram" },
          { id: "3", code: "karung", name: "Karung / Sack" },
          { id: "4", code: "pack", name: "Pack / Pouch" },
          { id: "5", code: "box", name: "Box / Karton" },
          { id: "6", code: "pcs", name: "Pieces" },
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

  // ── HELPER MUTATION: CATAT AKTIVITAS ──────────────────────────────────────────
  const recordActivity = async (action: string, description: string) => {
    try {
      await (supabase as any).from("warehouse_activity_logs").insert({
        action,
        description,
        user_id: profile?.id,
        user_name: profile?.full_name || profile?.email || "Admin Gudang",
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

      const { error } = await supabase.from("products").insert({
        name: formData.name.trim(),
        code: formData.code.trim() || null,
        category: formData.category,
        unit: formData.unit,
        location: formData.location,
        shelf: formData.shelf,
        min_stock: Number(formData.min_stock) || 10,
        current_stock: Number(formData.current_stock) || 0,
        description: formData.description.trim() || null,
        image_url: formData.image_url || null,
        doc_url: formData.doc_url || null,
        is_active: true,
      } as any);

      if (error) throw error;

      await recordActivity(
        "TAMBAH_BARANG",
        `Menambahkan master barang baru: "${formData.name.trim()}" (${formData.category})`,
      );
    },
    onSuccess: () => {
      toast.success("Barang baru berhasil ditambahkan");
      setIsAddOpen(false);
      setFormData({
        name: "",
        code: "",
        category: "Sparepart & Tools",
        unit: "pcs",
        location: "Gudang Utama",
        shelf: "Rak A-1",
        min_stock: "10",
        current_stock: "0",
        description: "",
        image_url: "",
        doc_url: "",
      });
      queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
    },
    onError: (e: Error) => toast.error("Gagal menambah barang", { description: e.message }),
  });

  // ── MUTATION: EDIT DATA BARANG ─────────────────────────────────────────────────
  const updateProduct = useMutation({
    mutationFn: async () => {
      if (!editingItem) return;
      if (!editingItem.name.trim()) throw new Error("Nama barang wajib diisi");

      const { error } = await supabase
        .from("products")
        .update({
          name: editingItem.name.trim(),
          code: editingItem.code?.trim() || null,
          category: editingItem.category,
          unit: editingItem.unit,
          location: editingItem.location,
          shelf: editingItem.shelf,
          min_stock: Number(editingItem.min_stock) || 10,
          current_stock: Number(editingItem.current_stock) || 0,
          description: editingItem.description?.trim() || null,
          image_url: editingItem.image_url || null,
          doc_url: editingItem.doc_url || null,
        } as any)
        .eq("id", editingItem.id);

      if (error) throw error;

      await recordActivity(
        "EDIT_BARANG",
        `Memperbarui data barang: "${editingItem.name}"`,
      );
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
    mutationFn: async ({ id, is_active, name }: { id: string; is_active: boolean; name: string }) => {
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
          batch_number: txHeader.batchNumber.trim() || null,
          reference_no: txHeader.referenceNo.trim() || null,
          supplier_or_dest: txHeader.supplierOrDest.trim() || null,
          notes: txHeader.notes.trim() || null,
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
      );
    },
    onSuccess: () => {
      toast.success(`Berhasil mencatat transaksi barang ${txType === "IN" ? "masuk" : "keluar"}`);
      setIsTxOpen(false);
      setTxItems([{ productId: "", quantity: "1", unit: "kg" }]);
      setTxHeader({
        batchNumber: "",
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

    exportSparepartInventoryExcel({
      products: dataToExport,
      latestInTxMap,
      latestOutTxMap,
      totalInQtyMap,
      totalOutQtyMap,
      generatedByName: profile?.full_name || profile?.email || "Petugas Warehouse Sparepart",
      categoryFilter: "Sparepart & Tools",
    });

    toast.success("Laporan inventaris sparepart berhasil diekspor (.xls)");
    recordActivity("EXPORT_DATA", "Mengekspor laporan inventaris & stok sparepart ke Excel");
  };

  // ── EXPORT DATA KE CSV MENTAH ──────────────────────────────────────────────────
  const exportToCSV = () => {
    const dataToExport = filteredProducts.length > 0 ? filteredProducts : products;
    if (dataToExport.length === 0) {
      toast.error("Tidak ada data untuk diekspor");
      return;
    }

    const headers = [
      "No",
      "Kode Part / SKU",
      "Nama Barang / Sparepart",
      "Kategori",
      "Satuan",
      "Lokasi Gudang",
      "Posisi Rak",
      "Stok Terkini",
      "Batas Min.",
      "Jumlah Masuk",
      "Tanggal Masuk",
      "Jumlah Keluar",
      "Tanggal Keluar",
      "Status Stok",
    ];

    const rows = dataToExport.map((p, idx) => {
      const isLimit = (p.current_stock ?? 0) <= (p.min_stock ?? 10);
      const nameKey = p.name ? p.name.trim().toLowerCase() : "";
      
      const totalOut = (totalOutQtyMap[p.id] ?? 0) || (nameKey ? totalOutQtyMap[nameKey] ?? 0 : 0);
      const totalIn = (totalInQtyMap[p.id] ?? 0) || (nameKey ? totalInQtyMap[nameKey] ?? 0 : 0);

      const lastIn = latestInTxMap[p.id] || (nameKey ? latestInTxMap[nameKey] : undefined);
      const lastInTime = lastIn ? formatDate(lastIn.created_at) : (p.created_at ? formatDate(p.created_at) : "-");

      const lastOut = latestOutTxMap[p.id] || (nameKey ? latestOutTxMap[nameKey] : undefined);
      const lastOutTime = lastOut ? formatDate(lastOut.created_at) : (totalOut > 0 ? formatDate(new Date().toISOString()) : "-");

      return [
        String(idx + 1),
        `"${(p.code || "-").replace(/"/g, '""')}"`,
        `"${(p.name || "").replace(/"/g, '""')}"`,
        `"${(p.category || "Sparepart & Tools").replace(/"/g, '""')}"`,
        `"${(p.unit || "pcs").replace(/"/g, '""')}"`,
        `"${(p.location || "Gudang Utama").replace(/"/g, '""')}"`,
        `"${(p.shelf || "Rak A-1").replace(/"/g, '""')}"`,
        String(p.current_stock ?? 0),
        String(p.min_stock ?? 10),
        String(totalIn),
        `"${lastInTime}"`,
        String(totalOut),
        `"${lastOutTime}"`,
        isLimit ? "LIMIT / KRITIS" : "AMAN",
      ];
    });

    const csvContent = [headers.join(","), ...rows.map((e) => e.join(","))].join("\r\n");
    const bom = "\uFEFF";
    const blob = new Blob([bom + csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `laporan_stok_sparepart_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);

    toast.success("Laporan data gudang berhasil diekspor (.csv)");
    recordActivity("EXPORT_DATA", "Mengekspor laporan inventaris & stok gudang ke CSV");
  };

  // ── CETAK / UNDUH PDF KARTU MASTER & STOK BARANG ─────────────────────────────
  const downloadProductPDF = (p: ProductItem) => {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up diblokir browser. Mohon izinkan pop-up untuk mencetak dokumen PDF.");
      return;
    }

    const lastIn = latestInTxMap[p.id];
    const lastInTime = lastIn ? formatDate(lastIn.created_at) : (p.created_at ? formatDate(p.created_at) : "—");
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
            <div class="company-title">Q-COFFEE M2</div>
            <div class="company-sub">Departement Warehouse - Sparepart & Coffee Inventory</div>
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
          Dokumen resmi hasil cetak sistem manajemen Q-Coffee M2. Dicetak pada: ${new Date().toLocaleString("id-ID")}.
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

  const groupedTransactions: GroupedTransaction[] = transactions.reduce((acc: GroupedTransaction[], tx) => {
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
  }, []);

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

  // ── FILTERED GROUPED TRANSACTIONS (TAB MUTASI) ───────────────────────────────
  const filteredGroupedTransactions = useMemo(() => {
    return groupedTransactions.filter((tx) => {
      if (txFilterType !== "ALL" && tx.tx_type !== txFilterType) {
        return false;
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
      return matchNo || matchBatch || matchRef || matchDest || matchPetugas || matchNotes || matchItems;
    });
  }, [groupedTransactions, txFilterType, txSearchQuery]);

  // ── EXPORT LAPORAN RIWAYAT MUTASI (IN/OUT) KE EXCEL RESMI ─────────────────────
  const exportMutasiToExcel = () => {
    if (groupedTransactions.length === 0 && transactions.length === 0) {
      toast.error("Tidak ada data mutasi untuk diekspor");
      return;
    }

    exportSparepartMutasiExcel({
      groupedTransactions,
      generatedByName: profile?.full_name || profile?.email || "Petugas Warehouse Sparepart",
    });

    toast.success("Laporan riwayat mutasi (In/Out) berhasil diekspor (.xls)");
    recordActivity("EXPORT_DATA", "Mengekspor laporan riwayat mutasi transaksi gudang ke Excel");
  };

  // ── CETAK & UNDUH PDF BUKTI MUTASI BARANG (1 BON / PENCATATAN TRANSAKSI) ────
  const downloadTransactionPDF = (tx: GroupedTransaction) => {
    const isMasuk = tx.tx_type === "IN";
    const titleType = isMasuk ? "BUKTI PENERIMAAN BARANG (INBOUND)" : "BUKTI PENGELUARAN BARANG (OUTBOUND)";
    const colorHeader = isMasuk ? "#059669" : "#e11d48";
    const dateFormatted = formatDate(tx.created_at);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up diblokir browser. Mohon izinkan pop-up untuk mencetak dokumen PDF.");
      return;
    }

    const itemRowsHtml = tx.items
      .map(
        (it, idx) => `
        <tr>
          <td style="text-align: center; color: #64748b; font-size: 11px;">${idx + 1}</td>
          <td>
            <strong style="font-size: 13px; color: #0f172a;">${it.product_name}</strong>
          </td>
          <td>
            <div>Batch: <code>${tx.batch_number || "—"}</code></div>
            <div style="font-size: 11px; color: #64748b; margin-top: 1px;">Ref: ${tx.reference_no || "—"}</div>
          </td>
          <td style="text-align: center;">
            <span style="font-weight: 700; font-size: 11px; color: ${colorHeader};">${isMasuk ? "INBOUND" : "OUTBOUND"}</span>
          </td>
          <td style="text-align: right;">
            <span class="qty-highlight">${isMasuk ? "+" : "-"}${it.quantity} ${it.unit}</span>
          </td>
        </tr>
      `,
      )
      .join("");

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>${tx.transaction_number} - ${titleType}</title>
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
          .notes-card {
            border-left: 4px solid #cbd5e1;
            background: #f8fafc;
            padding: 12px 16px;
            margin-bottom: 30px;
            border-radius: 0 6px 6px 0;
          }
          .signatures {
            margin-top: 50px;
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
            <div class="company-title">Q-COFFEE M2</div>
            <div class="company-sub">Sistem Manajemen Mutasi Gudang & Inventaris Terintegrasi</div>
          </div>
          <div class="doc-badge">${titleType}</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Nomor Transaksi (No. Bon)</div>
            <div class="meta-value" style="font-family: monospace;">${tx.transaction_number}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Tanggal & Waktu</div>
            <div class="meta-value">${dateFormatted}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">${isMasuk ? "Nama Vendor" : "Tujuan / Pemesan"}</div>
            <div class="meta-value">${tx.supplier_or_dest || "—"}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Petugas Input</div>
            <div class="meta-value">${tx.created_by_name || "Petugas Gudang"}</div>
          </div>
        </div>

        <div style="font-size: 12px; font-weight: 700; margin-bottom: 8px; color: #334155;">
          DAFTAR BARANG YANG DIMUTASIKAN (${tx.items.length} ITEM):
        </div>

        <table class="table-box">
          <thead>
            <tr>
              <th style="width: 5%; text-align: center;">No</th>
              <th style="width: 40%;">Nama Barang / Produk</th>
              <th style="width: 25%;">${isMasuk ? "Tanggal Terima / Ref" : "No. Batch / Ref"}</th>
              <th style="width: 12%; text-align: center;">Tipe</th>
              <th style="width: 18%; text-align: right;">Jumlah</th>
            </tr>
          </thead>
          <tbody>
            ${itemRowsHtml}
          </tbody>
        </table>

        ${
          tx.notes
            ? `
          <div class="notes-card">
            <div class="meta-label" style="margin-bottom: 4px;">Petugas Sparepart / Catatan:</div>
            <div style="font-size: 12px; color: #334155;">${tx.notes}</div>
          </div>
        `
            : ""
        }

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
          Dokumen resmi hasil cetak otomatis dari sistem Q-Coffee M2. Dicetak pada: ${new Date().toLocaleString("id-ID")}.
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

      const isLow = (p.current_stock ?? 0) <= (p.min_stock ?? 10);
      const isZero = (p.current_stock ?? 0) <= 0;

      const matchStock =
        stockStatusFilter === "ALL" ||
        (stockStatusFilter === "LIMIT" && isLow && !isZero) ||
        (stockStatusFilter === "SAFE" && !isLow) ||
        (stockStatusFilter === "ZERO" && isZero);

      const matchActive =
        activeStatusFilter === "ALL" ||
        (activeStatusFilter === "ACTIVE" && p.is_active) ||
        (activeStatusFilter === "INACTIVE" && !p.is_active);

      return matchSearch && matchStock && matchActive;
    });

    // Urutkan list barang
    return list.sort((a, b) => {
      if (sortOption === "RECENT_MUTATION") {
        const nameA = a.name ? a.name.trim().toLowerCase() : "";
        const nameB = b.name ? b.name.trim().toLowerCase() : "";

        // Cari transaksi mutasi masuk terakhir (atau mutasi apapun) untuk barang A dan B
        const txAIn = latestInTxMap[a.id] || (nameA ? latestInTxMap[nameA] : undefined);
        const txBIn = latestInTxMap[b.id] || (nameB ? latestInTxMap[nameB] : undefined);

        const timeA = txAIn ? new Date(txAIn.created_at).getTime() : a.created_at ? new Date(a.created_at).getTime() : 0;
        const timeB = txBIn ? new Date(txBIn.created_at).getTime() : b.created_at ? new Date(b.created_at).getTime() : 0;

        if (timeA !== timeB) {
          return timeB - timeA; // Waktu penambahan quantity / mutasi terbaru berada paling awal
        }
        return a.name.localeCompare(b.name);
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
  }, [products, searchQuery, stockStatusFilter, activeStatusFilter, sortOption, latestInTxMap]);

  // Stats
  const totalStockItems = products.reduce((acc, p) => acc + (p.current_stock ?? 0), 0);
  const lowStockItems = products.filter(
    (p) => (p.current_stock ?? 0) <= (p.min_stock ?? 10) && p.is_active,
  );

  return (
    <AppShell breadcrumb="Gudang & Master Barang">
      {/* Header Halaman */}
      <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Manajemen Gudang & Master Barang</h1>
            <Badge variant="outline" className="text-xs bg-primary/10 text-primary border-primary/20">
              Departement Warehouse - Sparepart
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola data master barang, pencatatan masuk/keluar, audit stok, kategori, rak, dan dokumen.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          {/* 1. Catat Masuk (Primary Solid Emerald) */}
          {canManageWarehouse && (
            <Button
              size="sm"
              onClick={() => {
                setTxType("IN");
                setIsTxOpen(true);
              }}
              className="gap-1.5 bg-emerald-600 font-medium text-white shadow-sm hover:bg-emerald-700 active:scale-[0.98] transition-all"
            >
              <ArrowDownLeft className="size-4" />
              Catat Masuk
            </Button>
          )}

          {/* 2. Catat Keluar (Primary Solid Rose) */}
          {canManageWarehouse && (
            <Button
              size="sm"
              onClick={() => {
                setTxType("OUT");
                setIsTxOpen(true);
              }}
              className="gap-1.5 bg-rose-600 font-medium text-white shadow-sm hover:bg-rose-700 active:scale-[0.98] transition-all"
            >
              <ArrowUpRight className="size-4" />
              Catat Keluar
            </Button>
          )}

          {/* 3. Export Laporan (Dropdown Excel Resmi & CSV Mentah) */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                size="sm"
                className="gap-1.5 bg-slate-800 dark:bg-slate-700 text-white font-medium shadow-sm hover:bg-slate-900 dark:hover:bg-slate-600 active:scale-[0.98] transition-all"
              >
                <FileSpreadsheet className="size-4 text-emerald-400" />
                Export Laporan
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56">
              <DropdownMenuLabel className="text-xs text-muted-foreground">Format Unduhan Laporan</DropdownMenuLabel>
              <DropdownMenuItem onClick={exportToExcel} className="gap-2.5 cursor-pointer py-2">
                <FileSpreadsheet className="size-4 text-emerald-600 dark:text-emerald-400" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-foreground">Excel Resmi (.xls)</span>
                  <span className="text-[10px] text-muted-foreground">Format rapi, kop, KPI & tanda tangan</span>
                </div>
              </DropdownMenuItem>
              <DropdownMenuItem onClick={exportToCSV} className="gap-2.5 cursor-pointer py-2">
                <FileText className="size-4 text-sky-600 dark:text-sky-400" />
                <div className="flex flex-col">
                  <span className="font-semibold text-xs text-foreground">CSV Mentah (.csv)</span>
                  <span className="text-[10px] text-muted-foreground">Tabel data terpisah koma</span>
                </div>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* 4. Tambah Barang (Subtle Outline) */}
          {canManageWarehouse && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => setIsAddOpen(true)}
              className="gap-1.5 text-muted-foreground hover:text-foreground hover:bg-surface-muted"
            >
              <Plus className="size-4" />
              Tambah Barang
            </Button>
          )}
        </div>
      </div>

      {/* Ringkasan Statistik Gudang */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <div className="border border-border bg-surface p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total SKU Barang</span>
            <Package className="size-4 text-primary" />
          </div>
          <p className="mt-2 text-2xl font-bold">{products.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {products.filter((p) => p.is_active).length} aktif, {products.filter((p) => !p.is_active).length} nonaktif
          </p>
        </div>

        <div className="border border-border bg-surface p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Stok Menipis / Kritis</span>
            <AlertTriangle className="size-4 text-amber-500" />
          </div>
          <p className="mt-2 text-2xl font-bold text-amber-600">{lowStockItems.length}</p>
          <p className="mt-1 text-xs text-muted-foreground">Di bawah batas minimum stok</p>
        </div>

        {/* TOTAL MUTASI DAILY (SPLIT: MASUK & KELUAR) */}
        <div className="border border-border bg-surface p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-muted-foreground">
              <span className="text-xs font-semibold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                <span className="inline-block size-2 rounded-full bg-blue-500 animate-pulse" />
                Total Mutasi Daily
              </span>
              <History className="size-4 text-blue-500" />
            </div>
            <div className="mt-2 flex items-baseline gap-2">
              <p className="text-2xl font-bold text-foreground">{dailyTotalCount}</p>
              <span className="text-xs text-muted-foreground">transaksi hari ini</span>
            </div>
          </div>
          <div className="mt-3 pt-2.5 border-t border-border/80 grid grid-cols-2 gap-2">
            <div className="flex items-center gap-1.5 bg-emerald-500/10 dark:bg-emerald-500/20 px-2 py-1.5 rounded-sm">
              <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-semibold text-emerald-700 dark:text-emerald-300 leading-none">Mutasi Masuk</p>
                <p className="text-xs font-bold text-emerald-600 dark:text-emerald-400 mt-0.5">{dailyInCount}</p>
              </div>
            </div>
            <div className="flex items-center gap-1.5 bg-rose-500/10 dark:bg-rose-500/20 px-2 py-1.5 rounded-sm">
              <ArrowUpRight className="size-3.5 text-rose-600 dark:text-rose-400 shrink-0" />
              <div className="min-w-0">
                <p className="text-[10px] uppercase font-semibold text-rose-700 dark:text-rose-300 leading-none">Mutasi Keluar</p>
                <p className="text-xs font-bold text-rose-600 dark:text-rose-400 mt-0.5">{dailyOutCount}</p>
              </div>
            </div>
          </div>
        </div>

        <div className="border border-border bg-surface p-4">
          <div className="flex items-center justify-between text-muted-foreground">
            <span className="text-xs font-semibold uppercase tracking-wider">Total Kuantitas Stok</span>
            <Layers className="size-4 text-emerald-500" />
          </div>
          <p className="mt-2 text-2xl font-bold">{totalStockItems.toLocaleString("id-ID")}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            {transactions.length} riwayat mutasi tercatat
          </p>
        </div>
      </div>

      {/* Tabs Menu Gudang */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="bg-surface-muted border border-border p-1">
          <TabsTrigger value="items" className="gap-2">
            <Package className="size-4" />
            Master & Stok Barang
          </TabsTrigger>
          <TabsTrigger value="transactions" className="gap-2">
            <History className="size-4" />
            Riwayat Mutasi (In/Out)
          </TabsTrigger>
          <TabsTrigger value="locations" className="gap-2">
            <Warehouse className="size-4" />
            Lokasi & Rak
          </TabsTrigger>
          <TabsTrigger value="logs" className="gap-2">
            <FileText className="size-4" />
            Activity Log
          </TabsTrigger>
        </TabsList>

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
                    <SelectItem value="ALL" className="text-xs">Semua Kondisi Stok</SelectItem>
                    <SelectItem value="LIMIT" className="text-xs font-medium text-amber-600">
                      ⚠ Stok Limit / Kritis
                    </SelectItem>
                    <SelectItem value="SAFE" className="text-xs font-medium text-emerald-600">
                      ✓ Stok Aman / Normal
                    </SelectItem>
                    <SelectItem value="ZERO" className="text-xs font-medium text-rose-600">
                      ✕ Stok Kosong (0 pcs)
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <Select value={activeStatusFilter} onValueChange={setActiveStatusFilter}>
                <SelectTrigger className="w-36 h-9 text-xs">
                  <SelectValue placeholder="Status Barang" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ALL" className="text-xs">Semua Status</SelectItem>
                  <SelectItem value="ACTIVE" className="text-xs">Hanya Aktif</SelectItem>
                  <SelectItem value="INACTIVE" className="text-xs">Hanya Nonaktif</SelectItem>
                </SelectContent>
              </Select>

              {/* Urutan List Barang */}
              <div className="flex items-center gap-1.5">
                <ArrowUpDown className="size-3.5 text-muted-foreground" />
                <Select value={sortOption} onValueChange={setSortOption}>
                  <SelectTrigger className="w-48 h-9 text-xs font-medium">
                    <SelectValue placeholder="Urutkan" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="RECENT_MUTATION" className="text-xs font-semibold text-primary">
                      ✦ Baru Ditambah / Mutasi
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
              <table className="w-full min-w-[760px] text-xs">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground">
                    <th className="label-caps px-3.5 py-3 text-center w-14 whitespace-nowrap">Foto / Dok</th>
                    <th className="label-caps px-3.5 py-3 text-left min-w-[180px] md:min-w-[220px] whitespace-nowrap">Kode SKU & Nama Barang</th>
                    <th className="label-caps px-3.5 py-3 text-left min-w-[130px] whitespace-nowrap">Kategori</th>
                    <th className="label-caps px-3.5 py-3 text-left min-w-[130px] whitespace-nowrap">Lokasi & Rak</th>
                    <th className="label-caps px-3.5 py-3 text-right min-w-[120px] whitespace-nowrap">Stok Saat Ini</th>
                    <th className="label-caps px-3.5 py-3 text-right min-w-[130px] whitespace-nowrap">Riwayat Masuk</th>
                    <th className="label-caps px-3.5 py-3 text-right min-w-[130px] whitespace-nowrap">Riwayat Keluar</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredProducts.map((p) => {
                    const isZero = (p.current_stock ?? 0) <= 0;
                    const isLow = (p.current_stock ?? 0) <= (p.min_stock ?? 10);
                    const nameKey = p.name ? p.name.trim().toLowerCase() : "";
                    
                    const totalOut = (totalOutQtyMap[p.id] ?? 0) || (nameKey ? totalOutQtyMap[nameKey] ?? 0 : 0);
                    const totalIn = (totalInQtyMap[p.id] ?? 0) || (nameKey ? totalInQtyMap[nameKey] ?? 0 : 0);

                    const lastIn = latestInTxMap[p.id] || (nameKey ? latestInTxMap[nameKey] : undefined);
                    const lastInTime = lastIn ? formatDate(lastIn.created_at) : (p.created_at ? formatDate(p.created_at) : "—");

                    const lastOut = latestOutTxMap[p.id] || (nameKey ? latestOutTxMap[nameKey] : undefined);
                    const lastOutTime = lastOut ? formatDate(lastOut.created_at) : (totalOut > 0 ? formatDate(new Date().toISOString()) : "—");

                    return (
                      <tr
                        key={p.id}
                        className={cn(
                          "group transition-colors hover:bg-surface-muted/40",
                          !p.is_active && "opacity-55 bg-surface-muted/20",
                        )}
                      >
                        {/* Foto / Dokumen */}
                        <td className="px-3.5 py-3 text-center align-middle w-14">
                          <div className="flex items-center justify-center gap-1.5">
                            {p.image_url ? (
                              <a href={p.image_url} target="_blank" rel="noreferrer" title="Lihat Foto Sparepart">
                                <img
                                  src={p.image_url}
                                  alt={p.name}
                                  className="size-8 rounded object-cover border border-border shadow-2xs hover:scale-105 transition-transform"
                                />
                              </a>
                            ) : (
                              <div className="flex size-8 items-center justify-center rounded border border-border bg-surface-muted text-muted-foreground/60">
                                <ImageIcon className="size-3.5" />
                              </div>
                            )}
                            {p.doc_url && (
                              <a
                                href={p.doc_url}
                                target="_blank"
                                rel="noreferrer"
                                className="text-primary hover:text-primary/80 transition-colors"
                                title="Lihat Dokumen COA / Manual Part"
                              >
                                <FileText className="size-3.5" />
                              </a>
                            )}
                          </div>
                        </td>

                        {/* Nama & Kode SKU */}
                        <td className="px-3.5 py-3 align-middle min-w-[180px] md:min-w-[220px]">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="font-semibold text-sm text-foreground leading-snug break-words">{p.name}</span>
                            {lastIn && (Date.now() - new Date(lastIn.created_at).getTime() < 24 * 60 * 60 * 1000) && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/25">
                                <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse inline-block" />
                                Baru Ditambah
                              </span>
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1.5 flex-wrap">
                            <span className="font-mono text-[10.5px] font-semibold text-slate-700 dark:text-slate-300 bg-slate-100 dark:bg-slate-800/90 border border-slate-200 dark:border-slate-700 px-1.5 py-0.5 rounded tracking-wide">
                              {p.code || "NO-SKU"}
                            </span>
                          </div>
                        </td>

                        {/* Kategori */}
                        <td className="px-3.5 py-3 align-middle min-w-[130px] whitespace-nowrap">
                          <Badge
                            variant="secondary"
                            className="font-medium text-[11px] bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-700"
                          >
                            {p.category || "Sparepart & Tools"}
                          </Badge>
                        </td>

                        {/* Posisi Rak & Lokasi */}
                        <td className="px-3.5 py-3 align-middle min-w-[130px] whitespace-nowrap">
                          <div className="flex flex-col gap-1">
                            <span className="text-xs font-medium text-foreground">{p.location || "Gudang Utama"}</span>
                            <div>
                              <Badge className="font-mono text-[10.5px] font-semibold px-2 py-0.5 bg-slate-800 dark:bg-slate-700 text-white rounded border-transparent shadow-none inline-flex items-center">
                                {p.shelf || "Rak A-1"}
                              </Badge>
                            </div>
                          </div>
                        </td>

                        {/* Stok Terkini & Batas Minimum */}
                        <td className="px-3.5 py-3 align-middle text-right whitespace-nowrap min-w-[120px]">
                          <div className="flex flex-col items-end gap-1.5">
                            <div className="inline-flex items-baseline gap-1 font-mono">
                              <span
                                className={cn(
                                  "text-sm font-bold tabular-nums",
                                  isZero
                                    ? "text-rose-600 dark:text-rose-400 font-extrabold"
                                    : isLow
                                      ? "text-amber-600 dark:text-amber-400 font-bold"
                                      : "text-emerald-600 dark:text-emerald-400"
                                )}
                              >
                                {(p.current_stock ?? 0).toLocaleString("id-ID")}
                              </span>
                              <span className="text-xs text-muted-foreground font-normal">
                                {p.unit || "pcs"}
                              </span>
                            </div>
                            <div className="flex items-center justify-end">
                              {isZero ? (
                                <Badge variant="destructive" className="text-[10px] px-1.5 py-0.5 font-semibold h-auto leading-tight shadow-none border-transparent">
                                  Habis (0 pcs)
                                </Badge>
                              ) : isLow && p.is_active ? (
                                <Badge
                                  className="text-[10px] px-1.5 py-0.5 bg-amber-500/15 text-amber-700 dark:text-amber-400 border border-amber-500/30 gap-1 font-semibold h-auto leading-tight shadow-none inline-flex items-center"
                                >
                                  <AlertTriangle className="size-2.5 shrink-0" /> Limit (Min: {p.min_stock ?? 10})
                                </Badge>
                              ) : (
                                <span className="text-[10.5px] text-muted-foreground font-mono leading-tight">
                                  Min: {(p.min_stock ?? 10).toLocaleString("id-ID")}
                                </span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Riwayat Masuk */}
                        <td className="px-3.5 py-3 text-right align-middle whitespace-nowrap min-w-[130px]">
                          <div className="flex flex-col items-end gap-0.5">
                            <span
                              className={cn(
                                "inline-flex items-center font-mono text-xs font-semibold tabular-nums px-2 py-0.5 rounded border whitespace-nowrap",
                                totalIn > 0
                                  ? "text-emerald-700 dark:text-emerald-400 bg-emerald-500/10 border-emerald-500/20"
                                  : "text-muted-foreground bg-surface-muted border-border/40",
                              )}
                            >
                              {totalIn > 0 ? `+${totalIn.toLocaleString("id-ID")} ${p.unit || "pcs"}` : `0 ${p.unit || "pcs"}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {lastInTime}
                            </span>
                          </div>
                        </td>

                        {/* Riwayat Keluar */}
                        <td className="px-3.5 py-3 text-right align-middle whitespace-nowrap min-w-[130px]">
                          <div className="flex flex-col items-end gap-0.5">
                            <span
                              className={cn(
                                "inline-flex items-center font-mono text-xs font-semibold tabular-nums px-2 py-0.5 rounded border whitespace-nowrap",
                                totalOut > 0
                                  ? "text-rose-600 dark:text-rose-400 bg-rose-500/10 border-rose-500/20"
                                  : "text-muted-foreground bg-surface-muted border-border/40"
                              )}
                            >
                              {totalOut > 0 ? `-${totalOut.toLocaleString("id-ID")} ${p.unit || "pcs"}` : `0 ${p.unit || "pcs"}`}
                            </span>
                            <span className="text-[10px] text-muted-foreground font-medium">
                              {lastOutTime}
                            </span>
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
          {/* Header Bar Alat Tab Mutasi (Pencarian, Filter Tipe, & Export Laporan Mutasi) */}
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
            </div>

            <div className="flex items-center gap-2 self-end lg:self-auto shrink-0">
              <Button
                size="sm"
                onClick={exportMutasiToExcel}
                className="h-8 gap-1.5 bg-slate-800 dark:bg-slate-700 text-white font-medium shadow-sm hover:bg-slate-900 dark:hover:bg-slate-600 active:scale-[0.98] transition-all text-xs"
              >
                <FileSpreadsheet className="size-3.5 text-emerald-400" />
                Export Excel (.xls)
              </Button>
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
                    : "Gunakan tombol \"Catat Masuk\" atau \"Catat Keluar\" di atas untuk mencatat perpindahan stok."}
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
              <table className="w-full text-xs text-left border-collapse">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/60 text-muted-foreground uppercase text-[11px] tracking-wider font-semibold">
                    <th className="px-4 py-3 w-40">No. Bon / Waktu</th>
                    <th className="px-3 py-3 w-28">Tipe Mutasi</th>
                    <th className="px-4 py-3 min-w-[320px]">Rincian Sparepart & Jumlah</th>
                    <th className="px-4 py-3 w-48">Pihak / Rekanan</th>
                    <th className="px-4 py-3 w-44">Batch & No. Ref</th>
                    <th className="px-4 py-3 w-36">Petugas</th>
                    <th className="px-4 py-3 text-right w-36">Aksi & Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {filteredGroupedTransactions.map((tx) => {
                    const isMasuk = tx.tx_type === "IN";
                    const isToday =
                      new Date(tx.created_at).toDateString() === new Date().toDateString();

                    return (
                      <tr
                        key={tx.transaction_number}
                        className="hover:bg-surface-muted/40 transition-colors align-top"
                      >
                        {/* 1. No. Bon & Waktu */}
                        <td className="px-4 py-3 font-mono">
                          <div className="flex items-center gap-1.5 font-bold text-foreground text-xs">
                            <span>{tx.transaction_number}</span>
                            {isToday && (
                              <span className="size-1.5 rounded-full bg-blue-500 inline-block" title="Hari ini" />
                            )}
                          </div>
                          <div className="mt-1 flex items-center gap-1 text-[11px] text-muted-foreground font-sans">
                            <Clock className="size-3 shrink-0 opacity-70" />
                            <span>{formatDate(tx.created_at)}</span>
                          </div>
                        </td>

                        {/* 2. Tipe Mutasi */}
                        <td className="px-3 py-3">
                          <span
                            className={cn(
                              "inline-flex items-center gap-1 px-2 py-0.5 rounded text-[11px] font-semibold uppercase tracking-wide",
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
                            {isMasuk ? "Masuk" : "Keluar"}
                          </span>
                        </td>

                        {/* 3. Rincian Sparepart & Jumlah */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {tx.items.map((it, idx) => (
                              <div
                                key={it.id || idx}
                                className="flex items-center justify-between gap-3 text-xs bg-surface-muted/40 hover:bg-surface-muted px-2.5 py-1 rounded border border-border/50 transition-colors"
                              >
                                <span className="font-medium text-foreground leading-snug truncate">
                                  <span className="text-muted-foreground mr-1 text-[11px]">{idx + 1}.</span>
                                  {it.product_name}
                                </span>
                                <span
                                  className={cn(
                                    "font-mono font-bold text-xs shrink-0 px-2 py-0.5 rounded text-right",
                                    isMasuk
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400",
                                  )}
                                >
                                  {isMasuk ? "+" : "-"}
                                  {it.quantity.toLocaleString("id-ID")} {it.unit || "pcs"}
                                </span>
                              </div>
                            ))}
                            {tx.items.length > 1 && (
                              <p className="text-[10px] text-muted-foreground px-1 font-medium">
                                Total {tx.items.length} item sparepart dalam bon ini
                              </p>
                            )}
                          </div>
                        </td>

                        {/* 4. Pihak / Rekanan (Vendor / Tujuan) */}
                        <td className="px-4 py-3 text-xs">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                            {isMasuk ? "Vendor Pengirim" : "Tujuan / Line"}
                          </span>
                          <span className="font-medium text-foreground mt-0.5 block">
                            {tx.supplier_or_dest || "—"}
                          </span>
                        </td>

                        {/* 5. Batch & No. Referensi */}
                        <td className="px-4 py-3 text-xs">
                          {tx.batch_number ? (
                            <div className="text-muted-foreground">
                              <span className="text-[10px] uppercase font-semibold block">
                                {isMasuk ? "Tgl Terima / Batch" : "Batch"}
                              </span>
                              <span className="font-mono text-foreground">{tx.batch_number}</span>
                            </div>
                          ) : null}
                          {tx.reference_no ? (
                            <div className="mt-1 text-muted-foreground">
                              <span className="text-[10px] uppercase font-semibold block">Ref / PO</span>
                              <span className="font-mono text-xs text-foreground bg-surface-muted px-1.5 py-0.5 rounded border border-border/40 inline-block">
                                {tx.reference_no}
                              </span>
                            </div>
                          ) : null}
                          {!tx.batch_number && !tx.reference_no && (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* 6. Petugas Sparepart */}
                        <td className="px-4 py-3 text-xs">
                          <span className="font-medium text-foreground block">
                            {tx.created_by_name || "Petugas Gudang"}
                          </span>
                          {tx.notes && (
                            <span
                              className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1 italic"
                              title={tx.notes}
                            >
                              &ldquo;{tx.notes}&rdquo;
                            </span>
                          )}
                        </td>

                        {/* 7. Aksi & Dokumen */}
                        <td className="px-4 py-3 text-right">
                          <div className="flex items-center justify-end gap-1.5">
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
                    Monitoring penataan lokasi rak, daftar sparepart tersimpan, dan riwayat catatan masuk.
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
                <p className="text-sm font-semibold text-foreground">Belum Ada Data Shelf / Rak yang Tercatat</p>
                <p className="mt-1 text-xs text-muted-foreground max-w-sm">
                  Daftar lokasi rak akan otomatis terisi dan dikelompokkan sesuai data input master barang serta catatan transaksi barang masuk.
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
                          <strong className="text-foreground font-semibold">{group.items.length}</strong> SKU Sparepart
                        </span>
                        <span className="text-border">|</span>
                        <span className="text-muted-foreground">
                          Total Saldo: <strong className="text-primary font-bold font-mono">{group.totalStock.toLocaleString("id-ID")}</strong> Unit
                        </span>
                      </div>
                    </div>

                    {/* Catatan Masuk Terakhir jika ada */}
                    {group.latestInbound && (
                      <div className="px-4 py-2 bg-emerald-500/5 border-b border-emerald-500/10 flex items-center justify-between text-xs text-emerald-800 dark:text-emerald-300">
                        <div className="flex items-center gap-2">
                          <ArrowDownLeft className="size-3.5 text-emerald-600 dark:text-emerald-400 shrink-0" />
                          <span>
                            <strong>Catatan Masuk Terakhir:</strong> {formatDate(group.latestInbound.created_at)}
                            {group.latestInbound.supplier_or_dest ? ` (Dari: ${group.latestInbound.supplier_or_dest})` : ""}
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
                            <th className="px-3.5 py-2 text-left font-medium min-w-[320px] md:min-w-[420px]">Nama Sparepart</th>
                            <th className="px-3.5 py-2 text-center font-medium w-20">Satuan</th>
                            <th className="px-3.5 py-2 text-right font-medium w-24">Stok Terkini</th>
                            <th className="px-3.5 py-2 text-right font-medium w-20">Min.</th>
                            <th className="px-3.5 py-2 text-center font-medium w-24">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {group.items.map((item, itIdx) => {
                            const isLimit = (item.current_stock ?? 0) <= (item.min_stock ?? 10);
                            return (
                              <tr key={item.id || itIdx} className="hover:bg-surface-muted/40 transition-colors">
                                <td className="px-3.5 py-2 text-muted-foreground">{itIdx + 1}</td>
                                <td className="px-3.5 py-2 font-mono font-medium text-foreground">{item.code || "—"}</td>
                                <td className="px-3.5 py-2 font-medium text-foreground min-w-[320px] md:min-w-[420px]">{item.name}</td>
                                <td className="px-3.5 py-2 text-center font-mono text-muted-foreground">{item.unit || "pcs"}</td>
                                <td className="px-3.5 py-2 text-right font-mono font-bold">
                                  <span className={isLimit ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400"}>
                                    {(item.current_stock ?? 0).toLocaleString("id-ID")}
                                  </span>
                                </td>
                                <td className="px-3.5 py-2 text-right font-mono text-muted-foreground">
                                  {(item.min_stock ?? 10).toLocaleString("id-ID")}
                                </td>
                                <td className="px-3.5 py-2 text-center">
                                  {isLimit ? (
                                    <Badge variant="destructive" className="text-[10px] px-1.5 py-0 h-5">
                                      Limit
                                    </Badge>
                                  ) : (
                                    <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-5 text-emerald-600 border-emerald-500/30 bg-emerald-500/10">
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
                    <th className="label-caps px-4 py-3 text-left">Petugas</th>
                    <th className="label-caps px-4 py-3 text-right">Waktu</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {activityLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3">
                        <Badge variant="outline" className="font-mono text-xs">
                          {log.action}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 font-medium">{log.description}</td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">{log.user_name || "Sistem"}</td>
                      <td className="px-4 py-3 text-right text-xs text-muted-foreground">
                        {formatDate(log.created_at)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </TabsContent>
      </Tabs>

      {/* ── MODAL DIALOG: TAMBAH BARANG ───────────────────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-4xl w-full max-h-[90vh] flex flex-col p-6 overflow-hidden">
          <DialogHeader className="pb-3 border-b border-border/60 shrink-0">
            <DialogTitle className="text-lg font-bold">Tambah Data Barang Baru</DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Tambahkan data master secara manual atau upload file Excel / CSV sekaligus.
            </DialogDescription>
          </DialogHeader>

          {/* Tab Mode: Manual vs Upload File Excel/CSV */}
          <Tabs defaultValue="manual" className="w-full flex-1 flex flex-col min-h-0 overflow-hidden mt-3">
            <div className="flex items-center justify-between border-b pb-2 mb-3 shrink-0">
              <TabsList className="grid w-72 grid-cols-2">
                <TabsTrigger value="manual" className="text-xs">Manual Input</TabsTrigger>
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
                    <Label htmlFor="add-name" className="text-xs font-semibold">Nama Barang *</Label>
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
                    <Label htmlFor="add-code" className="text-xs font-semibold">Kode Material</Label>
                    <Input
                      id="add-code"
                      value={formData.code}
                      onChange={(e) => setFormData({ ...formData, code: e.target.value })}
                      placeholder="cth. 7100110213 / SP-BRG-6204"
                      className="h-9 text-xs font-mono"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Kategori Barang</Label>
                    <Select
                      value={formData.category}
                      onValueChange={(v) => setFormData({ ...formData, category: v })}
                    >
                      <SelectTrigger className="h-9 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {categories.map((c: any) => (
                          <SelectItem key={c.id} value={c.name} className="text-xs">
                            {c.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
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
                        {units.map((u: any) => (
                          <SelectItem key={u.id} value={u.code} className="text-xs">
                            {u.name} ({u.code})
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Lokasi Gudang</Label>
                    <Input
                      value={formData.location}
                      onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                      placeholder="Gudang Utama"
                      className="h-9 text-xs"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="text-xs font-semibold">Shelf / Rak</Label>
                    <Input
                      value={formData.shelf}
                      onChange={(e) => setFormData({ ...formData, shelf: e.target.value })}
                      placeholder="Rak A-1"
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
                    <Label className="text-xs font-semibold">Batas Minimum Stok (Alert)</Label>
                    <Input
                      type="number"
                      value={formData.min_stock}
                      onChange={(e) => setFormData({ ...formData, min_stock: e.target.value })}
                      placeholder="10"
                      className="h-9 text-xs font-mono"
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
                          Format kolom yang didukung: <strong>Kode</strong>, <strong>Material</strong>, <strong>Batas Minimal Stok</strong>, <strong>Minimal Stok</strong>, <strong>Maks. Stok</strong>, dan <strong>Stok Saat Ini</strong>
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
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={downloadImportTemplate}
                          className="gap-1.5 text-xs h-8 text-primary hover:text-primary hover:bg-primary/10 border-primary/25"
                        >
                          <Download className="size-3.5" />
                          Unduh Template Excel (.xlsx)
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
                          Total {importPreview.length} item barang terdeteksi • Total Stok: {importPreview.reduce((acc, it) => acc + (it.current_stock || 0), 0).toLocaleString("id-ID")} pcs
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
                        }}
                        className="h-7 px-1.5 text-muted-foreground hover:text-destructive hover:bg-destructive/10"
                        title="Hapus File"
                      >
                        <X className="size-3.5" />
                      </Button>
                    </div>
                  </div>
                )}

                {/* Pratinjau Data yang Terbaca */}
                {importPreview.length > 0 && (
                  <div className="space-y-2.5">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                        <Check className="size-3.5 text-emerald-600" />
                        Pratinjau {importPreview.length} Barang Terdeteksi
                      </span>
                      <span className="text-[11px] text-muted-foreground">
                        Pastikan seluruh kolom sudah sesuai dengan data
                      </span>
                    </div>
                    <div className="max-h-72 overflow-x-auto overflow-y-auto rounded-lg border border-border text-xs bg-background">
                      <table className="w-full text-left border-collapse min-w-[700px]">
                        <thead className="bg-surface-muted text-[11px] font-semibold text-muted-foreground sticky top-0 z-10 border-b border-border">
                          <tr>
                            <th className="p-2.5 w-12 text-center">No</th>
                            <th className="p-2.5 w-32 text-center">Kode</th>
                            <th className="p-2.5 min-w-[200px]">Material</th>
                            <th className="p-2.5 text-center w-28">Stok Saat Ini</th>
                            <th className="p-2.5 text-center w-24">Batas Min.</th>
                            <th className="p-2.5 text-center w-24">Min. Stok</th>
                            <th className="p-2.5 text-center w-24">Maks. Stok</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-border/60">
                          {importPreview.map((it, idx) => (
                            <tr key={idx} className="hover:bg-surface-muted/50 transition-colors">
                              <td className="p-2.5 text-center text-muted-foreground font-mono">{idx + 1}</td>
                              <td className="p-2.5 text-center font-mono text-primary font-medium">{it.code || "-"}</td>
                              <td className="p-2.5 font-medium text-foreground">{it.name}</td>
                              <td className="p-2.5 text-center font-mono font-bold text-emerald-600 dark:text-emerald-400">
                                {it.current_stock ?? 0} pcs
                              </td>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">
                                {it.safe_stock !== null && it.safe_stock !== undefined ? `${it.safe_stock} pcs` : "-"}
                              </td>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">
                                {it.min_stock !== null && it.min_stock !== undefined ? `${it.min_stock} pcs` : "-"}
                              </td>
                              <td className="p-2.5 text-center font-mono text-muted-foreground">
                                {it.max_stock !== null && it.max_stock !== undefined ? `${it.max_stock} pcs` : "-"}
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div className="flex items-center justify-between text-xs px-1 text-muted-foreground pt-1.5 border-t border-border/40">
                      <span>Menampilkan seluruh <strong>{importPreview.length}</strong> barang yang siap ditambahkan</span>
                      <span className="font-mono font-bold text-foreground">
                        Total Stok: {importPreview.reduce((acc, it) => acc + (it.current_stock || 0), 0).toLocaleString("id-ID")} pcs
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
              <div className="space-y-1.5">
                <Label>Kategori Barang</Label>
                <Select
                  value={editingItem.category || "Sparepart & Tools"}
                  onValueChange={(v) => setEditingItem({ ...editingItem, category: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {categories.map((c: any) => (
                      <SelectItem key={c.id} value={c.name}>
                        {c.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Satuan (UoM)</Label>
                <Select
                  value={editingItem.unit || "pcs"}
                  onValueChange={(v) => setEditingItem({ ...editingItem, unit: v })}
                >
                  <SelectTrigger className="h-9">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {units.map((u: any) => (
                      <SelectItem key={u.id} value={u.code}>
                        {u.name} ({u.code})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label>Lokasi Gudang</Label>
                <Input
                  value={editingItem.location || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, location: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Shelf / Rak</Label>
                <Input
                  value={editingItem.shelf || ""}
                  onChange={(e) => setEditingItem({ ...editingItem, shelf: e.target.value })}
                />
              </div>
              <div className="space-y-1.5">
                <Label>Batas Minimum Stok</Label>
                <Input
                  type="number"
                  value={editingItem.min_stock ?? 10}
                  onChange={(e) => setEditingItem({ ...editingItem, min_stock: Number(e.target.value) })}
                />
              </div>

            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingItem(null)}>
              Batal
            </Button>
            <Button onClick={() => updateProduct.mutate()} disabled={updateProduct.isPending}>
              {updateProduct.isPending ? "Menyimpan..." : "Simpan Perubahan"}
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
                  <p className="text-[11px] text-muted-foreground">Pilih barang dan tentukan kuantitas yang dicatat</p>
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
                                i === idx ? { productId, unit, quantity: it.quantity } : it
                              )
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
                                i === idx ? { productId: it.productId, unit: it.unit, quantity: newQty } : it
                              )
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
                <Label>Tanggal Terima</Label>
                <Input
                  value={txHeader.batchNumber}
                  onChange={(e) => setTxHeader({ ...txHeader, batchNumber: e.target.value })}
                  placeholder="cth. 16/09/2026 atau BATCH-01"
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
              <Label>{txType === "IN" ? "Nama Vendor" : "Tujuan Pengeluaran / Line"}</Label>
              <Input
                value={txHeader.supplierOrDest}
                onChange={(e) => setTxHeader({ ...txHeader, supplierOrDest: e.target.value })}
                placeholder={txType === "IN" ? "cth. PT Kopi Nusantara" : "cth. Line Roasting 1 / Kitchen"}
                className="h-9 text-xs"
              />
            </div>

            <div className="space-y-1.5">
              <Label>Petugas Sparepart</Label>
              <Input
                value={txHeader.notes}
                onChange={(e) => setTxHeader({ ...txHeader, notes: e.target.value })}
                placeholder="Nama petugas sparepart / keterangan"
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
              className={txType === "IN" ? "bg-emerald-600 hover:bg-emerald-700" : "bg-rose-600 hover:bg-rose-700"}
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
              Apakah Anda yakin ingin menghapus barang <strong>&ldquo;{deletingItem?.name}&rdquo;</strong>? Tindakan ini tidak dapat dibatalkan.
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
                    <span className="text-muted-foreground block text-[11px]">No. Transaksi / Bon:</span>
                    <span className="font-mono font-bold text-foreground text-sm">{selectedTx.transaction_number}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Waktu Pencatatan:</span>
                    <span className="font-medium text-foreground">{formatDate(selectedTx.created_at)}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">Petugas Input:</span>
                    <span className="font-medium text-foreground">{selectedTx.created_by_name || "Petugas Gudang"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {selectedTx.tx_type === "IN" ? "Nama Vendor:" : "Tujuan / Pemohon:"}
                    </span>
                    <span className="font-medium text-foreground">{selectedTx.supplier_or_dest || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">
                      {selectedTx.tx_type === "IN" ? "Tanggal Terima:" : "Batch / Tgl:"}
                    </span>
                    <span className="font-mono text-foreground">{selectedTx.batch_number || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground block text-[11px]">No. Referensi / PO:</span>
                    <span className="font-mono text-foreground">{selectedTx.reference_no || "—"}</span>
                  </div>
                </div>

                {selectedTx.notes && (
                  <div className="pt-2 border-t border-border/60 text-xs">
                    <span className="text-muted-foreground block mb-0.5">Petugas Sparepart:</span>
                    <p className="bg-surface p-2 rounded border border-border text-foreground">
                      {selectedTx.notes}
                    </p>
                  </div>
                )}
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
                          <td className="px-3 py-2 font-medium text-foreground">{it.product_name}</td>
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

              {/* Box Lampiran Dokumen */}
              <div className="space-y-1.5">
                <div className="text-xs font-semibold text-foreground">Dokumen / Bukti Fisik:</div>
                {selectedTx.document_url ? (
                  <div className="flex items-center justify-between rounded-lg border border-border bg-surface p-3 text-xs">
                    <div className="flex items-center gap-2.5 min-w-0 pr-2">
                      <div className="size-8 rounded bg-primary/10 flex items-center justify-center text-primary shrink-0">
                        <FileText className="size-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-foreground truncate max-w-[200px]">
                          Lampiran Bukti Mutasi
                        </div>
                        <div className="text-[10px] text-muted-foreground">Format file tersimpan di cloud storage</div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1.5 shrink-0">
                      <a
                        href={selectedTx.document_url}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-surface-muted hover:bg-surface-muted/80 text-foreground border border-border text-xs font-medium transition-colors"
                      >
                        <ExternalLink className="size-3" />
                        <span>Buka</span>
                      </a>
                      <a
                        href={selectedTx.document_url}
                        target="_blank"
                        rel="noreferrer"
                        download
                        className="inline-flex items-center gap-1 px-2.5 py-1 rounded bg-primary text-primary-foreground hover:bg-primary/90 text-xs font-medium transition-colors shadow-xs"
                      >
                        <Download className="size-3" />
                        <span>Unduh</span>
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="text-xs text-muted-foreground bg-surface-muted/40 p-3 rounded-lg border border-border text-center">
                    Tidak ada lampiran dokumen fisik pada mutasi ini.
                  </div>
                )}
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
    </AppShell>
  );
}
