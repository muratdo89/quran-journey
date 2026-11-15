"use client";

import React from "react";
import { AlertCircle, Check, Copy, Download, Info, Mic, Square, Trash2, Volume2 } from "lucide-react";
import type { RecitationRecorder } from "./useRecitationRecorder";
import type { LocalAudioBlobEntry } from "./shared";

interface RecitationStudioProps {
  verseKey: string;
  recorder: RecitationRecorder;
  cloudConsent: boolean;
  onCloudConsentChange: (value: boolean) => void;
  onPlayReference: () => void;
  onCopyTeacherReport: (rec: LocalAudioBlobEntry) => void;
}

/** Local recitation recording and honest comparison studio for the selected verse. */
export function RecitationStudio({
  verseKey,
  recorder,
  cloudConsent,
  onCloudConsentChange,
  onPlayReference,
  onCopyTeacherReport,
}: RecitationStudioProps) {
  const {
    isRecording,
    recordingError,
    verseLocalRecordings,
    serverRecordingCount,
    lastAssessment,
    teacherReportStatus,
    manualTranscript,
    aligningManual,
  } = recorder;

  return (
    <div className="rounded-2xl border border-[#e5dec9] bg-white p-5 sm:p-6 space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-bold text-[#1c241f]">
            Sesli Okuma ve Karşılaştırma ({verseKey})
          </h2>
          <p className="text-xs text-[#5a655e]">
            Kendi okumanızı tarayıcıda kalıcı saklayıp referans kâri ile dinleyin
          </p>
        </div>
        <Mic className="h-4 w-4 text-[#1b4332]" />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {!isRecording ? (
          <button
            type="button"
            onClick={recorder.startRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-[#1b4332] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#143326]"
          >
            <Mic className="h-3.5 w-3.5" />
            <span>Okumamı Kaydet</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={recorder.stopRecording}
            className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-800"
          >
            <Square className="h-3.5 w-3.5" />
            <span>Kaydı Durdur</span>
          </button>
        )}

        <button
          type="button"
          onClick={onPlayReference}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3.5 py-2.5 text-xs font-semibold text-[#1b4332] hover:bg-[#f3efe6]"
        >
          <Volume2 className="h-3.5 w-3.5" />
          <span>Referansı Dinle</span>
        </button>
      </div>

      <label className="flex items-start gap-2 text-[11px] text-[#5a655e] cursor-pointer">
        <input
          type="checkbox"
          checked={cloudConsent}
          onChange={(e) => onCloudConsentChange(e.target.checked)}
          className="mt-0.5 accent-[#1b4332]"
        />
        <span>
          Hibrit Kur&apos;an ASR kelime sırası kontrolü için okuma transkriptinin / ses kaydının analiz edilmesine açık onay veriyorum (kapalıyken hiçbir veri işlenmez).
        </span>
      </label>

      {/* Phase 7C: Optional Quick Arabic Transcript Sequence Alignment */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          recorder.alignManualTranscript();
        }}
        className="space-y-2 rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-3"
      >
        <label className="block text-[11px] font-semibold text-[#1c241f]">
          Okunan Arapça Metni Hizala / Test Et (Opsiyonel ASR Kontrolü)
        </label>
        <div className="flex flex-col sm:flex-row gap-2">
          <input
            type="text"
            lang="ar"
            dir="rtl"
            value={manualTranscript}
            onChange={(e) => recorder.setManualTranscript(e.target.value)}
            placeholder="Okuduğunuz veya dikte ettiğiniz Arapça metni girin..."
            className="flex-1 rounded-lg border border-[#e5dec9] bg-white px-3 py-1.5 text-sm font-arabic"
          />
          <button
            type="submit"
            disabled={aligningManual || !manualTranscript.trim()}
            className="rounded-lg border border-[#1b4332] bg-[#edf5f0] px-3 py-1.5 text-xs font-semibold text-[#1b4332] hover:bg-[#dcece2] disabled:opacity-50 shrink-0"
          >
            {aligningManual ? "Hizalanıyor..." : "Kelime Sırasını Kontrol Et"}
          </button>
        </div>
      </form>

      {recordingError && (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-start gap-2">
          <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
          <span>{recordingError}</span>
        </div>
      )}

      {verseLocalRecordings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs font-semibold text-[#1c241f]">Bu Ayet İçin Kayıtlarınız</p>
          {verseLocalRecordings.map((rec) => (
            <div key={rec.id} className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-2.5 space-y-2">
              <div className="flex items-center justify-between gap-2">
                <audio controls src={rec.objectUrl} className="h-8 w-full" />
                <button
                  type="button"
                  onClick={() => recorder.deleteRecording(rec.id)}
                  title="Kaydı kalıcı olarak sil"
                  className="rounded-lg p-1.5 text-red-700 hover:bg-red-50 shrink-0"
                >
                  <Trash2 className="h-4 w-4" />
                </button>
              </div>
              <div className="flex flex-wrap items-center gap-2 pt-1 border-t border-[#e5dec9]/70">
                <a
                  href={rec.objectUrl}
                  download={`quran-journey-${rec.verseKey.replace(":", "-")}.webm`}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e5dec9] bg-white px-2.5 py-1 text-[11px] font-semibold text-[#1b4332] hover:bg-[#f3efe6]"
                >
                  <Download className="h-3 w-3" />
                  <span>Ses İndir</span>
                </a>
                <button
                  type="button"
                  onClick={() => onCopyTeacherReport(rec)}
                  className="inline-flex items-center gap-1 rounded-lg border border-[#b08d57] bg-[#f7f1e3] px-2.5 py-1 text-[11px] font-semibold text-[#6e511e] hover:bg-[#efe4ca]"
                >
                  <Copy className="h-3 w-3" />
                  <span>Hoca Raporu Kopyala</span>
                </button>
              </div>
            </div>
          ))}
          {teacherReportStatus && (
            <p className="text-[11px] font-semibold text-[#2d6a4f] flex items-center gap-1.5">
              <Check className="h-3.5 w-3.5" />
              <span>{teacherReportStatus}</span>
            </p>
          )}
        </div>
      )}

      {lastAssessment && (
        <div className="rounded-xl border border-[#e3d2ae] bg-[#f7f1e3] p-3.5 text-xs text-[#4a3b1f] space-y-1.5">
          <div className="flex items-center gap-1.5 font-semibold">
            <Info className="h-4 w-4 text-[#9a7639]" />
            <span>Değerlendirme Durumu (Şeffaf Bildirim)</span>
          </div>
          <p className="leading-relaxed">{lastAssessment.summaryTr}</p>
          {lastAssessment.recognizedText && (
            <p lang="ar" dir="rtl" translate="no" className="font-arabic text-xl bg-white/80 rounded-lg px-2.5 py-1.5 text-right text-[#1c241f]">
              {lastAssessment.recognizedText}
            </p>
          )}
          {lastAssessment.findings.map((f, i) => (
            <p key={i} className="text-[11px] opacity-90">
              • {f.messageTr}
            </p>
          ))}
        </div>
      )}

      {serverRecordingCount > 0 && (
        <p className="text-[11px] text-[#5a655e]">
          Toplam kaydedilen çalışma kaydı geçmişi: {serverRecordingCount} kayıt.
        </p>
      )}
    </div>
  );
}
