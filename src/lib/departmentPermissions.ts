// ==============================================================================
// SISTEM MANAJEMEN HAK AKSES BERDASARKAN DEPARTEMEN
// ==============================================================================

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

const LOCAL_STORAGE_KEY = "dept_permissions_matrix_v2";

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
    const deptNorm = dept.trim();
    const deptMap = current[deptNorm] || { ...DEFAULT_DEPARTMENT_PERMISSIONS[deptNorm] } || {};
    deptMap[routePath] = canAccess;
    current[deptNorm] = deptMap;
    localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(current));
  } catch (err) {
    console.warn("Failed to persist department permissions cache:", err);
  }
}

/**
 * Validasi apakah suatu rute diizinkan untuk departemen tertentu
 */
export function isRouteAllowedForDept(
  routePath: string,
  department?: string | null,
  isAdmin = false,
  remotePermissions?: Record<string, boolean>,
): boolean {
  // 1. Super Admin selalu memiliki akses ke seluruh halaman
  if (isAdmin) return true;

  // 2. Rute profil selalu boleh diakses oleh user yang sudah login
  if (routePath === "/profile") return true;

  // 3. Rute khusus Super Admin diblokir untuk non-admin
  if (routePath === "/settings" || routePath === "/roles") {
    return false;
  }

  // Jika departemen belum diset, blokir selain profil
  if (!department || !department.trim()) {
    return false;
  }

  const deptKey = department.trim();

  // 4. Periksa data dari Supabase (remote) jika tersedia
  if (remotePermissions) {
    const remoteKey = `${deptKey.toLowerCase()}:${routePath}`;
    if (remoteKey in remotePermissions && remotePermissions[remoteKey] !== undefined) {
      return Boolean(remotePermissions[remoteKey]);
    }
    // Coba dengan key case-insensitive
    for (const [k, v] of Object.entries(remotePermissions)) {
      if (k.toLowerCase() === remoteKey) return Boolean(v);
    }
  }

  // 5. Periksa cache localStorage
  const stored = getStoredDeptPermissions();
  // Cocokkan secara case-insensitive
  const matchedDeptKey = Object.keys(stored).find(
    (k) => k.toLowerCase() === deptKey.toLowerCase(),
  );

  const matchedDeptMap = matchedDeptKey ? stored[matchedDeptKey] : undefined;
  if (matchedDeptMap && routePath in matchedDeptMap) {
    return Boolean(matchedDeptMap[routePath]);
  }

  // 6. Default fallback berdasarkan DEFAULT_DEPARTMENT_PERMISSIONS
  const defaultKey = Object.keys(DEFAULT_DEPARTMENT_PERMISSIONS).find(
    (k) => k.toLowerCase() === deptKey.toLowerCase(),
  );

  const defaultDeptMap = defaultKey ? DEFAULT_DEPARTMENT_PERMISSIONS[defaultKey] : undefined;
  if (defaultDeptMap && routePath in defaultDeptMap) {
    return Boolean(defaultDeptMap[routePath]);
  }

  // Fallback umum departemen baru: izinkan halaman dashboard & approval, sisanya default false
  if (routePath === "/dashboard" || routePath === "/approvals") {
    return true;
  }

  return false;
}
