-- ==============================================================================
-- MIGRATION: HAK AKSES BERDASARKAN DEPARTEMEN & DEPARTEMEN TEKNIK
-- Mengatur matriks hak akses halaman per Departemen (termasuk TEKNIK)
-- Dilengkapi validasi frontend dan backend RLS
-- ==============================================================================

-- 1. Pastikan Departemen TEKNIK terdaftar pada master table departments
INSERT INTO public.departments (name, code, description) VALUES
  ('TEKNIK', 'TKN', 'Departemen Teknik & Maintenance'),
  ('CI1201', 'CI', 'Departemen Continuous Improvement'),
  ('CK1201', 'Produksi CK', 'Operator Admin Ceklis'),
  ('GDSP1201', 'WH-SP', 'Admin Gudang & Operasional Sparepart'),
  ('Super Admin', 'SA', 'Super Admin System')
ON CONFLICT (name) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description;

-- 2. Buat tabel matriks hak akses per departemen
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

-- 3. RLS Policies untuk department_permissions
DROP POLICY IF EXISTS "dept_permissions_select" ON public.department_permissions;
DROP POLICY IF EXISTS "dept_permissions_admin_manage" ON public.department_permissions;

-- Seluruh user authenticated dapat membaca matriks izin untuk memvalidasi akses menu & halaman mereka
CREATE POLICY "dept_permissions_select" ON public.department_permissions
  FOR SELECT TO authenticated USING (true);

-- Hanya Super Admin yang berhak mengubah, menambah, atau menghapus izin halaman
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

-- 4. Inisialisasi data default matriks izin untuk Departemen TEKNIK dan departemen standar lainnya
INSERT INTO public.department_permissions (department, route_path, can_access) VALUES
  -- ── DEPARTEMEN TEKNIK ───────────────────────────────────────────────────────
  ('TEKNIK', '/dashboard', true),
  ('TEKNIK', '/products', true),      -- Akses Gudang OBS Sparepart & Mutasi
  ('TEKNIK', '/approvals', true),     -- Akses Approval Center
  ('TEKNIK', '/profile', true),       -- Pengaturan Akun sendiri
  ('TEKNIK', '/checklists', false),
  ('TEKNIK', '/formulasi', false),
  ('TEKNIK', '/grinding', false),
  ('TEKNIK', '/roasting', false),
  ('TEKNIK', '/settings', false),
  ('TEKNIK', '/roles', false),

  -- ── SUPER ADMIN (SEMUA AKSES ON) ──────────────────────────────────────────
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

  -- ── DEPARTEMEN CI1201 (QC) ────────────────────────────────────────────────
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

  -- ── DEPARTEMEN CK1201 (PRODUKSI) ──────────────────────────────────────────
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

  -- ── DEPARTEMEN GDSP1201 (GUDANG SPAREPART) ────────────────────────────────
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

-- 5. Fungsi Helper Backend untuk memeriksa hak akses departemen seorang pengguna
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
  -- 1. Super Admin selalu diizinkan
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles WHERE user_id = p_user_id AND role = 'admin'
  ) INTO v_is_admin;

  IF v_is_admin THEN
    RETURN true;
  END IF;

  -- 2. Halaman profil selalu diizinkan
  IF p_route = '/profile' THEN
    RETURN true;
  END IF;

  -- 3. Halaman admin khusus Super Admin
  IF p_route = '/settings' OR p_route = '/roles' THEN
    RETURN false;
  END IF;

  -- 4. Ambil departemen pengguna dari profil
  SELECT department INTO v_dept FROM public.profiles WHERE id = p_user_id;

  -- 5. Cek izin di tabel department_permissions
  IF v_dept IS NOT NULL AND v_dept <> '' THEN
    SELECT can_access INTO v_allowed
    FROM public.department_permissions
    WHERE LOWER(department) = LOWER(v_dept)
      AND route_path = p_route;

    IF v_allowed IS NOT NULL THEN
      RETURN v_allowed;
    END IF;
  END IF;

  -- 6. Fallback periksa role_permissions berdasarkan user_roles
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

  -- 7. Fallback standar
  IF p_route = '/dashboard' OR p_route = '/approvals' THEN
    RETURN true;
  END IF;

  RETURN false;
END;
$$;

GRANT EXECUTE ON FUNCTION public.check_user_department_access(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.check_user_department_access(uuid, text) TO service_role;

-- 6. Validasi Backend RLS pada form dan transaksi agar tidak dapat dilewati langsung via API/URL
-- Form Roasting:
DROP POLICY IF EXISTS "roasting_dept_check" ON public.form_roasting;
CREATE POLICY "roasting_dept_check" ON public.form_roasting
  FOR ALL TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/roasting'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/roasting'));

-- Form Grinding:
DROP POLICY IF EXISTS "grinding_dept_check" ON public.form_grinding;
CREATE POLICY "grinding_dept_check" ON public.form_grinding
  FOR ALL TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/grinding'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/grinding'));

-- Form Formulasi:
DROP POLICY IF EXISTS "formulasi_dept_check" ON public.form_formulasi;
CREATE POLICY "formulasi_dept_check" ON public.form_formulasi
  FOR ALL TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/formulasi'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/formulasi'));

-- Warehouse Transactions (OBS Sparepart):
DROP POLICY IF EXISTS "warehouse_dept_check" ON public.warehouse_transactions;
CREATE POLICY "warehouse_dept_check" ON public.warehouse_transactions
  FOR ALL TO authenticated
  USING (public.check_user_department_access(auth.uid(), '/products'))
  WITH CHECK (public.check_user_department_access(auth.uid(), '/products'));
