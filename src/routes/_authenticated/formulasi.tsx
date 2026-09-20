import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, useEffect } from "react";
import { Plus, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/Panel";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { fetchFormulasi, fetchProducts, type FormulasiRow } from "@/lib/queries";
import { SHIFTS, formatDate, formatNumber, minutesBetween } from "@/lib/domain";
import { TimePickerDialog } from "@/components/TimePickerDialog";
import { useCurrentUser } from "@/hooks/useAuth";

export const Route = createFileRoute("/_authenticated/formulasi")({
  validateSearch: (search: Record<string, unknown>) => ({
    action: (search["action"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Formulasi Mixing — Q-Coffee M2" },
      {
        name: "description",
        content: "Checklist digital formulasi dan mixing batch produksi kopi per shift.",
      },
      { property: "og:title", content: "Formulasi Mixing — Q-Coffee M2" },
      {
        property: "og:description",
        content: "Checklist digital formulasi dan mixing batch produksi kopi per shift.",
      },
    ],
  }),
  component: FormulasiPage,
});

type MaterialItem = { material: string; quantity: string };

const EMPTY_MATERIAL: MaterialItem = { material: "", quantity: "" };

const EMPTY = {
  tanggal_mixing: new Date().toISOString().slice(0, 10),
  no_mixer: "",
  produk: "",
  no_urut_batch: "",
  shift_regu: "Shift 1",
  line: "",
  start_mixing: "",
  selesai_mixing: "",
  qan_rm: "",
  qan_premix: "",
  operator_premix: "",
  keterangan: "",
};

function FormulasiPage() {
  const search = Route.useSearch();
  const { user, canCreate } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (search.action === "new" && canCreate) {
      setOpen(true);
    }
  }, [search.action, canCreate]);
  const [form, setForm] = useState({ ...EMPTY });
  const [materials, setMaterials] = useState<MaterialItem[]>([{ ...EMPTY_MATERIAL }]);

  const patchMaterial = (idx: number, patch: Partial<MaterialItem>) =>
    setMaterials((prev) => prev.map((m, i) => (i === idx ? { ...m, ...patch } : m)));

  const addMaterial = () => setMaterials((prev) => [...prev, { ...EMPTY_MATERIAL }]);
  const removeMaterial = (idx: number) =>
    setMaterials((prev) => prev.filter((_, i) => i !== idx));

  const rows = useQuery({ queryKey: ["formulasi"], queryFn: fetchFormulasi });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });

  const create = useMutation({
    mutationFn: async () => {
      if (!form.tanggal_mixing) throw new Error("Tanggal mixing wajib diisi");
      if (!user) throw new Error("Sesi tidak valid");
      // Serialize materials to JSON string; sum total qty
      const materialJson = JSON.stringify(
        materials.filter((m) => m.material.trim()).map((m) => ({
          nama: m.material.trim(),
          qty: m.quantity ? Number(m.quantity) : 0,
        }))
      );
      const totalQty = materials.reduce((sum, m) => sum + (m.quantity ? Number(m.quantity) : 0), 0);
      const { error } = await supabase.from("form_formulasi").insert({
        created_by: user.id,
        tanggal_mixing: form.tanggal_mixing,
        no_mixer: form.no_mixer || null,
        produk: form.produk || null,
        no_urut_batch: form.no_urut_batch || null,
        shift_regu: form.shift_regu || null,
        line: form.line || null,
        start_mixing: form.start_mixing || null,
        selesai_mixing: form.selesai_mixing || null,
        material: materialJson || null,
        quantity: totalQty || null,
        qan_rm: form.qan_rm || null,
        qan_premix: form.qan_premix || null,
        operator_premix: form.operator_premix || null,
        keterangan: form.keterangan || null,
        status: "Pending QC",
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Checklist formulasi tersimpan");
      setOpen(false);
      setForm({ ...EMPTY });
      setMaterials([{ ...EMPTY_MATERIAL }]);
      queryClient.invalidateQueries({ queryKey: ["formulasi"] });
    },
    onError: (e: Error) => toast.error("Gagal menyimpan", { description: e.message }),
  });

  const data: FormulasiRow[] = rows.data ?? [];

  return (
    <AppShell
      breadcrumb="Formulasi Mixing"
      actions={
        canCreate ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-4" /> Checklist Baru
          </Button>
        ) : null
      }
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Checklist Formulasi & Mixing</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Pencatatan batch mixing: material, quantity, waktu proses, dan operator premix.
        </p>
      </div>

      <Panel bodyClassName="p-0 overflow-x-auto">
        <table className="w-full min-w-[1000px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {[
                "Tanggal",
                "Mixer",
                "Produk",
                "Batch",
                "Shift",
                "Line",
                "Material",
                "Qty (kg)",
                "Durasi (menit)",
                "Status",
              ].map((h) => (
                <th key={h} className="label-caps px-4 py-2 text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.isLoading && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  Memuat data...
                </td>
              </tr>
            )}
            {!rows.isLoading && data.length === 0 && (
              <tr>
                <td colSpan={10} className="px-4 py-10 text-center text-muted-foreground">
                  Belum ada checklist formulasi.
                </td>
              </tr>
            )}
            {data.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                  {formatDate(row.tanggal_mixing)}
                </td>
                <td className="px-4 py-3">{row.no_mixer || "—"}</td>
                <td className="px-4 py-3 font-medium">{row.produk || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.no_urut_batch || "—"}</td>
                <td className="px-4 py-3">{row.shift_regu || "—"}</td>
                <td className="px-4 py-3">{row.line || "—"}</td>
                <td className="px-4 py-3 max-w-[180px]">
                  {(() => {
                    try {
                      const parsed = JSON.parse(row.material ?? "[]") as { nama: string; qty: number }[];
                      if (Array.isArray(parsed) && parsed.length > 0) {
                        return (
                          <ol className="list-decimal list-inside space-y-0.5 text-xs">
                            {parsed.map((m, i) => (
                              <li key={i}>
                                <span className="font-medium">{m.nama}</span>
                                {m.qty ? <span className="text-muted-foreground"> ({m.qty} kg)</span> : null}
                              </li>
                            ))}
                          </ol>
                        );
                      }
                    } catch {
                      /* fallback to plain text */
                    }
                    return <span>{row.material || "—"}</span>;
                  })()}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {formatNumber(row.quantity, 1)}
                </td>
                <td className="px-4 py-3 text-right font-mono tabular-nums">
                  {formatNumber(minutesBetween(row.start_mixing, row.selesai_mixing), 1)}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist Formulasi Baru</DialogTitle>
            <DialogDescription>
              Isi data mixing batch. Setelah disimpan, status menjadi Pending QC.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-3">
            <Field label="Tanggal Mixing">
              <Input
                type="date"
                value={form.tanggal_mixing}
                onChange={(e) => setForm({ ...form, tanggal_mixing: e.target.value })}
              />
            </Field>
            <Field label="No. Mixer">
              <Input
                value={form.no_mixer}
                maxLength={40}
                onChange={(e) => setForm({ ...form, no_mixer: e.target.value })}
              />
            </Field>
            <Field label="Shift / Regu">
              <Select
                value={form.shift_regu}
                onValueChange={(v) => setForm({ ...form, shift_regu: v })}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SHIFTS.map((s) => (
                    <SelectItem key={s} value={s}>
                      {s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>

            <Field label="Produk">
              <Select value={form.produk} onValueChange={(v) => setForm({ ...form, produk: v })}>
                <SelectTrigger>
                  <SelectValue placeholder="Pilih produk" />
                </SelectTrigger>
                <SelectContent>
                  {(products.data ?? []).map((p) => (
                    <SelectItem key={p.id} value={p.name}>
                      {p.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="No. Urut Batch">
              <Input
                value={form.no_urut_batch}
                maxLength={40}
                onChange={(e) => setForm({ ...form, no_urut_batch: e.target.value })}
              />
            </Field>
            <Field label="Line">
              <Input
                value={form.line}
                maxLength={40}
                onChange={(e) => setForm({ ...form, line: e.target.value })}
              />
            </Field>

            <Field label="Start Mixing">
              <TimePickerDialog
                label="Start Mixing"
                value={form.start_mixing}
                onChange={(v) => setForm({ ...form, start_mixing: v })}
              />
            </Field>
            <Field label="Selesai Mixing">
              <TimePickerDialog
                label="Selesai Mixing"
                value={form.selesai_mixing}
                onChange={(v) => setForm({ ...form, selesai_mixing: v })}
              />
            </Field>
            <Field label="Durasi (menit)">
              <Input
                readOnly
                className="bg-surface-muted font-mono"
                value={formatNumber(minutesBetween(form.start_mixing, form.selesai_mixing), 1)}
              />
            </Field>

          </div>

          {/* Material List */}
          <div className="mt-1 space-y-2">
            <div className="flex items-center justify-between">
              <Label className="label-caps">Daftar Material</Label>
              <Button variant="outline" size="sm" onClick={addMaterial} type="button">
                <Plus className="mr-1 size-3.5" /> Tambah Material
              </Button>
            </div>
            <div className="rounded-md border border-border divide-y divide-border">
              {materials.map((m, idx) => (
                <div key={idx} className="flex items-center gap-3 px-3 py-2.5">
                  <span className="w-5 shrink-0 text-xs font-mono text-muted-foreground text-right">
                    {idx + 1}.
                  </span>
                  <Input
                    placeholder="Nama material"
                    value={m.material}
                    maxLength={120}
                    className="flex-1"
                    onChange={(e) => patchMaterial(idx, { material: e.target.value })}
                  />
                  <Input
                    type="number"
                    step="0.01"
                    placeholder="Quantity"
                    value={m.quantity}
                    className="w-28 shrink-0"
                    onChange={(e) => patchMaterial(idx, { quantity: e.target.value })}
                  />
                  <Button
                    variant="ghost"
                    size="icon"
                    type="button"
                    disabled={materials.length === 1}
                    onClick={() => removeMaterial(idx)}
                    className="shrink-0 text-destructive hover:text-destructive"
                  >
                    <Trash2 className="size-4" />
                  </Button>
                </div>
              ))}
            </div>
            {materials.length > 0 && (
              <p className="text-xs text-muted-foreground text-right">
                Total:{" "}
                <span className="font-mono font-medium">
                  {materials.reduce((s, m) => s + (m.quantity ? Number(m.quantity) : 0), 0).toFixed(2)}
                </span>
              </p>
            )}
          </div>

          <div className="grid gap-4 sm:grid-cols-3">

            <Field label="Operator Premix">
              <Input
                value={form.operator_premix}
                maxLength={100}
                onChange={(e) => setForm({ ...form, operator_premix: e.target.value })}
              />
            </Field>
            <Field label="QAN Raw Material">
              <Input
                value={form.qan_rm}
                maxLength={60}
                onChange={(e) => setForm({ ...form, qan_rm: e.target.value })}
              />
            </Field>
            <Field label="QAN Premix">
              <Input
                value={form.qan_premix}
                maxLength={60}
                onChange={(e) => setForm({ ...form, qan_premix: e.target.value })}
              />
            </Field>
          </div>

          <Field label="Keterangan">
            <Textarea
              rows={3}
              maxLength={1000}
              value={form.keterangan}
              onChange={(e) => setForm({ ...form, keterangan: e.target.value })}
            />
          </Field>


          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => create.mutate()} disabled={create.isPending}>
              {create.isPending ? "Menyimpan..." : "Simpan Checklist"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="space-y-1.5">
      <Label className="label-caps">{label}</Label>
      {children}
    </div>
  );
}
