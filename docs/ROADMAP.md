# Quran Journey — Phased Development Roadmap

## Phase 0 — Research & Architecture (Completed)
- Inspect environment, toolchain, and database capabilities.
- Verify live Quran APIs, Tanzil Uthmani text, Turkish translations, word timing segments, morphology data, and open-licensed Arabic fonts.
- Produce `PRD.md`, `ARCHITECTURE.md`, `DATABASE.md`, `CONTENT_SOURCES.md`, `ROADMAP.md`, `TESTING.md`.

## Phase 1 — Foundation, Design System & First Complete Fatiha Experience (Completed)
- Scaffold Next.js 16 + TypeScript (strict) + Tailwind CSS + ESLint.
- Build warm ivory / deep forest green / restrained gold design system with `Amiri` & `Scheherazade New` Arabic typography and `Plus Jakarta Sans` Turkish UI typography.
- Implement 8-section responsive navigation (`Panel`, `Arapça Öğren`, `Mushaf`, `Kelime Hazinesi`, `Ezber`, `Tekrar`, `İstatistikler`, `Profil ve Ayarlar`).
- Implement `node:sqlite` local persistence + Supabase PostgreSQL migrations (`0001_initial_schema.sql`, `0002_rls_policies.sql`).
- Implement deterministic learning engine (`ts-fsrs` wrapper, 5-pillar mastery calculator, adaptive session planner with Normal / Intensive / 3-5 min Recovery modes).
- Import & verify canonical **Surah Al-Fatiha (Mushaf Page 1)** dataset and build interactive Mushaf reader, Word Inspector, FSRS flashcards, Hifz modes, placement diagnostic, and local microphone recording + comparison.

## Phase 2A — Juz Amma (38 Surahs / 24 Pages), Full Elif-Bâ & Cloud Sync (Completed)
- Expand canonical dataset (`fatiha-and-juz-amma.json`) to **Al-Fatiha + all 37 Surahs of Juz Amma** (38 Surahs, 24 Madinah Mushaf pages `[1, 582..604]`, 571 verses, 2,337 words) with SHA-256 checksums, Diyanet & Elmalılı translations, corpus morphology/roots, and Alafasy/Husary audio.
- Upgrade Mushaf reader to multi-page/multi-surah navigation (`?page=`, `?surah=`), explicit Bismillah section headers, active studied page tracking, and cross-surah root occurrence links.
- Expand Arabic literacy & recitation track to a complete **28-letter interactive Elif-Bâ matrix** (4 positional forms, sound/non-connecting filters, verified Quranic word audio), **8 progressive reading modules**, and **8 Tajweed lessons**.
- Expand Vocabulary Studio with 38-surah filtering, root filtering, pagination, and one-click Surah bulk FSRS card generation (`AR→TR` and `TR→AR`), and upgrade Memorization Studio across all 38 Surahs with random verse continuation tests.
- Implement full async `SupabaseProgressRepository` + Supabase Auth cookie API (`/api/auth`) with migration `0003_phase2_progress_columns.sql`, idempotent batch seeding (`supabase/seed.sql`), and ephemeral `/tmp` fallback so the app deploys cleanly from mobile browsers to Vercel + Supabase.

## Phase 2B — Full 604-Page Verified Mushaf Expansion (Completed)
- Synced all remaining Surahs (1–114) across all 604 Madinah Mushaf pages (6,236 verses, 77,429 words) via lazy gzipped per-Surah files (`surah-001.json.gz`..`surah-114.json.gz`) and `quran-meta.json`, bundled cleanly with `outputFileTracingIncludes`.
- Added normalized Arabic & Turkish full-Quran search (`/api/search`), interactive 30-Juz jumper, and offline Service Worker (`public/sw.js`) page/audio caching (`/api/mushaf/offline`).

## Phase 3 — Extended Vocabulary & Mutashabihat Engine (Completed)
- Built server-paginated 77,429-word vocabulary browser (`/api/vocabulary`), 1,651-root Root Family Explorer (`Kök Ailesi Gezgini`), and cross-Quran Mutashabihat (similar verse) alerts integrated into both Mushaf study and Hifz memorization flows.

## Phase 4 — Extensible AI Recitation & Pronunciation Assessment (Completed)
- Implemented `ConfigurableHttpAsrProvider` alongside a Levenshtein Arabic sequence aligner (`alignAsrTranscript`, supporting Uthmani dagger-alef variants) and consent-gated `multipart/form-data` audio upload (`/api/audio/assess`).
- Added persistent client-side IndexedDB audio storage (`local-recordings.ts`) and strictly preserved epistemic honesty (`requiresHumanReview: true`, explicit separation between word-sequence checks and human Tajweed verification).

## Phase 5 — Deep Analytics & Mobile PWA Polish (Completed)
- Implemented longitudinal error-pattern analytics (`buildErrorPatternInsights` and `buildJuzProgressGrid`) surfaced in `/statistics` with a clickable 30-Juz / 604-page coverage matrix, FSRS lapse alerts, and top missed root recommendations.
- Added offline connectivity banner, per-page offline bundle download in `/mushaf`, consolidated `supabase/setup_all.sql` single-paste migration, and gentle local browser reminder controls in `/settings`.

## Phase 6 — Multi-Reciter Expansion, Teacher Review Export & Cloud Readiness Diagnostics (Completed)
- Expanded verified ayah recitation playback across 6 Qaris (`src/lib/audio/reciters.ts`: Afâsî, Husarî Muallim, Husarî Mürettel, Abdülbasit Abdüssamed, Abdurrahman es-Sudeys, Ebû Bekir eş-Şatrî) across both `/mushaf` and `/memorization`.
- Built structured Teacher Review Package generator (`src/lib/audio/teacher-review.ts`) with a 5-criterion Tajweed checklist and mandatory human-review notice, plus direct `.webm` recording downloads and clipboard/Markdown report copy in `/mushaf` and JSON backup exports in `/settings`.
- Added `/api/health` diagnostics endpoint, `scripts/setup-cloud-env.mjs` (`pnpm setup:env`), and live health-check controls in `/settings`.

