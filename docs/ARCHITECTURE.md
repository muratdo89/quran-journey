# Quran Journey — System Architecture

## 1. Architectural Overview

Quran Journey uses a modular, layered Next.js App Router architecture written in strict TypeScript (`strict: true`), separating **canonical verified Quran content**, **deterministic learning science logic**, **AI/audio provider abstractions**, and **user progress persistence**.

```
┌────────────────────────────────────────────────────────────────────────┐
│                        Next.js App Router (UI)                         │
│  Dashboard │ Learn Arabic │ Mushaf │ Vocab │ Hifz │ Review │ Stats     │
└──────────────────────────────┬─────────────────────────────────────────┘
                               │ Server Components + Route Handlers (API)
┌──────────────────────────────▼─────────────────────────────────────────┐
│                       Application Services Layer                       │
│  SessionPlanner │ AssessmentService │ StudyActionService │ AudioService│
└───────────┬──────────────────────────┬──────────────────────┬──────────┘
            │                          │                      │
┌───────────▼───────────┐  ┌───────────▼───────────┐  ┌───────▼──────────┐
│   Learning Engine     │  │ Content Repository    │  │ Progress Repo    │
│  (Pure TypeScript)    │  │ (Read-only Canonical) │  │ (User State)     │
│  - FSRS (ts-fsrs)     │  │ - Verified JSON/DB    │  │ - SQLite (local) │
│  - 5-Pillar Mastery   │  │ - Checksum-verified   │  │ - Supabase (PG)  │
│  - Placement Engine   │  │ - Source manifest     │  │   w/ Auth & RLS  │
└───────────────────────┘  └───────────────────────┘  └──────────────────┘
```

---

## 2. Technology Stack

| Layer | Choice | Rationale |
| --- | --- | --- |
| Framework | Next.js 16 (App Router) + React 19 | Server-side credential safety, fast SSR/RSC for canonical content, clean API route handlers |
| Language | TypeScript (`strict: true`, `noUncheckedIndexedAccess`) | Compile-time safety for Quranic indices, FSRS states, and schema validation |
| Styling | Tailwind CSS v4 + accessible UI primitives | Warm ivory/forest-green/gold theme, RTL Arabic isolation (`dir="rtl"`, `translate="no"`), responsive mobile-first design |
| Spaced Repetition | `ts-fsrs` (Open Spaced Repetition) | Battle-tested TypeScript FSRS implementation with deterministic scheduling |
| Validation | `zod` | Runtime validation of external API imports, user inputs, and configuration |
| Local Persistence (Dev/Personal) | Node.js built-in `node:sqlite` (`DatabaseSync`) | Zero-setup, immediate relational persistence on day one without fabricated cloud keys |
| Target Cloud Persistence | Supabase (PostgreSQL + Auth + RLS + Private Storage) | Relational integrity, row-level user isolation, scalable multi-user readiness |
| Testing | Vitest + Playwright (planned) | Unit tests for FSRS/mastery/data integrity + E2E browser workflow tests |

---

## 3. Core Architectural Principles

1. **Strict Separation of Canonical Content and User State:**
   - Canonical Quran text, Mushaf page mappings, word tokens, verified Turkish translations, and morphology records are immutable read-only datasets linked by stable canonical IDs (`surah_id`, `ayah_key`, `word_location`, `mushaf_page`).
   - User learning state (`user_word_progress`, `user_verse_progress`, `learning_cards`, `review_history`, `user_notes`, `bookmarks`) references canonical keys and is never mixed into canonical records.
2. **Storage Adapter Pattern (Zero-Lock-In):**
   - `ProgressRepository` defines a clear async/sync contract for reading and mutating user progress, FSRS cards, notes, bookmarks, sessions, and recordings.
   - `SqliteProgressRepository` runs automatically when Supabase environment variables are absent, storing relational tables in `.data/quran-journey.db`.
   - `SupabaseProgressRepository` activates when `NEXT_PUBLIC_SUPABASE_URL` and `NEXT_PUBLIC_SUPABASE_ANON_KEY` are configured, enforcing Supabase Auth and PostgreSQL RLS.
