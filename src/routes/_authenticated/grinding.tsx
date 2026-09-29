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
import {
  fetchGrinding,
  fetchGrindingItems,
  fetchProducts,
  type GrindingItem,
  type GrindingRow,
} from "@/lib/queries";
import { SHIFTS, formatDate, formatNumber, hoursBetween, num, organoleptikSesuai } from "@/lib/domain";
import { useCurrentUser } from "@/hooks/useAuth";
import { TimePickerDialog } from "@/components/TimePickerDialog";

export const Route = createFileRoute("/_authenticated/grinding")({
  validateSearch: (search: Record<string, unknown>) => ({
    action: (search["action"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Proses Grinding" },
      {
        name: "description",
        content:
          "Checklist proses grinding kopi: kehalusan, density, pH, moisture, dan perhitungan waste otomatis.",
      },
      { property: "og:title", content: "Proses Grinding" },
      {
        property: "og:description",
        content: "Checklist proses grinding kopi dengan perhitungan waste otomatis.",
      },
    ],
  }),
  component: GrindingPage,
});

type ItemDraft = {
  start_time: string;
  finish_time: string;
  qty_roasting: string;
  total_qty: string;
  qty_grinding: string;
  aktual_qty: string;
  kehalusan_mesin: string;
  density: string;
  aroma: string;
  ph: string;
  moisture_mc: string;
  station: string;
  keterangan: string;
};

const EMPTY_ITEM: ItemDraft = {
  start_time: "",
  finish_time: "",
  qty_roasting: "",
  total_qty: "",
  qty_grinding: "",
  aktual_qty: "",
  kehalusan_mesin: "",
  density: "",
  aroma: "Normal",
  ph: "",
  moisture_mc: "",
  station: "",
  keterangan: "",
};

const EMPTY_HEADER = {
  hari_tanggal: new Date().toISOString().slice(0, 10),
  shift: "Shift 1",
  no_grinder: "",
  nama_produk: "",
  no_batch: "",
  no_urut_batch: "",
  raw_material: "",
  keterangan_petunjuk: "",
};

function GrindingPage() {
  const search = Route.useSearch();
  const { user, canCreate } = useCurrentUser();
  const queryClient = useQueryClient();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (search.action === "new" && canCreate) {
      setOpen(true);
    }
  }, [search.action, canCreate]);
  const [header, setHeader] = useState({ ...EMPTY_HEADER });
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [detailId, setDetailId] = useState<string | null>(null);

  const rows = useQuery({ queryKey: ["grinding"], queryFn: fetchGrinding });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const detail = useQuery({
    queryKey: ["grinding-items", detailId],
    enabled: !!detailId,
    queryFn: () => fetchGrindingItems(detailId!),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi tidak valid");
      if (!header.hari_tanggal) throw new Error("Tanggal wajib diisi");
      const { data, error } = await supabase
        .from("form_grinding")
        .insert({
          created_by: user.id,
          dibuat_by: user.id,
          hari_tanggal: header.hari_tanggal,
          shift: header.shift as "Shift 1" | "Shift 2" | "Shift 3",
          no_grinder: header.no_grinder || null,
          nama_produk: header.nama_produk || null,
          no_batch: header.no_batch || null,
          no_urut_batch: header.no_urut_batch || null,
          raw_material: header.raw_material || null,
          keterangan_petunjuk: header.keterangan_petunjuk || null,
          status: "Pending QC",
        })
        .select("id")
        .single();
      if (error) throw error;

      const payload = items.map((it, idx) => ({
        grinding_id: data.id,
        urutan: idx + 1,
        start_time: it.start_time || null,
        finish_time: it.finish_time || null,
        jam_kerja: hoursBetween(it.start_time, it.finish_time),
        qty_roasting: it.qty_roasting ? Number(it.qty_roasting) : null,
        total_qty: it.total_qty ? Number(it.total_qty) : null,
        qty_grinding: it.qty_grinding ? Number(it.qty_grinding) : null,
        aktual_qty: it.aktual_qty ? Number(it.aktual_qty) : null,
        waste: it.total_qty && it.aktual_qty ? num(it.total_qty) - num(it.aktual_qty) : null,
        kehalusan_mesin: it.kehalusan_mesin || null,
        density: it.density ? Number(it.density) : null,
        aroma: it.aroma || null,
        ph: it.ph ? Number(it.ph) : null,
        moisture_mc: it.moisture_mc ? Number(it.moisture_mc) : null,
        station: it.station || null,
        keterangan: it.keterangan || null,
      }));
      const itemsError = (await supabase.from("form_grinding_items").insert(payload)).error;
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Checklist grinding tersimpan");
      setOpen(false);
      setHeader({ ...EMPTY_HEADER });
      setItems([{ ...EMPTY_ITEM }]);
      queryClient.invalidateQueries({ queryKey: ["grinding"] });
    },
    onError: (e: Error) => toast.error("Gagal menyimpan", { description: e.message }),
  });

  const data = rows.data ?? [];

  const patchItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <AppShell
      breadcrumb="Proses Grinding"
      actions={
        canCreate ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-4" /> Checklist Baru
          </Button>
        ) : null
      }
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Checklist Proses Grinding</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Setiap checklist berisi beberapa baris proses dengan uji organoleptik dan waste otomatis.
        </p>
      </div>

      <Panel bodyClassName="p-0 overflow-x-auto">
        <table className="w-full min-w-[900px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Tanggal", "Shift", "Grinder", "Produk", "No. Batch", "Raw Material", "Status", ""].map(
                (h) => (
                  <th key={h} className="label-caps px-4 py-2 text-left whitespace-nowrap">
                    {h}
                  </th>
                ),
              )}
            </tr>
          </thead>
          <tbody>
            {rows.isLoading && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Memuat data...
                </td>
              </tr>
            )}
            {!rows.isLoading && data.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-10 text-center text-muted-foreground">
                  Belum ada checklist grinding.
                </td>
              </tr>
            )}
            {data.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-mono text-xs">{formatDate(row.hari_tanggal)}</td>
                <td className="px-4 py-3">{row.shift}</td>
                <td className="px-4 py-3">{row.no_grinder || "—"}</td>
                <td className="px-4 py-3 font-medium">{row.nama_produk || "—"}</td>
                <td className="px-4 py-3 font-mono text-xs">{row.no_batch || "—"}</td>
                <td className="px-4 py-3">{row.raw_material || "—"}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={row.status} />
                </td>
                <td className="px-4 py-3 text-right">
                  <Button variant="ghost" size="sm" onClick={() => setDetailId(row.id)}>
                    Lihat item
                  </Button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </Panel>

      {/* Create dialog */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist Grinding Baru</DialogTitle>
            <DialogDescription>
              Jam kerja dan waste dihitung otomatis dari waktu dan quantity.
            </DialogDescription>
          </DialogHeader>

          <div className="grid gap-4 sm:grid-cols-4">
            <Field label="Hari / Tanggal">
              <Input
                type="date"
                value={header.hari_tanggal}
                onChange={(e) => setHeader({ ...header, hari_tanggal: e.target.value })}
              />
            </Field>
            <Field label="Shift">
              <Select value={header.shift} onValueChange={(v) => setHeader({ ...header, shift: v })}>
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
            <Field label="No. Grinder">
              <Input
                value={header.no_grinder}
                maxLength={40}
                onChange={(e) => setHeader({ ...header, no_grinder: e.target.value })}
              />
            </Field>
            <Field label="Nama Produk">
              <Select
                value={header.nama_produk}
                onValueChange={(v) => setHeader({ ...header, nama_produk: v })}
              >
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
            <Field label="No. Batch">
              <Input
                value={header.no_batch}
                maxLength={40}
                onChange={(e) => setHeader({ ...header, no_batch: e.target.value })}
              />
            </Field>
            <Field label="No. Urut Batch">
              <Input
                value={header.no_urut_batch}
                maxLength={40}
                onChange={(e) => setHeader({ ...header, no_urut_batch: e.target.value })}
              />
            </Field>
            <Field label="Raw Material">
              <Input
                value={header.raw_material}
                maxLength={120}
                onChange={(e) => setHeader({ ...header, raw_material: e.target.value })}
              />
            </Field>
          </div>

          <div className="mt-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Item Proses</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems((p) => [...p, { ...EMPTY_ITEM }])}
              >
                <Plus className="mr-1 size-4" /> Tambah Baris
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((it, idx) => {
                const waste =
                  it.total_qty && it.aktual_qty ? num(it.total_qty) - num(it.aktual_qty) : null;
                const ok = organoleptikSesuai({
                  aroma: it.aroma,
                  ph: it.ph ? Number(it.ph) : null,
                  moisture_mc: it.moisture_mc ? Number(it.moisture_mc) : null,
                });
                return (
                  <div key={idx} className="border border-border bg-surface-muted/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="label-caps">Baris #{idx + 1}</span>
                      <div className="flex items-center gap-3">
                        <span
                          className={`text-[10px] font-bold uppercase ${ok ? "text-success" : "text-destructive"}`}
                        >
                          {ok ? "Organoleptik sesuai" : "Di luar standar"}
                        </span>
                        {items.length > 1 && (
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setItems((p) => p.filter((_, i) => i !== idx))}
                          >
                            <Trash2 className="size-4 text-destructive" />
                          </Button>
                        )}
                      </div>
                    </div>
                    <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
                      <Field label="Start">
                        <TimePickerDialog
                          label="Waktu Start"
                          value={it.start_time}
                          onChange={(v) => patchItem(idx, { start_time: v })}
                        />
                      </Field>
                      <Field label="Finish">
                        <TimePickerDialog
                          label="Waktu Finish"
                          value={it.finish_time}
                          onChange={(v) => patchItem(idx, { finish_time: v })}
                        />
                      </Field>
                      <Field label="Jam Kerja">
                        <Input
                          readOnly
                          className="bg-surface font-mono"
                          value={formatNumber(hoursBetween(it.start_time, it.finish_time), 2)}
                        />
                      </Field>
                      <Field label="Qty Roasting">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.qty_roasting}
                          onChange={(e) => patchItem(idx, { qty_roasting: e.target.value })}
                        />
                      </Field>
                      <Field label="Total Qty">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.total_qty}
                          onChange={(e) => patchItem(idx, { total_qty: e.target.value })}
                        />
                      </Field>
                      <Field label="Qty Grinding">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.qty_grinding}
                          onChange={(e) => patchItem(idx, { qty_grinding: e.target.value })}
                        />
                      </Field>
                      <Field label="Aktual Qty">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.aktual_qty}
                          onChange={(e) => patchItem(idx, { aktual_qty: e.target.value })}
                        />
                      </Field>
                      <Field label="Waste (kg)">
                        <Input readOnly className="bg-surface font-mono" value={formatNumber(waste, 2)} />
                      </Field>
                      <Field label="Kehalusan Mesin">
                        <Input
                          value={it.kehalusan_mesin}
                          maxLength={60}
                          onChange={(e) => patchItem(idx, { kehalusan_mesin: e.target.value })}
                        />
                      </Field>
                      <Field label="Density">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.density}
                          onChange={(e) => patchItem(idx, { density: e.target.value })}
                        />
                      </Field>
                      <Field label="Aroma">
                        <Select value={it.aroma} onValueChange={(v) => patchItem(idx, { aroma: v })}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="Normal">Normal</SelectItem>
                            <SelectItem value="Khas Kopi">Khas Kopi</SelectItem>
                            <SelectItem value="Menyimpang">Menyimpang</SelectItem>
                          </SelectContent>
                        </Select>
                      </Field>
                      <Field label="pH (4.8–5.6)">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.ph}
                          onChange={(e) => patchItem(idx, { ph: e.target.value })}
                        />
                      </Field>
                      <Field label="MC (%) ≤ 5">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.moisture_mc}
                          onChange={(e) => patchItem(idx, { moisture_mc: e.target.value })}
                        />
                      </Field>
                      <Field label="Station">
                        <Input
                          value={it.station}
                          maxLength={40}
                          onChange={(e) => patchItem(idx, { station: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Field label="Keterangan / Petunjuk">
            <Textarea
              rows={3}
              maxLength={1000}
              value={header.keterangan_petunjuk}
              onChange={(e) => setHeader({ ...header, keterangan_petunjuk: e.target.value })}
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

      {/* Detail dialog */}
      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Item Grinding</DialogTitle>
            <DialogDescription>Rincian setiap baris proses pada checklist ini.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  {["#", "Start", "Finish", "Jam", "Total Qty", "Aktual", "Waste", "Density", "pH", "MC%"].map(
                    (h) => (
                      <th key={h} className="label-caps px-3 py-2 text-left">
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {(detail.data ?? []).map((it: GrindingItem) => (
                  <tr key={it.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono">{it.urutan}</td>
                    <td className="px-3 py-2 font-mono">{it.start_time || "—"}</td>
                    <td className="px-3 py-2 font-mono">{it.finish_time || "—"}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.jam_kerja, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.total_qty, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.aktual_qty, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.waste, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.density, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.ph, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.moisture_mc, 2)}</td>
                  </tr>
                ))}
                {detail.data?.length === 0 && (
                  <tr>
                    <td colSpan={10} className="px-3 py-8 text-center text-muted-foreground">
                      Tidak ada item.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
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
