import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ShieldAlert, Lock, Mail, UserCheck } from "lucide-react";
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

export const Route = createFileRoute("/auth/login")({
  head: () => ({
    meta: [
      { title: "Masuk — Q-Coffee M2" },
      {
        name: "description",
        content: "Masuk ke sistem checklist digital produksi kopi Q-Coffee M2.",
      },
    ],
  }),
  component: LoginPage,
});

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<AppRole>("admin_process");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<{ title: string; desc: string; type: "credentials" | "role" } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    // Validasi input awal
    if (!email.trim() || !password) {
      setErrorMessage({
        title: "Input Tidak Lengkap",
        desc: "Silakan isi email dan kata sandi Anda.",
        type: "credentials",
      });
      return;
    }

    setLoading(true);

    // 1. Authenticate Email & Password via Supabase Auth
    const { data, error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (error) {
      setLoading(false);
      let title = "Gagal Masuk";
      let desc = "Email atau kata sandi yang Anda masukkan salah. Silakan periksa kembali.";

      if (error.message.toLowerCase().includes("email not confirmed")) {
        title = "Email Belum Dikonfirmasi";
        desc = "Akun email Anda belum diverifikasi. Silakan hubungi administrator sistem.";
      } else if (error.message.toLowerCase().includes("invalid login credentials")) {
        title = "Email atau Kata Sandi Salah";
        desc = "Kombinasi email dan kata sandi tidak cocok dengan data akun kami.";
      } else if (error.message.toLowerCase().includes("too many requests")) {
        title = "Terlalu Banyak Percobaan";
        desc = "Terlalu banyak percobaan login yang gagal. Silakan tunggu beberapa saat.";
      }

      setErrorMessage({ title, desc, type: "credentials" });
      toast.error(title, { description: desc });
      return;
    }

    // 2. Validasi Hak Akses / Role Akun
    if (data.user) {
      try {
        const { data: userRoles, error: rolesError } = await supabase
          .from("user_roles")
          .select("role")
          .eq("user_id", data.user.id);

        if (!rolesError && userRoles && userRoles.length > 0) {
          const registeredRoles = userRoles.map((r) => r.role as AppRole);
          const hasSelectedRole = registeredRoles.includes(role);
          const isSuperAdmin = registeredRoles.includes("admin");

          // Jika role yang dipilih salah dan user bukan Super Admin
          if (!hasSelectedRole && !isSuperAdmin) {
            await supabase.auth.signOut();
            setLoading(false);

            const actualRoleNames = registeredRoles
              .map((r) => ROLE_LABELS[r] || r)
              .join(", ");

            const errorDetail = {
              title: "Hak Akses (Role) Tidak Sesuai",
              desc: `Akun Anda terdaftar sebagai "${actualRoleNames}", bukan sebagai "${ROLE_LABELS[role]}". Silakan pilih role yang sesuai pada dropdown di atas.`,
              type: "role" as const,
            };

            setErrorMessage(errorDetail);
            toast.error(errorDetail.title, {
              description: errorDetail.desc,
              duration: 5000,
            });
            return;
          }
        }
      } catch (err) {
        console.error("Error verifying user roles:", err);
      }
    }

    setLoading(false);
    toast.success("Berhasil masuk", {
      description: `Selamat datang! Masuk sebagai ${ROLE_LABELS[role]}`,
    });
    navigate({ to: "/dashboard", replace: true });
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

        <h1 className="text-xl font-bold tracking-tight">Masuk ke Akun</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground">
          Pilih hak akses (role) dan masukkan informasi akun Anda.
        </p>

        {/* Alert Pesan Kesalahan Interaktif */}
        {errorMessage && (
          <div
            className={`mb-5 flex items-start gap-3 rounded border p-4 text-sm ${
              errorMessage.type === "role"
                ? "border-amber-500/30 bg-amber-500/10 text-amber-900 dark:text-amber-200"
                : "border-destructive/30 bg-destructive/10 text-destructive"
            }`}
          >
            {errorMessage.type === "role" ? (
              <ShieldAlert className="mt-0.5 size-5 shrink-0 text-amber-600" />
            ) : (
              <AlertCircle className="mt-0.5 size-5 shrink-0 text-destructive" />
            )}
            <div className="space-y-1">
              <p className="font-semibold">{errorMessage.title}</p>
              <p className="text-xs leading-relaxed opacity-90">{errorMessage.desc}</p>
            </div>
          </div>
        )}

        <div className="border border-border bg-surface p-6 shadow-sm">
          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Input 1: Role / Hak Akses */}
            <div className="space-y-1.5">
              <Label htmlFor="role-select" className="flex items-center gap-1.5">
                <UserCheck className="size-3.5 text-primary" />
                <span>Masuk Sebagai (Role / Hak Akses)</span>
              </Label>
              <Select
                value={role}
                onValueChange={(v) => {
                  setRole(v as AppRole);
                  setErrorMessage(null);
                }}
              >
                <SelectTrigger id="role-select" className="w-full">
                  <SelectValue placeholder="Pilih Peran / Hak Akses" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="admin_process">
                    {ROLE_LABELS["admin_process"]}
                  </SelectItem>
                  <SelectItem value="qc_field">
                    {ROLE_LABELS["qc_field"]}
                  </SelectItem>
                  <SelectItem value="prod_process_uh">
                    {ROLE_LABELS["prod_process_uh"]}
                  </SelectItem>
                  <SelectItem value="admin">
                    {ROLE_LABELS["admin"]}
                  </SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Input 2: Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email" className="flex items-center gap-1.5">
                <Mail className="size-3.5 text-muted-foreground" />
                <span>Email</span>
              </Label>
              <Input
                id="email"
                type="email"
                required
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="nama@perusahaan.co.id"
              />
            </div>

            {/* Input 3: Password */}
            <div className="space-y-1.5">
              <Label htmlFor="password" className="flex items-center gap-1.5">
                <Lock className="size-3.5 text-muted-foreground" />
                <span>Kata Sandi</span>
              </Label>
              <Input
                id="password"
                type="password"
                required
                autoComplete="current-password"
                value={password}
                onChange={(e) => {
                  setPassword(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="••••••••"
              />
            </div>

            <Button id="btn-login" type="submit" className="w-full mt-2" disabled={loading}>
              {loading ? "Memverifikasi Akun..." : "Masuk ke Sistem"}
            </Button>
          </form>

          <p className="mt-5 text-center text-sm text-muted-foreground">
            Belum punya akun?{" "}
            <Link to="/auth/register" className="font-medium text-primary underline-offset-4 hover:underline">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
