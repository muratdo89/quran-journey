export type AssessmentScope = "sequence_check" | "pronunciation" | "tajweed";

export interface RecitationEvaluationRequest {
  verseKey: string;
  expectedArabicText: string;
  audioMimeType: string;
  durationMs: number;
  consentGranted: boolean;
}

export interface RecitationFinding {
  kind:
    | "possible_missing_word"
    | "possible_word_substitution"
    | "listen_again_recommended"
    | "potential_elongation_issue"
    | "expert_verification_needed";
  messageTr: string;
  wordLocation?: string;
}

export interface RecitationEvaluationResult {
  providerName: string;
  scope: AssessmentScope;
  status: "completed" | "unavailable" | "consent_required" | "error";
  confidenceScore: number | null; // 0..1, null when unavailable
  requiresHumanReview: boolean;
  summaryTr: string;
  findings: RecitationFinding[];
}

export interface RecitationAssessmentProvider {
  readonly id: string;
  readonly displayNameTr: string;
  readonly supportedScopes: AssessmentScope[];
  isConfigured(): boolean;
  evaluate(request: RecitationEvaluationRequest): Promise<RecitationEvaluationResult>;
}

/**
 * Default local comparison provider when no external Quranic ASR / Tajweed model
 * is configured. Explicitly states capabilities and never fakes AI evaluation.
 */
export class LocalComparisonOnlyProvider implements RecitationAssessmentProvider {
  readonly id = "local-comparison-only";
  readonly displayNameTr = "Yerel Kayıt ve Referans Karşılaştırma";
  readonly supportedScopes: AssessmentScope[] = [];

  isConfigured(): boolean {
    return true;
  }

  async evaluate(
    request: RecitationEvaluationRequest
  ): Promise<RecitationEvaluationResult> {
    if (!request.consentGranted) {
      return {
        providerName: this.id,
        scope: "sequence_check",
        status: "consent_required",
        confidenceScore: null,
        requiresHumanReview: true,
        summaryTr:
          "Ses kaydınız yalnızca tarayıcınızda/yerelde tutulur. Üçüncü taraf yapay zekâ analizi için açık onayınız gereklidir.",
        findings: [
          {
            kind: "listen_again_recommended",
            messageTr:
              "Kendi sesinizi Mişari el-Afâsî veya Husarî (Muallim) kaydıyla yan yana dinleyerek kelimeleri ve uzatmaları karşılaştırabilirsiniz.",
          },
        ],
      };
    }

    return {
      providerName: this.id,
      scope: "sequence_check",
      status: "unavailable",
      confidenceScore: null,
      requiresHumanReview: true,
      summaryTr:
        "Otomatik Kur'an konuşma tanıma (ASR) veya Tecvid değerlendirme sağlayıcısı henüz yapılandırılmadı. Doğru kelime eşleşmesi bile tek başına tecvid ve mahreç doğruluğunu kanıtlamaz; uzman hoca dinlemesi her zaman esastır.",
      findings: [
        {
          kind: "expert_verification_needed",
          messageTr:
            "Ayarlar sayfasından desteklenen bir Kur'an ASR sağlayıcısı bağlayabilir veya kaydınızı dinleyip kendi öz değerlendirmenizi işaretleyebilirsiniz.",
        },
      ],
    };
  }
}

export function getActiveAssessmentProvider(): RecitationAssessmentProvider {
  return new LocalComparisonOnlyProvider();
}
