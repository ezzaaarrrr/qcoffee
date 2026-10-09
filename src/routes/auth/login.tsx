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
      { title: "Masuk — GDSPM2" },
      {
        name: "description",
        content: "Masuk ke sistem Management Sparepart M2.",
      },
    ],
  }),
  component: LoginPage,
});

/** Helper untuk mengumpulkan seluruh calon email akun berdasarkan role yang dipilih */
function getCandidateEmailsForRole(targetRole: AppRole): string[] {
  const candidates: string[] = [];

  // 1. Ambil akun yang tersimpan secara lokal khusus role ini
  const cachedRoleEmail = localStorage.getItem(`role_auth_email_${targetRole}`);
  if (cachedRoleEmail?.trim()) {
    candidates.push(cachedRoleEmail.trim().toLowerCase());
  }

  // 2. Ambil dari mapping multi-akun role yang pernah terdaftar di browser ini
  try {
    const rawMap = localStorage.getItem("role_accounts_map");
    if (rawMap) {
      const map = JSON.parse(rawMap);
      const list = map[targetRole];
      if (Array.isArray(list)) {
        list.forEach((em) => {
          if (typeof em === "string" && em.trim()) candidates.push(em.trim().toLowerCase());
        });
      }
      // Akun Super Admin dapat mengakses semua role
      if (map["admin"] && Array.isArray(map["admin"])) {
        map["admin"].forEach((em: string) => {
          if (typeof em === "string" && em.trim()) candidates.push(em.trim().toLowerCase());
        });
      }
    }
  } catch {}

  // 3. Akun aktif terakhir di perangkat ini
  const lastActive = localStorage.getItem("last_active_account_email");
  if (lastActive?.trim()) {
    candidates.push(lastActive.trim().toLowerCase());
  }

  // 4. Riwayat seluruh email yang pernah diketahui di browser
  try {
    const rawAll = localStorage.getItem("all_known_account_emails");
    if (rawAll) {
      const list = JSON.parse(rawAll);
      if (Array.isArray(list)) {
        list.forEach((em) => {
          if (typeof em === "string" && em.trim()) candidates.push(em.trim().toLowerCase());
        });
      }
    }
  } catch {}

  // 5. Pola email bawaan/standar sistem sesuai masing-masing role & departemen
  const roleSpecificEmails: Record<AppRole, string[]> = {
    prod_process_uh: [
      "ground2@gmail.com",
      "gdsp1201@gmail.com",
      "prod_process_uh@gmail.com",
      "sparepart@gmail.com",
      "warehouse@gmail.com",
      "gudang@gmail.com",
      "prod_process_uh@qcoffee.com",
      "prod_process_uh@coffee.m2",
      "unit_head@gmail.com",
    ],
    qc_field: [
      "goldasharon@gmail.com",
      "ezzaaarrrr@gmail.com",
      "ci1201@gmail.com",
      "qc_field@gmail.com",
      "qc@gmail.com",
      "ci@gmail.com",
      "qc_field@qcoffee.com",
      "qc_field@coffee.m2",
      "quality@gmail.com",
      "continuous_improvement@gmail.com",
    ],
    admin_process: [
      "ezzaaarrrr@gmail.com",
      "ck1201@gmail.com",
      "admin_process@gmail.com",
      "produksi@gmail.com",
      "produksi_cheking@gmail.com",
      "cheking@gmail.com",
      "admin_process@qcoffee.com",
      "admin_process@coffee.m2",
      "operator@gmail.com",
    ],
    admin: [
      "admin@gmail.com",
      "superadmin@gmail.com",
      "admin@qcoffee.com",
      "admin@coffee.m2",
      "ezzaaarrrr@gmail.com",
    ],
  };

  const defaults = roleSpecificEmails[targetRole] || [];
  defaults.forEach((em) => candidates.push(em.toLowerCase()));

  // 6. Akun Super Admin bawaan sebagai fallback akses universal
  candidates.push("admin@gmail.com");
  candidates.push("superadmin@gmail.com");

  return Array.from(new Set(candidates.filter((e) => Boolean(e) && e.includes("@"))));
}

