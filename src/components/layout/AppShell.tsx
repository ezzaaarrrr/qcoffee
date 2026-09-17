import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";
import {
  LayoutDashboard,
  ClipboardList,
  FlaskConical,
  Grid2x2,
  Flame,
  ClipboardCheck,
  Settings,
  Package,
  Shield,
  PanelLeftClose,
  PanelLeftOpen,
  LogOut,
  User,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/hooks/useAuth";
import { ROLE_LABELS, type AppRole } from "@/lib/domain";
import { cn } from "@/lib/utils";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type NavItem = { to: string; label: string; icon: typeof LayoutDashboard; adminOnly?: boolean };

const OPERASIONAL: NavItem[] = [
  { to: "/dashboard", label: "Dashboard OBS Sparepart", icon: LayoutDashboard },
  { to: "/checklists", label: "Dashboard Checklist", icon: ClipboardList },
  { to: "/formulasi", label: "Formulasi Mixing", icon: FlaskConical },
  { to: "/grinding", label: "Proses Grinding", icon: Grid2x2 },
  { to: "/roasting", label: "Proses Roasting", icon: Flame },
];

const MANAJEMEN: NavItem[] = [
  { to: "/approvals", label: "Approval Center", icon: ClipboardCheck },
  { to: "/products", label: "Gudang & Master Barang", icon: Package },
  { to: "/profile", label: "Pengaturan Akun", icon: User },
  { to: "/settings", label: "Manajemen User", icon: Settings, adminOnly: true },
  { to: "/roles", label: "Hak Akses & Departemen", icon: Shield, adminOnly: true },
];

export function AppShell({
  breadcrumb,
  actions,
  children,
}: {
  breadcrumb: string;
  actions?: ReactNode;
  children: ReactNode;
}) {
  const [collapsed, setCollapsed] = useState(false);
  const { profile, roles, isAdmin } = useCurrentUser();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (s) => s.location.pathname });

  const initials = (profile?.full_name || profile?.email || "??")
    .split(" ")
    .map((p) => p[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  async function handleSignOut() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth/login", replace: true });
  }

  const permissionsQuery = useQuery({
    queryKey: ["role_permissions"],
    queryFn: async () => {
      const { data, error } = await (supabase as any).from("role_permissions").select("*");
      if (error) {
        const defaults: Record<string, boolean> = {};
        (Object.keys(ROLE_LABELS) as AppRole[]).forEach((role) => {
          [...OPERASIONAL, ...MANAJEMEN].forEach((route) => {
            if (role === "admin" || role === "qc_field") {
              defaults[`${role}:${route.to}`] = true;
            } else {
              defaults[`${role}:${route.to}`] = route.to === "/approvals";
            }
          });
        });
        return defaults;
      }
      const map: Record<string, boolean> = {};
      (data ?? []).forEach((item: any) => {
        map[`${item.role}:${item.route_path}`] = item.can_access;
      });
      return map;
    },
  });

  const isNavAllowed = (path: string) => {
    if (isAdmin) return true;
    if (!roles || roles.length === 0) return false;
    return roles.some((r) => {
      const key = `${r}:${path}`;
      if (permissionsQuery.data && key in permissionsQuery.data) {
        return permissionsQuery.data[key];
      }
      if (r === "qc_field") return true;
      return path === "/approvals";
    });
  };

  const visibleOperasional = OPERASIONAL.filter(
    (item) => (!item.adminOnly || isAdmin) && isNavAllowed(item.to)
  );
  const visibleManajemen = MANAJEMEN.filter(
    (item) => (!item.adminOnly || isAdmin) && isNavAllowed(item.to)
  );

  const renderNav = (items: NavItem[]) =>
    items.map((item) => {
      const active = pathname === item.to;
      const Icon = item.icon;
      return (
        <Link
          key={item.to}
          to={item.to}
          className={cn(
            "flex items-center gap-3 rounded-sm px-3 py-2 text-sm transition-colors",
            active
              ? "bg-foreground font-medium text-background"
              : "text-muted-foreground hover:bg-surface-muted hover:text-foreground",
          )}
        >
          <Icon className="size-4 shrink-0" />
          {!collapsed && <span className="truncate">{item.label}</span>}
        </Link>
      );
    });

  return (
    <div className="flex h-screen overflow-hidden bg-background font-sans text-foreground">
      <aside
        className={cn(
          "flex h-screen shrink-0 flex-col border-r border-border bg-surface transition-[width] duration-200 sticky top-0 overflow-y-auto",
          collapsed ? "w-[68px]" : "w-64",
        )}
      >
        <div className="border-b border-border p-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex size-8 shrink-0 items-center justify-center rounded-sm bg-foreground">
              <div className="size-4 bg-primary" />
            </div>
            {!collapsed && (
              <span className="text-xl font-bold uppercase tracking-tighter">
                Q-Coffee <span className="text-primary">M2</span>
              </span>
            )}
          </div>
        </div>

        <nav className="flex-1 space-y-1 p-3 overflow-y-auto">
          {visibleOperasional.length > 0 && (
            <>
              {!collapsed && <div className="label-caps mb-2 px-3">Operasional</div>}
              {renderNav(visibleOperasional)}
            </>
          )}

          {visibleManajemen.length > 0 && (
            <>
              {!collapsed && (
                <div
                  className={cn(
                    "label-caps mb-2 px-3",
                    visibleOperasional.length > 0 ? "mt-8" : "mt-2",
                  )}
                >
                  Manajemen
                </div>
              )}
              {collapsed && visibleOperasional.length > 0 && (
                <div className="my-3 border-t border-border" />
              )}
              {renderNav(visibleManajemen)}
            </>
          )}
        </nav>

        <div className="border-t border-border p-3 shrink-0">
          <button
            onClick={() => setCollapsed((c) => !c)}
            className="flex w-full items-center gap-3 rounded-sm px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-surface-muted hover:text-foreground"
          >
            {collapsed ? (
              <PanelLeftOpen className="size-4" />
            ) : (
              <>
                <PanelLeftClose className="size-4" /> <span>Tutup Sidebar</span>
              </>
            )}
          </button>
          {!collapsed && (
            <Link to="/profile" className="mt-2 flex items-center gap-3 px-3 py-2 rounded hover:bg-surface-muted transition-colors">
              <div className="grid size-8 shrink-0 place-items-center rounded-full bg-surface-muted font-mono text-xs">
                {initials}
              </div>
              <div className="flex min-w-0 flex-col">
                <span className="truncate text-xs font-semibold leading-tight">
                  {profile?.full_name || profile?.email || "Pengguna"}
                </span>
                <span className="truncate text-[10px] text-muted-foreground">
                  {roles.map((r) => ROLE_LABELS[r]).join(", ") || "Tanpa Peran"}
                </span>
              </div>
            </Link>
          )}
        </div>
      </aside>

      <main className="flex min-w-0 flex-1 flex-col h-screen overflow-hidden">
        <header className="flex h-16 shrink-0 items-center justify-between border-b border-border bg-surface px-8 sticky top-0 z-10">
          <div className="flex items-center gap-4 text-sm">
            <span className="text-muted-foreground">Dashboard</span>
            <span className="text-muted-foreground">/</span>
            <span className="font-medium">{breadcrumb}</span>
          </div>
          <div className="flex items-center gap-3">
            {actions}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button className="grid size-8 place-items-center rounded-full bg-surface-muted font-mono text-xs transition-colors hover:bg-border">
                  {initials}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-56">
                <DropdownMenuLabel>
                  <div className="text-sm font-semibold">{profile?.full_name || "Pengguna"}</div>
                  <div className="text-xs font-normal text-muted-foreground">{profile?.email}</div>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                <DropdownMenuItem asChild>
                  <Link to="/profile" className="cursor-pointer">
                    <User className="mr-2 size-4" /> Pengaturan Akun
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleSignOut}>
                  <LogOut className="mr-2 size-4" /> Keluar
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </header>

        <div className="flex-1 overflow-y-auto p-8">{children}</div>
      </main>
    </div>
  );
}
