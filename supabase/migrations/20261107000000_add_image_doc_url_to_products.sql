-- ==============================================================================
-- MIGRATION: TAMBAH KOLOM LAMPIRAN DI TABEL PRODUCTS
-- Menambahkan kolom image_url (foto barang) dan doc_url (dokumen/surat)
-- yang dipakai form Tambah/Edit Barang pada menu Master Barang & OBS Sparepart.
-- Tanpa migration ini, penyimpanan barang baru gagal dengan error:
--   "Could not find the 'doc_url' column of 'products' in the schema cache"
-- ==============================================================================

ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS image_url text;
ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS doc_url text;

COMMENT ON COLUMN public.products.image_url IS 'URL gambar/foto barang (opsional)';
COMMENT ON COLUMN public.products.doc_url IS 'URL dokumen pendukung barang, mis. surat/BAST (opsional)';
