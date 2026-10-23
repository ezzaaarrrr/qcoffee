import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  isRouteAllowedForDept,
  normalizeDepartmentKey,
  fetchRemoteDeptPermissions,
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
      supabase.from("profiles").select("department").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
      fetchRemoteDeptPermissions(supabase),
    ]);

    const roles = (rolesRes.data ?? []).map((r: any) => r.role);
    const isSuperAdmin = roles.includes("admin");
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

    return { user, department, isSuperAdmin, roles, remotePermissions };
  },
  component: () => <Outlet />,
});
