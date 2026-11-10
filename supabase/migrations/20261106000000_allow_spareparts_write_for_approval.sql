-- ==============================================================================
-- MIGRATION: IZIN PEMOTONGAN STOK MASTER BARANG (TABEL SPAREPARTS)
-- Alur approval order sparepart ("Setujui & Potong Stok") memotong stok pada
-- tabel public.spareparts (sumber data Master Barang hasil import Excel).
-- Selama ini tabel spareparts hanya bisa dibaca; tanpa policy UPDATE untuk role
-- authenticated, pemotongan stok dapat diblokir oleh Row Level Security (RLS)
-- sehingga approval gagal.
-- ==============================================================================

-- 1. Aktifkan RLS (aman; hanya memastikan status aktif)
ALTER TABLE public.spareparts ENABLE ROW LEVEL SECURITY;

-- 2. Izinkan user yang sudah login (sistem UI) membaca & menulis data spareparts:
--    SELECT  : menampilkan tabel di menu Master Barang / Sistem Order
--    UPDATE  : pemotongan stok (qty_stock) saat order sparepart disetujui
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'public'
      AND tablename = 'spareparts'
      AND policyname = 'spareparts_all_authenticated'
  ) THEN
    CREATE POLICY "spareparts_all_authenticated" ON public.spareparts
      FOR ALL TO authenticated
      USING (true)
      WITH CHECK (true);
  END IF;
END $$;

-- 3. Pastikan grant DML untuk role authenticated
GRANT SELECT, INSERT, UPDATE, DELETE ON public.spareparts TO authenticated;

-- 3b. Unique index pada material_number agar import bisa bulk-upsert
--     (onConflict "material_number" pada kode aplikasi). Hanya dibuat bila
--     tidak ada duplikat & index-nya belum ada.
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_indexes
    WHERE schemaname = 'public' AND tablename = 'spareparts'
      AND indexname = 'uq_spareparts_material_number'
  ) THEN
    RAISE NOTICE 'Unique index sudah ada';
  ELSIF EXISTS (
    SELECT 1
    FROM public.spareparts
    WHERE material_number IS NOT NULL AND material_number <> ''
    GROUP BY material_number
    HAVING COUNT(*) > 1
    LIMIT 1
  ) THEN
    RAISE NOTICE 'Ada material_number duplikat, unique index dibuat NON-unique (fallback per-row dipakai)';
    CREATE INDEX IF NOT EXISTS idx_spareparts_material_number ON public.spareparts(material_number);
  ELSE
    CREATE UNIQUE INDEX IF NOT EXISTS uq_spareparts_material_number
      ON public.spareparts(material_number);
  END IF;
END $$;

-- 4. Indeks pencarian untuk lookup cepat pada alur approval
CREATE INDEX IF NOT EXISTS idx_spareparts_material_number ON public.spareparts(material_number);
CREATE INDEX IF NOT EXISTS idx_spareparts_mat_desc ON public.spareparts(material_description);

-- 5. Longgarkan foreign key product_id pada tabel mutasi & order:
--    order sparepart bisa berasal dari tabel spareparts (Master Barang import),
--    jadi id-nya bukan id tabel products. Tanpa ini, insert ke
--    warehouse_transactions (mutasi keluar) diabaikan secara diam-diam.
DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN
    SELECT con.conname AS conname, rel.relname AS tablename
    FROM pg_constraint con
    JOIN pg_class rel ON rel.oid = con.conrelid
    WHERE con.contype = 'f'
      AND rel.relnamespace = 'public'::regnamespace
      AND rel.relname IN ('warehouse_transactions', 'warehouse_orders')
      AND EXISTS (
        SELECT 1
        FROM pg_attribute att
        WHERE att.attrelid = con.conrelid
          AND att.attnum = ANY (con.conkey)
          AND att.attname = 'product_id'
      )
      AND con.conindid IN (
        SELECT con2.conindid
        FROM pg_constraint con2
        JOIN pg_class freq ON freq.oid = con2.confrelid
        WHERE con2.oid = con.oid AND freq.relname = 'products'
      )
  LOOP
    EXECUTE format('ALTER TABLE public.%I DROP CONSTRAINT %I', r.tablename, r.conname);
    RAISE NOTICE 'Dropped FK % on % ', r.conname, r.tablename;
  END LOOP;
END $$;
