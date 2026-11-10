-- ==============================================================================
-- MIGRATION: PERBAIKAN RLS TABEL PRODUCTS (SUPABASE)
-- Error yang di-fix: "Gagal menambah barang — new row violates row-level
-- security policy for table products"
--
-- Penyebab: di database live, policy RLS products masih versi lama
-- ("products_admin_manage" — hanya role admin yang boleh menulis), sehingga
-- akun GDSP/produksi/teknik ITU GAGAL saat:
--   • Tambah barang baru (INSERT)
--   • Import barang Excel/CSV (INSERT/UPDATE)
--   • Edit/hapus barang (UPDATE/DELETE)
-- dan halaman langsung jatuh ke daftar standar 206 item buatan (data DB kosong).
--
-- ATURAN BARU: seluruh user yang sudah LOGIN (role 'authenticated') boleh
-- membaca & mengelola data gudang. Kontrol halus (min/maks stok hanya super
-- admin, dsb.) tetap ditangani di level UI aplikasi.
--
-- Jalankan 1× di Supabase Dashboard → SQL Editor → Run.
-- ==============================================================================

-- 1. Hapus policy lama yang konflik/tersembunyi di tabel products
DROP POLICY IF EXISTS "products_admin_manage" ON public.products;
DROP POLICY IF EXISTS "products_warehouse_manage" ON public.products;
DROP POLICY IF EXISTS "products_select_auth" ON public.products;
DROP POLICY IF EXISTS "products_all_auth" ON public.products;
DROP POLICY IF EXISTS "products_dept_check" ON public.products;
DROP POLICY IF EXISTS "products_insert_auth" ON public.products;
DROP POLICY IF EXISTS "products_update_auth" ON public.products;
DROP POLICY IF EXISTS "products_delete_auth" ON public.products;

-- 2. Policy baru: izinkan CRUD untuk user yang sudah login
CREATE POLICY "products_select_auth"
  ON public.products FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "products_insert_auth"
  ON public.products FOR INSERT TO authenticated
  WITH CHECK (true);

CREATE POLICY "products_update_auth"
  ON public.products FOR UPDATE TO authenticated
  USING (true)
  WITH CHECK (true);

CREATE POLICY "products_delete_auth"
  ON public.products FOR DELETE TO authenticated
  USING (true);

-- 3. Pastikan grant DML/SQL untuk role authenticated (RLS tidak menyaring GRANT)
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- 4. Uji & laporkan state policy setelah perbaikan
SELECT tablename, policyname, cmd
FROM pg_policies
WHERE schemaname = 'public' AND tablename = 'products'
ORDER BY cmd, policyname;
