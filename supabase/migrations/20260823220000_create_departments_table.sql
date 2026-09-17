-- Migration: Add departments table & RLS policies with matching names
CREATE TABLE IF NOT EXISTS public.departments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.departments TO authenticated;
GRANT ALL ON public.departments TO service_role;
ALTER TABLE public.departments ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if re-running
DROP POLICY IF EXISTS "departments_select_auth" ON public.departments;
DROP POLICY IF EXISTS "departments_admin_manage" ON public.departments;

CREATE POLICY "departments_select_auth" ON public.departments FOR SELECT TO authenticated USING (true);
CREATE POLICY "departments_admin_manage" ON public.departments FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

-- Default data departemen yang disesuaikan dengan Role
INSERT INTO public.departments (name, code, description) VALUES
  ('Departemen Countinous Improvment', 'CI', 'Departemen Countinous Improvment'),
  ('Departemen Produksi Cheking', 'Produksi CK', 'Operator Admin Ceklis'),
  ('Department Teknik Central Kitchen', 'Teknik CK', 'Opertator Admin Ceklis'),
  ('Super Admin', 'SA', 'Super Admin System')
ON CONFLICT (name) DO UPDATE SET
  code = EXCLUDED.code,
  description = EXCLUDED.description;
