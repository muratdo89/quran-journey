import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const canonicalDir = path.join(process.cwd(), "src", "data", "canonical");
const fatihaPath = path.join(canonicalDir, "surah-1-fatiha.json");
const quranMetaPath = path.join(canonicalDir, "quran-meta.json");
const lexiconPath = path.join(canonicalDir, "lexicon-index.json.gz");
const surahsDir = path.join(canonicalDir, "surahs");
const manifestPath = path.join(process.cwd(), "src", "data", "manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function assert(condition, message) {
  if (!condition) {
    console.error(`Content verification FAILED: ${message}`);
    process.exit(1);
  }
}

// 1. Verify Surah Al-Fatiha canonical fixture
const rawFatiha = fs.readFileSync(fatihaPath, "utf8");
const fatihaSha = crypto.createHash("sha256").update(rawFatiha, "utf8").digest("hex");
const expectedFatihaSha = manifest.datasets["surah-1-fatiha"]?.sha256;
assert(
  fatihaSha === expectedFatihaSha,
  `surah-1-fatiha.json SHA-256 mismatch: expected ${expectedFatihaSha}, got ${fatihaSha}`
);

const fatiha = JSON.parse(rawFatiha);
assert(fatiha.surah?.id === 1, "Fatiha surah id must be 1");
assert(fatiha.verses?.length === 7, `Expected 7 Fatiha verses, got ${fatiha.verses?.length}`);

let fatihaWordCount = 0;
for (const verse of fatiha.verses) {
  const verseSha = crypto.createHash("sha256").update(verse.textUthmani, "utf8").digest("hex");
  assert(verseSha === verse.textUthmaniSha256, `Fatiha verse ${verse.verseKey} SHA-256 mismatch`);
  fatihaWordCount += verse.words.length;
}
assert(fatihaWordCount === 29, `Expected 29 Fatiha words, got ${fatihaWordCount}`);

// 2. Verify quran-meta.json (114 Surahs, 604 Madinah Mushaf pages)
const rawMeta = fs.readFileSync(quranMetaPath, "utf8");
const metaSha = crypto.createHash("sha256").update(rawMeta, "utf8").digest("hex");
const expectedMetaSha = manifest.datasets["quran-meta"]?.sha256;
assert(
  metaSha === expectedMetaSha,
  `quran-meta.json SHA-256 mismatch: expected ${expectedMetaSha}, got ${metaSha}`
);

const quranMeta = JSON.parse(rawMeta);
assert(quranMeta.totalSurahs === 114, `Expected 114 surahs in meta, got ${quranMeta.totalSurahs}`);
assert(quranMeta.totalPages === 604, `Expected 604 pages in meta, got ${quranMeta.totalPages}`);
assert(quranMeta.totalVerses === 6236, `Expected 6236 verses in meta, got ${quranMeta.totalVerses}`);
assert(quranMeta.totalWords === 77429, `Expected 77429 words in meta, got ${quranMeta.totalWords}`);
assert(
  quranMeta.surahs?.length === 114 &&
    JSON.stringify(quranMeta.surahs.map((s) => s.id)) ===
      JSON.stringify(Array.from({ length: 114 }, (_, i) => i + 1)),
  "quran-meta surahs must cover 1..114 sequentially"
);
assert(
  Object.keys(quranMeta.pageSurahs ?? {}).length === 604 &&
    Object.keys(quranMeta.pageJuzHizb ?? {}).length === 604,
  "quran-meta pageSurahs and pageJuzHizb must map all 604 pages"
);

// 3. Verify lexicon-index.json.gz (6,236 verse index tuples, roots & mutashabihat)
const lexiconGz = fs.readFileSync(lexiconPath);
const lexiconSha = crypto.createHash("sha256").update(lexiconGz).digest("hex");
const expectedLexiconSha = manifest.datasets["lexicon-index"]?.sha256;
assert(
  lexiconSha === expectedLexiconSha,
  `lexicon-index.json.gz SHA-256 mismatch: expected ${expectedLexiconSha}, got ${lexiconSha}`
);

const lexiconIndex = JSON.parse(zlib.gunzipSync(lexiconGz).toString("utf8"));
assert(
  lexiconIndex.verses?.length === 6236,
  `Expected 6236 lexicon verse rows, got ${lexiconIndex.verses?.length}`
);
assert(
  lexiconIndex.roots?.length === 1651,
  `Expected 1651 lexicon roots, got ${lexiconIndex.roots?.length}`
);
assert(
  Object.keys(lexiconIndex.mutashabihat ?? {}).length >= 1000,
  `Expected >= 1000 mutashabihat entries, got ${Object.keys(lexiconIndex.mutashabihat ?? {}).length}`
);

// 4. Verify all 114 compressed Surah datasets
const surahChecksums = manifest.surahChecksums ?? {};
assert(
  Object.keys(surahChecksums).length === 114,
  `Expected 114 entries in manifest.surahChecksums, got ${Object.keys(surahChecksums).length}`
);