function LoginPage() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [role, setRole] = useState<AppRole>(() => {
    return (localStorage.getItem("last_active_role") as AppRole) || "prod_process_uh";
  });
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [customEmail, setCustomEmail] = useState("");
  const [showCustomEmail, setShowCustomEmail] = useState(false);
  const [errorMessage, setErrorMessage] = useState<{
    title: string;
    desc: string;
    type: "credentials" | "role";
  } | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) navigate({ to: "/dashboard", replace: true });
    });
  }, [navigate]);

  const handleRoleChange = (newRole: AppRole) => {
    setRole(newRole);
    setErrorMessage(null);
  };

  async function handleSignIn(e: React.FormEvent) {
    e.preventDefault();
    setErrorMessage(null);

    // Validasi input awal kata sandi
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
      // 1. Kumpulkan seluruh kandidat email akun untuk role yang dipilih
      const candidateEmails = getCandidateEmailsForRole(role);

      // Jika user menginput email spesifik, prioritaskan di urutan paling awal
      if (customEmail.trim() && customEmail.includes("@")) {
        candidateEmails.unshift(customEmail.trim().toLowerCase());
      }

      // Coba ambil dari database RPC Supabase jika fungsi terpasang
      try {
        const { data: rpcEmails, error: rpcError } = await (supabase as any).rpc(
          "get_auth_emails_by_role",
          {
            p_role: role,
          },
        );

        if (!rpcError && Array.isArray(rpcEmails) && rpcEmails.length > 0) {
          rpcEmails.forEach((item: any) => {
            const em = typeof item === "string" ? item : item?.email;
            if (em && typeof em === "string" && em.trim()) {
              candidateEmails.unshift(em.trim().toLowerCase());
            }
          });
        }
      } catch (err) {
        console.warn("RPC get_auth_emails_by_role check:", err);
      }

      const uniqueEmails = Array.from(new Set(candidateEmails.filter(Boolean)));

      if (uniqueEmails.length === 0) {
        setLoading(false);
        const title = "Akun Tidak Ditemukan";
        const desc = `Belum ada akun yang terdaftar untuk ${ROLE_LABELS[role]}. Silakan hubungi Super Admin atau daftar akun baru.`;
        setErrorMessage({ title, desc, type: "credentials" });
        toast.error(title, { description: desc });
        return;
      }

      // 2. Autentikasi dengan Supabase Auth menggunakan kata sandi yang diinput
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
        let title = "Kata Sandi Salah";
        let desc = `Kata sandi yang Anda masukkan tidak cocok untuk ${ROLE_LABELS[role]}. Silakan periksa kembali kata sandi Anda.`;

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

        // Jika role yang dipilih tidak sesuai dan user bukan Super Admin
        if (!hasSelectedRole && !isSuperAdmin) {
          await supabase.auth.signOut();
          setLoading(false);

          const actualRoleNames = registeredRoles.map((r) => ROLE_LABELS[r] || r).join(", ");

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

      // 4. Simpan riwayat login role yang berhasil ke localStorage
      if (authenticatedEmail) {
        localStorage.setItem(`role_auth_email_${role}`, authenticatedEmail);
        localStorage.setItem("last_active_account_email", authenticatedEmail);
        localStorage.setItem("last_active_role", role);

        try {
          const rawMap = localStorage.getItem("role_accounts_map");
          const map = rawMap ? JSON.parse(rawMap) : {};
          const list = Array.isArray(map[role]) ? map[role] : [];
          if (!list.includes(authenticatedEmail)) {
            list.push(authenticatedEmail);
          }
          map[role] = list;
          localStorage.setItem("role_accounts_map", JSON.stringify(map));
        } catch {}
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
              <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-white"></h1>
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
              <Label
                htmlFor="role-select"
                className="flex items-center gap-1.5 text-xs text-blue-100"
              >
                <UserCheck className="size-3.5 text-cyan-400" />
                <span> User & Role</span>
              </Label>
              <Select value={role} onValueChange={(v) => handleRoleChange(v as AppRole)}>
                <SelectTrigger
                  id="role-select"
                  className="w-full h-10 text-xs bg-[#05132d] border-blue-900/60 text-white focus:ring-cyan-500 cursor-pointer"
                >
                  <SelectValue placeholder="Pilih Peran / Hak Akses" />
                </SelectTrigger>
                <SelectContent className="bg-[#081b3d] border-blue-900 text-white">
                  <SelectItem value="admin_process">{ROLE_LABELS["admin_process"]}</SelectItem>
                  <SelectItem value="qc_field">{ROLE_LABELS["qc_field"]}</SelectItem>
                  <SelectItem value="prod_process_uh">{ROLE_LABELS["prod_process_uh"]}</SelectItem>
                  <SelectItem value="admin">{ROLE_LABELS["admin"]}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Opsi Email Spesifik / Manual (Opsional) */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[11px]">
                <button
                  type="button"
                  onClick={() => setShowCustomEmail(!showCustomEmail)}
                  className="text-cyan-400 hover:text-cyan-300 font-medium transition-colors focus:outline-none cursor-pointer flex items-center gap-1"
                >
                  <Mail className="size-3" />
                  <span>
                    {showCustomEmail
                      ? "Sembunyikan email khusus"
                      : "Ingin pakai email terdaftar tertentu?"}
                  </span>
                </button>
                {showCustomEmail && <span className="text-blue-300/50 text-[10px]">Opsional</span>}
              </div>
              {showCustomEmail && (
                <Input
                  id="custom-email"
                  type="email"
                  autoComplete="email"
                  value={customEmail}
                  onChange={(e) => {
                    setCustomEmail(e.target.value);
                    setErrorMessage(null);
                  }}
                  placeholder="Contoh: ground2@gmail.com"
                  className="h-10 text-xs bg-[#05132d] border-blue-900/60 text-white placeholder:text-blue-300/40 focus:border-cyan-500"
                />
              )}
            </div>

            {/* Input 2: Kata Sandi */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label
                  htmlFor="password"
                  className="flex items-center gap-1.5 text-xs text-blue-100"
                >
                  <Lock className="size-3.5 text-blue-300/70" />
                  <span>Kata Sandi</span>
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 font-medium transition-colors focus:outline-none cursor-pointer"
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
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-blue-300/60 hover:text-cyan-400 transition-colors p-1 rounded hover:bg-blue-950/50 cursor-pointer"
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
              className="w-full h-10 mt-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-500 hover:to-cyan-500 text-white font-bold text-xs shadow-lg shadow-blue-600/30 transition-all cursor-pointer"
              disabled={loading}
            >
              {loading ? "Memverifikasi Akses..." : "Masuk ke Sistem"}
            </Button>
          </form>

          <p className="mt-6 text-center text-xs text-blue-200/60">
            Belum punya akun?{" "}
            <Link
              to="/auth/register"
              className="font-semibold text-cyan-400 hover:text-cyan-300 underline underline-offset-4"
            >
              Daftar sekarang
            </Link>
          </p>
        </div>
      </div>
    </div>
  );
}
