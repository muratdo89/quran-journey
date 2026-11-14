import crypto from "node:crypto";
import fs from "node:fs/promises";
import path from "node:path";
import zlib from "node:zlib";

const ROOT_DIR = process.cwd();
const CANONICAL_DIR = path.join(ROOT_DIR, "src", "data", "canonical");
const SURAHS_DIR = path.join(CANONICAL_DIR, "surahs");
const MANIFEST_PATH = path.join(ROOT_DIR, "src", "data", "manifest.json");

function sha256(bufOrStr) {
  return crypto.createHash("sha256").update(bufOrStr).digest("hex");
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function fetchWithRetry(url, asText = false, retries = 5) {
  let lastErr;
  for (let attempt = 1; attempt <= retries; attempt += 1) {
    try {
      const res = await fetch(url, {
        headers: { "User-Agent": "QuranJourney-FullMushafVerifier/3.0" },
      });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status} fetching ${url}`);
      }
      return asText ? await res.text() : await res.json();
    } catch (err) {
      lastErr = err;
      await sleep(300 * attempt);
    }
  }
  throw lastErr;
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

function normalizeArabicTokens(text) {
  const cleaned = text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\u0640/g, "")
    .trim();
  return cleaned.split(/\s+/).filter(Boolean);
}

async function fetchAllVersesForChapter(surahId, query) {
  const all = [];
  let page = 1;
  while (true) {
    const data = await fetchWithRetry(
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
    const data = await fetchWithRetry(
      `https://api.quran.com/api/v4/recitations/${reciterId}/by_chapter/${surahId}?per_page=50&page=${page}`
    );
    all.push(...(data.audio_files ?? []));
    if (!data.pagination?.next_page) break;
    page = data.pagination.next_page;
  }
  return all;
}

