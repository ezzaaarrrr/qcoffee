import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FlaskConical,
  Flame,
  Grid2x2,
  Plus,
  ClipboardCheck,
  Package,
  Shield,
  ShieldAlert,
  Users,
  CheckCircle2,
  Clock,
  XCircle,
  TrendingUp,
  ArrowDownLeft,
  ArrowUpRight,
  AlertTriangle,
  AlertCircle,
  History,
  FileText,
  FileSpreadsheet,
  ChevronDown,
  BarChart3,
  Wrench,
  Eye,
  Download,
  ExternalLink,
  Layers,
  Activity,
  BoxIcon,
  Calendar as CalendarIcon,
  Search,
} from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Cell,
  PieChart,
  Pie,
  Legend,
} from "recharts";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Panel, StatCard } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Calendar } from "@/components/ui/calendar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  fetchFormulasi,
  fetchGrinding,
  fetchRoasting,
  fetchProducts,
  fetchProfiles,
  type FormulasiRow,
  type GrindingRow,
  type RoastingRow,
} from "@/lib/queries";
import { formatDate, ROLE_LABELS, type AppRole } from "@/lib/domain";
import { useCurrentUser } from "@/hooks/useAuth";
import { supabase } from "@/integrations/supabase/client";
import { cn } from "@/lib/utils";
import {
  exportSparepartInventoryExcel,
  exportSparepartMutasiExcel,
} from "@/lib/exportUtils";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({
    meta: [
      { title: "DASHBOARD OVERVIEW" },
      {
        name: "description",
        content: "Dashboard khusus disesuaikan berdasarkan peran dan departemen di Warehouse  M2.",
      },
    ],
  }),
  component: DashboardPage,
});

type Activity = {
  id: string;
  kind: string;
  to: string;
  label: string;
  status: string;
  created_at: string;
};

// Tipe data Buffer Stok — tabel terpisah dari OBS Sparepart (mirrored from products.tsx)
type BufferStockItem = {
  id: string;
  name: string;
  code: string | null;
  unit?: string | null;
  location?: string | null;
  shelf?: string | null;
  min_stock?: number | null;
  safe_stock?: number | null;
  max_stock?: number | null;
  current_stock?: number | null;
  description?: string | null;
  image_url?: string | null;
  doc_url?: string | null;
  is_active: boolean;
  created_at?: string;
};

