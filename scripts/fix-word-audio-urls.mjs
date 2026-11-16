#!/usr/bin/env node
/**
 * Rewrites every word's audioUrl from its location (surah:verse:position).
 *
 * Quran.com's API returns wbw audio_url values numbered as if pause marks (ۛ ۖ ۗ ...) were
 * separate words, e.g. 2:2:6 هُدًى -> 002_002_008.mp3. The CDN files are numbered by the
 * real word position (002_002_006.mp3), so ~36% of words pointed at the wrong word or at a
 * file that does not exist (404 -> "Kelime sesi yüklenemedi").
 */
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const canonicalDir = path.join(process.cwd(), "src", "data", "canonical");
const surahsDir = path.join(canonicalDir, "surahs");

export function wordAudioUrl(location) {
  const [s, v, p] = location.split(":").map((n) => String(n).padStart(3, "0"));
  return `https://audio.qurancdn.com/wbw/${s}_${v}_${p}.mp3`;
}

function fixEntry(entry) {
  let changed = 0;
  for (const verse of entry.verses) {
    for (const word of verse.words) {
      const url = wordAudioUrl(word.location);
      if (word.audioUrl !== url) {
        word.audioUrl = url;
        changed += 1;
      }
    }
  }
  return changed;
}

let total = 0;
for (const file of fs.readdirSync(surahsDir).filter((f) => f.endsWith(".json.gz")).sort()) {
  const filePath = path.join(surahsDir, file);
  const entry = JSON.parse(zlib.gunzipSync(fs.readFileSync(filePath)).toString("utf8"));
  const changed = fixEntry(entry);
  if (changed > 0) {
    fs.writeFileSync(filePath, zlib.gzipSync(JSON.stringify(entry), { level: 9 }));
    total += changed;
  }
}

const fatihaPath = path.join(canonicalDir, "surah-1-fatiha.json");
if (fs.existsSync(fatihaPath)) {
  const entry = JSON.parse(fs.readFileSync(fatihaPath, "utf8"));
  const changed = fixEntry(entry);
  if (changed > 0) {
    fs.writeFileSync(fatihaPath, JSON.stringify(entry, null, 2) + "\n");
    total += changed;
  }
}

// Keep the integrity manifest in step with the rewritten files.
const manifestPath = path.join(process.cwd(), "src", "data", "manifest.json");
const manifest = JSON.parse(fs.readFileSync(manifestPath, "utf8"));
for (const file of Object.keys(manifest.surahChecksums ?? {})) {
  const buf = fs.readFileSync(path.join(surahsDir, file));
  manifest.surahChecksums[file] = crypto.createHash("sha256").update(buf).digest("hex");
}
if (fs.existsSync(fatihaPath) && manifest.datasets?.["surah-1-fatiha"]) {
  manifest.datasets["surah-1-fatiha"].sha256 = crypto
    .createHash("sha256")
    .update(fs.readFileSync(fatihaPath, "utf8"), "utf8")
    .digest("hex");
}
fs.writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));

console.log(`Fixed ${total} word audio URLs.`);
