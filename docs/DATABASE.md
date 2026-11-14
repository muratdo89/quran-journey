# Quran Journey — Database Design

## 1. Design Principles

1. **Canonical Content vs. User State Separation:** Canonical tables (`quran_editions`, `surahs`, `ayahs`, `words`, `mushaf_pages`, `page_ayah_mappings`, `word_translations`, `verse_translations`, `word_morphology`, `reciters`, `audio_resources`, `tajweed_rules`) store verified, immutable Quran data once — never duplicated per user.
2. **Multi-User & RLS Ready:** All user-owned tables include `user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE` and PostgreSQL Row Level Security policies (`auth.uid() = user_id`).
3. **Local Parity:** The local SQLite development adapter (`src/lib/db/sqlite-repository.ts`) mirrors the relational user-state schema so development in an unconfigured environment exercises real queries, transactions, foreign keys, and constraints.

---

## 2. Entity-Relationship Overview

### Canonical Content Tables (Public Read-Only, Admin/Seed Write-Only)
- `quran_editions` (`id`, `slug`, `name`, `script_type`, `total_pages`, `source_provider`, `source_version`, `license`, `checksum_sha256`)
- `surahs` (`id` [1..114], `name_arabic`, `name_simple`, `name_turkish`, `revelation_place`, `revelation_order`, `verses_count`, `bismillah_pre`)
- `mushaf_pages` (`edition_id`, `page_number` [1..604], `juz_number`, `hizb_number`, `lines_count`)
- `ayahs` (`id`, `surah_id`, `verse_number`, `verse_key` UNIQUE, `text_uthmani`, `text_imlaei`, `text_uthmani_sha256`, `juz_number`, `hizb_number`, `rub_el_hizb_number`, `sajdah_number`)
- `page_ayah_mappings` (`edition_id`, `page_number`, `ayah_id`, `start_line`, `end_line`)
- `words` (`id`, `ayah_id`, `position`, `location` UNIQUE [`1:1:1`], `char_type`, `text_uthmani`, `text_imlaei`, `page_number`, `line_number`, `wbw_audio_path`)
- `word_translations` (`id`, `word_id`, `language_code`, `translation_text`, `transliteration`, `source_id`)
- `verse_translations` (`id`, `ayah_id`, `resource_id`, `translator_name`, `language_code`, `text`, `source_attribution`)
- `word_morphology` (`id`, `word_id`, `segment_index`, `part_of_speech`, `root_arabic`, `lemma_arabic`, `features_json`, `source_id`)
- `reciters` (`id`, `external_id`, `name`, `style`, `language_code`, `base_audio_url`)
- `audio_resources` (`id`, `reciter_id`, `ayah_id`, `audio_url`, `duration_ms`, `word_segments_json`)
- `tajweed_rules` (`id`, `slug`, `name_turkish`, `name_arabic`, `category`, `difficulty_level`, `description_turkish`, `examples_json`)

### User Profile & Configuration Tables
- `profiles` (`id` UUID PK, `display_name`, `native_language`, `placement_completed`, `placement_level`, `placement_score_percent`, `current_page_number`, `created_at`, `updated_at`)
- `user_preferences` (`user_id` PK, `arabic_font_size`, `arabic_line_height`, `theme_mode`, `show_translation_default`, `show_transliteration`, `preferred_reciter_id`, `preferred_translation_id`, `playback_speed`, `cloud_ai_audio_consent`)
- `learning_goals` (`id`, `user_id`, `daily_target_minutes`, `session_mode`, `new_words_per_day`, `new_verses_per_day`, `updated_at`)

### Learning State & FSRS Tables
- `user_word_progress` (`id`, `user_id`, `word_location`, `status`, `times_seen`, `times_correct`, `times_missed`, `last_reviewed_at`, `updated_at`)
- `user_verse_progress` (`id`, `user_id`, `verse_key`, `memorization_state` CHECK IN (`not_started`,`learning`,`practicing`,`provisional_mastery`,`stable_memorization`,`needs_revision`), `comprehension_score`, `pronunciation_confidence`, `last_practiced_at`, `updated_at`)
- `user_page_progress` (`id`, `user_id`, `edition_slug`, `page_number`, `status`, `studied_verses_count`, `memorized_verses_count`, `last_studied_at`)
- `user_curriculum_progress` (`id`, `user_id`, `item_kind` CHECK IN (`reading_module`, `tajweed_rule`), `item_key`, `completed_at`)
- `learning_cards` (`id`, `user_id`, `card_type` CHECK IN (`vocabulary`,`verse`,`reading_concept`,`tajweed`), `target_key`, `direction`, `fsrs_state`, `due_at`, `stability`, `difficulty`, `elapsed_days`, `scheduled_days`, `reps`, `lapses`, `learning_steps`, `last_review_at`)
- `review_history` (`id`, `user_id`, `card_id`, `rating` [1..4], `response_time_ms`, `was_correct`, `previous_state`, `next_state`, `reviewed_at`)
- `assessment_attempts` (`id`, `user_id`, `assessment_type`, `target_key`, `score`, `max_score`, `details_json`, `completed_at`)
- `study_sessions` (`id`, `user_id`, `session_mode`, `started_at`, `ended_at`, `duration_seconds`, `reviews_completed`, `new_items_studied`, `xp_earned`, `is_recovery_session`)
- `bookmarks` (`id`, `user_id`, `verse_key`, `page_number`, `label`, `created_at`)
- `user_notes` (`id`, `user_id`, `verse_key`, `page_number`, `note_text`, `is_difficult`, `created_at`, `updated_at`)
- `achievement_records` (`id`, `user_id`, `badge_code`, `title_turkish`, `earned_at`, `metadata_json`)
- `streak_records` (`id`, `user_id`, `activity_date`, `minutes_studied`, `reviews_completed`, `xp_earned`, `UNIQUE(user_id, activity_date)`)

### Audio & Assessment Tables (Private by Default)
- `user_recordings` (`id`, `user_id`, `verse_key`, `storage_type` [`local_indexeddb` | `supabase_storage`], `storage_path`, `duration_ms`, `consent_granted`, `created_at`)
- `audio_assessments` (`id`, `user_id`, `recording_id`, `provider_name`, `assessment_scope` [`sequence_check` | `pronunciation` | `tajweed`], `confidence_score`, `status`, `feedback_json`, `requires_human_review`, `created_at`)

---

## 3. Runtime Persistence, Migration & Seed Strategy

- `getRepository()` (`src/lib/db/index.ts`) resolves `SupabaseProgressRepository` whenever Supabase env vars are configured and the user has a valid auth session cookie (refreshed via `qj_sb_refresh_token` if needed), falling back cleanly to `SqliteProgressRepository` (`.data/quran-journey.db`, or `/tmp/quran-journey-data` in read-only serverless environments).
- Migrations live in `supabase/migrations/`:
  - `0001_initial_schema.sql`
  - `0002_rls_policies.sql`
  - `0003_phase2_progress_columns.sql`
- Canonical datasets are verified CLI-side via `scripts/fetch-verified-juz-amma.mjs` and `scripts/verify-content.mjs`, producing checksummed JSON in `src/data/canonical/` and batched SQL in `supabase/seed.sql` via `scripts/generate-supabase-seed.mjs`.
