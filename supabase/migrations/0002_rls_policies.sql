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
    EXECUTE format(
      'CREATE POLICY "Users manage own %I" ON %I FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);',
      utbl, utbl
    );
  END LOOP;
END $$;
