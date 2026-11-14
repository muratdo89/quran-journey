# Quran Journey — Product Requirements Document (PRD)

**Product Name:** Quran Journey (Kişisel Kur'an Öğrenme Platformu)  
**Target Language:** Turkish (UI, explanations, translations) + Original Arabic script (Uthmani with full diacritics)  
**Version:** 0.1.0 (Phase 0 & Phase 1 Foundation)  
**Last Updated:** 2026-11-14

---

## 1. Product Vision & Problem Statement

Quran Journey is a personal, scientifically structured Quran learning platform designed specifically for a Turkish-speaking adult learner who:
- Has partial familiarity with the Arabic alphabet (*Elif-Ba*) and wants a structured, non-condescending review without starting blindly from zero.
- Wants to study the Quran **page-by-page** following a verified 604-page Madinah Mushaf edition.
- Needs **word-by-word Turkish meanings** alongside **contextual verse-level Turkish translations**, keeping literal lexical glosses distinct from verse-level interpretations.
- Wants to **memorize verses and full pages** using active recall, progressive cloze hiding, and spaced repetition rather than passive rereading.
- Wants to **improve recitation and Tajweed** progressively with honest feedback that never conflates speech-to-text word matching with phonetic or Tajweed mastery.
- Has previously struggled with **consistency, procrastination, and forgetfulness**, and needs a calm, forgiving habit system that prioritizes retention over meaningless streaks.

**Ultimate Success Metric:** Not minutes spent or pages opened, but the learner's measurable ability to read Arabic accurately, recall word meanings in both directions (Arabic ↔ Turkish), understand verse context, and retain memorized verses over time.

---

## 2. Target User & Learning Personas

- **Primary Persona (Personal Learner):** Turkish-speaking adult, knows most Arabic letters in isolation, struggles with connected letter forms, vowel/shadda speed, vocabulary retention, and consistent daily review. Uses desktop at home and mobile during short daily breaks (3–20 min).
- **Future Expansion:** Multi-user support via Supabase Auth & Row Level Security (RLS), optional teacher/mentor review export for recitation recordings.

---

## 3. Five Independent Learning Pillars (Measured Separately)

The platform **never** merges all progress into a single misleading overall percentage. Each pillar has an independent mastery dimension:

1. **Arapça Okuma (Arabic Reading)**
   - Placement assessment covering letter recognition, forms (initial/medial/final/isolated), harakat (Fatha, Kasra, Damma), Sukun, Shadda, Tanween, Madd, Hamza, and connected word reading.
   - Adaptive curriculum skipping already-mastered concepts while reinforcing weak areas.
   - Arabic-script-first pedagogy (Turkish transliteration only as optional secondary aid, never the primary reading method).

2. **Doğru Okuma ve Tecvid (Pronunciation & Tajweed)**
   - Progressive curriculum: *Mahâricü'l-hurûf*, *Sıfâtü'l-hurûf*, *Med* (Madd), *Gunne*, *Kalkale*, *İdğam*, *İhfâ*, *İklâb*, *Sâkin Nûn ve Tenvîn*, *Sâkin Mîm*, *Vakf ve İbtidâ*.
   - Explicit epistemic separation between:
     1. Recognizing the right word sequence.
     2. Distinguishing pronunciation differences in listening exercises.
     3. Evaluating actual phonetic quality.
     4. Evaluating Tajweed rule application.

3. **Kur'an Kelime Hazinesi ve Anlam (Quranic Vocabulary & Meaning)**
   - Every Quranic word is individually selectable (`location: surah:ayah:word`).
   - Word Inspector displays: Uthmani spelling with full harakat, pronunciation aid, word-level Turkish meaning, contextual verse meaning, verified root & morphological category (where available from verified linguistic datasets), occurrence context, and individual word audio.
   - Separate display of **kelime anlamı (literal)** vs **ayet meali (contextual)**.
   - Bidirectional recall: Arabic → Turkish and Turkish → Arabic recognition.
   - Automatic FSRS vocabulary review card generation.

4. **Ezber Motoru (Quran Memorization / Hifz)**
   - Listen & repeat (ayah-by-ayah and word-synchronized playback where available).
   - Verse-by-verse active recall tools:
     - Hide complete verse text.
     - Reveal one word at a time.
     - Hide selected/random words (cloze recall).
     - Complete the next verse prompt.
     - Arrange verses in correct order.
     - Continue from a randomly selected ayah on the page.
   - Independent per-verse mastery states:
     - `not_started` (Başlanmadı)
     - `learning` (Öğreniliyor)
     - `practicing` (Pekiştiriliyor)
     - `provisional_mastery` (Geçici Hâkimiyet)
     - `stable_memorization` (Kalıcı Ezber)
     - `needs_revision` (Tekrar Gerekiyor)
   - A page is never marked mastered merely by reading it once.

5. **Motivasyon ve Süreklilik (Habit & Recovery System)**
   - Daily goals with 3 session modes:
     - **Normal Mod (~20 dk):** ~60% due reviews (vocabulary + verses + reading concepts) / ~40% new material.
     - **Yoğun Mod (~35 dk):** Deeper memorization & multi-ayah study.
     - **Minimum Çaba / Toparlanma Modu (3–5 dk):** Prioritizes critical overdue reviews to preserve continuity without overwhelm.
   - Meaningful XP & milestones: awarded for verified active recall, review completion, and memorization checks — never for empty page views.
   - Forgiving recovery: Missed days trigger a calm recovery plan ("Bugün küçük bir adımla devam edelim") with zero guilt or punitive streak destruction.

---

## 4. Core Functional Requirements (Phase 1 Scope + Target Architecture)

### Phase 1 + First Complete Learning Experience (Surah Al-Fatiha / Mushaf Page 1)
- Responsive Turkish-first shell with 8 primary navigation sections (`Panel`, `Arapça Öğren`, `Mushaf`, `Kelime Hazinesi`, `Ezber`, `Tekrar`, `İstatistikler`, `Profil ve Ayarlar`).
- **Dashboard (`Panel`)**: Answers "Bugün ne çalışmalıyım?", "Neyi unutmaya başladım?", "Hangi sayfadayım?", and provides a prominent `Öğrenmeye Başla` button plus session mode selector (`Normal`, `Yoğun`, `3-5 dk Toparlanma`).
- **Mushaf Page 1 (Al-Fatiha) End-to-End Study View**:
  - Verified Uthmani script (Amiri / Scheherazade New, SIL OFL) with RTL layout and zero unintended diacritic alteration.
  - Adjustable Arabic font size, line height, light/dark reading surface, show/hide translation toggle.
  - Individually selectable words with instant Word Inspector (Arabic spelling, Turkish word meaning, verified root/morphology, word-level audio playback, add/review FSRS card).
  - Verified Diyanet Turkish verse translation (with optional Elmalılı comparison) kept clearly separate from word glosses.
  - Reference recitation playback (Mishary Rashid al-Afasy & Mahmoud Khalil al-Husary Muallim) with word-synchronized highlighting (using verified millisecond segment timestamps) and playback speed controls.
  - Verse bookmarking, personal study notes, and difficult-verse flagging.
  - Interactive Learning Mode, Memorization Mode (hide verse, reveal word-by-word, hide selected words, verse ordering, next-verse recall, self-assessed confidence grading), and Assessment Mode.
- **Spaced Repetition Engine (`ts-fsrs`)**:
  - Real FSRS scheduling for vocabulary cards, verses, and Arabic reading concepts.
  - Active recall UI (prompt before reveal; 4-grade rating: `Tekrar`, `Zor`, `İyi`, `Kolay`).
- **Initial Arabic Reading Placement Check & Adaptive Recommendation**:
  - Non-punitive diagnostic assessment for letters, forms, vowels, and connected reading.
- **Persistent Relational Storage**:
  - Local SQLite (`node:sqlite`) working immediately out of the box + full Supabase PostgreSQL schema, migrations, and RLS policies ready for cloud deployment.
