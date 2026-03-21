-- ═══════════════════════════════════════════════════════════════════════════
-- 002_photos.sql — Review Photos & Storage
-- ═══════════════════════════════════════════════════════════════════════════

-- ── Storage bucket ───────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('review-photos', 'review-photos', true)
on conflict (id) do nothing;

-- Storage RLS policies
create policy "Approved users can upload review photos"
  on storage.objects for insert
  with check (
    bucket_id = 'review-photos'
    and public.is_approved()
  );

create policy "Anyone can read review photos"
  on storage.objects for select
  using (bucket_id = 'review-photos');

create policy "Users can delete their own review photos"
  on storage.objects for delete
  using (
    bucket_id = 'review-photos'
    and (
      (storage.foldername(name))[1] = auth.uid()::text
      or public.is_admin()
    )
  );


-- ── Review Photos table ──────────────────────────────────────────────────────
create table if not exists public.review_photos (
  id             uuid primary key default uuid_generate_v4(),
  review_id      uuid not null references public.reviews(id) on delete cascade,
  storage_path   text not null,
  url            text not null,
  display_order  smallint not null default 0,
  created_at     timestamptz not null default now()
);

create index on public.review_photos (review_id);

comment on table public.review_photos is
  'Photos attached to reviews. Stored in Supabase Storage bucket review-photos.';

-- RLS
alter table public.review_photos enable row level security;

create policy "Approved users can read review photos"
  on public.review_photos for select
  using (public.is_approved());

create policy "Approved users can insert review photos"
  on public.review_photos for insert
  with check (
    public.is_approved()
    and exists (
      select 1 from public.reviews r
      where r.id = review_id
        and (r.user_id = auth.uid() or public.is_admin())
    )
  );

create policy "Users can delete their own review photos"
  on public.review_photos for delete
  using (
    exists (
      select 1 from public.reviews r
      where r.id = review_id
        and (r.user_id = auth.uid() or public.is_admin())
    )
  );

grant select, insert, delete on public.review_photos to authenticated;
