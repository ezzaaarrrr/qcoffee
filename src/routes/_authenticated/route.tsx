import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  isRouteAllowedForDept,
  normalizeDepartmentKey,
  fetchRemoteDeptPermissions,
  checkIsSuperAdminAccess,
} from "@/lib/departmentPermissions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth/login" });

    const user = data.user;
    const targetPath = location.pathname;

    // Ambil data profil, role, dan matriks hak akses live dari Supabase
    const [profileRes, rolesRes, remotePermissions] = await Promise.all([
      supabase.from("profiles").select("department, full_name").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      fetchRemoteDeptPermissions(supabase),
    ]);

    const roles = (rolesRes.data ?? []).map((r: any) => r.role);
    // Deteksi Super Admin tahan banting: role DB 'admin' ATAU departemen
    // "Super Admin" / pilihan login / email — agar guard URL memperlakukan
    // akses "Super Admin" sama seperti admin penuh (semua menu gudang & panel).
    const isSuperAdmin = checkIsSuperAdminAccess(
      {
        full_name: profileRes.data?.full_name ?? null,
        department: profileRes.data?.department ?? null,
        email: user.email ?? null,
      },
      roles,
    );
    const department = normalizeDepartmentKey(profileRes.data?.department, roles);

    // Validasi hak akses departemen pada URL route langsung
    const isAllowed = isRouteAllowedForDept(
      targetPath,
      department,
      isSuperAdmin,
      remotePermissions,
      roles,
    );

    if (!isAllowed) {
      // Cari halaman alternatif yang diizinkan untuk departemen ini
      const candidateFallbacks = [
        "/dashboard",
        "/approvals",
        "/products",
        "/checklists",
        "/formulasi",
        "/grinding",
        "/roasting",
        "/profile",
      ];

      const fallbackRoute =
        candidateFallbacks.find(
          (candidate) =>
            candidate !== targetPath &&
            isRouteAllowedForDept(candidate, department, isSuperAdmin, remotePermissions, roles),
        ) || "/profile";

      throw redirect({ to: fallbackRoute });
    }

    // ── VALIDASI TAB /products (?tab=...) TIDAK DAPAT DILEWATI VIA URL ─────────
    // Menu "Master Barang" (tab=master) hanya untuk GDSP1201 & Super Admin —
    // sama seperti aturan menu di sidebar AppShell. TEKNIK & departemen lain
    // yang mencoba membuka ?tab=master langsung diarahkan ke daftar OBS utama.
    if (targetPath === "/products") {
      const searchObj = (location.search ?? {}) as Record<string, unknown>;
      const requestedTab = String(searchObj["tab"] ?? "");
      const isGdspLike =
        isSuperAdmin ||
        (roles.includes("prod_process_uh") && department !== "TEKNIK") ||
        department === "Super Admin";

      if (requestedTab === "master" && !isGdspLike) {
        throw redirect({ to: "/products", search: { tab: "items" } });
      }
    }

    return { user, department, isSuperAdmin, roles, remotePermissions };
  },
  component: () => <Outlet />,
});
