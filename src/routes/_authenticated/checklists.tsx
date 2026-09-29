import { useState, useMemo } from "react";
import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  FlaskConical,
  Flame,
  Grid2x2,
  Plus,
  ClipboardCheck,
  CheckCircle2,
  Clock,
  XCircle,
  Download,
  Filter,
  Search,
  FileSpreadsheet,
  ArrowRight,
  Layers,
} from "lucide-react";
import { AppShell } from "@/components/layout/AppShell";
import { Panel, StatCard } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  fetchFormulasi,
  fetchGrinding,
  fetchRoasting,
  type FormulasiRow,
  type GrindingRow,
  type RoastingRow,
} from "@/lib/queries";
import { formatDate, ROLE_LABELS, type AppRole } from "@/lib/domain";
import { useCurrentUser } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/checklists")({
  head: () => ({
    meta: [
      { title: "Dashboard Checklists" },
      {
        name: "description",
        content: "Monitoring dan manajemen checklist digital operasional lini produksi kopi.",
      },
    ],
  }),
  component: DashboardChecklistPage,
});

type UnifiedActivity = {
  id: string;
  kind: "Formulasi" | "Grinding" | "Roasting";
  label: string;
  sub?: string;
  date: string;
  status: string;
  shift?: string;
  operator?: string;
  raw: FormulasiRow | GrindingRow | RoastingRow;
};

