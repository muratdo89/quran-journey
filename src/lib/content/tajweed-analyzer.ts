/**
 * Deterministic colored Tajweed analyzer for the Quran.com / Tanzil Uthmani
 * encoding used in the canonical dataset (Hafs 'an 'Asim, wasl reading).
 *
 * The analyzer works letter by letter across a whole verse, so rules that
 * depend on the following word (sâkin nûn / tenvîn / sâkin mîm) are resolved
 * against the first pronounced letter of the next word. Verse-final words are
 * treated as a stop (waqf): tenvîn/nûn rules are not applied there, while
 * Kalkale Kübrâ and Med-di Ârız / Lîn are.
 *
 * Scope (honest limits): ra tafkhim/tarqiq, lâm-ı celâl, optional stops at
 * internal waqf signs and natural (tabii) madd are not colored.
 */

export type TajweedRuleCategory =
  | "qalqalah"
  | "ghunnah"
  | "madd"
  | "noon_meem_sakin"
  | "tafkhim";

export type TajweedRuleId =
  | "izhar"
  | "idgham_ghunnah"
  | "idgham_no_ghunnah"
  | "ikhfa"
  | "iqlab"
  | "izhar_shafawi"
  | "ikhfa_shafawi"
  | "idgham_shafawi"
  | "ghunnah"
  | "madd_muttasil"
  | "madd_munfasil"
  | "madd_lazim"
  | "madd_lazim_harfi"
  | "madd_arid"
  | "madd_lin"
  | "qalqalah_sughra"
  | "qalqalah_kubra"
  | "tafkhim";

export interface TajweedRuleMatch {
  category: TajweedRuleCategory;
  titleTr: string;
  shortLabelTr: string;
  colorHex: string;
  /** Lighter letter color for the dark reader theme. */
  colorHexDark: string;
  bgHex: string;
  descriptionTr: string;
}

export interface TajweedRuleDetail {
  id: TajweedRuleId;
  category: TajweedRuleCategory;
  titleTr: string;
  descriptionTr: string;
  /** false for rules that are explained but not colored (e.g. İzhâr). */
  highlighted: boolean;
}

export interface TajweedSegment {
  /** Exact slice of the original word text (segments concatenate back to it). */
  text: string;
  /** Color category for this letter, or null when it is read plainly. */
  category: TajweedRuleCategory | null;
  ruleIds: TajweedRuleId[];
}

export interface TajweedWordAnalysis {
  segments: TajweedSegment[];
  /** Unique rules found in this word, in reading order. */
  rules: TajweedRuleDetail[];
}

export const TAJWEED_LEGEND: readonly TajweedRuleMatch[] = [
  {
    category: "qalqalah",
    titleTr: "Kalkale (Vurgulu Sekme)",
    shortLabelTr: "Kalkale",
    colorHex: "#1d4ed8",
    colorHexDark: "#93b4fd",
    bgHex: "#eff6ff",
    descriptionTr:
      "ق ط ب ج د (Kutb-u Ced) harfleri sükûnlu olduğunda veya ayet sonunda durulduğunda hafif sekmeyle okunur.",
  },
  {
    category: "ghunnah",
    titleTr: "Gunne (Geniz Sesi)",
    shortLabelTr: "Gunne",
    colorHex: "#be185d",
    colorHexDark: "#f9a8d4",
    bgHex: "#fdf2f8",
    descriptionTr:
      "Şeddeli Nûn (نّ) ve Şeddeli Mîm (مّ) harflerinde ses yaklaşık 2 hareke genizden tutulur.",
  },
  {
    category: "madd",
    titleTr: "Med (Uzatma)",
    shortLabelTr: "Med",
    colorHex: "#b45309",
    colorHexDark: "#fcd34d",
    bgHex: "#fffbeb",
    descriptionTr:
      "Med işaretli (ٓ) yerler ile ayet sonu durağındaki medler: Muttasıl, Munfasıl, Lâzım, Ârız ve Lîn.",
  },
  {
    category: "noon_meem_sakin",
    titleTr: "Sâkin Nûn / Tenvîn / Mîm",
    shortLabelTr: "İhfâ · İdğâm · İklâb",
    colorHex: "#047857",
    colorHexDark: "#6ee7b7",
    bgHex: "#ecfdf5",
    descriptionTr:
      "Sâkin Nûn, tenvîn veya sâkin Mîm'den sonra gelen harfe göre İdğâm, İhfâ veya İklâb uygulanır (İzhâr renklendirilmez).",
  },
  {
    category: "tafkhim",
    titleTr: "Kalın Harf (İsti'lâ)",
    shortLabelTr: "Kalın Harf",
    colorHex: "#6d28d9",
    colorHexDark: "#c4b5fd",
    bgHex: "#f5f3ff",
    descriptionTr:
      "خ ص ض غ ط ق ظ harfleri dil kökü yukarı kaldırılarak dolgun ve kalın sesle okunur.",
  },
] as const;

