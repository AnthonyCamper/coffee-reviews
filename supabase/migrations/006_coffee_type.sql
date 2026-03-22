-- ═══════════════════════════════════════════════════════════════════════════
-- 006_coffee_type.sql — Add free-text coffee type to reviews
-- ═══════════════════════════════════════════════════════════════════════════

-- Add nullable column (existing reviews will have NULL)
alter table public.reviews
  add column if not exists coffee_type text;

comment on column public.reviews.coffee_type is
  'Free-text description of the coffee ordered, e.g. "flat white", "oat latte"';

-- Recreate gallery_feed to include coffee_type
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
  r.coffee_type,
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
join  public.reviews      r  on r.id  = rp.review_id
join  public.coffee_shops cs on cs.id = r.coffee_shop_id
left join public.profiles p  on p.id  = r.user_id
left join lateral (
  select count(*)::int as cnt from public.photo_likes    where photo_id = rp.id
) lk on true
left join lateral (
  select count(*)::int as cnt from public.photo_comments where photo_id = rp.id
) cm on true;

grant select on public.gallery_feed to authenticated;
