-- ============================================================
-- CLEANUP DUPLIKAT MASTER BARANG (tabel spareparts)
-- Jalankan di Supabase Dashboard → SQL Editor → Run (sekali saja).
--
-- Tujuan:
--   1. Melihat jumlah baris saat ini (target ±2.808)
--   2. Menghapus duplikat material_number (termasuk varian leading-zero,
--      mis. "07700210" dan "770021" dianggap kode sama) — baris TERLAMA
--      (created_at terkecil) yang dipertahankan.
--   3. Membuat unique index agar import/update berikutnya tidak bisa
--      menduplikasi baris lagi.
-- ============================================================

-- 1) Cek jumlah baris saat ini
SELECT count(*) AS total_rows FROM public.spareparts;

-- 2) Lihat kode yang terduplikasi (normalisasi leading-zero)
WITH norm AS (
  SELECT
    id,
    material_number,
    CASE
      WHEN material_number ~ '^[0-9]+$' THEN (material_number::bigint)::text
      ELSE material_number
    END AS code_norm
  FROM public.spareparts
)
SELECT code_norm, count(*) AS jumlah_duplikat
FROM norm
GROUP BY code_norm
HAVING count(*) > 1
ORDER BY jumlah_duplikat DESC
LIMIT 50;

-- 3) HAPUS duplikat — pertahankan baris TERLAMA (created_at terkecil) untuk tiap
--    kode; kolom id bertipe UUID sehingga tidak bisa memakai min(id).
WITH norm AS (
  SELECT
    id,
    created_at,
    CASE
      WHEN material_number ~ '^[0-9]+$' THEN (material_number::bigint)::text
      ELSE material_number
    END AS code_norm
  FROM public.spareparts
),
keep AS (
  SELECT DISTINCT ON (code_norm) code_norm, id AS keep_id
  FROM norm
  ORDER BY code_norm, created_at ASC NULLS FIRST, id ASC
),
to_delete AS (
  SELECT n.id
  FROM norm n
  LEFT JOIN keep k ON k.code_norm = n.code_norm
  JOIN (
    SELECT code_norm, count(*) AS cnt
    FROM norm
    GROUP BY code_norm
  ) cnt ON cnt.code_norm = n.code_norm
  WHERE cnt.cnt > 1
    AND n.id <> k.keep_id
)
DELETE FROM public.spareparts s
USING to_delete d
WHERE s.id = d.id;

-- 4) Cek hasil setelah cleanup
SELECT count(*) AS total_rows_sesudah FROM public.spareparts;

-- 5) Kunci: unique index agar import berikutnya tidak menambah duplikat
--    (aman dijalankan; jika sudah ada akan skip karena IF NOT EXISTS pada nama index)
CREATE UNIQUE INDEX IF NOT EXISTS uq_spareparts_material_number
  ON public.spareparts (material_number);
