import { createFileRoute, Outlet, redirect } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import { isRouteAllowedForDept } from "@/lib/departmentPermissions";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async ({ location }) => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth/login" });

    const user = data.user;
    const targetPath = location.pathname;

    // Ambil data departemen dan role pengguna
    const [profileRes, rolesRes] = await Promise.all([
      supabase.from("profiles").select("department").eq("id", user.id).maybeSingle(),
      supabase.from("user_roles").select("role").eq("user_id", user.id),
    ]);

    const isSuperAdmin = (rolesRes.data ?? []).some((r: any) => r.role === "admin");
    const department = profileRes.data?.department;

    // Validasi hak akses departemen pada frontend URL route
    if (!isRouteAllowedForDept(targetPath, department, isSuperAdmin)) {
      // Jika rute diblokir untuk departemen pengguna, alihkan ke halaman yang diizinkan
      if (
        targetPath !== "/dashboard" &&
        isRouteAllowedForDept("/dashboard", department, isSuperAdmin)
      ) {
        throw redirect({ to: "/dashboard" });
      }
      if (
        targetPath !== "/products" &&
        isRouteAllowedForDept("/products", department, isSuperAdmin)
      ) {
        throw redirect({ to: "/products" });
      }
      if (targetPath !== "/profile") {
        throw redirect({ to: "/profile" });
      }
    }

    return { user, department, isSuperAdmin };
  },
  component: () => <Outlet />,
});
