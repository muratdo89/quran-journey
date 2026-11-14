-- ============================================================================
-- Quran Journey — Tek Adımlı Tam Supabase Kurulum Dosyası (0001 + 0002 + 0003)
-- Supabase SQL Editor içinde tek seferde yapıştırıp Run tuşuna basabilirsiniz.
-- Tekrar çalıştırıldığında hata vermez (idempotent).
-- ============================================================================

-- Quran Journey — Initial PostgreSQL Schema (Supabase-ready)
-- Separates immutable canonical Quran content from private user learning state.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- ============================================================================
-- 1. CANONICAL QURAN CONTENT TABLES (Public Read-Only)
-- ============================================================================

CREATE TABLE IF NOT EXISTS quran_editions (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  script_type TEXT NOT NULL CHECK (script_type IN ('uthmani', 'imlaei', 'indopak')),
  total_pages INTEGER NOT NULL CHECK (total_pages > 0),
  source_provider TEXT NOT NULL,
  source_version TEXT NOT NULL,
  license TEXT NOT NULL,
  checksum_sha256 TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS surahs (
  id INTEGER PRIMARY KEY CHECK (id BETWEEN 1 AND 114),
  name_arabic TEXT NOT NULL,
  name_simple TEXT NOT NULL,
  name_turkish TEXT NOT NULL,
  revelation_place TEXT NOT NULL CHECK (revelation_place IN ('makkah', 'madinah')),
  revelation_order INTEGER NOT NULL,
  verses_count INTEGER NOT NULL CHECK (verses_count > 0),
  bismillah_pre BOOLEAN NOT NULL DEFAULT TRUE
);

CREATE TABLE IF NOT EXISTS mushaf_pages (
  id BIGSERIAL PRIMARY KEY,
  edition_id BIGINT NOT NULL REFERENCES quran_editions(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 604),
  juz_number INTEGER NOT NULL CHECK (juz_number BETWEEN 1 AND 30),
  hizb_number INTEGER NOT NULL CHECK (hizb_number BETWEEN 1 AND 60),
  lines_count INTEGER NOT NULL DEFAULT 15,
  UNIQUE (edition_id, page_number)
);

CREATE TABLE IF NOT EXISTS ayahs (
  id BIGSERIAL PRIMARY KEY,
  surah_id INTEGER NOT NULL REFERENCES surahs(id) ON DELETE CASCADE,
  verse_number INTEGER NOT NULL CHECK (verse_number > 0),
  verse_key TEXT NOT NULL UNIQUE,
  text_uthmani TEXT NOT NULL,
  text_imlaei TEXT NOT NULL,
  text_uthmani_sha256 TEXT NOT NULL,
  juz_number INTEGER NOT NULL,
  hizb_number INTEGER NOT NULL,
  rub_el_hizb_number INTEGER NOT NULL,
  sajdah_number INTEGER,
  UNIQUE (surah_id, verse_number)
);

CREATE TABLE IF NOT EXISTS page_ayah_mappings (
  id BIGSERIAL PRIMARY KEY,
  edition_id BIGINT NOT NULL REFERENCES quran_editions(id) ON DELETE CASCADE,
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 604),
  ayah_id BIGINT NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  start_line INTEGER NOT NULL,
  end_line INTEGER NOT NULL,
  UNIQUE (edition_id, page_number, ayah_id)
);

CREATE TABLE IF NOT EXISTS words (
  id BIGINT PRIMARY KEY,
  ayah_id BIGINT NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  position INTEGER NOT NULL CHECK (position > 0),
  location TEXT NOT NULL UNIQUE,
  char_type TEXT NOT NULL DEFAULT 'word',
  text_uthmani TEXT NOT NULL,
  text_imlaei TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  line_number INTEGER NOT NULL,
  wbw_audio_path TEXT,
  UNIQUE (ayah_id, position)
);

CREATE TABLE IF NOT EXISTS word_translations (
  id BIGSERIAL PRIMARY KEY,
  word_id BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  language_code TEXT NOT NULL DEFAULT 'tr',
  translation_text TEXT NOT NULL,
  transliteration TEXT,
  source_id TEXT NOT NULL,
  UNIQUE (word_id, language_code, source_id)
);

CREATE TABLE IF NOT EXISTS verse_translations (
  id BIGSERIAL PRIMARY KEY,
  ayah_id BIGINT NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  resource_id INTEGER NOT NULL,
  translator_name TEXT NOT NULL,
  language_code TEXT NOT NULL DEFAULT 'tr',
  text TEXT NOT NULL,
  source_attribution TEXT NOT NULL,
  UNIQUE (ayah_id, resource_id)
);

