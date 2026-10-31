import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Panel, StatCard } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { CheckCircle2, XCircle, Package, AlertTriangle, Loader2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";

import { formatDate } from "@/lib/domain";
import { useCurrentUser } from "@/hooks/useAuth";
import { checkIsGdspUser } from "@/lib/departmentPermissions";
import {
  fetchSparepartOrders,
  approveSparepartOrder,
  rejectSparepartOrder,
  type SparepartOrder,
} from "@/lib/orderService";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Center" },
      {
        name: "description",
        content: "Pusat persetujuan dan approval pemotongan stok order sparepart oleh GDSP.",
      },
      { property: "og:title", content: "Approval Center" },
      {
        property: "og:description",
        content: "Pusat persetujuan dan pemotongan stok sparepart GDSP.",
      },
    ],
  }),
  component: ApprovalsPage,
});

function ApprovalsPage() {
  const { user, profile, roles, isAdmin, canReviewQc, canApproveUh } = useCurrentUser();
  const queryClient = useQueryClient();

  const isGdspUser = checkIsGdspUser(profile, roles, isAdmin);

  // Tab aktif (default ke order sparepart)
  const [activeApprovalTab, setActiveApprovalTab] = useState<"orders">("orders");

  // ── STATE UNTUK ORDER SPAREPART (GDSP APPROVAL) ─────────────────────────────
  const [selectedOrderToApprove, setSelectedOrderToApprove] = useState<SparepartOrder | null>(null);
  const [selectedOrderToReject, setSelectedOrderToReject] = useState<SparepartOrder | null>(null);
  const [orderRejectReason, setOrderRejectReason] = useState("");
  const [isProcessingOrder, setIsProcessingOrder] = useState(false);

  // ── QUERY DATA ORDER SPAREPART ──────────────────────────────────────────────
  const { data: sparepartOrders = [] } = useQuery({
    queryKey: ["sparepart_orders"],
    queryFn: () => fetchSparepartOrders(supabase),
  });

  // Realtime subscription untuk order sparepart
  useEffect(() => {
    const channel = supabase
      .channel("approvals_realtime_sync")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warehouse_activity_logs" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sparepart_orders"] });
        },
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "warehouse_transactions" },
        () => {
          queryClient.invalidateQueries({ queryKey: ["sparepart_orders"] });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [queryClient]);

  const pendingOrders = sparepartOrders.filter((o) => o.status === "PENDING");
  const completedOrders = sparepartOrders.filter((o) => o.status !== "PENDING");

  // ── HANDLERS ORDER APPROVAL GDSP ───────────────────────────────────────────
  const handleConfirmApproveOrder = async () => {
    if (!selectedOrderToApprove) return;
    setIsProcessingOrder(true);
    try {
      const approverName = profile?.full_name || profile?.email || "Admin GDSP";
      const res = await approveSparepartOrder(supabase, selectedOrderToApprove, {
        id: user?.id,
        name: approverName,
      });

      await queryClient.invalidateQueries({ queryKey: ["warehouse_products"] });
      await queryClient.invalidateQueries({ queryKey: ["warehouse_transactions"] });
      await queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
      await queryClient.invalidateQueries({ queryKey: ["sparepart_orders"] });

      toast.success(
        `Order ${res.order_number} disetujui! Stok otomatis terpotong di database dan riwayat mutasi tercatat.`,
      );
      setSelectedOrderToApprove(null);
    } catch (err: any) {
      toast.error("Gagal menyetujui order", { description: err.message });
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const handleConfirmRejectOrder = async () => {
    if (!selectedOrderToReject) return;
    if (!orderRejectReason.trim()) {
      toast.error("Alasan penolakan wajib diisi");
      return;
    }
    setIsProcessingOrder(true);
    try {
      const approverName = profile?.full_name || profile?.email || "Admin GDSP";
      const res = await rejectSparepartOrder(
        supabase,
        selectedOrderToReject,
        { id: user?.id, name: approverName },
        orderRejectReason,
      );

      await queryClient.invalidateQueries({ queryKey: ["warehouse_activity_logs"] });
      await queryClient.invalidateQueries({ queryKey: ["sparepart_orders"] });

      toast.success(`Order ${res.order_number} ditolak. Stok tidak dipotong.`);
      setSelectedOrderToReject(null);
      setOrderRejectReason("");
    } catch (err: any) {
      toast.error("Gagal menolak order", { description: err.message });
    } finally {
      setIsProcessingOrder(false);
    }
  };

  const canDecideOrder = isGdspUser || isAdmin;

  return (
    <AppShell breadcrumb="Approval Center">
      <div className="mb-6 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-foreground">Approval Center</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Pusat persetujuan dan verifikasi: Approval order sparepart (Teknik &rarr; GDSP).
          </p>
        </div>

        {/* Tab Navigasi Kategori Approval */}
        <Tabs
          value={activeApprovalTab}
          onValueChange={(v) => setActiveApprovalTab(v as any)}
          className="shrink-0"
        >
          <TabsList className="grid grid-cols-1 h-9 p-1 bg-muted/60">
            <TabsTrigger value="orders" className="text-xs gap-1.5 font-medium relative">
              <Package className="size-3.5" />
              <span>Order Sparepart</span>
              {pendingOrders.length > 0 && (
                <span className="ml-1 rounded-full bg-amber-500 text-white px-1.5 py-0.2 text-[10px] font-bold animate-pulse">
                  {pendingOrders.length}
                </span>
              )}
            </TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── KATEGORI 1: ORDER SPAREPART TEKNIK (APPROVAL GDSP) ─────────────── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {activeApprovalTab === "orders" && (
        <div className="space-y-6">
          {/* Stat Cards Order */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              label="Menunggu Approval GDSP"
              value={pendingOrders.length}
              accent="warning"
            />
            <StatCard
              label="Disetujui & Stok Terpotong"
              value={sparepartOrders.filter((o) => o.status === "APPROVED").length}
              accent="success"
            />
            <StatCard
              label="Ditolak"
              value={sparepartOrders.filter((o) => o.status === "REJECTED").length}
              accent="destructive"
            />
          </div>

          {/* Antrean Order Menunggu Approval GDSP */}
          <Panel
            title={
              <div className="flex items-center justify-between w-full">
                <span className="font-semibold text-foreground">
                  Permintaan Order Sparepart Menunggu Persetujuan GDSP ({pendingOrders.length})
                </span>
                {canDecideOrder ? (
                  <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 text-[10px] font-semibold border-emerald-300">
                    Akses Approval GDSP Aktif
                  </Badge>
                ) : (
                  <Badge variant="outline" className="text-[10px] text-muted-foreground">
                    Hanya Dapat Memantau
                  </Badge>
                )}
              </div>
            }
            bodyClassName="p-0 overflow-x-auto"
          >
            <table className="w-full min-w-760px text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                    No. Order & Waktu
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                    Pemohon (Teknik) & Keperluan
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                    Daftar Barang & Kuantitas
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-muted-foreground">
                    Status
                  </th>
                  {canDecideOrder && (
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase text-muted-foreground">
                      Aksi Approval
                    </th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {pendingOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={canDecideOrder ? 5 : 4}
                      className="px-4 py-12 text-center text-muted-foreground text-xs"
                    >
                      <CheckCircle2 className="size-8 mx-auto text-emerald-500/50 mb-2" />
                      Tidak ada permintaan order sparepart yang sedang menunggu approval.
                    </td>
                  </tr>
                )}
                {pendingOrders.map((ord) => (
                  <tr
                    key={ord.id || ord.order_number}
                    className="hover:bg-muted/30 transition-colors"
                  >
                    <td className="px-4 py-3 align-top font-mono">
                      <span className="font-bold text-foreground text-xs block">
                        {ord.order_number}
                      </span>
                      <span className="text-[11px] text-muted-foreground block mt-0.5">
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

                    <td className="px-4 py-3 align-top">
                      <div className="font-medium text-foreground text-xs">{ord.user_pemohon}</div>
                      <div className="text-[11px] text-muted-foreground mt-0.5">
                        {ord.alasan_permintaan}
                      </div>
                      {ord.petugas_shift && ord.petugas_shift !== "-" && (
                        <div className="text-[10px] text-muted-foreground/80 mt-0.5 font-mono">
                          Shift/Catatan: {ord.petugas_shift}
                        </div>
                      )}
                    </td>

                    <td className="px-4 py-3 align-top">
                      <div className="space-y-1 text-xs">
                        {ord.items.map((it, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="font-semibold text-rose-600 font-mono">
                              -{it.quantity} {it.unit}
                            </span>
                            <span className="font-medium text-foreground">{it.product_name}</span>
                            {it.stock_before !== undefined && (
                              <span className="text-[10px] text-muted-foreground font-mono">
                                (Stok sekarang: {it.stock_before})
                              </span>
                            )}
                          </div>
                        ))}
                      </div>
                    </td>

                    <td className="px-4 py-3 align-top text-center">
                      <Badge className="bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-300 border-amber-300 text-[10px] font-semibold whitespace-nowrap animate-pulse">
                        ⏳ Menunggu Approval
                      </Badge>
                    </td>

                    {canDecideOrder && (
                      <td className="px-4 py-3 align-top text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          <Button
                            size="sm"
                            onClick={() => setSelectedOrderToApprove(ord)}
                            className="h-7.5 px-3 text-xs bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
                          >
                            <CheckCircle2 className="size-3.5 mr-1" />
                            Setujui & Potong Stok
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => {
                              setSelectedOrderToReject(ord);
                              setOrderRejectReason("");
                            }}
                            className="h-7.5 px-2.5 text-xs text-rose-600 border-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                          >
                            <XCircle className="size-3.5 mr-1" />
                            Tolak
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </Panel>

          {/* Riwayat Monitoring Pemotongan Stok Order */}
          <Panel
            title="Riwayat & Monitoring Pemotongan Stok Order Sparepart"
            bodyClassName="p-0 overflow-x-auto"
          >
            <table className="w-full min-w-760px text-sm text-left">
              <thead>
                <tr className="border-b border-border bg-muted/30">
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                    No. Order & Waktu Transaksi
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                    Barang & Kuantitas Digunakan
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-muted-foreground">
                    Stok Sebelum
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-muted-foreground">
                    Stok Sesudah
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                    Pemohon (Teknik)
                  </th>
                  <th className="px-4 py-2.5 text-xs font-semibold uppercase text-muted-foreground">
                    User Pemotong Stok (GDSP)
                  </th>
                  <th className="px-4 py-2.5 text-center text-xs font-semibold uppercase text-muted-foreground">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {completedOrders.length === 0 && (
                  <tr>
                    <td
                      colSpan={7}
                      className="px-4 py-10 text-center text-muted-foreground text-xs"
                    >
                      Belum ada riwayat order sparepart yang diselesaikan.
                    </td>
                  </tr>
                )}
                {completedOrders.map((ord) => {
                  const isApproved = ord.status === "APPROVED";
                  return (
                    <tr
                      key={ord.id || ord.order_number}
                      className="hover:bg-muted/20 transition-colors"
                    >
                      <td className="px-4 py-3 align-top font-mono">
                        <span className="font-bold text-foreground text-xs block">
                          {ord.order_number}
                        </span>
                        <span className="text-[10px] text-muted-foreground block mt-0.5">
                          {ord.approved_at
                            ? new Date(ord.approved_at).toLocaleString("id-ID", {
                                day: "2-digit",
                                month: "short",
                                year: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              })
                            : formatDate(ord.created_at)}{" "}
                          WIB
                        </span>
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="space-y-0.5 text-xs">
                          {ord.items.map((it, idx) => (
                            <div key={idx} className="font-medium text-foreground">
                              <span className="font-mono font-bold text-rose-600 mr-1.5">
                                -{it.quantity} {it.unit}
                              </span>
                              <span>{it.product_name}</span>
                            </div>
                          ))}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top text-center font-mono text-xs text-muted-foreground">
                        {ord.items.map((it, idx) => (
                          <div key={idx}>
                            {it.stock_before !== undefined && it.stock_before !== null
                              ? `${it.stock_before} ${it.unit}`
                              : "—"}
                          </div>
                        ))}
                      </td>

                      <td className="px-4 py-3 align-top text-center font-mono text-xs font-bold">
                        {ord.items.map((it, idx) => (
                          <div
                            key={idx}
                            className={isApproved ? "text-emerald-600" : "text-muted-foreground"}
                          >
                            {isApproved && it.stock_after !== undefined && it.stock_after !== null
                              ? `${it.stock_after} ${it.unit}`
                              : "—"}
                          </div>
                        ))}
                      </td>

                      <td className="px-4 py-3 align-top">
                        <div className="font-medium text-foreground text-xs">
                          {ord.user_pemohon}
                        </div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 line-clamp-1">
                          {ord.alasan_permintaan}
                        </div>
                      </td>

                      <td className="px-4 py-3 align-top text-xs">
                        {isApproved ? (
                          <span className="font-semibold text-foreground">
                            {ord.approved_by_name || "Petugas GDSP"}
                          </span>
                        ) : (
                          <div>
                            <span className="font-semibold text-rose-600 block">
                              {ord.approved_by_name || "Admin GDSP"} (Ditolak)
                            </span>
                            {ord.rejection_reason && (
                              <span className="text-[10px] text-rose-700 dark:text-rose-300 italic block mt-0.5">
                                &ldquo;{ord.rejection_reason}&rdquo;
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3 align-top text-center">
                        {isApproved ? (
                          <Badge className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300 border-emerald-300 text-[10px] font-semibold whitespace-nowrap">
                            ✓ AAPPROVAL
                          </Badge>
                        ) : (
                          <Badge className="bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300 border-rose-300 text-[10px] font-semibold whitespace-nowrap">
                            ✕ Ditolak
                          </Badge>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </Panel>
        </div>
      )}

      {/* ── DIALOG KONFIRMASI APPROVAL ORDER OLEH GDSP ────────────────────────── */}
      <Dialog
        open={Boolean(selectedOrderToApprove)}
        onOpenChange={(open) => !open && setSelectedOrderToApprove(null)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-foreground flex items-center gap-2">
              <CheckCircle2 className="size-5 text-emerald-600" />
              <span>Konfirmasi Persetujuan & Pemotongan Stok</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Order No. <strong>{selectedOrderToApprove?.order_number}</strong> dari{" "}
              {selectedOrderToApprove?.user_pemohon}
            </DialogDescription>
          </DialogHeader>

          {selectedOrderToApprove && (
            <div className="space-y-4 py-2 text-xs">
              <div className="p-3 rounded-lg border border-border bg-surface-muted/40 space-y-2">
                <div className="font-semibold text-foreground">
                  Rincian Barang yang Akan Dipotong:
                </div>
                <div className="space-y-1.5">
                  {selectedOrderToApprove.items.map((it, idx) => (
                    <div
                      key={idx}
                      className="flex items-center justify-between p-2 rounded bg-surface border border-border/60"
                    >
                      <div>
                        <span className="font-medium text-foreground">{it.product_name}</span>
                        {it.product_code && (
                          <span className="text-[10px] text-muted-foreground font-mono ml-1.5">
                            ({it.product_code})
                          </span>
                        )}
                      </div>
                      <div className="text-right">
                        <span className="font-bold text-rose-600 font-mono">
                          -{it.quantity} {it.unit}
                        </span>
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="p-3 rounded-lg border border-amber-200 dark:border-amber-900 bg-amber-50/60 dark:bg-amber-950/20 text-amber-900 dark:text-amber-200 flex items-start gap-2">
                <AlertTriangle className="size-4 text-amber-600 shrink-0 mt-0.5" />
                <div className="space-y-0.5">
                  <div className="font-semibold">Perhatian Pemotongan Stok Otomatis:</div>
                  <div className="text-[11px] leading-relaxed">
                    Setelah tombol persetujuan diklik, stok master barang di database akan otomatis
                    terpotong secara permanen, dan transaksi mutasi keluar (OUT) akan langsung
                    tercatat atas nama Anda.
                  </div>
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setSelectedOrderToApprove(null)}
              disabled={isProcessingOrder}
              className="text-xs h-8"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmApproveOrder}
              disabled={isProcessingOrder}
              className="text-xs h-8 bg-emerald-600 hover:bg-emerald-700 text-white font-semibold"
            >
              {isProcessingOrder ? (
                <>
                  <Loader2 className="size-3.5 animate-spin mr-1.5" />
                  <span>Memproses Pemotongan Stok...</span>
                </>
              ) : (
                <>
                  <CheckCircle2 className="size-3.5 mr-1.5" />
                  <span>Setujui & Potong Stok Sekarang</span>
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── DIALOG KONFIRMASI PENOLAKAN ORDER OLEH GDSP ───────────────────────── */}
      <Dialog
        open={Boolean(selectedOrderToReject)}
        onOpenChange={(open) => !open && setSelectedOrderToReject(null)}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-rose-600 flex items-center gap-2">
              <XCircle className="size-5" />
              <span>Tolak Permintaan Order Sparepart</span>
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground mt-0.5">
              Order No. <strong>{selectedOrderToReject?.order_number}</strong> akan ditolak dan stok
              barang tidak akan terpotong.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold">Alasan Penolakan *</Label>
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
              onClick={() => setSelectedOrderToReject(null)}
              disabled={isProcessingOrder}
              className="text-xs h-8"
            >
              Batal
            </Button>
            <Button
              type="button"
              size="sm"
              onClick={handleConfirmRejectOrder}
              disabled={isProcessingOrder || !orderRejectReason.trim()}
              className="text-xs h-8 bg-rose-600 hover:bg-rose-700 text-white font-semibold"
            >
              {isProcessingOrder ? "Memproses..." : "Konfirmasi Tolak Order"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
