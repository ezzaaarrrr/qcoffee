-- Konfirmasi semua user yang belum verifikasi email.
-- Ini menyelesaikan error "Email not confirmed" untuk akun yang sudah ada.
-- Untuk mencegah konfirmasi email pada pendaftaran baru, matikan via:
--   Supabase Dashboard → Authentication → Configuration → Email
--   → nonaktifkan "Enable email confirmations"
UPDATE auth.users
SET
  email_confirmed_at = COALESCE(email_confirmed_at, now()),
  updated_at         = now()
WHERE email_confirmed_at IS NULL;
