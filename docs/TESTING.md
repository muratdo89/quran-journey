# Quran Journey — Testing & Acceptance Criteria

## 1. Testing Layers

1. **Canonical Content Integrity Tests (`tests/content-integrity.test.ts` & `scripts/verify-content.mjs`)**
   - Verify SHA-256 checksums of imported Arabic Uthmani verses and full dataset manifests (`surah-1-fatiha.json` and `fatiha-and-juz-amma.json`).
   - Verify exact Surah counts (38 Surahs), Madinah Mushaf page mappings (24 pages: `1` and `582..604`), Ayah counts (571 verses), and sequential word positions (2,337 words).
   - Verify multi-surah page assembly (e.g., Page 604 containing Surahs 112–114) and cross-surah Arabic root lookups.
2. **Arabic Literacy & Tajweed Curriculum Tests (`tests/arabic-curriculum.test.ts`)**
   - Verify all 28 Arabic letters (`ELIFBA_LETTERS`) with 4 positional forms, sound classifications, and matching canonical word locations/audio URLs.
   - Verify all 8 progressive Arabic reading modules and 8 Tajweed lessons reference valid canonical verses, words, and audio files.
3. **Learning Engine Unit Tests (`tests/learning-engine.test.ts`)**
   - Verify `ts-fsrs` scheduling transitions across `Again (1)`, `Hard (2)`, `Good (3)`, `Easy (4)`.
   - Verify failed recall resets stability/increases lapses and schedules immediate re-learning without punitive XP loss.
   - Verify 5-pillar independence: high Arabic reading score must not inflate Vocabulary or Memorization scores.
   - Verify overdue review prioritization and `recovery` (3–5 min) session capping.
   - Verify verse mastery state machine (`not_started` → `learning` → `practicing` → `provisional_mastery` → `stable_memorization` / `needs_revision`).
4. **Database & API Integration Tests (`tests/repository.test.ts`)**
   - Verify async SQLite repository CRUD, foreign key constraints, FSRS card persistence, bookmark/note toggles, bulk Surah vocabulary card creation (`ensureSurahVocabularyCards`), and Mushaf page progress (`markPageStudied`) across temp DB reloads.
5. **TypeScript, Lint & Production Build Verification**
   - `npx tsc --noEmit` (strict TypeScript check).
   - `pnpm lint` and `pnpm build`.
6. **Live Server / End-to-End Smoke Verification**
   - Verify live Next.js server rendering across all 8 routes (`/`, `/learn-arabic`, `/mushaf`, `/mushaf?page=604`, `/vocabulary`, `/memorization?surah=112`, `/review`, `/statistics`, `/settings`) and `/api/state`.

---

## 2. Acceptance Criteria

### Phase 1 (Al-Fatiha Foundation)
- [x] App boots cleanly on Next.js App Router with zero TypeScript errors.
- [x] All 7 verses and 29 words of Surah Al-Fatiha render in verified Uthmani script with intact diacritics (`dir="rtl"`, `translate="no"`).
- [x] Clicking any word shows verified Turkish word meaning, contextual verse meaning, root/morphology, and plays word audio.
- [x] Reference audio plays per-ayah and full-surah with synchronized word highlighting.
- [x] User can practice memorization and persist mastery state transitions.
- [x] User can review due FSRS cards (Arabic ↔ Turkish) and see updated due timestamps persist across reloads.
- [x] User can take the initial Arabic Reading placement diagnostic and receive personalized pillar scores and recommendations.
- [x] User can record their own recitation locally, play it back alongside the reference reciter, and delete the recording.

### Phase 2 (Juz Amma, Full Elif-Bâ & Cloud Sync)
- [x] Canonical dataset covers 38 Surahs (Al-Fatiha + Surahs 78–114), 24 Mushaf pages (`1` and `582–604`), 571 verses, and 2,337 words.
- [x] Multi-page & multi-surah Mushaf browser supports navigating by page or Surah and tracks studied pages.
- [x] Interactive 28-letter Elif-Bâ table, 8 Arabic reading modules, and 8 Tajweed lessons with verified Quranic audio examples.
- [x] Paginated & filterable Vocabulary Studio supports Surah-wide bulk FSRS card generation (`AR→TR` and `TR→AR`).
- [x] Memorization Studio covers all 38 Surahs including random-verse continuation drills.
- [x] `SupabaseProgressRepository` + `/api/auth` cookie endpoints and ephemeral `/tmp` SQLite fallback support zero-laptop cloud deployment on Vercel + Supabase.
