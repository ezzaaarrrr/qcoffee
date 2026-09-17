-- ==============================================================================
-- MIGRATION: PERBAIKAN RLS WAREHOUSE TRANSACTIONS & PRODUCTS
-- Mengizinkan seluruh user authenticated untuk mencatat transaksi mutasi gudang
-- dan mengupdate stok produk.
-- ==============================================================================

-- 1. Perbaiki RLS warehouse_transactions
DROP POLICY IF EXISTS "warehouse_tx_insert" ON public.warehouse_transactions;
CREATE POLICY "warehouse_tx_insert" ON public.warehouse_transactions 
FOR INSERT TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "warehouse_tx_select" ON public.warehouse_transactions;
CREATE POLICY "warehouse_tx_select" ON public.warehouse_transactions 
FOR SELECT TO authenticated 
USING (true);

DROP POLICY IF EXISTS "warehouse_tx_all" ON public.warehouse_transactions;
CREATE POLICY "warehouse_tx_all" ON public.warehouse_transactions 
FOR ALL TO authenticated 
USING (true)
WITH CHECK (true);

-- 2. Perbaiki RLS products agar user dapat mengupdate stok atau mengelola data produk
DROP POLICY IF EXISTS "products_warehouse_manage" ON public.products;
DROP POLICY IF EXISTS "products_select_auth" ON public.products;
DROP POLICY IF EXISTS "products_all_auth" ON public.products;

CREATE POLICY "products_all_auth" ON public.products 
FOR ALL TO authenticated 
USING (true) 
WITH CHECK (true);

-- 3. Perbaiki RLS warehouse_activity_logs jika diperlukan
DROP POLICY IF EXISTS "warehouse_logs_insert" ON public.warehouse_activity_logs;
CREATE POLICY "warehouse_logs_insert" ON public.warehouse_activity_logs 
FOR INSERT TO authenticated 
WITH CHECK (true);

DROP POLICY IF EXISTS "warehouse_logs_select" ON public.warehouse_activity_logs;
CREATE POLICY "warehouse_logs_select" ON public.warehouse_activity_logs 
FOR SELECT TO authenticated 
USING (true);

-- 4. Perbaiki RLS master kategori & satuan
DROP POLICY IF EXISTS "warehouse_categories_manage" ON public.warehouse_categories;
CREATE POLICY "warehouse_categories_manage" ON public.warehouse_categories 
FOR ALL TO authenticated 
USING (true)
WITH CHECK (true);

DROP POLICY IF EXISTS "warehouse_units_manage" ON public.warehouse_units;
CREATE POLICY "warehouse_units_manage" ON public.warehouse_units 
FOR ALL TO authenticated 
USING (true)
WITH CHECK (true);
