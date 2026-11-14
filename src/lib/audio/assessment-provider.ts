import { alignAsrTranscript } from "./sequence-aligner";

export type AssessmentScope = "sequence_check" | "pronunciation" | "tajweed";

export interface RecitationEvaluationRequest {
  verseKey: string;
  expectedArabicText: string;
  audioMimeType: string;
  durationMs: number;
  consentGranted: boolean;
  audioBytes?: Uint8Array;
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
  recognizedText?: string;
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
            "Ortam değişkenlerinde QURAN_ASR_API_URL tanımlandığında otomatik kelime sırası kontrolü devreye girer; şimdilik kaydınızı referans okuyucuyla karşılaştırabilirsiniz.",
        },
      ],
    };
  }
}

/**
 * Extensible HTTP ASR provider (compatible with OpenAI/Groq Whisper or custom
 * Arabic/Quranic ASR inference endpoints). Evaluates ONLY word sequence alignment,
 * always marks requiresHumanReview=true, and never overclaims Tajweed mastery.
 */
export class ConfigurableHttpAsrProvider implements RecitationAssessmentProvider {
  readonly id = "configurable-http-asr";
  readonly displayNameTr = "Harici Kur'an ASR (Kelime Sırası Kontrolü)";
  readonly supportedScopes: AssessmentScope[] = ["sequence_check"];
  private readonly apiUrl: string;
  private readonly apiKey: string | undefined;

  constructor(
    apiUrl = process.env.QURAN_ASR_API_URL ?? "",
    apiKey = process.env.QURAN_ASR_API_KEY
  ) {
    this.apiUrl = apiUrl.trim();
    this.apiKey = apiKey?.trim() || undefined;
  }

  isConfigured(): boolean {
    return this.apiUrl.length > 0;
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
          "Bulut ASR analizi için açık onayınız kapalı. Ses kaydınız harici sunucuya gönderilmedi.",
        findings: [
          {
            kind: "listen_again_recommended",
            messageTr:
              "Otomatik kelime sırası karşılaştırması için Ayarlar'dan ses analizi onayını açabilirsiniz.",
          },
        ],
      };
    }

    if (!this.isConfigured() || !request.audioBytes || request.audioBytes.byteLength === 0) {
      return {
        providerName: this.id,
        scope: "sequence_check",
        status: "unavailable",
        confidenceScore: null,
        requiresHumanReview: true,
        summaryTr:
          "Harici ASR isteği için ses verisi veya API adresi eksik. Yerel referans karşılaştırma modu aktif.",
        findings: [
          {
            kind: "expert_verification_needed",
            messageTr: "Ses kaydınızı referans kıraatle yan yana dinleyerek değerlendirin.",
          },
        ],
      };
    }

    try {
      const form = new FormData();
      const copyBuffer = new Uint8Array(request.audioBytes).buffer;
      const blob = new Blob([copyBuffer], {
        type: request.audioMimeType || "audio/webm",
      });
      const ext = request.audioMimeType.includes("mp4") ? "m4a" : "webm";
      form.append("file", blob, `recitation.${ext}`);
      form.append("language", "ar");
      form.append("verseKey", request.verseKey);
      form.append("expectedText", request.expectedArabicText);

      const headers: Record<string, string> = {};
      if (this.apiKey) {
        headers.Authorization = `Bearer ${this.apiKey}`;
      }

      const res = await fetch(this.apiUrl, {
        method: "POST",
        headers,
        body: form,
      });

      if (!res.ok) {
        throw new Error(`ASR HTTP ${res.status}`);
      }

      const payload = (await res.json()) as {
        text?: string;
        transcript?: string;
        transcription?: string;
      };
      const transcript = (
        payload.text ??
        payload.transcript ??
        payload.transcription ??
        ""
      ).trim();

      if (!transcript) {
        return {
          providerName: this.id,
          scope: "sequence_check",
          status: "error",
          confidenceScore: 0,
          requiresHumanReview: true,
          summaryTr:
            "ASR servisinden okunabilir Arapça transkript dönmedi. Mikrofona daha yakın okuyup tekrar deneyebilirsiniz.",
          findings: [
            {
              kind: "listen_again_recommended",
              messageTr: "Sessiz bir ortamda yeniden kayıt alarak test edin.",
            },
          ],
        };
      }

      const alignment = alignAsrTranscript(
        request.expectedArabicText,
        transcript,
        request.verseKey
      );
      const pct = Math.round(alignment.wordMatchRatio * 100);

      return {
        providerName: this.id,
        scope: "sequence_check",
        status: "completed",
        confidenceScore: Number(alignment.wordMatchRatio.toFixed(3)),
        requiresHumanReview: true,
        recognizedText: transcript,
        summaryTr: `Kelime sırası eşleşmesi: %${pct} (${alignment.matchedCount}/${alignment.expectedCount} kelime). Not: Bu analiz yalnızca kelime dizisini denetler, mahreç ve tecvid kalitesini ölçmez.`,
        findings: alignment.findings,
      };
    } catch {
      return {
        providerName: this.id,
        scope: "sequence_check",
        status: "error",
        confidenceScore: null,
        requiresHumanReview: true,
        summaryTr:
          "Yapılandırılmış ASR sunucusuna şu an ulaşılamıyor. Kaydınız yerelde korunmaktadır; referans kaydı dinleyerek kontrol edebilirsiniz.",
        findings: [
          {
            kind: "expert_verification_needed",
            messageTr: "Bağlantı sağlandığında otomatik kelime eşleştirmesi yeniden çalışacaktır.",
          },
        ],
      };
    }
  }
}

export function getActiveAssessmentProvider(): RecitationAssessmentProvider {
  const httpProvider = new ConfigurableHttpAsrProvider();
  if (httpProvider.isConfigured()) {
    return httpProvider;
  }
  return new LocalComparisonOnlyProvider();
}
