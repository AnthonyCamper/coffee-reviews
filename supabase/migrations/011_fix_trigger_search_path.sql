-- ============================================================================
-- 011 — Fix SECURITY DEFINER trigger functions: set search_path explicitly
--
-- Root cause: supabase_auth_admin (GoTrue) sessions have search_path=auth.
-- SECURITY DEFINER functions inherit the *session* search_path, NOT the
-- function owner's. create_notification_preferences() referenced the
-- unqualified table "notification_preferences", which resolved to
-- auth.notification_preferences (does not exist) instead of
-- public.notification_preferences — crashing the entire auth.users INSERT
-- transaction and producing "Database error saving new user" for every
-- new OAuth signup after migration 007 was applied.
-- ============================================================================

-- 1. Fix handle_new_user: add explicit search_path
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, avatar_url)
  VALUES (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  ON CONFLICT (id) DO UPDATE SET
    email      = excluded.email,
    full_name  = excluded.full_name,
    avatar_url = excluded.avatar_url;
  RETURN new;
END;
$$;

-- 2. Fix create_notification_preferences: fully qualify table + set search_path
CREATE OR REPLACE FUNCTION public.create_notification_preferences()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.notification_preferences (user_id)
  VALUES (new.id)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN new;
END;
$$;
