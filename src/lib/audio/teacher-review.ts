import type { RecitationEvaluationResult } from "./assessment-provider";

export interface TeacherReviewCriterion {
  code: string;
  titleTr: string;
  descriptionTr: string;
}

export interface BuildVerseTeacherReviewParams {
  verseKey: string;
  pageNumber: number;
  surahNameTr: string;
  textUthmani: string;
  translationTr: string;
  durationMs: number;
  createdAt: string;
  reciterNameTr: string;
  noteText: string;
  isDifficult: boolean;
  assessment: RecitationEvaluationResult | null;
}

export interface VerseTeacherReviewPackage {
  version: "1.0";
  requiresHumanReview: true;
  epistemicNoticeTr: string;
  verse: {
    verseKey: string;
    pageNumber: number;
    surahNameTr: string;
    textUthmani: string;
    translationTr: string;
  };
  recording: {
    durationMs: number;
    durationSeconds: number;
    createdAt: string;
    referenceReciterNameTr: string;
  };
  learnerContext: {
    noteText: string;
    isDifficult: boolean;
  };
  asrSummary: {
    evaluated: boolean;
    status: string;
    providerName: string | null;
    confidenceScore: number | null;
    summaryTr: string;
    recognizedText: string | null;
    findings: string[];
  };
  checklist: TeacherReviewCriterion[];
  reportMarkdownTr: string;
}

const TEACHER_REVIEW_CHECKLIST: readonly TeacherReviewCriterion[] = [
  {
    code: "mahrec",
    titleTr: "Mahâricü'l-Hurûf (Harf Çıkış Yerleri)",
    descriptionTr:
      "Boğaz, dil ve dudak harflerinin (ör. ح/هـ، ع/أ، ص/س، ط/ت، ض/د/ظ/ذ) mahreçlerinin doğru verilip verilmediği.",
  },
  {
    code: "sifat",
    titleTr: "Sıfâtü'l-Hurûf (Harf Nitelikleri)",
    descriptionTr:
      "İsti'lâ (kalınlık) - istifâl (incelik), kalkale (ق ط ب ج د), hems ve rihvet/şiddet sıfatlarının uygulanışı.",
  },
  {
    code: "med",
    titleTr: "Med ve Uzatma Ölçüleri",
    descriptionTr:
      "Medd-i tabîî (2 hareke) ile medd-i muttasıl/munfasıl/lâzım (4–6 hareke) ölçülerinin dengeli okunması.",
  },
  {
    code: "gunne_idgam_ihfa",
    titleTr: "Gunne, İdğam, İhfâ ve İklâb Uygulaması",
    descriptionTr:
      "Sâkin nûn, tenvîn, sâkin mîm ve şeddeli nûn/mîm kurallarında geniz (gunne) süresi ve geçiş doğruluğu.",
  },
  {
    code: "vakf_ibtida",
    titleTr: "Vakf ve İbtidâ (Durak ve Başlangıç Yerleri)",
    descriptionTr:
      "Nefes yetmediğinde anlamı bozmayan vakf yerlerinde durulup uygun yerden ibtidâ yapılması ve son harekenin sükûnla durulması.",
  },
] as const;

export function buildTeacherReviewChecklist(): TeacherReviewCriterion[] {
  return TEACHER_REVIEW_CHECKLIST.map((item) => ({ ...item }));
}