function DashboardPage() {
  const { profile, roles, isAdmin } = useCurrentUser();
  const [selectedTx, setSelectedTx] = useState<any | null>(null);
  const [selectedDate, setSelectedDate] = useState<Date | undefined>(new Date());

  // State untuk Interaktivitas Modal Detail 4 Kotak Ringkasan Metrik
  const [selectedMetricModal, setSelectedMetricModal] = useState<
    "total_gabungan" | "total_stok" | "stok_aman" | "perlu_perhatian" | null
  >(null);
  const [metricSearchQuery, setMetricSearchQuery] = useState("");
  const [metricCategoryFilter, setMetricCategoryFilter] = useState<"all" | "obs" | "buffer">("all");
  const [metricStatusFilter, setMetricStatusFilter] = useState<"all" | "safe" | "limit" | "empty">("all");

  // Queries
  const formulasi = useQuery({ queryKey: ["formulasi"], queryFn: fetchFormulasi });
  const grinding = useQuery({ queryKey: ["grinding"], queryFn: fetchGrinding });
  const roasting = useQuery({ queryKey: ["roasting"], queryFn: fetchRoasting });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });

  // Query Mutasi Barang Gudang (Barang Masuk & Keluar)
  const warehouseTx = useQuery({
    queryKey: ["warehouse_transactions_full"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("warehouse_transactions")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) return [];
      return (data ?? []) as {
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
      }[];
    },
  });

  // ── QUERY DATA BUFFER STOK (TABEL SENDIRI, INDEPENDEN) ────────────────────────
  const bufferStockQuery = useQuery({
    queryKey: ["buffer_stock"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("buffer_stock")
        .select("*")
        .order("name");
      if (error) {
        if (error.message?.includes("does not exist") || error.code === "42P01") return [];
        throw error;
      }
      return (data ?? []) as BufferStockItem[];
    },
  });
  const allBufferItems = bufferStockQuery.data ?? [];
  const activeBufferItems = allBufferItems.filter((b) => b.is_active);

  const txData = warehouseTx.data ?? [];
  const barangMasukCount = txData.filter((t) => t.tx_type === "IN").length;
  const barangKeluarCount = txData.filter((t) => t.tx_type === "OUT").length;

  const allProducts = products.data ?? [];
  const activeProducts = allProducts.filter((p) => p.is_active);
  const totalActiveProducts = activeProducts.length;

  // Lookup map untuk kode material dan unit barang
  const productCodeMap = useMemo(() => {
    const map = new Map<string, string>();
    allProducts.forEach((p) => {
      if (p.id && p.code) map.set(p.id, p.code);
      if (p.name && p.code) map.set(p.name.trim().toLowerCase(), p.code);
    });
    return map;
  }, [allProducts]);

  // Klasifikasi 3 Kondisi Status Stok Barang
  // 1. Stok Habis (0 pcs)
  const zeroProductsList = activeProducts.filter((p) => (p.current_stock ?? 0) <= 0);
  // 2. Stok Limit / Kritis (> 0 tapi <= min_stock)
  const limitOnlyProductsList = activeProducts.filter(
    (p) => (p.current_stock ?? 0) > 0 && (p.current_stock ?? 0) <= (p.min_stock ?? 10)
  );
  // 3. Stok Aman / Normal (> min_stock)
  const safeProductsList = activeProducts.filter(
    (p) => (p.current_stock ?? 0) > (p.min_stock ?? 10)
  );
  // Legacy: Semua barang yang perlu restock (stok <= min_stock)
  const limitProductsList = activeProducts.filter(
    (p) => (p.current_stock ?? 0) <= (p.min_stock ?? 10)
  );

  const zeroProductsCount = zeroProductsList.length;
  const limitOnlyCount = limitOnlyProductsList.length;
  const nonLimitProductsCount = safeProductsList.length;
  const limitProductsCount = limitProductsList.length;

  // Persentase masing-masing status
  const safePct = totalActiveProducts > 0 ? Math.round((nonLimitProductsCount / totalActiveProducts) * 100) : 0;
  const limitOnlyPct = totalActiveProducts > 0 ? Math.round((limitOnlyCount / totalActiveProducts) * 100) : 0;
  const zeroPct = totalActiveProducts > 0 ? Math.max(0, 100 - safePct - limitOnlyPct) : 0;

  const limitPct = totalActiveProducts > 0 ? Math.round((limitProductsCount / totalActiveProducts) * 100) : 0;
  const nonLimitPct = totalActiveProducts > 0 ? 100 - limitPct : 0;

  // Persentase barang yang tersedia memiliki stok (> 0 pcs)
  const availableItemsCount = totalActiveProducts - zeroProductsCount;
  const availablePct = totalActiveProducts > 0 ? Math.round((availableItemsCount / totalActiveProducts) * 100) : 0;

  // KPI Sparepart (Stok Aman):
  // Standar: Jika persentase <= 91.99% status "MISS", jika >= 92.00% status "HIT"
  const kpiExactPct = totalActiveProducts > 0 ? (nonLimitProductsCount / totalActiveProducts) * 100 : 0;
  const isKpiHit = kpiExactPct >= 92.0;
  const kpiStatus: "HIT" | "MISS" = isKpiHit ? "HIT" : "MISS";

  // ── ANALISIS GABUNGAN OBS + BUFFER STOCK ─────────────────────────────────────
  const combinedAnalysis = useMemo(() => {
    // Klasifikasi Buffer Stock (sama seperti OBS)
    const bufferZero = activeBufferItems.filter((b) => (b.current_stock ?? 0) <= 0);
    const bufferLimit = activeBufferItems.filter(
      (b) => (b.current_stock ?? 0) > 0 && (b.current_stock ?? 0) <= (b.min_stock ?? 10)
    );
    const bufferSafe = activeBufferItems.filter(
      (b) => (b.current_stock ?? 0) > (b.min_stock ?? 10)
    );

    // Total gabungan
    const totalOBS = totalActiveProducts;
    const totalBuffer = activeBufferItems.length;
    const totalGabungan = totalOBS + totalBuffer;

    // Status gabungan
    const gabunganAman = nonLimitProductsCount + bufferSafe.length;
    const gabunganLimit = limitOnlyCount + bufferLimit.length;
    const gabunganHabis = zeroProductsCount + bufferZero.length;

    // Total stok fisik gabungan
    const totalStokOBS = activeProducts.reduce((sum, p) => sum + (p.current_stock ?? 0), 0);
    const totalStokBuffer = activeBufferItems.reduce((sum, b) => sum + (b.current_stock ?? 0), 0);
    const totalStokGabungan = totalStokOBS + totalStokBuffer;

    // Persentase
    const pctAman = totalGabungan > 0 ? Math.round((gabunganAman / totalGabungan) * 100) : 0;
    const pctLimit = totalGabungan > 0 ? Math.round((gabunganLimit / totalGabungan) * 100) : 0;
    const pctHabis = totalGabungan > 0 ? Math.max(0, 100 - pctAman - pctLimit) : 0;
    const pctKetersediaan = totalGabungan > 0 ? Math.round(((totalGabungan - gabunganHabis) / totalGabungan) * 100) : 0;

    return {
      totalOBS, totalBuffer, totalGabungan,
      gabunganAman, gabunganLimit, gabunganHabis,
      totalStokOBS, totalStokBuffer, totalStokGabungan,
      pctAman, pctLimit, pctHabis, pctKetersediaan,
      bufferZero, bufferLimit, bufferSafe,
    };
  }, [activeProducts, activeBufferItems, totalActiveProducts, nonLimitProductsCount, limitOnlyCount, zeroProductsCount, safePct, limitOnlyPct, zeroPct]);

  // Data gabungan OBS + Buffer untuk Modal Interaktif 4 Kartu Metrik
  type MetricItem = {
    id: string;
    name: string;
    code?: string | null;
    category: "OBS Sparepart" | "Buffer Stock";
    current_stock: number;
    min_stock: number;
    unit: string;
    status: "safe" | "limit" | "empty";
  };

  const unifiedMetricItems = useMemo<MetricItem[]>(() => {
    const list: MetricItem[] = [];

    activeProducts.forEach((p) => {
      const stock = p.current_stock ?? 0;
      const minStock = p.min_stock ?? 10;
      let status: "safe" | "limit" | "empty" = "safe";
      if (stock <= 0) status = "empty";
      else if (stock <= minStock) status = "limit";

      list.push({
        id: `obs-${p.id}`,
        name: p.name,
        code: p.code,
        category: "OBS Sparepart",
        current_stock: stock,
        min_stock: minStock,
        unit: p.unit || "pcs",
        status,
      });
    });

    activeBufferItems.forEach((b) => {
      const stock = b.current_stock ?? 0;
      const minStock = b.min_stock ?? 10;
      let status: "safe" | "limit" | "empty" = "safe";
      if (stock <= 0) status = "empty";
      else if (stock <= minStock) status = "limit";

      list.push({
        id: `buffer-${b.id}`,
        name: b.name,
        code: b.code,
        category: "Buffer Stock",
        current_stock: stock,
        min_stock: minStock,
        unit: b.unit || "pcs",
        status,
      });
    });

    return list;
  }, [activeProducts, activeBufferItems]);

  // Filter barang sesuai kartu metrik yang dipilih & filter pencarian di modal
  const filteredModalItems = useMemo(() => {
    if (!selectedMetricModal) return [];

    let base = unifiedMetricItems;

    // Filter berdasarkan kartu metrik utama yang diklik
    if (selectedMetricModal === "total_stok") {
      // Urutkan dari stok fisik terbanyak
      base = [...base].sort((a, b) => b.current_stock - a.current_stock);
    } else if (selectedMetricModal === "stok_aman") {
      base = base.filter((it) => it.status === "safe");
    } else if (selectedMetricModal === "perlu_perhatian") {
      base = base.filter((it) => it.status === "limit" || it.status === "empty");
    }

    // Filter Kategori (Semua / OBS / Buffer)
    if (metricCategoryFilter === "obs") {
      base = base.filter((it) => it.category === "OBS Sparepart");
    } else if (metricCategoryFilter === "buffer") {
      base = base.filter((it) => it.category === "Buffer Stock");
    }

    // Filter Status (Aman / Limit / Habis)
    if (metricStatusFilter !== "all") {
      base = base.filter((it) => it.status === metricStatusFilter);
    }

    // Filter Pencarian nama atau kode material
    if (metricSearchQuery.trim()) {
      const q = metricSearchQuery.toLowerCase();
      base = base.filter(
        (it) =>
          it.name.toLowerCase().includes(q) ||
          (it.code && it.code.toLowerCase().includes(q))
      );
    }

    return base;
  }, [unifiedMetricItems, selectedMetricModal, metricCategoryFilter, metricStatusFilter, metricSearchQuery]);

  // Helper render Donut Chart SVG untuk Perbandingan Status Stok
  const renderDonutSvg = ({
    safePctVal,
    limitPctVal,
    zeroPctVal,
    centerValue,
    centerBadge,
    badgeClass,
    subText,
  }: {
    safePctVal: number;
    limitPctVal: number;
    zeroPctVal: number;
    centerValue: string;
    centerBadge: string;
    badgeClass: string;
    subText?: string;
  }) => {
    const size = 104;
    const strokeWidth = 13;
    const radius = 37;
    const circumference = 2 * Math.PI * radius;

    const total = (safePctVal + limitPctVal + zeroPctVal) || 100;
    const sPct = (safePctVal / total) * 100;
    const lPct = (limitPctVal / total) * 100;
    const zPct = (zeroPctVal / total) * 100;

    const safeDash = (sPct / 100) * circumference;
    const limitDash = (lPct / 100) * circumference;
    const zeroDash = (zPct / 100) * circumference;

    const safeOffset = 0;
    const limitOffset = -safeDash;
    const zeroOffset = -(safeDash + limitDash);

    return (
      <div className="relative flex items-center justify-center shrink-0">
        <svg width={size} height={size} viewBox="0 0 100 100" className="transform -rotate-90">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-slate-200 dark:text-slate-700"
          />
          {sPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#10b981"
              strokeWidth={strokeWidth}
              strokeDasharray={`${safeDash} ${circumference}`}
              strokeDashoffset={safeOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
          {lPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#f59e0b"
              strokeWidth={strokeWidth}
              strokeDasharray={`${limitDash} ${circumference}`}
              strokeDashoffset={limitOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
          {zPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#ef4444"
              strokeWidth={strokeWidth}
              strokeDasharray={`${zeroDash} ${circumference}`}
              strokeDashoffset={zeroOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span className="font-mono text-sm sm:text-base font-bold leading-tight text-foreground">
            {centerValue}
          </span>
          <span className={cn("text-[8.5px] font-black px-1.5 py-0.2 rounded-full uppercase tracking-wider mt-0.5 border shadow-xs", badgeClass)}>
            {centerBadge}
          </span>
          {subText && (
            <span className="text-[7.5px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5">
              {subText}
            </span>
          )}
        </div>
      </div>
    );
  };

  // Render Card Diagram & Analisis Status Barang: OBS Sparepart vs All Item Barang
  const renderStockAnalysisCard = () => {
    const ca = combinedAnalysis;
    const allSafePctExact = ca.totalGabungan > 0 ? (ca.gabunganAman / ca.totalGabungan) * 100 : 0;

    return (
      <div
        id="diagram-analisis-status-sparepart"
        className="rise-in border border-border bg-white p-5 flex flex-col justify-between h-full shadow-xs scroll-mt-20 rounded-xl"
      >
        {/* 2 Kolom Komparasi: OBS Sparepart vs All Item Barang */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 flex-1">
          {/* Sisi Kiri: OBS Sparepart */}
          <div className="border border-border/80 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/70 shadow-2xs">
            <div className="flex items-center gap-1.5 border-b border-border/80 pb-2">
              <Package className="size-3.5 text-blue-600 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">OBS Sparepart</span>
            </div>

            <div className="flex items-center justify-center py-2">
              {renderDonutSvg({
                safePctVal: safePct,
                limitPctVal: limitOnlyPct,
                zeroPctVal: zeroPct,
                centerValue: `${kpiExactPct.toFixed(1)}%`,
                centerBadge: kpiStatus,
                badgeClass: isKpiHit
                  ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                  : "bg-red-500/15 text-red-600 dark:text-red-500 border-red-500/40",
              })}
            </div>

            <div className="space-y-2 py-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-500" /> Aman
                </span>
                <span className="font-mono font-bold text-foreground">{nonLimitProductsCount} ({safePct}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-amber-500" /> Limit
                </span>
                <span className="font-mono font-bold text-foreground">{limitOnlyCount} ({limitOnlyPct}%)</span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-rose-500" /> Critical / Habis
                </span>
                <span className="font-mono font-bold text-foreground">{zeroProductsCount} ({zeroPct}%)</span>
              </div>
            </div>
          </div>

          {/* Sisi Kanan: All Item Barang (OBS + Buffer) */}
          <div className="border border-border/80 rounded-xl p-4 flex flex-col justify-between space-y-3 bg-slate-50/70 shadow-2xs">
            <div className="flex items-center gap-1.5 border-b border-border/80 pb-2">
              <Layers className="size-3.5 text-cyan-600 shrink-0" />
              <span className="text-xs font-bold uppercase tracking-wider text-foreground">All Item Barang</span>
            </div>

            <div className="flex items-center justify-center py-2">
              {renderDonutSvg({
                safePctVal: ca.pctAman,
                limitPctVal: ca.pctLimit,
                zeroPctVal: ca.pctHabis,
                centerValue: `${allSafePctExact.toFixed(1)}%`,
                centerBadge: "AMAN",
                badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
              })}
            </div>

            <div className="space-y-2 py-1">
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-emerald-500" /> Aman
                </span>
                <span className="font-mono font-bold text-foreground">
                  {ca.gabunganAman} ({ca.pctAman}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-amber-500" /> Limit
                </span>
                <span className="font-mono font-bold text-foreground">
                  {ca.gabunganLimit} ({ca.pctLimit}%)
                </span>
              </div>
              <div className="flex items-center justify-between text-xs">
                <span className="flex items-center gap-1.5 text-muted-foreground">
                  <span className="size-2 rounded-full bg-rose-500" /> Critical / Habis
                </span>
                <span className="font-mono font-bold text-foreground">
                  {ca.gabunganHabis} ({ca.pctHabis}%)
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Panel Analisis Keseluruhan OBS + Buffer Stock
  const renderCombinedAnalysisPanel = () => {
    const ca = combinedAnalysis;
    if (ca.totalGabungan === 0) return null;

    return (
      <div className="space-y-3">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-2.5">
          <div>
            <div className="flex items-center gap-2">
              <Layers className="size-4 text-primary shrink-0" />
              <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
                Analisis Keseluruhan Barang OBS & Buffer Stok
              </h3>
            </div>
            <p className="text-xs text-muted-foreground mt-0.5 font-medium">
              Ringkasan statistik gabungan dari seluruh barang OBS Sparepart + Buffer Stok.
            </p>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/25">
              OBS: {ca.totalOBS}
            </span>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/25">
              Buffer: {ca.totalBuffer}
            </span>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-slate-100 dark:bg-slate-800 border border-border text-foreground">
              Total: {ca.totalGabungan}
            </span>
          </div>
        </div>

        {/* 4 Stat Cards dengan Warna Tebal & Interaktif saat di-klik */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          {/* Card 1: Total Item Gabungan (Biru Tebal) */}
          <div
            onClick={() => {
              setSelectedMetricModal("total_gabungan");
              setMetricCategoryFilter("all");
              setMetricStatusFilter("all");
              setMetricSearchQuery("");
            }}
            className="cursor-pointer bg-blue-600 hover:bg-blue-600/90 active:scale-[0.99] border border-blue-400/40 rounded-lg p-4 space-y-1.5 shadow-md hover:shadow-lg transition-all text-white group select-none"
            title="Klik untuk melihat daftar seluruh item barang"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-blue-100">
                <BoxIcon className="size-3.5 text-blue-200" />
                Total Item Gabungan
              </div>
              <ArrowUpRight className="size-3.5 text-blue-200 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-tight">{ca.totalGabungan}</div>
            <div className="flex items-center justify-between text-[11px] text-blue-100/90 font-medium">
              <span>OBS: {ca.totalOBS} · Buffer: {ca.totalBuffer}</span>
              <span className="text-[10px] text-blue-200 underline underline-offset-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Lihat Barang
              </span>
            </div>
          </div>

          {/* Card 2: Total Stok Fisik (Cyan Tebal) */}
          <div
            onClick={() => {
              setSelectedMetricModal("total_stok");
              setMetricCategoryFilter("all");
              setMetricStatusFilter("all");
              setMetricSearchQuery("");
            }}
            className="cursor-pointer bg-cyan-600 hover:bg-cyan-600/90 active:scale-[0.99] border border-cyan-400/40 rounded-lg p-4 space-y-1.5 shadow-md hover:shadow-lg transition-all text-white group select-none"
            title="Klik untuk melihat daftar stok fisik barang"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-cyan-100">
                <Activity className="size-3.5 text-cyan-200" />
                Total Stok Fisik
              </div>
              <ArrowUpRight className="size-3.5 text-cyan-200 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-tight">{ca.totalStokGabungan.toLocaleString("id-ID")}</div>
            <div className="flex items-center justify-between text-[11px] text-cyan-100/90 font-medium">
              <span>OBS: {ca.totalStokOBS.toLocaleString("id-ID")} · Buffer: {ca.totalStokBuffer.toLocaleString("id-ID")}</span>
              <span className="text-[10px] text-cyan-200 underline underline-offset-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Lihat Barang
              </span>
            </div>
          </div>

          {/* Card 3: Rasio Stok Aman (Emerald / Hijau Tebal) */}
          <div
            onClick={() => {
              setSelectedMetricModal("stok_aman");
              setMetricCategoryFilter("all");
              setMetricStatusFilter("all");
              setMetricSearchQuery("");
            }}
            className="cursor-pointer bg-emerald-600 hover:bg-emerald-600/90 active:scale-[0.99] border border-emerald-400/40 rounded-lg p-4 space-y-1.5 shadow-md hover:shadow-lg transition-all text-white group select-none"
            title="Klik untuk melihat daftar barang stok aman"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-emerald-100">
                <CheckCircle2 className="size-3.5 text-emerald-200" />
                Rasio Stok Aman
              </div>
              <ArrowUpRight className="size-3.5 text-emerald-200 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-tight">{ca.pctAman}%</div>
            <div className="flex items-center justify-between text-[11px] text-emerald-100/90 font-medium">
              <span>{ca.gabunganAman} dari {ca.totalGabungan} item aman</span>
              <span className="text-[10px] text-emerald-200 underline underline-offset-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Lihat Barang
              </span>
            </div>
          </div>

          {/* Card 4: Perlu Perhatian (Amber / Oranye Tebal) */}
          <div
            onClick={() => {
              setSelectedMetricModal("perlu_perhatian");
              setMetricCategoryFilter("all");
              setMetricStatusFilter("all");
              setMetricSearchQuery("");
            }}
            className="cursor-pointer bg-amber-600 hover:bg-amber-600/90 active:scale-[0.99] border border-amber-400/40 rounded-lg p-4 space-y-1.5 shadow-md hover:shadow-lg transition-all text-white group select-none"
            title="Klik untuk melihat daftar barang yang perlu perhatian"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-[11px] font-bold uppercase tracking-wider text-amber-100">
                <AlertTriangle className="size-3.5 text-amber-200" />
                Perlu Perhatian (Limit & Habis)
              </div>
              <ArrowUpRight className="size-3.5 text-amber-200 opacity-60 group-hover:opacity-100 group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
            </div>
            <div className="text-2xl sm:text-3xl font-mono font-extrabold text-white tracking-tight">{ca.pctLimit + ca.pctHabis}%</div>
            <div className="flex items-center justify-between text-[11px] text-amber-100/90 font-medium">
              <span>{ca.gabunganLimit + ca.gabunganHabis} item ({ca.gabunganLimit} limit + {ca.gabunganHabis} habis)</span>
              <span className="text-[10px] text-amber-200 underline underline-offset-2 opacity-0 group-hover:opacity-100 transition-opacity">
                Lihat Barang
              </span>
            </div>
          </div>
        </div>
      </div>
    );
  };

  // Render Modal Detail Barang saat Kartu Metrik di-klik
  const renderMetricItemsModal = () => {
    if (!selectedMetricModal) return null;

    const ca = combinedAnalysis;
    let modalTitle = "";
    let modalDesc = "";
    let modalIcon = null;
    let modalBadge = "";
    let baseCount = 0;

    if (selectedMetricModal === "total_gabungan") {
      modalTitle = "Daftar Seluruh Item Barang";
      modalDesc = `Total ${ca.totalGabungan} item gabungan dari seluruh gudang OBS Sparepart dan Buffer Stock.`;
      modalBadge = `${ca.totalGabungan} Total Item`;
      modalIcon = <BoxIcon className="size-5 text-blue-500" />;
      baseCount = ca.totalGabungan;
    } else if (selectedMetricModal === "total_stok") {
      modalTitle = "Daftar Stok Fisik Barang";
      modalDesc = `Total ${ca.totalStokGabungan.toLocaleString("id-ID")} pcs stok fisik gabungan OBS & Buffer Stock (diurutkan dari stok terbanyak).`;
      modalBadge = `${ca.totalStokGabungan.toLocaleString("id-ID")} pcs`;
      modalIcon = <Activity className="size-5 text-cyan-500" />;
      baseCount = unifiedMetricItems.length;
    } else if (selectedMetricModal === "stok_aman") {
      modalTitle = "Daftar Barang Stok Aman (Normal / Surplus)";
      modalDesc = `Total ${ca.gabunganAman} item (${ca.pctAman}%) dengan status ketersediaan normal di atas batas minimum stok.`;
      modalBadge = `${ca.gabunganAman} Item Aman`;
      modalIcon = <CheckCircle2 className="size-5 text-emerald-500" />;
      baseCount = ca.gabunganAman;
    } else if (selectedMetricModal === "perlu_perhatian") {
      modalTitle = "Daftar Barang Perlu Perhatian (Limit & Habis)";
      modalDesc = `Total ${ca.gabunganLimit + ca.gabunganHabis} item (${ca.pctLimit + ca.pctHabis}%) kritis yang memerlukan penanganan pengadaan atau restock segera.`;
      modalBadge = `${ca.gabunganLimit + ca.gabunganHabis} Item Kritis`;
      modalIcon = <AlertTriangle className="size-5 text-amber-500" />;
      baseCount = ca.gabunganLimit + ca.gabunganHabis;
    }

    return (
      <Dialog
        open={!!selectedMetricModal}
        onOpenChange={(open) => {
          if (!open) {
            setSelectedMetricModal(null);
            setMetricSearchQuery("");
            setMetricCategoryFilter("all");
            setMetricStatusFilter("all");
          }
        }}
      >
        <DialogContent className="max-w-4xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden bg-surface border border-border shadow-2xl">
          {/* Header Modal */}
          <DialogHeader className="p-5 pb-4 border-b border-border bg-surface-muted/40">
            <div className="flex items-start justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-surface border border-border/80 shadow-xs shrink-0">
                  {modalIcon}
                </div>
                <div>
                  <DialogTitle className="text-base sm:text-lg font-bold text-foreground flex items-center gap-2 flex-wrap">
                    {modalTitle}
                    <span className="text-xs font-semibold px-2 py-0.5 rounded-full bg-primary/10 text-primary border border-primary/20">
                      {modalBadge}
                    </span>
                  </DialogTitle>
                  <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                    {modalDesc}
                  </DialogDescription>
                </div>
              </div>
            </div>

            {/* Filter & Search Bar */}
            <div className="mt-4 flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center justify-between">
              {/* Search Input */}
              <div className="relative flex-1">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
                <Input
                  value={metricSearchQuery}
                  onChange={(e) => setMetricSearchQuery(e.target.value)}
                  placeholder="Cari nama barang atau kode material..."
                  className="pl-8 h-9 text-xs bg-surface"
                />
              </div>

              {/* Filter Kategori: Semua / OBS / Buffer */}
              <div className="flex items-center gap-1 bg-surface p-1 rounded-md border border-border self-start sm:self-auto shrink-0">
                <button
                  type="button"
                  onClick={() => setMetricCategoryFilter("all")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer",
                    metricCategoryFilter === "all"
                      ? "bg-primary text-primary-foreground shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Semua ({unifiedMetricItems.length})
                </button>
                <button
                  type="button"
                  onClick={() => setMetricCategoryFilter("obs")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer",
                    metricCategoryFilter === "obs"
                      ? "bg-blue-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  OBS ({ca.totalOBS})
                </button>
                <button
                  type="button"
                  onClick={() => setMetricCategoryFilter("buffer")}
                  className={cn(
                    "text-xs px-2.5 py-1 rounded font-medium transition-colors cursor-pointer",
                    metricCategoryFilter === "buffer"
                      ? "bg-orange-600 text-white shadow-xs"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  Buffer ({ca.totalBuffer})
                </button>
              </div>

              {/* Filter Status (khusus Total Item & Total Stok) */}
              {(selectedMetricModal === "total_gabungan" || selectedMetricModal === "total_stok") && (
                <div className="flex items-center gap-1 bg-surface p-1 rounded-md border border-border self-start sm:self-auto shrink-0">
                  <button
                    type="button"
                    onClick={() => setMetricStatusFilter("all")}
                    className={cn(
                      "text-xs px-2 py-1 rounded font-medium transition-colors cursor-pointer",
                      metricStatusFilter === "all"
                        ? "bg-secondary text-secondary-foreground font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Semua
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricStatusFilter("safe")}
                    className={cn(
                      "text-xs px-2 py-1 rounded font-medium transition-colors cursor-pointer",
                      metricStatusFilter === "safe"
                        ? "bg-emerald-600 text-white font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Aman
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricStatusFilter("limit")}
                    className={cn(
                      "text-xs px-2 py-1 rounded font-medium transition-colors cursor-pointer",
                      metricStatusFilter === "limit"
                        ? "bg-amber-600 text-white font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Limit
                  </button>
                  <button
                    type="button"
                    onClick={() => setMetricStatusFilter("empty")}
                    className={cn(
                      "text-xs px-2 py-1 rounded font-medium transition-colors cursor-pointer",
                      metricStatusFilter === "empty"
                        ? "bg-red-600 text-white font-semibold"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Habis
                  </button>
                </div>
              )}
            </div>
          </DialogHeader>

          {/* Table Container */}
          <div className="flex-1 overflow-y-auto max-h-[55vh] p-0 divide-y divide-border">
            {filteredModalItems.length === 0 ? (
              <div className="p-10 text-center text-muted-foreground space-y-2">
                <Package className="size-8 mx-auto text-muted-foreground/50" />
                <p className="text-sm font-medium">Tidak ada barang yang cocok dengan kriteria pencarian/filter.</p>
              </div>
            ) : (
              <table className="w-full text-xs">
                <thead className="sticky top-0 bg-surface-muted border-b border-border z-10">
                  <tr>
                    <th className="py-2.5 px-3 text-center w-10 text-muted-foreground font-bold">#</th>
                    <th className="py-2.5 px-3 text-left w-32 font-bold text-muted-foreground">KODE</th>
                    <th className="py-2.5 px-3 text-left font-bold text-muted-foreground">NAMA BARANG</th>
                    <th className="py-2.5 px-3 text-center w-28 font-bold text-muted-foreground">KATEGORI</th>
                    <th className="py-2.5 px-3 text-right w-24 font-bold text-muted-foreground">STOK FISIK</th>
                    <th className="py-2.5 px-3 text-right w-24 font-bold text-muted-foreground">MIN. STOK</th>
                    <th className="py-2.5 px-3 text-center w-28 font-bold text-muted-foreground">STATUS</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredModalItems.map((item, idx) => {
                    const isSafe = item.status === "safe";
                    const isLimit = item.status === "limit";
                    const isEmpty = item.status === "empty";

                    return (
                      <tr key={item.id} className="hover:bg-surface-muted/40 transition-colors">
                        <td className="py-2.5 px-3 text-center text-muted-foreground font-mono">{idx + 1}</td>
                        <td className="py-2.5 px-3">
                          {item.code ? (
                            <span className="font-mono text-[11px] font-semibold bg-surface-muted px-1.5 py-0.5 rounded border border-border/70 text-foreground">
                              {item.code}
                            </span>
                          ) : (
                            <span className="text-muted-foreground font-mono">—</span>
                          )}
                        </td>
                        <td className="py-2.5 px-3 font-medium text-foreground">
                          <span title={item.name}>{item.name}</span>
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          <span
                            className={cn(
                              "text-[10px] font-bold px-2 py-0.5 rounded-full border",
                              item.category === "OBS Sparepart"
                                ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/25"
                                : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/25"
                            )}
                          >
                            {item.category === "OBS Sparepart" ? "OBS" : "Buffer"}
                          </span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono font-bold text-foreground">
                          {item.current_stock.toLocaleString("id-ID")} <span className="text-[10px] font-normal text-muted-foreground">{item.unit}</span>
                        </td>
                        <td className="py-2.5 px-3 text-right font-mono text-muted-foreground">
                          {item.min_stock.toLocaleString("id-ID")} {item.unit}
                        </td>
                        <td className="py-2.5 px-3 text-center">
                          {isSafe && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30">
                              <span className="size-1.5 rounded-full bg-emerald-500" />
                              Aman
                            </span>
                          )}
                          {isLimit && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-amber-500/15 text-amber-600 dark:text-amber-400 border border-amber-500/30">
                              <span className="size-1.5 rounded-full bg-amber-500" />
                              Limit
                            </span>
                          )}
                          {isEmpty && (
                            <span className="inline-flex items-center gap-1 text-[10px] font-bold px-2 py-0.5 rounded bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/30">
                              <span className="size-1.5 rounded-full bg-rose-500" />
                              Habis
                            </span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            )}
          </div>

          {/* Footer Modal */}
          <DialogFooter className="p-3.5 px-5 border-t border-border bg-surface-muted/30 flex flex-col sm:flex-row items-center justify-between gap-2">
            <div className="text-xs text-muted-foreground">
              Menampilkan <span className="font-bold text-foreground">{filteredModalItems.length}</span> dari{" "}
              <span className="font-bold text-foreground">{baseCount}</span> barang
            </div>
            <div className="flex items-center gap-2">
              <Link to="/products">
                <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 cursor-pointer">
                  <ExternalLink className="size-3.5" />
                  Buka Manajemen Barang
                </Button>
              </Link>
              <Button
                size="sm"
                onClick={() => {
                  setSelectedMetricModal(null);
                  setMetricSearchQuery("");
                  setMetricCategoryFilter("all");
                  setMetricStatusFilter("all");
                }}
                className="h-8 text-xs cursor-pointer"
              >
                Tutup
              </Button>
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    );
  };

  // Hitung total kuantitas & frekuensi mutasi keluar (OUT) per barang dari riwayat mutasi (semua & hari ini)
  const { productOutMap, productOutTodayMap, productOutFreqMap, productOutFreqTodayMap } = useMemo(() => {
    const mapAll = new Map<string, number>();
    const mapToday = new Map<string, number>();
    const freqAll = new Map<string, number>();
    const freqToday = new Map<string, number>();

    const now = new Date();
    const todayStr = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

    txData.forEach((t) => {
      if (t.tx_type === "OUT") {
        const qty = Number(t.quantity) || 0;
        const txDateStr = t.created_at ? t.created_at.slice(0, 10) : "";
        const isToday = txDateStr === todayStr;

        if (t.product_id) {
          mapAll.set(t.product_id, (mapAll.get(t.product_id) || 0) + qty);
          freqAll.set(t.product_id, (freqAll.get(t.product_id) || 0) + 1);
          if (isToday) {
            mapToday.set(t.product_id, (mapToday.get(t.product_id) || 0) + qty);
            freqToday.set(t.product_id, (freqToday.get(t.product_id) || 0) + 1);
          }
        }
        if (t.product_name) {
          const nameKey = t.product_name.trim().toLowerCase();
          mapAll.set(nameKey, (mapAll.get(nameKey) || 0) + qty);
          freqAll.set(nameKey, (freqAll.get(nameKey) || 0) + 1);
          if (isToday) {
            mapToday.set(nameKey, (mapToday.get(nameKey) || 0) + qty);
            freqToday.set(nameKey, (freqToday.get(nameKey) || 0) + 1);
          }
        }
      }
    });
    return {
      productOutMap: mapAll,
      productOutTodayMap: mapToday,
      productOutFreqMap: freqAll,
      productOutFreqTodayMap: freqToday,
    };
  }, [txData]);

  // Diagram Inventory: Top Barang yang Paling Sering Keluar (Berdasarkan Frekuensi Transaksi Mutasi Keluar/OUT)
  const inventoryChartData = activeProducts
    .slice()
    .sort((a, b) => {
      const freqA = productOutFreqMap.get(a.id) ?? (a.name ? productOutFreqMap.get(a.name.trim().toLowerCase()) ?? 0 : 0);
      const freqB = productOutFreqMap.get(b.id) ?? (b.name ? productOutFreqMap.get(b.name.trim().toLowerCase()) ?? 0 : 0);
      if (freqB !== freqA) {
        return freqB - freqA;
      }
      const outA = productOutMap.get(a.id) ?? (a.name ? productOutMap.get(a.name.trim().toLowerCase()) ?? 0 : 0);
      const outB = productOutMap.get(b.id) ?? (b.name ? productOutMap.get(b.name.trim().toLowerCase()) ?? 0 : 0);
      if (outB !== outA) {
        return outB - outA;
      }
      return (b.current_stock ?? 0) - (a.current_stock ?? 0);
    })
    .slice(0, 10)
    .map((p) => {
      const shortName = p.name.length > 16 ? p.name.slice(0, 15) + "…" : p.name;
      const current = p.current_stock ?? 0;
      const min = p.min_stock ?? 10;
      const isZero = current <= 0;
      const isLow = current <= min;
      const frequency = productOutFreqMap.get(p.id) ?? (p.name ? productOutFreqMap.get(p.name.trim().toLowerCase()) ?? 0 : 0);
      const freqToday = productOutFreqTodayMap.get(p.id) ?? (p.name ? productOutFreqTodayMap.get(p.name.trim().toLowerCase()) ?? 0 : 0);
      const totalQtyOut = productOutMap.get(p.id) ?? (p.name ? productOutMap.get(p.name.trim().toLowerCase()) ?? 0 : 0);
      const outToday = productOutTodayMap.get(p.id) ?? (p.name ? productOutTodayMap.get(p.name.trim().toLowerCase()) ?? 0 : 0);
      return {
        name: shortName,
        fullName: p.name,
        code: p.code || "—",
        frequency,
        freqToday,
        totalQtyOut,
        stock: current,
        minStock: min,
        outToday,
        unit: p.unit || "unit",
        color: isZero ? "#FF0000" : isLow ? "#FFFF00" : "#00c056ff",
      };
    });

  const renderInventoryChartPanel = () => {
    if (activeProducts.length === 0) return null;

    return (
      <div className="rise-in border border-border bg-surface p-5 flex flex-col justify-between h-full shadow-xs space-y-4">
        <div>
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
            <div>
              <div className="flex items-center gap-2">
                <Wrench className="size-4 text-primary shrink-0" />
                <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
                  TOP 10 OUTGOING SPAREPART
                </h3>
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">
                Menampilkan sparepart yang paling sering muncul dalam catatan barang keluar berdasarkan frekuensi transaksi.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                <span className="size-2 rounded-full bg-emerald-500" />
                Normal
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <span className="size-2 rounded-full bg-amber-500" />
                Low Stock
              </span>
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20">
                <span className="size-2 rounded-full bg-rose-500" />
                Critical
              </span>
            </div>
          </div>
        </div>

        <div className="h-64 sm:h-72 w-full pt-2 flex-1 min-h-[250px]">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={inventoryChartData}
              margin={{ top: 10, right: 15, left: -15, bottom: 35 }}
            >
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" opacity={0.6} />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 10, fill: "#64748b" }}
                angle={-20}
                textAnchor="end"
                interval={0}
                stroke="#cbd5e1"
              />
              <YAxis
                tick={{ fontSize: 11, fill: "#64748b" }}
                stroke="#cbd5e1"
                allowDecimals={false}
              />
              <RechartsTooltip
                content={({ active, payload }) => {
                  if (active && payload && payload.length && payload[0]?.payload) {
                    const data = payload[0].payload;
                    return (
                      <div className="rounded border border-border bg-surface p-2.5 shadow-md text-xs space-y-1 z-50">
                        <p className="font-bold text-foreground text-xs">{data.fullName}</p>
                        <p className="text-[10px] text-muted-foreground font-mono">SKU: {data.code}</p>

                        <div className="flex items-center gap-2 pt-1 border-t border-border mt-1">
                          <span className="text-muted-foreground">Frekuensi Keluar:</span>
                          <span className="font-bold font-mono text-primary">
                            {data.frequency.toLocaleString("id-ID")} kali transaksi
                          </span>
                        </div>
                        {data.freqToday > 0 && (
                          <div className="flex items-center gap-2">
                            <span className="text-muted-foreground">Frekuensi Hari Ini:</span>
                            <span className="font-bold font-mono text-amber-600 dark:text-amber-400">
                              {data.freqToday.toLocaleString("id-ID")} kali
                            </span>
                          </div>
                        )}
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Total Qty Keluar:</span>
                          <span className="font-bold font-mono text-rose-600 dark:text-rose-400">
                            {data.totalQtyOut.toLocaleString("id-ID")} {data.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-2 pt-1 border-t border-border/50">
                          <span className="text-muted-foreground">Sisa Stok Fisik:</span>
                          <span className="font-bold font-mono" style={{ color: data.color }}>
                            {data.stock.toLocaleString("id-ID")} {data.unit}
                          </span>
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-muted-foreground">Batas Minimum:</span>
                          <span className="font-mono text-muted-foreground font-medium">
                            {data.minStock.toLocaleString("id-ID")} {data.unit}
                          </span>
                        </div>
                        <div className="pt-0.5">
                          <span
                            className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold"
                            style={{ backgroundColor: `${data.color}20`, color: data.color }}
                          >
                            Status Stok: {data.status}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="frequency" radius={[4, 4, 0, 0]} maxBarSize={48}>
                {inventoryChartData.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

  // Grouping Transaksi Mutasi untuk Dashboard (1 No. Transaksi = 1 Bon)
  type DashboardGroupedTx = {
    id: string;
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

  const groupedTxData: DashboardGroupedTx[] = txData.reduce((acc: DashboardGroupedTx[], tx) => {
    let existing = acc.find((g) => g.transaction_number === tx.transaction_number);
    if (!existing) {
      existing = {
        id: tx.id,
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

  // Fungsi Cetak & Unduh PDF Bukti Mutasi Barang Resmi (1 Bon / Batch)
  function downloadTransactionPDF(tx: DashboardGroupedTx | {
    transaction_number: string;
    tx_type: "IN" | "OUT" | "ADJUSTMENT";
    product_name?: string;
    quantity?: number;
    unit?: string;
    items?: Array<{ product_name: string; quantity: number; unit: string }>;
    batch_number?: string | null;
    reference_no?: string | null;
    supplier_or_dest?: string | null;
    notes?: string | null;
    created_by_name?: string | null;
    created_at: string;
  }) {
    const isMasuk = tx.tx_type === "IN";
    const titleType = isMasuk ? "BUKTI PENERIMAAN BARANG (INBOUND)" : "BUKTI PENGELUARAN BARANG (OUTBOUND)";
    const colorHeader = isMasuk ? "#059669" : "#e11d48";
    const dateFormatted = formatDate(tx.created_at);

    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up diblokir browser. Mohon izinkan pop-up untuk mencetak dokumen PDF.");
      return;
    }

    const itemsToRender = ("items" in tx && tx.items && tx.items.length > 0)
      ? tx.items
      : [{
        product_name: (tx as any).product_name || "Produk",
        quantity: (tx as any).quantity || 0,
        unit: (tx as any).unit || "kg",
      }];

    const itemRowsHtml = itemsToRender
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
            <div class="company-title">GD-SPAREPART M2</div>
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
          DAFTAR BARANG YANG DIMUTASIKAN (${itemsToRender.length} ITEM):
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

        ${tx.notes
        ? `
          <div class="notes-card">
            <div class="meta-label" style="margin-bottom: 4px;">Petugas Sparepart Shift 1/2/3:</div>
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
  }

  // Fungsi Cetak & Unduh PDF Bukti Form Checklist Operasional
  function downloadChecklistPDF(item: any) {
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up diblokir browser. Mohon izinkan pop-up untuk mencetak dokumen PDF.");
      return;
    }

    const titleKind = item.kind.toUpperCase();
    const dateFormatted = item.date;

    const htmlContent = `
      <!DOCTYPE html>
      <html lang="id">
      <head>
        <meta charset="UTF-8">
        <title>${item.kind} - ${item.label}</title>
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
            background-color: #0284c7;
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
          .status-tag {
            display: inline-block;
            padding: 2px 8px;
            border-radius: 4px;
            font-weight: 600;
            font-size: 11px;
            text-transform: uppercase;
            background-color: #e2e8f0;
            color: #334155;
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
            <div class="company-title">GD-SPAREPART M2</div>
            <div class="company-sub">Laporan Dokumen Checklist Operasional Produksi</div>
          </div>
          <div class="doc-badge">CHECKLIST ${titleKind}</div>
        </div>

        <div class="meta-grid">
          <div class="meta-item">
            <div class="meta-label">Jenis Formulir</div>
            <div class="meta-value">${item.kind}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Tanggal Pelaksanaan</div>
            <div class="meta-value">${dateFormatted}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Detail / Batch Produk</div>
            <div class="meta-value">${item.label}</div>
          </div>
          <div class="meta-item">
            <div class="meta-label">Status Verifikasi</div>
            <div class="meta-value">
              <span class="status-tag">${item.status}</span>
            </div>
          </div>
        </div>

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
  }

  const f: FormulasiRow[] = formulasi.data ?? [];
  const g: GrindingRow[] = grinding.data ?? [];
  const r: RoastingRow[] = roasting.data ?? [];
  const all = [...f, ...g, ...r];

  const today = new Date().toISOString().slice(0, 10);
  const todayCount =
    f.filter((x) => x.tanggal_mixing === today).length +
    g.filter((x) => x.hari_tanggal === today).length +
    r.filter((x) => x.hari_tanggal === today).length;

  const pending = all.filter((x) => x.status === "Pending QC").length;
  const approved = all.filter((x) => x.status === "Approved").length;
  const rejected = all.filter((x) => x.status === "Rejected").length;
  const rate = all.length ? Math.round((approved / all.length) * 100) : 0;

  const activity = [
    ...f.map((x) => ({
      id: x.id,
      kind: "Formulasi",
      to: "/formulasi",
      label: `${x.produk || "Produk"} · Batch ${x.no_urut_batch || "-"}`,
      sub: "",
      date: formatDate(x.tanggal_mixing || x.created_at),
      status: x.status,
      created_at: x.created_at,
    })),
    ...g.map((x) => ({
      id: x.id,
      kind: "Grinding",
      to: "/grinding",
      label: `${x.nama_produk || "Produk"} · ${x.no_grinder || "-"}`,
      sub: "",
      date: formatDate(x.hari_tanggal || x.created_at),
      status: x.status,
      created_at: x.created_at,
    })),
    ...r.map((x) => ({
      id: x.id,
      kind: "Roasting",
      to: "/roasting",
      label: `${x.nama_produk || "Produk"} · ${x.no_roaster || "-"}`,
      sub: "",
      date: formatDate(x.hari_tanggal || x.created_at),
      status: x.status,
      created_at: x.created_at,
    })),
  ]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))
    .slice(0, 8);

  const loading = formulasi.isLoading || grinding.isLoading || roasting.isLoading;

  // Menentukan role pengguna aktif
  const userRole: AppRole = roles.includes("admin")
    ? "admin"
    : roles.includes("qc_field")
      ? "qc_field"
      : roles.includes("admin_process")
        ? "admin_process"
        : roles.includes("prod_process_uh")
          ? "prod_process_uh"
          : "admin_process";

  // Handlers Export Laporan Dashboard OBS Sparepart
  const handleExportInventory = () => {
    try {
      if (allProducts.length === 0) {
        toast.error("Tidak ada data inventaris untuk diekspor");
        return;
      }

      const inMap: Record<string, { created_at: string }> = {};
      const outMap: Record<string, { created_at: string }> = {};
      const inQty: Record<string, number> = {};
      const outQty: Record<string, number> = {};

      txData.forEach((tx) => {
        const qty = Number(tx.quantity) || 0;
        const idKey = tx.product_id;
        const nameKey = tx.product_name ? tx.product_name.trim().toLowerCase() : "";

        if (tx.tx_type === "IN") {
          if (idKey && !inMap[idKey]) inMap[idKey] = { created_at: tx.created_at };
          if (nameKey && !inMap[nameKey]) inMap[nameKey] = { created_at: tx.created_at };
          if (idKey) inQty[idKey] = (inQty[idKey] || 0) + qty;
          if (nameKey) inQty[nameKey] = (inQty[nameKey] || 0) + qty;
        } else if (tx.tx_type === "OUT") {
          if (idKey && !outMap[idKey]) outMap[idKey] = { created_at: tx.created_at };
          if (nameKey && !outMap[nameKey]) outMap[nameKey] = { created_at: tx.created_at };
          if (idKey) outQty[idKey] = (outQty[idKey] || 0) + qty;
          if (nameKey) outQty[nameKey] = (outQty[nameKey] || 0) + qty;
        }
      });

      exportSparepartInventoryExcel({
        products: allProducts,
        latestInTxMap: inMap,
        latestOutTxMap: outMap,
        totalInQtyMap: inQty,
        totalOutQtyMap: outQty,
        generatedByName: profile?.full_name || profile?.email || "Pengguna Dashboard Sparepart",
        categoryFilter: "Semua Kategori",
      });

      toast.success("Laporan stok & master sparepart berhasil diekspor (.xls)");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Gagal mengekspor laporan stok & master");
    }
  };

  const handleExportMutasi = () => {
    try {
      if (groupedTxData.length === 0) {
        toast.error("Tidak ada data mutasi untuk diekspor");
        return;
      }

      exportSparepartMutasiExcel({
        groupedTransactions: groupedTxData,
        generatedByName: profile?.full_name || profile?.email || "Pengguna Dashboard Sparepart",
      });

      toast.success("Laporan riwayat mutasi gudang berhasil diekspor (.xls)");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Gagal mengekspor laporan riwayat mutasi");
    }
  };

  return (
    <AppShell breadcrumb="DASHBOARD OVERVIEW" contentClassName="bg-slate-50/70">
      {/* Header Dashboard */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight text-foreground">DASHBOARD OVERVIEW</h1>
          </div>
          <p className="mt-1 text-sm text-muted-foreground font-medium">
            {userRole === "admin" && "Ringkasan statistik penuh seluruh departemen, manajemen master data, dan kontrol sistem."}
            {userRole === "qc_field" && "Ringkasan Aktivitas"}
            {userRole === "admin_process" && "Overview tugas pemeriksaan checklist harian operasional lini produksi."}
            {userRole === "prod_process_uh" && "Overview inventaris dan mutasi stok barang/sparepart."}
          </p>
        </div>

        {/* Kalender Header */}
        <div className="flex items-center gap-2 sm:shrink-0">
          <Popover>
            <PopoverTrigger asChild>
              <Button
                size="sm"
                variant="outline"
                className="h-9 gap-2 bg-white hover:bg-slate-50 text-foreground border-border font-semibold shadow-xs transition-all cursor-pointer"
                title="Buka Kalender"
              >
                <CalendarIcon className="size-4 text-primary shrink-0" />
                <span className="whitespace-nowrap capitalize">
                  {(selectedDate || new Date()).toLocaleDateString("id-ID", {
                    weekday: "long",
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-0 shadow-lg bg-surface border border-border" align="end">
              <Calendar
                mode="single"
                selected={selectedDate}
                onSelect={(d) => d && setSelectedDate(d)}
                initialFocus
              />
            </PopoverContent>
          </Popover>
        </div>
      </div>

      {(userRole === "admin" || isAdmin) && (
        <div className="space-y-6">
          {/* Ringkasan Analisis Keseluruhan OBS + Buffer Stock */}
          {renderCombinedAnalysisPanel()}

          {/* Section: Status Stok Barang & TOP 10 Outgoing Berdampingan */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Diagram & Analisis Status Barang & Sparepart */}
            {renderStockAnalysisCard()}

            {/* Card 2: TOP 10 OUTGOING SPAREPART */}
            {renderInventoryChartPanel()}
          </div>

          {/* Section Bawah: Aktivitas Mutasi Gudang */}
          <Panel
            title="Aktivitas Mutasi Gudang"
            description="Riwayat transaksi pencatatan barang masuk (In) & barang keluar (Out)"
            actions={
              <Link to="/products" search={{ tab: "transactions" }}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <History className="size-3.5 text-primary" />
                  Lihat Semua Mutasi →
                </Button>
              </Link>
            }
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-border bg-surface-muted/50">
                    <th className="label-caps px-4 py-2.5 text-left w-36">No. Transaksi</th>
                    <th className="label-caps px-4 py-2.5 text-left w-28">Tipe Mutasi</th>
                    <th className="label-caps px-4 py-2.5 text-left min-w-[380px] md:min-w-[480px]">Nama Sparepart & Jumlah</th>
                    <th className="label-caps px-4 py-2.5 text-left w-36">Batch / Ref No</th>
                    <th className="label-caps px-4 py-2.5 text-left w-40">Pihak / Tujuan</th>
                    <th className="label-caps px-4 py-2.5 text-left w-36">Waktu & Petugas</th>
                    <th className="label-caps px-4 py-2.5 text-right w-36">Aksi & Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {warehouseTx.isLoading && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                        Memuat data mutasi gudang...
                      </td>
                    </tr>
                  )}
                  {groupedTxData.slice(0, 8).map((tx) => (
                    <tr key={tx.transaction_number} className="hover:bg-surface-muted/30">
                      <td className="px-4 py-3 font-mono text-xs font-medium text-foreground">
                        {tx.transaction_number}
                      </td>
                      <td className="px-4 py-3">
                        <Badge
                          variant={tx.tx_type === "IN" ? "default" : "destructive"}
                          className={
                            tx.tx_type === "IN"
                              ? "text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase"
                              : "text-[10px] font-mono bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase"
                          }
                        >
                          {tx.tx_type === "IN" ? "Masuk (In)" : "Keluar (Out)"}
                        </Badge>
                      </td>
                      <td className="px-4 py-3 min-w-[380px] md:min-w-[480px]">
                        <div className="space-y-1.5">
                          {tx.items.map((it, idx) => (
                            <div
                              key={it.id || idx}
                              className="flex items-center justify-between gap-3 text-xs bg-surface-muted/50 hover:bg-surface-muted px-2.5 py-1 rounded border border-border/50 transition-colors"
                            >
                              <span className="font-semibold text-foreground leading-snug">
                                {idx + 1}. {it.product_name}
                              </span>
                              <Badge
                                variant="outline"
                                className={cn(
                                  "font-mono font-bold text-xs shrink-0 px-1.5 py-0",
                                  tx.tx_type === "IN"
                                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border-emerald-500/25"
                                    : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border-rose-500/25"
                                )}
                              >
                                {tx.tx_type === "IN" ? "+" : "-"}
                                {it.quantity} {it.unit || "pcs"}
                              </Badge>
                            </div>
                          ))}
                          {tx.items.length > 1 && (
                            <div className="text-[10px] text-muted-foreground px-1">
                              Total: {tx.items.length} item sparepart
                            </div>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>Batch: {tx.batch_number || "—"}</div>
                        <div className="text-[10px] font-mono">Ref: {tx.reference_no || "—"}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        {tx.supplier_or_dest || "—"}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground">
                        <div>{formatDate(tx.created_at)}</div>
                        <div className="font-medium text-foreground">{tx.created_by_name || "Petugas"}</div>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => setSelectedTx(tx)}
                            className="h-7 text-xs px-2 gap-1"
                            title="Lihat detail mutasi"
                          >
                            <Eye className="size-3.5 text-primary" />
                            <span>Detail</span>
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => downloadTransactionPDF(tx)}
                            className="h-7 text-xs px-2 gap-1 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                            title="Cetak & Unduh Dokumen PDF Mutasi (1 Bon)"
                          >
                            <Download className="size-3.5" />
                            <span>PDF</span>
                          </Button>
                          {tx.document_url && (
                            <a
                              href={tx.document_url}
                              target="_blank"
                              rel="noreferrer"
                              className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground underline px-1"
                              title="Lihat lampiran berkas asli"
                            >
                              <FileText className="size-3.5" />
                            </a>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!warehouseTx.isLoading && groupedTxData.length === 0 && (
                    <tr>
                      <td colSpan={7} className="px-5 py-8 text-center text-muted-foreground">
                        Belum ada riwayat transaksi mutasi barang.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {userRole === "qc_field" && (
        <div className="space-y-6">
          {/* Ringkasan Analisis Keseluruhan OBS + Buffer Stock */}
          {renderCombinedAnalysisPanel()}

          {/* Section: Status Stok Barang & TOP 10 Outgoing Berdampingan */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Diagram & Analisis Status Barang & Sparepart */}
            {renderStockAnalysisCard()}

            {/* Card 2: TOP 10 OUTGOING SPAREPART */}
            {renderInventoryChartPanel()}
          </div>

          <Panel
            title="Aktivitas Seluruh Sistem"
            description="Riwayat mutasi pencatatan barang masuk (In) & barang keluar (Out)"
            actions={
              <Link to="/products" search={{ tab: "transactions" }}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <History className="size-3.5 text-primary" />
                  Lihat Semua Mutasi →
                </Button>
              </Link>
            }
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse border border-border">
                <thead>
                  <tr className="border-b border-blue-700 bg-blue-600 dark:bg-blue-700 text-white uppercase text-[11px] tracking-wider font-bold divide-x divide-blue-500/40 text-center">
                    <th className="px-4 py-3 w-36 font-bold text-center">Tanggal</th>
                    <th className="px-3 py-3 w-32 whitespace-nowrap font-bold text-center">
                      <div className="font-bold">Tipe Mutasi</div>
                      <div className="text-[10px] text-blue-100 font-semibold normal-case">(In/Out)</div>
                    </th>
                    <th className="px-3 py-3 w-32 font-bold text-center">KODE</th>
                    <th className="px-4 py-3 min-w-[220px] font-bold text-center">MATERIAL</th>
                    <th className="px-4 py-3 w-40 font-bold text-center">Vendor / Tujuan</th>
                    <th className="px-4 py-3 w-36 font-bold text-center">No. Ref</th>
                    <th className="px-4 py-3 w-36 font-bold text-center">User</th>
                    <th className="px-4 py-3 text-center w-36 font-bold">Aksi & Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {warehouseTx.isLoading && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                        Memuat data mutasi gudang...
                      </td>
                    </tr>
                  )}
                  {groupedTxData.slice(0, 8).map((tx) => {
                    const isMasuk = tx.tx_type === "IN";
                    const isToday =
                      new Date(tx.created_at).toDateString() === new Date().toDateString();

                    return (
                      <tr
                        key={tx.transaction_number}
                        className="hover:bg-surface-muted/40 transition-colors align-top divide-x divide-border"
                      >
                        {/* 1. Tanggal */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-medium text-foreground text-xs whitespace-nowrap">
                            <span>{formatDate(tx.created_at)}</span>
                            {isToday && (
                              <span className="size-1.5 rounded-full bg-blue-500 inline-block shrink-0" title="Hari ini" />
                            )}
                          </div>
                        </td>

                        {/* 2. Tipe Mutasi (In/Out) */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center gap-1 w-16 h-6 rounded text-[11px] font-semibold uppercase tracking-wide",
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
                            {isMasuk ? "In" : "Out"}
                          </span>
                        </td>

                        {/* 3. Kode Material */}
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            {tx.items.map((it, idx) => {
                              const code = productCodeMap.get(it.product_id) || (it.product_name ? productCodeMap.get(it.product_name.trim().toLowerCase()) : undefined);
                              return (
                                <div key={it.id || idx} className="h-7 flex items-center justify-center">
                                  {code ? (
                                    <span className="font-mono text-[11px] font-semibold bg-surface-muted px-1.5 py-0.5 rounded border border-border/60 text-foreground">
                                      {code}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-muted-foreground text-xs">—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* 4. Nama Barang */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {tx.items.map((it, idx) => (
                              <div
                                key={it.id || idx}
                                className="h-7 flex items-center justify-between gap-2 text-xs font-medium text-foreground leading-snug"
                              >
                                <div className="flex items-center gap-1 truncate max-w-[220px]">
                                  {tx.items.length > 1 && (
                                    <span className="text-muted-foreground mr-1 text-[11px] shrink-0">{idx + 1}.</span>
                                  )}
                                  <span className="truncate" title={it.product_name}>
                                    {it.product_name}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "font-mono font-bold text-[11px] px-1.5 py-0.5 rounded shrink-0",
                                    isMasuk
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  )}
                                >
                                  {isMasuk ? "+" : "-"}{it.quantity} {it.unit || "pcs"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* 5. Vendor / Tujuan */}
                        <td className="px-4 py-3 text-xs">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                            {isMasuk ? "Vendor Pengirim" : "Tujuan Line"}
                          </span>
                          <span className="font-medium text-foreground mt-0.5 block">
                            {tx.supplier_or_dest || "—"}
                          </span>
                        </td>

                        {/* 6. No. Ref */}
                        <td className="px-4 py-3 text-xs">
                          {tx.reference_no ? (
                            <span className="font-mono text-xs text-foreground bg-surface-muted px-1.5 py-0.5 rounded border border-border/40 inline-block">
                              {tx.reference_no}
                            </span>
                          ) : tx.batch_number ? (
                            <span className="font-mono text-xs text-muted-foreground block">
                              {tx.batch_number}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* 7. User */}
                        <td className="px-4 py-3 text-xs">
                          <span className="font-medium text-foreground block">
                            {tx.created_by_name || "User"}
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

                        {/* 8. Aksi & Dokumen */}
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
                  {!warehouseTx.isLoading && groupedTxData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                        Belum ada riwayat transaksi mutasi barang.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

      {userRole === "admin_process" && (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Form Diajukan" value={all.length} hint="Total input operator" />
            <StatCard label="Menunggu Review" value={pending} accent="warning" hint="Sedang di-audit" />
            <StatCard label="Form Disetujui" value={approved} accent="success" hint="Checklist valid" />
          </div>

          <Panel title="Checklist Terakhir Departemen Produksi" bodyClassName="p-0">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50">
                  <th className="label-caps px-5 py-2.5 text-left">Jenis Checklist</th>
                  <th className="label-caps px-5 py-2.5 text-left">Batch / Produk</th>
                  <th className="label-caps px-5 py-2.5 text-left">Tanggal</th>
                  <th className="label-caps px-5 py-2.5 text-left">Status</th>
                  <th className="label-caps px-5 py-2.5 text-right">Unduh Dokumen</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {activity.map((a) => (
                  <tr key={a.kind + a.id} className="hover:bg-surface-muted/30">
                    <td className="px-5 py-3 font-mono text-xs uppercase">{a.kind}</td>
                    <td className="px-5 py-3 font-medium">{a.label}</td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{a.date}</td>
                    <td className="px-5 py-3"><StatusBadge status={a.status as never} /></td>
                    <td className="px-5 py-3 text-right">
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => downloadChecklistPDF(a)}
                        className="h-7 text-xs px-2 gap-1 bg-primary/5 hover:bg-primary/10 text-primary border-primary/20"
                        title="Cetak & Unduh Dokumen PDF"
                      >
                        <Download className="size-3.5" />
                        <span>PDF</span>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>
        </div>
      )}

      {userRole === "prod_process_uh" && (
        <div className="space-y-6">
          {/* Ringkasan Analisis Keseluruhan OBS + Buffer Stock */}
          {renderCombinedAnalysisPanel()}

          {/* Section: Status Stok Barang & TOP 10 Outgoing Berdampingan */}
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
            {/* Card 1: Diagram & Analisis Status Barang & Sparepart */}
            {renderStockAnalysisCard()}

            {/* Card 2: TOP 10 OUTGOING SPAREPART */}
            {renderInventoryChartPanel()}
          </div>

          <Panel
            title="Aktivitas Seluruh Sistem"
            description="Riwayat mutasi pencatatan barang masuk (In) & barang keluar (Out)"
            actions={
              <Link to="/products" search={{ tab: "transactions" }}>
                <Button size="sm" variant="outline" className="h-7 text-xs gap-1">
                  <History className="size-3.5 text-primary" />
                  Lihat Semua Mutasi →
                </Button>
              </Link>
            }
            bodyClassName="p-0"
          >
            <div className="overflow-x-auto">
              <table className="w-full text-xs text-left border-collapse border border-border">
                <thead>
                  <tr className="border-b border-blue-700 bg-blue-600 dark:bg-blue-700 text-white uppercase text-[11px] tracking-wider font-bold divide-x divide-blue-500/40 text-center">
                    <th className="px-4 py-3 w-36 font-bold text-center">Tanggal</th>
                    <th className="px-3 py-3 w-32 whitespace-nowrap font-bold text-center">
                      <div className="font-bold">Tipe Mutasi</div>
                      <div className="text-[10px] text-blue-100 font-semibold normal-case">(In/Out)</div>
                    </th>
                    <th className="px-3 py-3 w-32 font-bold text-center">KODE</th>
                    <th className="px-4 py-3 min-w-[220px] font-bold text-center">MATERIAL</th>
                    <th className="px-4 py-3 w-40 font-bold text-center">Vendor / Tujuan</th>
                    <th className="px-4 py-3 w-36 font-bold text-center">No. Ref</th>
                    <th className="px-4 py-3 w-36 font-bold text-center">User</th>
                    <th className="px-4 py-3 text-center w-36 font-bold">Aksi & Dokumen</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {warehouseTx.isLoading && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                        Memuat data mutasi gudang...
                      </td>
                    </tr>
                  )}
                  {groupedTxData.slice(0, 8).map((tx) => {
                    const isMasuk = tx.tx_type === "IN";
                    const isToday =
                      new Date(tx.created_at).toDateString() === new Date().toDateString();

                    return (
                      <tr
                        key={tx.transaction_number}
                        className="hover:bg-surface-muted/40 transition-colors align-top divide-x divide-border"
                      >
                        {/* 1. Tanggal */}
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1.5 font-medium text-foreground text-xs whitespace-nowrap">
                            <span>{formatDate(tx.created_at)}</span>
                            {isToday && (
                              <span className="size-1.5 rounded-full bg-blue-500 inline-block shrink-0" title="Hari ini" />
                            )}
                          </div>
                        </td>

                        {/* 2. Tipe Mutasi (In/Out) */}
                        <td className="px-3 py-3 text-center">
                          <span
                            className={cn(
                              "inline-flex items-center justify-center gap-1 w-16 h-6 rounded text-[11px] font-semibold uppercase tracking-wide",
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
                            {isMasuk ? "In" : "Out"}
                          </span>
                        </td>

                        {/* 3. Kode Material */}
                        <td className="px-3 py-3">
                          <div className="space-y-1">
                            {tx.items.map((it, idx) => {
                              const code = productCodeMap.get(it.product_id) || (it.product_name ? productCodeMap.get(it.product_name.trim().toLowerCase()) : undefined);
                              return (
                                <div key={it.id || idx} className="h-7 flex items-center justify-center">
                                  {code ? (
                                    <span className="font-mono text-[11px] font-semibold bg-surface-muted px-1.5 py-0.5 rounded border border-border/60 text-foreground">
                                      {code}
                                    </span>
                                  ) : (
                                    <span className="font-mono text-muted-foreground text-xs">—</span>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        </td>

                        {/* 4. Nama Barang */}
                        <td className="px-4 py-3">
                          <div className="space-y-1">
                            {tx.items.map((it, idx) => (
                              <div
                                key={it.id || idx}
                                className="h-7 flex items-center justify-between gap-2 text-xs font-medium text-foreground leading-snug"
                              >
                                <div className="flex items-center gap-1 truncate max-w-[220px]">
                                  {tx.items.length > 1 && (
                                    <span className="text-muted-foreground mr-1 text-[11px] shrink-0">{idx + 1}.</span>
                                  )}
                                  <span className="truncate" title={it.product_name}>
                                    {it.product_name}
                                  </span>
                                </div>
                                <span
                                  className={cn(
                                    "font-mono font-bold text-[11px] px-1.5 py-0.5 rounded shrink-0",
                                    isMasuk
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  )}
                                >
                                  {isMasuk ? "+" : "-"}{it.quantity} {it.unit || "pcs"}
                                </span>
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* 5. Vendor / Tujuan */}
                        <td className="px-4 py-3 text-xs">
                          <span className="text-[10px] uppercase font-semibold text-muted-foreground block">
                            {isMasuk ? "Vendor Pengirim" : "Tujuan Line"}
                          </span>
                          <span className="font-medium text-foreground mt-0.5 block">
                            {tx.supplier_or_dest || "—"}
                          </span>
                        </td>

                        {/* 6. No. Ref */}
                        <td className="px-4 py-3 text-xs">
                          {tx.reference_no ? (
                            <span className="font-mono text-xs text-foreground bg-surface-muted px-1.5 py-0.5 rounded border border-border/40 inline-block">
                              {tx.reference_no}
                            </span>
                          ) : tx.batch_number ? (
                            <span className="font-mono text-xs text-muted-foreground block">
                              {tx.batch_number}
                            </span>
                          ) : (
                            <span className="text-muted-foreground/60">—</span>
                          )}
                        </td>

                        {/* 7. User */}
                        <td className="px-4 py-3 text-xs">
                          <span className="font-medium text-foreground block">
                            {tx.created_by_name || "User"}
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

                        {/* 8. Aksi & Dokumen */}
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
                  {!warehouseTx.isLoading && groupedTxData.length === 0 && (
                    <tr>
                      <td colSpan={8} className="px-5 py-8 text-center text-muted-foreground">
                        Belum ada riwayat transaksi mutasi barang.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </Panel>
        </div>
      )}

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
                    className={
                      selectedTx.tx_type === "IN"
                        ? "text-[10px] font-mono bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20 uppercase"
                        : "text-[10px] font-mono bg-rose-500/15 text-rose-600 dark:text-rose-400 border border-rose-500/20 uppercase"
                    }
                  >
                    {selectedTx.tx_type === "IN" ? "Barang Masuk (IN)" : "Barang Keluar (OUT)"}
                  </Badge>
                )}
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs">
              Rincian informasi mutasi stok barang
            </DialogDescription>
          </DialogHeader>

          {selectedTx && (
            <div className="space-y-4 py-2 text-sm">
              <div className="rounded-lg border border-border bg-surface-muted/30 p-3 space-y-2.5">
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div>
                    <span className="text-muted-foreground">
                      {selectedTx.tx_type === "IN" ? "Tanggal Terima:" : "Tanggal Keluar:"}
                    </span>{" "}
                    <span className="font-mono font-medium text-foreground">
                      {selectedTx.batch_number ? formatDate(selectedTx.batch_number) : formatDate(selectedTx.created_at)}
                    </span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">No. Referensi:</span>{" "}
                    <span className="font-mono font-medium text-foreground">{selectedTx.reference_no || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">
                      {selectedTx.tx_type === "IN" ? "Nama Vendor:" : "Tujuan / Pemohon:"}
                    </span>{" "}
                    <span className="font-medium text-foreground">{selectedTx.supplier_or_dest || "—"}</span>
                  </div>
                  <div>
                    <span className="text-muted-foreground">Petugas:</span>{" "}
                    <span className="font-medium text-foreground">{selectedTx.created_by_name || "Petugas"}</span>
                  </div>
                </div>

                <div className="pt-2 border-t border-border/60 text-xs">
                  <span className="text-muted-foreground">Waktu Pencatatan:</span>{" "}
                  <span className="font-medium text-foreground">{formatDate(selectedTx.created_at)}</span>
                </div>

                <div className="pt-2 border-t border-border/60 space-y-2">
                  <div className="text-xs font-semibold text-foreground">
                    Rincian Barang Mutasi ({selectedTx.items?.length || 1} Item):
                  </div>

                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {(selectedTx.items && selectedTx.items.length > 0
                      ? selectedTx.items
                      : [
                        {
                          product_name: selectedTx.product_name || "Produk",
                          quantity: selectedTx.quantity || 0,
                          unit: selectedTx.unit || "kg",
                        },
                      ]
                    ).map((it: any, idx: number) => (
                      <div
                        key={idx}
                        className="flex justify-between items-center bg-surface p-2 rounded border border-border text-xs"
                      >
                        <span className="font-medium text-foreground">
                          {idx + 1}. {it.product_name}
                        </span>
                        <span
                          className={cn(
                            "font-mono font-bold shrink-0",
                            selectedTx.tx_type === "IN" ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400",
                          )}
                        >
                          {selectedTx.tx_type === "IN" ? "+" : "-"}
                          {it.quantity} {it.unit}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                {selectedTx.notes && (
                  <div className="pt-2 border-t border-border/60 text-xs">
                    <span className="text-muted-foreground block mb-0.5">Petugas Sparepart Shift 1/2/3:</span>
                    <p className="bg-surface p-2 rounded border border-border text-foreground">
                      {selectedTx.notes}
                    </p>
                  </div>
                )}
              </div>

            </div>
          )}

          <DialogFooter className="flex flex-col-reverse sm:flex-row justify-between sm:justify-between items-center gap-2">
            <Link to="/products" search={{ tab: "transactions" }}>
              <Button variant="ghost" size="sm" className="text-xs text-primary gap-1">
                Buka Manajemen Gudang →
              </Button>
            </Link>
            <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
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
            </div>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Interaktif Daftar Barang saat Kartu Metrik di-klik */}
      {renderMetricItemsModal()}
    </AppShell>
  );
}
