"use client";

import { useEffect, useRef, useState } from "react";
import type { CanonicalVerse, MushafPageData } from "@/lib/content/types";
import type { RecordingMetadataRecord } from "@/lib/db/types";
import type { RecitationEvaluationResult } from "@/lib/audio/assessment-provider";
import { getReciterById } from "@/lib/audio/reciters";
import { buildVerseTeacherReviewPackage } from "@/lib/audio/teacher-review";
import {
  deleteLocalRecordingBlob,
  getLocalRecordingBlob,
  saveLocalRecordingBlob,
} from "@/lib/audio/local-recordings";
import { getActiveTranslation, type LocalAudioBlobEntry } from "./shared";

interface BrowserSpeechRecognitionResultItem {
  transcript: string;
}

interface BrowserSpeechRecognitionResult {
  isFinal: boolean;
  0: BrowserSpeechRecognitionResultItem;
}

interface BrowserSpeechRecognitionEvent {
  results: ArrayLike<BrowserSpeechRecognitionResult>;
}

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((event: BrowserSpeechRecognitionEvent) => void) | null;
  onerror: (() => void) | null;
  start: () => void;
  stop: () => void;
}

type BrowserSpeechRecognitionCtor = new () => BrowserSpeechRecognition;

interface UseRecitationRecorderOptions {
  selectedVerse: CanonicalVerse;
  allVersesOnPage: CanonicalVerse[];
  cloudConsent: boolean;
  initialRecordings: RecordingMetadataRecord[];
}

export interface TeacherReportContext {
  pageData: MushafPageData;
  translationId: number;
  reciterId: number;
  noteText: string;
  isDifficult: boolean;
}

/**
 * Local microphone recording (persisted in IndexedDB), optional consent-gated
 * Web Speech / ASR word-sequence check and the teacher review report.
 */
