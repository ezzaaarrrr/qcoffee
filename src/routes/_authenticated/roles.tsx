import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, Shield, Lock } from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
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
import { supabase } from "@/integrations/supabase/client";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({
    meta: [
      { title: "Hak Akses & Departemen — Q-Coffee M2" },
      {
        name: "description",
        content: "Kelola master data departemen dan atur matriks hak akses halaman untuk setiap peran (role).",
      },
    ],
  }),
  component: RolesAndDepartmentsPage,
});

type DepartmentRow = {
  id: string;
  name: string;
  code: string | null;
  description: string | null;
};

type AppRouteItem = {
  path: string;
  label: string;
  category: "Operasional" | "Manajemen";
};

const SYSTEM_ROUTES: AppRouteItem[] = [
  { path: "/dashboard", label: "Dashboard OBS Sparepart", category: "Operasional" },
  { path: "/checklists", label: "Dashboard Checklist", category: "Operasional" },
  { path: "/formulasi", label: "Formulasi Mixing", category: "Operasional" },
  { path: "/grinding", label: "Proses Grinding", category: "Operasional" },
  { path: "/roasting", label: "Proses Roasting", category: "Operasional" },
  { path: "/approvals", label: "Approval Center", category: "Manajemen" },
  { path: "/products", label: "Gudang & Master Barang", category: "Manajemen" },
  { path: "/profile", label: "Pengaturan Akun", category: "Manajemen" },
  { path: "/settings", label: "Manajemen User", category: "Manajemen" },
  { path: "/roles", label: "Hak Akses & Departemen", category: "Manajemen" },
];

