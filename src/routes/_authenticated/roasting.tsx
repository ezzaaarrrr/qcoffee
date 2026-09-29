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
  fetchProducts,
  fetchRoasting,
  fetchRoastingItems,
  type RoastingItem,
} from "@/lib/queries";
import { SHIFTS, formatDate, formatNumber, minutesBetween, num } from "@/lib/domain";
import { useCurrentUser } from "@/hooks/useAuth";
import { TimePickerDialog } from "@/components/TimePickerDialog";

export const Route = createFileRoute("/_authenticated/roasting")({
  validateSearch: (search: Record<string, unknown>) => ({
    action: (search["action"] as string) || undefined,
  }),
  head: () => ({
    meta: [
      { title: "Proses Roasting" },
      {
        name: "description",
        content:
          "Checklist proses roasting kopi: waktu roasting dan cooling otomatis, suhu, pH, MC, dan waste.",
      },
      { property: "og:title", content: "Proses Roasting" },
      {
        property: "og:description",
        content: "Checklist roasting kopi dengan perhitungan waktu dan waste otomatis.",
      },
    ],
  }),
  component: RoastingPage,
});

type ItemDraft = {
  no_qar_barang: string;
  no_silo_kopi_mentah: string;
  jumlah_mentah_kg: string;
  jumlah_matang_kg: string;
  roasting_start: string;
  roasting_finish: string;
  temp_roasting_c: string;
  cooling_start: string;
  cooling_finish: string;
  temp_cooling_c: string;
  ph: string;
  mc_percent: string;
  qar_roasting: string;
  no_silo_kopi_matang: string;
};

const EMPTY_ITEM: ItemDraft = {
  no_qar_barang: "",
  no_silo_kopi_mentah: "",
  jumlah_mentah_kg: "",
  jumlah_matang_kg: "",
  roasting_start: "",
  roasting_finish: "",
  temp_roasting_c: "",
  cooling_start: "",
  cooling_finish: "",
  temp_cooling_c: "",
  ph: "",
  mc_percent: "",
  qar_roasting: "",
  no_silo_kopi_matang: "",
};

const EMPTY_HEADER = {
  hari_tanggal: new Date().toISOString().slice(0, 10),
  shift_regu: "Shift 1",
  no_roaster: "",
  nama_produk: "",
  keterangan_tambahan: "",
};

