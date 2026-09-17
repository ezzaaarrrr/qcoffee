
CREATE TYPE public.app_role AS ENUM ('admin_process','qc_field','prod_process_uh','admin');
CREATE TYPE public.shift_enum AS ENUM ('Shift 1','Shift 2','Shift 3');
CREATE TYPE public.status_enum AS ENUM ('Draft','Pending QC','Approved','Rejected');

CREATE TABLE public.profiles (
  id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  full_name text NOT NULL DEFAULT '',
  email text NOT NULL DEFAULT '',
  department text,
  signature_url text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE TABLE public.user_roles (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  role public.app_role NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, role)
);
GRANT SELECT ON public.user_roles TO authenticated;
GRANT ALL ON public.user_roles TO service_role;
ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role public.app_role)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role = _role)
$$;

CREATE OR REPLACE FUNCTION public.can_create_forms(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('admin_process','admin'))
$$;

CREATE OR REPLACE FUNCTION public.can_review_forms(_user_id uuid)
RETURNS boolean LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = _user_id AND role IN ('qc_field','prod_process_uh','admin'))
$$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger LANGUAGE plpgsql SET search_path = public AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
BEGIN
  INSERT INTO public.profiles (id, full_name, email, department)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'full_name',''), COALESCE(NEW.email,''), NEW.raw_user_meta_data->>'department')
  ON CONFLICT (id) DO NOTHING;
  INSERT INTO public.user_roles (user_id, role)
  VALUES (NEW.id, COALESCE((NEW.raw_user_meta_data->>'role')::public.app_role, 'admin_process'))
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END; $$;

CREATE TRIGGER on_auth_user_created AFTER INSERT ON auth.users
FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

CREATE POLICY "profiles_select_auth" ON public.profiles FOR SELECT TO authenticated USING (true);
CREATE POLICY "profiles_update_own" ON public.profiles FOR UPDATE TO authenticated USING (id = auth.uid() OR public.has_role(auth.uid(),'admin')) WITH CHECK (id = auth.uid() OR public.has_role(auth.uid(),'admin'));
CREATE POLICY "profiles_insert_own" ON public.profiles FOR INSERT TO authenticated WITH CHECK (id = auth.uid());
CREATE TRIGGER profiles_updated_at BEFORE UPDATE ON public.profiles FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "user_roles_select_auth" ON public.user_roles FOR SELECT TO authenticated USING (true);
CREATE POLICY "user_roles_admin_manage" ON public.user_roles FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

CREATE TABLE public.products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;
ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
CREATE POLICY "products_select_auth" ON public.products FOR SELECT TO authenticated USING (true);
CREATE POLICY "products_admin_manage" ON public.products FOR ALL TO authenticated USING (public.has_role(auth.uid(),'admin')) WITH CHECK (public.has_role(auth.uid(),'admin'));

INSERT INTO public.products (name, code) VALUES
  ('Espresso Gold Blend','EGB'),
  ('Arabica Single Origin','ASO'),
  ('House Blend Robusta','HBR'),
  ('Specialty Gayo Wash','SGW');

