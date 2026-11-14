import type { RecitationFinding } from "./assessment-provider";

export function normalizeArabicForAlignment(text: string): string {
  return text
    .replace(/[\u064B-\u065F\u0670\u06D6-\u06ED]/g, "")
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/\u0640/g, "")
    .replace(/[^\u0621-\u064A\s]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

export interface WordDiffItem {
  type: "match" | "missing" | "substitution" | "extra";
  expectedWord?: string;
  recognizedWord?: string;
  positionIndex?: number;
}

export interface SequenceAlignmentResult {
  wordMatchRatio: number;
  matchedCount: number;
  expectedCount: number;
  diffs: WordDiffItem[];
  findings: RecitationFinding[];
}

function buildExpectedVariants(word: string): Set<string> {
  const variants = new Set<string>();
  variants.add(normalizeArabicForAlignment(word));
  if (word.includes("\u0670")) {
    variants.add(normalizeArabicForAlignment(word.replace(/\u0670/g, "ا")));
  }
  return variants;
}

export function alignAsrTranscript(
  expectedArabicText: string,
  recognizedTranscript: string,
  verseKey: string
): SequenceAlignmentResult {
  const expectedDisplay = expectedArabicText.trim().split(/\s+/).filter(Boolean);
  const expectedVariants = expectedDisplay.map((w) => buildExpectedVariants(w));
  const recognizedWords = normalizeArabicForAlignment(recognizedTranscript)
    .split(/\s+/)
    .filter(Boolean);

  const m = expectedVariants.length;
  const n = recognizedWords.length;

  // Classic Levenshtein DP matrix
  const dp: number[][] = Array.from({ length: m + 1 }, () => Array<number>(n + 1).fill(0));
  for (let i = 0; i <= m; i += 1) dp[i]![0] = i;
  for (let j = 0; j <= n; j += 1) dp[0]![j] = j;

  for (let i = 1; i <= m; i += 1) {
    for (let j = 1; j <= n; j += 1) {
      const cost = expectedVariants[i - 1]!.has(recognizedWords[j - 1]!) ? 0 : 1;
      dp[i]![j] = Math.min(
        dp[i - 1]![j]! + 1, // deletion (missing expected word)
        dp[i]![j - 1]! + 1, // insertion (extra recognized word)
        dp[i - 1]![j - 1]! + cost // match or substitution
      );
    }
  }

  // Backtrack alignment
  const diffs: WordDiffItem[] = [];
  let i = m;
  let j = n;
  let matchedCount = 0;

  while (i > 0 || j > 0) {
    if (
      i > 0 &&
      j > 0 &&
      expectedVariants[i - 1]!.has(recognizedWords[j - 1]!) &&
      dp[i]![j] === dp[i - 1]![j - 1]
    ) {
      matchedCount += 1;
      diffs.push({
        type: "match",
        expectedWord: expectedDisplay[i - 1],
        recognizedWord: recognizedWords[j - 1],
        positionIndex: i,
      });
      i -= 1;
      j -= 1;
    } else if (i > 0 && j > 0 && dp[i]![j] === dp[i - 1]![j - 1]! + 1) {
      diffs.push({
        type: "substitution",
        expectedWord: expectedDisplay[i - 1],
        recognizedWord: recognizedWords[j - 1],
        positionIndex: i,
      });
      i -= 1;
      j -= 1;
    } else if (i > 0 && dp[i]![j] === dp[i - 1]![j]! + 1) {
      diffs.push({
        type: "missing",
        expectedWord: expectedDisplay[i - 1],
        positionIndex: i,
      });
      i -= 1;
    } else {
      diffs.push({
        type: "extra",
        recognizedWord: recognizedWords[j - 1],
      });
      j -= 1;
    }
  }

  diffs.reverse();
  const wordMatchRatio = m > 0 ? Math.max(0, Math.min(1, matchedCount / m)) : 0;

  const findings: RecitationFinding[] = [];
  for (const d of diffs) {
    if (d.type === "missing" && d.expectedWord) {
      findings.push({
        kind: "possible_missing_word",
        wordLocation: d.positionIndex ? `${verseKey}:${d.positionIndex}` : undefined,
        messageTr: `Muhtemel atlanan kelime (${verseKey}:${d.positionIndex}): «${d.expectedWord}»`,
      });
    } else if (d.type === "substitution" && d.expectedWord) {
      findings.push({
        kind: "possible_word_substitution",
        wordLocation: d.positionIndex ? `${verseKey}:${d.positionIndex}` : undefined,
        messageTr: `Farklı algılanan kelime (${verseKey}:${d.positionIndex}): Beklenen «${d.expectedWord}», algılanan «${d.recognizedWord ?? ""}»`,
      });
    }
  }

  findings.push({
    kind: "expert_verification_needed",
    messageTr:
      "Kelime eşleşmesi yalnızca metin dizisini kontrol eder; med uzatmaları, gunne, kalkale ve mahreç doğruluğunu ölçmek için referans hoca kaydını dinleyip uzman teyidi almanız gerekir.",
  });

  return {
    wordMatchRatio,
    matchedCount,
    expectedCount: m,
    diffs,
    findings,
  };
}
