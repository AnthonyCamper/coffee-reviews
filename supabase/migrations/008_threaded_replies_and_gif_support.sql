-- ============================================================================
-- 008 — Threaded replies + GIF support for comments
-- ============================================================================

-- ── Drop dependent views first ──────────────────────────────────────────────
DROP VIEW IF EXISTS public.photo_comments_detailed;
DROP VIEW IF EXISTS public.gallery_feed;

-- ── Add columns to photo_comments ───────────────────────────────────────────

-- Self-referencing FK for threading (NULL = top-level comment)
ALTER TABLE public.photo_comments
  ADD COLUMN IF NOT EXISTS parent_comment_id uuid REFERENCES public.photo_comments(id) ON DELETE CASCADE;

-- Content type: 'text', 'gif', or 'mixed' (text + gif)
ALTER TABLE public.photo_comments
  ADD COLUMN IF NOT EXISTS content_type text NOT NULL DEFAULT 'text'
  CHECK (content_type IN ('text', 'gif', 'mixed'));

-- Media URL for GIF content
ALTER TABLE public.photo_comments
  ADD COLUMN IF NOT EXISTS media_url text;

-- Relax text NOT NULL — GIF-only comments have no text
ALTER TABLE public.photo_comments
  ALTER COLUMN text DROP NOT NULL;

-- Replace old check with new: must have text or media_url (or both)
ALTER TABLE public.photo_comments
  DROP CONSTRAINT IF EXISTS photo_comments_text_check;

ALTER TABLE public.photo_comments
  ADD CONSTRAINT photo_comments_content_check
  CHECK (
    (text IS NOT NULL AND length(trim(text)) >= 1 AND length(text) <= 500)
    OR (media_url IS NOT NULL AND length(trim(media_url)) >= 1)
  );

-- ── Index for threading ─────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_photo_comments_parent
  ON public.photo_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

-- ── Recreate photo_comments_detailed view ───────────────────────────────────

CREATE OR REPLACE VIEW public.photo_comments_detailed AS
SELECT
  pc.id,
  pc.photo_id,
  pc.user_id,
  pc.text,
  pc.created_at,
  pc.parent_comment_id,
  pc.content_type,
  pc.media_url,
  p.full_name    AS commenter_name,
  p.avatar_url   AS commenter_avatar,
  p.email        AS commenter_email,
  coalesce(lk.cnt, 0)::int AS like_count,
  exists(
    SELECT 1 FROM public.comment_likes cl
    WHERE cl.comment_id = pc.id AND cl.user_id = auth.uid()
  ) AS is_liked_by_me,
  coalesce(rc.cnt, 0)::int AS reply_count
FROM public.photo_comments pc
LEFT JOIN public.profiles p ON p.id = pc.user_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.comment_likes WHERE comment_id = pc.id
) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.photo_comments child
  WHERE child.parent_comment_id = pc.id
) rc ON true;

GRANT SELECT ON public.photo_comments_detailed TO authenticated;

-- ── Recreate gallery_feed view ──────────────────────────────────────────────

CREATE OR REPLACE VIEW public.gallery_feed AS
SELECT
  rp.id                                                        AS photo_id,
  rp.url                                                       AS photo_url,
  rp.display_order,
  rp.created_at                                                AS photo_created_at,
  r.id                                                         AS review_id,
  r.coffee_rating,
  r.vibe_rating,
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
  SELECT count(*)::int AS cnt FROM public.photo_comments WHERE photo_id = rp.id
) cm ON true;

GRANT SELECT ON public.gallery_feed TO authenticated;

-- ── Update notification trigger for threaded + GIF comments ─────────────────

CREATE OR REPLACE FUNCTION notify_photo_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _photo_owner uuid;
  _shop_name text;
  _actor_name text;
  _photo_row record;
  _preview text;
  _parent_author uuid;
BEGIN
  SELECT rp.id AS photo_id, r.user_id AS owner_id, cs.name AS shop
  INTO _photo_row
  FROM review_photos rp
  JOIN reviews r ON r.id = rp.review_id
  JOIN coffee_shops cs ON cs.id = r.coffee_shop_id
  WHERE rp.id = new.photo_id;

  IF _photo_row IS NULL THEN RETURN new; END IF;

  _photo_owner := _photo_row.owner_id;
  _shop_name := _photo_row.shop;
  _actor_name := get_display_name(new.user_id);

  -- Build preview text based on content type
  IF new.content_type = 'gif' THEN
    _preview := _actor_name || ' sent a GIF';
  ELSIF new.content_type = 'mixed' THEN
    _preview := _actor_name || ' commented: "' || left(new.text, 80) || '" + GIF';
  ELSE
    _preview := _actor_name || ' commented: "' || left(new.text, 80) || '"';
  END IF;

  -- If this is a reply, notify the parent comment author
  IF new.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO _parent_author FROM photo_comments WHERE id = new.parent_comment_id;
    IF _parent_author IS NOT NULL AND _parent_author != new.user_id THEN
      IF NOT recent_notification_exists(_parent_author, new.user_id, 'comment_reply'::notification_type, null, new.photo_id, new.id) THEN
        INSERT INTO notifications (recipient_id, actor_id, type, photo_id, comment_id, shop_name, preview_text)
        VALUES (_parent_author, new.user_id, 'comment_reply'::notification_type, new.photo_id, new.id, _shop_name,
          _actor_name || ' replied to your comment');
      END IF;
    END IF;
  END IF;

  -- Notify photo owner (skip if commenter is owner)
  IF _photo_owner != new.user_id THEN
    IF NOT recent_notification_exists(_photo_owner, new.user_id, 'photo_comment'::notification_type, null, new.photo_id, null) THEN
      INSERT INTO notifications (recipient_id, actor_id, type, photo_id, shop_name, preview_text)
      VALUES (_photo_owner, new.user_id, 'photo_comment'::notification_type, new.photo_id, _shop_name, _preview);
    END IF;
  END IF;

  -- Notify other commenters (excluding owner, self, and parent author already notified)
  INSERT INTO notifications (recipient_id, actor_id, type, photo_id, comment_id, shop_name, preview_text)
  SELECT DISTINCT
    pc.user_id,
    new.user_id,
    'comment_reply'::notification_type,
    new.photo_id,
    new.id,
    _shop_name,
    _actor_name || ' also commented'
  FROM photo_comments pc
  WHERE pc.photo_id = new.photo_id
    AND pc.user_id != new.user_id
    AND pc.user_id != _photo_owner
    AND (pc.user_id != _parent_author OR _parent_author IS NULL)
    AND NOT recent_notification_exists(pc.user_id, new.user_id, 'comment_reply'::notification_type, null, new.photo_id, new.id);

  RETURN new;
END;
$$;
