-- ==============================================================================
-- MIGRATION: ROLE-BASED AUTHENTICATION HELPER
-- Memungkinkan autentikasi login berdasarkan Role / Departemen dan Kata Sandi
-- tanpa meminta input email dari pengguna di form login.
-- Email di auth.users dan public.profiles tetap utuh dan tidak dimodifikasi.
-- ==============================================================================

-- Fungsi SECURITY DEFINER untuk mendapatkan daftar email akun berdasarkan peran/departemen
CREATE OR REPLACE FUNCTION public.get_auth_emails_by_role(p_role text)
RETURNS TABLE (email text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  RETURN QUERY
  SELECT DISTINCT p.email
  FROM public.profiles p
  JOIN public.user_roles ur ON ur.user_id = p.id
  WHERE (ur.role::text = p_role OR (p_role = 'admin_process' AND ur.role::text = 'admin'))
    AND p.email IS NOT NULL
    AND p.email <> ''
  ORDER BY p.email;
END;
$$;

-- Berikan izin akses ke anonim (sebelum login) dan authenticated user
GRANT EXECUTE ON FUNCTION public.get_auth_emails_by_role(text) TO anon;
GRANT EXECUTE ON FUNCTION public.get_auth_emails_by_role(text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_auth_emails_by_role(text) TO service_role;
