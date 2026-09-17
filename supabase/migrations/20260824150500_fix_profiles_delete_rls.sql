-- ==============================================================================
-- MIGRATION: PERBAIKAN RLS DELETE PROFILES UNTUK ADMIN
-- Mengizinkan role 'admin' menghapus baris dari tabel public.profiles
-- ==============================================================================

-- 1. Tambahkan Policy DELETE pada tabel public.profiles untuk Super Admin
DROP POLICY IF EXISTS "profiles_delete_admin" ON public.profiles;
CREATE POLICY "profiles_delete_admin" ON public.profiles
FOR DELETE TO authenticated
USING (public.has_role(auth.uid(), 'admin'));

-- 2. Pastikan tabel profiles dan user_roles memiliki grant DELETE
GRANT DELETE ON public.profiles TO authenticated;
GRANT DELETE ON public.user_roles TO authenticated;
