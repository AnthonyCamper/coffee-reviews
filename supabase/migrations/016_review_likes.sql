-- ============================================================================
-- 016 — Review-level likes: replace per-photo likes in gallery with per-review
-- ============================================================================
-- The gallery view should treat likes at the review level, not per-photo.
-- This migration creates a review_likes table and updates gallery_feed.

-- ── 1. Create review_likes table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_likes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id  uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id)
);

CREATE INDEX idx_review_likes_review ON public.review_likes (review_id);
ALTER TABLE public.review_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read review likes"
  ON public.review_likes FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review likes"
  ON public.review_likes FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review likes"
  ON public.review_likes FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.review_likes TO authenticated;

-- ── 2. Migrate existing photo_likes → review_likes (deduplicate by review+user)

INSERT INTO public.review_likes (review_id, user_id, created_at)
SELECT DISTINCT ON (rp.review_id, pl.user_id)
  rp.review_id,
  pl.user_id,
  pl.created_at
FROM public.photo_likes pl
JOIN public.review_photos rp ON rp.id = pl.photo_id
ORDER BY rp.review_id, pl.user_id, pl.created_at
ON CONFLICT (review_id, user_id) DO NOTHING;

-- ── 3. Update gallery_feed to use review-level likes ─────────────────────────

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

-- ── 4. Notification trigger for review likes ─────────────────────────────────

CREATE OR REPLACE FUNCTION notify_review_like()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _review_owner uuid;
  _shop_name text;
  _actor_name text;
BEGIN
  SELECT r.user_id, cs.name
  INTO _review_owner, _shop_name
  FROM reviews r
  JOIN coffee_shops cs ON cs.id = r.coffee_shop_id
  WHERE r.id = new.review_id;

  IF _review_owner IS NULL OR _review_owner = new.user_id THEN RETURN new; END IF;
  IF recent_notification_exists(_review_owner, new.user_id, 'photo_like', NULL, NULL, NULL) THEN RETURN new; END IF;

  _actor_name := get_display_name(new.user_id);

  INSERT INTO notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
  VALUES (
    _review_owner,
    new.user_id,
    'photo_like',
    new.review_id,
    _shop_name,
    _actor_name || ' liked your review'
  );

  RETURN new;
END;
$$;

CREATE TRIGGER trg_notify_review_like
  AFTER INSERT ON review_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_like();