export function useRecitationRecorder({
  selectedVerse,
  allVersesOnPage,
  cloudConsent,
  initialRecordings,
}: UseRecitationRecorderOptions) {
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const createdUrlsRef = useRef<string[]>([]);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [localRecordings, setLocalRecordings] = useState<LocalAudioBlobEntry[]>([]);
  const [serverRecordings, setServerRecordings] =
    useState<RecordingMetadataRecord[]>(initialRecordings);
  const [lastAssessment, setLastAssessment] = useState<RecitationEvaluationResult | null>(
    null
  );
  const [teacherReportStatus, setTeacherReportStatus] = useState<string | null>(null);

  // Phase 7C: Browser Web Speech ar-SA & manual transcript ASR test
  const speechRecognitionRef = useRef<BrowserSpeechRecognition | null>(null);
  const speechTranscriptRef = useRef<string>("");
  const [manualTranscript, setManualTranscript] = useState("");
  const [aligningManual, setAligningManual] = useState(false);

  // Hydrate persisted IndexedDB audio blobs for recordings belonging to verses on this page
  useEffect(() => {
    let active = true;
    const verseKeysOnPage = new Set(allVersesOnPage.map((v) => v.verseKey));
    const relevantRecs = initialRecordings.filter((r) => verseKeysOnPage.has(r.verseKey));
    if (relevantRecs.length === 0) return;

    Promise.all(
      relevantRecs.map(async (r) => {
        const blob = await getLocalRecordingBlob(r.id);
        if (!blob) return null;
        const objectUrl = URL.createObjectURL(blob);
        createdUrlsRef.current.push(objectUrl);
        return {
          id: r.id,
          verseKey: r.verseKey,
          objectUrl,
          durationMs: r.durationMs,
          createdAt: r.createdAt,
        } satisfies LocalAudioBlobEntry;
      })
    ).then((hydrated) => {
      if (!active) return;
      const valid = hydrated.filter((item): item is LocalAudioBlobEntry => item !== null);
      if (valid.length > 0) {
        setLocalRecordings((prev) => {
          const seen = new Set(prev.map((x) => x.id));
          return [...prev, ...valid.filter((x) => !seen.has(x.id))];
        });
      }
    });

    return () => {
      active = false;
    };
  }, [allVersesOnPage, initialRecordings]);

  useEffect(() => {
    const urlsRef = createdUrlsRef;
    return () => {
      if (speechRecognitionRef.current) {
        try {
          speechRecognitionRef.current.stop();
        } catch {
          // Ignore cleanup errors
        }
      }
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

  async function startRecording() {
    setRecordingError(null);
    setLastAssessment(null);
    speechTranscriptRef.current = "";
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingError("Bu tarayıcı mikrofon kaydını desteklemiyor.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recordStartRef.current = Date.now();

      // Phase 7C: Parallel Web Speech Arabic transcript capture when user consented
      if (cloudConsent && typeof window !== "undefined") {
        const win = window as unknown as {
          SpeechRecognition?: BrowserSpeechRecognitionCtor;
          webkitSpeechRecognition?: BrowserSpeechRecognitionCtor;
        };
        const SpeechCtor = win.SpeechRecognition ?? win.webkitSpeechRecognition;
        if (SpeechCtor) {
          try {
            const recognition = new SpeechCtor();
            recognition.lang = "ar-SA";
            recognition.continuous = true;
            recognition.interimResults = true;
            recognition.onresult = (event) => {
              const parts: string[] = [];
              for (let i = 0; i < event.results.length; i += 1) {
                const item = event.results[i];
                if (item?.[0]?.transcript) {
                  parts.push(item[0].transcript.trim());
                }
              }
              speechTranscriptRef.current = parts.join(" ").trim();
            };
            recognition.onerror = () => {};
            speechRecognitionRef.current = recognition;
            recognition.start();
          } catch {
            speechRecognitionRef.current = null;
          }
        }
      }

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        if (speechRecognitionRef.current) {
          try {
            speechRecognitionRef.current.stop();
          } catch {
            // Ignore stop error
          }
          speechRecognitionRef.current = null;
        }

        const durationMs = Math.max(500, Date.now() - recordStartRef.current);
        const mime = recorder.mimeType || "audio/webm";
        const blob = new Blob(chunksRef.current, { type: mime });
        const objectUrl = URL.createObjectURL(blob);
        createdUrlsRef.current.push(objectUrl);
        const id = crypto.randomUUID();
        const entry: LocalAudioBlobEntry = {
          id,
          verseKey: selectedVerse.verseKey,
          objectUrl,
          durationMs,
          createdAt: new Date().toISOString(),
        };
        setLocalRecordings((prev) => [entry, ...prev]);

        // Save recording permanently in browser IndexedDB so it survives page reloads
        await saveLocalRecordingBlob(id, blob);

        const form = new FormData();
        form.append("id", id);
        form.append("verseKey", selectedVerse.verseKey);
        form.append("audioMimeType", mime);
        form.append("durationMs", String(durationMs));
        form.append("consentGranted", String(cloudConsent));
        if (cloudConsent) {
          const ext = mime.includes("mp4") ? "m4a" : "webm";
          form.append("audio", blob, `recitation.${ext}`);
          if (speechTranscriptRef.current.trim()) {
            form.append("clientTranscript", speechTranscriptRef.current.trim());
          }
        }

        const res = await fetch("/api/audio/assess", {
          method: "POST",
          body: form,
        });
        if (res.ok) {
          const data = await res.json();
          setServerRecordings((prev) => [data.record, ...prev]);
          setLastAssessment(data.assessment);
        }
      };

      mediaRecorderRef.current = recorder;
      recorder.start();
      setIsRecording(true);
    } catch {
      setRecordingError(
        "Mikrofon izni verilmedi veya mikrofon bulunamadı. Tarayıcı izinlerini kontrol edin."
      );
    }
  }

  function stopRecording() {
    if (speechRecognitionRef.current) {
      try {
        speechRecognitionRef.current.stop();
      } catch {
        // Ignore stop error
      }
    }
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  async function alignManualTranscript() {
    const cleaned = manualTranscript.trim();
    if (!cleaned) return;
    setAligningManual(true);
    try {
      const res = await fetch("/api/audio/assess", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verseKey: selectedVerse.verseKey,
          audioMimeType: "text/plain",
          durationMs: 1000,
          consentGranted: cloudConsent,
          clientTranscript: cleaned,
        }),
      });
      if (res.ok) {
        const data = await res.json();
        setLastAssessment(data.assessment);
      }
    } finally {
      setAligningManual(false);
    }
  }

  async function deleteRecording(id: string) {
    setLocalRecordings((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((r) => r.id !== id);
    });
    setServerRecordings((prev) => prev.filter((r) => r.id !== id));
    await deleteLocalRecordingBlob(id);
    await fetch("/api/audio/assess", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function copyTeacherReport(rec: LocalAudioBlobEntry, context: TeacherReportContext) {
    const verseSection = context.pageData.sections.find(
      (s) => s.surah.id === selectedVerse.surahId
    );
    const surahNameTr = verseSection
      ? `${verseSection.surah.nameTurkish} Suresi`
      : `Sure ${selectedVerse.surahId}`;
    const activeTrans = getActiveTranslation(selectedVerse, context.translationId);

    const pkg = buildVerseTeacherReviewPackage({
      verseKey: selectedVerse.verseKey,
      pageNumber: selectedVerse.pageNumber,
      surahNameTr,
      textUthmani: selectedVerse.textUthmani,
      translationTr: activeTrans?.text ?? "",
      durationMs: rec.durationMs,
      createdAt: rec.createdAt,
      reciterNameTr: getReciterById(context.reciterId).nameTr,
      noteText: context.noteText,
      isDifficult: context.isDifficult,
      assessment: lastAssessment,
    });

    try {
      if (navigator.clipboard && typeof navigator.clipboard.writeText === "function") {
        await navigator.clipboard.writeText(pkg.reportMarkdownTr);
        setTeacherReportStatus(
          "Hoca inceleme raporu panoya kopyalandı. Ses dosyasını da indirip hocanıza iletebilirsiniz."
        );
        return;
      }
    } catch {
      // Fallback to downloadable Markdown file below
    }

    const mdBlob = new Blob([pkg.reportMarkdownTr], {
      type: "text/markdown;charset=utf-8",
    });
    const url = URL.createObjectURL(mdBlob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `quran-journey-${rec.verseKey.replace(":", "-")}-hoca-raporu.md`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
    setTeacherReportStatus("Hoca inceleme raporu (.md) cihazınıza indirildi.");
  }

  return {
    isRecording,
    recordingError,
    verseLocalRecordings: localRecordings.filter((r) => r.verseKey === selectedVerse.verseKey),
    serverRecordingCount: serverRecordings.length,
    lastAssessment,
    teacherReportStatus,
    clearTeacherReportStatus: () => setTeacherReportStatus(null),
    manualTranscript,
    setManualTranscript,
    aligningManual,
    startRecording,
    stopRecording,
    alignManualTranscript,
    deleteRecording,
    copyTeacherReport,
  };
}

export type RecitationRecorder = ReturnType<typeof useRecitationRecorder>;