const LEGEND_BY_CATEGORY = new Map<TajweedRuleCategory, TajweedRuleMatch>(
  TAJWEED_LEGEND.map((item) => [item.category, item])
);

export function getTajweedLegend(category: TajweedRuleCategory): TajweedRuleMatch {
  return LEGEND_BY_CATEGORY.get(category)!;
}

const RULES: Record<TajweedRuleId, Omit<TajweedRuleDetail, "id">> = {
  izhar: {
    category: "noon_meem_sakin",
    highlighted: false,
    titleTr: "İzhâr",
    descriptionTr:
      "Sâkin Nûn veya tenvînden sonra boğaz harflerinden biri (ء ه ع ح غ خ) geldiği için nûn açıkça ve gunnesiz okunur.",
  },
  idgham_ghunnah: {
    category: "noon_meem_sakin",
    highlighted: true,
    titleTr: "İdğâm-ı Meal Gunne",
    descriptionTr:
      "Sâkin Nûn veya tenvînden sonra ي ن م و harflerinden biri geldiği için nûn sonraki harfe katılır ve yaklaşık 2 hareke gunneyle okunur.",
  },
  idgham_no_ghunnah: {
    category: "noon_meem_sakin",
    highlighted: true,
    titleTr: "İdğâm-ı Bilâ Gunne",
    descriptionTr:
      "Sâkin Nûn veya tenvînden sonra ل veya ر geldiği için nûn tamamen sonraki harfe katılır; gunne yapılmaz.",
  },
  ikhfa: {
    category: "noon_meem_sakin",
    highlighted: true,
    titleTr: "İhfâ",
    descriptionTr:
      "Sâkin Nûn veya tenvînden sonra 15 ihfâ harfinden biri geldiği için nûn gizlenir ve yaklaşık 2 hareke genizden okunur.",
  },
  iqlab: {
    category: "noon_meem_sakin",
    highlighted: true,
    titleTr: "İklâb",
    descriptionTr:
      "Sâkin Nûn veya tenvînden sonra ب geldiği için nûn sesi gizli bir mîme dönüşür ve gunneyle okunur (küçük mîm işareti).",
  },
  izhar_shafawi: {
    category: "noon_meem_sakin",
    highlighted: false,
    titleTr: "İzhâr-ı Şefevî",
    descriptionTr:
      "Sâkin Mîm'den sonra ب ve م dışında bir harf geldiği için mîm dudaklarla açıkça okunur.",
  },
  ikhfa_shafawi: {
    category: "noon_meem_sakin",
    highlighted: true,
    titleTr: "İhfâ-i Şefevî",
    descriptionTr:
      "Sâkin Mîm'den sonra ب geldiği için mîm dudaklar hafifçe kapanarak gunneyle gizli okunur.",
  },
  idgham_shafawi: {
    category: "noon_meem_sakin",
    highlighted: true,
    titleTr: "İdğâm-ı Misleyn (Şefevî)",
    descriptionTr:
      "Sâkin Mîm'den sonra yine م geldiği için iki mîm birleşir ve gunneyle okunur.",
  },
  ghunnah: {
    category: "ghunnah",
    highlighted: true,
    titleTr: "Gunne (Şeddeli Nûn / Mîm)",
    descriptionTr: "Şeddeli Nûn veya Mîm'de ses yaklaşık 2 hareke genizden tutulur.",
  },
  madd_muttasil: {
    category: "madd",
    highlighted: true,
    titleTr: "Med-di Muttasıl",
    descriptionTr:
      "Med harfinden sonra aynı kelimede hemze geldiği için 4–5 hareke uzatılır.",
  },
  madd_munfasil: {
    category: "madd",
    highlighted: true,
    titleTr: "Med-di Munfasıl",
    descriptionTr:
      "Med harfi kelime sonunda, hemze ise sonraki kelimenin başında olduğu için Hafs rivayetinde genellikle 4–5 hareke uzatılır.",
  },
  madd_lazim: {
    category: "madd",
    highlighted: true,
    titleTr: "Med-di Lâzım",
    descriptionTr:
      "Med harfinden sonra aynı kelimede şedde veya asli sükûn geldiği için 6 hareke uzatılır.",
  },
  madd_lazim_harfi: {
    category: "madd",
    highlighted: true,
    titleTr: "Med-di Lâzım (Hurûf-u Mukattaa)",
    descriptionTr:
      "Sure başındaki mukattaa harfinin adı okunurken med işaretli yer 6 hareke uzatılır.",
  },
  madd_arid: {
    category: "madd",
    highlighted: true,
    titleTr: "Med-di Ârız (Durakta)",
    descriptionTr:
      "Ayet sonunda durulunca son harf sükûnlandığı için önündeki med harfi 2, 4 veya 6 hareke uzatılabilir.",
  },
  madd_lin: {
    category: "madd",
    highlighted: true,
    titleTr: "Med-di Lîn (Durakta)",
    descriptionTr:
      "Ayet sonunda durulunca, üstünlü harften sonraki sâkin و / ي 2, 4 veya 6 hareke yumuşakça uzatılabilir.",
  },
  qalqalah_sughra: {
    category: "qalqalah",
    highlighted: true,
    titleTr: "Kalkale (Sügrâ)",
    descriptionTr:
      "Sükûnlu ق ط ب ج د harfi kelime içinde hafif bir sekmeyle okunur.",
  },
  qalqalah_kubra: {
    category: "qalqalah",
    highlighted: true,
    titleTr: "Kalkale (Kübrâ, Durakta)",
    descriptionTr:
      "Ayet sonunda durulduğunda son harf ق ط ب ج د olduğu için daha belirgin bir sekmeyle okunur.",
  },
  tafkhim: {
    category: "tafkhim",
    highlighted: true,
    titleTr: "Kalın Harf (İsti'lâ)",
    descriptionTr:
      "خ ص ض غ ط ق ظ harfi dil kökü yukarı kaldırılarak dolgun ve kalın sesle okunur.",
  },
};

