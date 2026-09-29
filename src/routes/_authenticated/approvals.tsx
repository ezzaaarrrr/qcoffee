import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Panel, StatCard } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { supabase } from "@/integrations/supabase/client";
import { fetchFormulasi, fetchGrinding, fetchRoasting } from "@/lib/queries";
import { formatDate } from "@/lib/domain";
import { useCurrentUser } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/approvals")({
  head: () => ({
    meta: [
      { title: "Approval Center" },
      {
        name: "description",
        content:
          "Pusat persetujuan checklist produksi: pemeriksaan QC Field dan approval Prod. Process UH.",
      },
      { property: "og:title", content: "Approval Center" },
      {
        property: "og:description",
        content: "Pusat persetujuan checklist produksi kopi oleh QC Field dan Unit Head.",
      },
    ],
  }),
  component: ApprovalsPage,
});

type TableName = "form_formulasi" | "form_grinding" | "form_roasting";

type Pending = {
  table: TableName;
  kind: string;
  id: string;
  label: string;
  tanggal: string;
  status: string;
  qc_notes: string | null;
};

function ApprovalsPage() {
  const { user, canReviewQc, canApproveUh } = useCurrentUser();
  const queryClient = useQueryClient();
  const [target, setTarget] = useState<Pending | null>(null);
  const [action, setAction] = useState<"approve" | "reject">("approve");
  const [notes, setNotes] = useState("");

  const formulasi = useQuery({ queryKey: ["formulasi"], queryFn: fetchFormulasi });
  const grinding = useQuery({ queryKey: ["grinding"], queryFn: fetchGrinding });
  const roasting = useQuery({ queryKey: ["roasting"], queryFn: fetchRoasting });

  const pending: Pending[] = [
    ...(formulasi.data ?? []).map((x) => ({
      table: "form_formulasi" as TableName,
      kind: "Formulasi",
      id: x.id,
      label: `${x.produk || "Produk"} · Batch ${x.no_urut_batch || "-"}`,
      tanggal: x.tanggal_mixing,
      status: x.status,
      qc_notes: x.qc_notes,
    })),
    ...(grinding.data ?? []).map((x) => ({
      table: "form_grinding" as TableName,
      kind: "Grinding",
      id: x.id,
      label: `${x.nama_produk || "Produk"} · ${x.no_grinder || "-"}`,
      tanggal: x.hari_tanggal,
      status: x.status,
      qc_notes: x.qc_notes,
    })),
    ...(roasting.data ?? []).map((x) => ({
      table: "form_roasting" as TableName,
      kind: "Roasting",
      id: x.id,
      label: `${x.nama_produk || "Produk"} · ${x.no_roaster || "-"}`,
      tanggal: x.hari_tanggal,
      status: x.status,
      qc_notes: x.qc_notes,
    })),
  ].sort((a, b) => b.tanggal.localeCompare(a.tanggal));

  const queue = pending.filter((p) => p.status === "Pending QC");
  const decided = pending.filter((p) => p.status !== "Pending QC").slice(0, 10);

  const decide = useMutation({
    mutationFn: async () => {
      if (!target || !user) throw new Error("Data tidak valid");
      if (action === "reject" && notes.trim().length < 5)
        throw new Error("Catatan penolakan minimal 5 karakter");

      const now = new Date().toISOString();
      const base: Record<string, unknown> = {
        status: action === "approve" ? "Approved" : "Rejected",
        qc_notes: notes.trim() || null,
      };
      if (target.table === "form_formulasi") {
        if (canReviewQc) {
          base["approved_by_qc"] = user.id;
          base["approved_qc_at"] = now;
        }
        if (canApproveUh) {
          base["approved_by_uh"] = user.id;
          base["approved_uh_at"] = now;
        }
      } else {
        if (canReviewQc) {
          base["diperiksa_qc_by"] = user.id;
          base["approved_qc_at"] = now;
        }
        if (canApproveUh) {
          base["disetujui_uh_by"] = user.id;
          base["approved_uh_at"] = now;
        }
      }

      const { error } = await supabase
        .from(target.table)
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        .update(base as any)
        .eq("id", target.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(action === "approve" ? "Checklist disetujui" : "Checklist ditolak");
      setTarget(null);
      setNotes("");
      queryClient.invalidateQueries({ queryKey: ["formulasi"] });
      queryClient.invalidateQueries({ queryKey: ["grinding"] });
      queryClient.invalidateQueries({ queryKey: ["roasting"] });
    },
    onError: (e: Error) => toast.error("Gagal memproses", { description: e.message }),
  });

  const canDecide = canReviewQc || canApproveUh;

  return (
    <AppShell breadcrumb="Approval Center">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Approval Center</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {canDecide
            ? "Periksa dan setujui checklist yang menunggu verifikasi."
            : "Anda hanya dapat melihat antrean. Keputusan dilakukan oleh QC Field atau Prod. Process UH."}
        </p>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <StatCard label="Antrean Pemeriksaan" value={queue.length} accent="warning" />
        <StatCard
          label="Disetujui"
          value={pending.filter((p) => p.status === "Approved").length}
          accent="success"
        />
        <StatCard
          label="Ditolak"
          value={pending.filter((p) => p.status === "Rejected").length}
          accent="destructive"
        />
      </div>

      <Panel title="Menunggu Persetujuan" bodyClassName="p-0 overflow-x-auto" className="mb-6">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Jenis", "Detail", "Tanggal", "Status", ""].map((h) => (
                <th key={h} className="label-caps px-4 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {queue.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Tidak ada checklist yang menunggu persetujuan.
                </td>
              </tr>
            )}
            {queue.map((p) => (
              <tr key={p.table + p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs uppercase">{p.kind}</td>
                <td className="px-4 py-3 font-medium">{p.label}</td>
                <td className="px-4 py-3 font-mono text-xs">{formatDate(p.tanggal)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status as never} />
                </td>
                <td className="px-4 py-3 text-right">
                  {canDecide && (
                    <div className="flex justify-end gap-2">
                      <Button
                        size="sm"
                        onClick={() => {
                          setTarget(p);
                          setAction("approve");
                          setNotes("");
                        }}
                      >
                        Setujui
                      </Button>
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => {
                          setTarget(p);
                          setAction("reject");
                          setNotes("");
                        }}
                      >
                        Tolak
                      </Button>
                    </div>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Panel title="Riwayat Keputusan" bodyClassName="p-0 overflow-x-auto">
        <table className="w-full min-w-[760px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Jenis", "Detail", "Tanggal", "Status", "Catatan"].map((h) => (
                <th key={h} className="label-caps px-4 py-2 text-left">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {decided.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-10 text-center text-muted-foreground">
                  Belum ada keputusan tercatat.
                </td>
              </tr>
            )}
            {decided.map((p) => (
              <tr key={p.table + p.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3 font-mono text-xs uppercase">{p.kind}</td>
                <td className="px-4 py-3">{p.label}</td>
                <td className="px-4 py-3 font-mono text-xs">{formatDate(p.tanggal)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={p.status as never} />
                </td>
                <td className="px-4 py-3 text-muted-foreground">{p.qc_notes || "—"}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Dialog open={!!target} onOpenChange={(v) => !v && setTarget(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {action === "approve" ? "Setujui Checklist" : "Tolak Checklist"}
            </DialogTitle>
            <DialogDescription>
              {target?.kind} — {target?.label}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-1.5">
            <Label className="label-caps">
              Catatan QC {action === "reject" && "(wajib)"}
            </Label>
            <Textarea
              rows={4}
              maxLength={1000}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={
                action === "approve"
                  ? "Opsional: catatan hasil pemeriksaan"
                  : "Jelaskan alasan penolakan agar operator dapat memperbaiki"
              }
            />
            <p className="text-xs text-muted-foreground">
              Keputusan tercatat atas nama akun Anda sebagai tanda tangan digital.
            </p>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setTarget(null)}>
              Batal
            </Button>
            <Button onClick={() => decide.mutate()} disabled={decide.isPending}>
              {decide.isPending ? "Memproses..." : "Konfirmasi"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
