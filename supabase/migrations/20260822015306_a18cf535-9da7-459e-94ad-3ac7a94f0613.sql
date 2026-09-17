
REVOKE ALL ON FUNCTION public.has_role(uuid, public.app_role) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_create_forms(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.can_review_forms(uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.set_updated_at() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.has_role(uuid, public.app_role) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_create_forms(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.can_review_forms(uuid) TO authenticated, service_role;