CREATE TABLE IF NOT EXISTS word_morphology (
  id BIGSERIAL PRIMARY KEY,
  word_id BIGINT NOT NULL REFERENCES words(id) ON DELETE CASCADE,
  segment_index INTEGER NOT NULL CHECK (segment_index > 0),
  segment_text TEXT NOT NULL,
  part_of_speech TEXT NOT NULL,
  root_arabic TEXT,
  lemma_arabic TEXT,
  features_json JSONB NOT NULL DEFAULT '[]'::jsonb,
  source_id TEXT NOT NULL,
  UNIQUE (word_id, segment_index, source_id)
);

CREATE TABLE IF NOT EXISTS reciters (
  id BIGSERIAL PRIMARY KEY,
  external_id INTEGER NOT NULL UNIQUE,
  name TEXT NOT NULL,
  style TEXT,
  language_code TEXT NOT NULL DEFAULT 'ar',
  base_audio_url TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS audio_resources (
  id BIGSERIAL PRIMARY KEY,
  reciter_id BIGINT NOT NULL REFERENCES reciters(id) ON DELETE CASCADE,
  ayah_id BIGINT NOT NULL REFERENCES ayahs(id) ON DELETE CASCADE,
  audio_url TEXT NOT NULL,
  duration_ms INTEGER,
  word_segments_json JSONB,
  UNIQUE (reciter_id, ayah_id)
);

CREATE TABLE IF NOT EXISTS tajweed_rules (
  id BIGSERIAL PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  name_turkish TEXT NOT NULL,
  name_arabic TEXT NOT NULL,
  category TEXT NOT NULL,
  difficulty_level INTEGER NOT NULL CHECK (difficulty_level BETWEEN 1 AND 5),
  description_turkish TEXT NOT NULL,
  examples_json JSONB NOT NULL DEFAULT '[]'::jsonb
);

-- ============================================================================
-- 2. USER PROFILES & PREFERENCES
-- ============================================================================

CREATE TABLE IF NOT EXISTS profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  display_name TEXT NOT NULL DEFAULT 'Öğrenci',
  native_language TEXT NOT NULL DEFAULT 'tr',
  placement_completed BOOLEAN NOT NULL DEFAULT FALSE,
  placement_level TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS user_preferences (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  arabic_font_size INTEGER NOT NULL DEFAULT 32 CHECK (arabic_font_size BETWEEN 20 AND 56),
  arabic_line_height NUMERIC(3,2) NOT NULL DEFAULT 2.10,
  theme_mode TEXT NOT NULL DEFAULT 'light' CHECK (theme_mode IN ('light', 'dark')),
  show_translation_default BOOLEAN NOT NULL DEFAULT TRUE,
  show_transliteration BOOLEAN NOT NULL DEFAULT FALSE,
  preferred_reciter_id INTEGER NOT NULL DEFAULT 7,
  preferred_translation_id INTEGER NOT NULL DEFAULT 77,
  playback_speed NUMERIC(3,2) NOT NULL DEFAULT 1.00,
  cloud_ai_audio_consent BOOLEAN NOT NULL DEFAULT FALSE,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS learning_goals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  daily_target_minutes INTEGER NOT NULL DEFAULT 20 CHECK (daily_target_minutes BETWEEN 3 AND 120),
  session_mode TEXT NOT NULL DEFAULT 'normal' CHECK (session_mode IN ('normal', 'intensive', 'recovery')),
  new_words_per_day INTEGER NOT NULL DEFAULT 5,
  new_verses_per_day INTEGER NOT NULL DEFAULT 2,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 3. LEARNING STATE, FSRS & HABITS
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_word_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  word_location TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'new' CHECK (status IN ('new', 'learning', 'known', 'difficult')),
  times_seen INTEGER NOT NULL DEFAULT 0,
  times_correct INTEGER NOT NULL DEFAULT 0,
  times_missed INTEGER NOT NULL DEFAULT 0,
  last_reviewed_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, word_location)
);

