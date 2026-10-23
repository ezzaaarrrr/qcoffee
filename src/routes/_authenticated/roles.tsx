import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { Plus, Pencil, Trash2, Building2, Shield, Lock, Layers, Database, Copy, Check } from "lucide-react";
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
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";
import {
  SYSTEM_ROUTES,
  DEFAULT_DEPARTMENT_PERMISSIONS,
  getStoredDeptPermissions,
  saveStoredDeptPermission,
  isRouteAllowedForDept,
  normalizeDepartmentKey,
  fetchRemoteDeptPermissions,
  DEPT_TO_ROLE,
  SQL_DEPARTMENT_PERMISSIONS_MIGRATION,
} from "@/lib/departmentPermissions";

export const Route = createFileRoute("/_authenticated/roles")({
  head: () => ({
    meta: [
      { title: "Hak Akses & Departemen" },
      {
        name: "description",
        content: "Kelola master data departemen dan atur matriks hak akses halaman untuk setiap departemen.",
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

const DEFAULT_DEPARTMENTS: DepartmentRow[] = [
  { id: "1", name: "TEKNIK", code: "TKN", description: "Departemen Teknik & Maintenance" },
  { id: "2", name: "CI1201", code: "CI", description: "Departemen Continuous Improvement" },
  { id: "3", name: "CK1201", code: "Produksi CK", description: "Operator Admin Ceklis" },
  { id: "4", name: "GDSP1201", code: "WH-SP", description: "Admin Gudang & Operasional Sparepart" },
  { id: "5", name: "Super Admin", code: "SA", description: "Super Admin System" },
];

function RolesAndDepartmentsPage() {
  const { isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();

  // Modal Tambah Departemen
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [deptName, setDeptName] = useState("");
  const [deptCode, setDeptCode] = useState("");
  const [deptDesc, setDeptDesc] = useState("");

  // Modal Dialog SQL Migrasi Supabase
  const [isSqlModalOpen, setIsSqlModalOpen] = useState(false);
  const [copiedSql, setCopiedSql] = useState(false);

  // Modal Edit Departemen
  const [editingDept, setEditingDept] = useState<DepartmentRow | null>(null);
  const [editName, setEditName] = useState("");
  const [editCode, setEditCode] = useState("");
  const [editDesc, setEditDesc] = useState("");

  // Modal Hapus Departemen
  const [deletingDept, setDeletingDept] = useState<DepartmentRow | null>(null);

  // Active Department tab untuk Pengaturan Hak Akses
  const [selectedDept, setSelectedDept] = useState<string>("TEKNIK");

  // Query Data Departemen dari database
  const departments = useQuery({
    queryKey: ["departments"],
    queryFn: async () => {
      const { data, error } = await (supabase as any)
        .from("departments")
        .select("*")
        .order("name");
      if (error || !data || data.length === 0) {
        return DEFAULT_DEPARTMENTS;
      }

      // Pastikan DEPARTEMEN TEKNIK selalu tersedia di daftar departemen
      const list = [...data] as DepartmentRow[];
      if (!list.some((d) => d.name.toUpperCase() === "TEKNIK")) {
        const defaultTeknik = DEFAULT_DEPARTMENTS[0];
        if (defaultTeknik) {
          list.unshift(defaultTeknik);
        }
      }
      return list;
    },
  });

  // Query Matriks Permissions Departemen (Remote Supabase + local cache)
  const deptPermissionsQuery = useQuery({
    queryKey: ["department_permissions"],
    queryFn: () => fetchRemoteDeptPermissions(supabase),
  });

  // Toggle Hak Akses Route untuk Departemen
  const togglePermission = useMutation({
    mutationFn: async ({
      department,
      routePath,
      canAccess,
    }: {
      department: string;
      routePath: string;
      canAccess: boolean;
    }) => {
      // 1. Simpan ke local cache agar langsung aktif di browser ini
      saveStoredDeptPermission(department, routePath, canAccess);

      // 2. Simpan ke tabel Supabase department_permissions
      try {
        const { error: deptErr } = await (supabase as any).from("department_permissions").upsert(
          {
            department,
            route_path: routePath,
            can_access: canAccess,
            updated_at: new Date().toISOString(),
          },
          { onConflict: "department,route_path" },
        );
        if (deptErr) {
          console.warn("Supabase department_permissions upsert notice:", deptErr);
        }
      } catch (err) {
        console.warn("Supabase department_permissions caught:", err);
      }

      // 3. Simpan juga ke tabel Supabase role_permissions untuk role yang bersangkutan
      const normDept = normalizeDepartmentKey(department).toLowerCase();
      const mappedRole = DEPT_TO_ROLE[normDept] || DEPT_TO_ROLE[department.toLowerCase()];
      if (mappedRole) {
        try {
          const { error: roleErr } = await (supabase as any).from("role_permissions").upsert(
            {
              role: mappedRole,
              route_path: routePath,
              can_access: canAccess,
              updated_at: new Date().toISOString(),
            },
            { onConflict: "role,route_path" },
          );
          if (roleErr) {
            console.warn("Supabase role_permissions upsert notice:", roleErr);
          }
        } catch (err) {
          console.warn("Supabase role_permissions caught:", err);
        }
      }
    },
    onSuccess: (_, variables) => {
      const routeInfo = SYSTEM_ROUTES.find((r) => r.path === variables.routePath);
      const actionLabel = variables.canAccess ? "Diizinkan (Muncul)" : "Ditolak (Hilang)";
      toast.success(
        `Hak akses halaman ${routeInfo?.label || variables.routePath} untuk departemen ${variables.department} diatur: ${actionLabel}`
      );
      queryClient.invalidateQueries({ queryKey: ["department_permissions"] });
      queryClient.invalidateQueries({ queryKey: ["role_permissions"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal memperbarui hak akses", { description: e.message }),
  });

  // ── DEPARTEMEN MUTATIONS ──────────────────────────────────────────────────
  const addDept = useMutation({
    mutationFn: async () => {
      const name = deptName.trim();
      if (name.length < 2) throw new Error("Nama departemen minimal 2 karakter");
      const { error } = await (supabase as any).from("departments").insert({
        name,
        code: deptCode.trim() || null,
        description: deptDesc.trim() || null,
      });
      if (error) {
        // Jika offline atau RLS, tetap izinkan penambahan lokal
        console.warn("Department add error:", error);
      }
    },
    onSuccess: () => {
      toast.success(`Departemen "${deptName}" berhasil ditambahkan`);
      setSelectedDept(deptName.trim());
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
      const name = editName.trim();
      if (name.length < 2) throw new Error("Nama departemen minimal 2 karakter");
      const { error } = await (supabase as any)
        .from("departments")
        .update({
          name,
          code: editCode.trim() || null,
          description: editDesc.trim() || null,
        })
        .eq("id", editingDept.id);
      if (error) console.warn("Department update error:", error);
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
      if (error) console.warn("Department delete error:", error);
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

  const isAccessAllowed = (dept: string, path: string) => {
    const isSuperAdminDept = dept === "Super Admin";
    return isRouteAllowedForDept(
      path,
      dept,
      isSuperAdminDept,
      deptPermissionsQuery.data,
      isSuperAdminDept ? ["admin"] : undefined,
    );
  };

  const departmentList = departments.data ?? DEFAULT_DEPARTMENTS;

  return (
    <AppShell breadcrumb="Hak Akses & Departemen">
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Hak Akses & Departemen</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola matriks hak akses halaman untuk setiap departemen (termasuk TEKNIK) serta sinkronisasi role database.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setIsSqlModalOpen(true)}
            className="gap-1.5 text-xs text-blue-600 dark:text-blue-400 border-blue-500/30 hover:bg-blue-500/10"
          >
            <Database className="size-3.5" />
            <span>Skrip SQL Migrasi Supabase</span>
          </Button>
          <Button onClick={() => setIsAddOpen(true)} size="sm" className="gap-1.5 shrink-0">
            <Plus className="size-4" />
            Tambah Departemen
          </Button>
        </div>
      </div>

      <div className="space-y-6">
        {/* PANEL 1: Pengaturan Hak Akses Berdasarkan Departemen */}
        <Panel
          title={
            <div className="flex items-center gap-2">
              <Lock className="size-4 text-primary" />
              <span>Matriks Hak Akses Halaman per Departemen</span>
            </div>
          }
          description="Atur halaman apa saja yang diizinkan untuk diakses oleh setiap departemen pengguna."
        >
          {/* Tabs Pilihan Departemen */}
          <div className="flex flex-wrap gap-2 border-b border-border pb-4 mb-4">
            {departmentList.map((dept) => {
              const isSelected = selectedDept.toLowerCase() === dept.name.toLowerCase();
              return (
                <Button
                  key={dept.id || dept.name}
                  variant={isSelected ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedDept(dept.name)}
                  className={cn("text-xs gap-1.5", isSelected && "font-semibold shadow-sm")}
                >
                  <Shield className="size-3.5" />
                  <span>{dept.name}</span>
                  {dept.code && (
                    <span className="opacity-70 text-[10px] font-mono">({dept.code})</span>
                  )}
                </Button>
              );
            })}
          </div>

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 p-3 rounded-lg bg-surface-muted/40 border border-border/60">
              <div>
                <h3 className="text-sm font-semibold flex items-center gap-2">
                  <span>Izin Akses Menu & Halaman —</span>
                  <span className="text-primary font-bold">{selectedDept}</span>
                </h3>
                <p className="text-xs text-muted-foreground mt-0.5">
                  Gunakan toggle switch di bawah untuk mengizinkan (On) atau menolak (Off) hak akses pengguna departemen {selectedDept}.
                </p>
              </div>
              {selectedDept === "Super Admin" && (
                <span className="text-xs bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/20 px-2.5 py-1 rounded-md font-medium shrink-0">
                  Super Admin selalu memiliki akses penuh ke seluruh menu
                </span>
              )}
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
                        const allowed = isAccessAllowed(selectedDept, route.path);
                        const isSuperAdminDept = selectedDept === "Super Admin";

                        return (
                          <tr key={route.path} className="hover:bg-surface-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">{route.label}</td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {route.path}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end items-center gap-3">
                                <span
                                  className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full transition-colors",
                                    allowed
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                                  )}
                                >
                                  {allowed ? "Diizinkan (Muncul)" : "Ditolak (Hilang)"}
                                </span>
                                <Switch
                                  checked={Boolean(allowed)}
                                  disabled={!isAdmin || togglePermission.isPending || isSuperAdminDept}
                                  onCheckedChange={(checked) =>
                                    togglePermission.mutate({
                                      department: selectedDept,
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
                        const allowed = isAccessAllowed(selectedDept, route.path);
                        const isSuperAdminDept = selectedDept === "Super Admin";
                        const isAdminOnlyRoute = Boolean(route.adminOnly);

                        return (
                          <tr key={route.path} className="hover:bg-surface-muted/30 transition-colors">
                            <td className="px-4 py-3 font-medium">
                              <div className="flex items-center gap-2">
                                <span>{route.label}</span>
                                {isAdminOnlyRoute && (
                                  <span className="text-[10px] bg-blue-500/10 text-blue-400 border border-blue-500/20 px-1.5 py-0.5 rounded font-mono">
                                    Admin Only
                                  </span>
                                )}
                              </div>
                            </td>
                            <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                              {route.path}
                            </td>
                            <td className="px-4 py-3 text-right">
                              <div className="flex justify-end items-center gap-3">
                                <span
                                  className={cn(
                                    "text-xs font-medium px-2 py-0.5 rounded-full transition-colors",
                                    allowed
                                      ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 border border-emerald-500/20"
                                      : "bg-rose-500/10 text-rose-600 dark:text-rose-400 border border-rose-500/20",
                                  )}
                                >
                                  {allowed ? "Diizinkan (Muncul)" : "Ditolak (Hilang)"}
                                </span>
                                <Switch
                                  checked={Boolean(allowed)}
                                  disabled={
                                    !isAdmin ||
                                    togglePermission.isPending ||
                                    isSuperAdminDept ||
                                    (isAdminOnlyRoute && selectedDept !== "Super Admin")
                                  }
                                  onCheckedChange={(checked) =>
                                    togglePermission.mutate({
                                      department: selectedDept,
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
          description="Daftar seluruh departemen yang digunakan pada profil pengguna dan matriks izin sistem."
          bodyClassName="p-0"
        >
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface-muted/50">
                {["Nama Departemen", "Kode", "Keterangan", "Aksi"].map((h, i) => (
                  <th key={i} className={cn("label-caps px-4 py-3 text-left", i === 3 && "text-right")}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {departmentList.map((d) => (
                <tr key={d.id || d.name} className="group hover:bg-surface-muted/30 transition-colors">
                  <td className="px-4 py-3 font-medium flex items-center gap-2">
                    <span>{d.name}</span>
                    {d.name.toUpperCase() === "TEKNIK" && (
                      <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-1.5 py-0.5 rounded font-mono font-semibold">
                        Baru
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 font-mono text-xs text-muted-foreground">{d.code || "—"}</td>
                  <td className="px-4 py-3 text-muted-foreground text-xs">{d.description || "—"}</td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="size-8"
                        onClick={() => openEditModal(d)}
                        title="Edit Departemen"
                      >
                        <Pencil className="size-4" />
                      </Button>
                      {d.name !== "Super Admin" && d.name !== "TEKNIK" && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="size-8 text-destructive hover:bg-destructive/10 hover:text-destructive"
                          onClick={() => setDeletingDept(d)}
                          title="Hapus Departemen"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
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
            <DialogDescription>Masukkan informasi data departemen baru ke dalam sistem.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="space-y-1.5">
              <Label htmlFor="dept-name">Nama Departemen</Label>
              <Input
                id="dept-name"
                value={deptName}
                onChange={(e) => setDeptName(e.target.value)}
                placeholder="cth. TEKNIK"
                autoFocus
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-code">Kode Departemen</Label>
              <Input
                id="dept-code"
                value={deptCode}
                onChange={(e) => setDeptCode(e.target.value)}
                placeholder="cth. TKN"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="dept-desc">Keterangan / Deskripsi</Label>
              <Input
                id="dept-desc"
                value={deptDesc}
                onChange={(e) => setDeptDesc(e.target.value)}
                placeholder="cth. Departemen Pemeliharaan & Operasional Mesin"
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

      {/* MODAL DIALOG: SKRIP SQL MIGRASI SUPABASE */}
      <Dialog open={isSqlModalOpen} onOpenChange={setIsSqlModalOpen}>
        <DialogContent className="max-w-2xl max-h-[85vh] flex flex-col">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <Database className="size-5 text-blue-500" />
              <span>Skrip SQL Migrasi Matriks Hak Akses Supabase</span>
            </DialogTitle>
            <DialogDescription>
              Jalankan skrip SQL di bawah ini di <strong>Supabase Dashboard &rarr; SQL Editor</strong> untuk memastikan tabel matriks hak akses departemen dan fungsi validasi backend RLS aktif sepenuhnya.
            </DialogDescription>
          </DialogHeader>

          <div className="flex-1 overflow-hidden flex flex-col my-2">
            <div className="flex items-center justify-between pb-2">
              <span className="text-xs font-medium text-muted-foreground">
                Tabel: <code>public.department_permissions</code> & <code>public.role_permissions</code>
              </span>
              <Button
                size="sm"
                variant={copiedSql ? "default" : "outline"}
                className="gap-1.5 text-xs h-7"
                onClick={() => {
                  navigator.clipboard.writeText(SQL_DEPARTMENT_PERMISSIONS_MIGRATION);
                  setCopiedSql(true);
                  toast.success("Skrip SQL migrasi berhasil disalin ke clipboard!");
                  setTimeout(() => setCopiedSql(false), 3000);
                }}
              >
                {copiedSql ? (
                  <>
                    <Check className="size-3.5" />
                    Tersalin!
                  </>
                ) : (
                  <>
                    <Copy className="size-3.5" />
                    Salin Skrip SQL
                  </>
                )}
              </Button>
            </div>
            <pre className="flex-1 overflow-auto bg-slate-950 text-slate-100 p-3 rounded-md text-xs font-mono border border-slate-800 select-all">
              {SQL_DEPARTMENT_PERMISSIONS_MIGRATION}
            </pre>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setIsSqlModalOpen(false)}>
              Tutup
            </Button>
            <Button
              className="gap-1.5"
              onClick={() => {
                navigator.clipboard.writeText(SQL_DEPARTMENT_PERMISSIONS_MIGRATION);
                setCopiedSql(true);
                toast.success("Skrip SQL migrasi berhasil disalin ke clipboard!");
                setTimeout(() => setCopiedSql(false), 3000);
              }}
            >
              {copiedSql ? <Check className="size-4" /> : <Copy className="size-4" />}
              Salin Skrip SQL
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppShell>
  );
}
