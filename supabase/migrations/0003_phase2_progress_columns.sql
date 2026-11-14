-- Phase 2 schema additions: placement score, active Mushaf page, and curriculum module tracking

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS placement_score_percent INTEGER CHECK (placement_score_percent BETWEEN 0 AND 100),
  ADD COLUMN IF NOT EXISTS current_page_number INTEGER NOT NULL DEFAULT 1 CHECK (current_page_number BETWEEN 1 AND 604);

CREATE TABLE IF NOT EXISTS user_curriculum_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_kind TEXT NOT NULL CHECK (item_kind IN ('reading_module', 'tajweed_rule')),
  item_key TEXT NOT NULL,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, item_kind, item_key)
);

ALTER TABLE user_curriculum_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own user_curriculum_progress" ON user_curriculum_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
