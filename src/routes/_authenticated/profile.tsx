import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useState, useRef } from "react";
import {
  User,
  KeyRound,
  Shield,
  UploadCloud,
  CheckCircle2,
  Mail,
  Building,
  Save,
  PenTool,
} from "lucide-react";
import { toast } from "sonner";
import { AppShell } from "@/components/layout/AppShell";
import { Panel } from "@/components/Panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { ROLE_LABELS } from "@/lib/domain";

export const Route = createFileRoute("/_authenticated/profile")({
  head: () => ({
    meta: [
      { title: "Pengaturan Akun" },
      {
        name: "description",
        content: "Kelola profil akun, ganti kata sandi, dan perbarui tanda tangan digital.",
      },
    ],
  }),
  component: ProfileSettingsPage,
});

function ProfileSettingsPage() {
  const { profile, roles } = useCurrentUser();
  const queryClient = useQueryClient();

  // State Profil
  const [fullName, setFullName] = useState(profile?.full_name || "");
  const [department, setDepartment] = useState(profile?.department || "");

  // State Ganti Password
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");

  // Upload Signature
  const [isUploading, setIsUploading] = useState(false);
  const signatureInputRef = useRef<HTMLInputElement>(null);

  // ── UPDATE INFORMASI PROFIL ──────────────────────────────────────────────────
  const updateProfile = useMutation({
    mutationFn: async () => {
      if (!profile?.id) throw new Error("Pengguna tidak ditemukan");
      const name = fullName.trim();
      if (name.length < 2) throw new Error("Nama lengkap minimal 2 karakter");

      const { error } = await supabase
        .from("profiles")
        .update({
          full_name: name,
          department: department.trim() || null,
        })
        .eq("id", profile.id);

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Profil akun berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["current_user_profile"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    },
    onError: (e: Error) =>
      toast.error("Gagal memperbarui profil", { description: e.message }),
  });

  // ── UPDATE PASSWORD MANDIRI ──────────────────────────────────────────────────
  const updatePassword = useMutation({
    mutationFn: async () => {
      if (newPassword.length < 8) {
        throw new Error("Kata sandi baru minimal 8 karakter");
      }
      if (newPassword !== confirmPassword) {
        throw new Error("Konfirmasi kata sandi tidak cocok");
      }

      const { error } = await supabase.auth.updateUser({
        password: newPassword,
      });

      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Kata sandi berhasil diubah", {
        description: "Gunakan kata sandi baru untuk login berikutnya.",
      });
      setNewPassword("");
      setConfirmPassword("");
    },
    onError: (e: Error) =>
      toast.error("Gagal mengubah kata sandi", { description: e.message }),
  });

  // ── UPLOAD TANDA TANGAN DIGITAL (SUPABASE STORAGE) ──────────────────────────
  async function handleSignatureUpload(file: File) {
    if (!profile?.id) return;
    setIsUploading(true);

    try {
      const fileExt = file.name.split(".").pop();
      const fileName = `signatures/${profile.id}_${Date.now()}.${fileExt}`;

      const { data, error } = await supabase.storage
        .from("warehouse-docs")
        .upload(fileName, file, { cacheControl: "3600", upsert: true });

      if (error) {
        // Fallback jika bucket khusus belum ada
        toast.error("Gagal mengunggah tanda tangan", { description: error.message });
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("warehouse-docs")
        .getPublicUrl(data.path);

      // Simpan URL ke profile
      await supabase
        .from("profiles")
        .update({ signature_url: publicUrlData.publicUrl })
        .eq("id", profile.id);

      toast.success("Tanda tangan digital berhasil diperbarui");
      queryClient.invalidateQueries({ queryKey: ["current_user_profile"] });
      queryClient.invalidateQueries({ queryKey: ["profiles"] });
    } catch (err: any) {
      toast.error("Terjadi kesalahan: " + err.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <AppShell breadcrumb="Pengaturan Akun">
      <div className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight text-white">Pengaturan Akun</h1>
        <p className="mt-1 text-sm text-white">
          Kelola informasi identitas akun, ubah kata sandi, dan atur tanda tangan digital Anda.
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Kolom Kiri: Kartu Identitas Ringkas */}
        <div className="space-y-6 lg:col-span-1">
          <div className="border border-border bg-surface p-6 text-center">
            <div className="mx-auto mb-3 grid size-16 place-items-center rounded-full bg-primary/10 font-mono text-xl font-bold text-primary">
              {(profile?.full_name || profile?.email || "??")
                .split(" ")
                .map((n) => n[0])
                .join("")
                .slice(0, 2)
                .toUpperCase()}
            </div>
            <h2 className="text-lg font-bold">{profile?.full_name || "Nama Pengguna"}</h2>
            <p className="text-xs text-muted-foreground font-mono mt-0.5">{profile?.email}</p>

            <div className="mt-4 flex flex-wrap justify-center gap-1.5">
              {roles.map((r) => (
                <Badge key={r} variant="outline" className="text-xs bg-surface-muted">
                  {ROLE_LABELS[r]}
                </Badge>
              ))}
            </div>

            <div className="mt-6 border-t border-border pt-4 text-left text-xs space-y-2 text-muted-foreground">
              <div className="flex justify-between">
                <span>Departemen:</span>
                <span className="font-medium text-foreground">{profile?.department || "—"}</span>
              </div>
              <div className="flex justify-between">
                <span>Status Akun:</span>
                <span className="font-medium text-emerald-600 flex items-center gap-1">
                  <CheckCircle2 className="size-3" /> Terverifikasi
                </span>
              </div>
            </div>
          </div>

          {/* Panel Tanda Tangan Digital */}
          <div className="border border-border bg-surface p-5 space-y-3">
            <div className="flex items-center gap-2">
              <PenTool className="size-4 text-primary" />
              <h3 className="font-semibold text-sm">Tanda Tangan Digital</h3>
            </div>
            <p className="text-xs text-muted-foreground">
              Digunakan secara otomatis saat Anda menyetujui formulir atau checklist.
            </p>

            {profile?.signature_url ? (
              <div className="rounded border border-border bg-surface-muted/50 p-2 flex items-center justify-center">
                <img
                  src={profile.signature_url}
                  alt="Tanda Tangan"
                  className="max-h-20 object-contain"
                />
              </div>
            ) : (
              <div className="rounded border border-dashed border-border py-6 text-center text-xs text-muted-foreground">
                Belum ada tanda tangan digital terpasang.
              </div>
            )}

            <input
              type="file"
              ref={signatureInputRef}
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleSignatureUpload(file);
              }}
            />
            <Button
              variant="outline"
              size="sm"
              disabled={isUploading}
              onClick={() => signatureInputRef.current?.click()}
              className="w-full gap-2 text-xs"
            >
              <UploadCloud className="size-3.5" />
              {isUploading ? "Mengunggah..." : profile?.signature_url ? "Ganti Tanda Tangan" : "Upload Tanda Tangan"}
            </Button>
          </div>
        </div>

        {/* Kolom Kanan: Form Ubah Informasi & Password */}
        <div className="lg:col-span-2">
          <Tabs defaultValue="general" className="space-y-4">
            <TabsList className="bg-surface-muted border border-border">
              <TabsTrigger value="general" className="gap-2">
                <User className="size-4" />
                Informasi Akun
              </TabsTrigger>
              <TabsTrigger value="security" className="gap-2">
                <KeyRound className="size-4" />
                Ganti Kata Sandi
              </TabsTrigger>
            </TabsList>

            {/* TAB 1: INFORMASI PROFIL */}
            <TabsContent value="general">
              <Panel
                title="Perbarui Data Profil"
                description="Ubah nama tampilan dan informasi departemen akun Anda."
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updateProfile.mutate();
                  }}
                  className="space-y-4"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="email" className="flex items-center gap-1.5">
                      <Mail className="size-3.5 text-muted-foreground" />
                      <span>Alamat Email</span>
                    </Label>
                    <Input
                      id="email"
                      value={profile?.email || ""}
                      disabled
                      className="bg-surface-muted font-mono text-xs"
                    />
                    <p className="text-[11px] text-muted-foreground">
                      Email akun dikelola oleh Super Administrator dan tidak dapat diganti sembarangan.
                    </p>
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="fullName" className="flex items-center gap-1.5">
                      <User className="size-3.5 text-muted-foreground" />
                      <span>Nama Lengkap</span>
                    </Label>
                    <Input
                      id="fullName"
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Masukkan nama lengkap Anda"
                      required
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="department" className="flex items-center gap-1.5">
                      <Building className="size-3.5 text-muted-foreground" />
                      <span>Departemen / Divisi</span>
                    </Label>
                    <Input
                      id="department"
                      value={department}
                      onChange={(e) => setDepartment(e.target.value)}
                      placeholder="cth. Departemen Teknik Central Kitchen"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label className="flex items-center gap-1.5">
                      <Shield className="size-3.5 text-muted-foreground" />
                      <span>Peran / Hak Akses Aktif</span>
                    </Label>
                    <div className="flex flex-wrap gap-2 pt-1">
                      {roles.map((r) => (
                        <Badge key={r} variant="outline" className="font-mono text-xs">
                          {ROLE_LABELS[r]}
                        </Badge>
                      ))}
                    </div>
                  </div>

                  <div className="pt-2">
                    <Button type="submit" disabled={updateProfile.isPending} className="gap-2">
                      <Save className="size-4" />
                      {updateProfile.isPending ? "Menyimpan..." : "Simpan Perubahan"}
                    </Button>
                  </div>
                </form>
              </Panel>
            </TabsContent>

            {/* TAB 2: GANTI KATA SANDI */}
            <TabsContent value="security">
              <Panel
                title="Ganti Kata Sandi (Password)"
                description="Perbarui kata sandi Anda secara berkala untuk menjaga keamanan akun."
              >
                <form
                  onSubmit={(e) => {
                    e.preventDefault();
                    updatePassword.mutate();
                  }}
                  className="space-y-4 max-w-md"
                >
                  <div className="space-y-1.5">
                    <Label htmlFor="new-pass">Kata Sandi Baru</Label>
                    <Input
                      id="new-pass"
                      type="password"
                      required
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      placeholder="Minimal 8 karakter"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <Label htmlFor="confirm-pass">Konfirmasi Kata Sandi Baru</Label>
                    <Input
                      id="confirm-pass"
                      type="password"
                      required
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      placeholder="Ulangi kata sandi baru"
                    />
                  </div>

                  <div className="pt-2">
                    <Button
                      type="submit"
                      disabled={updatePassword.isPending || !newPassword || !confirmPassword}
                      className="gap-2"
                    >
                      <KeyRound className="size-4" />
                      {updatePassword.isPending ? "Memproses..." : "Perbarui Kata Sandi"}
                    </Button>
                  </div>
                </form>
              </Panel>
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </AppShell>
  );
}
