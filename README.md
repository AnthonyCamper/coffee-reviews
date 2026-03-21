# {{GIRLS_NAME}} Coffee Ratings

A private, mobile-first web app for rating coffee shops — built with Vite + React, Supabase, and Leaflet.

---

## Quick start

### 1. Clone and install

```bash
git clone <your-gitlab-repo-url>
cd talias-coffee
npm install
```

### 2. Create a Supabase project

1. Go to [supabase.com](https://supabase.com) → New project.
2. Copy your **Project URL** and **anon/public key** from:
   Settings → API → Project URL / Project API keys

### 3. Configure environment variables

```bash
cp .env.example .env.local
```

Edit `.env.local`:

```env
VITE_SUPABASE_URL=https://your-project-ref.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-here
```

### 4. Set up the database

1. Open your Supabase project → SQL Editor → New query.
2. Copy and paste the contents of `supabase/migrations/001_initial_schema.sql`.
3. Run it.

### 5. Add approved users

In the Supabase SQL Editor, add Talia's (and other approved users') Google email addresses:

```sql
insert into public.approved_users (email, is_admin) values
  ('talia@gmail.com', true),
  ('friend@gmail.com', false);
```

`is_admin = true` → can edit/delete any review.
`is_admin = false` → can only edit/delete their own reviews.

### 6. Enable Google OAuth

1. Supabase dashboard → Authentication → Providers → Google → Enable.
2. Create a Google OAuth app at [console.cloud.google.com](https://console.cloud.google.com):
   - Authorized redirect URIs:
     - **Local**: `https://your-project-ref.supabase.co/auth/v1/callback`
     - **Production**: same Supabase callback URL (the site redirect is handled separately)
3. Paste the **Client ID** and **Client Secret** into Supabase → Authentication → Google provider.
4. Set the **Redirect URL** in Supabase to your site's origin (e.g. `https://username.gitlab.io`).

### 7. Run locally

```bash
npm run dev
```

Open [http://localhost:5173](http://localhost:5173).

---

## Customising the site name

The placeholder `{{GIRLS_NAME}}` appears in these places:

| File | What to change |
|------|----------------|
| `index.html` | Page `<title>` and meta description |
| `src/pages/Login.tsx` | Heading and footer |
| `src/components/Layout.tsx` | Header brand |
| `supabase/migrations/001_initial_schema.sql` | Comment at the top |
| `README.md` | This file |

**Find and replace** `{{GIRLS_NAME}}` across the whole repo with the real name — for example: `Talia's`.

---

## Deploying to GitLab Pages

### 1. Push to GitLab

```bash
git remote add origin https://gitlab.com/your-username/talias-coffee.git
git push -u origin main
```

### 2. Set CI/CD variables

GitLab project → Settings → CI/CD → Variables → Add:

| Variable | Value | Protected | Masked |
|----------|-------|-----------|--------|
| `VITE_SUPABASE_URL` | `https://xxx.supabase.co` | ✅ | ❌ |
| `VITE_SUPABASE_ANON_KEY` | `eyJ...` | ✅ | ✅ |

### 3. Update `vite.config.ts` base path (if needed)

If your GitLab Pages URL is `https://username.gitlab.io/talias-coffee/` (project namespace),
update `vite.config.ts`:

```ts
base: '/talias-coffee/',
```

If it's at the root (`https://username.gitlab.io/`), leave `base: '/'`.

### 4. Trigger a pipeline

Push any commit to `main`. The `pages` job deploys automatically.

### 5. Update OAuth redirect URLs

After the first deploy, add your GitLab Pages origin to the allowed redirect URLs in:
- Google Cloud Console → OAuth app → Authorized JavaScript origins
- Supabase → Authentication → URL Configuration → Site URL

---

## Environment variables reference

| Variable | Required | Description |
|----------|----------|-------------|
| `VITE_SUPABASE_URL` | ✅ | Your Supabase project URL |
| `VITE_SUPABASE_ANON_KEY` | ✅ | Supabase public anon key (safe to expose) |

All `VITE_*` variables are baked into the static bundle at build time.
Never put secret/service role keys here.

---

## Project structure

```
talias-coffee/
├── .env.example              ← Copy to .env.local, fill in values
├── .gitlab-ci.yml            ← GitLab Pages deployment pipeline
├── index.html                ← App shell (contains {{GIRLS_NAME}})
├── vite.config.ts
├── tailwind.config.ts
├── supabase/
│   └── migrations/
│       └── 001_initial_schema.sql  ← Full DB schema + RLS policies
└── src/
    ├── main.tsx
    ├── App.tsx               ← Auth-gated routing
    ├── index.css             ← Tailwind + global styles
    ├── lib/
    │   ├── supabase.ts       ← Supabase client
    │   └── types.ts          ← Shared TypeScript types
    ├── hooks/
    │   ├── useAuth.ts        ← Auth state + approval check
    │   └── useReviews.ts     ← CRUD for shops + reviews
    ├── components/
    │   ├── Layout.tsx        ← Header + FAB wrapper
    │   ├── ListView.tsx      ← Scrollable shop cards
    │   ├── MapView.tsx       ← Leaflet map with pins
    │   ├── ReviewCard.tsx    ← Single review row
    │   ├── ReviewFormModal.tsx ← Add review (2-step)
    │   ├── ReviewEditModal.tsx ← Edit existing review
    │   └── ui/
    │       ├── StarRating.tsx
    │       └── Modal.tsx
    └── pages/
        ├── Login.tsx         ← Landing / sign-in
        ├── Home.tsx          ← Main app (list + map)
        └── Unauthorized.tsx  ← Not-on-allowlist screen
```

---

## Data model

```
profiles          ← mirrors auth.users (auto-populated by trigger)
approved_users    ← email allowlist with is_admin flag
coffee_shops      ← one row per shop (name + address unique)
reviews           ← one row per user review; many per shop
reviews_with_profiles  ← view: reviews joined with profile data
```

Row Level Security is enabled on all tables. Only approved users can read or write data.

---

## Tech stack

| Layer | Choice |
|-------|--------|
| Frontend framework | React 18 + TypeScript |
| Bundler | Vite 5 |
| Styling | Tailwind CSS v3 |
| Map | Leaflet 1.9 + OpenStreetMap tiles |
| Backend / Auth / DB | Supabase |
| Hosting | GitLab Pages |
| Geocoding (add review) | Nominatim (OpenStreetMap, free) |

---

## Maintaining the approved users list

The simplest way is via the Supabase dashboard:
1. Dashboard → Table Editor → `approved_users`
2. Insert row: `email = 'friend@gmail.com'`, `is_admin = false`

Or via SQL:
```sql
-- Add a user
insert into public.approved_users (email, is_admin) values ('friend@gmail.com', false);

-- Remove a user
delete from public.approved_users where email = 'friend@gmail.com';

-- Promote to admin
update public.approved_users set is_admin = true where email = 'friend@gmail.com';
```
