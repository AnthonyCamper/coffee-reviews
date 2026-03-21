-- ══════════════════════════════════════════════════════════════════════════════
-- 004_user_management — User roles, approval queue, site settings
-- ══════════════════════════════════════════════════════════════════════════════

-- ── 1. Extend profiles ────────────────────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending', 'approved', 'rejected', 'disabled')),
  ADD COLUMN IF NOT EXISTS is_admin boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS can_leave_reviews boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS display_name text;

-- ── 2. Migrate approved_users → profiles ─────────────────────────────────────
-- Set approved + is_admin for anyone already in the allowlist
UPDATE public.profiles p
SET
  status   = 'approved',
  is_admin = au.is_admin
FROM public.approved_users au
WHERE p.email = au.email;

-- ── 3. Updated RLS helper functions ──────────────────────────────────────────
-- is_approved(): profile exists and status = 'approved'
CREATE OR REPLACE FUNCTION public.is_approved()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT status = 'approved' FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- is_admin(): profile exists and is_admin = true
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_admin FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- can_review(): approved AND can_leave_reviews
CREATE OR REPLACE FUNCTION public.can_review()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT status = 'approved' AND can_leave_reviews
     FROM public.profiles WHERE id = auth.uid()),
    false
  );
$$;

-- ── 4. site_settings table ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.site_settings (
  id         boolean PRIMARY KEY DEFAULT true,
  CONSTRAINT site_settings_single_row CHECK (id = true),
  is_public  boolean NOT NULL DEFAULT false,
  updated_at timestamptz NOT NULL DEFAULT now()
);

INSERT INTO public.site_settings (id, is_public)
VALUES (true, false)
ON CONFLICT DO NOTHING;

ALTER TABLE public.site_settings ENABLE ROW LEVEL SECURITY;

-- is_site_public(): reads site_settings, safe for anon
CREATE OR REPLACE FUNCTION public.is_site_public()
RETURNS boolean LANGUAGE sql SECURITY DEFINER STABLE AS $$
  SELECT COALESCE(
    (SELECT is_public FROM public.site_settings WHERE id = true),
    false
  );
$$;

CREATE POLICY "Anyone can read site_settings"
  ON public.site_settings FOR SELECT
  USING (true);

CREATE POLICY "Admins can update site_settings"
  ON public.site_settings FOR UPDATE
  USING (public.is_admin());

-- ── 5. Update profiles RLS policies ──────────────────────────────────────────
-- Pending users need to read their own profile to see status
DROP POLICY IF EXISTS "Approved users can read all profiles" ON public.profiles;
DROP POLICY IF EXISTS "Users can update their own profile" ON public.profiles;

-- Any logged-in user can read their own profile; approved users can read all
CREATE POLICY "Profile select access"
  ON public.profiles FOR SELECT
  USING (id = auth.uid() OR public.is_approved());

-- Users can edit their own profile
CREATE POLICY "Users can update their own profile"
  ON public.profiles FOR UPDATE
  USING (id = auth.uid());

-- Admins can update any profile (for approval, role changes, etc.)
CREATE POLICY "Admins can update any profile"
  ON public.profiles FOR UPDATE
  USING (public.is_admin());

-- ── 6. Update reviews INSERT policy ──────────────────────────────────────────
DROP POLICY IF EXISTS "Approved users can insert their own reviews" ON public.reviews;

CREATE POLICY "Users with review permission can insert reviews"
  ON public.reviews FOR INSERT
  WITH CHECK (public.can_review() AND user_id = auth.uid());

-- ── 7. Public mode read policies ─────────────────────────────────────────────
-- Coffee shops and reviews become readable by anon when site is public
DROP POLICY IF EXISTS "Approved users can read coffee shops" ON public.coffee_shops;

CREATE POLICY "Read coffee shops"
  ON public.coffee_shops FOR SELECT
  USING (public.is_approved() OR public.is_site_public());

DROP POLICY IF EXISTS "Approved users can read all reviews" ON public.reviews;

CREATE POLICY "Read reviews"
  ON public.reviews FOR SELECT
  USING (public.is_approved() OR public.is_site_public());

-- ── 8. Grant anon read access for public mode ─────────────────────────────────
GRANT USAGE ON SCHEMA public TO anon;
GRANT SELECT ON public.coffee_shops TO anon;
GRANT SELECT ON public.reviews TO anon;
GRANT SELECT ON public.profiles TO anon;
GRANT SELECT ON public.site_settings TO anon;
GRANT SELECT ON public.reviews_with_profiles TO anon;

-- ══════════════════════════════════════════════════════════════════════════════
-- END 004_user_management
-- ══════════════════════════════════════════════════════════════════════════════
