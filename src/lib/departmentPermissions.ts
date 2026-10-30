// ==============================================================================
// SISTEM MANAJEMEN HAK AKSES BERDASARKAN DEPARTEMEN & ROLE
// ==============================================================================
import type { AppRole } from "@/lib/domain";

export type AppRouteItem = {
  path: string;
  label: string;
  category: "Operasional" | "Manajemen";
  adminOnly?: boolean;
};

export const SYSTEM_ROUTES: AppRouteItem[] = [
  { path: "/dashboard", label: "DASHBOARD OVERVIEW", category: "Operasional" },
  { path: "/checklists", label: "Dashboard Checklist", category: "Operasional" },
  { path: "/formulasi", label: "Formulasi Mixing", category: "Operasional" },
  { path: "/grinding", label: "Proses Grinding", category: "Operasional" },
  { path: "/roasting", label: "Proses Roasting", category: "Operasional" },
  { path: "/approvals", label: "Approval Center", category: "Manajemen" },
  { path: "/products", label: "Gudang & Master Barang (OBS Sparepart)", category: "Manajemen" },
  { path: "/profile", label: "Pengaturan Akun", category: "Manajemen" },
  { path: "/settings", label: "Manajemen User", category: "Manajemen", adminOnly: true },
  { path: "/roles", label: "Hak Akses & Departemen", category: "Manajemen", adminOnly: true },
];

/** Mapping Relasi Role Sistem ke Departemen Standar */
export const ROLE_TO_DEFAULT_DEPT: Record<AppRole, string> = {
  admin: "Super Admin",
  qc_field: "CI1201",
  admin_process: "CK1201",
  prod_process_uh: "GDSP1201",
};

/** Mapping Relasi Departemen ke Role Sistem */
export const DEPT_TO_ROLE: Record<string, AppRole> = {
  "super admin": "admin",
  sa: "admin",
  ci1201: "qc_field",
  ci: "qc_field",
  ck1201: "admin_process",
  ck: "admin_process",
  gdsp1201: "prod_process_uh",
  gdsp: "prod_process_uh",
  teknik: "prod_process_uh",
  tkn: "prod_process_uh",
};

export type LoginAccessTarget = "CK1201" | "CI1201" | "GDSP1201" | "TEKNIK" | "Super Admin";

export const LOGIN_ACCESS_TARGETS: {
  id: LoginAccessTarget;
  label: string;
  role: AppRole;
  department: string;
  description: string;
}[] = [
  {
    id: "CK1201",
    label: "CK1201",
    role: "admin_process",
    department: "CK1201",
    description: "Operator Admin Ceklis",
  },
  {
    id: "CI1201",
    label: "CI1201",
    role: "qc_field",
    department: "CI1201",
    description: "Departemen Continuous Improvement",
  },
  {
    id: "GDSP1201",
    label: "GDSP1201",
    role: "prod_process_uh",
    department: "GDSP1201",
    description: "Admin Gudang & Operasional Sparepart",
  },
  {
    id: "TEKNIK",
    label: "TEKNIK",
    role: "prod_process_uh",
    department: "TEKNIK",
    description: "Departemen Teknik & Maintenance",
  },
  {
    id: "Super Admin",
    label: "Super Admin",
    role: "admin",
    department: "Super Admin",
    description: "Super Admin System",
  },
];