3. **Deterministic Learning Engine (`src/lib/learning-engine/`):**
   - Pure functions with zero UI or database side effects, fully unit-tested:
     - `fsrs-scheduler.ts`: Wraps `ts-fsrs` to schedule vocabulary, verse, and Arabic reading cards and compute retrievability.
     - `mastery.ts`: Computes 5 independent pillar scores (`arabicReading`, `tajweed`, `vocabulary`, `comprehension`, `memorization`) and verse mastery state transitions (`not_started` → `learning` → `practicing` → `provisional_mastery` → `stable_memorization` / `needs_revision`).
     - `session-planner.ts`: Builds `normal` (20 dk), `intensive` (35 dk), and `recovery` (3–5 dk) plans prioritizing overdue reviews (~60/40 review-to-new split, shifting toward 100% review during recovery).
     - `placement.ts`: Evaluates initial Arabic reading diagnostic responses and recommends starting modules without forcing redundant beginner drills.
4. **Extensible Audio & AI Assessment Abstraction (`src/lib/audio/`):**
   - `RecitationAssessmentProvider` interface and `ConfigurableHttpAsrProvider` live behind server-side API boundaries (`/api/audio/assess`).
   - Supports local browser IndexedDB recording persistence (`local-recordings.ts`), side-by-side reference playback, explicit upload consent gates (`consentGranted`), and Levenshtein Arabic sequence alignment (`sequence-aligner.ts`) when `QURAN_ASR_API_URL` is configured.
   - Always returns `requiresHumanReview: true` and never presents speech-to-text sequence matching as phonetic or Tajweed mastery.
5. **Arabic Typography & RTL Isolation:**
   - Quranic Arabic containers explicitly specify `lang="ar" dir="rtl" translate="no"` and `<meta name="google" content="notranslate" />`.
   - Uses SIL Open Font License fonts (`Amiri` and `Scheherazade New`) verified for full Uthmani diacritic positioning (`fatha`, `kasra`, `damma`, `shadda`, `sukun`, `dagger alif`, `maddah`, `stop marks`).

---

## 4. Directory Structure

```text
├── docs/                         # PRD, Architecture, Database, Sources, Roadmap, Testing
├── public/
│   └── sw.js                     # Offline Service Worker for Mushaf pages & verse audio
├── supabase/
│   ├── setup_all.sql             # Consolidated idempotent schema & RLS setup script
│   ├── seed.sql                  # Batched canonical SQL seed script
│   └── migrations/               # PostgreSQL DDL, indexes, and RLS policies (0001..0003)
├── scripts/
│   ├── fetch-full-quran.mjs      # Syncs & validates 114 Surahs, 604 pages, roots & mutashabihat
│   ├── generate-supabase-seed.mjs# Generates supabase/seed.sql from canonical surah files
│   └── verify-content.mjs        # Automated full-Quran SHA-256 & schema integrity verifier
├── src/
│   ├── app/                      # Next.js App Router pages & API routes
│   │   ├── page.tsx              # Dashboard (Panel)
│   │   ├── learn-arabic/         # Elif-Bâ, Arabic reading modules & Tajweed lessons
│   │   ├── mushaf/               # 604-page Mushaf reader, search & offline download
│   │   ├── vocabulary/           # 77,429-word browser & 1,651-root family explorer
│   │   ├── memorization/         # Dedicated Hifz studio, mutashabihat & page tests
│   │   ├── review/               # FSRS spaced repetition active recall queue
│   │   ├── statistics/           # 5-pillar analytics, error patterns & 30-Juz coverage grid
│   │   ├── settings/             # Preferences, reminder, audio consent, Supabase/ASR status
│   │   └── api/                  # Typed REST route handlers (/search, /vocabulary, /mushaf/offline, /audio/assess, ...)
│   ├── components/               # Reusable, accessible UI & domain components
│   ├── data/
│   │   ├── manifest.json         # Verified source manifest & SHA-256 checksums
│   │   └── canonical/            # quran-meta.json, lexicon-index.json.gz, surahs/surah-001..114.json.gz
│   └── lib/
│       ├── content/              # Lazy gzipped canonical loader, LRU cache & search
│       ├── learning-engine/      # FSRS scheduler, mastery states, session planner, analytics
│       ├── db/                   # Repository interfaces, SQLite & Supabase adapters
│       └── audio/                # Assessment providers, sequence aligner & IndexedDB store
└── tests/                        # Unit & integration tests (content, curriculum, engine, ASR, repo)
```