CREATE TABLE IF NOT EXISTS user_verse_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_key TEXT NOT NULL,
  memorization_state TEXT NOT NULL DEFAULT 'not_started' CHECK (
    memorization_state IN (
      'not_started',
      'learning',
      'practicing',
      'provisional_mastery',
      'stable_memorization',
      'needs_revision'
    )
  ),
  comprehension_score INTEGER NOT NULL DEFAULT 0 CHECK (comprehension_score BETWEEN 0 AND 100),
  pronunciation_confidence INTEGER NOT NULL DEFAULT 0 CHECK (pronunciation_confidence BETWEEN 0 AND 100),
  last_practiced_at TIMESTAMPTZ,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, verse_key)
);

CREATE TABLE IF NOT EXISTS user_page_progress (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  edition_slug TEXT NOT NULL DEFAULT 'madinah-1405-uthmani',
  page_number INTEGER NOT NULL CHECK (page_number BETWEEN 1 AND 604),
  status TEXT NOT NULL DEFAULT 'not_started' CHECK (status IN ('not_started', 'in_progress', 'completed', 'needs_revision')),
  studied_verses_count INTEGER NOT NULL DEFAULT 0,
  memorized_verses_count INTEGER NOT NULL DEFAULT 0,
  last_studied_at TIMESTAMPTZ,
  UNIQUE (user_id, edition_slug, page_number)
);

CREATE TABLE IF NOT EXISTS learning_cards (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_type TEXT NOT NULL CHECK (card_type IN ('vocabulary', 'verse', 'reading_concept', 'tajweed')),
  target_key TEXT NOT NULL,
  direction TEXT NOT NULL DEFAULT 'ar_to_tr' CHECK (direction IN ('ar_to_tr', 'tr_to_ar', 'recall', 'recognition')),
  fsrs_state INTEGER NOT NULL DEFAULT 0,
  due_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  stability DOUBLE PRECISION NOT NULL DEFAULT 0,
  difficulty DOUBLE PRECISION NOT NULL DEFAULT 0,
  elapsed_days INTEGER NOT NULL DEFAULT 0,
  scheduled_days INTEGER NOT NULL DEFAULT 0,
  reps INTEGER NOT NULL DEFAULT 0,
  lapses INTEGER NOT NULL DEFAULT 0,
  learning_steps INTEGER NOT NULL DEFAULT 0,
  last_review_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, card_type, target_key, direction)
);

CREATE TABLE IF NOT EXISTS review_history (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  card_id UUID NOT NULL REFERENCES learning_cards(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating BETWEEN 1 AND 4),
  response_time_ms INTEGER,
  was_correct BOOLEAN NOT NULL,
  previous_state INTEGER NOT NULL,
  next_state INTEGER NOT NULL,
  reviewed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS assessment_attempts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  assessment_type TEXT NOT NULL,
  target_key TEXT NOT NULL,
  score INTEGER NOT NULL,
  max_score INTEGER NOT NULL,
  details_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS study_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  session_mode TEXT NOT NULL CHECK (session_mode IN ('normal', 'intensive', 'recovery')),
  started_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ended_at TIMESTAMPTZ,
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  reviews_completed INTEGER NOT NULL DEFAULT 0,
  new_items_studied INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  is_recovery_session BOOLEAN NOT NULL DEFAULT FALSE
);

CREATE TABLE IF NOT EXISTS bookmarks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_key TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  label TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, verse_key)
);

CREATE TABLE IF NOT EXISTS user_notes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_key TEXT NOT NULL,
  page_number INTEGER NOT NULL,
  note_text TEXT NOT NULL,
  is_difficult BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, verse_key)
);

CREATE TABLE IF NOT EXISTS achievement_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  badge_code TEXT NOT NULL,
  title_turkish TEXT NOT NULL,
  earned_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  metadata_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  UNIQUE (user_id, badge_code)
);

CREATE TABLE IF NOT EXISTS streak_records (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  activity_date DATE NOT NULL,
  minutes_studied INTEGER NOT NULL DEFAULT 0,
  reviews_completed INTEGER NOT NULL DEFAULT 0,
  xp_earned INTEGER NOT NULL DEFAULT 0,
  UNIQUE (user_id, activity_date)
);

-- ============================================================================
-- 4. AUDIO RECORDINGS & EXTENSIBLE ASSESSMENTS (PRIVATE)
-- ============================================================================

