# Quran Journey — Content Sources & Licensing Manifest

Trustworthiness and legal/scholarly integrity are non-negotiable. Every external source below was verified against live endpoints and official documentation on **2026-11-14**.

---

## 1. Verified Source Evaluation

| Resource | Provider | Verified Endpoint / Format | License & Attribution Requirements | Usage Decision & Notes |
| --- | --- | --- | --- | --- |
| **Quran Uthmani Text (Cross-Validation Reference)** | Tanzil Project (`tanzil.net`) | `https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true` (v1.1) | **CC BY 3.0**. Must distribute verbatim without altering text; must indicate Tanzil Project and link to `https://tanzil.net`; must preserve copyright notice. | **Approved & Integrated.** Used to independently cross-check Uthmani Arabic text integrity and store SHA-256 checksums. |
| **Madinah Mushaf Page/Line Layout, Word Tokens & Turkish Word-by-Word** | Quran.com Public Content API v4 / Quran Foundation | `https://api.quran.com/api/v4/verses/by_chapter/{id}?language=tr&words=true&word_fields=text_uthmani,text_imlaei,page_number,line_number,location` | Public v4 endpoints currently accessible without credentials; Quran Foundation Content APIs v4 production migration uses OAuth2 Client Credentials (`apis.quran.foundation`). Must preserve text verbatim, add `translate="no"`, and attribute source translations/reciters. | **Approved for Canonical Seed & Server Proxy.** Pre-fetched and checksummed locally for Surah Al-Fatiha (Page 1) and all 37 Surahs of Juz Amma (Pages 582–604; 38 Surahs, 571 verses, 2,337 words), with OAuth2 QF client configuration supported for future full-Mushaf sync. Note: for 84 tokens where Quran.com's upstream WBW API falls back to English (`language_name: "english"`), the upstream gloss is preserved verbatim and surfaced with a transparent UI note pointing to verse-level Turkish meals. |
| **Turkish Verse Translations (Meal)** | Diyanet İşleri Başkanlığı (Resource ID `77`) & Elmalılı Hamdi Yazır (Resource ID `52`) via Quran.com API v4 / QUL | `translations=77,52` | Publicly served via Quran.com / QUL Turkish translation catalog (`Turkish Translation(Diyanet)`). Attribution to *Diyanet İşleri Başkanlığı* and *Elmalılı Muhammed Hamdi Yazır* displayed on reading screens and credits page. | **Approved.** Both translations stored separately from word-level glosses so literal vs. contextual meanings are never conflated. |
| **Reference Audio & Word Timing Segments** | QuranCDN / Quran Foundation (`verses.quran.foundation`, `audio.qurancdn.com`, `download.quranicaudio.com`) | Per-word: `audio.qurancdn.com/wbw/001_001_001.mp3`; Per-ayah: `verses.quran.foundation/Alafasy/mp3/001001.mp3`; Chapter segments: `api.quran.com/api/v4/chapter_recitations/{7}/{chapter}?segments=true` | Public CDN streaming with CORS (`access-control-allow-origin: *`). Reciter attribution required (Mishary Rashid al-Afasy; Mahmoud Khalil al-Husary Muallim). | **Approved for Streaming & Optional User Caching.** Never re-bundled as proprietary audio; streamed directly from official CDNs with attribution. |
| **Quranic Word Roots & Morphology** | Quranic Arabic Corpus v0.4 (`corpus.quran.com`) & `mustafa0x/quran-morphology` | `https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt` | **GNU General Public License (GPL)**. Attribution to University of Leeds Quranic Arabic Corpus (Kais Dukes) and `mustafa0x/quran-morphology` fork. | **Approved with License Notice.** Because GPL carries copyleft obligations on redistribution of derivative works, morphology data is stored as an explicitly attributed canonical linguistic dataset with GPL notice in `src/data/manifest.json` and the app's Kaynaklar (Sources) view; for closed commercial redistribution, an alternative non-GPL linguistic lexicon or QUL-licensed morphology pack should be substituted. |
| **Quranic Universal Library (QUL)** | TarteelAI (`qul.tarteel.ai`) | Web portal & GitHub (`TarteelAI/quranic-universal-library`) | Per-resource licensing (mix of Public Domain, CC, and specific author licenses). | **Catalog Evaluated.** Used as secondary verification reference; each QUL export requires checking individual resource license before bundling. |
| **Arabic Typography** | Google Fonts / AlifType (`Amiri`, `Scheherazade New`) | `@fontsource` / Google Fonts | **SIL Open Font License (OFL) 1.1**. Free for personal and commercial web embedding with attribution. | **Approved.** Rejected `KFGQPC Uthmanic Script Hafs` for direct repo redistribution because its EULA restricts modification/redistribution without express written permission. |

---

## 2. Automated Data Integrity Rules

1. Every verse in `src/data/canonical/` stores its exact `text_uthmani` and `text_uthmani_sha256`.
2. Automated tests (`tests/content-integrity.test.ts` and `scripts/verify-content.mjs`) and `tests/arabic-curriculum.test.ts` verify:
   - Exact SHA-256 dataset checksums against `src/data/manifest.json` for both `surah-1-fatiha.json` and `fatiha-and-juz-amma.json`.
   - Verbatim Uthmani alignment against Tanzil v1.1 across all 38 Surahs (571 verses).
   - Valid Madinah Mushaf page mappings across all 24 covered pages (`1` and `582..604`).
   - Sequential word positions (`1..N`), non-empty word glosses, and valid CDN audio URLs for all 2,337 words.
   - Exact cross-validation of all 28 Elif-Bâ letter examples, 8 Arabic reading modules, and 8 Tajweed examples against canonical word locations.
   - Zero AI-generated Quran text or fabricated translations anywhere in the codebase.
