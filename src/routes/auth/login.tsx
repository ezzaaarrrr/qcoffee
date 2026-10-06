import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { AlertCircle, ShieldAlert, Lock, UserCheck, Eye, EyeOff, Mail } from "lucide-react";
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
  const [role, setRole] = useState<AppRole>(() => {
    return (localStorage.getItem("last_active_role") as AppRole) || "prod_process_uh";
  });
  const [email, setEmail] = useState(() => {
    const savedRole = (localStorage.getItem("last_active_role") as AppRole) || "prod_process_uh";
    return localStorage.getItem(`role_auth_email_${savedRole}`) || localStorage.getItem("last_active_account_email") || "";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<{ title: string; desc: string; type: "credentials" | "role" } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleRoleChange = (newRole: AppRole) => {
    setRole(newRole);
    setErrorMessage(null);
    const cached = localStorage.getItem(`role_auth_email_${newRole}`);
    if (cached) {
      setEmail(cached);
    }
  };

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    // Validasi input awal
    if (!password) {
      setErrorMessage({
        title: "Kata Sandi Belum Diisi",
        desc: "Silakan masukkan kata sandi akun Anda.",
        type: "credentials",
      });
      return;
    }

    setLoading(true);

    try {
      // 1. Kumpulkan calon email akun untuk autentikasi
      const candidateEmails: string[] = [];

      // A. Jika user memasukkan email secara manual
      if (email.trim()) {
        candidateEmails.push(email.trim().toLowerCase());
      } else {
        // B. Coba ambil email dari database RPC Supabase (SECURITY DEFINER)
        try {
          const { data: rpcEmails, error: rpcError } = await (supabase as any).rpc("get_auth_emails_by_role", {
            p_role: role,
          });

          if (!rpcError && Array.isArray(rpcEmails) && rpcEmails.length > 0) {
            rpcEmails.forEach((item: any) => {
              const em = typeof item === "string" ? item : item?.email;
              if (em && typeof em === "string" && em.trim()) {
                candidateEmails.push(em.trim().toLowerCase());
              }
            });
          }
        } catch (err) {
          console.warn("RPC get_auth_emails_by_role lookup failed or not deployed:", err);
        }

        // C. Ambil dari cache lokal browser (akun yang tersimpan untuk role ini / user aktif sebelumnya)
        const cachedRoleEmail = localStorage.getItem(`role_auth_email_${role}`);
        if (cachedRoleEmail && cachedRoleEmail.trim()) {
          candidateEmails.push(cachedRoleEmail.trim().toLowerCase());
        }
        const lastKnownEmail = localStorage.getItem("last_active_account_email");
        if (lastKnownEmail && lastKnownEmail.trim()) {
          candidateEmails.push(lastKnownEmail.trim().toLowerCase());
        }

        // D. Fallback kredensial akun bawaan di sistem
        candidateEmails.push(`${role}@gmail.com`);
        candidateEmails.push(`${role}@qcoffee.com`);
        candidateEmails.push(`${role}@coffee.m2`);
        candidateEmails.push("admin@gmail.com");
      }

      const uniqueEmails = Array.from(new Set(candidateEmails.filter(Boolean)));

      if (uniqueEmails.length === 0) {
        setLoading(false);
        const title = "Email Akun Belum Diisi";
        const desc = `Silakan masukkan email akun yang terdaftar untuk ${ROLE_LABELS[role]}.`;
        setErrorMessage({ title, desc, type: "credentials" });
        toast.error(title, { description: desc });
        return;
      }

      // 2. Coba autentikasi menggunakan Supabase Auth dengan kata sandi yang diinput
      let authenticatedUser: any = null;
      let authenticatedEmail: string | null = null;
      let lastError: any = null;

      for (const candidateEmail of uniqueEmails) {
        const { data: authData, error: authError } = await supabase.auth.signInWithPassword({
          email: candidateEmail,
          password,
        });

        if (!authError && authData?.user) {
          authenticatedUser = authData.user;
          authenticatedEmail = candidateEmail;
          break;
        }

        if (authError) {
          lastError = authError;
        }
      }

      if (!authenticatedUser) {
        setLoading(false);
        let title = "Gagal Masuk";
        let desc = email.trim()
          ? `Kata sandi atau email "${email}" salah untuk ${ROLE_LABELS[role]}. Silakan periksa kembali kata sandi dan email Anda.`
          : `Kata sandi yang Anda masukkan salah untuk ${ROLE_LABELS[role]}, atau email akun Anda belum dimasukkan. Silakan isi kolom Email dengan alamat email yang Anda daftarkan.`;

        if (lastError?.message?.toLowerCase().includes("too many requests")) {
          title = "Terlalu Banyak Percobaan";
          desc = "Terlalu banyak percobaan masuk yang gagal. Silakan tunggu beberapa saat.";
        }

        setErrorMessage({ title, desc, type: "credentials" });
        toast.error(title, { description: desc });
        return;
      }

      // 3. Validasi Hak Akses / Role Akun
      const { data: userRoles, error: rolesError } = await supabase
        .from("user_roles")
        .select("role")
        .eq("user_id", authenticatedUser.id);

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
            desc: `Akun ini terdaftar sebagai "${actualRoleNames}", bukan sebagai "${ROLE_LABELS[role]}". Silakan pilih role yang sesuai pada dropdown di atas.`,
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

      // Simpan riwayat login role yang berhasil
      if (authenticatedEmail) {
        localStorage.setItem(`role_auth_email_${role}`, authenticatedEmail);
        localStorage.setItem("last_active_account_email", authenticatedEmail);
        localStorage.setItem("last_active_role", role);
      }

      setLoading(false);
      toast.success("Berhasil masuk", {
        description: `Selamat datang! Masuk sebagai ${ROLE_LABELS[role]}`,
      });
      navigate({ to: "/dashboard", replace: true });
    } catch (err: any) {
      setLoading(false);
      console.error("Login process error:", err);
      toast.error("Terjadi Kesalahan", {
        description: err.message || "Gagal memproses login. Silakan coba lagi.",
      });
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#030a1a] text-slate-100 p-4 sm:p-6 md:p-8">
      <div className="w-full max-w-4xl grid grid-cols-1 md:grid-cols-2 rounded-2xl overflow-hidden border border-blue-900/40 shadow-[0_20px_50px_rgba(2,13,38,0.9)] bg-[#071633]">
        {/* Left Side: Uploaded Branding Image */}
        <div className="relative flex flex-col items-center justify-center p-8 bg-[#041129] border-b md:border-b-0 md:border-r border-blue-900/40 min-h-[300px] md:min-h-[520px] overflow-hidden group">
          <div className="absolute inset-0 bg-gradient-to-tr from-[#020917] via-transparent to-blue-500/10 pointer-events-none" />
          <img
            src="/logo-sparepart.png"
            alt="GUDANG SPAREPART M2 - Sparepart Management System"
            className="w-full max-w-[360px] object-contain drop-shadow-[0_15px_30px_rgba(0,0,0,0.7)] transition-all duration-500 group-hover:scale-105"
          />
        </div>

        {/* Right Side: Login Form */}
        <div className="p-6 sm:p-8 md:p-10 flex flex-col justify-center bg-[#081b3d]">
          <div className="mb-6 flex items-center gap-3">
            <img
              src="/logo-sparepart-icon.png"
              alt="Logo Small"
              className="size-11 object-contain rounded-lg border border-blue-500/20 bg-[#041129] p-1 md:hidden shadow-md"
            />
            <div>
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white">
                Masuk ke Akun
              </h1>
              <p className="text-xs text-blue-200/70 mt-1 font-medium">
                GUDANG SPAREPART M2 — Sparepart Management System
              </p>
            </div>
          </div>

          {/* Alert Pesan Kesalahan Interaktif */}
          {errorMessage && (
            <div
              className={`mb-5 flex items-start gap-3 rounded-lg border p-3.5 text-xs ${
                errorMessage.type === "role"
                  ? "border-amber-500/40 bg-amber-500/15 text-amber-200"
                  : "border-rose-500/40 bg-rose-500/15 text-rose-200"
              }`}
            >
              {errorMessage.type === "role" ? (
                <ShieldAlert className="mt-0.5 size-4 shrink-0 text-amber-400" />
              ) : (
                <AlertCircle className="mt-0.5 size-4 shrink-0 text-rose-400" />
              )}
              <div className="space-y-0.5">
                <p className="font-bold text-white">{errorMessage.title}</p>
                <p className="leading-relaxed opacity-90">{errorMessage.desc}</p>
              </div>
            </div>
          )}

          <form onSubmit={handleSignIn} className="space-y-4">
            {/* Input 1: Role / Hak Akses */}
            <div className="space-y-1.5">
              <Label htmlFor="role-select" className="flex items-center gap-1.5 text-xs text-blue-100">
                <UserCheck className="size-3.5 text-cyan-400" />
                <span>Masuk Sebagai (Role / Hak Akses)</span>
              </Label>
              <Select
                value={role}
                onValueChange={(v) => handleRoleChange(v as AppRole)}
              >
                <SelectTrigger id="role-select" className="w-full h-10 text-xs bg-[#05132d] border-blue-900/60 text-white focus:ring-cyan-500">
                  <SelectValue placeholder="Pilih Peran / Hak Akses" />
                </SelectTrigger>
                <SelectContent className="bg-[#081b3d] border-blue-900 text-white">
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

            {/* Input 2: Email Akun */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="email" className="flex items-center gap-1.5 text-xs text-blue-100">
                  <Mail className="size-3.5 text-cyan-400" />
                  <span>Email Akun Terdaftar</span>
                </Label>
                <span className="text-[10px] text-blue-300/60 font-medium">
                  {email ? "Terisi otomatis" : "Ketik email akun"}
                </span>
              </div>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => {
                  setEmail(e.target.value);
                  setErrorMessage(null);
                }}
                placeholder="nama@perusahaan.co.id"
                className="h-10 text-xs bg-[#05132d] border-blue-900/60 text-white placeholder:text-blue-300/40 focus:border-cyan-500"
              />
            </div>

            {/* Input 3: Password dengan Aksi Detail (Show/Hide) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="flex items-center gap-1.5 text-xs text-blue-100">
                  <Lock className="size-3.5 text-blue-300/70" />
                  <span>Kata Sandi</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors focus:outline-none"
                  title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan detail kata sandi"}
                >
                  {showPassword ? (
                    <>
                      <EyeOff className="size-3.5" />
                      <span>Sembunyikan</span>
                    </>
                  ) : (
                    <>
                      <Eye className="size-3.5" />
                      <span>Detail</span>
                    </>
                  )}
                </button>
              </div>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  required
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => {
                    setPassword(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="••••••••"
                  className="h-10 text-xs bg-[#05132d] border-blue-900/60 text-white placeholder:text-blue-300/40 focus:border-cyan-500 pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 hover:text-cyan-400 transition-colors p-1 rounded hover:bg-blue-950/50"
                  tabIndex={-1}
                  title={showPassword ? "Sembunyikan kata sandi" : "Tampilkan detail kata sandi"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
            </div>

            <Button
              id="btn-login"
              type="submit"
              className="w-full h-10 mt-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all"
              disabled={loading}
            >
              {loading ? "Memverifikasi Akun..." : "Masuk ke Sistem"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-blue-200/60">
            Belum punya akun?{" "}
            <Link to="/auth/register" className="font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4">
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
