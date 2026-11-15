import { describe, expect, it } from "vitest";
import {
  QURAN_RECITERS,
  getReciterAyahAudioUrl,
  getReciterById,
} from "@/lib/audio/reciters";
import {
  buildTeacherReviewChecklist,
  buildVerseTeacherReviewPackage,
} from "@/lib/audio/teacher-review";
import { getVerseByKey } from "@/lib/content/canonical-loader";
import { GET as getHealth } from "@/app/api/health/route";
import { runCloudEnvSetup } from "../scripts/setup-cloud-env.mjs";

describe("Phase 6 — Multi-Reciter Expansion, Teacher Review Export & Cloud Readiness", () => {
  it("provides 6 verified reciters and resolves HTTPS ayah URLs for 1:1 and 2:255", () => {
    expect(QURAN_RECITERS).toHaveLength(6);

    const fatiha1 = getVerseByKey("1:1");
    const kursiy = getVerseByKey("2:255");
    expect(fatiha1).toBeDefined();
    expect(kursiy).toBeDefined();

    for (const reciter of QURAN_RECITERS) {
      const resolved = getReciterById(reciter.id);
      expect(resolved.id).toBe(reciter.id);

      const url1 = getReciterAyahAudioUrl(fatiha1!, reciter.id);
      const url255 = getReciterAyahAudioUrl(kursiy!, reciter.id);

      expect(url1).toMatch(/^https:\/\/.+\/001001\.mp3$/);
      expect(url255).toMatch(/^https:\/\/.+\/002255\.mp3$/);
    }

    // Unknown reciter falls back gracefully to default reciter (Alafasy)
    expect(getReciterById(999999).id).toBe(7);
    expect(getReciterAyahAudioUrl(kursiy!, 999999)).toMatch(
      /^https:\/\/.+\/002255\.mp3$/
    );
  });

  it("builds a structured teacher review package with 5 Tajweed criteria and epistemic honesty", () => {
    const checklist = buildTeacherReviewChecklist();
    expect(checklist.map((c) => c.code)).toEqual([
      "mahrec",
      "sifat",
      "med",
      "gunne_idgam_ihfa",
      "vakf_ibtida",
    ]);

    const pkg = buildVerseTeacherReviewPackage({
      verseKey: "2:255",
      pageNumber: 42,
      surahNameTr: "Bakara Suresi",
      textUthmani: "ٱللَّهُ لَآ إِلَـٰهَ إِلَّا هُوَ ٱلْحَىُّ ٱلْقَيُّومُ",
      translationTr: "Allah, kendisinden başka ilah olmayandır; diridir, kayyumdur.",
      durationMs: 14500,
      createdAt: "2026-11-15T01:00:00.000Z",
      reciterNameTr: "Mahmud Halîl el-Husarî (Muallim)",
      noteText: "Medd-i munfasıl uzatmasını kontrol etmek istiyorum.",
      isDifficult: true,
      assessment: {
        providerName: "configurable-http-asr",
        scope: "sequence_check",
        status: "completed",
        confidenceScore: 0.92,
        requiresHumanReview: true,
        summaryTr: "Kelime sırası eşleşmesi: %92 (test).",
        recognizedText: "الله لا اله الا هو الحي القيوم",
        findings: [
          {
            kind: "expert_verification_needed",
            messageTr: "Tecvid ve mahreç için uzman hoca dinlemesi gereklidir.",
          },
        ],
      },
    });

    expect(pkg.version).toBe("1.0");
    expect(pkg.requiresHumanReview).toBe(true);
    expect(pkg.recording.durationSeconds).toBe(14.5);
    expect(pkg.checklist).toHaveLength(5);
    expect(pkg.epistemicNoticeTr).toContain("mahreç");
    expect(pkg.reportMarkdownTr).toContain("Bakara Suresi (2:255)");
    expect(pkg.reportMarkdownTr).toContain("14.5 sn");
    expect(pkg.reportMarkdownTr).toContain("Medd-i munfasıl");
    expect(pkg.reportMarkdownTr).toContain("Mahâricü'l-Hurûf");
    expect(pkg.reportMarkdownTr).toContain("%92");
  });

  it("verifies cloud readiness setup script and /api/health endpoint", async () => {
    const setupReport = runCloudEnvSetup(process.cwd(), {
      createEnvIfMissing: false,
    });
    expect(setupReport.supabaseFiles.setupAllExists).toBe(true);
    expect(setupReport.supabaseFiles.seedExists).toBe(true);
    expect(setupReport.supabaseFiles.setupAllBytes).toBeGreaterThan(1000);

    const res = await getHealth();
    expect(res.status).toBe(200);
    const body = (await res.json()) as {
      ok: boolean;
      canonicalCorpus: {
        totalSurahs: number;
        totalPages: number;
        totalVerses: number;
        totalWords: number;
      };
      deploymentReady: {
        localSqliteReady: boolean;
        supabaseSqlFilesReady: boolean;
      };
    };

    expect(body.ok).toBe(true);
    expect(body.canonicalCorpus.totalSurahs).toBe(114);
    expect(body.canonicalCorpus.totalPages).toBe(604);
    expect(body.canonicalCorpus.totalVerses).toBe(6236);
    expect(body.canonicalCorpus.totalWords).toBe(77429);
    expect(body.deploymentReady.localSqliteReady).toBe(true);
    expect(body.deploymentReady.supabaseSqlFilesReady).toBe(true);
  });
});
