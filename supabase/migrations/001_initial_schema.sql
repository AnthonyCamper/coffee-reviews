-- ═══════════════════════════════════════════════════════════════════════════
-- {{GIRLS_NAME}} Coffee Ratings — Initial Schema
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor → New query)
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Extensions ───────────────────────────────────────────────────────────────
create extension if not exists "uuid-ossp";

-- ── Profiles ─────────────────────────────────────────────────────────────────
-- Mirrors data from auth.users so we can join reviewer info to reviews.
create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null,
  full_name   text,
  avatar_url  text,
  created_at  timestamptz not null default now()
);

comment on table public.profiles is
  'One row per Supabase auth user. Auto-populated by trigger.';

-- Auto-create profile on new sign-up
create or replace function public.handle_new_user()
returns trigger language plpgsql security definer as $$
begin
  insert into public.profiles (id, email, full_name, avatar_url)
  values (
    new.id,
    new.email,
    new.raw_user_meta_data->>'full_name',
    new.raw_user_meta_data->>'avatar_url'
  )
  on conflict (id) do update set
    email      = excluded.email,
    full_name  = excluded.full_name,
    avatar_url = excluded.avatar_url;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert or update on auth.users
  for each row execute function public.handle_new_user();


-- ── Approved Users ────────────────────────────────────────────────────────────
-- ┌─────────────────────────────────────────────────────────────────────────┐
-- │  HOW TO ADD APPROVED USERS                                              │
-- │                                                                         │
-- │  Insert a row into this table with the Google email address:            │
-- │                                                                         │
-- │  insert into public.approved_users (email, is_admin)                   │
-- │  values ('talia@gmail.com', true);                                      │
-- │                                                                         │
-- │  is_admin = true  → can edit/delete ANY review                         │
-- │  is_admin = false → can only edit/delete their own reviews              │
-- └─────────────────────────────────────────────────────────────────────────┘
create table if not exists public.approved_users (
  email      text primary key,
  is_admin   boolean not null default false,
  added_at   timestamptz not null default now()
);

comment on table public.approved_users is
  'Allowlist of Google email addresses permitted to access the app. '
  'Add rows here to grant access. Set is_admin = true for Talia and admins.';

-- Seed Talia as admin — update email to Talia''s actual Google email
-- insert into public.approved_users (email, is_admin) values
--   ('talia@gmail.com', true);


-- ── Coffee Shops ──────────────────────────────────────────────────────────────
create table if not exists public.coffee_shops (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  address     text not null,
  lat         double precision not null,
  lng         double precision not null,
  created_at  timestamptz not null default now(),
  unique (name, address)
);

comment on table public.coffee_shops is
  'One row per unique coffee shop (name + address). Multiple reviews can exist per shop.';
comment on column public.coffee_shops.lat is 'WGS84 latitude';
comment on column public.coffee_shops.lng is 'WGS84 longitude';


-- ── Reviews ───────────────────────────────────────────────────────────────────
create table if not exists public.reviews (
  id              uuid primary key default uuid_generate_v4(),
  coffee_shop_id  uuid not null references public.coffee_shops(id) on delete cascade,
  user_id         uuid not null references auth.users(id) on delete cascade,
  coffee_rating   smallint not null check (coffee_rating between 1 and 5),
  vibe_rating     smallint not null check (vibe_rating between 1 and 5),
  note            text,
  visited_at      date not null,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

comment on table public.reviews is
  'A single user''s review of a coffee shop. One user may review the same shop multiple times.';
comment on column public.reviews.coffee_rating is '1 (poor) to 5 (exceptional) — quality of coffee';
comment on column public.reviews.vibe_rating   is '1 (poor) to 5 (exceptional) — atmosphere/vibe';

-- Auto-update updated_at
create or replace function public.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists set_reviews_updated_at on public.reviews;
create trigger set_reviews_updated_at
  before update on public.reviews
  for each row execute function public.set_updated_at();


-- ── Convenience view ──────────────────────────────────────────────────────────
-- The frontend queries this view to get reviews joined with reviewer profile info.
create or replace view public.reviews_with_profiles as
select
  r.id,
  r.coffee_shop_id,
  r.user_id,
  r.coffee_rating,
  r.vibe_rating,
  r.note,
  r.visited_at,
  r.created_at,
  r.updated_at,
  p.full_name  as reviewer_name,
  p.avatar_url as reviewer_avatar,
  p.email      as reviewer_email
from public.reviews r
left join public.profiles p on p.id = r.user_id;

comment on view public.reviews_with_profiles is
  'Reviews joined with reviewer profile info. Used by the frontend.';


-- ═══════════════════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════════════════

alter table public.profiles      enable row level security;
alter table public.approved_users enable row level security;
alter table public.coffee_shops  enable row level security;
alter table public.reviews       enable row level security;

-- Helper: check if the current user's email is in the approved list
create or replace function public.is_approved()
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from public.approved_users
    where email = (select email from auth.users where id = auth.uid())
  );
$$;

-- Helper: check if current user is an admin
create or replace function public.is_admin()
returns boolean language sql security definer stable as $$
  select coalesce((
    select is_admin from public.approved_users
    where email = (select email from auth.users where id = auth.uid())
  ), false);
$$;


-- ── profiles policies ─────────────────────────────────────────────────────────
create policy "Approved users can read all profiles"
  on public.profiles for select
  using (public.is_approved());

create policy "Users can update their own profile"
  on public.profiles for update
  using (id = auth.uid());


-- ── approved_users policies ───────────────────────────────────────────────────
-- Any authenticated approved user can read the allowlist (needed for auth check)
create policy "Approved users can read approved_users"
  on public.approved_users for select
  using (public.is_approved());

-- Only admins can modify the allowlist (also manageable via Supabase dashboard)
create policy "Admins can insert approved_users"
  on public.approved_users for insert
  with check (public.is_admin());

create policy "Admins can delete approved_users"
  on public.approved_users for delete
  using (public.is_admin());


-- ── coffee_shops policies ──────────────────────────────────────────────────────
create policy "Approved users can read coffee shops"
  on public.coffee_shops for select
  using (public.is_approved());

create policy "Approved users can insert coffee shops"
  on public.coffee_shops for insert
  with check (public.is_approved());

create policy "Approved users can update coffee shops"
  on public.coffee_shops for update
  using (public.is_approved());


-- ── reviews policies ──────────────────────────────────────────────────────────
create policy "Approved users can read all reviews"
  on public.reviews for select
  using (public.is_approved());

create policy "Approved users can insert their own reviews"
  on public.reviews for insert
  with check (public.is_approved() and user_id = auth.uid());

create policy "Users can update their own reviews"
  on public.reviews for update
  using (user_id = auth.uid() or public.is_admin());

create policy "Users can delete their own reviews"
  on public.reviews for delete
  using (user_id = auth.uid() or public.is_admin());


-- ── Grant view access ─────────────────────────────────────────────────────────
-- The view itself inherits the reviews + profiles RLS, but we need SELECT grant.
grant select on public.reviews_with_profiles to authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- DONE
-- ═══════════════════════════════════════════════════════════════════════════
