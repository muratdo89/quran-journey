import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const fatihaPath = path.join(process.cwd(), "src", "data", "canonical", "surah-1-fatiha.json");
const collectionPath = path.join(
  process.cwd(),
  "src",
  "data",
  "canonical",
  "fatiha-and-juz-amma.json"
);
const manifestPath = path.join(process.cwd(), "src", "data", "manifest.json");

const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));

function assert(condition, message) {
  if (!condition) {
    console.error(`Content verification FAILED: ${message}`);
    process.exit(1);
  }
}

// 1. Verify Surah Al-Fatiha canonical dataset
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

// 2. Verify Fatiha + Juz Amma canonical collection dataset
const rawCollection = fs.readFileSync(collectionPath, "utf8");
const collectionSha = crypto.createHash("sha256").update(rawCollection, "utf8").digest("hex");
const expectedCollectionSha = manifest.datasets["fatiha-and-juz-amma"]?.sha256;
assert(
  collectionSha === expectedCollectionSha,
  `fatiha-and-juz-amma.json SHA-256 mismatch: expected ${expectedCollectionSha}, got ${collectionSha}`
);

const collection = JSON.parse(rawCollection);
const expectedSurahIds = [1, ...Array.from({ length: 37 }, (_, i) => 78 + i)];
const expectedPages = [1, ...Array.from({ length: 23 }, (_, i) => 582 + i)];

assert(
  collection.surahs?.length === 38,
  `Expected 38 surahs, got ${collection.surahs?.length}`
);
assert(
  JSON.stringify(collection.surahs.map((s) => s.surah.id)) === JSON.stringify(expectedSurahIds),
  "Collection surah IDs do not match [1, 78..114]"
);
assert(
  collection.includedPages?.length === 24 &&
    JSON.stringify(collection.includedPages) === JSON.stringify(expectedPages),
  "Collection includedPages do not match [1, 582..604]"
);

const pageSet = new Set(collection.includedPages);
let totalVerses = 0;
let totalWords = 0;

for (const entry of collection.surahs) {
  assert(
    entry.verses.length === entry.surah.versesCount,
    `Surah ${entry.surah.id} verse count mismatch: expected ${entry.surah.versesCount}, got ${entry.verses.length}`
  );

  for (const verse of entry.verses) {
    totalVerses += 1;
    const verseSha = crypto
      .createHash("sha256")
      .update(verse.textUthmani, "utf8")
      .digest("hex");
    assert(
      verseSha === verse.textUthmaniSha256,
      `Verse ${verse.verseKey} textUthmaniSha256 mismatch`
    );
    assert(
      verse.textUthmani.trim().length > 0 && verse.textUthmaniTanzil.trim().length > 0,
      `Empty Arabic text in verse ${verse.verseKey}`
    );
    assert(
      pageSet.has(verse.pageNumber),
      `Verse ${verse.verseKey} mapped to unexpected page ${verse.pageNumber}`
    );

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

    verse.words.forEach((word, idx) => {
      totalWords += 1;
      assert(
        word.position === idx + 1,
        `Word position gap in ${verse.verseKey}: expected ${idx + 1}, got ${word.position}`
      );
      assert(
        word.location === `${entry.surah.id}:${verse.verseNumber}:${idx + 1}`,
        `Word location mismatch: ${word.location}`
      );
      assert(
        word.translationTr && word.translationTr.trim().length > 0,
        `Empty word translation at ${word.location}`
      );
      assert(
        typeof word.audioUrl === "string" &&
          /^https:\/\/audio\.qurancdn\.com\/wbw\/.+\.mp3$/.test(word.audioUrl),
        `Invalid audio URL at ${word.location}: ${word.audioUrl}`
      );
    });
  }
}

assert(totalVerses === 571, `Expected 571 total verses, got ${totalVerses}`);
assert(totalWords === 2337, `Expected 2337 total words, got ${totalWords}`);

console.log(
  `Content verification PASSED: surah-1-fatiha (7 verses, 29 words, SHA-256 ${fatihaSha.slice(0, 12)}...) & fatiha-and-juz-amma (${collection.surahs.length} surahs, ${collection.includedPages.length} pages, ${totalVerses} verses, ${totalWords} words, SHA-256 ${collectionSha.slice(0, 12)}...)`
);