export function getTajweedRule(id: TajweedRuleId): TajweedRuleDetail {
  return { id, ...RULES[id] };
}

/** Color priority when one letter carries several rules. */
const CATEGORY_PRIORITY: TajweedRuleCategory[] = [
  "noon_meem_sakin",
  "ghunnah",
  "madd",
  "qalqalah",
  "tafkhim",
];

// --- Unicode helpers -------------------------------------------------------

const SUKUN = "\u0652";
const SHADDA = "\u0651";
const MADDAH = "\u0653";
const HAMZA_ABOVE = "\u0654";
const DAGGER_ALIF = "\u0670";
const SILENT_MARK = "\u06DF"; // small high rounded zero: letter is not pronounced
const SMALL_HIGH_MEEM = "\u06E2"; // iqlab mark on nûn
const FATHA = "\u064E";
const DAMMA = "\u064F";
const KASRA = "\u0650";
const FATHATAN = "\u064B";

const TANWIN_RE = /[\u064B\u064C\u064D]/;
const HARAKAH_RE = /[\u064B-\u0650]/;
/** Combining marks that attach to the previous base letter. */
const COMBINING_RE = /[\u064B-\u065F\u0670\u06D6-\u06DC\u06DF-\u06E4\u06E7\u06E8\u06EA-\u06ED]/;

