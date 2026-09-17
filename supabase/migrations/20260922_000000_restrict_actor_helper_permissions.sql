-- Restrict resolve_current_actor() to authenticated browser users only

REVOKE ALL ON FUNCTION public.resolve_current_actor() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.resolve_current_actor() FROM anon;
REVOKE ALL ON FUNCTION public.resolve_current_actor() FROM service_role;

GRANT EXECUTE ON FUNCTION public.resolve_current_actor() TO authenticated;