/** Standar izin bawaan berdasarkan departemen pengguna */
export const DEFAULT_DEPARTMENT_PERMISSIONS: Record<string, Record<string, boolean>> = {
  TEKNIK: {
    "/dashboard": true,
    "/products": true,
    "/approvals": true,
    "/profile": true,
    "/checklists": false,
    "/formulasi": false,
    "/grinding": false,
    "/roasting": false,
    "/settings": false,
    "/roles": false,
  },
  "Super Admin": {
    "/dashboard": true,
    "/checklists": true,
    "/formulasi": true,
    "/grinding": true,
    "/roasting": true,
    "/approvals": true,
    "/products": true,
    "/profile": true,
    "/settings": true,
    "/roles": true,
  },
  CI1201: {
    "/dashboard": true,
    "/checklists": true,
    "/formulasi": true,
    "/grinding": true,
    "/roasting": true,
    "/approvals": true,
    "/products": true,
    "/profile": true,
    "/settings": false,
    "/roles": false,
  },
  CK1201: {
    "/dashboard": false,
    "/checklists": true,
    "/formulasi": true,
    "/grinding": true,
    "/roasting": true,
    "/approvals": true,
    "/products": false,
    "/profile": true,
    "/settings": false,
    "/roles": false,
  },
  GDSP1201: {
    "/dashboard": true,
    "/checklists": false,
    "/formulasi": false,
    "/grinding": false,
    "/roasting": false,
    "/approvals": true,
    "/products": true,
    "/profile": true,
    "/settings": false,
    "/roles": false,
  },
};

export const LOCAL_STORAGE_KEY = "dept_permissions_matrix_v2";

export const LEGACY_DEPARTMENT_NAMES = [
  "Departemen Countinous Improvment",
  "Department Warehouse - Sparepart",
  "Departemen Produksi Cheking",
  "Department Teknik Central Kitchen",
  "Continuous Improvement (CI)",
  "Produksi Central Kitchen",
  "Gudang Sparepart",
];

/** Cek apakah nama departemen merupakan nama legacy/lama yang harus disingkirkan */
export function isLegacyDepartment(name?: string | null): boolean {
  if (!name || typeof name !== "string") return false;
  const lower = name.toLowerCase().trim();
  return (
    lower.includes("countinous improvment") ||
    lower.includes("produksi cheking") ||
    lower.includes("warehouse - sparepart") ||
    lower.includes("teknik central kitchen") ||
    lower === "continuous improvement (ci)" ||
    lower === "produksi central kitchen" ||
    lower === "gudang sparepart"
  );
}

/** Normalisasi nama departemen untuk kecocokan matriks hak akses */
export function normalizeDepartmentKey(dept?: string | null, roles?: string[] | AppRole[]): string {
  if (dept && dept.trim()) {
    const raw = dept.trim();
    const lower = raw.toLowerCase();
    if (lower.includes("super") || lower === "sa" || lower === "admin") return "Super Admin";
    if (
      lower.includes("ci1201") ||
      lower.includes("continuous") ||
      lower.includes("improvment") ||
      lower.includes("improvement") ||
      lower === "ci"
    )
      return "CI1201";
    if (
      lower.includes("ck1201") ||
      lower.includes("cheking") ||
      lower.includes("checking") ||
      lower.includes("produksi") ||
      lower === "ck"
    )
      return "CK1201";
    if (lower.includes("teknik") || lower === "tkn" || lower.includes("maintenance"))
      return "TEKNIK";
    if (
      lower.includes("gdsp") ||
      lower.includes("wh-sp") ||
      lower.includes("gudang sparepart") ||
      lower.includes("operasional sparepart") ||
      lower.includes("warehouse") ||
      lower.includes("sparepart")
    )
      return "GDSP1201";
    return raw;
  }

  // Fallback berdasarkan role user jika departemen profil belum diset
  if (roles && roles.length > 0) {
    if (roles.includes("admin")) return "Super Admin";
    if (roles.includes("qc_field")) return "CI1201";
    if (roles.includes("admin_process")) return "CK1201";
    if (roles.includes("prod_process_uh")) return "GDSP1201";
  }

  return "TEKNIK";
}

