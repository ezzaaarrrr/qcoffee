import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  Users,
  UserPlus,
  Pencil,
  Trash2,
  Shield,
  Building,
  Mail,
  Lock,
  Search,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
  Copy,
  Check,
  Sparkles,
  Info,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
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
import { createClient } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import { fetchProfiles, fetchUserRoles } from "@/lib/queries";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import { useCurrentUser } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

export type ProfileRow = {
  id: string;
  full_name: string | null;
  email: string;
  department: string | null;
  signature_url?: string | null;
};

export const Route = createFileRoute("/_authenticated/settings")({
  head: () => ({
    meta: [
      { title: "Manajemen User" },
      {
        name: "description",
        content: "Kelola pengguna, tambah user baru, edit profil, hapus akun, dan atur peran (role) pengguna.",
      },
    ],
  }),
  component: UserManagementPage,
});

function UserManagementPage() {
  const { profile: currentProfile, isAdmin } = useCurrentUser();
  const queryClient = useQueryClient();

  const [searchQuery, setSearchQuery] = useState("");
  const [roleFilter, setRoleFilter] = useState("ALL");

  // State Modal Tambah User
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [newFullName, setNewFullName] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [showNewUserPassword, setShowNewUserPassword] = useState(false);
  const [newRole, setNewRole] = useState<AppRole>("admin_process");
  const [newDept, setNewDept] = useState("");

  // State Modal Edit User
  const [editingUser, setEditingUser] = useState<ProfileRow | null>(null);
  const [editFullName, setEditFullName] = useState("");
  const [editDept, setEditDept] = useState("");
  const [editRole, setEditRole] = useState<AppRole>("admin_process");

  // State Modal Hapus User
  const [deletingUser, setDeletingUser] = useState<ProfileRow | null>(null);

  // State Modal Ubah & Lihat Password User (Super Admin)
  const [passwordUser, setPasswordUser] = useState<ProfileRow | null>(null);
  const [newPasswordInput, setNewPasswordInput] = useState("");
  const [showPassword, setShowPassword] = useState(true);
  const [copiedPassword, setCopiedPassword] = useState(false);

  // Queries
  const profiles = useQuery({ queryKey: ["profiles"], queryFn: fetchProfiles });
  const roles = useQuery({ queryKey: ["user-roles"], queryFn: fetchUserRoles });

  const roleOf = (userId: string): AppRole | undefined =>
    roles.data?.find((r) => r.user_id === userId)?.role as AppRole | undefined;

  // Helper generator kata sandi acak yang aman
  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789!@#$%&*";
    let pwd = "";
    for (let i = 0; i < 10; i++) {
      pwd += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return pwd;
  };

  const handleCopyPassword = (pwd: string) => {
    if (!pwd) return;
    navigator.clipboard.writeText(pwd);
    setCopiedPassword(true);
    toast.success("Kata sandi berhasil disalin ke clipboard!");
    setTimeout(() => setCopiedPassword(false), 2500);
  };

  // ── CREATE USER (ISOLATED CLIENT SO ADMIN SESSION IS PRESERVED) ──────────
  const createUser = useMutation({
    mutationFn: async () => {
      const name = newFullName.trim();
      const email = newEmail.trim().toLowerCase();
      const dept = newDept.trim() || ROLE_LABELS[newRole];

      if (name.length < 2) throw new Error("Nama lengkap minimal 2 karakter");
      if (!email.includes("@")) throw new Error("Format email tidak valid");
      if (newPassword.length < 8) throw new Error("Kata sandi minimal 8 karakter");

      const supabaseUrl = import.meta.env["VITE_SUPABASE_URL"];
      const supabaseAnonKey = import.meta.env["VITE_SUPABASE_PUBLISHABLE_KEY"];

      if (!supabaseUrl || !supabaseAnonKey) {
        throw new Error("Konfigurasi Supabase tidak ditemukan");
      }

      // Gunakan instance Supabase terpisah tanpa session storage agar sesi admin saat ini TIDAK tertimpa
      const authClient = createClient(supabaseUrl, supabaseAnonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false,
        },
      });

      const { data, error } = await authClient.auth.signUp({
        email,
        password: newPassword,
        options: {
          data: {
            full_name: name,
            role: newRole,
            department: dept,
          },
        },
      });

      if (error) throw error;

      // Sinkronisasi tabel profiles & user_roles menggunakan client utama (sesi admin)
      if (data.user?.id) {
        await supabase
          .from("profiles")
          .upsert({
            id: data.user.id,
            full_name: name,
            email,
            department: dept,
          })
          .eq("id", data.user.id);

        await supabase
          .from("user_roles")
          .upsert({
            user_id: data.user.id,
            role: newRole,
          });
      }
    },
    onSuccess: () => {
      toast.success("Akun pengguna baru berhasil didaftarkan");
      setIsAddOpen(false);
      setNewFullName("");
      setNewEmail("");
      setNewPassword("");
      setShowNewUserPassword(false);
      setNewRole("admin_process");
      setNewDept("");
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (e: Error) => toast.error("Gagal menambahkan user", { description: e.message }),
  });

  // ── UPDATE USER (Nama, Departemen & Peran) ──────────────────────────────────
  const updateUser = useMutation({
    mutationFn: async () => {
      if (!editingUser) return;
      const name = editFullName.trim();
      const dept = editDept.trim();

      if (name.length < 2) throw new Error("Nama lengkap minimal 2 karakter");

      // 1. Update Profile (Nama & Departemen)
      const { error: profileErr } = await supabase
        .from("profiles")
        .update({ full_name: name, department: dept || null })
        .eq("id", editingUser.id);

      if (profileErr) throw profileErr;

      // 2. Update Role di user_roles
      const currentRole = roleOf(editingUser.id);
      if (currentRole !== editRole) {
        const del = await supabase.from("user_roles").delete().eq("user_id", editingUser.id);
        if (del.error) throw del.error;

        const { error: roleErr } = await supabase
          .from("user_roles")
          .insert({ user_id: editingUser.id, role: editRole });
        if (roleErr) throw roleErr;
      }
    },
    onSuccess: () => {
      toast.success("Data pengguna berhasil diperbarui");
      setEditingUser(null);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (e: Error) => toast.error("Gagal memperbarui pengguna", { description: e.message }),
  });

  // ── UPDATE PASSWORD USER (SUPER ADMIN) ──────────────────────────────────────
  const updatePassword = useMutation({
    mutationFn: async () => {
      if (!passwordUser) return;
      const pwd = newPasswordInput.trim();

      if (pwd.length < 8) {
        throw new Error("Kata sandi baru minimal 8 karakter");
      }

      // Panggil fungsi RPC update_user_password_by_admin
      const { error } = await (supabase as any).rpc("update_user_password_by_admin", {
        target_user_id: passwordUser.id,
        new_password: pwd,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success(
        `Kata sandi untuk ${passwordUser?.full_name || passwordUser?.email} berhasil diperbarui!`,
      );
      setPasswordUser(null);
      setNewPasswordInput("");
      setShowPassword(true);
      setCopiedPassword(false);
    },
    onError: (e: Error) => {
      toast.error("Gagal mengubah kata sandi", {
        description: e.message || "Pastikan Anda memiliki hak akses Super Admin.",
      });
    },
  });

  // ── DELETE USER (RPC + DATABASE REMOVAL) ─────────────────────────
  const deleteUser = useMutation({
    mutationFn: async (user: ProfileRow) => {
      if (user.id === currentProfile?.id) {
        throw new Error("Anda tidak dapat menghapus akun Anda sendiri.");
      }

      // Coba panggil RPC delete_user_by_admin (menghapus tuntas dari auth.users & profiles)
      const { error: rpcErr } = await (supabase as any).rpc("delete_user_by_admin", {
        target_user_id: user.id,
      });

      if (rpcErr) {
        // Jika RPC belum dieksekusi di Supabase remote, fallback hapus langsung dari tabel profiles & user_roles
        const { error: roleDelErr } = await supabase.from("user_roles").delete().eq("user_id", user.id);
        if (roleDelErr) throw roleDelErr;

        const { error: profileDelErr } = await supabase.from("profiles").delete().eq("id", user.id);
        if (profileDelErr) throw profileDelErr;
      }
    },
    onMutate: async (deletedUser) => {
      // Optimistic update: langsung hilangkan dari tampilan UI
      await queryClient.cancelQueries({ queryKey: ["profiles"] });
      const previousProfiles = queryClient.getQueryData<ProfileRow[]>(["profiles"]);

      if (previousProfiles) {
        queryClient.setQueryData<ProfileRow[]>(
          ["profiles"],
          previousProfiles.filter((p) => p.id !== deletedUser.id),
        );
      }

      return { previousProfiles };
    },
    onSuccess: () => {
      toast.success("Akun pengguna berhasil dihapus dari sistem");
      setDeletingUser(null);
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
      queryClient.invalidateQueries({ queryKey: ["user-roles"] });
    },
    onError: (e: Error, _, context) => {
      // Rollback jika terjadi error
      if (context?.previousProfiles) {
        queryClient.setQueryData(["profiles"], context.previousProfiles);
      }
      toast.error("Gagal menghapus akun", { description: e.message });
    },
  });

  // Modal edit handler
  const openEditModal = (u: ProfileRow) => {
    setEditingUser(u);
    setEditFullName(u.full_name || "");
    setEditDept(u.department || "");
    setEditRole(roleOf(u.id) || "admin_process");
  };

  // Filter & Search List User
  const allProfiles = profiles.data ?? [];
  const filteredProfiles = allProfiles.filter((p) => {
    const userRole = roleOf(p.id);
    const matchSearch =
      (p.full_name && p.full_name.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.email && p.email.toLowerCase().includes(searchQuery.toLowerCase())) ||
      (p.department && p.department.toLowerCase().includes(searchQuery.toLowerCase()));

    const matchRole = roleFilter === "ALL" || userRole === roleFilter;
    return matchSearch && matchRole;
  });

  return (
    <AppShell breadcrumb="Manajemen User">
      {/* Header Halaman */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Manajemen Pengguna</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Kelola daftar akun pengguna, tambah user baru, edit departemen, dan atur hak akses peran (role).
          </p>
        </div>

        {isAdmin && (
          <Button onClick={() => setIsAddOpen(true)} size="sm" className="gap-1.5 self-start sm:self-auto">
            <UserPlus className="size-4" />
            Tambah Pengguna Baru
          </Button>
        )}
      </div>

      {!isAdmin && (
        <div className="mb-6 border border-warning/40 bg-warning/10 px-4 py-3 text-sm text-warning rounded-sm">
          Hanya Super Admin yang memiliki wewenang untuk menambah, mengubah, atau menghapus pengguna.
        </div>
      )}

      {/* Filter & Search Bar */}
      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between bg-surface border border-border p-3">
        <div className="relative flex-1 sm:max-w-md">
          <Search className="absolute left-3 top-2.5 size-4 text-muted-foreground" />
          <Input
            placeholder="Cari nama, email, atau departemen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-sm"
          />
        </div>
        <div className="flex items-center gap-2">
          <Shield className="size-4 text-muted-foreground" />
          <Select value={roleFilter} onValueChange={setRoleFilter}>
            <SelectTrigger className="w-56 h-9 text-xs">
              <SelectValue placeholder="Semua Peran / Role" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="ALL" className="text-xs">Semua Peran (Role)</SelectItem>
              {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                <SelectItem key={r} value={r} className="text-xs">
                  {ROLE_LABELS[r]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Tabel Pengguna */}
      <Panel
        title={
          <div className="flex items-center justify-between w-full">
            <div className="flex items-center gap-2">
              <Users className="size-4 text-primary" />
              <span>Daftar Akun Pengguna ({filteredProfiles.length} Total)</span>
            </div>
          </div>
        }
        bodyClassName="p-0"
      >
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border bg-surface-muted/50">
              <th className="label-caps px-4 py-3 text-left">Nama Pengguna</th>
              <th className="label-caps px-4 py-3 text-left">Email</th>
              <th className="label-caps px-4 py-3 text-left">Departemen</th>
              <th className="label-caps px-4 py-3 text-left">Peran (Role)</th>
              {isAdmin && <th className="label-caps px-4 py-3 text-right">Aksi</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {profiles.isLoading ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  Memuat data pengguna...
                </td>
              </tr>
            ) : filteredProfiles.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-12 text-center text-muted-foreground">
                  Tidak ada data pengguna yang sesuai dengan filter.
                </td>
              </tr>
            ) : (
              filteredProfiles.map((p) => {
                const userRole = roleOf(p.id);
                const isCurrentUser = p.id === currentProfile?.id;

                return (
                  <tr key={p.id} className="hover:bg-surface-muted/30 transition-colors group">
                    <td className="px-4 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <span>{p.full_name || "—"}</span>
                        {isCurrentUser && (
                          <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                            Akun Anda
                          </Badge>
                        )}
                      </div>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground font-mono text-xs">{p.email}</td>
                    <td className="px-4 py-3 text-muted-foreground">{p.department || "—"}</td>
                    <td className="px-4 py-3">
                      {userRole ? (
                        <Badge
                          variant="outline"
                          className={cn(
                            "text-xs font-normal border",
                            userRole === "admin" && "bg-purple-500/10 text-purple-700 border-purple-300 dark:text-purple-300",
                            userRole === "prod_process_uh" && "bg-blue-500/10 text-blue-700 border-blue-300 dark:text-blue-300",
                            userRole === "qc_field" && "bg-amber-500/10 text-amber-700 border-amber-300 dark:text-amber-300",
                            userRole === "admin_process" && "bg-emerald-500/10 text-emerald-700 border-emerald-300 dark:text-emerald-300",
                          )}
                        >
                          {ROLE_LABELS[userRole] || userRole}
                        </Badge>
                      ) : (
                        <span className="text-xs text-muted-foreground">—</span>
                      )}
                    </td>

                    {/* Aksi CRUD & Kelola Password (Khusus Super Admin) */}
                    {isAdmin && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-1">
                          {/* Tombol Ubah / Reset Password */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-amber-600 dark:text-amber-400 hover:bg-amber-500/10 hover:text-amber-700"
                            onClick={() => {
                              setPasswordUser(p);
                              setNewPasswordInput("");
                              setShowPassword(true);
                              setCopiedPassword(false);
                            }}
                            title="Lihat & Ubah Kata Sandi Pengguna"
                          >
                            <KeyRound className="size-4" />
                          </Button>

                          {/* Tombol Edit Profil & Role */}
                          <Button
                            size="icon"
                            variant="ghost"
                            className="size-8 text-muted-foreground hover:text-foreground hover:bg-surface-muted"
                            onClick={() => openEditModal(p)}
                            title="Edit data & peran pengguna"
                          >
                            <Pencil className="size-4" />
                          </Button>

                          {/* Tombol Hapus Pengguna */}
                          <Button
                            size="icon"
                            variant="ghost"
                            disabled={isCurrentUser}
                            className="size-8 text-rose-500 hover:bg-rose-500/10 hover:text-rose-600 disabled:opacity-20"
                            onClick={() => setDeletingUser(p)}
                            title={isCurrentUser ? "Tidak dapat menghapus akun sendiri" : "Hapus akun pengguna"}
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </Panel>

      {/* ── MODAL DIALOG: TAMBAH USER BARU ──────────────────────────────────── */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Tambah Pengguna Baru</DialogTitle>
            <DialogDescription>
              Buat akun pengguna baru dengan menetapkan nama, email, kata sandi, departemen, dan role.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3.5 py-2 text-sm">
            <div className="space-y-1.5">
              <Label htmlFor="add-name">Nama Lengkap *</Label>
              <Input
                id="add-name"
                value={newFullName}
                onChange={(e) => setNewFullName(e.target.value)}
                placeholder="cth. Budi Santoso"
                autoFocus
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="add-email">Alamat Email *</Label>
              <Input
                id="add-email"
                type="email"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="budi@perusahaan.co.id"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="add-password">Kata Sandi (Password) *</Label>
                <button
                  type="button"
                  onClick={() => {
                    const generated = generateRandomPassword();
                    setNewPassword(generated);
                    setShowNewUserPassword(true);
                  }}
                  className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                >
                  <Sparkles className="size-3" /> Buat Acak
                </button>
              </div>
              <div className="relative">
                <Input
                  id="add-password"
                  type={showNewUserPassword ? "text" : "password"}
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  placeholder="Minimal 8 karakter"
                  className="pr-20 font-mono"
                />
                <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                  <Button
                    type="button"
                    size="icon"
                    variant="ghost"
                    className="size-7 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowNewUserPassword(!showNewUserPassword)}
                    title={showNewUserPassword ? "Sembunyikan password" : "Lihat password"}
                  >
                    {showNewUserPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                  </Button>
                  {newPassword && (
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => handleCopyPassword(newPassword)}
                      title="Salin password"
                    >
                      <Copy className="size-3.5" />
                    </Button>
                  )}
                </div>
              </div>
            </div>

            <div className="space-y-1.5">
              <Label>Departemen / Divisi</Label>
              <Input
                value={newDept}
                onChange={(e) => setNewDept(e.target.value)}
                placeholder={ROLE_LABELS[newRole]}
              />
            </div>

            <div className="space-y-1.5">
              <Label>Peran (Role / Hak Akses) *</Label>
              <Select value={newRole} onValueChange={(v) => setNewRole(v as AppRole)}>
                <SelectTrigger className="w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                    <SelectItem key={r} value={r} className="text-xs">
                      {ROLE_LABELS[r]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsAddOpen(false)}>
              Batal
            </Button>
            <Button
              onClick={() => createUser.mutate()}
              disabled={createUser.isPending || !newFullName.trim() || !newEmail.trim() || !newPassword}
            >
              {createUser.isPending ? "Mendaftarkan..." : "Tambah Pengguna"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: UBAH & LIHAT PASSWORD (SUPER ADMIN TOOLS) ─────────── */}
      <Dialog open={!!passwordUser} onOpenChange={(open) => !open && setPasswordUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <div className="flex items-center gap-2 text-amber-600 dark:text-amber-400">
              <KeyRound className="size-5" />
              <DialogTitle className="text-foreground">Kelola Kata Sandi Pengguna</DialogTitle>
            </div>
            <DialogDescription>
              Sebagai Super Admin, Anda dapat mengatur ulang kata sandi pengguna dan melihatnya sebelum disimpan untuk dibagikan.
            </DialogDescription>
          </DialogHeader>

          {passwordUser && (
            <div className="space-y-4 py-2 text-sm">
              {/* Ringkasan Akun Target */}
              <div className="rounded-lg border border-border bg-surface-muted/40 p-3 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-semibold text-foreground text-sm">{passwordUser.full_name || "Tanpa Nama"}</span>
                  {roleOf(passwordUser.id) && (
                    <Badge variant="outline" className="text-[10px] font-normal py-0">
                      {ROLE_LABELS[roleOf(passwordUser.id)!]}
                    </Badge>
                  )}
                </div>
                <div className="text-xs text-muted-foreground font-mono flex items-center gap-1.5">
                  <Mail className="size-3 shrink-0" />
                  <span>{passwordUser.email}</span>
                </div>
                {passwordUser.department && (
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5">
                    <Building className="size-3 shrink-0" />
                    <span>{passwordUser.department}</span>
                  </div>
                )}
              </div>

              {/* Input Kata Sandi Baru dengan Tools Lihat, Buat Acak, dan Salin */}
              <div className="space-y-2">
                <div className="flex items-center justify-between">
                  <Label htmlFor="new-password-input" className="font-semibold text-xs text-foreground">
                    Kata Sandi Baru *
                  </Label>
                  <button
                    type="button"
                    onClick={() => {
                      const generated = generateRandomPassword();
                      setNewPasswordInput(generated);
                      setShowPassword(true);
                    }}
                    className="text-xs text-primary hover:underline inline-flex items-center gap-1 font-medium"
                  >
                    <Sparkles className="size-3" /> Buat Sandi Acak
                  </button>
                </div>

                <div className="relative">
                  <Input
                    id="new-password-input"
                    type={showPassword ? "text" : "password"}
                    value={newPasswordInput}
                    onChange={(e) => setNewPasswordInput(e.target.value)}
                    placeholder="Masukkan minimal 8 karakter..."
                    className="pr-20 font-mono text-sm tracking-wide"
                    autoFocus
                  />
                  <div className="absolute right-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
                    {/* Tombol Lihat / Sembunyikan */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      onClick={() => setShowPassword(!showPassword)}
                      title={showPassword ? "Sembunyikan kata sandi" : "Lihat kata sandi"}
                    >
                      {showPassword ? <EyeOff className="size-3.5" /> : <Eye className="size-3.5" />}
                    </Button>

                    {/* Tombol Salin */}
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      className="size-7 text-muted-foreground hover:text-foreground"
                      disabled={!newPasswordInput}
                      onClick={() => handleCopyPassword(newPasswordInput)}
                      title="Salin kata sandi ke clipboard"
                    >
                      {copiedPassword ? (
                        <Check className="size-3.5 text-emerald-500" />
                      ) : (
                        <Copy className="size-3.5" />
                      )}
                    </Button>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-muted-foreground pt-0.5">
                  <span>Panjang: {newPasswordInput.length} karakter {newPasswordInput.length >= 8 ? "✓" : "(min. 8)"}</span>
                  {showPassword && newPasswordInput && (
                    <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                      Mode terlihat aktif
                    </span>
                  )}
                </div>
              </div>

              {/* Info Keamanan */}
              <div className="rounded border border-primary/20 bg-primary/5 p-2.5 text-xs text-muted-foreground flex gap-2">
                <Info className="size-4 text-primary shrink-0 mt-0.5" />
                <div className="leading-relaxed text-[11.5px]">
                  Kata sandi yang disimpan akan dienkripsi secara aman dengan algoritma bcrypt. Salin kata sandi baru untuk dibagikan kepada pengguna yang bersangkutan.
                </div>
              </div>
            </div>
          )}

          <DialogFooter className="gap-2">
            <Button variant="outline" onClick={() => setPasswordUser(null)}>
              Batal
            </Button>
            <Button
              onClick={() => updatePassword.mutate()}
              disabled={updatePassword.isPending || newPasswordInput.trim().length < 8}
              className="bg-amber-600 hover:bg-amber-700 text-white"
            >
              {updatePassword.isPending ? "Menyimpan..." : "Simpan Kata Sandi Baru"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: EDIT USER ─────────────────────────────────────────── */}
      <Dialog open={!!editingUser} onOpenChange={(open) => !open && setEditingUser(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Edit Data Pengguna</DialogTitle>
            <DialogDescription>
              Perbarui nama lengkap, nama departemen, atau ubah peran (role) pengguna.
            </DialogDescription>
          </DialogHeader>
          {editingUser && (
            <div className="space-y-3.5 py-2 text-sm">
              <div className="space-y-1.5">
                <Label>Email</Label>
                <Input value={editingUser.email} disabled className="bg-surface-muted font-mono text-xs" />
              </div>

              <div className="space-y-1.5">
                <Label>Nama Lengkap *</Label>
                <Input
                  value={editFullName}
                  onChange={(e) => setEditFullName(e.target.value)}
                  placeholder="Nama pengguna"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Departemen</Label>
                <Input
                  value={editDept}
                  onChange={(e) => setEditDept(e.target.value)}
                  placeholder="Departemen"
                />
              </div>

              <div className="space-y-1.5">
                <Label>Peran (Role / Hak Akses)</Label>
                <Select value={editRole} onValueChange={(v) => setEditRole(v as AppRole)}>
                  <SelectTrigger className="w-full">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {(Object.keys(ROLE_LABELS) as AppRole[]).map((r) => (
                      <SelectItem key={r} value={r} className="text-xs">
                        {ROLE_LABELS[r]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingUser(null)}>
              Batal
            </Button>
            <Button onClick={() => updateUser.mutate()} disabled={updateUser.isPending}>
              {updateUser.isPending ? "Menyimpan..." : "Simpan Perubahan"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── MODAL DIALOG: HAPUS USER ────────────────────────────────────────── */}
      <AlertDialog open={!!deletingUser} onOpenChange={(open) => !open && setDeletingUser(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Hapus Akun Pengguna?</AlertDialogTitle>
            <AlertDialogDescription>
              Apakah Anda yakin ingin menghapus akun pengguna <strong>&ldquo;{deletingUser?.full_name || deletingUser?.email}&rdquo;</strong>? Pengguna ini tidak akan dapat masuk kembali ke sistem.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Batal</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => deletingUser && deleteUser.mutate(deletingUser)}
            >
              Ya, Hapus Pengguna
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </AppShell>
  );
}
