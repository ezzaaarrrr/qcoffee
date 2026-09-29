-- ==============================================================================
-- MIGRATION: BUFFER STOK -- Tabel Mandiri Terpisah dari OBS Sparepart
-- Buffer Stok memiliki data sendiri, tidak ngelink ke tabel products
-- ==============================================================================

-- Tabel Buffer Stok (independen dari products/OBS Sparepart)
CREATE TABLE IF NOT EXISTS public.buffer_stock (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  code text,
  unit text DEFAULT 'pcs',
  location text DEFAULT 'Gudang Utama',
  shelf text DEFAULT 'Rak A-1',
  min_stock numeric DEFAULT 10,
  safe_stock numeric DEFAULT 1,
  max_stock numeric DEFAULT NULL,
  current_stock numeric DEFAULT 0,
  description text,
  image_url text,
  doc_url text,
  is_active boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.buffer_stock TO authenticated;
GRANT ALL ON public.buffer_stock TO service_role;
ALTER TABLE public.buffer_stock ENABLE ROW LEVEL SECURITY;

-- Policy: Semua user terautentikasi bisa baca
DROP POLICY IF EXISTS "buffer_stock_select" ON public.buffer_stock;
CREATE POLICY "buffer_stock_select" ON public.buffer_stock
  FOR SELECT TO authenticated USING (true);

-- Policy: Hanya prod_process_uh, qc_field, dan admin yang bisa manage
DROP POLICY IF EXISTS "buffer_stock_manage" ON public.buffer_stock;
CREATE POLICY "buffer_stock_manage" ON public.buffer_stock
  FOR ALL TO authenticated
  USING (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'prod_process_uh') OR
    public.has_role(auth.uid(), 'qc_field') OR
    public.has_role(auth.uid(), 'admin_process')
  )
  WITH CHECK (
    public.has_role(auth.uid(), 'admin') OR
    public.has_role(auth.uid(), 'prod_process_uh') OR
    public.has_role(auth.uid(), 'qc_field') OR
    public.has_role(auth.uid(), 'admin_process')
  );

-- Tambah kolom safe_stock ke products jika belum ada
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS safe_stock numeric DEFAULT 1;
