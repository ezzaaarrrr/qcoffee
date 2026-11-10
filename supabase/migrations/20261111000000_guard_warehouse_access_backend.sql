-- ==============================================================================
-- MIGRATION: VALIDASI AKSES BACKEND MODULE GUDANG (ANTI-BYPASS VIA URL/API)
-- Frontend guard (route.tsx + AppShell) hanya UI — nilai request langsung ke
-- Supabase REST harus ditolak oleh RLS. Migration ini memperkuat:
--   1. check_user_department_access() : fallback role→departemen standar agar
--      konsisten dengan frontend (ROLE_TO_DEFAULT_DEPT) dan tidak mengunci
--      user yang profiles.department-nya kosong.
--   2. RLS products / spareparts / buffer_stock / warehouse_orders /
--      warehouse_transactions : SELECT terbuka utk semua user login,
--      INSERT/UPDATE/DELETE WAJIB lolos cek hak akses '/products'.
-- ==============================================================================

-- 1) Perbarui fungsi validasi akses (SECURITY DEFINER, dipakai policy RLS)
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
  v_roles text[];
BEGIN
  -- Super Admin (role 'admin') selalu diizinkan
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;
  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- 1b. Departemen "Super Admin" diperlakukan setara admin penuh — paritas
  --     dengan pendeteksian frontend (checkIsSuperAdminAccess) agar menu gudang
  --     tampil SEKALIGUS operasi tulisnya lolos RLS walau baris role 'admin'
  --     belum terdaftar di user_roles.
  SELECT department INTO v_dept FROM public.profiles WHERE id = p_user_id;
  IF v_dept IS NOT NULL AND TRIM(v_dept) ILIKE 'super admin' THEN
    RETURN true;
  END IF;

  IF p_route = '/profile' THEN
    RETURN true;
  END IF;

  IF p_route = '/settings' OR p_route = '/roles' THEN
    RETURN false;
  END IF;

  -- 2. Matriks hak akses berdasarkan departemen profil
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

  -- 3. Daftar role user + izin role mengikuti tabel role_permissions
  SELECT array_agg(ur.role::text) INTO v_roles
  FROM public.user_roles ur WHERE ur.user_id = p_user_id;
  v_role := v_roles[1];

  IF v_role IS NOT NULL THEN
    SELECT can_access INTO v_allowed
    FROM public.role_permissions
    WHERE role::text = v_role
      AND route_path = p_route;
    IF v_allowed IS NOT NULL THEN
      RETURN v_allowed;
    END IF;
  END IF;

  -- 4. FALLBACK BARU: mapping role → departemen standar (sama dengan
  --    ROLE_TO_DEFAULT_DEPT di frontend) agar user yang profile-nya belum
  --    berdepartemen tidak terkunci total.
  IF v_allowed IS NULL AND v_roles IS NOT NULL THEN
    v_dept := CASE
      WHEN 'qc_field' = ANY(v_roles) THEN 'CI1201'
      WHEN 'admin_process' = ANY(v_roles) THEN 'CK1201'
      WHEN 'prod_process_uh' = ANY(v_roles) THEN 'GDSP1201'
      WHEN 'teknik' = ANY(v_roles) THEN 'TEKNIK'
      ELSE NULL
    END;

    IF v_dept IS NOT NULL THEN
      SELECT can_access INTO v_allowed
      FROM public.department_permissions
      WHERE LOWER(department) = LOWER(v_dept)
        AND route_path = p_route;

      v_allowed := COALESCE(
        v_allowed,
        v_dept IN ('CI1201', 'CK1201', 'GDSP1201')
          AND p_route IN (
            '/dashboard', '/approvals', '/products', '/profile',
            '/checklists', '/formulasi', '/grinding', '/roasting'
          )
      );
      IF v_allowed IS NOT NULL THEN
        RETURN v_allowed;
      END IF;
    END IF;
  END IF;

  -- 5. Route publik dasar
  IF p_route = '/dashboard' OR p_route = '/approvals' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_department_access(uuid, text) TO authenticated, service_role;

-- ==============================================================================
-- 2) TABEL PRODUCTS — tulis dibatasi departemen/role yang punya akses gudang
-- ==============================================================================
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "products_all_auth" ON public.products;
DROP POLICY IF EXISTS "products_warehouse_manage" ON public.products;
DROP POLICY IF EXISTS "products_admin_manage" ON public.products;

DROP POLICY IF EXISTS "products_select_auth" ON public.products;
CREATE POLICY "products_select_auth"
  ON public.products FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "products_insert_auth" ON public.products;
