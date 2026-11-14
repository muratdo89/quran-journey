# Quran Journey — Testing & Acceptance Criteria

## 1. Testing Layers

1. **Canonical Content Integrity Tests (`tests/content-integrity.test.ts` & `scripts/verify-content.mjs`)**
   - Verify SHA-256 checksums of imported Arabic Uthmani verses and full dataset manifests (`surah-1-fatiha.json`, `quran-meta.json`, `lexicon-index.json.gz`, and all 114 compressed `surah-XXX.json.gz` files).
   - Verify exact Surah counts (114 Surahs), Madinah Mushaf page mappings (604 pages: `1..604`), Ayah counts (6,236 verses), and sequential word positions (77,429 words, permitting only known `36:52:7` upstream Saktah audio null).
   - Verify full-Quran Arabic/Turkish search, 1,651 Arabic root frequency entries, Mutashabihat matches, and paginated `getWordsPage` resolution.
2. **Arabic Literacy & Tajweed Curriculum Tests (`tests/arabic-curriculum.test.ts`)**
   - Verify all 28 Arabic letters (`ELIFBA_LETTERS`) with 4 positional forms, sound classifications, and matching canonical word locations/audio URLs.
   - Verify all 8 progressive Arabic reading modules and 8 Tajweed lessons reference valid canonical verses, words, and audio files.
3. **Learning Engine Unit Tests (`tests/learning-engine.test.ts`)**
   - Verify `ts-fsrs` scheduling transitions across `Again (1)`, `Hard (2)`, `Good (3)`, `Easy (4)`.
   - Verify failed recall resets stability/increases lapses and schedules immediate re-learning without punitive XP loss.
   - Verify 5-pillar independence: high Arabic reading score must not inflate Vocabulary or Memorization scores.
   - Verify overdue review prioritization and `recovery` (3–5 min) session capping.
   - Verify verse mastery state machine (`not_started` → `learning` → `practicing` → `provisional_mastery` → `stable_memorization` / `needs_revision`).
4. **ASR Sequence Alignment & Longitudinal Analytics Tests (`tests/asr-alignment.test.ts`)**
   - Verify Arabic diacritic/dagger-alef normalization and DP Levenshtein alignment (`alignAsrTranscript`) for exact matches, missing words, and substitutions.
   - Verify `ConfigurableHttpAsrProvider` blocks external uploads when `consentGranted` is false, handles missing configuration cleanly, and always marks `requiresHumanReview: true`.
   - Verify `buildErrorPatternInsights` and `buildJuzProgressGrid` (30 Juz across all 604 pages).
5. **Database & API Integration Tests (`tests/repository.test.ts`)**
   - Verify async SQLite repository CRUD, foreign key constraints, FSRS card persistence, bookmark/note toggles, bulk Surah vocabulary card creation (`ensureSurahVocabularyCards` including Surah 2 / Al-Baqarah), and Mushaf page progress (`markPageStudied`) across temp DB reloads.
6. **TypeScript, Lint, Tracing & Production Build Verification**
   - `npx tsc --noEmit` (strict TypeScript check).
   - `pnpm lint` and `pnpm build` (including `.nft.json` inspection confirming compressed canonical data files are traced).
7. **Live Server / End-to-End Smoke Verification**
   - Verify live Next.js server rendering across all routes (`/`, `/learn-arabic`, `/mushaf`, `/mushaf?page=2`, `/mushaf?page=604`, `/vocabulary`, `/vocabulary?tab=roots`, `/memorization?surah=2`, `/review`, `/statistics`, `/settings`, `/sw.js`) and API routes (`/api/state`, `/api/search`, `/api/vocabulary`, `/api/mushaf/offline`).

---

## 2. Acceptance Criteria

### Phase 1 & 2A (Foundation + Juz Amma + Cloud Sync)
- [x] Responsive Turkish-first UI, 28-letter Elif-Bâ matrix, 8 reading modules, 8 Tajweed lessons, FSRS scheduling, 5-pillar independence, Supabase Auth + RLS + `/tmp` SQLite fallback.

### Phase 2B–5 (Full 604-Page Quran, Lexicon, ASR Alignment & PWA Polish)
- [x] Lazy-loaded canonical corpus covers all 114 Surahs, 604 Madinah Mushaf pages, 6,236 verses, and 77,429 words with zero bundled bloat in RSC payloads.
- [x] Full-Quran normalized Arabic & Turkish search (`/api/search`), 1,651-root family explorer (`/api/vocabulary`), and Mutashabihat alerts across Mushaf and Memorization studios.
- [x] Consent-gated `ConfigurableHttpAsrProvider` + DP alignment + persistent browser IndexedDB audio storage without claiming Tajweed mastery.
- [x] 30-Juz / 604-page coverage matrix, longitudinal error-pattern analytics, PWA Service Worker offline page/audio caching, and single-paste `supabase/setup_all.sql`.

