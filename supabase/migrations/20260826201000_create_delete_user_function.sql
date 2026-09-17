-- ==============================================================================
-- MIGRATION: RPC FUNCTION TO SAFELY & COMPLETELY DELETE A USER
-- Menghapus user secara menyeluruh dari auth.users, user_roles, dan profiles
-- ==============================================================================

-- Buat fungsi SECURITY DEFINER agar admin dapat menghapus user secara tuntas
CREATE OR REPLACE FUNCTION public.delete_user_by_admin(target_user_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  -- 1. Validasi: Pastikan pemanggil adalah admin
  IF NOT public.has_role(auth.uid(), 'admin') THEN
    RAISE EXCEPTION 'Akses ditolak: Hanya Super Admin yang dapat menghapus user.';
  END IF;

  -- 2. Validasi: Tidak boleh menghapus diri sendiri
  IF auth.uid() = target_user_id THEN
    RAISE EXCEPTION 'Anda tidak dapat menghapus akun Anda sendiri.';
  END IF;

  -- 3. Hapus relasi di user_roles
  DELETE FROM public.user_roles WHERE user_id = target_user_id;

  -- 4. Hapus data di public.profiles
  DELETE FROM public.profiles WHERE id = target_user_id;

  -- 5. Hapus dari auth.users jika ada
  DELETE FROM auth.users WHERE id = target_user_id;
END;
$$;

-- Berikan izin eksekusi ke authenticated user (di dalam fungsi sudah diproteksi has_role admin)
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.delete_user_by_admin(uuid) TO service_role;
