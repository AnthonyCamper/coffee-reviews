-- ============================================================================
-- 014 — Fix push notification pipeline
--
-- Root causes fixed:
--   1. Missing UPDATE RLS policy on push_subscriptions — upsert fails on
--      re-subscription (same device/endpoint), leaving stale encryption keys
--   2. notifications.comment_id FK only references photo_comments — blocks
--      storing review_comment IDs after comment unification (013)
--   3. No notification triggers for review_comment_likes/reactions — these
--      events silently produce zero push notifications
--   4. notify_review_comment() never sets comment_id — deep links can't
--      target specific comments within a review
-- ============================================================================

-- ── 1. Add UPDATE RLS policy on push_subscriptions ──────────────────────────
-- Without this, the client-side upsert (onConflict: user_id,endpoint) fails
-- when re-subscribing on the same device. The INSERT succeeds the first time,
-- but subsequent upserts need UPDATE permission to refresh p256dh/auth_key.

CREATE POLICY "Users update own subscriptions"
  ON push_subscriptions FOR UPDATE
  USING (auth.uid() = user_id);

-- ── 2. Drop FK constraint on notifications.comment_id ───────────────────────
-- After migration 013 unified comments into review_comments, this FK
-- (referencing photo_comments) prevents storing review_comment IDs.
-- The column stays as a generic UUID for deep linking.

ALTER TABLE notifications DROP CONSTRAINT IF EXISTS notifications_comment_id_fkey;

-- ── 3. Update notify_review_comment() to set comment_id ─────────────────────
-- Previously only set review_id — now includes comment_id for deep linking
-- to the specific comment within the review thread.

CREATE OR REPLACE FUNCTION notify_review_comment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _review_owner uuid;
  _shop_name text;
  _actor_name text;
  _preview text;
  _parent_author uuid;
  _review_id uuid;
BEGIN
  SELECT r.user_id, cs.name, r.id
  INTO _review_owner, _shop_name, _review_id
  FROM reviews r
  JOIN coffee_shops cs ON cs.id = r.coffee_shop_id
  WHERE r.id = new.review_id;

  IF _review_owner IS NULL THEN RETURN new; END IF;

  _actor_name := get_display_name(new.user_id);

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
      IF NOT recent_notification_exists(_parent_author, new.user_id, 'comment_reply'::notification_type, _review_id, null, new.id) THEN
        INSERT INTO notifications (recipient_id, actor_id, type, review_id, comment_id, shop_name, preview_text)
        VALUES (_parent_author, new.user_id, 'comment_reply'::notification_type, _review_id, new.id, _shop_name,
          _actor_name || ' replied to your comment');
      END IF;
    END IF;
  END IF;

  -- Notify review owner (skip if commenter is owner)
  IF _review_owner != new.user_id THEN
    IF NOT recent_notification_exists(_review_owner, new.user_id, 'photo_comment'::notification_type, _review_id, null, new.id) THEN
      INSERT INTO notifications (recipient_id, actor_id, type, review_id, comment_id, shop_name, preview_text)
      VALUES (_review_owner, new.user_id, 'photo_comment'::notification_type, _review_id, new.id, _shop_name, _preview);
    END IF;
  END IF;

  -- Notify other commenters on this review
  INSERT INTO notifications (recipient_id, actor_id, type, review_id, comment_id, shop_name, preview_text)
  SELECT DISTINCT
    rc.user_id,
    new.user_id,
    'comment_reply'::notification_type,
    _review_id,
    new.id,
    _shop_name,
    _actor_name || ' also commented'
  FROM review_comments rc
  WHERE rc.review_id = new.review_id
    AND rc.user_id != new.user_id
    AND rc.user_id != _review_owner
    AND (rc.user_id != _parent_author OR _parent_author IS NULL)
    AND NOT recent_notification_exists(rc.user_id, new.user_id, 'comment_reply'::notification_type, _review_id, null, new.id);

  RETURN new;
END;
$$;

-- ── 4. Notification trigger for review_comment_likes ────────────────────────

CREATE OR REPLACE FUNCTION notify_review_comment_like()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _comment_owner uuid;
  _review_id uuid;
  _shop_name text;
  _actor_name text;
BEGIN
  SELECT rc.user_id, rc.review_id
  INTO _comment_owner, _review_id
  FROM review_comments rc
  WHERE rc.id = new.comment_id;

  IF _comment_owner IS NULL OR _comment_owner = new.user_id THEN RETURN new; END IF;

  SELECT cs.name INTO _shop_name
  FROM reviews r
  JOIN coffee_shops cs ON cs.id = r.coffee_shop_id
  WHERE r.id = _review_id;

  IF recent_notification_exists(_comment_owner, new.user_id, 'comment_like'::notification_type, _review_id, null, new.comment_id) THEN
    RETURN new;
  END IF;

  _actor_name := get_display_name(new.user_id);

  INSERT INTO notifications (recipient_id, actor_id, type, review_id, comment_id, shop_name, preview_text)
  VALUES (
    _comment_owner,
    new.user_id,
    'comment_like'::notification_type,
    _review_id,
    new.comment_id,
    _shop_name,
    _actor_name || ' liked your comment'
  );

  RETURN new;
END;
$$;

CREATE TRIGGER trg_notify_review_comment_like
  AFTER INSERT ON review_comment_likes
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_comment_like();

-- ── 5. Notification trigger for review_comment_reactions ─────────────────────

CREATE OR REPLACE FUNCTION notify_review_comment_reaction()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  _comment_owner uuid;
  _review_id uuid;
  _shop_name text;
  _actor_name text;
BEGIN
  SELECT rc.user_id, rc.review_id
  INTO _comment_owner, _review_id
  FROM review_comments rc
  WHERE rc.id = new.comment_id;

  IF _comment_owner IS NULL OR _comment_owner = new.user_id THEN RETURN new; END IF;

  SELECT cs.name INTO _shop_name
  FROM reviews r
  JOIN coffee_shops cs ON cs.id = r.coffee_shop_id
  WHERE r.id = _review_id;

  IF recent_notification_exists(_comment_owner, new.user_id, 'comment_reaction'::notification_type, _review_id, null, new.comment_id) THEN
    RETURN new;
  END IF;

  _actor_name := get_display_name(new.user_id);

  INSERT INTO notifications (recipient_id, actor_id, type, review_id, comment_id, shop_name, preview_text)
  VALUES (
    _comment_owner,
    new.user_id,
    'comment_reaction'::notification_type,
    _review_id,
    new.comment_id,
    _shop_name,
    _actor_name || ' reacted ' || new.reaction_type || ' to your comment'
  );

  RETURN new;
END;
$$;

CREATE TRIGGER trg_notify_review_comment_reaction
  AFTER INSERT ON review_comment_reactions
  FOR EACH ROW
  EXECUTE FUNCTION notify_review_comment_reaction();