function RolesAndDepartmentsPage() {
  const { isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();

  // Modal Tambah Departemen
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");

  // Modal Edit Departemen
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Modal Hapus Departemen
  const [deletingDept, setDeletingDept] = useState<DepartmentRow | null>(null);

  // Active Role tab untuk Pengaturan Hak Akses
  const [selectedRole, setSelectedRole] = useState<AppRole>("admin_process");

  // Query Data Departemen
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("departments").select("*").order("name");
      if (error) {
        return [
          { id: "1", name: "Departemen Countinous Improvment", code: "CI", description: "Departemen Countinous Improvment" },
          { id: "2", name: "Departemen Produksi Cheking", code: "Produksi CK", description: "Operator Admin Ceklis" },
          { id: "3", name: "Department Warehouse - Sparepart", code: "WH-SP", description: "Admin Gudang & Operasional Sparepart" },
          { id: "4", name: "Super Admin", code: "SA", description: "Super Admin System" },
        ] as DepartmentRow[];
      }
      return (data ?? []) as DepartmentRow[];
    },
  });

  // Query Matriks Permissions
  const permissionsQuery = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("role_permissions").select("*");
      if (error) {
        // Fallback default jika tabel belum disinkronkan di Supabase remote
        const defaults: Record<string, boolean> = {};
        (Object.keys(ROLE_LABELS) as AppRole[]).forEach((role) => {
          SYSTEM_ROUTES.forEach((route) => {
            if (role === "admin" || role === "qc_field") {
              defaults[`${role}:${route.path}`] = true;
            } else {
              defaults[`${role}:${route.path}`] = route.path === "/approvals";
            }
          });
        });
        return defaults;
      }

      const map: Record<string, boolean> = {};
      (data ?? []).forEach((item: any) => {
        map[`${item.role}:${item.route_path}`] = item.can_access;
      });
      return map;
    },
  });

  // Toggle Hak Akses Route untuk Role
  const togglePermission = useMutation({
    mutationFn: async ({ role, routePath, canAccess }: { role: AppRole; routePath: string; canAccess: boolean }) => {
      const { error } = await (supabase as any)
        .from("role_permissions")
        .upsert(
          { role, route_path: routePath, can_access: canAccess },
          { onConflict: "role,route_path" }
        );
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Hak akses halaman berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
    },
    onError: (e: Error) => toast.error("Gagal memperbarui hak akses", { description: e.message }),
  });

  // ── DEPARTEMEN MUTATIONS ──────────────────────────────────────────────────
  const addDept = useMutation({
    mutationFn: async () => {
      if (deptName.trim().length < 2) throw new Error("Nama departemen minimal 2 karakter");
      const { error } = await (supabase as any).from("departments").insert({
        name: deptName.trim(),
        code: deptCode.trim() || null,
        description: deptDesc.trim() || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Departemen berhasil ditambahkan");
      setDeptName("");
      setDeptCode("");
      setDeptDesc("");
      setIsAddOpen(false);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error("Gagal menambahkan departemen", { description: e.message }),
  });

  const updateDept = useMutation({
    mutationFn: async () => {
      if (!editingDept) return;
      if (editName.trim().length < 2) throw new Error("Nama departemen minimal 2 karakter");
      const { error } = await (supabase as any)
        .from("departments")
        .update({
          name: editName.trim(),
          code: editCode.trim() || null,
          description: editDesc.trim() || null,
        })
        .eq("id", editingDept.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Departemen berhasil diperbarui");
      setEditingDept(null);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error("Gagal memperbarui departemen", { description: e.message }),
  });

  const deleteDept = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await (supabase as any).from("departments").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Departemen berhasil dihapus");
      setDeletingDept(null);
      queryClient.invalidateQueries({ queryKey: ["departments"] });
    },
    onError: (e: Error) => toast.error("Gagal menghapus departemen", { description: e.message }),
  });

  const openEditModal = (d: DepartmentRow) => {
    setEditingDept(d);
    setEditName(d.name);
    setEditCode(d.code || "");
    setEditDesc(d.description || "");
  };

  const isAccessAllowed = (role: AppRole, path: string) => {
    const key = `${role}:${path}`;
    if (permissionsQuery.data && key in permissionsQuery.data) {
      return permissionsQuery.data[key];
    }
    // Rules:
    // CI (qc_field) & Super Admin (admin) -> Bisa mengakses semua halaman
    // Operator (admin_process & prod_process_uh) -> Hanya bisa mengakses halaman /approvals
    if (role === "admin" || role === "qc_field") return true;
    return path === "/approvals";
  };

  return (
    <AppShell breadcrumb="Hak Akses & Departemen">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hak Akses & Departemen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola matriks hak akses halaman untuk setiap peran (role) serta master data departemen.
          </p>
        </div>
        <Button onClick={() => setIsAddOpen(true)} size="sm" className="gap-1.5 shrink-0">
          <Plus className="size-4" />
          Tambah Departemen
        </Button>
      </div>

      <div className="space-y-6">
        {/* PANEL 1: Pengaturan Hak Akses per Role */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <span>Matriks Hak Akses Halaman per Role</span>
            </div>
          }
        >
          {/* Tabs Pilihan Role */}
          <div className="flex flex-wrap gap-2 border-b border-border pb-4 mb-4">
            {(Object.keys(ROLE_LABELS) as AppRole[]).map((roleKey) => (
              <Button
                key={roleKey}
                variant={selectedRole === roleKey ? "default" : "outline"}
                size="sm"
                onClick={() => setSelectedRole(roleKey)}
                className="text-xs"
              >
                <Shield className="mr-1.5 size-3.5" />
                {ROLE_LABELS[roleKey]}
              </Button>
            ))}
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h3 className="text-sm font-semibold">
                  Izin Akses Halaman — {ROLE_LABELS[selectedRole]}
                </h3>
                <p className="text-xs text-muted-foreground">
                  Aktifkan (Izinkan/Muncul) atau nonaktifkan (Tolak/Hilang) halaman yang boleh diakses oleh akun bertipe {ROLE_LABELS[selectedRole]}.
                </p>
              </div>
            </div>

            <div className="space-y-6">
              {/* Grup Kategori: Operasional */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="label-caps font-semibold text-primary">Kategori Operasional</span>
                  <span className="text-xs text-muted-foreground">
                    ({SYSTEM_ROUTES.filter((r) => r.category === "Operasional").length} Halaman)
                  </span>
                </div>
                <div className="border border-border rounded-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/50">
                        <th className="label-caps px-4 py-2.5 text-left">Nama Halaman</th>
                        <th className="label-caps px-4 py-2.5 text-left">URL Route</th>
                        <th className="label-caps px-4 py-2.5 text-right">Status Hak Akses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {SYSTEM_ROUTES.filter((r) => r.category === "Operasional").map((route) => {
                        const allowed = isAccessAllowed(selectedRole, route.path);
                        return (
                          <tr key={route.path} className="hover:bg-surface-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{route.label}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{route.path}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end items-center gap-3">
                                <span
                                  className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full",
                                    allowed
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  )}
                                >
                                  {allowed ? "Diizinkan (Muncul)" : "Ditolak (Hilang)"}
                                </span>
                                <Switch
                                  checked={Boolean(allowed)}
                                  disabled={!isAdmin || togglePermission.isPending || selectedRole === "admin"}
                                  onCheckedChange={(checked) =>
                                    togglePermission.mutate({
                                      role: selectedRole,
                                      routePath: route.path,
                                      canAccess: checked,
                                    })
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>

              {/* Grup Kategori: Manajemen */}
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <span className="label-caps font-semibold text-primary">Kategori Manajemen</span>
                  <span className="text-xs text-muted-foreground">
                    ({SYSTEM_ROUTES.filter((r) => r.category === "Manajemen").length} Halaman)
                  </span>
                </div>
                <div className="border border-border rounded-sm overflow-hidden">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-surface-muted/50">
                        <th className="label-caps px-4 py-2.5 text-left">Nama Halaman</th>
                        <th className="label-caps px-4 py-2.5 text-left">URL Route</th>
                        <th className="label-caps px-4 py-2.5 text-right">Status Hak Akses</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {SYSTEM_ROUTES.filter((r) => r.category === "Manajemen").map((route) => {
                        const allowed = isAccessAllowed(selectedRole, route.path);
                        return (
                          <tr key={route.path} className="hover:bg-surface-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{route.label}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{route.path}</td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end items-center gap-3">
                                <span
                                  className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full",
                                    allowed
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20"
                                  )}
                                >
                                  {allowed ? "Diizinkan (Muncul)" : "Ditolak (Hilang)"}
                                </span>
                                <Switch
                                  checked={Boolean(allowed)}
                                  disabled={!isAdmin || togglePermission.isPending || selectedRole === "admin"}
                                  onCheckedChange={(checked) =>
                                    togglePermission.mutate({
                                      role: selectedRole,
                                      routePath: route.path,
                                      canAccess: checked,
                                    })
                                  }
                                />
                              </div>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            </div>
          </div>
        </Panel>

        {/* PANEL 2: CRUD Master Departemen */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <Building2 className="size-4 text-primary" />
              <span>Master Data Departemen</span>
            </div>
          }
          bodyClassName="p-0"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                {["Nama Departemen", "Kode", "Keterangan", ""].map((h, i) => (
                  <th key={i} className="label-caps px-4 py-3 text-left">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {(departments.data ?? []).map((d) => (
                <tr key={d.id} className="group hover:bg-surface-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium">{d.name}</td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.code || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{d.description || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => openEditModal(d)}
                        title="Edit Departemen"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                        onClick={() => setDeletingDept(d)}
                        title="Hapus Departemen"
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </Panel>
      </div>

      {/* MODAL DIALOG: TAMBAH DEPARTEMEN */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Tambah Departemen Baru</DialogTitle>
            <DialogDescription>Masukkan informasi data departemen baru.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">Nama Departemen</Label>
              <Input
                id="dept-name"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="cth. Quality Assurance"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-code">Kode Departemen</Label>
              <Input
                id="dept-code"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                placeholder="cth. QA"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-desc">Keterangan / Deskripsi</Label>
              <Input
                id="dept-desc"
                value={deptDesc}
                onChange={(e) => setDeptDesc(e.target.value)}
                placeholder="cth. Penjaminan mutu produk"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button onClick={() => addDept.mutate()} disabled={addDept.isPending || !deptName.trim()}>
              {addDept.isPending ? "Menyimpan..." : "Simpan Departemen"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DIALOG: EDIT DEPARTEMEN */}
      <Dialog open={!!editingDept} onOpenChange={(open) => !open && setEditingDept(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Edit Departemen</DialogTitle>
            <DialogDescription>Perbarui informasi data departemen.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept-name">Nama Departemen</Label>
              <Input
                id="edit-dept-name"
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
                placeholder="Nama departemen"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept-code">Kode Departemen</Label>
              <Input
                id="edit-dept-code"
                value={editCode}
                onChange={(e) => setEditCode(e.target.value)}
                placeholder="Kode departemen"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="edit-dept-desc">Keterangan / Deskripsi</Label>
              <Input
                id="edit-dept-desc"
                value={editDesc}
                onChange={(e) => setEditDesc(e.target.value)}
                placeholder="Keterangan"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingDept(null)}>
              Batal
            </Button>
            <Button onClick={() => updateDept.mutate()} disabled={updateDept.isPending || !editName.trim()}>
              {updateDept.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* MODAL DIALOG: HAPUS DEPARTEMEN */}
      <AlertDialog open={!!deletingDept} onOpenChange={(open) => !open && setDeletingDept(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Departemen?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus departemen <strong>&ldquo;{deletingDept?.name}&rdquo;</strong>?
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingDept && deleteDept.mutate(deletingDept.id)}
            >
              Ya, Hapus
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
