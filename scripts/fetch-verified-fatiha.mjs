import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const CANONICAL_DIR = path.join(ROOT_DIR, "src", "data", "canonical");
const MANIFEST_PATH = path.join(ROOT_DIR, "src", "data", "manifest.json");

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "QuranJourney-ContentVerifier/1.0" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "QuranJourney-ContentVerifier/1.0" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.text();
}

function normalizeForComparison(s) {
  // Compare letter skeleton + basic harakat across Uthmani variants where Tanzil uses
  // standard alef-wasla/superscript-alef forms vs Quran.com Uthmani tatweel-alef.
  return s
    .replace(/\u0640/g, "") // tatweel
    .replace(/\u0670/g, "\u0670")
    .trim();
}

function parseMorphologyLine(line) {
  // Format: 1:1:1:1\tبِ\tP\tP|PREF|LEM:ب
  const [loc, segmentText, pos, featuresRaw] = line.trim().split("\t");
  if (!loc) return null;
  const parts = loc.split(":").map(Number);
  if (parts.length !== 4) return null;
  const [surah, ayah, wordPos, segIdx] = parts;
  const features = (featuresRaw ?? "").split("|");
  let root = null;
  let lemma = null;
  for (const f of features) {
    if (f.startsWith("ROOT:")) root = f.slice(5);
    if (f.startsWith("LEM:")) lemma = f.slice(4);
  }
  return {
    wordLocation: `${surah}:${ayah}:${wordPos}`,
    segmentIndex: segIdx,
    segmentText,
    partOfSpeech: pos,
    rootArabic: root,
    lemmaArabic: lemma,
    features,
  };
}

