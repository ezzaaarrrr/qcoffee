-- ==============================================================================
-- MIGRATION: GUDANG / WAREHOUSE INVENTORY MANAGEMENT SYSTEM & STORAGE BUCKET
-- Role yang bertindak sebagai Admin Gudang: 'prod_process_uh' & 'admin'
-- ==============================================================================

-- 1. EXTEND / MODIFY TABLE PRODUCTS JIKA PERLU (Menambah kolom gudang)
ALTER TABLE public.products 
ADD COLUMN IF NOT EXISTS category text DEFAULT 'Green Beans',
ADD COLUMN IF NOT EXISTS unit text DEFAULT 'kg',
ADD COLUMN IF NOT EXISTS location text DEFAULT 'Gudang Utama',
ADD COLUMN IF NOT EXISTS shelf text DEFAULT 'Rak A-1',
ADD COLUMN IF NOT EXISTS min_stock numeric DEFAULT 10,
ADD COLUMN IF NOT EXISTS current_stock numeric DEFAULT 0,
ADD COLUMN IF NOT EXISTS image_url text,
ADD COLUMN IF NOT EXISTS doc_url text,
ADD COLUMN IF NOT EXISTS description text;

-- Policy RLS Products untuk mengizinkan prod_process_uh & admin mengelola master produk
DROP POLICY IF EXISTS "products_admin_manage" ON public.products;
CREATE POLICY "products_warehouse_manage" ON public.products 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh')) 
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'));


