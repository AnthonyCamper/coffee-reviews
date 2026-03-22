-- ═══════════════════════════════════════════════════════════════════════════
-- 005_ten_star_ratings.sql — Upgrade ratings from 1–5 to 1–10
--
-- Strategy:
--   1. Drop old 1–5 CHECK constraints
--   2. Double all existing ratings so legacy reviews keep their relative quality
--      (e.g. 5/5 → 10/10,  4/5 → 8/10,  3/5 → 6/10)
--   3. Add new 1–10 CHECK constraints
-- ═══════════════════════════════════════════════════════════════════════════

-- Step 1 — drop old constraints
alter table public.reviews
  drop constraint if exists reviews_coffee_rating_check,
  drop constraint if exists reviews_vibe_rating_check;

-- Step 2 — migrate existing data (multiply by 2 to preserve relative quality)
update public.reviews
set
  coffee_rating = coffee_rating * 2,
  vibe_rating   = vibe_rating   * 2;

-- Step 3 — add new constraints
alter table public.reviews
  add constraint reviews_coffee_rating_check check (coffee_rating between 1 and 10),
  add constraint reviews_vibe_rating_check   check (vibe_rating   between 1 and 10);

-- Update column comments
comment on column public.reviews.coffee_rating is '1 (poor) to 10 (exceptional) — quality of coffee';
comment on column public.reviews.vibe_rating   is '1 (poor) to 10 (exceptional) — atmosphere/vibe';
