import { describe, expect, it } from "vitest";
import {
  ARABIC_READING_MODULES,
  ELIFBA_LETTERS,
  PLACEMENT_QUESTIONS,
  TAJWEED_LESSONS,
} from "@/lib/content/arabic-curriculum";
import { getVerseByKey, getWordByLocation } from "@/lib/content/canonical-loader";

describe("Elif-Bâ, Arabic Reading & Tajweed Curriculum Integrity", () => {
  it("contains all 28 Arabic alphabet letters with valid forms and verified Quranic word audio", () => {
    expect(ELIFBA_LETTERS).toHaveLength(28);
    expect(ELIFBA_LETTERS.map((l) => l.order)).toEqual(
      Array.from({ length: 28 }, (_, i) => i + 1)
    );

    const nonConnecting = ELIFBA_LETTERS.filter((l) => l.nonConnecting).map((l) => l.isolated);
    expect(nonConnecting).toEqual(["ا", "د", "ذ", "ر", "ز", "و"]);

    for (const letter of ELIFBA_LETTERS) {
      expect(letter.isolated.length).toBeGreaterThan(0);
      expect(letter.initial.length).toBeGreaterThan(0);
      expect(letter.medial.length).toBeGreaterThan(0);
      expect(letter.final.length).toBeGreaterThan(0);

      const word = getWordByLocation(letter.exampleWordLocation);
      expect(word, `Missing word ${letter.exampleWordLocation} for ${letter.nameTr}`).toBeDefined();
      expect(word!.textUthmani).toBe(letter.exampleArabic);
      expect(word!.audioUrl).toBe(letter.exampleAudioUrl);
    }
  });

  it("provides 8 progressive Arabic reading modules with verified Quranic references and audio", () => {
    expect(ARABIC_READING_MODULES).toHaveLength(8);

    for (const mod of ARABIC_READING_MODULES) {
      expect(mod.miniCheck.options.some((o) => o.isCorrect)).toBe(true);
      for (const ex of mod.examples) {
        if (ex.isQuranicRef) {
          const word = getWordByLocation(ex.isQuranicRef);
          expect(word, `Missing ref ${ex.isQuranicRef} in module ${mod.id}`).toBeDefined();
          expect(ex.arabic.includes(word!.textUthmani)).toBe(true);
          if (ex.audioUrl) {
            expect(ex.audioUrl).toBe(word!.audioUrl);
          }
        }
      }
    }
  });

  it("provides 8 progressive Tajweed lessons with verified Quranic examples and audio", () => {
    expect(TAJWEED_LESSONS).toHaveLength(8);

    for (const lesson of TAJWEED_LESSONS) {
      if (lesson.fatihaExample) {
        const verse = getVerseByKey(lesson.fatihaExample.verseKey);
        const word = getWordByLocation(lesson.fatihaExample.wordLocation);
        expect(verse, `Missing verse ${lesson.fatihaExample.verseKey}`).toBeDefined();
        expect(word, `Missing word ${lesson.fatihaExample.wordLocation}`).toBeDefined();
        expect(lesson.fatihaExample.arabic.includes(word!.textUthmani)).toBe(true);
        if (lesson.fatihaExample.audioUrl) {
          expect(lesson.fatihaExample.audioUrl).toBe(word!.audioUrl);
        }
      }
    }
  });

  it("includes valid placement diagnostic questions covering core reading skills", () => {
    expect(PLACEMENT_QUESTIONS.length).toBeGreaterThanOrEqual(6);
    for (const q of PLACEMENT_QUESTIONS) {
      expect(q.options.filter((o) => o.isCorrect)).toHaveLength(1);
    }
  });
});
