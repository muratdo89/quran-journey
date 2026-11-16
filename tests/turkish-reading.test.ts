import { describe, expect, it } from "vitest";
import { toTurkishReading } from "@/lib/content/turkish-reading";

describe("toTurkishReading", () => {
  it.each([
    ["wayuqīmūna", "ve yukîmûne"],
    ["bis'mi", "bismi"],
    ["l-lahi", "allâhi"],
    ["lillahi", "lillâhi"],
    ["l-raḥmāni", "er-rahmâni"],
    ["al-ḥamdu", "el-hamdü"],
    ["rabbi", "rabbi"],
    ["l-ʿālamīna", "el-âlemîne"],
    ["māliki", "mâliki"],
    ["yawmi", "yevmi"],
    ["l-dīni", "ed-dîni"],
    ["iyyāka", "iyyâke"],
    ["naʿbudu", "na'büdü"],
    ["wa-iyyāka", "ve iyyâke"],
    ["ih'dinā", "ihdinâ"],
    ["l-ṣirāṭa", "es-sırâta"],
    ["l-mus'taqīma", "el-müstakîme"],
    ["alladhīna", "ellezîne"],
    ["anʿamta", "en'amte"],
    ["ʿalayhim", "aleyhim"],
    ["ghayri", "ğayri"],
    ["l-maghḍūbi", "el-mağdûbi"],
  ])("%s → %s", (src, expected) => {
    expect(toTurkishReading(src)).toBe(expected);
  });

  it("returns null for empty input", () => {
    expect(toTurkishReading(null)).toBeNull();
    expect(toTurkishReading("")).toBeNull();
  });
});

describe("toTurkishReading with a mid-word article", () => {
  it("keeps the article attached", () => {
    expect(toTurkishReading("bil-ghaybi")).toBe("bil-ğaybi");
    expect(toTurkishReading("wal-qur'āni")).toBe("vel-kurâni");
  });
});
