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
   - `RecitationAsrProvider` and `TajweedEvaluationProvider` interfaces live behind server-side API boundaries.
   - Phase 1/2 ships with **local MediaRecorder recording**, **side-by-side reference comparison**, **explicit consent flags**, and **honest capability reporting** (`"Ses kaydınız yerel olarak saklanır; yapay zekâ telaffuz değerlendirmesi henüz bağlı değil"`).
   - Never presents simple text matching as Tajweed verification.
5. **Arabic Typography & RTL Isolation:**
   - Quranic Arabic containers explicitly specify `lang="ar" dir="rtl" translate="no"` and `<meta name="google" content="notranslate" />`.
   - Uses SIL Open Font License fonts (`Amiri` and `Scheherazade New`) verified for full Uthmani diacritic positioning (`fatha`, `kasra`, `damma`, `shadda`, `sukun`, `dagger alif`, `maddah`, `stop marks`).

---

## 4. Directory Structure

```text
├── docs/                         # PRD, Architecture, Database, Sources, Roadmap, Testing
├── supabase/
│   └── migrations/               # PostgreSQL DDL, indexes, and RLS policies
├── scripts/
│   ├── fetch-verified-fatiha.mjs # Downloads & cross-validates Fatiha content + checksums
│   └── verify-content.mjs        # Automated Quran text integrity verifier
├── src/
│   ├── app/                      # Next.js App Router pages & API routes
│   │   ├── page.tsx              # Dashboard (Panel)
│   │   ├── learn-arabic/         # Arabic reading placement & lessons
│   │   ├── mushaf/               # Page-by-page Mushaf reader & study studio
│   │   ├── vocabulary/           # Personal Quran vocabulary library
│   │   ├── memorization/         # Dedicated Hifz practice & page test
│   │   ├── review/               # FSRS spaced repetition active recall queue
│   │   ├── statistics/           # 5-pillar analytics & error patterns
│   │   ├── settings/             # Preferences, audio consent, Supabase/AI setup
│   │   └── api/                  # Typed REST route handlers
│   ├── components/               # Reusable, accessible UI & domain components
│   ├── data/
│   │   ├── manifest.json         # Verified source manifest & SHA-256 checksums
│   │   └── canonical/            # Immutable verified Quran datasets
│   └── lib/
│       ├── content/              # Canonical content loader & integrity checks
│       ├── learning-engine/      # FSRS scheduler, mastery states, session planner
│       ├── db/                   # Repository interfaces, SQLite & Supabase adapters
│       └── audio/                # Audio player state & extensible assessment interfaces
└── tests/                        # Unit & integration tests
```
