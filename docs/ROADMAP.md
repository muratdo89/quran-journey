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

## Phase 2B — Full 604-Page Verified Mushaf Expansion (Next)
- Sync remaining Surahs (2–77) across all 604 Madinah Mushaf pages via Quran Foundation OAuth2 / QUL / Tanzil import pipeline.
- Add full-Quran Turkish/Arabic search index and offline Service Worker caching for studied pages.

## Phase 3 — Extended Vocabulary & Mutashabihat Engine
- Full 77,429-word Quran vocabulary browser with root-family grouping, frequency ranking, and Hifz mutashabihat (similar verse) cross-reference alerts.

## Phase 4 — Extensible AI Recitation & Pronunciation Assessment
- Plug in server-side Quranic ASR (e.g., Whisper fine-tuned on Quranic Arabic or specialized Tarteel/Quran models) behind `RecitationAsrProvider`.
- Word-sequence alignment diffing with explicit confidence bands and human teacher export bundle.

## Phase 5 — Deep Analytics & Mobile PWA Polish
- Longitudinal error-pattern categorization (madd errors, harakat confusion, similar-verse mix-ups, forgotten roots).
- Web Push gentle review reminders and offline audio caching for active memorization pages.
