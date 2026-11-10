import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useMemo } from "react";
import { Search, ClipboardList, CheckCircle2, XCircle, Plus, ArrowLeft, Info } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import { checkIsGdspUser } from "@/lib/departmentPermissions";
import {
  fetchSparepartOrders,
  approveSparepartOrder,
  rejectSparepartOrder,
  type SparepartOrder,
} from "@/lib/orderService";

export const Route = createFileRoute("/_authenticated/products/order-monitoring")({
  head: () => ({
    meta: [
      { title: "Monitoring Pemotongan Stok Barang (Sistem Order)" },
      {
        name: "description",
        content: "Memantau pemotongan stok barang sparepart akibat sistem order secara real-time.",
      },
    ],
  }),
  component: OrderMonitoringPage,
});

function OrderMonitoringPage() {
  const { profile, roles, isAdmin } = useCurrentUser();
  const isGdspUser = checkIsGdspUser(profile, roles, isAdmin);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const [orderMonitoringSearch, setOrderMonitoringSearch] = useState("");
  const [orderMonitoringStatus, setOrderMonitoringStatus] = useState<
    "ALL" | "PENDING" | "APPROVED" | "REJECTED"
  >("ALL");
  const [orderRejectTarget, setOrderRejectTarget] = useState<SparepartOrder | null>(null);
  const [orderRejectReason, setOrderRejectReason] = useState("");

  // Query order sparepart dari database (share cache dengan halaman Master Barang & approvals)
  // Polling 12 detik supaya count di tombol & selalu sama dengan tabelnya.
  const { data: sparepartOrders = [], isLoading } = useQuery({
    queryKey: ["sparepart_orders"],
    queryFn: () => fetchSparepartOrders(supabase),
    refetchInterval: 12000,
  });

  const pendingOrdersCount = useMemo(() => {
    return sparepartOrders.filter((o) => o.status === "PENDING").length;
  }, [sparepartOrders]);

  // Handler Approval Order oleh GDSP
  const handleApproveOrder = async (order: SparepartOrder) => {
    try {
      const approverName = profile?.full_name || profile?.email || "Petugas GDSP";
      const approved = await approveSparepartOrder(supabase, order, {
        id: profile?.id,
        name: approverName,
      });

      await queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
      await queryClient.invalidateQueries({ queryKey: ["warehouse_transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
      await queryClient.invalidateQueries({ queryKey: ["sparepart_orders"] });

      toast.success(
        `Order ${approved.order_number} disetujui! Stok otomatis terpotong dan tercatat di mutasi riwayat.`,
      );
    } catch (err: any) {
      toast.error("Gagal menyetujui order", { description: err.message });
    }
  };

  // Handler Tolak Order oleh GDSP
  const handleRejectOrderConfirm = async () => {
    if (!orderRejectTarget) return;
    try {
      const approverName = profile?.full_name || profile?.email || "Petugas GDSP";
      const rejected = await rejectSparepartOrder(
        supabase,
        orderRejectTarget,
        { id: profile?.id, name: approverName },
        orderRejectReason,
      );

      await queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
      await queryClient.invalidateQueries({ queryKey: ["sparepart_orders"] });

      toast.success(`Order ${rejected.order_number} ditolak. Stok tidak dipotong.`);
      setOrderRejectTarget(null);
      setOrderRejectReason("");
    } catch (err: any) {
      toast.error("Gagal menolak order", { description: err.message });
    }
  };

  // Arahkan kembali ke halaman Master Barang dan langsung buka formulir order baru
  const openNewOrder = () => {
    navigate({ search: () => ({ action: "order" }) as any, to: "/products" });
  };

  return (
    <AppShell
      breadcrumb="Master Barang ▸ Monitoring Pemotongan Stok Order"
      actions={
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            onClick={() => navigate({ to: "/products" })}
            className="gap-1.5 border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-900 hover:bg-slate-100 text-slate-800 dark:text-slate-200 font-semibold shadow-sm h-8 px-3 text-xs rounded-md transition-all flex items-center select-none cursor-pointer"
            title="Kembali ke Master Barang"
          >
            <ArrowLeft className="size-3.5" />
            <span className="hidden sm:inline">Kembali</span>
          </Button>

          <Button
            onClick={openNewOrder}
            className="gap-1.5 bg-[#0f274a] hover:bg-[#183a6b] text-white font-semibold shadow-sm h-8 px-3 text-xs rounded-md transition-all flex items-center border border-blue-900/40 select-none cursor-pointer"
            title="Buat permintaan order sparepart baru"
          >
            <Plus className="size-3.5 text-blue-300" />
            <span>Buat Order Baru</span>
            {pendingOrdersCount > 0 && (
              <span className="ml-0.5 inline-flex items-center justify-center rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-bold animate-pulse">
                {pendingOrdersCount}
              </span>
            )}
          </Button>
        </div>
      }
    >
      {/* ── HALAMAN: MONITORING PEMOTONGAN STOK BARANG (ORDER TEKNIK) ────────── */}
      <div className="flex flex-col gap-4">
        {/* Header Halaman */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center size-9 rounded-lg bg-blue-100 dark:bg-blue-950 text-blue-700 dark:text-blue-300 shrink-0">
              <ClipboardList className="size-4.5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-foreground">
                Monitoring Pemotongan Stok Barang (Sistem Order)
              </h1>
              <p className="text-xs text-muted-foreground mt-0.5">
                Memantau informasi barang, jumlah stok sebelum dan sesudah transaksi, jumlah barang
                yang digunakan, tanggal &amp; waktu, nomor referensi order, dan user pemotong stok
                secara real-time.
              </p>
            </div>
          </div>
        </div>

        {/* Banner Info untuk Role GDSP */}
        {isGdspUser && pendingOrdersCount > 0 && (
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50/90 dark:border-amber-800 dark:bg-amber-950/40 p-3 text-xs text-amber-900 dark:text-amber-200 shadow-sm animate-in fade-in">
            <div className="flex items-center gap-2.5">
              <div className="size-2 rounded-full bg-amber-500 animate-ping shrink-0" />
              <div>
                <strong>Pemberitahuan Approval Order:</strong> Ada{" "}
                <span className="font-bold underline">
                  {pendingOrdersCount} permintaan order sparepart
                </span>{" "}
                dari Departemen Teknik yang menunggu persetujuan (approval) Anda. Stok tidak akan
                terpotong sebelum disetujui.
              </div>
            </div>
          </div>
        )}

        {/* Stat Cards Monitoring */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <div className="p-3 rounded-lg border border-border bg-surface">
            <div className="text-[11px] font-medium text-muted-foreground">
              Total Permintaan Order
            </div>
            <div className="text-xl font-bold font-mono text-foreground mt-0.5">
              {sparepartOrders.length}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/50 dark:bg-amber-950/20">
            <div className="text-[11px] font-medium text-amber-700 dark:text-amber-400 flex items-center justify-between">
              <span>Menunggu Approval GDSP</span>
              {pendingOrdersCount > 0 && (
                <span className="size-2 rounded-full bg-amber-500 animate-ping" />
              )}
            </div>
            <div className="text-xl font-bold font-mono text-amber-600 dark:text-amber-300 mt-0.5">
              {pendingOrdersCount}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-emerald-200 dark:border-emerald-900 bg-emerald-50/50 dark:bg-emerald-950/20">
            <div className="text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
              Disetujui &amp; Stok Terpotong
            </div>
            <div className="text-xl font-bold font-mono text-emerald-600 dark:text-emerald-300 mt-0.5">
              {sparepartOrders.filter((o) => o.status === "APPROVED").length}
            </div>
          </div>
          <div className="p-3 rounded-lg border border-rose-200 dark:border-rose-900 bg-rose-50/50 dark:bg-rose-950/20">
            <div className="text-[11px] font-medium text-rose-700 dark:text-rose-400">Ditolak</div>
            <div className="text-xl font-bold font-mono text-rose-600 dark:text-rose-300 mt-0.5">
              {sparepartOrders.filter((o) => o.status === "REJECTED").length}
            </div>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="flex flex-col sm:flex-row items-center gap-2">
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-2.5 size-3.5 text-muted-foreground" />
            <Input
              placeholder="Cari nomor order, nama barang, pemohon, atau pemotong stok..."
              value={orderMonitoringSearch}
              onChange={(e) => setOrderMonitoringSearch(e.target.value)}
              className="pl-8.5 h-8.5 text-xs w-full"
            />
          </div>
          <Select
            value={orderMonitoringStatus}
            onValueChange={(val: any) => setOrderMonitoringStatus(val)}
          >
            <SelectTrigger className="w-full sm:w-48 h-8.5 text-xs">
              <SelectValue placeholder="Status Approval" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">
                Semua Status
              </SelectItem>
              <SelectItem value="PENDING" className="text-xs text-amber-600 font-semibold">
                ⏳ Menunggu Approval
              </SelectItem>
              <SelectItem value="APPROVED" className="text-xs text-emerald-600 font-semibold">
                ✓ Disetujui (Stok Terpotong)
              </SelectItem>
              <SelectItem value="REJECTED" className="text-xs text-rose-600 font-semibold">
                ✕ Ditolak
              </SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* Tabel Monitoring Data */}
        <div className="overflow-y-auto border border-border rounded-lg bg-surface min-h-[280px] max-h-[calc(100vh-380px)]">
          {(() => {
            const q = orderMonitoringSearch.toLowerCase().trim();
            const filteredOrders = sparepartOrders.filter((o) => {
              if (orderMonitoringStatus !== "ALL" && o.status !== orderMonitoringStatus) {
                return false;
              }
              if (!q) return true;
              const matchNum = o.order_number.toLowerCase().includes(q);
              const matchPemohon = o.user_pemohon.toLowerCase().includes(q);
              const matchAlasan = o.alasan_permintaan.toLowerCase().includes(q);
              const matchApprover = (o.approved_by_name || "").toLowerCase().includes(q);
              const matchItems = o.items.some(
                (it) =>
                  it.product_name.toLowerCase().includes(q) ||
                  it.product_code.toLowerCase().includes(q),
              );
              return matchNum || matchPemohon || matchAlasan || matchApprover || matchItems;
            });

            if (isLoading) {
              return (
                <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
                  <ClipboardList className="size-8 mx-auto text-muted-foreground/50" />
                  <div>Memuat data monitoring order...</div>
                </div>
              );
            }

            if (filteredOrders.length === 0) {
              return (
                <div className="py-16 text-center text-xs text-muted-foreground space-y-2">
                  <ClipboardList className="size-8 mx-auto text-muted-foreground/50" />
                  <div>Tidak ada catatan order sparepart yang sesuai dengan filter.</div>
                </div>
              );
            }

            return (
              <table className="w-full text-xs text-left border-collapse">
                <thead className="bg-surface-muted/60 text-muted-foreground border-b border-border sticky top-0 z-10 text-[11px] font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-2.5 px-3">No. Order &amp; Waktu</th>
                    <th className="py-2.5 px-3">keterangan</th>
                    <th className="py-2.5 px-3 text-center">Jumlah Digunakan</th>
                    <th className="py-2.5 px-3 text-center">Stok Sebelum</th>
                    <th className="py-2.5 px-3 text-center">Stok Sesudah</th>
                    <th className="py-2.5 px-3">Pemohon &amp; Keperluan</th>
                    <th className="py-2.5 px-3">User Pemotong Stok</th>
                    <th className="py-2.5 px-3 text-center">Status</th>
                    {(isGdspUser || isAdmin) && (
                      <th className="py-2.5 px-3 text-right">Aksi Approval</th>
                    )}
                  </tr>
                </thead>
                <tbody className="divide-y divide-border/60">
                  {filteredOrders.map((ord) => {
                    const isPending = ord.status === "PENDING";
                    const isApproved = ord.status === "APPROVED";
                    const isRejected = ord.status === "REJECTED";

                    return (
                      <tr
                        key={ord.id || ord.order_number}
                        className={cn(
                          "hover:bg-surface-muted/40 transition-colors",
                          isPending && "bg-amber-500/5",
                        )}
                      >
                        {/* 1. No Order & Waktu */}
                        <td className="py-3 px-3 align-top font-mono">
                          <span className="font-bold text-foreground text-xs block">
                            {ord.order_number}
                          </span>
                          <span className="text-[10px] text-muted-foreground mt-0.5 block">
                            {new Date(ord.created_at).toLocaleString("id-ID", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}{" "}
                            WIB
                          </span>
                        </td>

                        {/* 2. Informasi Barang */}
                        <td className="py-3 px-3 align-top">
                          <div className="space-y-1">
                            {ord.items.map((it, idx) => (
                              <div key={idx} className="font-medium text-foreground">
                                <span>{it.product_name}</span>{" "}
                                {it.product_code && (
                                  <span className="font-mono text-[10px] text-muted-foreground bg-muted px-1 rounded">
                                    {it.product_code}
                                  </span>
                                )}
                              </div>
                            ))}
                          </div>
                        </td>

                        {/* 3. Jumlah Digunakan */}
                        <td className="py-3 px-3 align-top text-center font-mono font-bold text-rose-600">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="whitespace-nowrap">
                              -{it.quantity} {it.unit}
                            </div>
                          ))}
                        </td>

                        {/* 4. Stok Sebelum Transaksi */}
                        <td className="py-3 px-3 align-top text-center font-mono text-muted-foreground">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="whitespace-nowrap font-medium">
                              {it.stock_before !== undefined && it.stock_before !== null
                                ? `${it.stock_before} ${it.unit}`
                                : "—"}
                            </div>
                          ))}
                        </td>

                        {/* 5. Stok Sesudah Transaksi */}
                        <td className="py-3 px-3 align-top text-center font-mono font-bold">
                          {ord.items.map((it, idx) => {
                            const sAfter = it.stock_after;
                            return (
                              <div
                                key={idx}
                                className={cn(
                                  "whitespace-nowrap",
                                  isApproved
                                    ? "text-emerald-600"
                                    : isPending
                                      ? "text-amber-600"
                                      : "text-muted-foreground",
                                )}
                              >
                                {isApproved
                                  ? sAfter !== undefined && sAfter !== null
                                    ? `${sAfter} ${it.unit}`
                                    : "—"
                                  : isPending
                                    ? sAfter !== undefined && sAfter !== null
                                      ? `(${sAfter})*`
                                      : "—"
                                    : "—"}
                              </div>
                            );
                          })}
                        </td>

                        {/* 6. Pemohon & Keperluan */}
                        <td className="py-3 px-3 align-top">
                          <div className="font-medium text-foreground">{ord.user_pemohon}</div>
                          <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-2">
                            {ord.alasan_permintaan}
                          </div>
                          {ord.petugas_shift && ord.petugas_shift !== "-" && (
                            <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono">
                              Shift/Catatan: {ord.petugas_shift}
                            </div>
                          )}
                        </td>

                        {/* 7. User Pemotong Stok (GDSP) */}
                        <td className="py-3 px-3 align-top">
                          {isApproved ? (
                            <div>
                              <span className="font-semibold text-foreground block">
                                {ord.approved_by_name || "Petugas GDSP"}
                              </span>
                              {ord.approved_at && (
                                <span className="text-[10px] text-muted-foreground font-mono block">
                                  {new Date(ord.approved_at).toLocaleString("id-ID", {
                                    day: "2-digit",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}{" "}
                                  WIB
                                </span>
                              )}
                            </div>
                          ) : isRejected ? (
                            <div>
                              <span className="font-semibold text-rose-600 block">
                                {ord.approved_by_name || "Admin GDSP"} (Ditolak)
                              </span>
                              {ord.rejection_reason && (
                                <span className="text-[10px] text-rose-700 dark:text-rose-300 block italic">
                                  &ldquo;{ord.rejection_reason}&rdquo;
                                </span>
                              )}
                            </div>
                          ) : (
                            <span className="text-[11px] text-amber-600 font-medium italic">
                              Menunggu Approval GDSP
                            </span>
                          )}
                        </td>

                        {/* 8. Status */}
                        <td className="py-3 px-3 align-top text-center">
                          {isPending && (
                            <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 text-[10px] font-semibold whitespace-nowrap animate-pulse">
                              ⏳ Menunggu Approval
                            </Badge>
                          )}
                          {isApproved && (
                            <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 text-[10px] font-semibold whitespace-nowrap">
                              ✓ APPROVAL
                            </Badge>
                          )}
                          {isRejected && (
                            <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 text-[10px] font-semibold whitespace-nowrap">
                              ✕ Ditolak
                            </Badge>
                          )}
                        </td>

                        {/* 9. Aksi untuk Role GDSP / Admin */}
                        {(isGdspUser || isAdmin) && (
                          <td className="py-3 px-3 align-top text-right whitespace-nowrap">
                            {isPending ? (
                              <div className="flex items-center justify-end gap-1.5">
                                <Button
                                  size="sm"
                                  onClick={() => handleApproveOrder(ord)}
                                  className="h-7 px-2.5 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                                  title="Setujui dan potong stok sekarang"
                                >
                                  <CheckCircle2 className="size-3.5 mr-1" />
                                  Setujui
                                </Button>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  onClick={() => {
                                    setOrderRejectTarget(ord);
                                    setOrderRejectReason("");
                                  }}
                                  className="h-7 px-2.5 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/50"
                                  title="Tolak permintaan order ini"
                                >
                                  <XCircle className="size-3.5 mr-1" />
                                  Tolak
                                </Button>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground">—</span>
                            )}
                          </td>
                        )}
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            );
          })()}
        </div>

        {/* Catatan Kaki */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-2 pt-1 text-[11px] text-muted-foreground">
          <Info className="size-3.5 shrink-0 hidden sm:block" />
          <div className="flex-1">
            * Tanda (*) pada kolom stok sesudah saat status pending merupakan proyeksi sisa stok
            jika order disetujui.
          </div>
        </div>
      </div>

      {/* ── DIALOG KONFIRMASI TOLAK ORDER GDSP ────────────────────────────────── */}
      <Dialog
        open={Boolean(orderRejectTarget)}
        onOpenChange={(open) => !open && setOrderRejectTarget(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <XCircle className="size-5" />
              <span>Tolak Permintaan Order Sparepart</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-1">
              Order <strong>{orderRejectTarget?.order_number}</strong> akan ditolak dan stok barang
              tidak akan terpotong.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold">Alasan Penolakan *</label>
              <Input
                value={orderRejectReason}
                onChange={(e) => setOrderRejectReason(e.target.value)}
                placeholder="Contoh: Stok sedang dialokasikan untuk maintenance prioritas lain"
                className="h-9 text-xs"
                autoFocus
              />
            </div>
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setOrderRejectTarget(null)}
              className="text-xs h-8"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleRejectOrderConfirm}
              disabled={!orderRejectReason.trim()}
              className="h-8 text-xs bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              Konfirmasi Tolak Order
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
