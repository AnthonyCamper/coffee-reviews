-- ============================================================================
-- 010 — Review-level comments (separate from photo comments)
-- ============================================================================

-- ── review_comments ─────────────────────────────────────────────────────────
-- Mirrors photo_comments structure but references reviews instead of photos.

CREATE TABLE IF NOT EXISTS public.review_comments (
  id                uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id         uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id           uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  text              text CHECK (
                      (text IS NOT NULL AND length(trim(text)) >= 1 AND length(text) <= 500)
                      OR (media_url IS NOT NULL AND length(trim(media_url)) >= 1)
                    ),
  parent_comment_id uuid REFERENCES public.review_comments(id) ON DELETE CASCADE,
  content_type      text NOT NULL DEFAULT 'text'
                    CHECK (content_type IN ('text', 'gif', 'mixed')),
  media_url         text,
  created_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_review_comments_review ON public.review_comments (review_id, created_at);
CREATE INDEX idx_review_comments_parent ON public.review_comments (parent_comment_id)
  WHERE parent_comment_id IS NOT NULL;

ALTER TABLE public.review_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read review comments"
  ON public.review_comments FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review comments"
  ON public.review_comments FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review comments or admins any"
  ON public.review_comments FOR DELETE USING (user_id = auth.uid() OR public.is_admin());

GRANT SELECT, INSERT, DELETE ON public.review_comments TO authenticated;


-- ── review_comment_likes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_comment_likes (
  id         uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id uuid NOT NULL REFERENCES public.review_comments(id) ON DELETE CASCADE,
  user_id    uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id)
);

CREATE INDEX idx_review_comment_likes_comment ON public.review_comment_likes (comment_id);
ALTER TABLE public.review_comment_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read review comment likes"
  ON public.review_comment_likes FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review comment likes"
  ON public.review_comment_likes FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review comment likes"
  ON public.review_comment_likes FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.review_comment_likes TO authenticated;


-- ── review_comment_reactions ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.review_comment_reactions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  comment_id    uuid NOT NULL REFERENCES public.review_comments(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (reaction_type IN ('\ud83d\udc4d','\u2764\ufe0f','\ud83d\ude02','\ud83d\udd25')),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (comment_id, user_id, reaction_type)
);

CREATE INDEX idx_review_comment_reactions_comment ON public.review_comment_reactions (comment_id);
ALTER TABLE public.review_comment_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read review comment reactions"
  ON public.review_comment_reactions FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review comment reactions"
  ON public.review_comment_reactions FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review comment reactions"
  ON public.review_comment_reactions FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.review_comment_reactions TO authenticated;


-- ── review_comments_detailed view ───────────────────────────────────────────

CREATE OR REPLACE VIEW public.review_comments_detailed AS
SELECT
  rc.id,
  rc.review_id,
  rc.user_id,
  rc.text,
  rc.created_at,
  rc.parent_comment_id,
  rc.content_type,
  rc.media_url,
  p.full_name    AS commenter_name,
  p.avatar_url   AS commenter_avatar,
  p.email        AS commenter_email,
  coalesce(lk.cnt, 0)::int AS like_count,
  exists(
    SELECT 1 FROM public.review_comment_likes cl
    WHERE cl.comment_id = rc.id AND cl.user_id = auth.uid()
  ) AS is_liked_by_me,
  coalesce(rply.cnt, 0)::int AS reply_count
FROM public.review_comments rc
LEFT JOIN public.profiles p ON p.id = rc.user_id
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_comment_likes WHERE comment_id = rc.id
) lk ON true
LEFT JOIN LATERAL (
  SELECT count(*)::int AS cnt FROM public.review_comments child
  WHERE child.parent_comment_id = rc.id
) rply ON true;

GRANT SELECT ON public.review_comments_detailed TO authenticated;


-- ── Notification trigger for review comments ────────────────────────────────
-- Notifies the review author when someone comments on their review.
-- Uses existing notification_type values ('photo_comment' for review owner,
-- 'comment_reply' for threading) with review_id set instead of photo_id.

CREATE OR REPLACE FUNCTION notify_review_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  _review_owner uuid;
  _shop_name text;
  _actor_name text;
  _preview text;
  _parent_author uuid;
  _review_id uuid;
BEGIN
  -- Look up review owner and shop name
  SELECT r.user_id, cs.name, r.id
  INTO _review_owner, _shop_name, _review_id
  FROM reviews r
  JOIN coffee_shops cs ON cs.id = r.coffee_shop_id
  WHERE r.id = new.review_id;

  IF _review_owner IS NULL THEN RETURN new; END IF;

  _actor_name := get_display_name(new.user_id);

  -- Build preview text
  IF new.content_type = 'gif' THEN
    _preview := _actor_name || ' sent a GIF on your review';
  ELSIF new.content_type = 'mixed' THEN
    _preview := _actor_name || ' commented: "' || left(new.text, 80) || '" + GIF';
  ELSE
    _preview := _actor_name || ' commented: "' || left(new.text, 80) || '"';
  END IF;

  -- If this is a reply, notify the parent comment author
  IF new.parent_comment_id IS NOT NULL THEN
    SELECT user_id INTO _parent_author FROM review_comments WHERE id = new.parent_comment_id;
    IF _parent_author IS NOT NULL AND _parent_author != new.user_id THEN
      IF NOT recent_notification_exists(_parent_author, new.user_id, 'comment_reply'::notification_type, _review_id, null, null) THEN
        INSERT INTO notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
        VALUES (_parent_author, new.user_id, 'comment_reply'::notification_type, _review_id, _shop_name,
          _actor_name || ' replied to your comment');
      END IF;
    END IF;
  END IF;

  -- Notify review owner (skip if commenter is owner)
  IF _review_owner != new.user_id THEN
    IF NOT recent_notification_exists(_review_owner, new.user_id, 'photo_comment'::notification_type, _review_id, null, null) THEN
      INSERT INTO notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
      VALUES (_review_owner, new.user_id, 'photo_comment'::notification_type, _review_id, _shop_name, _preview);
    END IF;
  END IF;

  -- Notify other commenters on this review
  INSERT INTO notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
  SELECT DISTINCT
    rc.user_id,
    new.user_id,
    'comment_reply'::notification_type,
    _review_id,
    _shop_name,
    _actor_name || ' also commented'
  FROM review_comments rc
  WHERE rc.review_id = new.review_id
    AND rc.user_id != new.user_id
    AND rc.user_id != _review_owner
    AND (rc.user_id != _parent_author OR _parent_author IS NULL)
    AND NOT recent_notification_exists(rc.user_id, new.user_id, 'comment_reply'::notification_type, _review_id, null, null);

  RETURN new;
END;
$$;

CREATE TRIGGER trg_notify_review_comment
  AFTER INSERT ON review_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_comment();
