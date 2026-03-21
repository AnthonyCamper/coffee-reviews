-- ═══════════════════════════════════════════════════════════════════════════
-- Talia's Coffee — Full Data Backup
-- Captured:  2026-03-21
-- Project:   xzltcpzbdxqcaxcadbni (talias-coffee)
--
-- HOW TO RESTORE
-- ──────────────
-- 1. Ensure the schema migrations have been applied first:
--      001_initial_schema.sql
--      002_photos.sql
--      003_social.sql
-- 2. Run this file in the Supabase SQL editor or via psql:
--      psql $DATABASE_URL -f backup_2026-03-21.sql
-- 3. All inserts use ON CONFLICT DO NOTHING so it is safe to run on a
--    database that already has some of this data.
--
-- NOTE: Storage objects (uploaded photos) live in Supabase Storage and are
-- NOT included here. The review_photos rows below reference URLs that will
-- continue to resolve as long as the storage bucket is intact.
-- ═══════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── 1. profiles ──────────────────────────────────────────────────────────────
-- Normally auto-populated by the handle_new_user trigger on auth.users.
-- Included here so foreign-key references from reviews/photos resolve.

INSERT INTO public.profiles (id, email, full_name, avatar_url, created_at) VALUES ('be35bed3-a6f7-48ab-92c0-ada647019a37','anthonycap949@gmail.com','Anthony C','https://lh3.googleusercontent.com/a/ACg8ocJ2Sz9hDKT1YRxn96m4HgDg3KaKtvfVvd0RHDfmZmf1bAzfTA=s96-c','2026-03-21 13:26:00.152486+00') ON CONFLICT (id) DO NOTHING;


-- ── 2. approved_users ────────────────────────────────────────────────────────
-- Access control allowlist. Restore this first so the app lets users in.

INSERT INTO public.approved_users (email, is_admin, added_at) VALUES ('anthonycap949@gmail.com',true,'2026-03-21 13:26:31.847177+00') ON CONFLICT (email) DO NOTHING;


-- ── 3. coffee_shops ──────────────────────────────────────────────────────────

INSERT INTO public.coffee_shops (id, name, address, lat, lng, created_at) VALUES ('5ff44adf-1382-4481-8893-34d0f64d4a36','Lost Sock','6833 4th St NW, Washington, DC 20012',38.97341,-77.017828,'2026-03-21 13:27:24.213173+00') ON CONFLICT DO NOTHING;
INSERT INTO public.coffee_shops (id, name, address, lat, lng, created_at) VALUES ('6992f24e-eaff-4a8e-958f-d3c8d7c5b521','Maman','2000 Pennsylvania Avenue Northwest, Downtown, Washington, District of Columbia, 20006',38.900252,-77.045155,'2026-03-21 13:45:31.90684+00') ON CONFLICT DO NOTHING;
INSERT INTO public.coffee_shops (id, name, address, lat, lng, created_at) VALUES ('1132ee85-67db-40d2-a871-2ad465c8357b','Blue Bottle Coffee','1046 Potomac Street Northwest, Georgetown, Washington, District of Columbia, 20007',38.904382,-77.065399,'2026-03-21 13:48:30.79221+00') ON CONFLICT DO NOTHING;
INSERT INTO public.coffee_shops (id, name, address, lat, lng, created_at) VALUES ('6c57e944-e5b8-4e38-92f0-5fd6e62f0504','Sakuramen','2441 18th Street Northwest, Adams Morgan, Washington, District of Columbia, 20009',38.921556,-77.042024,'2026-03-21 14:31:46.131987+00') ON CONFLICT DO NOTHING;


-- ── 4. reviews ───────────────────────────────────────────────────────────────

INSERT INTO public.reviews (id, coffee_shop_id, user_id, coffee_rating, vibe_rating, note, visited_at, created_at, updated_at) VALUES ('9991cc0e-3879-4120-b96f-f0cb46095dc3','5ff44adf-1382-4481-8893-34d0f64d4a36','be35bed3-a6f7-48ab-92c0-ada647019a37',4,5,NULL,'2026-03-21','2026-03-21 13:28:19.116157+00','2026-03-21 13:28:19.116157+00') ON CONFLICT DO NOTHING;


-- ── 5. review_photos ─────────────────────────────────────────────────────────
-- (empty at time of backup)


-- ── 6. photo_likes ───────────────────────────────────────────────────────────
-- (empty at time of backup)


-- ── 7. photo_comments ────────────────────────────────────────────────────────
-- (empty at time of backup)


-- ── 8. comment_likes ─────────────────────────────────────────────────────────
-- (empty at time of backup)


-- ── 9. comment_reactions ─────────────────────────────────────────────────────
-- (empty at time of backup)


COMMIT;

-- ═══════════════════════════════════════════════════════════════════════════
-- END OF BACKUP
-- ═══════════════════════════════════════════════════════════════════════════