/** Helper untuk mengidentifikasi apakah profil / sesi yang sedang aktif adalah user / akun teknik */
export function checkIsTeknikUser(
  profile?: { full_name?: string | null; department?: string | null; email?: string | null } | null,
  roles?: string[] | AppRole[],
): boolean {
  const userDept = normalizeDepartmentKey(profile?.department, roles);
  const fullNameLower = profile?.full_name?.toLowerCase() || "";
  const deptLower = profile?.department?.toLowerCase() || "";
  const emailLower = profile?.email?.toLowerCase() || "";
  const storedAccess =
    typeof window !== "undefined" ? localStorage.getItem("last_active_access") || "" : "";
  const storedDept =
    typeof window !== "undefined" ? localStorage.getItem("last_active_dept") || "" : "";

  return (
    userDept === "TEKNIK" ||
    deptLower.includes("teknik") ||
    fullNameLower.includes("teknik") ||
    fullNameLower.includes("administrator teknik") ||
    emailLower.includes("teknik") ||
    storedAccess.toUpperCase() === "TEKNIK" ||
    storedDept.toUpperCase().includes("TEKNIK")
  );
}

/** Helper untuk mengidentifikasi apakah profil / sesi yang sedang aktif adalah role / user GDSP / Admin Gudang */
export function checkIsGdspUser(
  profile?: { full_name?: string | null; department?: string | null; email?: string | null } | null,
  roles?: string[] | AppRole[],
  isAdmin?: boolean,
): boolean {
  if (isAdmin) return true;
  if (checkIsTeknikUser(profile, roles)) return false;
  const userDept = normalizeDepartmentKey(profile?.department, roles);
  const deptLower = profile?.department?.toLowerCase() || "";
  const emailLower = profile?.email?.toLowerCase() || "";
  return (
    userDept === "GDSP1201" ||
    deptLower.includes("gdsp") ||
    deptLower.includes("gudang") ||
    emailLower.includes("gdsp") ||
    emailLower.includes("warehouse") ||
    Boolean(roles?.includes("prod_process_uh"))
  );
}

/** Ambil cache izin departemen dari browser localStorage */
export function getStoredDeptPermissions(): Record<string, Record<string, boolean>> {
  if (typeof window === "undefined") return DEFAULT_DEPARTMENT_PERMISSIONS;
  try {
    const raw = localStorage.getItem(LOCAL_STORAGE_KEY);
    if (!raw) return { ...DEFAULT_DEPARTMENT_PERMISSIONS };
    const parsed = JSON.parse(raw);
    return { ...DEFAULT_DEPARTMENT_PERMISSIONS, ...parsed };
  } catch {
    return { ...DEFAULT_DEPARTMENT_PERMISSIONS };
  }
}

/** Simpan perubahan izin departemen ke localStorage */
export function saveStoredDeptPermission(
  dept: string,
  routePath: string,
  canAccess: boolean,
): void {
  if (typeof window === "undefined") return;
  try {
    const current = getStoredDeptPermissions();
    const deptNorm = normalizeDepartmentKey(dept);
    const deptMap = current[deptNorm] || { ...DEFAULT_DEPARTMENT_PERMISSIONS[deptNorm] } || {};
    deptMap[routePath] = canAccess;
    current[deptNorm] = deptMap;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn("Failed to persist department permissions cache:", err);
  }
}

/**
 * Mengambil seluruh hak akses departemen dan role dari Supabase secara remote
 * Menggabungkan tabel department_permissions dan role_permissions serta fallback localStorage
 */
export async function fetchRemoteDeptPermissions(
  supabaseClient: any,
): Promise<Record<string, boolean>> {
  const map: Record<string, boolean> = {};

  try {
    // 1. Ambil dari tabel department_permissions jika sudah dibuat di Supabase
    const { data: deptData, error: deptErr } = await supabaseClient
      .from("department_permissions")
      .select("*");

    if (!deptErr && Array.isArray(deptData) && deptData.length > 0) {
      deptData.forEach((item: any) => {
        if (item.department && item.route_path) {
          const norm = normalizeDepartmentKey(item.department);
          map[`${norm.toLowerCase()}:${item.route_path}`] = Boolean(item.can_access);
          map[`${item.department.toLowerCase().trim()}:${item.route_path}`] = Boolean(
            item.can_access,
          );
        }
      });
    }

    // 2. Ambil dari tabel role_permissions di Supabase (hanya untuk mapping role murni)
    const { data: roleData, error: roleErr } = await supabaseClient
      .from("role_permissions")
      .select("*");

    if (!roleErr && Array.isArray(roleData) && roleData.length > 0) {
      roleData.forEach((item: any) => {
        if (item.role && item.route_path) {
          const roleStr = String(item.role).toLowerCase().trim();
          map[`${roleStr}:${item.route_path}`] = Boolean(item.can_access);
        }
      });
    }
  } catch (err) {
    console.warn("Notice: Remote department permissions query handled gracefully:", err);
  }

  // 3. Gabungkan dengan localStorage browser
  const stored = getStoredDeptPermissions();
  Object.entries(stored).forEach(([dept, routes]) => {
    Object.entries(routes).forEach(([rPath, val]) => {
      const k = `${dept.toLowerCase().trim()}:${rPath}`;
      if (!(k in map)) {
        map[k] = val;
      }
    });
  });

  return map;
}