const HAMZA_LETTERS = new Set(["ء", "أ", "إ", "ؤ", "ئ", "آ"]);
const THROAT_LETTERS = new Set(["ء", "أ", "إ", "ؤ", "ئ", "آ", "ه", "ع", "ح", "غ", "خ"]);
const IDGHAM_GHUNNAH_LETTERS = new Set(["ي", "ن", "م", "و"]);
const IDGHAM_NO_GHUNNAH_LETTERS = new Set(["ل", "ر"]);
const QALQALAH_LETTERS = new Set(["ق", "ط", "ب", "ج", "د"]);
const TAFKHIM_LETTERS = new Set(["خ", "ص", "ض", "غ", "ط", "ق", "ظ"]);
const MADD_BASES = new Set(["ا", "و", "ي", "ى", "\u06E5", "\u06E6", "ـ"]);
const ARABIC_LETTER_RE = /[\u0621-\u063A\u0641-\u064A\u0671\u06E5\u06E6]/;

interface Cluster {
  base: string;
  marks: string;
  text: string;
}

function toClusters(word: string): Cluster[] {
  const clusters: Cluster[] = [];
  for (const ch of word) {
    const last = clusters[clusters.length - 1];
    if (last && COMBINING_RE.test(ch) && last.base !== " ") {
      last.marks += ch;
      last.text += ch;
    } else {
      clusters.push({ base: ch, marks: "", text: ch });
    }
  }
  return clusters;
}

const isLetter = (c: Cluster) => ARABIC_LETTER_RE.test(c.base);
const isSilent = (c: Cluster) => c.marks.includes(SILENT_MARK);
const hasVowel = (c: Cluster) => HARAKAH_RE.test(c.marks);
const isHamza = (c: Cluster) => HAMZA_LETTERS.has(c.base) || c.marks.includes(HAMZA_ABOVE);

/** A letter that is actually pronounced as a consonant or madd (not silent, not tatweel/sign). */
function isPronounced(c: Cluster): boolean {
  if (isSilent(c)) return false;
  if (c.base === "ـ") return c.marks.includes(DAGGER_ALIF) || c.marks.includes(HAMZA_ABOVE);
  return isLetter(c);
}

/** The base letters that carry a fathatan/kasratan (alif, alif maqsura) and are not read. */
function isTanwinCarrier(c: Cluster, prev: Cluster | undefined): boolean {
  return (
    !!prev &&
    TANWIN_RE.test(prev.marks) &&
    (c.base === "ا" || c.base === "ى") &&
    !hasVowel(c)
  );
}

interface Position {
  word: number;
  index: number;
}

function nextPronounced(words: Cluster[][], from: Position): Position | null {
  let w = from.word;
  let i = from.index + 1;
  while (w < words.length) {
    const clusters = words[w]!;
    while (i < clusters.length) {
      const c = clusters[i]!;
      if (isPronounced(c) && !isTanwinCarrier(c, clusters[i - 1])) return { word: w, index: i };
      i += 1;
    }
    w += 1;
    i = 0;
  }
  return null;
}

type NoonRule = Extract<
  TajweedRuleId,
  "izhar" | "idgham_ghunnah" | "idgham_no_ghunnah" | "ikhfa" | "iqlab"
>;

function classifyNoonFollower(next: Cluster): NoonRule | null {
  if (next.base === "ٱ") return null; // hamzat al-wasl: tenvîn takes a helping kasra
  if (next.base === "ب") return "iqlab";
  if (THROAT_LETTERS.has(next.base) || isHamza(next)) return "izhar";
  if (IDGHAM_GHUNNAH_LETTERS.has(next.base)) return "idgham_ghunnah";
  if (IDGHAM_NO_GHUNNAH_LETTERS.has(next.base)) return "idgham_no_ghunnah";
  return "ikhfa";
}

/**
 * Analyze every word of a verse in reading order.
 * @param words Uthmani text of each word (Quran.com / Tanzil encoding)
 * @param options.endsWithStop treat the last word as a stop (default true = verse end)
 */
