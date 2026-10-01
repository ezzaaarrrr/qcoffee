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
  const [stockStatusTab, setStockStatusTab] = useState<"all" | "critical" | "limit" | "habis" | "aman">("all");

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

  // Diagram SVG Donat Status Stok
  const renderStockDonut = () => {
    if (totalActiveProducts === 0) {
      return (
        <div className="flex items-center justify-center size-24 rounded-full border-4 border-dashed border-border text-[11px] text-muted-foreground font-mono">
          0 item
        </div>
      );
    }

    const radius = 40;
    const strokeWidth = 11;
    const circumference = 2 * Math.PI * radius;

    const safeDash = (safePct / 100) * circumference;
    const limitDash = (limitOnlyPct / 100) * circumference;
    const zeroDash = (zeroPct / 100) * circumference;

    const safeOffset = 0;
    const limitOffset = -safeDash;
    const zeroOffset = -(safeDash + limitDash);

    return (
      <div className="relative flex items-center justify-center size-24 shrink-0">
        <svg className="size-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r={radius}
            fill="transparent"
            stroke="currentColor"
            strokeWidth={strokeWidth}
            className="text-surface-muted opacity-30"
          />
          {/* Sektor Aman / Normal (Emerald) */}
          {safePct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#4dff00ff"
              strokeWidth={strokeWidth}
              strokeDasharray={`${safeDash} ${circumference}`}
              strokeDashoffset={safeOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
          {/* Sektor Limit / Kritis (Orange) */}
          {limitOnlyPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#fffb25ff"
              strokeWidth={strokeWidth}
              strokeDasharray={`${limitDash} ${circumference}`}
              strokeDashoffset={limitOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
          {/* Sektor Stok Habis / Critical (Merah Menyala) */}
          {zeroPct > 0 && (
            <circle
              cx="50"
              cy="50"
              r={radius}
              fill="transparent"
              stroke="#ff0505ff"
              strokeWidth={strokeWidth}
              strokeDasharray={`${zeroDash} ${circumference}`}
              strokeDashoffset={zeroOffset}
              strokeLinecap="round"
              className="transition-all duration-700"
            />
          )}
        </svg>
        <div className="absolute flex flex-col items-center justify-center text-center">
          <span
            className={cn(
              "font-mono text-base font-bold leading-tight",
              isKpiHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-500"
            )}
          >
            {kpiExactPct.toFixed(2)}%
          </span>
          <span
            className={cn(
              "text-[9.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider mt-1 border shadow-xs",
              isKpiHit
                ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                : "bg-red-500/15 text-red-600 dark:text-red-500 border-red-500/40"
            )}
          >
            {kpiStatus}
          </span>
        </div>
      </div>
    );
  };

  // Render Card Diagram & Analisis Status Barang OBS yang Rapi & Terbaca Jelas
  const renderStockAnalysisCard = () => {
    const getDisplayedList = () => {
      switch (stockStatusTab) {
        case "critical":
          return {
            items: limitProductsList,
            label: "Barang Critical (Habis & Limit)",
            colorClass: "text-red-600 dark:text-red-500",
            badgeClass: "bg-red-500/15 text-red-600 dark:text-red-500 border-red-500/30",
            emptyText: "✓ Tidak ada barang critical (stok habis atau limit).",
          };
        case "habis":
          return {
            items: zeroProductsList,
            label: "Barang Critical / Habis",
            colorClass: "text-red-600 dark:text-red-500",
            badgeClass: "bg-red-500/15 text-red-600 dark:text-red-500 border-red-500/30",
            emptyText: "✓ Tidak ada barang stok kosong / critical (0 pcs).",
          };
        case "limit":
          return {
            items: limitOnlyProductsList,
            label: "Barang Stok Limit",
            colorClass: "text-orange-600 dark:text-orange-400",
            badgeClass: "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30",
            emptyText: "✓ Tidak ada barang stok limit.",
          };
        case "aman":
          return {
            items: safeProductsList,
            label: "Barang Stok Aman / Normal",
            colorClass: "text-emerald-600 dark:text-emerald-400",
            badgeClass: "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30",
            emptyText: "Tidak ada data barang aman.",
          };
        case "all":
        default:
          return {
            items: activeProducts,
            label: "Semua Barang OBS Sparepart",
            colorClass: "text-blue-600 dark:text-blue-400",
            badgeClass: "bg-blue-500/15 text-blue-600 dark:text-blue-400 border-blue-500/30",
            emptyText: "Tidak ada data barang aktif.",
          };
      }
    };

    const currentTabInfo = getDisplayedList();

    return (
      <div
        id="diagram-analisis-status-sparepart"
        className="rise-in border border-border bg-surface p-5 flex flex-col justify-between h-full shadow-xs space-y-4 scroll-mt-20"
      >
        <div>
          {/* Header & Donut */}
          <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-border pb-3.5 gap-4">
            <div className="flex items-center gap-4">
              {/* Diagram Donat Persentase Status All Barang */}
              {renderStockDonut()}
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="text-sm font-semibold tracking-tight flex items-center gap-2">
                    <span className="label-caps !p-0">Diagram & Analisis Status Barang & Sparepart</span>
                  </h3>
                  <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-surface-muted border border-border text-muted-foreground">
                    {totalActiveProducts} Total Item
                  </span>
                </div>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Tingkat ketersediaan & proporsi status stok sparepart aktif di lini gudang
                </p>
                {/* Legend Persentase 3 Status */}
                <div className="flex flex-wrap items-center gap-2 mt-2">
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20">
                    <span className="size-2 rounded-full bg-emerald-500" />
                    Aman: {nonLimitProductsCount} ({safePct}%)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
                    <span className="size-2 rounded-full bg-orange-500" />
                    Limit: {limitOnlyCount} ({limitOnlyPct}%)
                  </span>
                  <span className="inline-flex items-center gap-1.5 text-[11px] font-medium px-2 py-0.5 rounded-full bg-red-500/10 text-red-600 dark:text-red-500 border border-red-500/20">
                    <span className="size-2 rounded-full bg-red-600" />
                    Critical / Habis (0): {zeroProductsCount} ({zeroPct}%)
                  </span>
                </div>
              </div>
            </div>
          </div>

          {/* Bar Visual Progress Segmented */}
          <div className="mt-3.5 space-y-1.5">
            <div className="w-full bg-surface-muted rounded-full h-2.5 overflow-hidden flex shadow-inner">
              <div
                style={{ width: `${safePct}%` }}
                className="bg-emerald-500 h-full transition-all"
                title={`Aman: ${nonLimitProductsCount} (${safePct}%)`}
              />
              <div
                style={{ width: `${limitOnlyPct}%` }}
                className="bg-orange-500 h-full transition-all"
                title={`Limit: ${limitOnlyCount} (${limitOnlyPct}%)`}
              />
              <div
                style={{ width: `${zeroPct}%` }}
                className="bg-red-600 h-full transition-all"
                title={`Critical / Habis: ${zeroProductsCount} (${zeroPct}%)`}
              />
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground pt-0.5">
              <span>0%</span>
              <span className="font-medium flex items-center gap-1">
                Target KPI Sparepart: <strong className="font-mono text-foreground font-semibold">&ge; 92.00% (HIT)</strong> &bull; Aktual:{" "}
                <span className={cn("font-mono font-bold", isKpiHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-500")}>
                  {kpiExactPct.toFixed(2)}% ({kpiStatus})
                </span>
              </span>
              <span>100%</span>
            </div>
          </div>
        </div>

        {/* Tab Filter Button & Daftar Barang Rapi & Terbaca Jelas */}
        <div className="pt-2 border-t border-border space-y-2.5 flex-1 flex flex-col justify-between">
          {/* Tab Button Group: Semua, Critical, Aman */}
          <div className="flex items-center gap-1.5 bg-surface-muted/60 p-1 rounded-lg border border-border">
            {/* 1. Tab Semua */}
            <button
              type="button"
              onClick={() => setStockStatusTab("all")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                stockStatusTab === "all"
                  ? "bg-primary text-primary-foreground shadow-xs"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              )}
            >
              <Package className="size-3.5 shrink-0" />
              <span>Semua</span>
              <span
                className={cn(
                  "font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  stockStatusTab === "all"
                    ? "bg-primary-foreground/20 text-primary-foreground"
                    : "bg-surface border border-border text-foreground"
                )}
              >
                {totalActiveProducts}
              </span>
            </button>

            {/* 2. Tab Critical (Gabungan Kosong & Limit) */}
            <button
              type="button"
              onClick={() => setStockStatusTab("critical")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                stockStatusTab === "critical" || stockStatusTab === "habis" || stockStatusTab === "limit"
                  ? "bg-red-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              )}
              title="Barang Critical: Gabungan Stok Kosong (0 pcs) & Stok Limit"
            >
              <AlertTriangle className="size-3.5 shrink-0" />
              <span>Critical</span>
              <span
                className={cn(
                  "font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  stockStatusTab === "critical" || stockStatusTab === "habis" || stockStatusTab === "limit"
                    ? "bg-red-800/80 text-white"
                    : "bg-surface border border-border text-red-600 dark:text-red-500"
                )}
              >
                {limitProductsCount}
              </span>
            </button>

            {/* 3. Tab Aman */}
            <button
              type="button"
              onClick={() => setStockStatusTab("aman")}
              className={cn(
                "flex-1 flex items-center justify-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer",
                stockStatusTab === "aman"
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:bg-surface hover:text-foreground"
              )}
            >
              <CheckCircle2 className="size-3.5 shrink-0" />
              <span>Aman</span>
              <span
                className={cn(
                  "font-mono text-[10px] px-1.5 py-0.2 rounded-full font-bold",
                  stockStatusTab === "aman"
                    ? "bg-emerald-800/80 text-white"
                    : "bg-surface border border-border text-emerald-600 dark:text-emerald-400"
                )}
              >
                {nonLimitProductsCount}
              </span>
            </button>
          </div>

          {/* List Barang yang Luas, Rapi, & Terbaca Jelas */}
          <div className="h-44 overflow-y-auto space-y-1.5 pr-1">
            {currentTabInfo.items.length > 0 ? (
              currentTabInfo.items.map((p) => {
                const isZero = (p.current_stock ?? 0) <= 0;
                const isLow = !isZero && (p.current_stock ?? 0) <= (p.min_stock ?? 10);
                return (
                  <div
                    key={p.id}
                    className="flex items-center justify-between gap-3 p-2 rounded border bg-surface hover:bg-surface-muted/50 border-border/80 transition-colors"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="font-semibold text-xs text-foreground truncate" title={p.name}>
                        {p.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5 text-[10px] text-muted-foreground">
                        <span className="font-mono bg-surface-muted px-1.5 py-0.2 rounded border border-border/60">
                          {p.code || "No SKU"}
                        </span>
                        {(p as any).location && (
                          <span className="text-[10px]">Lokasi: {(p as any).location}</span>
                        )}
                      </div>
                    </div>
                    <div className="text-right shrink-0 flex items-center gap-2">
                      <span
                        className={cn(
                          "font-mono text-xs font-bold px-2 py-0.5 rounded border",
                          isZero
                            ? "bg-red-500/15 text-red-600 dark:text-red-500 border-red-500/30"
                            : isLow
                              ? "bg-orange-500/15 text-orange-600 dark:text-orange-400 border-orange-500/30"
                              : "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                        )}
                      >
                        {p.current_stock ?? 0} {p.unit || "pcs"}
                      </span>
                      <span className="text-[10px] text-muted-foreground font-medium whitespace-nowrap">
                        Min: {p.min_stock ?? 10}
                      </span>
                    </div>
                  </div>
                );
              })
            ) : (
              <div className="text-xs text-emerald-600 dark:text-emerald-400 bg-emerald-500/5 border border-emerald-500/15 p-4 rounded text-center my-auto flex items-center justify-center gap-1.5">
                {currentTabInfo.emptyText}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

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

       ];

  // Pie chart data: status gabungan
  const statusData = [
    { name: "Aman", value: gabunganAman, color: "#10b981", pct: pctAman },
    { name: "Limit / Kritis", value: gabunganLimit, color: "#f59e0b", pct: pctLimit },
    { name: "Habis (0)", value: gabunganHabis, color: "#ef4444", pct: pctHabis },
  ].filter((d) => d.value > 0);


  return {
    totalOBS, totalBuffer, totalGabungan,
    gabunganAman, gabunganLimit, gabunganHabis,
    totalStokOBS, totalStokBuffer, totalStokGabungan,
    pctAman, pctLimit, pctHabis, pctKetersediaan,
    sourceData, statusData, obsStatusData, comparisonData,
    bufferZero, bufferLimit, bufferSafe,
  };
}, [activeProducts, activeBufferItems, totalActiveProducts, nonLimitProductsCount, limitOnlyCount, zeroProductsCount, safePct, limitOnlyPct, zeroPct]);

// Render Panel Analisis Keseluruhan OBS + Buffer Stock
const renderCombinedAnalysisPanel = () => {
  const ca = combinedAnalysis;
  if (ca.totalGabungan === 0) return null;

  const RADIAN = Math.PI / 180;
  const renderCustomLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent }: any) => {
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    if (percent < 0.05) return null;
    return (
      <text x={x} y={y} fill="white" textAnchor="middle" dominantBaseline="central" fontSize={11} fontWeight={700}>
        {`${(percent * 100).toFixed(0)}%`}
      </text>
    );
  };

  return (
    <div className="border border-border bg-surface p-5 rounded-none shadow-xs space-y-5">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-border pb-3">
        <div>
          <div className="flex items-center gap-2">
            <Layers className="size-4 text-primary shrink-0" />
            <h3 className="text-sm font-bold tracking-tight text-foreground uppercase">
              Analisis Keseluruhan Barang OBS & Buffer Stok
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">
            Ringkasan & diagram analisis gabungan dari seluruh barang OBS Sparepart + Buffer Stok.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600 dark:text-blue-400 border border-blue-500/20">
            OBS: {ca.totalOBS}
          </span>
          <span className="text-[10px] font-semibold px-2 py-0.5 rounded bg-orange-500/10 text-orange-600 dark:text-orange-400 border border-orange-500/20">
            Buffer: {ca.totalBuffer}
          </span>
          <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-surface-muted border border-border text-foreground">
            Total: {ca.totalGabungan}
          </span>
        </div>
      </div>

      {/* Panel A — 4 Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-gradient-to-br from-blue-500/10 to-blue-500/5 border border-blue-500/20 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-blue-600 dark:text-blue-400">
            <BoxIcon className="size-3.5" />
            Total Item Gabungan
          </div>
          <div className="text-2xl font-mono font-extrabold text-foreground">{ca.totalGabungan}</div>
          <div className="text-[10px] text-muted-foreground">
            OBS: {ca.totalOBS} · Buffer: {ca.totalBuffer}
          </div>
        </div>
        <div className="bg-gradient-to-br from-cyan-500/10 to-cyan-500/5 border border-cyan-500/20 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-cyan-600 dark:text-cyan-400">
            <Activity className="size-3.5" />
            Total Stok Fisik
          </div>
          <div className="text-2xl font-mono font-extrabold text-foreground">{ca.totalStokGabungan.toLocaleString("id-ID")}</div>
          <div className="text-[10px] text-muted-foreground">
            OBS: {ca.totalStokOBS.toLocaleString("id-ID")} · Buffer: {ca.totalStokBuffer.toLocaleString("id-ID")}
          </div>
        </div>
        <div className="bg-gradient-to-br from-emerald-500/10 to-emerald-500/5 border border-emerald-500/20 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-3.5" />
            Rasio Stok Aman
          </div>
          <div className="text-2xl font-mono font-extrabold text-emerald-600 dark:text-emerald-400">{ca.pctAman}%</div>
          <div className="text-[10px] text-muted-foreground">
            {ca.gabunganAman} dari {ca.totalGabungan} item stok normal/lebih
          </div>
        </div>
        <div className="bg-gradient-to-br from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-lg p-3.5 space-y-1">
          <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wider text-amber-600 dark:text-amber-400">
            <AlertTriangle className="size-3.5" />
            Perlu Perhatian (Limit & Habis)
          </div>
          <div className="text-2xl font-mono font-extrabold text-amber-600 dark:text-amber-400">{ca.pctLimit + ca.pctHabis}%</div>
          <div className="text-[10px] text-muted-foreground">
            {ca.gabunganLimit + ca.gabunganHabis} item ({ca.gabunganLimit} limit + {ca.gabunganHabis} habis)
          </div>
        </div>
      </div>

      {/* Panel B + C — Pie Charts */}
      <div className="grid md:grid-cols-2 gap-4">
        {/* Pie Chart: Distribusi Sumber */}
        <div className="bg-surface-muted/30 border border-border rounded-lg p-4">
          <div className="flex items-center gap-2 mb-3">
            <Package className="size-3.5 text-blue-500" />
            <h4 className="text-xs font-bold uppercase text-foreground">Distribusi Sumber Barang</h4>
          </div>
          <div className="h-52">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={ca.sourceData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={75}
                  paddingAngle={3}
                  dataKey="value"
                  labelLine={false}
                  label={renderCustomLabel}
                >
                  {ca.sourceData.map((entry, index) => (
                    <Cell key={`source-${index}`} fill={entry.color} stroke="none" />
                  ))}
                </Pie>
                <RechartsTooltip
                  content={({ active, payload }) => {
                    if (active && payload && payload.length && payload[0]?.payload) {
                      const d = payload[0].payload;
                      const pct = ca.totalGabungan > 0 ? Math.round((d.value / ca.totalGabungan) * 100) : 0;
                      return (
                        <div className="rounded border border-border bg-surface p-2 shadow-md text-xs space-y-0.5">
                          <p className="font-bold" style={{ color: d.color }}>{d.name}</p>
                          <p className="text-foreground font-mono">{d.value} item ({pct}%)</p>
                        </div>
                      );
                    }
                    return null;
                  }}
                />
                <Legend
                  verticalAlign="bottom"
                  height={30}
                  formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Pie Chart: Status Stok OBS Sparepart */}
        <div className="bg-surface-muted/30 border border-border rounded-lg p-4 flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between gap-2 mb-3">
              <div className="flex items-center gap-2">
                <BarChart3 className="size-3.5 text-emerald-500" />
                <h4 className="text-xs font-bold uppercase text-foreground">Status Stok OBS Sparepart</h4>
              </div>
              <div className="flex items-center gap-1.5">
                <span
                  className={cn(
                    "text-[10px] font-bold px-1.5 py-0.5 rounded border inline-flex items-center gap-1",
                    isKpiHit
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/15 text-red-600 dark:text-red-500 border-red-500/40"
                  )}
                  title="Target KPI Sparepart: ≥ 92.00% (HIT) | ≤ 91.99% (MISS)"
                >
                  KPI: {kpiStatus} ({kpiExactPct.toFixed(2)}%)
                </span>
                <button
                  type="button"
                  onClick={() => {
                    document.getElementById("diagram-analisis-status-sparepart")?.scrollIntoView({ behavior: "smooth", block: "start" });
                  }}
                  className="text-[11px] font-medium text-primary hover:underline inline-flex items-center gap-0.5 cursor-pointer ml-1"
                  title="Buka Diagram & Analisis Status Barang & Sparepart"
                >
                  Lihat Detail <ExternalLink className="size-3" />
                </button>
              </div>
            </div>

            <div className="h-52 relative flex items-center justify-center">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={ca.obsStatusData}
                    cx="50%"
                    cy="50%"
                    innerRadius={48}
                    outerRadius={75}
                    paddingAngle={3}
                    dataKey="value"
                    labelLine={false}
                    label={renderCustomLabel}
                    className="cursor-pointer"
                    onClick={(entry: any) => {
                      if (entry?.statusKey) {
                        setStockStatusTab(entry.statusKey);
                      }
                      document.getElementById("diagram-analisis-status-sparepart")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                  >
                    {ca.obsStatusData.map((entry, index) => (
                      <Cell
                        key={`status-${index}`}
                        fill={entry.color}
                        stroke="none"
                        className="cursor-pointer hover:opacity-85 transition-opacity"
                      />
                    ))}
                  </Pie>
                  <RechartsTooltip
                    content={({ active, payload }) => {
                      if (active && payload && payload.length && payload[0]?.payload) {
                        const d = payload[0].payload;
                        return (
                          <div className="rounded border border-border bg-surface p-2 shadow-md text-xs space-y-0.5">
                            <p className="font-bold" style={{ color: d.color }}>{d.name}</p>
                            <p className="text-foreground font-mono">{d.value} item ({d.pct}% dari {totalActiveProducts} item OBS)</p>
                            <p className="text-[10px] text-muted-foreground pt-0.5">Klik untuk lihat rincian barang ↑</p>
                          </div>
                        );
                      }
                      return null;
                    }}
                  />
                  <Legend
                    verticalAlign="bottom"
                    height={36}
                    onClick={(e: any) => {
                      const item = ca.obsStatusData.find((s) => s.name === e.value);
                      if (item?.statusKey) {
                        setStockStatusTab(item.statusKey);
                      }
                      document.getElementById("diagram-analisis-status-sparepart")?.scrollIntoView({ behavior: "smooth", block: "start" });
                    }}
                    formatter={(value: string) => {
                      const item = ca.obsStatusData.find((s) => s.name === value);
                      return (
                        <span
                          className="text-xs text-foreground font-medium cursor-pointer hover:underline"
                          title="Klik untuk melihat & memfilter barang"
                        >
                          {value} {item ? `(${item.value} item · ${item.pct}%)` : ""}
                        </span>
                      );
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
              {/* Center Donut KPI & Persentase (Sinkron & Ngelink dengan Diagram Analisis Status Barang & Sparepart) */}
              <div
                onClick={() => {
                  document.getElementById("diagram-analisis-status-sparepart")?.scrollIntoView({ behavior: "smooth", block: "start" });
                }}
                className="absolute top-[38%] left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center justify-center text-center cursor-pointer group"
                title="Klik untuk membuka Diagram & Analisis Status Barang & Sparepart"
              >
                <span
                  className={cn(
                    "font-mono text-base font-bold leading-tight group-hover:scale-105 transition-transform",
                    isKpiHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-500"
                  )}
                >
                  {kpiExactPct.toFixed(2)}%
                </span>
                <span
                  className={cn(
                    "text-[8.5px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-wider mt-0.5 border shadow-xs",
                    isKpiHit
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border-emerald-500/30"
                      : "bg-red-500/15 text-red-600 dark:text-red-500 border-red-500/40"
                  )}
                >
                  {kpiStatus}
                </span>
                <span className="text-[7.5px] font-semibold text-muted-foreground uppercase tracking-wider mt-0.5 group-hover:text-foreground">
                  Target ≥ 92%
                </span>
              </div>
            </div>
          </div>

          {/* Target KPI Sparepart Bar Ringkas */}
          <div className="mt-3 pt-2.5 border-t border-border flex items-center justify-between text-[11px]">
            <span className="text-muted-foreground">
              Target KPI: <span className="font-semibold text-foreground">≥ 92.00% (HIT)</span>
            </span>
            <span
              className={cn(
                "font-bold font-mono",
                isKpiHit ? "text-emerald-600 dark:text-emerald-400" : "text-red-600 dark:text-red-500"
              )}
            >
              Aktual: {kpiExactPct.toFixed(2)}% ({kpiStatus})
            </span>
          </div>
        </div>
      </div>

      {/* Panel D — Horizontal Bar Chart Perbandingan OBS vs Buffer per Status */}
      <div className="bg-surface-muted/30 border border-border rounded-lg p-4">
        <div className="flex items-center gap-2 mb-3">
          <BarChart3 className="size-3.5 text-violet-500" />
          <h4 className="text-xs font-bold uppercase text-foreground">Perbandingan OBS vs Buffer per Status</h4>
        </div>
        <div className="h-48">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart
              data={ca.comparisonData}
              layout="vertical"
              margin={{ top: 5, right: 20, left: 10, bottom: 5 }}
            >
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#e2e8f0" opacity={0.6} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#64748b" }} stroke="#cbd5e1" allowDecimals={false} />
              <YAxis
                dataKey="name"
                type="category"
                tick={{ fontSize: 11, fill: "#64748b", fontWeight: 600 }}
                stroke="#cbd5e1"
                width={50}
              />
              <RechartsTooltip
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="rounded border border-border bg-surface p-2.5 shadow-md text-xs space-y-1">
                        <p className="font-bold text-foreground">{label}</p>
                        {payload.map((p: any) => (
                          <div key={p.dataKey} className="flex items-center gap-2">
                            <span
                              className="size-2 rounded-full shrink-0"
                              style={{ backgroundColor: p.fill || p.color }}
                            />
                            <span className="text-muted-foreground">{p.name}:</span>
                            <span className="font-mono font-bold text-foreground">{p.value} item</span>
                          </div>
                        ))}
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Bar dataKey="obs" name="OBS Sparepart" fill="#2563eb" radius={[0, 4, 4, 0]} maxBarSize={24} />
              <Bar dataKey="buffer" name="Buffer Stok" fill="#f97316" radius={[0, 4, 4, 0]} maxBarSize={24} />
              <Legend
                verticalAlign="top"
                height={30}
                formatter={(value: string) => <span className="text-xs text-foreground">{value}</span>}
              />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>


    </div>
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
  <AppShell breadcrumb="DASHBOARD OVERVIEW" contentClassName="bg-[#1268D9]">
    {/* Header Dashboard */}
    <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
      <div>
        <div className="flex items-center gap-2">
          <h1 className="text-2xl font-bold tracking-tight text-white drop-shadow-sm">DASHBOARD OVERVIEW</h1>
        </div>
        <p className="mt-1 text-sm text-blue-100 font-medium">
          {userRole === "admin" && "Ringkasan statistik penuh seluruh departemen, manajemen master data, dan kontrol sistem."}
          {userRole === "qc_field" && "Ringkasan Aktivitas Manajemen"}
          {userRole === "admin_process" && "Overview tugas pemeriksaan checklist harian operasional lini produksi."}
          {userRole === "prod_process_uh" && "Overview inventaris dan mutasi stok barang/sparepart."}
        </p>
      </div>

      {/* Action Button: Master OBS Sparepart */}
      <div className="flex items-center gap-2 sm:shrink-0">
        <Link to="/products">
          <Button
            size="sm"
            variant="outline"
            className="h-9 gap-2 bg-white/95 hover:bg-white text-slate-800 border-white/40 font-semibold shadow-sm transition-all"
          >
            <Package className="size-4 text-[#1268D9] shrink-0" />
            <span className="whitespace-nowrap">Master OBS Sparepart</span>
            <span className="font-mono text-xs font-bold text-slate-800 bg-slate-100 px-1.5 py-0.5 rounded border border-slate-200 shrink-0">
              {products.data?.length || 0}
            </span>
          </Button>
        </Link>
      </div>
    </div>

    {(userRole === "admin" || isAdmin) && (
      <div className="space-y-6">
        {/* Section: Status Stok Barang & TOP 10 Outgoing Berdampingan */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Diagram & Analisis Status Barang & Sparepart */}
          {renderStockAnalysisCard()}

          {/* Card 2: TOP 10 OUTGOING SPAREPART */}
          {renderInventoryChartPanel()}
        </div>

        {/* Diagram Analisis Keseluruhan OBS + Buffer Stock */}
        {renderCombinedAnalysisPanel()}

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
        {/* Section: Status Stok Barang & TOP 10 Outgoing Berdampingan */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Diagram & Analisis Status Barang & Sparepart */}
          {renderStockAnalysisCard()}

          {/* Card 2: TOP 10 OUTGOING SPAREPART */}
          {renderInventoryChartPanel()}
        </div>

        {/* Diagram Analisis Keseluruhan OBS + Buffer Stock */}
        {renderCombinedAnalysisPanel()}

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
        {/* Section: Status Stok Barang & TOP 10 Outgoing Berdampingan */}
        <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 items-stretch">
          {/* Card 1: Diagram & Analisis Status Barang & Sparepart */}
          {renderStockAnalysisCard()}

          {/* Card 2: TOP 10 OUTGOING SPAREPART */}
          {renderInventoryChartPanel()}
        </div>

        {/* Diagram Analisis Keseluruhan OBS + Buffer Stock */}
        {renderCombinedAnalysisPanel()}

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
  </AppShell>
);
}
