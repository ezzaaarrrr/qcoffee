-- ==============================================================================
-- MIGRATION: WAREHOUSE ORDERS & MONITORING PEMOTONGAN STOK
-- Mengelola alur pemesanan sparepart oleh Teknik yang membutuhkan approval GDSP
-- sebelum stok master barang otomatis terpotong secara real-time.
-- ==============================================================================

CREATE TABLE IF NOT EXISTS public.warehouse_orders (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  order_number text NOT NULL,
  order_date date NOT NULL DEFAULT CURRENT_DATE,
  product_id uuid REFERENCES public.products(id) ON DELETE RESTRICT,
  product_code text,
  product_name text NOT NULL,
  quantity numeric NOT NULL CHECK (quantity > 0),
  unit text NOT NULL DEFAULT 'PCS',
  user_pemohon text NOT NULL,
  alasan_permintaan text NOT NULL,
  petugas_shift text,
  status text NOT NULL DEFAULT 'PENDING', -- PENDING, APPROVED, REJECTED
  stock_before numeric,
  stock_after numeric,
  approved_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  approved_by_name text,
  approved_at timestamptz,
  rejection_reason text,
  created_by uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  created_by_name text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Indeks untuk query performa tinggi
CREATE INDEX IF NOT EXISTS idx_warehouse_orders_number ON public.warehouse_orders(order_number);
CREATE INDEX IF NOT EXISTS idx_warehouse_orders_status ON public.warehouse_orders(status);
CREATE INDEX IF NOT EXISTS idx_warehouse_orders_product ON public.warehouse_orders(product_id);

-- Hak Akses & RLS Policies
GRANT ALL ON public.warehouse_orders TO authenticated;
GRANT ALL ON public.warehouse_orders TO service_role;
ALTER TABLE public.warehouse_orders ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "warehouse_orders_all" ON public.warehouse_orders;
CREATE POLICY "warehouse_orders_all" ON public.warehouse_orders
  FOR ALL TO authenticated
  USING (true)
  WITH CHECK (true);
