import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";

export const Route = createFileRoute("/auth/register")({
  head: () => ({
    meta: [
      { title: "Daftar — GDSPM2" },
      {
        name: "description",
        content: "Buat akun baru.",
      },
    ],
  }),
  component: RegisterPage,
});

function RegisterPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<AppRole>("admin_process");

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignUp(e: React.FormEvent) {
    e.preventDefault();
    if (fullName.trim().length < 3) {
      toast.error("Nama lengkap minimal 3 karakter");
      return;
    }
    if (password.length < 8) {
      toast.error("Kata sandi minimal 8 karakter");
      return;
    }
    setLoading(true);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Tidak ada emailRedirectTo — konfirmasi email dinonaktifkan
        data: { full_name: fullName, role, department: ROLE_LABELS[role] },
      },
    });
    setLoading(false);

    if (error) {
      toast.error("Gagal mendaftar", { description: error.message });
      return;
    }

    // Supabase otomatis membuat session saat email confirmation dinonaktifkan.
    // Sign out terlebih dahulu agar user wajib login secara eksplisit.
    await supabase.auth.signOut();

    // Simpan email terdaftar untuk role ini agar bisa langsung diautentikasi dengan role & password
    const regEmail = email.trim().toLowerCase();
    localStorage.setItem(`role_auth_email_${role}`, regEmail);
    localStorage.setItem("last_active_account_email", regEmail);
    localStorage.setItem("last_active_role", role);

    try {
      const rawMap = localStorage.getItem("role_accounts_map");
      const map = rawMap ? JSON.parse(rawMap) : {};
      const list = Array.isArray(map[role]) ? map[role] : [];
      if (!list.includes(regEmail)) list.push(regEmail);
      map[role] = list;
      localStorage.setItem("role_accounts_map", JSON.stringify(map));

      const rawKnown = localStorage.getItem("all_known_account_emails");
      const knownList = rawKnown ? JSON.parse(rawKnown) : [];
      if (Array.isArray(knownList) && !knownList.includes(regEmail)) {
        knownList.push(regEmail);
        localStorage.setItem("all_known_account_emails", JSON.stringify(knownList));
      }
    } catch {}

    toast.success("Akun berhasil dibuat!", {
      description: "Silakan masuk dengan memilih departemen/role dan memasukkan kata sandi Anda.",
    });
    navigate({ to: "/auth/login", replace: true });
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-4 py-12">
      <div className="w-full max-w-md rise-in">
        {/* Logo */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex size-9 items-center justify-center rounded-sm bg-foreground">
            <div className="size-4 bg-primary" />
          </div>
          <span className="text-2xl font-bold uppercase tracking-tighter">
            Q-Coffee <span className="text-primary">M2</span>
          </span>
        </div>

        <h1 className="text-xl font-bold tracking-tight">Buat Akun Baru</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Daftarkan diri Anda untuk mengakses sistem checklist produksi.
        </p>

        <div className="border border-border bg-surface p-6">
          <form onSubmit={handleSignUp} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="fullName">Nama Lengkap</Label>
              <Input
                id="fullName"
                required
                autoComplete="name"
                maxLength={100}
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                placeholder="Nama sesuai ID karyawan"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="email-reg">Email</Label>
              <Input
                id="email-reg"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="nama@perusahaan.co.id"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="password-reg">Kata Sandi</Label>
              <Input
                id="password-reg"
                type="password"
                required
                autoComplete="new-password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Minimal 8 karakter"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="role-select">Departemen / Peran</Label>
              <Select value={role} onValueChange={(v) => setRole(v as AppRole)}>
                <SelectTrigger id="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_process">{ROLE_LABELS["admin_process"]}</SelectItem>
                  <SelectItem value="qc_field">{ROLE_LABELS["qc_field"]}</SelectItem>
                  <SelectItem value="prod_process_uh">{ROLE_LABELS["prod_process_uh"]}</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <Button id="btn-register" type="submit" className="w-full" disabled={loading}>
              {loading ? "Memproses..." : "Buat Akun"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Sudah punya akun?{" "}
            <Link
              to="/auth/login"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              Masuk di sini
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
