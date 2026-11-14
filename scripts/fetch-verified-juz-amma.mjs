import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";

const ROOT_DIR = process.cwd();
const CANONICAL_DIR = path.join(ROOT_DIR, "src", "data", "canonical");
const MANIFEST_PATH = path.join(ROOT_DIR, "src", "data", "manifest.json");

// Surah 1 (Al-Fatiha, Page 1) + Surahs 78..114 (Juz Amma / Pages 582..604)
const TARGET_SURAHS = [1, ...Array.from({ length: 37 }, (_, i) => 78 + i)];

function sha256(text) {
  return crypto.createHash("sha256").update(text, "utf8").digest("hex");
}

async function fetchJson(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "QuranJourney-ContentVerifier/2.0" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.json();
}

async function fetchText(url) {
  const res = await fetch(url, {
    headers: { "User-Agent": "QuranJourney-ContentVerifier/2.0" },
  });
  if (!res.ok) {
    throw new Error(`HTTP ${res.status} fetching ${url}`);
  }
  return res.text();
}

function normalizeAudioUrl(rawUrl) {
  if (!rawUrl) return null;
  if (rawUrl.startsWith("http://") || rawUrl.startsWith("https://")) return rawUrl;
  if (rawUrl.startsWith("//")) return `https:${rawUrl}`;
  return `https://verses.quran.foundation/${rawUrl.replace(/^\/+/, "")}`;
}