-- 2. TABEL MASTER KATEGORI BARANG
CREATE TABLE IF NOT EXISTS public.warehouse_categories (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.warehouse_categories TO authenticated;
GRANT ALL ON public.warehouse_categories TO service_role;
ALTER TABLE public.warehouse_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_categories_select" ON public.warehouse_categories;
CREATE POLICY "warehouse_categories_select" ON public.warehouse_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "warehouse_categories_manage" ON public.warehouse_categories;
CREATE POLICY "warehouse_categories_manage" ON public.warehouse_categories 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'));

-- Initial Categories
INSERT INTO public.warehouse_categories (name, description) VALUES
  ('Green Beans', 'Bahan baku biji kopi mentah'),
  ('Roasted Beans', 'Kopi matang hasil proses roasting'),
  ('Packaging & Dus', 'Kemasan aluminium foil, kardus, box & label'),
  ('Chemical & Cleaning', 'Bahan pembersih & sanitasi mesin'),
  ('Sparepart & Tools', 'Suku cadang peralatan & mesin')
ON CONFLICT (name) DO NOTHING;


-- 3. TABEL MASTER SATUAN (UNIT OF MEASURE)
CREATE TABLE IF NOT EXISTS public.warehouse_units (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  code text NOT NULL UNIQUE,
  name text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.warehouse_units TO authenticated;
GRANT ALL ON public.warehouse_units TO service_role;
ALTER TABLE public.warehouse_units ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_units_select" ON public.warehouse_units;
CREATE POLICY "warehouse_units_select" ON public.warehouse_units FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "warehouse_units_manage" ON public.warehouse_units;
CREATE POLICY "warehouse_units_manage" ON public.warehouse_units 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'));

-- Initial Units
INSERT INTO public.warehouse_units (code, name) VALUES
  ('kg', 'Kilogram'),
  ('gram', 'Gram'),
  ('karung', 'Karung / Sack (60kg)'),
  ('pack', 'Pack / Pouch'),
  ('box', 'Box / Karton'),
  ('pcs', 'Pieces / Satuan')
ON CONFLICT (code) DO NOTHING;


-- 4. TABEL MASTER LOKASI GUDANG & SHELF/RAK
CREATE TABLE IF NOT EXISTS public.warehouse_locations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL UNIQUE,
  code text,
  address text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.warehouse_locations TO authenticated;
GRANT ALL ON public.warehouse_locations TO service_role;
ALTER TABLE public.warehouse_locations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_locations_select" ON public.warehouse_locations;
CREATE POLICY "warehouse_locations_select" ON public.warehouse_locations FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "warehouse_locations_manage" ON public.warehouse_locations;
CREATE POLICY "warehouse_locations_manage" ON public.warehouse_locations 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'));

-- Initial Locations
INSERT INTO public.warehouse_locations (name, code, address) VALUES
  ('Gudang Bahan Baku (Green Beans)', 'WH-GB', 'Area Central Kitchen A'),
  ('Gudang Packaging', 'WH-PKG', 'Area Central Kitchen B'),
  ('Gudang Produk Jadi (FG)', 'WH-FG', 'Area Distribusi M2')
ON CONFLICT (name) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.warehouse_shelves (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  location_id uuid REFERENCES public.warehouse_locations(id) ON DELETE CASCADE,
  location_name text,
  shelf_code text NOT NULL,
  description text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.warehouse_shelves TO authenticated;
GRANT ALL ON public.warehouse_shelves TO service_role;
ALTER TABLE public.warehouse_shelves ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_shelves_select" ON public.warehouse_shelves;
CREATE POLICY "warehouse_shelves_select" ON public.warehouse_shelves FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "warehouse_shelves_manage" ON public.warehouse_shelves;
CREATE POLICY "warehouse_shelves_manage" ON public.warehouse_shelves 
FOR ALL TO authenticated 
USING (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'))
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'));


-- 5. TABEL TRANSAKSI MUTASI GUDANG (BARANG MASUK / BARANG KELUAR)
CREATE TYPE public.warehouse_tx_type AS ENUM ('IN', 'OUT', 'ADJUSTMENT');

CREATE TABLE IF NOT EXISTS public.warehouse_transactions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  transaction_number text NOT NULL,
  tx_type public.warehouse_tx_type NOT NULL,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  product_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'kg',
  batch_number text,
  reference_no text, -- No PO / Surat Jalan / No SPK
  supplier_or_dest text, -- Supplier pengirim atau Line/Tujuan
  notes text,
  document_url text, -- Foto / Surat Jalan / COA
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.warehouse_transactions TO authenticated;
GRANT ALL ON public.warehouse_transactions TO service_role;
ALTER TABLE public.warehouse_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_tx_select" ON public.warehouse_transactions;
CREATE POLICY "warehouse_tx_select" ON public.warehouse_transactions FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "warehouse_tx_insert" ON public.warehouse_transactions;
CREATE POLICY "warehouse_tx_insert" ON public.warehouse_transactions 
FOR INSERT TO authenticated 
WITH CHECK (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'));


-- 6. TRIGGER UNTUK UPDATE STOK OTOMATIS SAAT TRANSAKSI DILAKUKAN
CREATE OR REPLACE FUNCTION public.handle_warehouse_stock_update()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF NEW.tx_type = 'IN' THEN
    UPDATE public.products 
    SET current_stock = COALESCE(current_stock, 0) + NEW.quantity 
    WHERE id = NEW.product_id;
  ELSIF NEW.tx_type = 'OUT' THEN
    UPDATE public.products 
    SET current_stock = GREATEST(0, COALESCE(current_stock, 0) - NEW.quantity) 
    WHERE id = NEW.product_id;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_warehouse_stock_update ON public.warehouse_transactions;
CREATE TRIGGER trg_warehouse_stock_update
AFTER INSERT ON public.warehouse_transactions
FOR EACH ROW EXECUTE FUNCTION public.handle_warehouse_stock_update();


-- 7. TABEL ACTIVITY LOG PERGUDANGAN
CREATE TABLE IF NOT EXISTS public.warehouse_activity_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  action text NOT NULL,
  description text NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  user_name text,
  metadata jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);
GRANT ALL ON public.warehouse_activity_logs TO authenticated;
GRANT ALL ON public.warehouse_activity_logs TO service_role;
ALTER TABLE public.warehouse_activity_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_logs_select" ON public.warehouse_activity_logs;
CREATE POLICY "warehouse_logs_select" ON public.warehouse_activity_logs FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "warehouse_logs_insert" ON public.warehouse_activity_logs;
CREATE POLICY "warehouse_logs_insert" ON public.warehouse_activity_logs FOR INSERT TO authenticated WITH CHECK (true);


-- ==============================================================================
-- 8. SUPABASE STORAGE BUCKET UNTUK DOKUMEN & FOTO BARANG / TRANSAKSI GUDANG
-- ==============================================================================

-- Buat bucket 'warehouse-docs' jika belum ada
INSERT INTO storage.buckets (id, name, public)
VALUES ('warehouse-docs', 'warehouse-docs', true)
ON CONFLICT (id) DO NOTHING;

-- Policy Supabase Storage: Siapapun user terautentikasi bisa membaca foto/dokumen
DROP POLICY IF EXISTS "Warehouse Storage Public Read" ON storage.objects;
CREATE POLICY "Warehouse Storage Public Read" ON storage.objects
FOR SELECT TO authenticated
USING (bucket_id = 'warehouse-docs');

-- Policy Supabase Storage: prod_process_uh & admin bisa upload
DROP POLICY IF EXISTS "Warehouse Storage Upload" ON storage.objects;
CREATE POLICY "Warehouse Storage Upload" ON storage.objects
FOR INSERT TO authenticated
WITH CHECK (
  bucket_id = 'warehouse-docs' AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'))
);

-- Policy Supabase Storage: prod_process_uh & admin bisa delete foto/dokumen
DROP POLICY IF EXISTS "Warehouse Storage Delete" ON storage.objects;
CREATE POLICY "Warehouse Storage Delete" ON storage.objects
FOR DELETE TO authenticated
USING (
  bucket_id = 'warehouse-docs' AND
  (public.has_role(auth.uid(), 'admin') OR public.has_role(auth.uid(), 'prod_process_uh'))
);
