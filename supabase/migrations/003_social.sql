-- ═══════════════════════════════════════════════════════════════════════════
-- 003_social.sql — Likes, Comments, and Reactions
-- ═══════════════════════════════════════════════════════════════════════════

-- ── photo_likes ──────────────────────────────────────────────────────────────
create table if not exists public.photo_likes (
  id         uuid primary key default uuid_generate_v4(),
  photo_id   uuid not null references public.review_photos(id) on delete cascade,
  user_id    uuid not null references auth.users(id)        on delete cascade,
  created_at timestamptz not null default now(),
  unique (photo_id, user_id)
);
create index on public.photo_likes (photo_id);
alter table public.photo_likes enable row level security;

create policy "Approved users can read photo likes"
  on public.photo_likes for select using (public.is_approved());
create policy "Approved users can insert own photo likes"
  on public.photo_likes for insert with check (public.is_approved() and user_id = auth.uid());
create policy "Users can delete own photo likes"
  on public.photo_likes for delete using (user_id = auth.uid());

grant select, insert, delete on public.photo_likes to authenticated;


-- ── photo_comments ────────────────────────────────────────────────────────────
create table if not exists public.photo_comments (
  id         uuid primary key default uuid_generate_v4(),
  photo_id   uuid not null references public.review_photos(id) on delete cascade,
  user_id    uuid not null references auth.users(id)           on delete cascade,
  text       text not null check (length(trim(text)) >= 1 and length(text) <= 500),
  created_at timestamptz not null default now()
);
create index on public.photo_comments (photo_id, created_at);
alter table public.photo_comments enable row level security;

create policy "Approved users can read comments"
  on public.photo_comments for select using (public.is_approved());
create policy "Approved users can insert own comments"
  on public.photo_comments for insert with check (public.is_approved() and user_id = auth.uid());
create policy "Users can delete own comments or admins any"
  on public.photo_comments for delete using (user_id = auth.uid() or public.is_admin());

grant select, insert, delete on public.photo_comments to authenticated;


-- ── comment_likes ─────────────────────────────────────────────────────────────
create table if not exists public.comment_likes (
  id         uuid primary key default uuid_generate_v4(),
  comment_id uuid not null references public.photo_comments(id) on delete cascade,
  user_id    uuid not null references auth.users(id)            on delete cascade,
  created_at timestamptz not null default now(),
  unique (comment_id, user_id)
);
create index on public.comment_likes (comment_id);
alter table public.comment_likes enable row level security;

create policy "Approved users can read comment likes"
  on public.comment_likes for select using (public.is_approved());
create policy "Approved users can insert own comment likes"
  on public.comment_likes for insert with check (public.is_approved() and user_id = auth.uid());
create policy "Users can delete own comment likes"
  on public.comment_likes for delete using (user_id = auth.uid());

grant select, insert, delete on public.comment_likes to authenticated;


-- ── comment_reactions ─────────────────────────────────────────────────────────
create table if not exists public.comment_reactions (
  id            uuid primary key default uuid_generate_v4(),
  comment_id    uuid not null references public.photo_comments(id) on delete cascade,
  user_id       uuid not null references auth.users(id)            on delete cascade,
  reaction_type text not null check (reaction_type in ('👍','❤️','😂','🔥')),
  created_at    timestamptz not null default now(),
  unique (comment_id, user_id, reaction_type)
);
create index on public.comment_reactions (comment_id);
alter table public.comment_reactions enable row level security;

create policy "Approved users can read reactions"
  on public.comment_reactions for select using (public.is_approved());
create policy "Approved users can insert own reactions"
  on public.comment_reactions for insert with check (public.is_approved() and user_id = auth.uid());
create policy "Users can delete own reactions"
  on public.comment_reactions for delete using (user_id = auth.uid());

grant select, insert, delete on public.comment_reactions to authenticated;


-- ── gallery_feed view ─────────────────────────────────────────────────────────
-- One row per review_photo with aggregated counts and current-user like flag.
create or replace view public.gallery_feed as
select
  rp.id                                                        as photo_id,
  rp.url                                                       as photo_url,
  rp.display_order,
  rp.created_at                                                as photo_created_at,
  r.id                                                         as review_id,
  r.coffee_rating,
  r.vibe_rating,
  r.note,
  r.visited_at,
  cs.id                                                        as shop_id,
  cs.name                                                      as shop_name,
  cs.address                                                   as shop_address,
  p.id                                                         as reviewer_id,
  p.full_name                                                  as reviewer_name,
  p.avatar_url                                                 as reviewer_avatar,
  p.email                                                      as reviewer_email,
  coalesce(lk.cnt, 0)::int                                     as like_count,
  coalesce(cm.cnt, 0)::int                                     as comment_count,
  exists(
    select 1 from public.photo_likes pl
    where pl.photo_id = rp.id and pl.user_id = auth.uid()
  )                                                            as is_liked_by_me
from public.review_photos rp
join  public.reviews     r  on r.id  = rp.review_id
join  public.coffee_shops cs on cs.id = r.coffee_shop_id
left join public.profiles p  on p.id  = r.user_id
left join lateral (
  select count(*)::int as cnt from public.photo_likes    where photo_id   = rp.id
) lk on true
left join lateral (
  select count(*)::int as cnt from public.photo_comments where photo_id   = rp.id
) cm on true;

grant select on public.gallery_feed to authenticated;


-- ── photo_comments_detailed view ──────────────────────────────────────────────
create or replace view public.photo_comments_detailed as
select
  pc.id,
  pc.photo_id,
  pc.user_id,
  pc.text,
  pc.created_at,
  p.full_name    as commenter_name,
  p.avatar_url   as commenter_avatar,
  p.email        as commenter_email,
  coalesce(lk.cnt, 0)::int as like_count,
  exists(
    select 1 from public.comment_likes cl
    where cl.comment_id = pc.id and cl.user_id = auth.uid()
  ) as is_liked_by_me
from public.photo_comments pc
left join public.profiles p on p.id = pc.user_id
left join lateral (
  select count(*)::int as cnt from public.comment_likes where comment_id = pc.id
) lk on true;

grant select on public.photo_comments_detailed to authenticated;