/**
 * Mengambil status izin akses halaman untuk departemen tertentu berdasarkan
 * remotePermissions (Supabase), localStorage cache, dan fallback konfigurasi standar.
 */
export function getDeptPermission(
  department?: string | null,
  routePath?: string,
  remotePermissions?: Record<string, boolean>,
): boolean {
  if (!routePath) return false;
  const deptKey = normalizeDepartmentKey(department);

  // 1. Super Admin selalu diizinkan untuk semua halaman
  if (deptKey === "Super Admin") {
    return true;
  }

  // 2. Periksa data spesifik departemen dari Supabase / remote permissions jika ada
  if (remotePermissions) {
    const remoteKey = `${deptKey.toLowerCase()}:${routePath}`;
    if (remoteKey in remotePermissions && remotePermissions[remoteKey] !== undefined) {
      return Boolean(remotePermissions[remoteKey]);
    }

    // Cocokkan secara case-insensitive
    for (const [k, v] of Object.entries(remotePermissions)) {
      if (k.toLowerCase() === remoteKey && v !== undefined) {
        return Boolean(v);
      }
    }
  }

  // 3. Periksa cache localStorage
  const stored = getStoredDeptPermissions();
  const matchedDeptKey = Object.keys(stored).find(
    (k) => normalizeDepartmentKey(k).toLowerCase() === deptKey.toLowerCase(),
  );

  const matchedDeptMap = matchedDeptKey ? stored[matchedDeptKey] : undefined;
  if (matchedDeptMap && routePath in matchedDeptMap && matchedDeptMap[routePath] !== undefined) {
    return Boolean(matchedDeptMap[routePath]);
  }

  // 4. Default fallback berdasarkan DEFAULT_DEPARTMENT_PERMISSIONS
  const defaultKey = Object.keys(DEFAULT_DEPARTMENT_PERMISSIONS).find(
    (k) => normalizeDepartmentKey(k).toLowerCase() === deptKey.toLowerCase(),
  );

  const defaultDeptMap = defaultKey ? DEFAULT_DEPARTMENT_PERMISSIONS[defaultKey] : undefined;
  if (defaultDeptMap && routePath in defaultDeptMap && defaultDeptMap[routePath] !== undefined) {
    return Boolean(defaultDeptMap[routePath]);
  }

  // 5. Fallback umum: izinkan dashboard & approval jika rute belum terdaftar
  if (routePath === "/dashboard" || routePath === "/approvals") {
    return true;
  }

  return false;
}

/**
 * Validasi apakah suatu rute diizinkan untuk departemen dan role tertentu saat navigasi/guard
 */
export function isRouteAllowedForDept(
  routePath: string,
  department?: string | null,
  isAdmin = false,
  remotePermissions?: Record<string, boolean>,
  userRoles?: string[] | AppRole[],
): boolean {
  // 1. Super Admin selalu memiliki akses penuh ke seluruh rute halaman
  if (isAdmin || (userRoles && userRoles.includes("admin" as any))) {
    return true;
  }

  // 2. Rute khusus Super Admin diblokir total untuk non-admin
  if (routePath === "/settings" || routePath === "/roles") {
    return false;
  }

  const deptKey = normalizeDepartmentKey(department, userRoles);
  return getDeptPermission(deptKey, routePath, remotePermissions);
}

