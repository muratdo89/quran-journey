"use client";

import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  CheckCircle2,
  Headphones,
  Keyboard,
  Mic,
  MicOff,
  Send,
  Settings2,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from "lucide-react";
import { playSharedClip, stopSharedAudio, unlockSharedAudio } from "@/lib/audio/shared-player";
import { speakTurkishCoaching, stopTurkishSpeech } from "@/lib/audio/turkish-tts";
import { HandsFreeVadRecorder } from "@/lib/audio/vad-recorder";
import { buildTodayPlan, currentNewPage } from "@/lib/hifz/plan";
import { useHifzStore } from "@/lib/hifz/store";
import {
  createInitialTutorSessionState,
  type TutorAudioCue,
  type TutorPhase,
  type TutorSessionState,
  type TutorStageCard,
  type TutorTurnResponse,
} from "@/lib/tutor/types";
import { cn } from "@/lib/utils";

interface VoiceTutorClientProps {
  initialPageNumber: number;
  preferredReciterId: number;
  initialCloudConsent: boolean;
  geminiConfigured: boolean;
  groqConfigured: boolean;
}

type VoiceStatus =
  | "idle"
  | "thinking"
  | "teacher_speaking"
  | "quran_playing"
  | "listening"
  | "capturing_speech";

const PHASE_LABELS_TR: Record<TutorPhase, string> = {
  welcome: "Karşılama",
  reading: "Okuma Isınması",
  tajweed: "Tecvid Isınması",
  vocabulary: "Kelime Tekrarı",
  hifz_listen: "Dinle & Takip Et",
  hifz_recite: "Sesli Okuma",
  wrap_up: "Ders Özeti",
};

interface BrowserSpeechRecognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  onresult: ((ev: { results: ArrayLike<ArrayLike<{ transcript: string }>> }) => void) | null;
  onerror: ((ev: { error?: string }) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

function createBrowserRecognition(): BrowserSpeechRecognition | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: new () => BrowserSpeechRecognition;
    webkitSpeechRecognition?: new () => BrowserSpeechRecognition;
  };
  const Ctor = w.SpeechRecognition ?? w.webkitSpeechRecognition;
  return Ctor ? new Ctor() : null;
}