export function analyzeVerseTajweed(
  words: readonly string[],
  options: { endsWithStop?: boolean } = {}
): TajweedWordAnalysis[] {
  const endsWithStop = options.endsWithStop ?? true;
  const clusterWords = words.map(toClusters);
  const ruleSets: TajweedRuleId[][][] = clusterWords.map((cs) => cs.map(() => []));
  const lastWord = clusterWords.length - 1;

  const add = (pos: Position, id: TajweedRuleId) => {
    const list = ruleSets[pos.word]![pos.index]!;
    if (!list.includes(id)) list.push(id);
  };

  clusterWords.forEach((clusters, w) => {
    const isStopWord = endsWithStop && w === lastWord;
    const isMuqattaat = clusters.some(
      (c) => c.marks.includes(MADDAH) && isLetter(c) && !MADD_BASES.has(c.base) && !hasVowel(c)
    );

    clusters.forEach((c, i) => {
      if (!isPronounced(c)) return;
      const pos = { word: w, index: i };
      const next = nextPronounced(clusterWords, pos);
      const nextCluster = next ? clusterWords[next.word]![next.index]! : null;
      const nextInStopWord = next === null || (isStopWord && next.word !== w);
      const vowelless = !hasVowel(c) && !c.marks.includes(SHADDA) && !c.marks.includes(MADDAH);

      // Gunne: şeddeli nûn / mîm
      if ((c.base === "ن" || c.base === "م") && c.marks.includes(SHADDA)) add(pos, "ghunnah");

      // Sâkin nûn
      if (c.base === "ن" && vowelless && !nextInStopWord && nextCluster) {
        if (c.marks.includes(SMALL_HIGH_MEEM)) add(pos, "iqlab");
        else if (c.marks.includes(SUKUN)) add(pos, "izhar");
        else {
          const rule = classifyNoonFollower(nextCluster);
          if (rule) add(pos, rule);
        }
      }

      // Tenvîn
      if (TANWIN_RE.test(c.marks) && !(isStopWord && next?.word !== w) && nextCluster) {
        const rule = classifyNoonFollower(nextCluster);
        if (rule) add(pos, rule);
      }

      // Sâkin mîm
      if (c.base === "م" && vowelless && !isMuqattaat && !nextInStopWord && nextCluster) {
        if (c.marks.includes(SUKUN)) add(pos, "izhar_shafawi");
        else if (nextCluster.base === "ب") add(pos, "ikhfa_shafawi");
        else if (nextCluster.base === "م") add(pos, "idgham_shafawi");
        else add(pos, "izhar_shafawi");
      }

      // Med işareti (ٓ)
      if (c.marks.includes(MADDAH)) {
        if (isMuqattaat) add(pos, "madd_lazim_harfi");
        else if (next && next.word === w && nextCluster && isHamza(nextCluster)) {
          // يَـٰٓأَيُّهَا / هَـٰٓؤُلَآءِ: nidâ and tenbîh "hâ" are munfasil written joined
          const first = clusters[0]!;
          if (i === 1 && (first.base === "ي" || first.base === "ه")) add(pos, "madd_munfasil");
          else add(pos, "madd_muttasil");
        } else if (next && next.word === w) {
          // sükûn or şedde follows inside the word (e.g. ٱلضَّآلِّينَ, ٱلْحَآقَّةُ)
          add(pos, "madd_lazim");
        } else if (nextCluster && isHamza(nextCluster)) {
          add(pos, "madd_munfasil");
        }
      }

      // Kalkale sügrâ: sükûnlu Kutb-u Ced
      if (QALQALAH_LETTERS.has(c.base) && c.marks.includes(SUKUN)) add(pos, "qalqalah_sughra");

      // Kalın harfler
      if (TAFKHIM_LETTERS.has(c.base)) add(pos, "tafkhim");
    });

    if (isStopWord) applyStopRules(clusters, (index, id) => add({ word: w, index }, id));
  });

  return clusterWords.map((clusters, w) => {
    const segments: TajweedSegment[] = clusters.map((c, i) => {
      const ruleIds = ruleSets[w]![i]!;
      const category =
        CATEGORY_PRIORITY.find((cat) =>
          ruleIds.some((id) => RULES[id].category === cat && RULES[id].highlighted)
        ) ?? null;
      return { text: c.text, category, ruleIds };
    });

    // Merge neighbouring segments with identical coloring to keep the DOM small.
    const merged: TajweedSegment[] = [];
    for (const seg of segments) {
      const prev = merged[merged.length - 1];
      if (prev && prev.category === seg.category && prev.ruleIds.join() === seg.ruleIds.join()) {
        prev.text += seg.text;
      } else {
        merged.push({ ...seg, ruleIds: [...seg.ruleIds] });
      }
    }

    const ruleIds: TajweedRuleId[] = [];
    for (const seg of segments) for (const id of seg.ruleIds) if (!ruleIds.includes(id)) ruleIds.push(id);

    return { segments: merged, rules: ruleIds.map(getTajweedRule) };
  });
}

