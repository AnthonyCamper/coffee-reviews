-- ============================================================================
-- 009 — Fix notification deep links: add photo_id to comment-level triggers
-- ============================================================================

-- ── Fix: notify_comment_like — include photo_id from the comment's photo ────

create or replace function notify_comment_like()
returns trigger
language plpgsql security definer as $$
declare
  _comment_owner uuid;
  _photo_id uuid;
  _shop_name text;
  _actor_name text;
begin
  select pc.user_id, pc.photo_id, cs.name
  into _comment_owner, _photo_id, _shop_name
  from photo_comments pc
  join review_photos rp on rp.id = pc.photo_id
  join reviews r on r.id = rp.review_id
  join coffee_shops cs on cs.id = r.coffee_shop_id
  where pc.id = new.comment_id;

  if _comment_owner is null or _comment_owner = new.user_id then return new; end if;
  if recent_notification_exists(_comment_owner, new.user_id, 'comment_like', null, null, new.comment_id) then return new; end if;

  _actor_name := get_display_name(new.user_id);

  insert into notifications (recipient_id, actor_id, type, photo_id, comment_id, shop_name, preview_text)
  values (
    _comment_owner,
    new.user_id,
    'comment_like',
    _photo_id,
    new.comment_id,
    _shop_name,
    _actor_name || ' liked your comment'
  );

  return new;
end;
$$;

-- ── Fix: notify_comment_reaction — include photo_id from the comment's photo ─

create or replace function notify_comment_reaction()
returns trigger
language plpgsql security definer as $$
declare
  _comment_owner uuid;
  _photo_id uuid;
  _shop_name text;
  _actor_name text;
begin
  select pc.user_id, pc.photo_id, cs.name
  into _comment_owner, _photo_id, _shop_name
  from photo_comments pc
  join review_photos rp on rp.id = pc.photo_id
  join reviews r on r.id = rp.review_id
  join coffee_shops cs on cs.id = r.coffee_shop_id
  where pc.id = new.comment_id;

  if _comment_owner is null or _comment_owner = new.user_id then return new; end if;
  if recent_notification_exists(_comment_owner, new.user_id, 'comment_reaction', null, null, new.comment_id) then return new; end if;

  _actor_name := get_display_name(new.user_id);

  insert into notifications (recipient_id, actor_id, type, photo_id, comment_id, shop_name, preview_text)
  values (
    _comment_owner,
    new.user_id,
    'comment_reaction',
    _photo_id,
    new.comment_id,
    _shop_name,
    _actor_name || ' reacted ' || new.reaction_type || ' to your comment'
  );

  return new;
end;
$$;

-- ── Backfill: set photo_id on existing comment_like/comment_reaction rows ────

update notifications n
set photo_id = pc.photo_id
from photo_comments pc
where n.comment_id = pc.id
  and n.photo_id is null
  and n.type in ('comment_like', 'comment_reaction');