CREATE TABLE IF NOT EXISTS user_recordings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  verse_key TEXT NOT NULL,
  storage_type TEXT NOT NULL CHECK (storage_type IN ('local_indexeddb', 'supabase_storage')),
  storage_path TEXT,
  duration_ms INTEGER NOT NULL CHECK (duration_ms > 0),
  consent_granted BOOLEAN NOT NULL DEFAULT FALSE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS audio_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  recording_id UUID NOT NULL REFERENCES user_recordings(id) ON DELETE CASCADE,
  provider_name TEXT NOT NULL,
  assessment_scope TEXT NOT NULL CHECK (assessment_scope IN ('sequence_check', 'pronunciation', 'tajweed')),
  confidence_score NUMERIC(4,3) CHECK (confidence_score BETWEEN 0 AND 1),
  status TEXT NOT NULL CHECK (status IN ('pending', 'completed', 'unavailable', 'error')),
  feedback_json JSONB NOT NULL DEFAULT '{}'::jsonb,
  requires_human_review BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================================
-- 5. INDEXES FOR PERFORMANCE
-- ============================================================================

CREATE INDEX IF NOT EXISTS idx_words_ayah_id ON words(ayah_id);
CREATE INDEX IF NOT EXISTS idx_page_ayah_page ON page_ayah_mappings(edition_id, page_number);
CREATE INDEX IF NOT EXISTS idx_learning_cards_user_due ON learning_cards(user_id, due_at);
CREATE INDEX IF NOT EXISTS idx_review_history_user_time ON review_history(user_id, reviewed_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_word_progress_user ON user_word_progress(user_id, status);
CREATE INDEX IF NOT EXISTS idx_user_verse_progress_user ON user_verse_progress(user_id, memorization_state);
CREATE INDEX IF NOT EXISTS idx_user_recordings_user_verse ON user_recordings(user_id, verse_key);

-- Quran Journey — Row Level Security Policies
-- Canonical tables are readable by authenticated/anon users and immutable except via service_role.
-- Personal learning data and audio recordings are strictly isolated to auth.uid() = user_id.

-- Enable RLS on canonical tables
ALTER TABLE quran_editions ENABLE ROW LEVEL SECURITY;
ALTER TABLE surahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE mushaf_pages ENABLE ROW LEVEL SECURITY;
ALTER TABLE ayahs ENABLE ROW LEVEL SECURITY;
ALTER TABLE page_ayah_mappings ENABLE ROW LEVEL SECURITY;
ALTER TABLE words ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE verse_translations ENABLE ROW LEVEL SECURITY;
ALTER TABLE word_morphology ENABLE ROW LEVEL SECURITY;
ALTER TABLE reciters ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_resources ENABLE ROW LEVEL SECURITY;
ALTER TABLE tajweed_rules ENABLE ROW LEVEL SECURITY;

DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY[
    'quran_editions', 'surahs', 'mushaf_pages', 'ayahs', 'page_ayah_mappings',
    'words', 'word_translations', 'verse_translations', 'word_morphology',
    'reciters', 'audio_resources', 'tajweed_rules'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Canonical read %I" ON %I;', tbl, tbl);
    EXECUTE format('CREATE POLICY "Canonical read %I" ON %I FOR SELECT USING (true);', tbl, tbl);
  END LOOP;
END $$;

-- Enable RLS on user tables
ALTER TABLE profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_preferences ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_goals ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_word_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_verse_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_page_progress ENABLE ROW LEVEL SECURITY;
ALTER TABLE learning_cards ENABLE ROW LEVEL SECURITY;
ALTER TABLE review_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE assessment_attempts ENABLE ROW LEVEL SECURITY;
ALTER TABLE study_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE bookmarks ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievement_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE streak_records ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_recordings ENABLE ROW LEVEL SECURITY;
ALTER TABLE audio_assessments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users manage own profile" ON profiles;
CREATE POLICY "Users manage own profile" ON profiles
  FOR ALL USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

DO $$
DECLARE
  utbl TEXT;
BEGIN
  FOREACH utbl IN ARRAY ARRAY[
    'user_preferences', 'learning_goals', 'user_word_progress', 'user_verse_progress',
    'user_page_progress', 'learning_cards', 'review_history', 'assessment_attempts',
    'study_sessions', 'bookmarks', 'user_notes', 'achievement_records',
    'streak_records', 'user_recordings', 'audio_assessments'
  ]
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS "Users manage own %I" ON %I;', utbl, utbl);
    EXECUTE format(
      'CREATE POLICY "Users manage own %I" ON %I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
      utbl, utbl
    );
  END LOOP;
END $$;

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

DROP POLICY IF EXISTS "Users manage own user_curriculum_progress" ON user_curriculum_progress;
CREATE POLICY "Users manage own user_curriculum_progress" ON user_curriculum_progress
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
