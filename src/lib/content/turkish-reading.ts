/**
 * Turns the corpus' scholarly Latin transliteration ("wayuqīmūna", "l-raḥmāni") into the
 * Turkish Latin reading Turkish learners know from Diyanet-style texts ("ve yukîmûne",
 * "er-rahmâni"). Rule based, so it is an aid for reading, not a tajweed authority.
 */

const SUN_LETTERS = new Set(["t", "th", "d", "dh", "r", "z", "s", "sh", "ṣ", "ḍ", "ṭ", "ẓ", "l", "n"]);
/** Consonants that make the neighbouring short vowel "thick" (a / u / ı instead of e / ü / i). */
const THICK_ONSET = new Set(["q", "ṣ", "ḍ", "ṭ", "ẓ", "kh", "gh", "ḥ", "ʿ", "r"]);
const THICK_CODA = new Set(["q", "ṣ", "ḍ", "ṭ", "ẓ", "kh", "gh", "ʿ"]);

const CONSONANT_TR: Record<string, string> = {
  sh: "ş",
  th: "s",
  dh: "z",
  kh: "h",
  gh: "ğ",
  j: "c",
  w: "v",
  q: "k",
  ḥ: "h",
  ṣ: "s",
  ḍ: "d",
  ṭ: "t",
  ẓ: "z",
  ʿ: "'",
};

const UNIT_RE = /sh|th|dh|kh|gh|[a-zāīūʿḍḥṣṭẓ']/g;
const VOWELS = new Set(["a", "i", "u", "e", "o", "ā", "ī", "ū"]);

function convertPart(part: string): string {
  const units = part.match(UNIT_RE) ?? [];
  let out = "";
  for (let i = 0; i < units.length; i++) {
    const u = units[i];
    if (u === "'") continue; // sukun marker in the source ("bis'mi")
    if (!VOWELS.has(u)) {
      if (u === "ʿ" && (i === 0 || i === units.length - 1)) continue;
      out += CONSONANT_TR[u] ?? u;
      continue;
    }
    if (u === "ā") { out += "â"; continue; }
    if (u === "ī") { out += "î"; continue; }
    if (u === "ū") { out += "û"; continue; }
    if (u === "e" || u === "o") { out += u; continue; }

    const prev = i > 0 ? units[i - 1] : null;
    const next = units[i + 1];
    const nextIsCoda = next !== undefined && !VOWELS.has(next) && (units[i + 2] === undefined || !VOWELS.has(units[i + 2]!));
    // Ra with kasra is thin (ğayri, rîh), so ra only thickens a and u.
    const thick =
      (prev !== null && THICK_ONSET.has(prev) && !(u === "i" && prev === "r")) ||
      (next !== undefined && THICK_CODA.has(next) && (nextIsCoda || next === "ʿ" || THICK_ONSET.has(next)));
    if (u === "a") out += thick ? "a" : "e";
    else if (u === "u") out += thick ? "u" : "ü";
    else out += thick ? "ı" : "i";
  }
  return out;
}

export function toTurkishReading(transliteration: string | null | undefined): string | null {
  if (!transliteration) return null;
  let s = transliteration.toLowerCase().trim();
  if (!s) return null;

  // The name of Allah: thick lam and long a ("allâhi", "lillâhi").
  s = s.replace(/^a?l-lāh|^a?l-lah/, "allāh").replace(/llah/g, "llāh");

  let prefix = "";
  const article = s.match(/^a?l-(sh|th|dh|kh|gh|[a-zāīūʿḍḥṣṭẓ])/);
  if (article) {
    const first = article[1];
    prefix = SUN_LETTERS.has(first) ? `e${CONSONANT_TR[first] ?? first}-` : "el-";
    s = s.slice(article[0].length - first.length);
  }

  // "bil-ghaybi", "wal-qur'āni": a mid-word article stays attached with a hyphen.
  const parts = s.split("-");
  let body = "";
  parts.forEach((part, i) => {
    const converted = convertPart(part);
    if (!converted) return;
    if (i === 0) body = converted;
    else body += parts[i - 1].endsWith("l") ? `-${converted}` : ` ${converted}`;
  });
  const result = prefix + body;
  // A leading "va"/"fe" particle reads as its own word in Turkish texts ("ve yukîmûne").
  return result
    .replace(/llâhü/g, "llâhu")
    .replace(/^ellâh/, "allâh")
    .replace(/^ve(?=[^\s'])(?!e|l-)/, "ve ")
    .replace(/\s+/g, " ")
    .trim();
}
