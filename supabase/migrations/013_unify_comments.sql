-- ============================================================================
-- 013 — Unify comments: migrate photo_comments → review_comments
-- ============================================================================
-- Goal: Single comment system per review. Photo view shows the review thread.
-- Data migration was applied live. This file records the gallery_feed view change.

-- ── Update gallery_feed to count review comments instead of photo comments ──

DROP VIEW IF EXISTS public.gallery_feed;

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
  exists(
    SELECT 1 FROM public.photo_likes pl
    WHERE pl.photo_id = rp.id AND pl.user_id = auth.uid()
  )                                                            AS is_liked_by_me
FROM public.review_photos rp
JOIN  public.reviews     r  ON r.id  = rp.review_id
JOIN  public.coffee_shops cs ON cs.id = r.coffee_shop_id
LEFT JOIN public.profiles p  ON p.id  = r.user_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.photo_likes WHERE photo_id = rp.id
) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_comments WHERE review_id = r.id
) cm ON true;

GRANT SELECT ON public.gallery_feed TO authenticated;