async function buildSurahEntry(surahId, chapterMap, tanzilMap, morphByWord) {
  const ch = chapterMap.get(surahId);
  if (!ch) throw new Error(`Missing chapter metadata for ${surahId}`);

  const [versesTr, versesElmalili, alafasyAudio, husaryAudio, alafasySegmentsRes] =
    await Promise.all([
      fetchAllVersesForChapter(
        surahId,
        "language=tr&words=true&word_fields=text_uthmani,text_imlaei,page_number,line_number,location&translations=77"
      ),
      fetchAllVersesForChapter(surahId, "language=tr&translations=52"),
      fetchAllAudioForChapter(7, surahId),
      fetchAllAudioForChapter(12, surahId),
      fetchWithRetry(`https://api.quran.com/api/v4/chapter_recitations/7/${surahId}?segments=true`),
    ]);

  const elmaliliByKey = new Map();
  for (const v of versesElmalili) {
    elmaliliByKey.set(v.verse_key, v.translations?.[0]?.text ?? "");
  }

  const alafasyAudioByKey = new Map();
  for (const af of alafasyAudio) {
    alafasyAudioByKey.set(af.verse_key, normalizeAudioUrl(af.url));
  }

  const husaryAudioByKey = new Map();
  for (const af of husaryAudio) {
    husaryAudioByKey.set(af.verse_key, normalizeAudioUrl(af.url));
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

  const verses = versesTr.map((v) => {
    const wordTokens = v.words.filter((w) => w.char_type_name === "word");
    const textUthmani = wordTokens.map((w) => w.text_uthmani).join(" ");
    const textImlaei = wordTokens.map((w) => w.text_imlaei).join(" ");
    const tanzilText = tanzilMap.get(v.verse_key);
    if (!tanzilText) throw new Error(`Missing Tanzil reference for ${v.verse_key}`);
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

  return {
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
      alafasyChapterAudioUrl: normalizeAudioUrl(alafasySegmentsRes.audio_file?.audio_url ?? null),
    },
    verses,
  };
}

async function main() {
  await fs.mkdir(CANONICAL_DIR, { recursive: true });
  await fs.mkdir(SURAHS_DIR, { recursive: true });

  console.log("Fetching 114-chapter catalog, Tanzil Uthmani (6236 ayahs), and Quran Morphology...");
  const [chaptersRes, tanzilRaw, morphologyRaw] = await Promise.all([
    fetchWithRetry("https://api.quran.com/api/v4/chapters?language=tr"),
    fetchWithRetry(
      "https://tanzil.net/pub/download/index.php?quranType=uthmani&outType=txt-2&agree=true",
      true
    ),
    fetchWithRetry(
      "https://raw.githubusercontent.com/mustafa0x/quran-morphology/master/quran-morphology.txt",
      true
    ),
  ]);

  const chapterMap = new Map();
  for (const ch of chaptersRes.chapters ?? []) {
    chapterMap.set(ch.id, ch);
  }
  if (chapterMap.size !== 114) {
    throw new Error(`Expected 114 chapters, got ${chapterMap.size}`);
  }

  const tanzilMap = new Map();
  for (const line of tanzilRaw.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const [sStr, aStr, text] = line.split("|");
    if (sStr && aStr && text) {
      tanzilMap.set(`${Number(sStr)}:${Number(aStr)}`, text.trim());
    }
  }
  if (tanzilMap.size !== 6236) {
    throw new Error(`Expected 6236 Tanzil verses, got ${tanzilMap.size}`);
  }

  const morphByWord = new Map();
  for (const line of morphologyRaw.split(/\r?\n/)) {
    if (!line.trim()) continue;
    const parsed = parseMorphologyLine(line);
    if (!parsed) continue;
    const existing = morphByWord.get(parsed.wordLocation) ?? [];
    existing.push(parsed);
    morphByWord.set(parsed.wordLocation, existing);
  }

  console.log("Fetching all 114 Surahs (with concurrency=4)...");
  const entries = new Array(114);
  const CONCURRENCY = 4;
  for (let start = 1; start <= 114; start += CONCURRENCY) {
    const batch = [];
    for (let s = start; s < start + CONCURRENCY && s <= 114; s += 1) {
      batch.push(
        buildSurahEntry(s, chapterMap, tanzilMap, morphByWord).then((entry) => {
          entries[s - 1] = entry;
          process.stdout.write(`  ✓ ${s}:${entry.surah.nameSimple} (${entry.verses.length} ayet)\n`);
        })
      );
    }
    await Promise.all(batch);
  }

  const edition = {
    slug: "madinah-1405-uthmani",
    name: "Medine Mushafı (1405H / 604 Sayfa — Hafs an Asım)",
    scriptType: "uthmani",
    totalPages: 604,
  };

  // Write individual gzipped surah files + collect indexes
  const surahChecksums = {};
  const pageSurahs = {};
  const pageJuzHizb = {};
  const verseRows = [];
  const rootAgg = new Map(); // root -> { count, surahSet, sampleWords[] }
  const tokenDocs = []; // for mutashabihat calculation
  let totalVerses = 0;
  let totalWords = 0;
  let missingWordGlossCount = 0;
  let missingWordAudioCount = 0;
  let missingHusaryCount = 0;

  for (const entry of entries) {
    const padded = String(entry.surah.id).padStart(3, "0");
    const gz = zlib.gzipSync(JSON.stringify(entry), { level: 9 });
    const fileName = `surah-${padded}.json.gz`;
    await fs.writeFile(path.join(SURAHS_DIR, fileName), gz);
    surahChecksums[fileName] = sha256(gz);

    for (const v of entry.verses) {
      totalVerses += 1;
      if (!v.audio.husaryMuallimAyahUrl) missingHusaryCount += 1;

      const pKey = String(v.pageNumber);
      if (!pageSurahs[pKey]) pageSurahs[pKey] = [];
      if (!pageSurahs[pKey].includes(entry.surah.id)) {
        pageSurahs[pKey].push(entry.surah.id);
      }
      if (!pageJuzHizb[pKey]) {
        pageJuzHizb[pKey] = [v.juzNumber, v.hizbNumber];
      }

      const trDiyanet = v.translations.find((t) => t.resourceId === 77)?.text ?? "";
      const trElmalili = v.translations.find((t) => t.resourceId === 52)?.text ?? "";
      verseRows.push([v.verseKey, v.pageNumber, v.textUthmani, v.textImlaei, trDiyanet, trElmalili]);

      const normTokens = normalizeArabicTokens(v.textImlaei);
      tokenDocs.push({
        verseKey: v.verseKey,
        pageNumber: v.pageNumber,
        textUthmani: v.textUthmani,
        tokens: normTokens,
      });

      for (const w of v.words) {
        totalWords += 1;
        if (!w.translationTr || !w.translationTr.trim()) missingWordGlossCount += 1;
        if (!w.audioUrl) missingWordAudioCount += 1;

        const root = w.morphology.rootArabic;
        if (root) {
          let agg = rootAgg.get(root);
          if (!agg) {
            agg = {
              root,
              count: 0,
              surahSet: new Set(),
              seenSampleForms: new Set(),
              samples: [],
            };
            rootAgg.set(root, agg);
          }
          agg.count += 1;
          agg.surahSet.add(entry.surah.id);
          // Collect up to 24 representative occurrences across diverse Surahs/word forms
          const sampleSig = `${entry.surah.id}:${w.textImlaei}`;
          if (agg.samples.length < 24 && !agg.seenSampleForms.has(sampleSig)) {
            agg.seenSampleForms.add(sampleSig);
            agg.samples.push({
              location: w.location,
              verseKey: v.verseKey,
              textUthmani: w.textUthmani,
              translationTr: w.translationTr,
              pageNumber: w.pageNumber,
            });
          }
        }
      }
    }
  }

  // Verify all 604 pages mapped
  const pageCount = Object.keys(pageSurahs).length;
  if (pageCount !== 604) {
    throw new Error(`Expected 604 Mushaf pages, got ${pageCount}`);
  }

  // Compute Mutashabihat (similar verses) across all 6236 verses via bigram inverted index
  console.log("Computing Mutashabihat (similar verses) index across all 6,236 verses...");
  const bigramIndex = new Map();
  const docBigrams = tokenDocs.map((doc, idx) => {
    const bgs = new Set();
    for (let i = 0; i < doc.tokens.length - 1; i += 1) {
      const bg = `${doc.tokens[i]} ${doc.tokens[i + 1]}`;
      bgs.add(bg);
      let list = bigramIndex.get(bg);
      if (!list) {
        list = [];
        bigramIndex.set(bg, list);
      }
      list.push(idx);
    }
    return bgs;
  });

  const mutashabihat = {};
  for (let i = 0; i < tokenDocs.length; i += 1) {
    const docA = tokenDocs[i];
    if (docA.tokens.length < 4) continue;
    const bgsA = docBigrams[i];
    const candidateHits = new Map();
    for (const bg of bgsA) {
      const posting = bigramIndex.get(bg);
      if (!posting || posting.length > 60) continue; // skip boilerplate like 'إن الله'
      for (const j of posting) {
        if (j === i) continue;
        candidateHits.set(j, (candidateHits.get(j) ?? 0) + 1);
      }
    }

    const matches = [];
    for (const [j, sharedBg] of candidateHits.entries()) {
      if (sharedBg < 2) continue;
      const docB = tokenDocs[j];
      if (docB.tokens.length < 4) continue;
      const bgsB = docBigrams[j];
      const setA = new Set(docA.tokens);
      const setB = new Set(docB.tokens);
      let intersection = 0;
      for (const t of setA) if (setB.has(t)) intersection += 1;
      const dice = (2 * intersection) / (setA.size + setB.size);
      const bgSim = (2 * sharedBg) / (bgsA.size + bgsB.size);
      const score = Math.round(((dice + bgSim) / 2) * 100);
      if (score >= 48) {
        matches.push({
          targetKey: docB.verseKey,
          similarity: score,
          targetPage: docB.pageNumber,
          textUthmani: docB.textUthmani,
        });
      }
    }
    if (matches.length > 0) {
      matches.sort((a, b) => b.similarity - a.similarity);
      mutashabihat[docA.verseKey] = matches.slice(0, 4);
    }
  }

  const roots = Array.from(rootAgg.values())
    .map((agg) => ({
      root: agg.root,
      count: agg.count,
      surahsCount: agg.surahSet.size,
      samples: agg.samples,
    }))
    .sort((a, b) => b.count - a.count);

  const metaPayload = {
    edition,
    totalPages: 604,
    totalSurahs: entries.length,
    totalVerses,
    totalWords,
    surahs: entries.map((e) => e.surah),
    pageSurahs,
    pageJuzHizb,
  };
  const metaJson = JSON.stringify(metaPayload);
  await fs.writeFile(path.join(CANONICAL_DIR, "quran-meta.json"), metaJson, "utf8");

  const lexiconPayload = {
    verses: verseRows,
    roots,
    mutashabihat,
  };
  const lexiconGz = zlib.gzipSync(JSON.stringify(lexiconPayload), { level: 9 });
  await fs.writeFile(path.join(CANONICAL_DIR, "lexicon-index.json.gz"), lexiconGz);

  // Refresh surah-1-fatiha.json cleanly too
  const fatihaPayload = {
    edition,
    surah: entries[0].surah,
    chapterRecitations: entries[0].chapterRecitations,
    verses: entries[0].verses,
  };
  const fatihaJsonStr = JSON.stringify(fatihaPayload, null, 2);
  await fs.writeFile(path.join(CANONICAL_DIR, "surah-1-fatiha.json"), fatihaJsonStr, "utf8");

  // Read existing fatiha-and-juz-amma.json sha if preserved, or keep manifest clean
  const existingManifest = JSON.parse(await fs.readFile(MANIFEST_PATH, "utf8"));
  const juzAmmaDatasetEntry = existingManifest.datasets?.["fatiha-and-juz-amma"];

  const manifest = {
    generatedAt: new Date().toISOString(),
    sources: existingManifest.sources,
    datasets: {
      "surah-1-fatiha": {
        path: "src/data/canonical/surah-1-fatiha.json",
        sha256: sha256(fatihaJsonStr),
        versesCount: entries[0].verses.length,
        wordsCount: entries[0].verses.reduce((a, v) => a + v.words.length, 0),
      },
      ...(juzAmmaDatasetEntry ? { "fatiha-and-juz-amma": juzAmmaDatasetEntry } : {}),
      "quran-meta": {
        path: "src/data/canonical/quran-meta.json",
        sha256: sha256(metaJson),
        surahsCount: entries.length,
        pagesCount: pageCount,
        versesCount: totalVerses,
        wordsCount: totalWords,
      },
      "lexicon-index": {
        path: "src/data/canonical/lexicon-index.json.gz",
        sha256: sha256(lexiconGz),
        rootsCount: roots.length,
        mutashabihatVersesCount: Object.keys(mutashabihat).length,
        versesCount: totalVerses,
        wordsCount: totalWords,
      },
    },
    surahChecksums,
  };

  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf8");

  console.log(
    `\nFull Quran dataset DONE:\n` +
      `  Surahs: ${entries.length}, Pages: ${pageCount}, Verses: ${totalVerses}, Words: ${totalWords}\n` +
      `  Roots: ${roots.length}, Mutashabihat verses: ${Object.keys(mutashabihat).length}\n` +
      `  Anomalies check -> emptyWordGloss=${missingWordGlossCount}, missingWordAudio=${missingWordAudioCount}, missingHusaryAyah=${missingHusaryCount}\n` +
      `  lexicon-index.json.gz=${(lexiconGz.length / 1024).toFixed(1)} KB`
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
