-- ============================================================================
-- 007 — Push notifications: preferences, subscriptions, notification records
-- ============================================================================

-- ── Notification preferences per user ────────────────────────────────────────

create table if not exists notification_preferences (
  user_id        uuid primary key references auth.users on delete cascade,
  enabled        boolean not null default true,       -- master switch
  new_review     boolean not null default true,       -- someone posts a new review
  photo_comment  boolean not null default true,       -- comment on your photo
  comment_reply  boolean not null default true,       -- reply on a photo you commented on
  photo_like     boolean not null default true,       -- like on your photo
  comment_like   boolean not null default true,       -- like on your comment
  comment_react  boolean not null default true,       -- reaction on your comment
  quiet_mode     boolean not null default false,      -- suppress push, still record in-app
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

alter table notification_preferences enable row level security;

create policy "Users read own preferences"
  on notification_preferences for select
  using (auth.uid() = user_id);

create policy "Users upsert own preferences"
  on notification_preferences for insert
  with check (auth.uid() = user_id);

create policy "Users update own preferences"
  on notification_preferences for update
  using (auth.uid() = user_id);

-- Auto-create preferences row when a profile is created
create or replace function create_notification_preferences()
returns trigger
language plpgsql security definer as $$
begin
  insert into notification_preferences (user_id)
  values (new.id)
  on conflict (user_id) do nothing;
  return new;
end;
$$;

create trigger trg_create_notification_preferences
  after insert on profiles
  for each row
  execute function create_notification_preferences();

-- ── Push subscriptions (one user can have many devices) ──────────────────────

create table if not exists push_subscriptions (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users on delete cascade,
  endpoint       text not null,
  p256dh         text not null,                       -- client public key
  auth_key       text not null,                       -- auth secret
  user_agent     text,                                -- device identification
  created_at     timestamptz not null default now(),
  last_success   timestamptz,                         -- last successful push
  failure_count  int not null default 0,              -- consecutive failures
  unique (user_id, endpoint)
);

create index idx_push_subs_user on push_subscriptions (user_id);

alter table push_subscriptions enable row level security;

create policy "Users read own subscriptions"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users insert own subscriptions"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users delete own subscriptions"
  on push_subscriptions for delete
  using (auth.uid() = user_id);

-- ── Notifications (in-app + push record) ─────────────────────────────────────

create type notification_type as enum (
  'new_review',
  'photo_comment',
  'comment_reply',
  'photo_like',
  'comment_like',
  'comment_reaction'
);

create table if not exists notifications (
  id              uuid primary key default gen_random_uuid(),
  recipient_id    uuid not null references auth.users on delete cascade,
  actor_id        uuid references auth.users on delete set null,
  type            notification_type not null,
  -- Polymorphic target references
  review_id       uuid references reviews on delete cascade,
  photo_id        uuid references review_photos on delete cascade,
  comment_id      uuid references photo_comments on delete cascade,
  shop_name       text,                               -- denormalized for display
  preview_text    text,                               -- e.g. comment snippet
  -- State
  read            boolean not null default false,
  push_sent       boolean not null default false,
  created_at      timestamptz not null default now()
);

create index idx_notifications_recipient on notifications (recipient_id, created_at desc);
create index idx_notifications_unread on notifications (recipient_id) where read = false;

alter table notifications enable row level security;

create policy "Users read own notifications"
  on notifications for select
  using (auth.uid() = recipient_id);

create policy "Users update own notifications"
  on notifications for update
  using (auth.uid() = recipient_id);

-- Service role can insert (triggers run as security definer)
create policy "System inserts notifications"
  on notifications for insert
  with check (true);

-- ── Helper: get actor display name ───────────────────────────────────────────

create or replace function get_display_name(uid uuid)
returns text
language sql stable security definer as $$
  select coalesce(display_name, full_name, split_part(email, '@', 1))
  from profiles where id = uid limit 1;
$$;

-- ── Helper: dedup — check if same notification was sent within 5 min ─────────

create or replace function recent_notification_exists(
  _recipient uuid, _actor uuid, _type notification_type,
  _review uuid, _photo uuid, _comment uuid
)
returns boolean
language sql stable security definer as $$
  select exists(
    select 1 from notifications
    where recipient_id = _recipient
      and actor_id is not distinct from _actor
      and type = _type
      and review_id is not distinct from _review
      and photo_id is not distinct from _photo
      and comment_id is not distinct from _comment
      and created_at > now() - interval '5 minutes'
  );
$$;

-- ── Trigger: new review → notify all other approved users ────────────────────

create or replace function notify_new_review()
returns trigger
language plpgsql security definer as $$
declare
  _shop_name text;
  _actor_name text;
begin
  select name into _shop_name from coffee_shops where id = new.coffee_shop_id;
  _actor_name := get_display_name(new.user_id);

  insert into notifications (recipient_id, actor_id, type, review_id, shop_name, preview_text)
  select
    p.id,
    new.user_id,
    'new_review',
    new.id,
    _shop_name,
    _actor_name || ' reviewed ' || coalesce(_shop_name, 'a coffee shop')
  from profiles p
  where p.id != new.user_id
    and p.status = 'approved'
    and not recent_notification_exists(p.id, new.user_id, 'new_review', new.id, null, null);

  return new;
end;
$$;

create trigger trg_notify_new_review
  after insert on reviews
  for each row
  execute function notify_new_review();

-- ── Trigger: photo comment → notify photo owner + other commenters ───────────

create or replace function notify_photo_comment()
returns trigger
language plpgsql security definer as $$
declare
  _photo_owner uuid;
  _shop_name text;
  _actor_name text;
  _photo_row record;
begin
  select rp.id as photo_id, r.user_id as owner_id, cs.name as shop
  into _photo_row
  from review_photos rp
  join reviews r on r.id = rp.review_id
  join coffee_shops cs on cs.id = r.coffee_shop_id
  where rp.id = new.photo_id;

  if _photo_row is null then return new; end if;

  _photo_owner := _photo_row.owner_id;
  _shop_name := _photo_row.shop;
  _actor_name := get_display_name(new.user_id);

  if _photo_owner = new.user_id then return new; end if;

  if not recent_notification_exists(_photo_owner, new.user_id, 'photo_comment', null, new.photo_id, null) then
    insert into notifications (recipient_id, actor_id, type, photo_id, shop_name, preview_text)
    values (
      _photo_owner,
      new.user_id,
      'photo_comment',
      new.photo_id,
      _shop_name,
      _actor_name || ' commented: "' || left(new.text, 80) || '"'
    );
  end if;

  insert into notifications (recipient_id, actor_id, type, photo_id, comment_id, shop_name, preview_text)
  select distinct
    pc.user_id,
    new.user_id,
    'comment_reply',
    new.photo_id,
    new.id,
    _shop_name,
    _actor_name || ' also commented: "' || left(new.text, 80) || '"'
  from photo_comments pc
  where pc.photo_id = new.photo_id
    and pc.user_id != new.user_id
    and pc.user_id != _photo_owner
    and not recent_notification_exists(pc.user_id, new.user_id, 'comment_reply', null, new.photo_id, new.id);

  return new;
end;
$$;

create trigger trg_notify_photo_comment
  after insert on photo_comments
  for each row
  execute function notify_photo_comment();

-- ── Trigger: photo like → notify photo owner ─────────────────────────────────

create or replace function notify_photo_like()
returns trigger
language plpgsql security definer as $$
declare
  _photo_owner uuid;
  _shop_name text;
  _actor_name text;
begin
  select r.user_id, cs.name
  into _photo_owner, _shop_name
  from review_photos rp
  join reviews r on r.id = rp.review_id
  join coffee_shops cs on cs.id = r.coffee_shop_id
  where rp.id = new.photo_id;

  if _photo_owner is null or _photo_owner = new.user_id then return new; end if;
  if recent_notification_exists(_photo_owner, new.user_id, 'photo_like', null, new.photo_id, null) then return new; end if;

  _actor_name := get_display_name(new.user_id);

  insert into notifications (recipient_id, actor_id, type, photo_id, shop_name, preview_text)
  values (
    _photo_owner,
    new.user_id,
    'photo_like',
    new.photo_id,
    _shop_name,
    _actor_name || ' liked your photo'
  );

  return new;
end;
$$;

create trigger trg_notify_photo_like
  after insert on photo_likes
  for each row
  execute function notify_photo_like();

-- ── Trigger: comment like → notify comment owner ─────────────────────────────

create or replace function notify_comment_like()
returns trigger
language plpgsql security definer as $$
declare
  _comment_owner uuid;
  _shop_name text;
  _actor_name text;
  _comment_text text;
begin
  select pc.user_id, pc.text, cs.name
  into _comment_owner, _comment_text, _shop_name
  from photo_comments pc
  join review_photos rp on rp.id = pc.photo_id
  join reviews r on r.id = rp.review_id
  join coffee_shops cs on cs.id = r.coffee_shop_id
  where pc.id = new.comment_id;

  if _comment_owner is null or _comment_owner = new.user_id then return new; end if;
  if recent_notification_exists(_comment_owner, new.user_id, 'comment_like', null, null, new.comment_id) then return new; end if;

  _actor_name := get_display_name(new.user_id);

  insert into notifications (recipient_id, actor_id, type, comment_id, shop_name, preview_text)
  values (
    _comment_owner,
    new.user_id,
    'comment_like',
    new.comment_id,
    _shop_name,
    _actor_name || ' liked your comment'
  );

  return new;
end;
$$;

create trigger trg_notify_comment_like
  after insert on comment_likes
  for each row
  execute function notify_comment_like();

-- ── Trigger: comment reaction → notify comment owner ─────────────────────────

create or replace function notify_comment_reaction()
returns trigger
language plpgsql security definer as $$
declare
  _comment_owner uuid;
  _shop_name text;
  _actor_name text;
begin
  select pc.user_id, cs.name
  into _comment_owner, _shop_name
  from photo_comments pc
  join review_photos rp on rp.id = pc.photo_id
  join reviews r on r.id = rp.review_id
  join coffee_shops cs on cs.id = r.coffee_shop_id
  where pc.id = new.comment_id;

  if _comment_owner is null or _comment_owner = new.user_id then return new; end if;
  if recent_notification_exists(_comment_owner, new.user_id, 'comment_reaction', null, null, new.comment_id) then return new; end if;

  _actor_name := get_display_name(new.user_id);

  insert into notifications (recipient_id, actor_id, type, comment_id, shop_name, preview_text)
  values (
    _comment_owner,
    new.user_id,
    'comment_reaction',
    new.comment_id,
    _shop_name,
    _actor_name || ' reacted ' || new.reaction_type || ' to your comment'
  );

  return new;
end;
$$;

create trigger trg_notify_comment_reaction
  after insert on comment_reactions
  for each row
  execute function notify_comment_reaction();

-- ── Auto-update updated_at on notification_preferences ───────────────────────

create or replace function update_notification_prefs_timestamp()
returns trigger
language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger trg_notification_prefs_updated
  before update on notification_preferences
  for each row
  execute function update_notification_prefs_timestamp();

-- ── Cleanup: purge notifications older than 90 days ──────────────────────────
-- (Run via pg_cron or manually)

create or replace function cleanup_old_notifications()
returns void
language sql security definer as $$
  delete from notifications where created_at < now() - interval '90 days';
  delete from push_subscriptions where failure_count >= 5;
$$;

-- ── RPC: increment push subscription failure count ───────────────────────────

create or replace function increment_failure_count(sub_id uuid)
returns void
language sql security definer as $$
  update push_subscriptions
  set failure_count = failure_count + 1
  where id = sub_id;
$$;

-- ── Create preferences for existing users ────────────────────────────────────

insert into notification_preferences (user_id)
select id from profiles
on conflict (user_id) do nothing;
