-- Allow review notes up to 5 000 characters (was limited to 280 by the frontend).
-- The column is already `text`; this adds a DB-level guard so the API can't store
-- unbounded payloads.  Existing reviews are all ≤ 280 chars so the constraint is
-- safe to add retroactively.

alter table public.reviews
  add constraint reviews_note_length
    check (note is null or length(note) <= 5000);