export function buildVerseTeacherReviewPackage(
  params: BuildVerseTeacherReviewParams
): VerseTeacherReviewPackage {
  const checklist = buildTeacherReviewChecklist();
  const durationSeconds = Number((Math.max(0, params.durationMs) / 1000).toFixed(1));
  const epistemicNoticeTr =
    "Önemli Epistemik Uyarı: Otomatik ASR kelime sırası kontrolü yalnızca kelimelerin dizilimini tahmin eder; mahreç, sıfat, gunne ve med ölçüsü gibi tecvid hükümlerini doğrulamaz. Nihai kıraat ve tecvid onayı için mutlaka uzman bir Kur'an hocasının (müşâfehe / fem-i muhsin) dinlemesi gereklidir.";

  const asrSummary = params.assessment
    ? {
        evaluated: true,
        status: params.assessment.status,
        providerName: params.assessment.providerName,
        confidenceScore: params.assessment.confidenceScore,
        summaryTr: params.assessment.summaryTr,
        recognizedText: params.assessment.recognizedText ?? null,
        findings: params.assessment.findings.map((f) => f.messageTr),
      }
    : {
        evaluated: false,
        status: "local_only",
        providerName: null,
        confidenceScore: null,
        summaryTr:
          "Bu kayıt yalnızca yerel karşılaştırma modunda oluşturuldu; harici ASR kelime sırası analizi çalıştırılmadı.",
        recognizedText: null,
        findings: [],
      };

  const trimmedNote = params.noteText.trim();
  const lines: string[] = [
    `# Quran Journey — Hoca Kıraat ve Tecvid İnceleme Paketi (${params.verseKey})`,
    "",
    `> ${epistemicNoticeTr}`,
    "",
    "## 1. Ayet Bilgisi",
    `- **Sure / Ayet:** ${params.surahNameTr} (${params.verseKey})`,
    `- **Medine Mushafı Sayfası:** ${params.pageNumber}`,
    `- **Arapça Metin (Uthmânî):** ${params.textUthmani}`,
    `- **Ayet Meali:** ${params.translationTr || "—"}`,
    "",
    "## 2. Öğrenci Kaydı ve Referans",
    `- **Kayıt Tarihi:** ${params.createdAt}`,
    `- **Kayıt Süresi:** ${durationSeconds} sn (${params.durationMs} ms)`,
    `- **Karşılaştırılan Referans Kâri:** ${params.reciterNameTr}`,
    `- **Zor İşaretli Ayet:** ${params.isDifficult ? "Evet (Öğrenci zor olarak işaretledi)" : "Hayır"}`,
    `- **Öğrenci Çalışma Notu:** ${trimmedNote || "Not eklenmemiş."}`,
    "",
    "## 3. Otomatik Ön Kontrol (ASR Kelime Sırası Durumu)",
    `- **Durum:** ${asrSummary.status}${
      asrSummary.confidenceScore !== null
        ? ` (Kelime sırası oranı: %${Math.round(asrSummary.confidenceScore * 100)})`
        : ""
    }`,
    `- **Özet:** ${asrSummary.summaryTr}`,
  ];

  if (asrSummary.recognizedText) {
    lines.push(`- **ASR Transkripti:** ${asrSummary.recognizedText}`);
  }
  for (const finding of asrSummary.findings) {
    lines.push(`  - ${finding}`);
  }

  lines.push(
    "",
    "## 4. Hoca Değerlendirme Kontrol Listesi",
    ...checklist.map(
      (c, i) => `${i + 1}. [ ] **${c.titleTr}** (\`${c.code}\`): ${c.descriptionTr}`
    ),
    "",
    "---",
    "Not: Kaydettiğiniz `.webm` / `.m4a` ses dosyasını 'Ses İndir' bağlantısıyla indirip bu raporla birlikte hocanıza gönderebilirsiniz."
  );

  return {
    version: "1.0",
    requiresHumanReview: true,
    epistemicNoticeTr,
    verse: {
      verseKey: params.verseKey,
      pageNumber: params.pageNumber,
      surahNameTr: params.surahNameTr,
      textUthmani: params.textUthmani,
      translationTr: params.translationTr,
    },
    recording: {
      durationMs: params.durationMs,
      durationSeconds,
      createdAt: params.createdAt,
      referenceReciterNameTr: params.reciterNameTr,
    },
    learnerContext: {
      noteText: trimmedNote,
      isDifficult: params.isDifficult,
    },
    asrSummary,
    checklist,
    reportMarkdownTr: lines.join("\n"),
  };
}
