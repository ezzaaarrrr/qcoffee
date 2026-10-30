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
  const [deptChoice, setDeptChoice] = useState<string>("CK1201");

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

    const roleForDept: Record<string, AppRole> = {
      CK1201: "admin_process",
      CI1201: "qc_field",
      GDSP1201: "prod_process_uh",
      TEKNIK: "prod_process_uh",
    };
    const chosenRole = roleForDept[deptChoice] || "admin_process";

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        // Tidak ada emailRedirectTo — konfirmasi email dinonaktifkan
        data: { full_name: fullName, role: chosenRole, department: deptChoice },
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

    // Simpan email terdaftar untuk role & departemen ini agar bisa langsung diautentikasi dengan user & password
    const regEmail = email.trim().toLowerCase();
    localStorage.setItem(`role_auth_email_${deptChoice}`, regEmail);
    localStorage.setItem(`role_auth_email_${deptChoice.toLowerCase()}`, regEmail);
    localStorage.setItem(`role_auth_email_${chosenRole}`, regEmail);
    localStorage.setItem("last_active_account_email", regEmail);
    localStorage.setItem("last_active_role", chosenRole);
    localStorage.setItem("last_active_dept", deptChoice);
    localStorage.setItem("last_active_access", deptChoice);

    try {
      const rawMap = localStorage.getItem("role_accounts_map");
      const map = rawMap ? JSON.parse(rawMap) : {};
      const list = Array.isArray(map[deptChoice]) ? map[deptChoice] : [];
      if (!list.includes(regEmail)) list.push(regEmail);
      map[deptChoice] = list;

      const roleList = Array.isArray(map[chosenRole]) ? map[chosenRole] : [];
      if (!roleList.includes(regEmail)) roleList.push(regEmail);
      map[chosenRole] = roleList;

      localStorage.setItem("role_accounts_map", JSON.stringify(map));

      const rawKnown = localStorage.getItem("all_known_account_emails");
      const knownList = rawKnown ? JSON.parse(rawKnown) : [];
      if (Array.isArray(knownList) && !knownList.includes(regEmail)) {
        knownList.push(regEmail);
        localStorage.setItem("all_known_account_emails", JSON.stringify(knownList));
      }
    } catch {}

    toast.success("Akun berhasil dibuat!", {
      description: `Silakan masuk dengan memilih ${deptChoice} dan memasukkan kata sandi Anda.`,
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
            GDSP<span className="text-primary">M2</span>
          </span>
        </div>

        <h1 className="text-xl font-bold tracking-tight">Buat Akun Baru</h1>
        <p className="mt-1 mb-6 text-sm text-muted-foreground"></p>

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
              <Label htmlFor="role-select">Departemen / User Akses</Label>
              <Select value={deptChoice} onValueChange={(v) => setDeptChoice(v)}>
                <SelectTrigger id="role-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="CK1201">CK1201 (Operator Ceklis Produksi)</SelectItem>
                  <SelectItem value="CI1201">CI1201 (Continuous Improvement / QC)</SelectItem>
                  <SelectItem value="GDSP1201">
                    GDSP1201 (Admin Gudang & Operasional Sparepart)
                  </SelectItem>
                  <SelectItem value="TEKNIK">TEKNIK (Departemen Teknik & Maintenance)</SelectItem>
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
