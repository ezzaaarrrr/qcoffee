-- Table for role page permissions matrix
CREATE TABLE IF NOT EXISTS public.role_permissions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  role public.app_role NOT NULL,
  route_path text NOT NULL,
  can_access boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (role, route_path)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.role_permissions TO authenticated;
GRANT ALL ON public.role_permissions TO service_role;
ALTER TABLE public.role_permissions ENABLE ROW LEVEL SECURITY;

-- Drop policies if re-running
DROP POLICY IF EXISTS "role_permissions_select" ON public.role_permissions;
DROP POLICY IF EXISTS "role_permissions_admin" ON public.role_permissions;

CREATE POLICY "role_permissions_select" ON public.role_permissions FOR SELECT TO authenticated USING (true);
CREATE POLICY "role_permissions_admin" ON public.role_permissions FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Re-seed default permissions
TRUNCATE TABLE public.role_permissions;

INSERT INTO public.role_permissions (role, route_path, can_access) VALUES
  -- 1. Super Admin (admin) -> SEMUA HALAMAN
  ('admin', '/dashboard', true),
  ('admin', '/checklists', true),
  ('admin', '/formulasi', true),
  ('admin', '/grinding', true),
  ('admin', '/roasting', true),
  ('admin', '/approvals', true),
  ('admin', '/products', true),
  ('admin', '/profile', true),
  ('admin', '/settings', true),
  ('admin', '/roles', true),

  -- 2. Departemen Countinous Improvment / CI (qc_field) -> SEMUA HALAMAN
  ('qc_field', '/dashboard', true),
  ('qc_field', '/checklists', true),
  ('qc_field', '/formulasi', true),
  ('qc_field', '/grinding', true),
  ('qc_field', '/roasting', true),
  ('qc_field', '/approvals', true),
  ('qc_field', '/products', true),
  ('qc_field', '/profile', true),
  ('qc_field', '/settings', true),
  ('qc_field', '/roles', true),

  -- 3. Departemen Produksi Cheking (admin_process) -> APPROVAL & CHECKLIST
  ('admin_process', '/dashboard', false),
  ('admin_process', '/checklists', true),
  ('admin_process', '/formulasi', false),
  ('admin_process', '/grinding', false),
  ('admin_process', '/roasting', false),
  ('admin_process', '/approvals', true),
  ('admin_process', '/products', false),
  ('admin_process', '/profile', true),
  ('admin_process', '/settings', false),
  ('admin_process', '/roles', false),

  -- 4. Department Teknik Central Kitchen (prod_process_uh) -> APPROVAL & CHECKLIST
  ('prod_process_uh', '/dashboard', false),
  ('prod_process_uh', '/checklists', true),
  ('prod_process_uh', '/formulasi', false),
  ('prod_process_uh', '/grinding', false),
  ('prod_process_uh', '/roasting', false),
  ('prod_process_uh', '/approvals', true),
  ('prod_process_uh', '/products', false),
  ('prod_process_uh', '/profile', true),
  ('prod_process_uh', '/settings', false),
  ('prod_process_uh', '/roles', false)
ON CONFLICT (role, route_path) DO UPDATE SET can_access = EXCLUDED.can_access;