function DashboardChecklistPage() {
  const { roles, canCreate } = useCurrentUser();
  const userRole: AppRole = roles.includes("admin")
    ? "admin"
    : roles.includes("qc_field")
      ? "qc_field"
      : roles.includes("admin_process")
        ? "admin_process"
        : roles.includes("prod_process_uh")
          ? "prod_process_uh"
          : "admin_process";

  const formulasi = useQuery({ queryKey: ["formulasi"], queryFn: fetchFormulasi });
  const grinding = useQuery({ queryKey: ["grinding"], queryFn: fetchGrinding });
  const roasting = useQuery({ queryKey: ["roasting"], queryFn: fetchRoasting });

  const loading = formulasi.isLoading || grinding.isLoading || roasting.isLoading;

  const [activeTab, setActiveTab] = useState<"all" | "Formulasi" | "Grinding" | "Roasting">("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [searchTerm, setSearchTerm] = useState<string>("");

  const allActivity: UnifiedActivity[] = useMemo(() => {
    const list: UnifiedActivity[] = [];
    (formulasi.data ?? []).forEach((f) => {
      list.push({
        id: f.id,
        kind: "Formulasi",
        label: f.produk || `Batch #${f.no_urut_batch || "-"}`,
        sub: `Mixer ${f.no_mixer || "-"}`,
        date: formatDate(f.tanggal_mixing),
        status: f.status,
        shift: f.shift_regu || "Shift 1",
        operator: f.operator_premix || "Operator",
        raw: f,
      });
    });
    (grinding.data ?? []).forEach((g) => {
      list.push({
        id: g.id,
        kind: "Grinding",
        label: g.nama_produk || g.no_batch || "Grinding",
        sub: `Grinder ${g.no_grinder || "-"}`,
        date: formatDate(g.hari_tanggal),
        status: g.status,
        shift: g.shift || "Shift 1",
        operator: "Operator Grinding",
        raw: g,
      });
    });
    (roasting.data ?? []).forEach((r) => {
      list.push({
        id: r.id,
        kind: "Roasting",
        label: r.nama_produk || "Roasting",
        sub: `Roaster ${r.no_roaster || "-"}`,
        date: formatDate(r.hari_tanggal),
        status: r.status,
        shift: r.shift_regu || "Shift 1",
        operator: "Operator Roasting",
        raw: r,
      });
    });
    return list.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [formulasi.data, grinding.data, roasting.data]);

  // Statistik Agregat
  const totalCount = allActivity.length;
  const pendingCount = allActivity.filter((a) => a.status.toLowerCase().includes("pending")).length;
  const approvedCount = allActivity.filter((a) => a.status.toLowerCase().includes("approved") || a.status.toLowerCase().includes("disetujui")).length;
  const rejectedCount = allActivity.filter((a) => a.status.toLowerCase().includes("reject") || a.status.toLowerCase().includes("ditolak")).length;

  // Filtered List
  const filteredActivity = useMemo(() => {
    return allActivity.filter((item) => {
      const matchKind = activeTab === "all" || item.kind === activeTab;
      const matchStatus =
        statusFilter === "all" ||
        (statusFilter === "pending" && item.status.toLowerCase().includes("pending")) ||
        (statusFilter === "approved" && (item.status.toLowerCase().includes("approved") || item.status.toLowerCase().includes("disetujui"))) ||
        (statusFilter === "rejected" && (item.status.toLowerCase().includes("reject") || item.status.toLowerCase().includes("ditolak")));

      const matchSearch =
        !searchTerm.trim() ||
        item.label.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.kind.toLowerCase().includes(searchTerm.toLowerCase()) ||
        (item.sub && item.sub.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.shift && item.shift.toLowerCase().includes(searchTerm.toLowerCase())) ||
        (item.operator && item.operator.toLowerCase().includes(searchTerm.toLowerCase()));

      return matchKind && matchStatus && matchSearch;
    });
  }, [allActivity, activeTab, statusFilter, searchTerm]);

  // Download PDF Helper
  function downloadChecklistPDF(a: UnifiedActivity) {
    const isFormulasi = a.kind === "Formulasi";
    const isGrinding = a.kind === "Grinding";
    const isRoasting = a.kind === "Roasting";

    const title = `DOKUMEN CHECKLIST ${a.kind.toUpperCase()}`;
    const printWindow = window.open("", "_blank");
    if (!printWindow) {
      alert("Pop-up diblokir browser. Mohon izinkan pop-up untuk mencetak dokumen PDF.");
      return;
    }

    let detailHtml = "";
    if (isFormulasi) {
      const f = a.raw as FormulasiRow;
      let materials: Array<{ nama: string; qty: number }> = [];
      try {
        if (f.material) materials = JSON.parse(f.material);
      } catch {
        // ignore
      }
      detailHtml = `
        <div style="margin-top: 15px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 30%;">Tanggal Mixing:</td><td>${formatDate(f.tanggal_mixing)}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">No. Mixer:</td><td>${f.no_mixer || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Produk:</td><td>${f.produk || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">No. Urut Batch:</td><td>${f.no_urut_batch || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Shift / Regu:</td><td>${f.shift_regu || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Waktu Mixing:</td><td>${f.start_mixing || "—"} s/d ${f.selesai_mixing || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Total Quantity:</td><td>${f.quantity ? f.quantity + " kg" : "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Operator:</td><td>${f.operator_premix || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Status:</td><td>${f.status}</td></tr>
          </table>
          ${materials.length > 0 ? `
            <h4 style="margin-top: 15px; font-size: 12px; border-bottom: 1px solid #ccc; padding-bottom: 4px;">Rincian Material</h4>
            <table style="width: 100%; border-collapse: collapse; font-size: 11px; margin-top: 6px;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left;">
                  <th style="padding: 6px; border: 1px solid #e2e8f0;">No</th>
                  <th style="padding: 6px; border: 1px solid #e2e8f0;">Nama Material</th>
                  <th style="padding: 6px; border: 1px solid #e2e8f0; text-align: right;">Quantity (kg)</th>
                </tr>
              </thead>
              <tbody>
                ${materials.map((m, i) => `
                  <tr>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${i + 1}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0;">${m.nama}</td>
                    <td style="padding: 6px; border: 1px solid #e2e8f0; text-align: right;">${m.qty} kg</td>
                  </tr>
                `).join("")}
              </tbody>
            </table>
          ` : ""}
        </div>
      `;
    } else if (isGrinding) {
      const g = a.raw as GrindingRow;
      detailHtml = `
        <div style="margin-top: 15px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 30%;">Hari / Tanggal:</td><td>${formatDate(g.hari_tanggal)}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Shift:</td><td>${g.shift}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">No. Grinder:</td><td>${g.no_grinder || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Nama Produk:</td><td>${g.nama_produk || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">No. Batch:</td><td>${g.no_batch || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Raw Material:</td><td>${g.raw_material || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Status:</td><td>${g.status}</td></tr>
          </table>
        </div>
      `;
    } else if (isRoasting) {
      const r = a.raw as RoastingRow;
      detailHtml = `
        <div style="margin-top: 15px;">
          <table style="width: 100%; border-collapse: collapse; font-size: 12px;">
            <tr><td style="padding: 6px; font-weight: bold; width: 30%;">Hari / Tanggal:</td><td>${formatDate(r.hari_tanggal)}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Shift / Regu:</td><td>${r.shift_regu || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">No. Roaster:</td><td>${r.no_roaster || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Nama Produk:</td><td>${r.nama_produk || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Keterangan:</td><td>${r.keterangan_tambahan || "—"}</td></tr>
            <tr><td style="padding: 6px; font-weight: bold;">Status:</td><td>${r.status}</td></tr>
          </table>
        </div>
      `;
    }

    const html = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${title} - ${a.label}</title>
          <style>
            body { font-family: Arial, sans-serif; padding: 25px; color: #1e293b; }
            .header { border-bottom: 2px solid #0f172a; padding-bottom: 10px; margin-bottom: 20px; }
            .title { font-size: 18px; font-weight: bold; text-transform: uppercase; }
            .sub { font-size: 12px; color: #64748b; margin-top: 4px; }
            .footer { margin-top: 40px; font-size: 11px; text-align: right; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 10px; }
          </style>
        </head>
        <body>
          <div class="header">
            <div class="title">${title}</div>
            <div class="sub">Dokumen Resmi Lini Produksi & Audit QC</div>
          </div>
          ${detailHtml}
          <div class="footer">
            Dicetak secara digital pada ${new Date().toLocaleString("id-ID")}
          </div>
          <script>window.print();</script>
        </body>
      </html>
    `;
    printWindow.document.write(html);
    printWindow.document.close();
  }

  return (
    <AppShell breadcrumb="Dashboard Checklist">
      {/* Header Halaman */}
      <div className="mb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="flex items-center gap-2">
            <h1 className="text-2xl font-bold tracking-tight">Dashboard Checklist</h1>
            <Badge variant="outline" className="text-xs font-mono bg-primary/10 text-primary border-primary/20">
              {ROLE_LABELS[userRole]}
            </Badge>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">
            Pusat monitoring, input, dan audit checklist operasional untuk seluruh lini produksi kopi.
          </p>
        </div>
      </div>

      <div className="space-y-6">
        {/* Ringkasan Statistik Kartu */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Form Checklist"
            value={totalCount}
            hint="Akumulasi seluruh lini produksi"
          />
          <StatCard
            label="Menunggu Review QC"
            value={pendingCount}
            accent="warning"
            hint="Menunggu audit & approval"
          />
          <StatCard
            label="Checklist Disetujui"
            value={approvedCount}
            accent="success"
            hint="Telah diverifikasi valid"
          />
          <StatCard
            label="Perlu Revisi / Ditolak"
            value={rejectedCount}
            accent="destructive"
            hint="Checklist tidak lolos QC"
          />
        </div>

        {/* 3 Kartu Lini Operasional & Akses Cepat */}
        <div className="grid gap-4 sm:grid-cols-3">
          {/* Card 1: Formulasi Mixing */}
          <div className="border border-border bg-surface p-4 rounded-sm flex flex-col justify-between hover:border-amber-500/40 transition-all shadow-xs">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center justify-center">
                  <FlaskConical className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Formulasi Mixing</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {formulasi.data?.length || 0} Formulir Tercatat
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
              <Link to="/formulasi" search={{ action: "new" }} className="flex-1">
                <Button size="sm" className="w-full h-8 text-xs bg-amber-600 hover:bg-amber-700 text-white gap-1.5">
                  <Plus className="size-3.5" />
                  <span>Checklist Baru</span>
                </Button>
              </Link>
              <Link to="/formulasi" search={{ action: undefined }}>
                <Button size="sm" variant="outline" className="h-8 text-xs px-2.5">
                  Lihat →
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 2: Proses Grinding */}
          <div className="border border-border bg-surface p-4 rounded-sm flex flex-col justify-between hover:border-blue-500/40 transition-all shadow-xs">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                  <Grid2x2 className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Proses Grinding</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {grinding.data?.length || 0} Formulir Tercatat
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
              <Link to="/grinding" search={{ action: "new" }} className="flex-1">
                <Button size="sm" className="w-full h-8 text-xs bg-blue-600 hover:bg-blue-700 text-white gap-1.5">
                  <Plus className="size-3.5" />
                  <span>Checklist Baru</span>
                </Button>
              </Link>
              <Link to="/grinding" search={{ action: undefined }}>
                <Button size="sm" variant="outline" className="h-8 text-xs px-2.5">
                  Lihat →
                </Button>
              </Link>
            </div>
          </div>

          {/* Card 3: Proses Roasting */}
          <div className="border border-border bg-surface p-4 rounded-sm flex flex-col justify-between hover:border-orange-500/40 transition-all shadow-xs">
            <div className="flex items-start justify-between">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-orange-500/10 text-orange-600 dark:text-orange-400 flex items-center justify-center">
                  <Flame className="size-5" />
                </div>
                <div>
                  <h3 className="text-sm font-semibold text-foreground">Proses Roasting</h3>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {roasting.data?.length || 0} Formulir Tercatat
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-4 pt-3 border-t border-border flex items-center justify-between gap-2">
              <Link to="/roasting" search={{ action: "new" }} className="flex-1">
                <Button size="sm" className="w-full h-8 text-xs bg-orange-600 hover:bg-orange-700 text-white gap-1.5">
                  <Plus className="size-3.5" />
                  <span>Checklist Baru</span>
                </Button>
              </Link>
              <Link to="/roasting" search={{ action: undefined }}>
                <Button size="sm" variant="outline" className="h-8 text-xs px-2.5">
                  Lihat →
                </Button>
              </Link>
            </div>
          </div>
        </div>

        {/* Tabel Monitoring Seluruh Checklist dengan Filter Interaktif */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <ClipboardCheck className="size-4 text-primary" />
              <span>Daftar Aktivitas Checklist Operasional</span>
            </div>
          }
          description="Riwayat formulir checklist dari seluruh lini produksi"
          actions={
            <div className="flex items-center gap-2">
              {/* Filter Tabs Lini */}
              <div className="hidden sm:flex items-center bg-surface-muted p-0.5 rounded border border-border">
                {[
                  { key: "all", label: "Semua Lini" },
                  { key: "Formulasi", label: "Formulasi" },
                  { key: "Grinding", label: "Grinding" },
                  { key: "Roasting", label: "Roasting" },
                ].map((t) => (
                  <button
                    key={t.key}
                    type="button"
                    onClick={() => setActiveTab(t.key as any)}
                    className={`text-xs px-2.5 py-1 rounded transition-colors ${activeTab === t.key
                        ? "bg-background font-semibold text-foreground shadow-xs"
                        : "text-muted-foreground hover:text-foreground"
                      }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
            </div>
          }
          bodyClassName="p-0"
        >
          {/* Filter Bar & Search Box */}
          <div className="p-3 border-b border-border bg-surface-muted/30 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="relative flex-1 max-w-sm">
              <Search className="size-3.5 text-muted-foreground absolute left-3 top-1/2 -translate-y-1/2" />
              <Input
                placeholder="Cari batch, produk, petugas..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-8 text-xs"
              />
            </div>
            <div className="flex items-center gap-2">
              <Select value={statusFilter} onValueChange={setStatusFilter}>
                <SelectTrigger className="h-8 text-xs w-[140px]">
                  <SelectValue placeholder="Status Approval" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Semua Status</SelectItem>
                  <SelectItem value="pending">Menunggu QC</SelectItem>
                  <SelectItem value="approved">Disetujui</SelectItem>
                  <SelectItem value="rejected">Ditolak</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-surface-muted/50">
                  <th className="label-caps px-5 py-2.5 text-left">Lini Produksi</th>
                  <th className="label-caps px-5 py-2.5 text-left">Detail Batch / Produk</th>
                  <th className="label-caps px-5 py-2.5 text-left">Shift & Operator</th>
                  <th className="label-caps px-5 py-2.5 text-left">Tanggal</th>
                  <th className="label-caps px-5 py-2.5 text-left">Status QC</th>
                  <th className="label-caps px-5 py-2.5 text-right">Dokumen PDF</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {loading && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                      Memuat data checklist...
                    </td>
                  </tr>
                )}
                {filteredActivity.map((a) => (
                  <tr key={a.kind + a.id} className="hover:bg-surface-muted/30 transition-colors">
                    <td className="px-5 py-3">
                      <Badge
                        variant="outline"
                        className={
                          a.kind === "Formulasi"
                            ? "bg-amber-500/10 text-amber-600 dark:text-amber-400 border-amber-500/20 font-mono text-[10px]"
                            : a.kind === "Grinding"
                              ? "bg-blue-500/10 text-blue-600 dark:text-blue-400 border-blue-500/20 font-mono text-[10px]"
                              : "bg-orange-500/10 text-orange-600 dark:text-orange-400 border-orange-500/20 font-mono text-[10px]"
                        }
                      >
                        {a.kind}
                      </Badge>
                    </td>
                    <td className="px-5 py-3">
                      <div className="font-medium text-foreground">{a.label}</div>
                      {a.sub && <div className="text-[10px] text-muted-foreground font-mono">{a.sub}</div>}
                    </td>
                    <td className="px-5 py-3 text-xs text-muted-foreground">
                      <div className="font-medium text-foreground">{a.shift}</div>
                      <div className="text-[10px]">{a.operator}</div>
                    </td>
                    <td className="px-5 py-3 text-muted-foreground font-mono text-xs">{a.date}</td>
                    <td className="px-5 py-3">
                      <StatusBadge status={a.status as never} />
                    </td>
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
                {!loading && filteredActivity.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-5 py-8 text-center text-muted-foreground">
                      Tidak ada data checklist yang sesuai dengan filter pencarian.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Panel>
      </div>
    </AppShell>
  );
}
