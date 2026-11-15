export type TajweedRuleCategory =
  | "qalqalah"
  | "ghunnah"
  | "madd"
  | "noon_meem_sakin"
  | "tafkhim";

export interface TajweedRuleMatch {
  category: TajweedRuleCategory;
  titleTr: string;
  shortLabelTr: string;
  colorHex: string;
  bgHex: string;
  descriptionTr: string;
}

export const TAJWEED_LEGEND: readonly TajweedRuleMatch[] = [
  {
    category: "qalqalah",
    titleTr: "Kalkale (Vurgulu Sekme)",
    shortLabelTr: "Kalkale",
    colorHex: "#1d4ed8",
    bgHex: "#eff6ff",
    descriptionTr:
      "ق ط ب ج د (Kutb-u Ced) harflerinin sükûnlu veya duruş halinde hafif vurgulu/sekmeli okunması.",
  },
  {
    category: "ghunnah",
    titleTr: "Gunne (Geniz Sesi)",
    shortLabelTr: "Gunne",
    colorHex: "#be185d",
    bgHex: "#fdf2f8",
    descriptionTr:
      "Şeddeli Nûn (نّ) ve Şeddeli Mîm (مّ) harflerinde sesin yaklaşık 2 hareke genizden tutulması.",
  },
  {
    category: "madd",
    titleTr: "Med (Uzatma)",
    shortLabelTr: "Med",
    colorHex: "#b45309",
    bgHex: "#fffbeb",
    descriptionTr:
      "Med işareti (ٓ) veya asar/mukadder elif (ٰ) bulunan yerlerde harfin ölçüsüne göre uzatılması.",
  },
  {
    category: "noon_meem_sakin",
    titleTr: "Sâkin Nûn / Tenvîn / Mîm",
    shortLabelTr: "Sâkin Nûn/Mîm",
    colorHex: "#047857",
    bgHex: "#ecfdf5",
    descriptionTr:
      "Sâkin Nûn, tenvîn veya sâkin Mîm geçişlerinde sonraki harfe göre İzhâr, İdğam, İhfâ veya İklâb uygulanması.",
  },
  {
    category: "tafkhim",
    titleTr: "Kalın Harf (İsti'lâ)",
    shortLabelTr: "Kalın Harf",
    colorHex: "#6d28d9",
    bgHex: "#f5f3ff",
    descriptionTr:
      "خ ص ض غ ط ق ظ harflerinin dil kökü yukarı kaldırılarak dolgun ve kalın sesle telaffuz edilmesi.",
  },
] as const;

const LEGEND_BY_CATEGORY = new Map<TajweedRuleCategory, TajweedRuleMatch>(
  TAJWEED_LEGEND.map((item) => [item.category, item])
);

const RE_QALQALAH = /[قطبجد](?:[\u0652\u06E1]|(?=[\u06D6-\u06ED]*$))/;
const RE_GHUNNAH = /[نم][\u064B-\u0650\u0670]*\u0651/;
const RE_MADD = /[\u0653\u0670]/;
const RE_NOON_MEEM_SAKIN =
  /[\u064B\u064C\u064D]|[نم](?:[\u0652\u06E1]|(?![\u064B-\u0651\u0653-\u065F\u0670]))/;
const RE_TAFKHIM = /[خصضغطقظ]/;

export function analyzeWordTajweed(textUthmani: string): TajweedRuleMatch[] {
  if (!textUthmani) return [];

  const matches: TajweedRuleMatch[] = [];
  const pushRule = (category: TajweedRuleCategory) => {
    const rule = LEGEND_BY_CATEGORY.get(category);
    if (rule) matches.push(rule);
  };

  if (RE_QALQALAH.test(textUthmani)) pushRule("qalqalah");
  if (RE_GHUNNAH.test(textUthmani)) pushRule("ghunnah");
  if (RE_MADD.test(textUthmani)) pushRule("madd");
  if (RE_NOON_MEEM_SAKIN.test(textUthmani)) pushRule("noon_meem_sakin");
  if (RE_TAFKHIM.test(textUthmani)) pushRule("tafkhim");

  return matches;
}