/** Kalkale Kübrâ and Med-di Ârız / Lîn on the verse-final word (waqf). */
function applyStopRules(clusters: Cluster[], add: (index: number, id: TajweedRuleId) => void) {
  // Last pronounced letter (ignoring the alif/yâ carrying a fathatan).
  let last = -1;
  for (let i = clusters.length - 1; i >= 0; i -= 1) {
    const c = clusters[i]!;
    if (isPronounced(c) && !isTanwinCarrier(c, clusters[i - 1])) {
      last = i;
      break;
    }
  }
  if (last < 0) return;
  const lastCluster = clusters[last]!;
  // Fathatan + alif turns into an "â" at the stop (iwad): no sükûn on the letter.
  if (lastCluster.marks.includes(FATHATAN)) return;
  // A word-final madd letter (e.g. "فِى") just keeps its natural length.
  if (MADD_BASES.has(lastCluster.base) && !hasVowel(lastCluster) && !lastCluster.marks.includes(SHADDA)) return;

  if (QALQALAH_LETTERS.has(lastCluster.base)) add(last, "qalqalah_kubra");

  // Letter right before the stopped letter.
  let prevIdx = last - 1;
  while (prevIdx >= 0 && !isPronounced(clusters[prevIdx]!)) prevIdx -= 1;
  if (prevIdx < 0) return;
  const prev = clusters[prevIdx]!;
  if (prev.marks.includes(MADDAH)) return;
  if (lastCluster.marks.includes(SHADDA)) return;

  let beforePrev = prevIdx - 1;
  while (beforePrev >= 0 && !isPronounced(clusters[beforePrev]!)) beforePrev -= 1;
  const carrierVowel = beforePrev >= 0 ? clusters[beforePrev]!.marks : "";

  const isMaddLetter =
    prev.marks.includes(DAGGER_ALIF) ||
    prev.base === "\u06E5" ||
    prev.base === "\u06E6" ||
    (prev.base === "ا" && !hasVowel(prev) && carrierVowel.includes(FATHA)) ||
    (prev.base === "و" && !hasVowel(prev) && !prev.marks.includes(SHADDA) && carrierVowel.includes(DAMMA)) ||
    ((prev.base === "ي" || prev.base === "ى") && !hasVowel(prev) && !prev.marks.includes(SHADDA) && carrierVowel.includes(KASRA));
  if (isMaddLetter) {
    add(prevIdx, "madd_arid");
    return;
  }

  const isLin =
    (prev.base === "و" || prev.base === "ي") && prev.marks.includes(SUKUN) && carrierVowel.includes(FATHA);
  if (isLin) add(prevIdx, "madd_lin");
}

/**
 * Category-level summary for a single word. Pass the following word (and
 * whether the word ends the verse) so cross-word rules can be resolved.
 */
export function analyzeWordTajweed(
  textUthmani: string,
  context: { nextWord?: string; isVerseEnd?: boolean } = {}
): TajweedRuleMatch[] {
  if (!textUthmani) return [];
  const words = context.nextWord ? [textUthmani, context.nextWord] : [textUthmani];
  const [analysis] = analyzeVerseTajweed(words, {
    endsWithStop: context.nextWord ? true : (context.isVerseEnd ?? false),
  });
  const categories = new Set(
    analysis!.rules.filter((r) => r.highlighted).map((r) => r.category)
  );
  return TAJWEED_LEGEND.filter((item) => categories.has(item.category));
}