/** Skrip SQL Migrasi Lengkap untuk dibuat di Supabase SQL Editor */
export const SQL_DEPARTMENT_PERMISSIONS_MIGRATION = `-- ==============================================================================
-- MIGRATION: HAK AKSES BERDASARKAN DEPARTEMEN & PEMBERSIHAN DEPARTEMEN LEGACY
-- Jalankan skrip ini di Supabase Dashboard -> SQL Editor
-- ==============================================================================

-- 1. Bersihkan Departemen Legacy / Duplikat Lama
DELETE FROM public.department_permissions
WHERE department ILIKE '%countinous improvment%'
   OR department ILIKE '%produksi cheking%'
   OR department ILIKE '%warehouse - sparepart%'
   OR department ILIKE '%teknik central kitchen%'
   OR department IN (
     'Departemen Countinous Improvment',
     'Departemen Produksi Cheking',
     'Department Warehouse - Sparepart',
     'Department Teknik Central Kitchen',
     'Continuous Improvement (CI)',
     'Produksi Central Kitchen',
     'Gudang Sparepart'
   );

DELETE FROM public.departments
WHERE name ILIKE '%countinous improvment%'
   OR name ILIKE '%produksi cheking%'
   OR name ILIKE '%warehouse - sparepart%'
   OR name ILIKE '%teknik central kitchen%'
   OR name IN (
     'Departemen Countinous Improvment',
     'Departemen Produksi Cheking',
     'Department Warehouse - Sparepart',
     'Department Teknik Central Kitchen',
     'Continuous Improvement (CI)',
     'Produksi Central Kitchen',
     'Gudang Sparepart'
   );

-- 2. Migrasikan profil user lama yang masih memakai departemen lama ke kode standar
UPDATE public.profiles
SET department = 'CI1201'
WHERE department ILIKE '%countinous%' OR department ILIKE '%continuous%' OR department = 'CI';

UPDATE public.profiles
SET department = 'CK1201'
WHERE department ILIKE '%cheking%' OR department ILIKE '%checking%' OR department = 'CK';

UPDATE public.profiles
SET department = 'GDSP1201'
WHERE department ILIKE '%warehouse%sparepart%' OR department ILIKE '%gudang sparepart%' OR department = 'GDSP';

UPDATE public.profiles
SET department = 'TEKNIK'
WHERE department ILIKE '%teknik%' OR department = 'TKN';

-- 3. Master Departemen Resmi
INSERT INTO public.departments (name, code, description) VALUES
  ('TEKNIK', 'TKN', 'Departemen Teknik & Maintenance'),
  ('CI1201', 'CI', 'Departemen Continuous Improvement'),
  ('CK1201', 'Produksi CK', 'Operator Admin Ceklis'),
  ('GDSP1201', 'WH-SP', 'Admin Gudang & Operasional Sparepart'),
  ('Super Admin', 'SA', 'Super Admin System')
ON CONFLICT (name) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description;

-- 4. Tabel matriks hak akses per departemen
CREATE TABLE IF NOT EXISTS public.department_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  department text NOT NULL,
  route_path text NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (department, route_path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.department_permissions TO authenticated;
GRANT ALL ON public.department_permissions TO service_role;
ALTER TABLE public.department_permissions ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies
DROP POLICY IF EXISTS "dept_permissions_select" ON public.department_permissions;
CREATE POLICY "dept_permissions_select" ON public.department_permissions
  FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "dept_permissions_admin_manage" ON public.department_permissions;
CREATE POLICY "dept_permissions_admin_manage" ON public.department_permissions
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin'::public.app_role)
    OR EXISTS (
      SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- 6. Inisialisasi Matriks Izin Standar per Departemen
INSERT INTO public.department_permissions (department, route_path, can_access) VALUES
  -- TEKNIK: Dashboard, OBS Sparepart, Approval diizinkan; Checklist & Formulasi ditolak
  ('TEKNIK', '/dashboard', true),
  ('TEKNIK', '/products', true),
  ('TEKNIK', '/approvals', true),
  ('TEKNIK', '/profile', true),
  ('TEKNIK', '/checklists', false),
  ('TEKNIK', '/formulasi', false),
  ('TEKNIK', '/grinding', false),
  ('TEKNIK', '/roasting', false),
  ('TEKNIK', '/settings', false),
  ('TEKNIK', '/roles', false),

  -- SUPER ADMIN: Semua diizinkan
  ('Super Admin', '/dashboard', true),
  ('Super Admin', '/checklists', true),
  ('Super Admin', '/formulasi', true),
  ('Super Admin', '/grinding', true),
  ('Super Admin', '/roasting', true),
  ('Super Admin', '/approvals', true),
  ('Super Admin', '/products', true),
  ('Super Admin', '/profile', true),
  ('Super Admin', '/settings', true),
  ('Super Admin', '/roles', true),

  -- CI1201: Semua operasional diizinkan, settings & roles ditolak
  ('CI1201', '/dashboard', true),
  ('CI1201', '/checklists', true),
  ('CI1201', '/formulasi', true),
  ('CI1201', '/grinding', true),
  ('CI1201', '/roasting', true),
  ('CI1201', '/approvals', true),
  ('CI1201', '/products', true),
  ('CI1201', '/profile', true),
  ('CI1201', '/settings', false),
  ('CI1201', '/roles', false),

  -- CK1201: Checklist & Proses diizinkan; Dashboard & Products ditolak
  ('CK1201', '/dashboard', false),
  ('CK1201', '/checklists', true),
  ('CK1201', '/formulasi', true),
  ('CK1201', '/grinding', true),
  ('CK1201', '/roasting', true),
  ('CK1201', '/approvals', true),
  ('CK1201', '/products', false),
  ('CK1201', '/profile', true),
  ('CK1201', '/settings', false),
  ('CK1201', '/roles', false),

  -- GDSP1201: Dashboard, OBS Sparepart & Approval diizinkan
  ('GDSP1201', '/dashboard', true),
  ('GDSP1201', '/checklists', false),
  ('GDSP1201', '/formulasi', false),
  ('GDSP1201', '/grinding', false),
  ('GDSP1201', '/roasting', false),
  ('GDSP1201', '/approvals', true),
  ('GDSP1201', '/products', true),
  ('GDSP1201', '/profile', true),
  ('GDSP1201', '/settings', false),
  ('GDSP1201', '/roles', false)
ON CONFLICT (department, route_path) DO UPDATE SET
  can_access = EXCLUDED.can_access,
  updated_at = now();

-- 7. Fungsi Backend Validasi Akses Departemen
CREATE OR REPLACE FUNCTION public.check_user_department_access(p_user_id uuid, p_route text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_dept text;
  v_is_admin boolean;
  v_allowed boolean;
  v_role text;
BEGIN
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  IF p_route = '/profile' THEN
    RETURN true;
  END IF;

  IF p_route = '/settings' OR p_route = '/roles' THEN
    RETURN false;
  END IF;

  SELECT department INTO v_dept FROM public.profiles WHERE id = p_user_id;

  IF v_dept IS NOT NULL AND v_dept <> '' THEN
    SELECT can_access INTO v_allowed
    FROM public.department_permissions
    WHERE LOWER(department) = LOWER(v_dept)
      AND route_path = p_route;

    IF v_allowed IS NOT NULL THEN
      RETURN v_allowed;
    END IF;
  END IF;

  SELECT ur.role::text INTO v_role FROM public.user_roles ur WHERE ur.user_id = p_user_id LIMIT 1;
  IF v_role IS NOT NULL THEN
    SELECT can_access INTO v_allowed
    FROM public.role_permissions
    WHERE role::text = v_role
      AND route_path = p_route;

    IF v_allowed IS NOT NULL THEN
      RETURN v_allowed;
    END IF;
  END IF;

  IF p_route = '/dashboard' OR p_route = '/approvals' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_department_access(uuid, text) TO authenticated, service_role;
`;