export function VoiceTutorClient({
  initialPageNumber,
  preferredReciterId,
  initialCloudConsent,
  geminiConfigured,
  groqConfigured,
}: VoiceTutorClientProps) {
  // Sync with the learner's real HifzStore plan (localStorage) instead of always defaulting to page 1
  const hifzStore = useHifzStore();
  const hifzSync = useMemo(() => {
    if (!hifzStore?.settings) {
      return { activePage: initialPageNumber, reviewPages: [] as number[] };
    }
    const plan = buildTodayPlan(hifzStore);
    const activePage =
      plan.newLesson?.page ??
      plan.recent[0] ??
      plan.manzil[0] ??
      currentNewPage(hifzStore) ??
      hifzStore.settings.startPage ??
      initialPageNumber;
    const reviewPages = [...plan.recent, ...plan.manzil];
    return { activePage, reviewPages };
  }, [hifzStore, initialPageNumber]);

  const [started, setStarted] = useState(false);
  const [status, setStatus] = useState<VoiceStatus>("idle");
  const [voiceMuted, setVoiceMuted] = useState(false);
  const [autoListen, setAutoListen] = useState(true);
  const [cloudConsent, setCloudConsent] = useState(
    initialCloudConsent || geminiConfigured || groqConfigured
  );
  const [showTechDrawer, setShowTechDrawer] = useState(false);
  const [showKeyboard, setShowKeyboard] = useState(false);
  const [textInput, setTextInput] = useState("");
  const [micLevel, setMicLevel] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [diagnosticMsg, setDiagnosticMsg] = useState<string | null>(null);
  const [testingApi, setTestingApi] = useState(false);
  const [apiHealthMsg, setApiHealthMsg] = useState<{ ok: boolean; text: string } | null>(null);

  const [sessionState, setSessionState] = useState<TutorSessionState>(() =>
    createInitialTutorSessionState(initialPageNumber)
  );
  const [replyTr, setReplyTr] = useState<string>(
    "Tek dokunuşla dersi başlat; bundan sonra konuşarak ilerleyebilirsin."
  );
  const [stageCard, setStageCard] = useState<TutorStageCard | null>(null);
  const [lastAudioCue, setLastAudioCue] = useState<TutorAudioCue | null>(null);
  const [suggestedCommands, setSuggestedCommands] = useState<string[]>([
    "Normal başlayalım",
    "5 dakika yapalım",
  ]);
  const [providerMode, setProviderMode] = useState<"gemini" | "local_guided">(
    geminiConfigured ? "gemini" : "local_guided"
  );
  const [expectingLang, setExpectingLang] = useState<"tr" | "ar">("tr");

  const vadRef = useRef<HandsFreeVadRecorder | null>(null);
  const speechRecRef = useRef<BrowserSpeechRecognition | null>(null);
  const wakeLockRef = useRef<{ release: () => Promise<void> } | null>(null);
  const sessionStateRef = useRef(sessionState);
  const expectingLangRef = useRef(expectingLang);
  const autoListenRef = useRef(autoListen);
  const voiceMutedRef = useRef(voiceMuted);
  const cloudConsentRef = useRef(cloudConsent);
  const stageCardRef = useRef(stageCard);
  const disposedRef = useRef(false);
  const turnSeqRef = useRef(0);
  const submitTurnRef = useRef<
    ((payload: {
      action?: "start" | "user_speech" | "recitation_result";
      userText?: string;
      recitationTranscript?: string;
    }) => Promise<void>) | null
  >(null);

  useEffect(() => {
    sessionStateRef.current = sessionState;
  }, [sessionState]);
  useEffect(() => {
    expectingLangRef.current = expectingLang;
  }, [expectingLang]);
  useEffect(() => {
    autoListenRef.current = autoListen;
  }, [autoListen]);
  useEffect(() => {
    voiceMutedRef.current = voiceMuted;
  }, [voiceMuted]);
  useEffect(() => {
    cloudConsentRef.current = cloudConsent;
  }, [cloudConsent]);
  useEffect(() => {
    stageCardRef.current = stageCard;
  }, [stageCard]);

  const useCloudStt = (groqConfigured || geminiConfigured) && cloudConsent;

  const stopAllAudioAndMic = useCallback(() => {
    stopTurkishSpeech();
    stopSharedAudio();
    vadRef.current?.pauseListening();
    try {
      speechRecRef.current?.stop();
    } catch {
      /* ignore */
    }
    speechRecRef.current = null;
  }, []);

  const startBrowserSpeechListening = useCallback(() => {
    if (disposedRef.current) return;
    const rec = createBrowserRecognition();
    if (!rec) {
      setStatus("idle");
      setErrorMsg(
        "Bu tarayıcıda yerleşik ses tanıma bulunamadı. Alttaki klavye simgesinden yazarak devam edebilirsin."
      );
      return;
    }

    try {
      speechRecRef.current?.stop();
    } catch {
      /* ignore */
    }

    rec.lang = expectingLangRef.current === "ar" ? "ar-SA" : "tr-TR";
    rec.continuous = false;
    rec.interimResults = false;
    speechRecRef.current = rec;
    setStatus("listening");

    rec.onresult = (ev) => {
      const transcript = ev.results[0]?.[0]?.transcript?.trim() ?? "";
      if (transcript) {
        if (expectingLangRef.current === "ar") {
          void submitTurnRef.current?.({
            action: "recitation_result",
            recitationTranscript: transcript,
            userText: transcript,
          });
        } else {
          void submitTurnRef.current?.({
            action: "user_speech",
            userText: transcript,
          });
        }
      }
    };

    rec.onerror = (ev) => {
      if (ev.error === "no-speech" || ev.error === "aborted") {
        setStatus("idle");
        return;
      }
      setStatus("idle");
    };

    rec.onend = () => {
      if (speechRecRef.current === rec) {
        speechRecRef.current = null;
      }
    };

    try {
      rec.start();
    } catch {
      setStatus("idle");
    }
  }, []);

  const resumeListeningNow = useCallback(() => {
    if (disposedRef.current || !autoListenRef.current) {
      setStatus("idle");
      return;
    }
    if ((groqConfigured || geminiConfigured) && cloudConsentRef.current && vadRef.current) {
      vadRef.current.updateOptions({
        silenceHoldMs: expectingLangRef.current === "ar" ? 2000 : 1050,
        cooldownMs: 350,
      });
      vadRef.current.resumeListening();
      setStatus("listening");
    } else {
      startBrowserSpeechListening();
    }
  }, [geminiConfigured, groqConfigured, startBrowserSpeechListening]);

  const handleUtteranceBlob = useCallback(
    async (blob: Blob) => {
      vadRef.current?.pauseListening();
      setStatus("thinking");
      setErrorMsg(null);

      try {
        const form = new FormData();
        form.append("audio", blob, "utterance.webm");
        form.append("language", expectingLangRef.current);
        form.append("consentGranted", String(cloudConsentRef.current));
        if (
          expectingLangRef.current === "ar" &&
          stageCardRef.current?.kind === "verse_study"
        ) {
          form.append("expectedArabicPrompt", stageCardRef.current.textUthmani);
        }

        const res = await fetch("/api/tutor/transcribe", {
          method: "POST",
          body: form,
        });
        const data = (await res.json()) as {
          status?: string;
          transcript?: string;
        };

        if (data.status === "client_fallback") {
          startBrowserSpeechListening();
          return;
        }

        const transcript = (data.transcript ?? "").trim();
        if (!transcript) {
          // Quietly keep listening on ambient blips instead of flashing an annoying error
          resumeListeningNow();
          return;
        }

        if (expectingLangRef.current === "ar") {
          await submitTurnRef.current?.({
            action: "recitation_result",
            recitationTranscript: transcript,
            userText: transcript,
          });
        } else {
          await submitTurnRef.current?.({
            action: "user_speech",
            userText: transcript,
          });
        }
      } catch {
        setErrorMsg("Ses gönderilirken bağlantı hatası oluştu.");
        setStatus("idle");
      }
    },
    [resumeListeningNow, startBrowserSpeechListening]
  );

  const playVerifiedQuranCue = useCallback(async (cue: TutorAudioCue, mySeq: number) => {
    setStatus("quran_playing");
    const loops = Math.max(1, Math.min(3, cue.repeatCount ?? 1));
    const rate = cue.playbackRate ?? 1;

    for (let i = 0; i < loops; i += 1) {
      if (disposedRef.current || turnSeqRef.current !== mySeq) return;
      const clip = playSharedClip(cue.url, { rate });
      const res = await clip.done;
      if (res.status === "stopped" || res.status === "error" || res.status === "blocked") {
        return;
      }
      if (i + 1 < loops) {
        await new Promise((r) => window.setTimeout(r, 450));
      }
    }
  }, []);

  const submitTurn = useCallback(
    async (payload: {
      action?: "start" | "user_speech" | "recitation_result";
      userText?: string;
      recitationTranscript?: string;
    }) => {
      const mySeq = ++turnSeqRef.current;
      stopAllAudioAndMic();
      setStatus("thinking");
      setErrorMsg(null);

      try {
        const res = await fetch("/api/tutor/turn", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            ...payload,
            reciterId: preferredReciterId,
            hifzActivePage: payload.action === "start" ? hifzSync.activePage : undefined,
            hifzReviewPages: payload.action === "start" ? hifzSync.reviewPages : undefined,
            skipInlineTts: true, // Return text + card immediately (~1s), then fetch TTS separately
            sessionState: sessionStateRef.current,
          }),
        });

        if (!res.ok) {
          throw new Error(`HTTP ${res.status}`);
        }

        const data = (await res.json()) as TutorTurnResponse;
        if (disposedRef.current || turnSeqRef.current !== mySeq) return;

        // Immediately render text reply & canonical stage card!
        setSessionState(data.sessionState);
        sessionStateRef.current = data.sessionState;
        setReplyTr(data.replyTr);
        setStageCard(data.stageCard);
        stageCardRef.current = data.stageCard;
        setLastAudioCue(data.audioCue);
        setSuggestedCommands(data.suggestedVoiceCommandsTr);
        setProviderMode(data.providerMode);
        setDiagnosticMsg(data.providerDiagnosticTr ?? null);
        setExpectingLang(data.expectingLanguage);
        expectingLangRef.current = data.expectingLanguage;

        // 1. Speak Turkish coaching guidance via fast cached /api/tutor/tts (Gemini natural voice)
        if (!voiceMutedRef.current) {
          setStatus("teacher_speaking");
          let playedGeminiVoice = false;

          if (geminiConfigured) {
            try {
              const ttsRes = await fetch("/api/tutor/tts", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ text: data.replyTr }),
              });
              if (ttsRes.ok) {
                const ttsJson = (await ttsRes.json()) as {
                  audioDataUrl?: string | null;
                  errorTr?: string;
                };
                if (disposedRef.current || turnSeqRef.current !== mySeq) return;
                if (ttsJson.audioDataUrl) {
                  const teacherClip = playSharedClip(ttsJson.audioDataUrl);
                  const clipRes = await teacherClip.done;
                  if (clipRes.status === "ended" || clipRes.status === "stopped") {
                    playedGeminiVoice = true;
                  }
                }
              }
            } catch {
              /* fallback below */
            }
          }

          if (!playedGeminiVoice && !disposedRef.current && turnSeqRef.current === mySeq) {
            await speakTurkishCoaching(data.replyTr);
          }
          if (disposedRef.current || turnSeqRef.current !== mySeq) return;
        }

        // 2. Play verified Quranic audio (NEVER AI TTS!) if cue is present
        if (data.audioCue?.autoPlay && data.audioCue.url) {
          await playVerifiedQuranCue(data.audioCue, mySeq);
          if (disposedRef.current || turnSeqRef.current !== mySeq) return;
        }

        // 3. Resume hands-free listening automatically (with 350ms echo cooldown)
        if (data.phase !== "wrap_up") {
          resumeListeningNow();
        } else {
          setStatus("idle");
        }
      } catch {
        if (turnSeqRef.current !== mySeq) return;
        setErrorMsg("Hocaya şu an ulaşılamadı. Tekrar deneyebilir veya dokunmatik moda geçebilirsin.");
        setStatus("idle");
      }
    },
    [
      geminiConfigured,
      hifzSync.activePage,
      hifzSync.reviewPages,
      playVerifiedQuranCue,
      preferredReciterId,
      resumeListeningNow,
      stopAllAudioAndMic,
    ]
  );

  useEffect(() => {
    submitTurnRef.current = submitTurn;
  }, [submitTurn]);

  useEffect(() => {
    disposedRef.current = false;
    return () => {
      disposedRef.current = true;
      stopAllAudioAndMic();
      vadRef.current?.dispose();
      vadRef.current = null;
      wakeLockRef.current?.release().catch(() => {});
      wakeLockRef.current = null;
    };
  }, [stopAllAudioAndMic]);

  async function handleStartSession() {
    unlockSharedAudio();
    setStarted(true);
    setErrorMsg(null);

    try {
      const nav = navigator as Navigator & {
        wakeLock?: { request: (type: "screen") => Promise<{ release: () => Promise<void> }> };
      };
      if (nav.wakeLock) {
        wakeLockRef.current = await nav.wakeLock.request("screen");
      }
    } catch {
      /* optional wake lock */
    }

    if (useCloudStt) {
      const vad = new HandsFreeVadRecorder({
        silenceHoldMs: 1050,
        cooldownMs: 350,
        onSpeechStart: () => setStatus("capturing_speech"),
        onLevel: (rms) => setMicLevel(Math.min(1, rms * 8)),
        onUtteranceReady: (blob) => {
          void handleUtteranceBlob(blob);
        },
        onError: (msg) => setErrorMsg(msg),
      });
      const ok = await vad.init();
      if (ok) {
        vadRef.current = vad;
      }
    }

    await submitTurn({ action: "start" });
  }

  function handlePrimaryMicButton() {
    if (status === "teacher_speaking" || status === "quran_playing") {
      // Barge-in: cancel current turn audio immediately and listen
      turnSeqRef.current += 1;
      stopAllAudioAndMic();
      resumeListeningNow();
      return;
    }

    if (status === "capturing_speech") {
      vadRef.current?.stopManualCapture();
      return;
    }

    if (status === "listening") {
      stopAllAudioAndMic();
      setStatus("idle");
      return;
    }

    if (useCloudStt && vadRef.current) {
      vadRef.current.startManualCapture();
      setStatus("capturing_speech");
    } else {
      startBrowserSpeechListening();
    }
  }

  async function handleReplayAudio() {
    if (!lastAudioCue?.url) return;
    const mySeq = ++turnSeqRef.current;
    stopAllAudioAndMic();
    await playVerifiedQuranCue(lastAudioCue, mySeq);
    if (turnSeqRef.current === mySeq) {
      resumeListeningNow();
    }
  }

  async function handleManualTextSend(e: React.FormEvent) {
    e.preventDefault();
    const cleaned = textInput.trim();
    if (!cleaned) return;
    setTextInput("");
    await submitTurn(
      expectingLang === "ar"
        ? { action: "recitation_result", recitationTranscript: cleaned, userText: cleaned }
        : { action: "user_speech", userText: cleaned }
    );
  }

  async function handleTestApi() {
    setTestingApi(true);
    setApiHealthMsg(null);
    try {
      const res = await fetch("/api/tutor/health");
      const json = (await res.json()) as {
        gemini?: { ok: boolean; messageTr: string };
      };
      setApiHealthMsg({
        ok: Boolean(json.gemini?.ok),
        text: json.gemini?.messageTr ?? "Durum alınamadı.",
      });
    } catch {
      setApiHealthMsg({ ok: false, text: "Test isteği başarısız oldu." });
    } finally {
      setTestingApi(false);
    }
  }

  // Serene, uncluttered pre-start entry screen (technical details tucked inside corner settings icon)
  if (!started) {
    return (
      <div className="mx-auto flex min-h-[82vh] max-w-xl flex-col justify-center px-2 py-6">
        <div className="rounded-[28px] border border-line bg-surface p-6 sm:p-8 shadow-[0_1px_0_rgba(31,42,35,0.04),0_12px_32px_-18px_rgba(27,67,50,0.18)] space-y-6">
          <div className="flex items-center justify-between">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint px-3 py-1 text-xs font-semibold text-forest">
              <Sparkles className="h-3.5 w-3.5" />
              Sayfa {hifzSync.activePage}
              {hifzSync.reviewPages.length > 0 ? ` · ${hifzSync.reviewPages.length} tekrar` : ""}
            </span>
            <div className="flex items-center gap-1.5">
              <button
                type="button"
                onClick={() => setShowTechDrawer((v) => !v)}
                aria-label="Ses ve API ayarları"
                className={cn(
                  "inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted hover:text-forest",
                  showTechDrawer && "bg-mint text-forest border-forest/30"
                )}
              >
                <Settings2 className="h-4 w-4" />
              </button>
              <Link
                href="/"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line text-muted hover:text-forest"
                aria-label="Kapat"
              >
                <X className="h-4 w-4" />
              </Link>
            </div>
          </div>

          <div className="space-y-2 text-center py-2">
            <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight text-ink">
              Hocayla günlük dersine hazırsın.
            </h1>
            <p className="text-sm text-muted leading-relaxed">
              Tek dokunuşla başla; dilediğin sureyi aç, yavaşlat, tekrar dinlet veya aklına takılanı sesle sor.
            </p>
          </div>

          {showTechDrawer && (
            <div className="rounded-2xl border border-line bg-parchment/70 p-4 space-y-2.5 text-xs text-ink-soft">
              <div className="flex items-center justify-between gap-2">
                <p className="font-semibold text-ink">Bağlantı &amp; Ses Durumu</p>
                <button
                  type="button"
                  disabled={testingApi}
                  onClick={handleTestApi}
                  className="rounded-full border border-forest/30 bg-surface px-3 py-1 text-[11px] font-semibold text-forest hover:bg-mint disabled:opacity-50"
                >
                  {testingApi ? "Test ediliyor..." : "API Test Et"}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full bg-surface border border-line px-2.5 py-1">
                  Hoca Sesi: {geminiConfigured ? "Gemini Doğal Ses" : "Yerel Rehber"}
                </span>
                <span className="rounded-full bg-surface border border-line px-2.5 py-1">
                  Kıraat Dinleme: {groqConfigured ? "Groq Whisper" : geminiConfigured ? "Gemini Ses" : "Tarayıcı"}
                </span>
              </div>
              {apiHealthMsg && (
                <p
                  className={cn(
                    "rounded-xl px-3 py-2 text-[11px] leading-relaxed",
                    apiHealthMsg.ok
                      ? "bg-mint text-forest font-medium"
                      : "bg-amber-50 border border-amber-300 text-amber-950"
                  )}
                >
                  {apiHealthMsg.text}
                </p>
              )}
              {(geminiConfigured || groqConfigured) && (
                <label className="mt-1 flex items-start gap-2 pt-1 cursor-pointer text-[11px] text-muted">
                  <input
                    type="checkbox"
                    checked={cloudConsent}
                    onChange={(e) => setCloudConsent(e.target.checked)}
                    className="mt-0.5 accent-forest"
                  />
                  <span>
                    Sesimin bu dersteki konuşma ve kelime sırası kontrolü için işlenmesine onay veriyorum (tecvid kalitesi için uzman hoca teyidi esastır).
                  </span>
                </label>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={handleStartSession}
            className="flex w-full items-center justify-center gap-3 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment shadow-sm shadow-forest/20 transition-colors hover:bg-forest-deep"
          >
            <Mic className="h-5 w-5" />
            <span>Hocayla Derse Başla</span>
          </button>

          <div className="text-center">
            <Link href="/hifz" className="text-xs font-semibold text-muted hover:text-forest">
              Sessiz ortamdayım, dokunmatik Hıfz&apos;a geç
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const recentDialogue = sessionState.history.slice(-4);

  return (
    <div className="mx-auto flex min-h-[88vh] max-w-2xl flex-col justify-between pb-6">
      {/* Minimal Focus Top Bar */}
      <header className="flex items-center justify-between gap-2 border-b border-line pb-3">
        <div className="flex items-center gap-2">
          <span className="rounded-full bg-mint px-3 py-1 text-xs font-semibold text-forest">
            {PHASE_LABELS_TR[sessionState.phase]}
          </span>
          <span className="text-xs text-muted">
            Sayfa {sessionState.currentPageNumber}
          </span>
          {sessionState.playbackRate !== 1 && (
            <span className="rounded-full border border-line px-2 py-0.5 text-[10px] font-semibold text-forest">
              {sessionState.playbackRate}x
            </span>
          )}
          <span className="hidden sm:inline rounded-full border border-line px-2 py-0.5 text-[10px] text-muted">
            {providerMode === "gemini" ? "Gemini" : "Yerel Rehber"}
          </span>
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => {
              const next = !voiceMuted;
              setVoiceMuted(next);
              if (next) stopTurkishSpeech();
            }}
            aria-label={voiceMuted ? "Hoca sesini aç" : "Hoca sesini kapat"}
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-ink-soft hover:text-forest"
          >
            {voiceMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>
          <button
            type="button"
            onClick={() => setAutoListen((v) => !v)}
            className={cn(
              "rounded-full border px-3 py-1.5 text-[11px] font-semibold",
              autoListen
                ? "border-forest/30 bg-mint text-forest"
                : "border-line bg-surface text-muted"
            )}
          >
            {autoListen ? "Eller Serbest" : "Manuel"}
          </button>
          <Link
            href="/"
            onClick={() => stopAllAudioAndMic()}
            aria-label="Dersten çık"
            className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-forest"
          >
            <X className="h-4 w-4" />
          </Link>
        </div>
      </header>

      {/* Main Synced Stage Area */}
      <main className="my-4 flex-1 space-y-4">
        {/* Canonical Visual Card Synced with Teacher */}
        {stageCard && (
          <StageCardView
            card={stageCard}
            onReplayAudio={lastAudioCue ? handleReplayAudio : undefined}
          />
        )}

        {/* AI Teacher Voice Bubble + Compact Dialogue Context */}
        <section className="rounded-2xl border border-line bg-surface p-4 sm:p-5 shadow-xs space-y-2.5">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-semibold text-forest flex items-center gap-1.5">
              <Headphones className="h-3.5 w-3.5" />
              Hoca
            </span>
            <span>
              {status === "thinking"
                ? "Düşünüyor..."
                : status === "teacher_speaking"
                  ? "Konuşuyor..."
                  : status === "quran_playing"
                    ? "Referans kıraat çalıyor..."
                    : status === "capturing_speech"
                      ? "Seni dinliyor..."
                      : status === "listening"
                        ? expectingLang === "ar"
                          ? "Okumanı bekliyor..."
                          : "Dinliyor..."
                        : "Hazır"}
            </span>
          </div>

          <p className="text-base leading-relaxed text-ink">{replyTr}</p>

          {recentDialogue.length > 1 && (
            <div className="border-t border-line pt-2 space-y-1 max-h-24 overflow-y-auto">
              {recentDialogue.slice(0, -1).map((m, idx) => (
                <p
                  key={`${m.role}-${idx}`}
                  className={cn(
                    "text-[11px] leading-snug",
                    m.role === "user" ? "text-forest font-medium" : "text-muted"
                  )}
                >
                  {m.role === "user" ? "Sen: " : "Hoca: "}
                  {m.text}
                </p>
              ))}
            </div>
          )}
        </section>

        {diagnosticMsg && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950 leading-relaxed">
            {diagnosticMsg}
          </p>
        )}

        {errorMsg && (
          <p className="rounded-xl border border-amber-300 bg-amber-50 px-4 py-2.5 text-xs text-amber-950">
            {errorMsg}
          </p>
        )}
      </main>

      {/* Bottom Hands-Free Control Bar (Minimal Taps) */}
      <footer className="space-y-3 pt-2">
        {suggestedCommands.length > 0 && (
          <div className="flex flex-wrap justify-center gap-2">
            {suggestedCommands.map((cmd) => (
              <button
                key={cmd}
                type="button"
                onClick={() => void submitTurn({ action: "user_speech", userText: cmd })}
                className="rounded-full border border-line bg-surface px-3.5 py-1.5 text-xs font-medium text-ink-soft hover:border-forest hover:text-forest"
              >
                &ldquo;{cmd}&rdquo;
              </button>
            ))}
          </div>
        )}

        {showKeyboard && (
          <form onSubmit={handleManualTextSend} className="flex gap-2">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder={
                expectingLang === "ar"
                  ? "Arapça ayeti veya Türkçe komutu yaz..."
                  : "Sorunu veya komutunu yaz (ör. Bakara suresine geç)..."
              }
              className="flex-1 rounded-xl border border-line bg-surface px-3.5 py-2.5 text-sm text-ink"
            />
            <button
              type="submit"
              className="inline-flex items-center justify-center rounded-xl bg-forest px-4 py-2.5 text-parchment hover:bg-forest-deep"
              aria-label="Gönder"
            >
              <Send className="h-4 w-4" />
            </button>
          </form>
        )}

        <div className="flex items-center justify-center gap-4">
          <button
            type="button"
            onClick={() => setShowKeyboard((v) => !v)}
            aria-label="Klavye ile yaz"
            className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-muted hover:text-forest"
          >
            <Keyboard className="h-4 w-4" />
          </button>

          <button
            type="button"
            onClick={handlePrimaryMicButton}
            className={cn(
              "relative flex h-16 min-w-[200px] items-center justify-center gap-2.5 rounded-full px-7 text-sm font-semibold shadow-md transition-all",
              status === "capturing_speech"
                ? "bg-amber-600 text-white"
                : status === "listening"
                  ? "bg-forest text-parchment ring-4 ring-forest/20"
                  : status === "teacher_speaking" || status === "quran_playing"
                    ? "bg-sand-strong text-ink border border-line"
                    : "bg-forest text-parchment hover:bg-forest-deep"
            )}
            style={
              status === "capturing_speech"
                ? { transform: `scale(${1 + micLevel * 0.06})` }
                : undefined
            }
          >
            {status === "listening" || status === "capturing_speech" ? (
              <Mic className="h-5 w-5" />
            ) : (
              <MicOff className="h-5 w-5" />
            )}
            <span>
              {status === "capturing_speech"
                ? "Dinliyor... (Bitir)"
                : status === "listening"
                  ? expectingLang === "ar"
                    ? "Ayeti Oku (Dinliyor)"
                    : "Konuşabilirsin"
                  : status === "teacher_speaking" || status === "quran_playing"
                    ? "Durdur & Konuş"
                    : status === "thinking"
                      ? "Hazırlanıyor..."
                      : "Konuş"}
            </span>
          </button>

          {lastAudioCue ? (
            <button
              type="button"
              onClick={handleReplayAudio}
              aria-label="Referans sesi tekrar dinle"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full border border-line bg-surface text-forest hover:bg-mint"
            >
              <Volume2 className="h-4 w-4" />
            </button>
          ) : (
            <div className="h-11 w-11" />
          )}
        </div>
      </footer>
    </div>
  );
}

function StageCardView({
  card,
  onReplayAudio,
}: {
  card: TutorStageCard;
  onReplayAudio?: () => void;
}) {
  if (card.kind === "brief") {
    return (
      <section className="rounded-2xl border border-line bg-parchment/70 p-5 space-y-2 text-sm">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted">Bugünkü Ders Planı</p>
        <p className="font-semibold text-ink">
          Sayfa {card.pageNumber} · {card.surahNameTr} (~{card.estimatedMinutes} dk)
        </p>
        <div className="flex flex-wrap gap-2 text-xs text-ink-soft pt-1">
          <span className="rounded-full bg-surface border border-line px-3 py-1">
            Tekrar bekleyen kelime: {card.dueCardsCount}
          </span>
          {card.remainingReadingModules > 0 && (
            <span className="rounded-full bg-surface border border-line px-3 py-1">
              Okuma modülü: {card.remainingReadingModules} kaldı
            </span>
          )}
          {card.remainingTajweedLessons > 0 && (
            <span className="rounded-full bg-surface border border-line px-3 py-1">
              Tecvid dersi: {card.remainingTajweedLessons} kaldı
            </span>
          )}
        </div>
      </section>
    );
  }

  if (card.kind === "reading_module") {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5 space-y-3">
        <div>
          <p className="text-xs font-semibold text-forest">{card.subtitleTr}</p>
          <h2 className="text-lg font-bold text-ink">{card.titleTr}</h2>
        </div>
        <p className="text-sm text-ink-soft leading-relaxed">{card.explanationTr}</p>
        <div className="flex flex-wrap gap-2.5 pt-1">
          {card.examples.map((ex, i) => (
            <button
              key={`${ex.arabic}-${i}`}
              type="button"
              onClick={() => ex.audioUrl && void playSharedClip(ex.audioUrl).done}
              className="rounded-xl border border-line bg-parchment px-3.5 py-2 text-right hover:border-forest"
            >
              <span lang="ar" dir="rtl" translate="no" className="block font-arabic text-2xl text-ink">
                {ex.arabic}
              </span>
              <span className="text-[11px] text-muted">{ex.labelTr}</span>
            </button>
          ))}
        </div>
      </section>
    );
  }

  if (card.kind === "tajweed_lesson") {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5 space-y-3">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-ink">{card.nameTr}</h2>
          <span lang="ar" dir="rtl" translate="no" className="font-arabic text-xl text-forest">
            {card.nameArabic}
          </span>
        </div>
        <p className="text-sm text-ink-soft leading-relaxed">{card.summaryTr}</p>
        {card.exampleArabic && (
          <div className="rounded-xl border border-line bg-parchment p-4 text-center space-y-1">
            <p lang="ar" dir="rtl" translate="no" className="font-arabic text-3xl text-ink">
              {card.exampleArabic}
            </p>
            {card.exampleExplanationTr && (
              <p className="text-xs text-muted">{card.exampleExplanationTr}</p>
            )}
          </div>
        )}
      </section>
    );
  }

  if (card.kind === "vocabulary_quiz") {
    return (
      <section className="rounded-2xl border border-line bg-surface p-6 text-center space-y-3">
        {card.previousResult && (
          <div
            className={cn(
              "inline-flex items-center gap-2 rounded-full px-3.5 py-1 text-xs font-medium",
              card.previousResult.correct
                ? "bg-mint text-forest"
                : "bg-amber-50 text-amber-900 border border-amber-200"
            )}
          >
            <span>{card.previousResult.correct ? "Doğru:" : "Doğrusu:"}</span>
            <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base leading-none">
              {card.previousResult.textUthmani}
            </span>
            <span>→ {card.previousResult.meaningTr}</span>
          </div>
        )}
        <p className="text-xs font-medium text-muted">
          {card.surahNameTr} · {card.verseKey}
        </p>
        <p lang="ar" dir="rtl" translate="no" className="font-arabic text-4xl sm:text-5xl text-ink py-2">
          {card.textUthmani}
        </p>
        {card.turkishReading && (
          <p className="text-xs text-muted">{card.turkishReading}</p>
        )}
        {card.showHint && card.rootArabic && !card.revealed && (
          <p className="text-xs text-forest">
            İpucu · Kök:{" "}
            <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base">
              {card.rootArabic}
            </span>
          </p>
        )}
        {card.revealed && (
          <div className="rounded-xl bg-mint/60 px-4 py-3 text-sm font-semibold text-forest">
            {card.meaningTr}
          </div>
        )}
        {onReplayAudio && (
          <button
            type="button"
            onClick={onReplayAudio}
            className="inline-flex items-center gap-1.5 rounded-full border border-line bg-parchment px-3.5 py-1.5 text-xs font-semibold text-forest hover:bg-mint"
          >
            <Volume2 className="h-3.5 w-3.5" />
            Kelimeyi Tekrar Dinle
          </button>
        )}
      </section>
    );
  }

  if (card.kind === "verse_study") {
    return (
      <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6 space-y-4">
        <div className="flex items-center justify-between text-xs text-muted">
          <span className="font-semibold text-forest">
            {card.surahNameTr} · {card.verseKey} (Sayfa {card.pageNumber})
          </span>
          <span>{card.reciterNameTr}</span>
        </div>

        {card.hideArabicText ? (
          <div className="rounded-xl border border-dashed border-forest/30 bg-parchment/70 p-6 text-center space-y-1">
            <p className="text-sm font-semibold text-forest">Ezberden okuma zamanı</p>
            <p className="text-xs text-muted">
              Ayet gizli. Sesli oku; takılırsan &ldquo;tekrar dinlet&rdquo; demen yeterli.
            </p>
          </div>
        ) : (
          <p
            lang="ar"
            dir="rtl"
            translate="no"
            className="font-arabic text-2xl sm:text-3xl leading-[2.2] text-right text-ink"
          >
            {card.textUthmani}
          </p>
        )}

        {!card.hideArabicText && card.translationTr && (
          <p className="text-xs text-muted leading-relaxed border-t border-line pt-3">
            {card.translationTr}
          </p>
        )}

        {card.recitationCheck && (
          <div className="rounded-xl border border-line bg-parchment p-3.5 space-y-2 text-xs">
            <p className="font-semibold text-ink">
              Kelime Sırası Kontrolü: %{Math.round(card.recitationCheck.wordMatchRatio * 100)} (
              {card.recitationCheck.matchedCount}/{card.recitationCheck.expectedCount})
            </p>
            <div className="flex flex-wrap justify-end gap-1.5" lang="ar" dir="rtl" translate="no">
              {card.recitationCheck.diffs
                .filter((d) => d.expectedWord)
                .map((d, i) => (
                  <span
                    key={`${d.expectedWord}-${i}`}
                    className={cn(
                      "rounded-lg px-2 py-0.5 font-arabic text-lg",
                      d.type === "match"
                        ? "bg-mint text-forest"
                        : "bg-amber-100 text-amber-950"
                    )}
                  >
                    {d.expectedWord}
                  </span>
                ))}
            </div>
            <p className="text-[11px] text-muted">
              Not: Yalnızca kelime dizisini kontrol eder; mahreç ve tecvid kalitesi için referans okuyucu veya uzman hoca teyidi gereklidir.
            </p>
          </div>
        )}
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-forest/25 bg-mint/40 p-5 space-y-3">
      <div className="flex items-center gap-2 text-forest font-bold">
        <CheckCircle2 className="h-5 w-5" />
        <span>Ders Özeti</span>
      </div>
      <ul className="space-y-1 text-sm text-ink-soft">
        {card.summaryPointsTr.map((pt) => (
          <li key={pt}>• {pt}</li>
        ))}
      </ul>
    </section>
  );
}