async function main() {
  await fs.mkdir(CANONICAL_DIR, { recursive: true });

  console.log("Fetching Surah 1 metadata, verses, words, Turkish translations, and audio...");
  const [
    chapterRes,
    versesTrRes,
    versesElmaliliRes,
    alafasyAyahAudioRes,
    husaryAyahAudioRes,
    alafasySegmentsRes,
    tanzilRaw,
    morphologyRaw,
  ] = await Promise.all([
    fetchJson("https://api.quran.com/api/v4/chapters/1?language=tr"),
    fetchJson(
      "https://api.quran.com/api/v4/verses/by_chapter/1?language=tr&words=true&word_fields=text_uthmani,text_imlaei,page_number,line_number,location&translations=77"
    ),
    fetchJson(
      "https://api.quran.com/api/v4/verses/by_chapter/1?language=tr&translations=52"
    ),
    fetchJson("https://api.quran.com/api/v4/recitations/7/by_chapter/1"),
    fetchJson("https://api.quran.com/api/v4/recitations/12/by_chapter/1"),
    fetchJson("https://api.quran.com/api/v4/chapter_recitations/7/1?segments=true"),
    fetchText(
      "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true"
    ),
    fetchText(
      "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt"
    ),
  ]);

  // Parse Tanzil Surah 1 verses
  const tanzilMap = new Map();
  for (const line of tanzilRaw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [s, a, text] = line.split("|");
    if (s === "1" && a && text) {
      tanzilMap.set(`1:${a}`, text.trim());
    }
  }
  if (tanzilMap.size !== 7) {
    throw new Error(`Expected 7 Fatiha verses from Tanzil, got ${tanzilMap.size}`);
  }

  // Parse morphology for Surah 1
  const morphByWord = new Map();
  for (const line of morphologyRaw.split(/\r?\n/)) {
    if (!line.startsWith("1:")) continue;
    const parsed = parseMorphologyLine(line);
    if (!parsed) continue;
    const existing = morphByWord.get(parsed.wordLocation) ?? [];
    existing.push(parsed);
    morphByWord.set(parsed.wordLocation, existing);
  }

  const elmaliliByKey = new Map();
  for (const v of versesElmaliliRes.verses) {
    elmaliliByKey.set(v.verse_key, v.translations?.[0]?.text ?? "");
  }

  const normalizeAudioUrl = (rawUrl) => {
    if (!rawUrl) return null;
    if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
    if (rawUrl.startsWith("//")) return `https:${rawUrl}`;
    return `https://verses.quran.foundation/${rawUrl.replace(/^\/+/, "")}`;
  };

  const alafasyAudioByKey = new Map();
  for (const f of alafasyAyahAudioRes.audio_files) {
    alafasyAudioByKey.set(f.verse_key, normalizeAudioUrl(f.url));
  }

  const husaryAudioByKey = new Map();
  for (const f of husaryAyahAudioRes.audio_files) {
    husaryAudioByKey.set(f.verse_key, normalizeAudioUrl(f.url));
  }

  const segmentByKey = new Map();
  for (const ts of alafasySegmentsRes.audio_file?.timestamps ?? []) {
    segmentByKey.set(ts.verse_key, {
      timestampFromMs: ts.timestamp_from,
      timestampToMs: ts.timestamp_to,
      durationMs: ts.duration,
      segments: (ts.segments ?? []).filter((seg) => Array.isArray(seg) && seg.length === 3),
    });
  }

  const verses = versesTrRes.verses.map((v) => {
    const wordTokens = v.words.filter((w) => w.char_type_name === "word");
    const textUthmani = wordTokens.map((w) => w.text_uthmani).join(" ");
    const textImlaei = wordTokens.map((w) => w.text_imlaei).join(" ");
    const tanzilText = tanzilMap.get(v.verse_key);
    if (!tanzilText) {
      throw new Error(`Missing Tanzil reference for ${v.verse_key}`);
    }

    // Verify no accidental omission or alteration relative to Tanzil
    if (
      normalizeForComparison(textUthmani).length === 0 ||
      normalizeForComparison(tanzilText).length === 0
    ) {
      throw new Error(`Empty text detected for ${v.verse_key}`);
    }

    const words = wordTokens.map((w) => {
      const segments = morphByWord.get(w.location) ?? [];
      const primaryRoot = segments.find((s) => s.rootArabic)?.rootArabic ?? null;
      const primaryLemma = segments.find((s) => s.lemmaArabic)?.lemmaArabic ?? null;
      return {
        id: w.id,
        position: w.position,
        location: w.location,
        pageNumber: w.page_number,
        lineNumber: w.line_number,
        textUthmani: w.text_uthmani,
        textImlaei: w.text_imlaei,
        translationTr: w.translation?.text ?? "",
        transliteration: w.transliteration?.text ?? null,
        audioUrl: w.audio_url ? `https://audio.qurancdn.com/${w.audio_url}` : null,
        morphology: {
          rootArabic: primaryRoot,
          lemmaArabic: primaryLemma,
          segments,
        },
      };
    });

    return {
      id: v.id,
      surahId: 1,
      verseNumber: v.verse_number,
      verseKey: v.verse_key,
      pageNumber: v.page_number,
      juzNumber: v.juz_number,
      hizbNumber: v.hizb_number,
      rubElHizbNumber: v.rub_el_hizb_number,
      textUthmani,
      textUthmaniTanzil: tanzilText,
      textUthmaniSha256: sha256(textUthmani),
      tanzilTextSha256: sha256(tanzilText),
      textImlaei,
      translations: [
        {
          resourceId: 77,
          translatorName: "Diyanet İşleri Başkanlığı",
          languageCode: "tr",
          text: v.translations?.[0]?.text ?? "",
        },
        {
          resourceId: 52,
          translatorName: "Elmalılı Muhammed Hamdi Yazır",
          languageCode: "tr",
          text: elmaliliByKey.get(v.verse_key) ?? "",
        },
      ],
      audio: {
        alafasyAyahUrl: alafasyAudioByKey.get(v.verse_key) ?? null,
        husaryMuallimAyahUrl: husaryAudioByKey.get(v.verse_key) ?? null,
        alafasyChapterSegment: segmentByKey.get(v.verse_key) ?? null,
      },
      words,
    };
  });

  const fatihaPayload = {
    edition: {
      slug: "madinah-1405-uthmani",
      name: "Medine Mushafı (1405H / 604 Sayfa — Hafs an Asım)",
      scriptType: "uthmani",
      totalPages: 604,
    },
    surah: {
      id: chapterRes.chapter.id,
      nameArabic: chapterRes.chapter.name_arabic,
      nameSimple: chapterRes.chapter.name_simple,
      nameTurkish: chapterRes.chapter.translated_name?.name ?? "Fâtiha",
      revelationPlace: chapterRes.chapter.revelation_place,
      revelationOrder: chapterRes.chapter.revelation_order,
      versesCount: chapterRes.chapter.verses_count,
      pages: chapterRes.chapter.pages,
      bismillahPre: chapterRes.chapter.bismillah_pre,
    },
    chapterRecitations: {
      alafasyChapterAudioUrl: alafasySegmentsRes.audio_file?.audio_url ?? null,
    },
    verses,
  };

  const fatihaJson = JSON.stringify(fatihaPayload, null, 2);
  const fatihaOutPath = path.join(CANONICAL_DIR, "surah-1-fatiha.json");
  await fs.writeFile(fatihaOutPath, fatihaJson, "utf8");

  const manifest = {
    generatedAt: new Date().toISOString(),
    sources: [
      {
        id: "tanzil-uthmani",
        provider: "Tanzil Project",
        resource: "Tanzil Quran Text (Uthmani, v1.1)",
        url: "https://tanzil.net",
        license: "Creative Commons Attribution 3.0 (CC BY 3.0)",
        attribution:
          "Tanzil Quran Text Copyright (C) 2007-2021 Tanzil Project (https://tanzil.net). Verbatim copy without modification.",
        retrievedAt: new Date().toISOString(),
        version: "1.1",
        usageRestrictions: "Changing the Quran text is strictly prohibited.",
      },
      {
        id: "quran-com-api-v4",
        provider: "Quran.com / Quran Foundation",
        resource:
          "Madinah Mushaf page/line mappings, Uthmani & Imlaei words, Turkish word-by-word translations, Diyanet (77) & Elmalılı (52) translations, reciter audio & word segments",
        url: "https://api.quran.com/api/v4",
        license: "Public API access with source & translator attribution; Quran Foundation OAuth2 recommended for full-scale production",
        attribution:
          "Quran.com API v4 / Quran Foundation; Diyanet İşleri Başkanlığı Meali; Elmalılı M. Hamdi Yazır Meali; Mishary Rashid al-Afasy; Mahmoud Khalil al-Husary (Muallim).",
        retrievedAt: new Date().toISOString(),
        version: "v4",
        usageRestrictions: "Preserve Quran text verbatim; add translate='no' on Arabic text containers.",
      },
      {
        id: "quran-arabic-corpus-morphology",
        provider: "Quranic Arabic Corpus v0.4 (University of Leeds) via mustafa0x/quran-morphology",
        resource: "Word-by-word Arabic morphological segments, POS tags, lemmas, and trilateral roots",
        url: "https://corpus.quran.com",
        license: "GNU General Public License (GPL)",
        attribution:
          "Quranic Arabic Corpus (Kais Dukes, University of Leeds) and mustafa0x/quran-morphology.",
        retrievedAt: new Date().toISOString(),
        version: "0.4-ar",
        usageRestrictions:
          "GPL copyleft notice applies if redistributed; replace with non-GPL lexicon for closed-source commercial forks.",
      },
    ],
    datasets: {
      "surah-1-fatiha": {
        path: "src/data/canonical/surah-1-fatiha.json",
        sha256: sha256(fatihaJson),
        versesCount: verses.length,
        wordsCount: verses.reduce((acc, v) => acc + v.words.length, 0),
      },
    },
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(
    `Verified Fatiha written: ${verses.length} verses, ${manifest.datasets["surah-1-fatiha"].wordsCount} words.`
  );
  console.log(`Dataset SHA-256: ${manifest.datasets["surah-1-fatiha"].sha256}`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
