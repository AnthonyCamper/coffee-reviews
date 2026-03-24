-- ============================================================================
-- 012 — Emoji reactions upgrade: any emoji + review-level reactions
-- ============================================================================

-- ── 1. Remove 4-emoji CHECK constraint from comment_reactions ─────────────
-- The constraint limits reaction_type to only 4 emojis. Drop it to allow any.

ALTER TABLE public.comment_reactions
  DROP CONSTRAINT IF EXISTS comment_reactions_reaction_type_check;

-- Add a lighter constraint: non-empty, max 32 chars (handles compound emojis)
ALTER TABLE public.comment_reactions
  ADD CONSTRAINT comment_reactions_reaction_type_check
  CHECK (length(reaction_type) >= 1 AND length(reaction_type) <= 32);

-- ── 2. Same for review_comment_reactions ──────────────────────────────────

ALTER TABLE public.review_comment_reactions
  DROP CONSTRAINT IF EXISTS review_comment_reactions_reaction_type_check;

ALTER TABLE public.review_comment_reactions
  ADD CONSTRAINT review_comment_reactions_reaction_type_check
  CHECK (length(reaction_type) >= 1 AND length(reaction_type) <= 32);

-- ── 3. Review-level reactions table ───────────────────────────────────────
-- Allow users to react to reviews themselves (not just comments).

CREATE TABLE IF NOT EXISTS public.review_reactions (
  id            uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  review_id     uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  user_id       uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  reaction_type text NOT NULL CHECK (length(reaction_type) >= 1 AND length(reaction_type) <= 32),
  created_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (review_id, user_id, reaction_type)
);

CREATE INDEX idx_review_reactions_review ON public.review_reactions (review_id);
ALTER TABLE public.review_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Approved users can read review reactions"
  ON public.review_reactions FOR SELECT USING (public.is_approved());
CREATE POLICY "Approved users can insert own review reactions"
  ON public.review_reactions FOR INSERT WITH CHECK (public.is_approved() AND user_id = auth.uid());
CREATE POLICY "Users can delete own review reactions"
  ON public.review_reactions FOR DELETE USING (user_id = auth.uid());

GRANT SELECT, INSERT, DELETE ON public.review_reactions TO authenticated;
