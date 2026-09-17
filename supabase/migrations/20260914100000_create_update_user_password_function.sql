-- ==============================================================================
-- MIGRATION: RPC FUNCTION FOR SUPER ADMIN TO SAFELY UPDATE USER PASSWORD
-- Mengizinkan Super Admin mengubah / me-reset kata sandi pengguna secara aman
-- ==============================================================================

-- Pastikan ekstensi pgcrypto tersedia untuk fungsi hashing crypt() & gen_salt()
CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA extensions;

-- Buat fungsi SECURITY DEFINER agar admin dapat mengubah password pengguna
CREATE OR REPLACE FUNCTION public.update_user_password_by_admin(
  target_user_id uuid,
  new_password text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth, extensions
AS $$
BEGIN
  -- 1. Validasi: Pastikan pemanggil adalah Super Admin (role admin)
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Super Admin yang memiliki wewenang untuk mengubah kata sandi pengguna.';
  END IF;

  -- 2. Validasi: Panjang kata sandi minimal 8 karakter
  IF length(new_password) < 8 THEN
    RAISE EXCEPTION 'Kata sandi baru harus memiliki panjang minimal 8 karakter.';
  END IF;

  -- 3. Update kata sandi terenkripsi pada auth.users
  UPDATE auth.users
  SET encrypted_password = extensions.crypt(new_password, extensions.gen_salt('bf')),
      updated_at = now()
  WHERE id = target_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Pengguna dengan ID tersebut tidak ditemukan dalam sistem autentikasi.';
  END IF;
END;
$$;

-- Berikan izin eksekusi ke authenticated user (proteksi has_role admin sudah ada di dalam fungsi)
GRANT EXECUTE ON FUNCTION public.update_user_password_by_admin(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_user_password_by_admin(uuid, text) TO service_role;