function RoastingPage() {
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

  const rows = useQuery({ queryKey: ["roasting"], queryFn: fetchRoasting });
  const products = useQuery({ queryKey: ["products"], queryFn: fetchProducts });
  const detail = useQuery({
    queryKey: ["roasting-items", detailId],
    enabled: !!detailId,
    queryFn: () => fetchRoastingItems(detailId!),
  });

  const create = useMutation({
    mutationFn: async () => {
      if (!user) throw new Error("Sesi tidak valid");
      const { data, error } = await supabase
        .from("form_roasting")
        .insert({
          created_by: user.id,
          dibuat_by: user.id,
          hari_tanggal: header.hari_tanggal,
          shift_regu: header.shift_regu || null,
          no_roaster: header.no_roaster || null,
          nama_produk: header.nama_produk || null,
          keterangan_tambahan: header.keterangan_tambahan || null,
          status: "Pending QC",
        })
        .select("id")
        .single();
      if (error) throw error;

      const payload = items.map((it, idx) => ({
        roasting_id: data.id,
        no_item: idx + 1,
        no_qar_barang: it.no_qar_barang || null,
        no_silo_kopi_mentah: it.no_silo_kopi_mentah || null,
        jumlah_mentah_kg: it.jumlah_mentah_kg ? Number(it.jumlah_mentah_kg) : null,
        jumlah_matang_kg: it.jumlah_matang_kg ? Number(it.jumlah_matang_kg) : null,
        roasting_start: it.roasting_start || null,
        roasting_finish: it.roasting_finish || null,
        waktu_roasting_menit: minutesBetween(it.roasting_start, it.roasting_finish),
        temp_roasting_c: it.temp_roasting_c ? Number(it.temp_roasting_c) : null,
        cooling_start: it.cooling_start || null,
        cooling_finish: it.cooling_finish || null,
        waktu_cooling_menit: minutesBetween(it.cooling_start, it.cooling_finish),
        temp_cooling_c: it.temp_cooling_c ? Number(it.temp_cooling_c) : null,
        waste:
          it.jumlah_mentah_kg && it.jumlah_matang_kg
            ? num(it.jumlah_mentah_kg) - num(it.jumlah_matang_kg)
            : null,
        ph: it.ph ? Number(it.ph) : null,
        mc_percent: it.mc_percent ? Number(it.mc_percent) : null,
        qar_roasting: it.qar_roasting || null,
        no_silo_kopi_matang: it.no_silo_kopi_matang || null,
      }));
      const itemsError = (await supabase.from("form_roasting_items").insert(payload)).error;
      if (itemsError) throw itemsError;
    },
    onSuccess: () => {
      toast.success("Checklist roasting tersimpan");
      setOpen(false);
      setHeader({ ...EMPTY_HEADER });
      setItems([{ ...EMPTY_ITEM }]);
      queryClient.invalidateQueries({ queryKey: ["roasting"] });
    },
    onError: (e: Error) => toast.error("Gagal menyimpan", { description: e.message }),
  });

  const data = rows.data ?? [];
  const patchItem = (idx: number, patch: Partial<ItemDraft>) =>
    setItems((prev) => prev.map((it, i) => (i === idx ? { ...it, ...patch } : it)));

  return (
    <AppShell
      breadcrumb="Proses Roasting"
      actions={
        canCreate ? (
          <Button size="sm" onClick={() => setOpen(true)}>
            <Plus className="mr-1 size-4" /> Checklist Baru
          </Button>
        ) : null
      }
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Checklist Proses Roasting</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Waktu roasting, waktu cooling, dan waste dihitung otomatis dari input operator.
        </p>
      </div>

      <Panel bodyClassName="p-0 overflow-x-auto">
        <table className="w-full min-w-[800px] text-sm">
          <thead>
            <tr className="border-b border-border">
              {["Tanggal", "Shift", "Roaster", "Produk", "Status", ""].map((h) => (
                <th key={h} className="label-caps px-4 py-2 text-left whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.isLoading && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Memuat data...
                </td>
              </tr>
            )}
            {!rows.isLoading && data.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-10 text-center text-muted-foreground">
                  Belum ada checklist roasting.
                </td>
              </tr>
            )}
            {data.map((row) => (
              <tr key={row.id} className="border-b border-border last:border-0 hover:bg-surface-muted">
                <td className="px-4 py-3 font-mono text-xs">{formatDate(row.hari_tanggal)}</td>
                <td className="px-4 py-3">{row.shift_regu || "—"}</td>
                <td className="px-4 py-3">{row.no_roaster || "—"}</td>
                <td className="px-4 py-3 font-medium">{row.nama_produk || "—"}</td>
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

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-h-[92vh] max-w-6xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Checklist Roasting Baru</DialogTitle>
            <DialogDescription>
              Isi header proses lalu tambahkan item roasting per silo/batch.
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
            <Field label="Shift / Regu">
              <Select
                value={header.shift_regu}
                onValueChange={(v) => setHeader({ ...header, shift_regu: v })}
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
            <Field label="No. Roaster">
              <Input
                value={header.no_roaster}
                maxLength={40}
                onChange={(e) => setHeader({ ...header, no_roaster: e.target.value })}
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
          </div>

          <div className="mt-2">
            <div className="mb-2 flex items-center justify-between">
              <h3 className="text-sm font-semibold">Item Roasting</h3>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setItems((p) => [...p, { ...EMPTY_ITEM }])}
              >
                <Plus className="mr-1 size-4" /> Tambah Item
              </Button>
            </div>

            <div className="space-y-4">
              {items.map((it, idx) => {
                const waste =
                  it.jumlah_mentah_kg && it.jumlah_matang_kg
                    ? num(it.jumlah_mentah_kg) - num(it.jumlah_matang_kg)
                    : null;
                const wastePct =
                  waste !== null && num(it.jumlah_mentah_kg) > 0
                    ? (waste / num(it.jumlah_mentah_kg)) * 100
                    : null;
                return (
                  <div key={idx} className="border border-border bg-surface-muted/40 p-4">
                    <div className="mb-3 flex items-center justify-between">
                      <span className="label-caps">Item #{idx + 1}</span>
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
                    <div className="grid gap-3 md:grid-cols-4 xl:grid-cols-6">
                      <Field label="No. QAR Barang">
                        <Input
                          value={it.no_qar_barang}
                          maxLength={60}
                          onChange={(e) => patchItem(idx, { no_qar_barang: e.target.value })}
                        />
                      </Field>
                      <Field label="Silo Kopi Mentah">
                        <Input
                          value={it.no_silo_kopi_mentah}
                          maxLength={40}
                          onChange={(e) => patchItem(idx, { no_silo_kopi_mentah: e.target.value })}
                        />
                      </Field>
                      <Field label="Mentah (kg)">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.jumlah_mentah_kg}
                          onChange={(e) => patchItem(idx, { jumlah_mentah_kg: e.target.value })}
                        />
                      </Field>
                      <Field label="Matang (kg)">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.jumlah_matang_kg}
                          onChange={(e) => patchItem(idx, { jumlah_matang_kg: e.target.value })}
                        />
                      </Field>
                      <Field label="Waste (kg)">
                        <Input readOnly className="bg-surface font-mono" value={formatNumber(waste, 2)} />
                      </Field>
                      <Field label="Waste (%)">
                        <Input
                          readOnly
                          className="bg-surface font-mono"
                          value={formatNumber(wastePct, 2)}
                        />
                      </Field>

                      <Field label="Roasting Start">
                        <TimePickerDialog
                          label="Roasting Start"
                          value={it.roasting_start}
                          onChange={(v) => patchItem(idx, { roasting_start: v })}
                        />
                      </Field>
                      <Field label="Roasting Finish">
                        <TimePickerDialog
                          label="Roasting Finish"
                          value={it.roasting_finish}
                          onChange={(v) => patchItem(idx, { roasting_finish: v })}
                        />
                      </Field>
                      <Field label="Waktu Roasting (mnt)">
                        <Input
                          readOnly
                          className="bg-surface font-mono"
                          value={formatNumber(minutesBetween(it.roasting_start, it.roasting_finish), 0)}
                        />
                      </Field>
                      <Field label="Temp Roasting (°C)">
                        <Input
                          type="number"
                          step="0.1"
                          value={it.temp_roasting_c}
                          onChange={(e) => patchItem(idx, { temp_roasting_c: e.target.value })}
                        />
                      </Field>
                      <Field label="Cooling Start">
                        <TimePickerDialog
                          label="Cooling Start"
                          value={it.cooling_start}
                          onChange={(v) => patchItem(idx, { cooling_start: v })}
                        />
                      </Field>
                      <Field label="Cooling Finish">
                        <TimePickerDialog
                          label="Cooling Finish"
                          value={it.cooling_finish}
                          onChange={(v) => patchItem(idx, { cooling_finish: v })}
                        />
                      </Field>
                      <Field label="Waktu Cooling (mnt)">
                        <Input
                          readOnly
                          className="bg-surface font-mono"
                          value={formatNumber(minutesBetween(it.cooling_start, it.cooling_finish), 0)}
                        />
                      </Field>
                      <Field label="Temp Cooling (°C)">
                        <Input
                          type="number"
                          step="0.1"
                          value={it.temp_cooling_c}
                          onChange={(e) => patchItem(idx, { temp_cooling_c: e.target.value })}
                        />
                      </Field>
                      <Field label="pH">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.ph}
                          onChange={(e) => patchItem(idx, { ph: e.target.value })}
                        />
                      </Field>
                      <Field label="MC (%)">
                        <Input
                          type="number"
                          step="0.01"
                          value={it.mc_percent}
                          onChange={(e) => patchItem(idx, { mc_percent: e.target.value })}
                        />
                      </Field>
                      <Field label="QAR Roasting">
                        <Input
                          value={it.qar_roasting}
                          maxLength={60}
                          onChange={(e) => patchItem(idx, { qar_roasting: e.target.value })}
                        />
                      </Field>
                      <Field label="Silo Kopi Matang">
                        <Input
                          value={it.no_silo_kopi_matang}
                          maxLength={40}
                          onChange={(e) => patchItem(idx, { no_silo_kopi_matang: e.target.value })}
                        />
                      </Field>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <Field label="Keterangan Tambahan">
            <Textarea
              rows={3}
              maxLength={1000}
              value={header.keterangan_tambahan}
              onChange={(e) => setHeader({ ...header, keterangan_tambahan: e.target.value })}
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

      <Dialog open={!!detailId} onOpenChange={(v) => !v && setDetailId(null)}>
        <DialogContent className="max-h-[90vh] max-w-5xl overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Detail Item Roasting</DialogTitle>
            <DialogDescription>Rincian batch roasting dan cooling.</DialogDescription>
          </DialogHeader>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-border">
                  {[
                    "#",
                    "Mentah",
                    "Matang",
                    "Waste",
                    "Roast (mnt)",
                    "Temp R",
                    "Cool (mnt)",
                    "Temp C",
                    "pH",
                    "MC%",
                  ].map((h) => (
                    <th key={h} className="label-caps px-3 py-2 text-left">
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {(detail.data ?? []).map((it: RoastingItem) => (
                  <tr key={it.id} className="border-b border-border last:border-0">
                    <td className="px-3 py-2 font-mono">{it.no_item}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.jumlah_mentah_kg, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.jumlah_matang_kg, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.waste, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.waktu_roasting_menit, 0)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.temp_roasting_c, 1)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.waktu_cooling_menit, 0)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.temp_cooling_c, 1)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.ph, 2)}</td>
                    <td className="px-3 py-2 font-mono">{formatNumber(it.mc_percent, 2)}</td>
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
