-- ============================================================================
-- 017 — Decimal ratings (0.1 increments)
-- ============================================================================
-- Promotes reviews.coffee_rating + reviews.vibe_rating from smallint to
-- numeric(3,1) so users can pick fractional values like 7.4 or 9.8. Existing
-- integer ratings cast losslessly (8 → 8.0).
--
-- Anything that consumes the columns gets dropped + recreated:
--   - reviews_with_profiles (if it exists)
--   - gallery_feed
-- ============================================================================

-- ── 1. Drop dependent views ─────────────────────────────────────────────────

DROP VIEW IF EXISTS public.reviews_with_profiles;
DROP VIEW IF EXISTS public.gallery_feed;


-- ── 2. Relax check constraints, change column types ─────────────────────────

ALTER TABLE public.reviews
  DROP CONSTRAINT IF EXISTS reviews_coffee_rating_check,
  DROP CONSTRAINT IF EXISTS reviews_vibe_rating_check;

ALTER TABLE public.reviews
  ALTER COLUMN coffee_rating TYPE numeric(3,1) USING coffee_rating::numeric(3,1),
  ALTER COLUMN vibe_rating   TYPE numeric(3,1) USING vibe_rating::numeric(3,1);

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_coffee_rating_check
    CHECK (coffee_rating >= 1.0 AND coffee_rating <= 10.0
           AND coffee_rating = round(coffee_rating, 1)),
  ADD CONSTRAINT reviews_vibe_rating_check
    CHECK (vibe_rating   >= 1.0 AND vibe_rating   <= 10.0
           AND vibe_rating   = round(vibe_rating, 1));


-- ── 3. Recreate gallery_feed (uses review_likes from migration 016) ─────────

CREATE OR REPLACE VIEW public.gallery_feed AS
SELECT
  rp.id                                                        AS photo_id,
  rp.url                                                       AS photo_url,
  rp.display_order,
  rp.created_at                                                AS photo_created_at,
  r.id                                                         AS review_id,
  r.coffee_rating,
  r.vibe_rating,
  r.coffee_type,
  r.note,
  r.visited_at,
  cs.id                                                        AS shop_id,
  cs.name                                                      AS shop_name,
  cs.address                                                   AS shop_address,
  p.id                                                         AS reviewer_id,
  p.full_name                                                  AS reviewer_name,
  p.avatar_url                                                 AS reviewer_avatar,
  p.email                                                      AS reviewer_email,
  coalesce(lk.cnt, 0)::int                                     AS like_count,
  coalesce(cm.cnt, 0)::int                                     AS comment_count,
  EXISTS(
    SELECT 1 FROM public.review_likes rl
    WHERE rl.review_id = r.id AND rl.user_id = auth.uid()
  )                                                            AS is_liked_by_me
FROM public.review_photos rp
JOIN  public.reviews     r  ON r.id  = rp.review_id
JOIN  public.coffee_shops cs ON cs.id = r.coffee_shop_id
LEFT JOIN public.profiles p  ON p.id  = r.user_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_likes WHERE review_id = r.id
) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_comments WHERE review_id = r.id
) cm ON true;

GRANT SELECT ON public.gallery_feed TO authenticated;


-- ── 4. Recreate reviews_with_profiles if it existed ─────────────────────────
-- The view is referenced by some pages but its prior definition isn't tracked
-- here. Recreate with a permissive shape so all consumed columns survive.

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'coffee_shops') THEN
    EXECUTE $view$
      CREATE OR REPLACE VIEW public.reviews_with_profiles AS
      SELECT
        r.*,
        cs.name    AS shop_name,
        cs.address AS shop_address,
        cs.lat     AS shop_lat,
        cs.lng     AS shop_lng,
        p.full_name  AS reviewer_name,
        p.avatar_url AS reviewer_avatar,
        p.email      AS reviewer_email
      FROM public.reviews r
      JOIN public.coffee_shops cs ON cs.id = r.coffee_shop_id
      LEFT JOIN public.profiles p ON p.id = r.user_id;
    $view$;

    GRANT SELECT ON public.reviews_with_profiles TO authenticated;
  END IF;
END $$;
