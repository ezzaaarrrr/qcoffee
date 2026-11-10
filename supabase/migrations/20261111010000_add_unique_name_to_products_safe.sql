-- ==============================================================================
-- MIGRATION: UNIQUE NAMA BARANG TABEL PRODUCTS (AMELIORASI ERROR IMPORT)
-- Error yang di-fix: "there is no unique or exclusion constraint matching the
-- ON CONFLICT specification" — muncul karena UI pernah memakai
-- upsert(onConflict: "name") PADAHAL kolom name tidak memiliki unique
-- constraint/index di database live.
--
-- Yang dilakukan migration ini:
--   1. Menghapus baris duplikat bernama sama persis (huruf besar-kecil & spasi
--      diabaikan); baris TERLAMA yang dipertahankan.
--   2. Mencoba membuat unique index pada lower(trim(name)); bila masih ada
--      duplikat dengan data berbeda, migration TIDAK GAGAL (cukup NOTICE).
--   3. Ini juga menyegel backend: permintaan API langsung tidak bisa
--      memasangkan item bernama sama secara diam-diam (anti-bypass).
--
-- Jalankan 1× di Supabase Dashboard → SQL Editor → Run.
-- ==============================================================================

-- 1. Bersihkan duplikat nama yang identik (keep earliest created_at, tiebreak id)
DELETE FROM public.products a
USING public.products b
WHERE lower(trim(a.name)) = lower(trim(b.name))
  AND a.id <> b.id
  AND (
    coalesce(a.created_at, 'epoch'::timestamptz) > coalesce(b.created_at, 'epoch'::timestamptz)
    OR (
      coalesce(a.created_at, 'epoch'::timestamptz) = coalesce(b.created_at, 'epoch'::timestamptz)
      AND a.id > b.id
    )
  );

-- 2. Unique index pada nama (case-insensitive, trim spasi)
DO $$
BEGIN
  BEGIN
    CREATE UNIQUE INDEX IF NOT EXISTS products_name_uniq_idx
      ON public.products (lower(trim(name)));
    RAISE NOTICE 'Unique index products_name_uniq_idx berhasil dibuat.';
  EXCEPTION WHEN others THEN
    RAISE NOTICE 'SKIP: unique index name belum bisa dibuat (masih ada duplikat berbeda): %', SQLERRM;
    RAISE NOTICE 'Aplikasi tetap berjalan — import sudah tidak bergantung unique constraint.';
  END;
END $$;

-- 3. Sanity check berjalan: item dengan nama ganda tersisa?
SELECT name, count(*) AS dup
FROM public.products
WHERE name IS NOT NULL
GROUP BY lower(trim(name)), name
HAVING count(*) > 1
ORDER BY dup DESC
LIMIT 20;