CREATE TABLE public.form_formulasi (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tanggal_mixing date NOT NULL,
  no_mixer varchar(50),
  produk varchar(150),
  no_urut_batch varchar(50),
  shift_regu varchar(50),
  line varchar(50),
  start_mixing time,
  selesai_mixing time,
  material text,
  quantity numeric,
  qan_rm varchar(50),
  qan_premix varchar(50),
  operator_premix varchar(100),
  keterangan text,
  status public.status_enum NOT NULL DEFAULT 'Draft',
  approved_by_qc uuid REFERENCES auth.users(id),
  approved_by_uh uuid REFERENCES auth.users(id),
  qc_notes text,
  approved_qc_at timestamptz,
  approved_uh_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_grinding (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hari_tanggal date NOT NULL,
  shift public.shift_enum NOT NULL DEFAULT 'Shift 1',
  no_grinder varchar(50),
  nama_produk varchar(150),
  no_batch varchar(50),
  no_urut_batch varchar(50),
  raw_material text,
  keterangan_petunjuk text,
  status public.status_enum NOT NULL DEFAULT 'Draft',
  dibuat_by uuid REFERENCES auth.users(id),
  diperiksa_qc_by uuid REFERENCES auth.users(id),
  disetujui_uh_by uuid REFERENCES auth.users(id),
  qc_notes text,
  approved_qc_at timestamptz,
  approved_uh_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_grinding_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grinding_id uuid NOT NULL REFERENCES public.form_grinding(id) ON DELETE CASCADE,
  urutan int NOT NULL DEFAULT 1,
  start_time time,
  finish_time time,
  jam_kerja numeric,
  qty_roasting numeric,
  total_qty numeric,
  qty_grinding numeric,
  aktual_qty numeric,
  waste numeric,
  kehalusan_mesin varchar(50),
  density numeric,
  aroma varchar(50),
  ph numeric,
  moisture_mc numeric,
  station varchar(50),
  keterangan text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_roasting (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hari_tanggal date NOT NULL,
  shift_regu varchar(50),
  no_roaster varchar(50),
  nama_produk varchar(150),
  keterangan_tambahan text,
  status public.status_enum NOT NULL DEFAULT 'Draft',
  dibuat_by uuid REFERENCES auth.users(id),
  diperiksa_qc_by uuid REFERENCES auth.users(id),
  disetujui_uh_by uuid REFERENCES auth.users(id),
  qc_notes text,
  approved_qc_at timestamptz,
  approved_uh_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE public.form_roasting_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  roasting_id uuid NOT NULL REFERENCES public.form_roasting(id) ON DELETE CASCADE,
  no_item int NOT NULL DEFAULT 1,
  no_qar_barang varchar(50),
  no_silo_kopi_mentah varchar(50),
  jumlah_mentah_kg numeric,
  jumlah_matang_kg numeric,
  roasting_start time,
  roasting_finish time,
  waktu_roasting_menit numeric,
  temp_roasting_c numeric,
  cooling_start time,
  cooling_finish time,
  waktu_cooling_menit numeric,
  temp_cooling_c numeric,
  waste numeric,
  ph numeric,
  mc_percent numeric,
  qar_roasting varchar(50),
  no_silo_kopi_matang varchar(50),
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.form_formulasi, public.form_grinding, public.form_grinding_items, public.form_roasting, public.form_roasting_items TO authenticated;
GRANT ALL ON public.form_formulasi, public.form_grinding, public.form_grinding_items, public.form_roasting, public.form_roasting_items TO service_role;

ALTER TABLE public.form_formulasi ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_grinding ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_grinding_items ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_roasting ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.form_roasting_items ENABLE ROW LEVEL SECURITY;

CREATE TRIGGER form_formulasi_updated_at BEFORE UPDATE ON public.form_formulasi FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER form_grinding_updated_at BEFORE UPDATE ON public.form_grinding FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
CREATE TRIGGER form_roasting_updated_at BEFORE UPDATE ON public.form_roasting FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

CREATE POLICY "formulasi_select" ON public.form_formulasi FOR SELECT TO authenticated USING (true);
CREATE POLICY "formulasi_insert" ON public.form_formulasi FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.can_create_forms(auth.uid()));
CREATE POLICY "formulasi_update" ON public.form_formulasi FOR UPDATE TO authenticated
  USING ((created_by = auth.uid() AND status IN ('Draft','Rejected')) OR public.can_review_forms(auth.uid()))
  WITH CHECK ((created_by = auth.uid()) OR public.can_review_forms(auth.uid()));
CREATE POLICY "formulasi_delete" ON public.form_formulasi FOR DELETE TO authenticated
  USING ((created_by = auth.uid() AND status IN ('Draft','Rejected')) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "grinding_select" ON public.form_grinding FOR SELECT TO authenticated USING (true);
CREATE POLICY "grinding_insert" ON public.form_grinding FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.can_create_forms(auth.uid()));
CREATE POLICY "grinding_update" ON public.form_grinding FOR UPDATE TO authenticated
  USING ((created_by = auth.uid() AND status IN ('Draft','Rejected')) OR public.can_review_forms(auth.uid()))
  WITH CHECK ((created_by = auth.uid()) OR public.can_review_forms(auth.uid()));
CREATE POLICY "grinding_delete" ON public.form_grinding FOR DELETE TO authenticated
  USING ((created_by = auth.uid() AND status IN ('Draft','Rejected')) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "grinding_items_select" ON public.form_grinding_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "grinding_items_write" ON public.form_grinding_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_grinding g WHERE g.id = grinding_id AND ((g.created_by = auth.uid() AND g.status IN ('Draft','Rejected')) OR public.can_review_forms(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.form_grinding g WHERE g.id = grinding_id AND (g.created_by = auth.uid() OR public.can_review_forms(auth.uid()))));

CREATE POLICY "roasting_select" ON public.form_roasting FOR SELECT TO authenticated USING (true);
CREATE POLICY "roasting_insert" ON public.form_roasting FOR INSERT TO authenticated WITH CHECK (created_by = auth.uid() AND public.can_create_forms(auth.uid()));
CREATE POLICY "roasting_update" ON public.form_roasting FOR UPDATE TO authenticated
  USING ((created_by = auth.uid() AND status IN ('Draft','Rejected')) OR public.can_review_forms(auth.uid()))
  WITH CHECK ((created_by = auth.uid()) OR public.can_review_forms(auth.uid()));
CREATE POLICY "roasting_delete" ON public.form_roasting FOR DELETE TO authenticated
  USING ((created_by = auth.uid() AND status IN ('Draft','Rejected')) OR public.has_role(auth.uid(),'admin'));

CREATE POLICY "roasting_items_select" ON public.form_roasting_items FOR SELECT TO authenticated USING (true);
CREATE POLICY "roasting_items_write" ON public.form_roasting_items FOR ALL TO authenticated
  USING (EXISTS (SELECT 1 FROM public.form_roasting r WHERE r.id = roasting_id AND ((r.created_by = auth.uid() AND r.status IN ('Draft','Rejected')) OR public.can_review_forms(auth.uid()))))
  WITH CHECK (EXISTS (SELECT 1 FROM public.form_roasting r WHERE r.id = roasting_id AND (r.created_by = auth.uid() OR public.can_review_forms(auth.uid()))));

CREATE POLICY "signatures_read_auth" ON storage.objects FOR SELECT TO authenticated USING (bucket_id = 'signatures');
CREATE POLICY "signatures_insert_own" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "signatures_update_own" ON storage.objects FOR UPDATE TO authenticated USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
CREATE POLICY "signatures_delete_own" ON storage.objects FOR DELETE TO authenticated USING (bucket_id = 'signatures' AND (storage.foldername(name))[1] = auth.uid()::text);
