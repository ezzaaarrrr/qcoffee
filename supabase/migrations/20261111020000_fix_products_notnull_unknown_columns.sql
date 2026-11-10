-- ─────────────────────────────────────────────────────────────────────────────
-- FIX: kolom-kolom NOT NULL tanpa default di tabel live `products` membuat
-- import & tambah barang gagal.
--
-- Gejala di aplikasi (berurutan):
--   1) null value in column "material_number" of relation "products" ...
--   2) null value in column "material_description" of relation "products" ...
--
-- Penyebab: tabel live `products` memiliki kolom tambahan bergaya `spareparts`
-- (material_number, material_description, dst.) yang NOT NULL tanpa default dan
-- tidak dikenal skema aplikasi (aplikasi memakai `code` dan `name`).
--
-- Solusi (aman-fail):
--   1. Backfill nilai mirror dari data aplikasi (code / name).
--   2. Untuk SEMUA kolom teks yang NOT NULL tanpa default: beri default '' dan
--      lepaskan NOT NULL.
--   3. Kolom non-teks yang bermasalah dilaporkan via NOTICE agar bisa dicek.
-- Jalankan di SQL Editor Supabase (database live), satu kali.
-- ─────────────────────────────────────────────────────────────────────────────

DO $$
DECLARE
  r record;
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'products'
  ) THEN
    RAISE NOTICE 'Tabel public.products tidak ada — tidak ada yang diubah.';
    RETURN;
  END IF;

  -- 1. Backfill mirror dari data aplikasi
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='material_number'
  ) THEN
    UPDATE public.products SET material_number = code
     WHERE material_number IS NULL AND code IS NOT NULL;
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='products' AND column_name='material_description'
  ) THEN
    UPDATE public.products SET material_description = name
     WHERE material_description IS NULL AND name IS NOT NULL;
  END IF;

  -- 2. Longgarkan semua kolom teks NOT NULL tanpa default (selain id/timestamp)
  FOR r IN
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND is_nullable  = 'NO'
      AND column_default IS NULL
      AND column_name NOT IN ('id', 'created_at', 'updated_at')
      AND data_type IN ('text', 'character varying', 'character')
  LOOP
    EXECUTE format(
      'ALTER TABLE public.products ALTER COLUMN %I SET DEFAULT ''''',
      r.column_name
    );
    EXECUTE format(
      'ALTER TABLE public.products ALTER COLUMN %I DROP NOT NULL',
      r.column_name
    );
    RAISE NOTICE 'Kolom % longgar: default '''', NOT NULL dihapus.', r.column_name;
  END LOOP;

  -- 3. Laporkan kolom non-teks yang masih NOT NULL tanpa default (jika ada)
  FOR r IN
    SELECT column_name, data_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'products'
      AND is_nullable  = 'NO'
      AND column_default IS NULL
      AND column_name NOT IN ('id', 'created_at', 'updated_at')
      AND data_type NOT IN ('text', 'character varying', 'character')
  LOOP
    RAISE NOTICE 'Kolom % (%) masih NOT NULL tanpa default — jalankan manual jika import masih terhalang.',
      r.column_name, r.data_type;
  END LOOP;

  RAISE NOTICE 'Selesai. Tabel products kini menerima insert dari aplikasi tanpa terhalang constraint tak dikenal.';
END $$;