const seenPages = new Set();
const missingAudioLocations = [];
let totalVerses = 0;
let totalWords = 0;

for (let surahId = 1; surahId <= 114; surahId += 1) {
  const filename = `surah-${String(surahId).padStart(3, "0")}.json.gz`;
  const expectedGzSha = surahChecksums[filename];
  assert(Boolean(expectedGzSha), `Missing manifest checksum for ${filename}`);

  const gzBuf = fs.readFileSync(path.join(surahsDir, filename));
  const actualGzSha = crypto.createHash("sha256").update(gzBuf).digest("hex");
  assert(
    actualGzSha === expectedGzSha,
    `${filename} SHA-256 mismatch: expected ${expectedGzSha}, got ${actualGzSha}`
  );

  const entry = JSON.parse(zlib.gunzipSync(gzBuf).toString("utf8"));
  assert(entry.surah?.id === surahId, `${filename} surah.id mismatch: got ${entry.surah?.id}`);
  assert(
    entry.verses?.length === entry.surah.versesCount,
    `Surah ${surahId} verse count mismatch: expected ${entry.surah.versesCount}, got ${entry.verses?.length}`
  );

  for (const verse of entry.verses) {
    totalVerses += 1;
    const verseSha = crypto.createHash("sha256").update(verse.textUthmani, "utf8").digest("hex");
    assert(
      verseSha === verse.textUthmaniSha256,
      `Verse ${verse.verseKey} textUthmaniSha256 mismatch`
    );
    assert(
      verse.textUthmani.trim().length > 0 && verse.textUthmaniTanzil.trim().length > 0,
      `Empty Arabic text in verse ${verse.verseKey}`
    );
    assert(
      Number.isInteger(verse.pageNumber) && verse.pageNumber >= 1 && verse.pageNumber <= 604,
      `Verse ${verse.verseKey} mapped to out-of-range page ${verse.pageNumber}`
    );
    seenPages.add(verse.pageNumber);

    const diyanet = verse.translations.find((t) => t.resourceId === 77);
    const elmalili = verse.translations.find((t) => t.resourceId === 52);
    assert(
      diyanet && diyanet.text.trim().length > 0,
      `Missing Diyanet translation for ${verse.verseKey}`
    );
    assert(
      elmalili && elmalili.text.trim().length > 0,
      `Missing Elmalili translation for ${verse.verseKey}`
    );

    assert(
      typeof verse.audio?.alafasyAyahUrl === "string" &&
        /^https:\/\//.test(verse.audio.alafasyAyahUrl),
      `Missing Alafasy ayah URL at ${verse.verseKey}`
    );
    assert(
      typeof verse.audio?.husaryMuallimAyahUrl === "string" &&
        /^https:\/\//.test(verse.audio.husaryMuallimAyahUrl),
      `Missing Husary ayah URL at ${verse.verseKey}`
    );

    verse.words.forEach((word, idx) => {
      totalWords += 1;
      assert(
        word.position === idx + 1,
        `Word position gap in ${verse.verseKey}: expected ${idx + 1}, got ${word.position}`
      );
      assert(
        word.location === `${surahId}:${verse.verseNumber}:${idx + 1}`,
        `Word location mismatch: ${word.location}`
      );
      assert(
        word.translationTr && word.translationTr.trim().length > 0,
        `Empty word translation at ${word.location}`
      );
      if (word.audioUrl === null) {
        missingAudioLocations.push(word.location);
      } else {
        // CDN files are numbered by word position; Quran.com's audio_url counts pause marks
        // as words and points at missing/wrong files (fix: scripts/fix-word-audio-urls.mjs).
        const pad = (n) => String(n).padStart(3, "0");
        const expectedUrl = `https://audio.qurancdn.com/wbw/${pad(surahId)}_${pad(verse.verseNumber)}_${pad(idx + 1)}.mp3`;
        assert(
          word.audioUrl === expectedUrl,
          `Wrong word audio URL at ${word.location}: ${word.audioUrl} (expected ${expectedUrl})`
        );
      }
    });
  }
}

assert(seenPages.size === 604, `Expected all 604 Mushaf pages covered, got ${seenPages.size}`);
assert(totalVerses === 6236, `Expected 6236 total verses, got ${totalVerses}`);
assert(totalWords === 77429, `Expected 77429 total words, got ${totalWords}`);
assert(
  missingAudioLocations.length === 0,
  `Unexpected missing word audio locations: ${JSON.stringify(missingAudioLocations)}`
);

console.log(
  `Content verification PASSED: 114 surahs, ${seenPages.size} Mushaf pages, ${totalVerses} verses, ${totalWords} words, ${lexiconIndex.roots.length} roots, ${Object.keys(lexiconIndex.mutashabihat).length} mutashabihat entries (quran-meta SHA-256 ${metaSha.slice(0, 12)}...).`
);