function parseMorphologyLine(line) {
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

// Fetch all paginated verses for a chapter
async function fetchAllVersesForChapter(surahId, query) {
  const all = [];
  let page = 1;
  while (true) {
    const data = await fetchJson(
      `https://api.quran.com/api/v4/verses/by_chapter/${surahId}?${query}&per_page=50&page=${page}`
    );
    all.push(...(data.verses ?? []));
    if (!data.pagination?.next_page) break;
    page = data.pagination.next_page;
  }
  return all;
}

async function fetchAllAudioForChapter(reciterId, surahId) {
  const all = [];
  let page = 1;
  while (true) {
    const data = await fetchJson(
      `https://api.quran.com/api/v4/recitations/${reciterId}/by_chapter/${surahId}?per_page=50&page=${page}`
    );
    all.push(...(data.audio_files ?? []));
    if (!data.pagination?.next_page) break;
    page = data.pagination.next_page;
  }
  return all;
}

async function main() {
  await fs.mkdir(CANONICAL_DIR, { recursive: true });
  const targetSet = new Set(TARGET_SURAHS);

  console.log("Fetching chapters catalog, Tanzil Uthmani reference, and Quran Morphology...");
  const [chaptersRes, tanzilRaw, morphologyRaw] = await Promise.all([
    fetchJson("https://api.quran.com/api/v4/chapters?language=tr"),
    fetchText(
      "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true"
    ),
    fetchText(
      "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt"
    ),
  ]);

  const chapterMap = new Map();
  for (const ch of chaptersRes.chapters ?? []) {
    chapterMap.set(ch.id, ch);
  }

  // Parse Tanzil reference for target surahs
  const tanzilMap = new Map();
  for (const line of tanzilRaw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [sStr, aStr, text] = line.split("|");
    const s = Number(sStr);
    if (targetSet.has(s) && aStr && text) {
      tanzilMap.set(`${s}:${aStr}`, text.trim());
    }
  }

  // Parse morphology for target surahs
  const morphByWord = new Map();
  for (const line of morphologyRaw.split(/\r?\n/)) {
    if (!line) continue;
    const colonIdx = line.indexOf(":");
    if (colonIdx === -1) continue;
    const surahId = Number(line.slice(0, colonIdx));
    if (!targetSet.has(surahId)) continue;
    const parsed = parseMorphologyLine(line);
    if (!parsed) continue;
    const existing = morphByWord.get(parsed.wordLocation) ?? [];
    existing.push(parsed);
    morphByWord.set(parsed.wordLocation, existing);
  }

  const surahsOut = [];
  let totalVerses = 0;
  let totalWords = 0;

  for (const surahId of TARGET_SURAHS) {
    const ch = chapterMap.get(surahId);
    if (!ch) throw new Error(`Missing chapter metadata for ${surahId}`);

    const [
      versesTr,
      versesElmalili,
      alafasyAyahs,
      husaryAyahs,
      alafasySegmentsRes,
    ] = await Promise.all([
      fetchAllVersesForChapter(
        surahId,
        "language=tr&words=true&word_fields=text_uthmani,text_imlaei,page_number,line_number,location&translations=77"
      ),
      fetchAllVersesForChapter(surahId, "language=tr&translations=52"),
      fetchAllAudioForChapter(7, surahId),
      fetchAllAudioForChapter(12, surahId),
      fetchJson(`https://api.quran.com/api/v4/chapter_recitations/7/${surahId}?segments=true`),
    ]);

    if (versesTr.length !== ch.verses_count) {
      throw new Error(
        `Surah ${surahId} verse count mismatch: expected ${ch.verses_count}, got ${versesTr.length}`
      );
    }

    const elmaliliByKey = new Map();
    for (const v of versesElmalili) {
      elmaliliByKey.set(v.verse_key, v.translations?.[0]?.text ?? "");
    }

    const alafasyAudioByKey = new Map();
    for (const f of alafasyAyahs) {
      alafasyAudioByKey.set(f.verse_key, normalizeAudioUrl(f.url));
    }

    const husaryAudioByKey = new Map();
    for (const f of husaryAyahs) {
      husaryAudioByKey.set(f.verse_key, normalizeAudioUrl(f.url));
    }

    const segmentByKey = new Map();
    for (const ts of alafasySegmentsRes.audio_file?.timestamps ?? []) {
      segmentByKey.set(ts.verse_key, {
        timestampFromMs: ts.timestamp_from,
        timestampToMs: ts.timestamp_to,
        durationMs: ts.duration,
        segments: (ts.segments ?? []).filter(
          (seg) => Array.isArray(seg) && seg.length === 3
        ),
      });
    }

    const verses = versesTr.map((v) => {
      const wordTokens = v.words.filter((w) => w.char_type_name === "word");
      const textUthmani = wordTokens.map((w) => w.text_uthmani).join(" ");
      const textImlaei = wordTokens.map((w) => w.text_imlaei).join(" ");
      const tanzilText = tanzilMap.get(v.verse_key);
      if (!tanzilText) {
        throw new Error(`Missing Tanzil reference for ${v.verse_key}`);
      }
      if (!textUthmani.trim() || !tanzilText.trim()) {
        throw new Error(`Empty Arabic text for ${v.verse_key}`);
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

      totalWords += words.length;
      return {
        id: v.id,
        surahId,
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

    totalVerses += verses.length;
    surahsOut.push({
      surah: {
        id: ch.id,
        nameArabic: ch.name_arabic,
        nameSimple: ch.name_simple,
        nameTurkish: ch.translated_name?.name ?? ch.name_simple,
        revelationPlace: ch.revelation_place,
        revelationOrder: ch.revelation_order,
        versesCount: ch.verses_count,
        pages: ch.pages,
        bismillahPre: ch.bismillah_pre,
      },
      chapterRecitations: {
        alafasyChapterAudioUrl: alafasySegmentsRes.audio_file?.audio_url ?? null,
      },
      verses,
    });
    console.log(`  ✓ Surah ${surahId} (${ch.translated_name?.name}): ${verses.length} verses`);
  }

  const starterPayload = {
    edition: {
      slug: "madinah-1405-uthmani",
      name: "Medine Mushafı (1405H / 604 Sayfa — Hafs an Asım)",
      scriptType: "uthmani",
      totalPages: 604,
    },
    includedPages: [1, ...Array.from({ length: 23 }, (_, i) => 582 + i)],
    surahs: surahsOut,
  };

  // Write canonical fatiha.json as well as full starter-collection.json (Fatiha + Juz Amma)
  const fatihaEntry = surahsOut.find((s) => s.surah.id === 1);
  if (fatihaEntry) {
    const fatihaPayload = {
      edition: starterPayload.edition,
      surah: fatihaEntry.surah,
      chapterRecitations: fatihaEntry.chapterRecitations,
      verses: fatihaEntry.verses,
    };
    await fs.writeFile(
      path.join(CANONICAL_DIR, "surah-1-fatiha.json"),
      JSON.stringify(fatihaPayload, null, 2),
      "utf8"
    );
  }

  const starterJson = JSON.stringify(starterPayload);
  const starterOutPath = path.join(CANONICAL_DIR, "fatiha-and-juz-amma.json");
  await fs.writeFile(starterOutPath, starterJson, "utf8");

  const fatihaJson = await fs.readFile(path.join(CANONICAL_DIR, "surah-1-fatiha.json"), "utf8");
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
        license:
          "Public API access with source & translator attribution; Quran Foundation OAuth2 recommended for full-scale production",
        attribution:
          "Quran.com API v4 / Quran Foundation; Diyanet İşleri Başkanlığı Meali; Elmalılı M. Hamdi Yazır Meali; Mishary Rashid al-Afasy; Mahmoud Khalil al-Husary (Muallim).",
        retrievedAt: new Date().toISOString(),
        version: "v4",
        usageRestrictions:
          "Preserve Quran text verbatim; add translate='no' on Arabic text containers.",
      },
      {
        id: "quran-arabic-corpus-morphology",
        provider:
          "Quranic Arabic Corpus v0.4 (University of Leeds) via mustafa0x/quran-morphology",
        resource:
          "Word-by-word Arabic morphological segments, POS tags, lemmas, and trilateral roots",
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
        versesCount: fatihaEntry?.verses.length ?? 0,
        wordsCount:
          fatihaEntry?.verses.reduce((acc, v) => acc + v.words.length, 0) ?? 0,
      },
      "fatiha-and-juz-amma": {
        path: "src/data/canonical/fatiha-and-juz-amma.json",
        sha256: sha256(starterJson),
        surahsCount: surahsOut.length,
        pagesCount: starterPayload.includedPages.length,
        versesCount: totalVerses,
        wordsCount: totalWords,
      },
    },
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");
  console.log(
    `Verified collection written: ${surahsOut.length} surahs, ${starterPayload.includedPages.length} pages, ${totalVerses} verses, ${totalWords} words.`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