CREATE POLICY "products_insert_auth"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));

DROP POLICY IF EXISTS "products_update_auth" ON public.products;
CREATE POLICY "products_update_auth"
  ON public.products FOR UPDATE TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));

DROP POLICY IF EXISTS "products_delete_auth" ON public.products;
CREATE POLICY "products_delete_auth"
  ON public.products FOR DELETE TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- ==============================================================================
-- 3) TABEL SPAREPARTS (Master Barang) — baca terbuka, tulis terjaga
-- ==============================================================================
ALTER TABLE public.spareparts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "spareparts_all_authenticated" ON public.spareparts;

DROP POLICY IF EXISTS "spareparts_select_auth" ON public.spareparts;
CREATE POLICY "spareparts_select_auth"
  ON public.spareparts FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "spareparts_insert_auth" ON public.spareparts;
CREATE POLICY "spareparts_insert_auth"
  ON public.spareparts FOR INSERT TO authenticated
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));

DROP POLICY IF EXISTS "spareparts_update_auth" ON public.spareparts;
CREATE POLICY "spareparts_update_auth"
  ON public.spareparts FOR UPDATE TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));

DROP POLICY IF EXISTS "spareparts_delete_auth" ON public.spareparts;
CREATE POLICY "spareparts_delete_auth"
  ON public.spareparts FOR DELETE TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.spareparts TO authenticated;
GRANT ALL ON public.spareparts TO service_role;

-- ==============================================================================
-- 4) TABEL BUFFER_STOCK
-- ==============================================================================
ALTER TABLE public.buffer_stock ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "buffer_stock_manage" ON public.buffer_stock;

DROP POLICY IF EXISTS "buffer_stock_select" ON public.buffer_stock;
CREATE POLICY "buffer_stock_select"
  ON public.buffer_stock FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "buffer_stock_insert" ON public.buffer_stock;
CREATE POLICY "buffer_stock_insert"
  ON public.buffer_stock FOR INSERT TO authenticated
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));

DROP POLICY IF EXISTS "buffer_stock_update" ON public.buffer_stock;
CREATE POLICY "buffer_stock_update"
  ON public.buffer_stock FOR UPDATE TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));

DROP POLICY IF EXISTS "buffer_stock_delete" ON public.buffer_stock;
CREATE POLICY "buffer_stock_delete"
  ON public.buffer_stock FOR DELETE TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.buffer_stock TO authenticated;
GRANT ALL ON public.buffer_stock TO service_role;

-- ==============================================================================
-- 5) TABEL WAREHOUSE_ORDERS (order sparepart Teknik → approval GDSP)
--    Teknik & GDSP & Super Admin boleh menulis; baca terbuka utk login.
-- ==============================================================================
ALTER TABLE public.warehouse_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_orders_all" ON public.warehouse_orders;

DROP POLICY IF EXISTS "warehouse_orders_select" ON public.warehouse_orders;
CREATE POLICY "warehouse_orders_select"
  ON public.warehouse_orders FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "warehouse_orders_write" ON public.warehouse_orders;
CREATE POLICY "warehouse_orders_write"
  ON public.warehouse_orders FOR ALL TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_orders TO authenticated;
GRANT ALL ON public.warehouse_orders TO service_role;

-- ==============================================================================
-- 6) TABEL WAREHOUSE_TRANSACTIONS — hapus policy permissive lama yang
--    meniadakan guard departemen (banyak policy = OR → lewasi jika salah satunya true)
-- ==============================================================================
ALTER TABLE public.warehouse_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_tx_insert" ON public.warehouse_transactions;
DROP POLICY IF EXISTS "warehouse_tx_all" ON public.warehouse_transactions;

DROP POLICY IF EXISTS "warehouse_tx_select" ON public.warehouse_transactions;
CREATE POLICY "warehouse_tx_select"
  ON public.warehouse_transactions FOR SELECT TO authenticated
  USING (true);

DROP POLICY IF EXISTS "warehouse_dept_check" ON public.warehouse_transactions;
CREATE POLICY "warehouse_dept_check"
  ON public.warehouse_transactions FOR ALL TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));

GRANT SELECT, INSERT, UPDATE, DELETE ON public.warehouse_transactions TO authenticated;
GRANT ALL ON public.warehouse_transactions TO service_role;

-- ==============================================================================
-- 7) Report final: daftar policy aktif modul gudang
-- ==============================================================================
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('products', 'spareparts', 'buffer_stock', 'warehouse_orders', 'warehouse_transactions')
ORDER BY tablename, cmd, policyname;
