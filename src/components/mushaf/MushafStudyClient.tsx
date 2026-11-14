"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  Bookmark,
  BookmarkCheck,
  Check,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileText,
  Info,
  Mic,
  Moon,
  Pause,
  Play,
  Plus,
  Square,
  Sun,
  Trash2,
  Volume2,
} from "lucide-react";
import type {
  CanonicalSurahMeta,
  CanonicalVerse,
  CanonicalWord,
  MushafPageData,
} from "@/lib/content/types";
import type {
  BookmarkRecord,
  PageProgressRecord,
  RecordingMetadataRecord,
  UserNoteRecord,
  UserPreferencesRecord,
} from "@/lib/db/types";
import type { RecitationEvaluationResult } from "@/lib/audio/assessment-provider";
import { cn } from "@/lib/utils";

interface RootOccurrencePreview {
  location: string;
  verseKey: string;
  textUthmani: string;
  translationTr: string;
  pageNumber: number;
}

interface MushafStudyClientProps {
  pageData: MushafPageData;
  availableSurahs: CanonicalSurahMeta[];
  rootOccurrencesMap: Record<string, RootOccurrencePreview[]>;
  initialPreferences: UserPreferencesRecord;
  initialBookmarks: BookmarkRecord[];
  initialNotes: UserNoteRecord[];
  initialRecordings: RecordingMetadataRecord[];
  initialPageProgress: PageProgressRecord[];
}

const POS_LABELS_TR: Record<string, string> = {
  N: "İsim",
  PN: "Özel İsim",
  V: "Fiil",
  P: "Edat / Harf",
  DET: "Belirlilik Takısı",
  ADJ: "Sıfat",
  PREF: "Ön Ek",
  PRON: "Zamir",
};

interface LocalAudioBlobEntry {
  id: string;
  verseKey: string;
  objectUrl: string;
  durationMs: number;
  createdAt: string;
}

function isEnglishFallbackGloss(text: string): boolean {
  return (
    /^[A-Za-z0-9\s().,;:'"-]+$/.test(text) &&
    /\b(the|of|and|to|in|is|not|for|he|they|you|my|your|from|with|by|all|what|when|who|upon|his|her|will|shall|have|be|as)\b/i.test(
      text
    )
  );
}

export function MushafStudyClient({
  pageData,
  availableSurahs,
  rootOccurrencesMap,
  initialPreferences,
  initialBookmarks,
  initialNotes,
  initialRecordings,
  initialPageProgress,
}: MushafStudyClientProps) {
  const router = useRouter();
  const allVersesOnPage = useMemo(
    () => pageData.sections.flatMap((s) => s.verses),
    [pageData.sections]
  );
  const firstVerse = allVersesOnPage[0];
  const firstWord = firstVerse?.words[0] ?? null;

  // Reader preferences
  const [fontSize, setFontSize] = useState(initialPreferences.arabicFontSize);
  const [lineHeight, setLineHeight] = useState(initialPreferences.arabicLineHeight);
  const [darkReader, setDarkReader] = useState(initialPreferences.themeMode === "dark");
  const [showTranslation, setShowTranslation] = useState(
    initialPreferences.showTranslationDefault
  );
  const [showTransliteration, setShowTransliteration] = useState(
    initialPreferences.showTransliteration
  );
  const [translationId, setTranslationId] = useState(
    initialPreferences.preferredTranslationId
  );
  const [reciterId, setReciterId] = useState(initialPreferences.preferredReciterId);
  const [playbackSpeed, setPlaybackSpeed] = useState(initialPreferences.playbackSpeed);
  const [cloudConsent, setCloudConsent] = useState(initialPreferences.cloudAiAudioConsent);

  // Page navigation & studied status
  const [pageStudied, setPageStudied] = useState(() =>
    initialPageProgress.some((p) => p.pageNumber === pageData.pageNumber)
  );
  const [markingPage, setMarkingPage] = useState(false);

  // Selection & study states
  const [selectedVerseKey, setSelectedVerseKey] = useState<string>(
    firstVerse?.verseKey ?? "1:1"
  );
  const [selectedWord, setSelectedWord] = useState<CanonicalWord | null>(firstWord);
  const [bookmarks, setBookmarks] = useState<Set<string>>(
    () => new Set(initialBookmarks.map((b) => b.verseKey))
  );
  const [notesByVerse, setNotesByVerse] = useState<Record<string, UserNoteRecord>>(() => {
    const map: Record<string, UserNoteRecord> = {};
    for (const n of initialNotes) map[n.verseKey] = n;
    return map;
  });
  const [noteDraft, setNoteDraft] = useState<string>(
    (firstVerse && initialNotes.find((n) => n.verseKey === firstVerse.verseKey)?.noteText) ?? ""
  );
  const [isDifficultDraft, setIsDifficultDraft] = useState<boolean>(
    (firstVerse && initialNotes.find((n) => n.verseKey === firstVerse.verseKey)?.isDifficult) ??
      false
  );
  const [savingNote, setSavingNote] = useState(false);
  const [cardMessage, setCardMessage] = useState<string | null>(null);

  // Audio playback state
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingMode, setPlayingMode] = useState<"idle" | "chapter" | "ayah" | "word">("idle");
  const [activeChapterSurahId, setActiveChapterSurahId] = useState<number | null>(null);
  const [activeAudioVerseKey, setActiveAudioVerseKey] = useState<string | null>(null);
  const [activeAudioWordPos, setActiveAudioWordPos] = useState<number | null>(null);
  const [audioError, setAudioError] = useState<string | null>(null);

  // Local microphone recording state
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const recordStartRef = useRef<number>(0);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingError, setRecordingError] = useState<string | null>(null);
  const [localRecordings, setLocalRecordings] = useState<LocalAudioBlobEntry[]>([]);
  const [serverRecordings, setServerRecordings] =
    useState<RecordingMetadataRecord[]>(initialRecordings);
  const [lastAssessment, setLastAssessment] = useState<RecitationEvaluationResult | null>(
    null
  );

  const selectedVerse: CanonicalVerse = useMemo(
    () =>
      allVersesOnPage.find((v) => v.verseKey === selectedVerseKey) ?? allVersesOnPage[0]!,
    [allVersesOnPage, selectedVerseKey]
  );

  const pageIndex = pageData.availablePages.indexOf(pageData.pageNumber);
  const prevPage = pageIndex > 0 ? pageData.availablePages[pageIndex - 1] : null;
  const nextPage =
    pageIndex >= 0 && pageIndex + 1 < pageData.availablePages.length
      ? pageData.availablePages[pageIndex + 1]
      : null;

  const rootOccurrences = useMemo(() => {
    const root = selectedWord?.morphology.rootArabic;
    if (!root) return [];
    return rootOccurrencesMap[root] ?? [];
  }, [rootOccurrencesMap, selectedWord]);

  function selectVerse(verseKey: string) {
    setSelectedVerseKey(verseKey);
    const existing = notesByVerse[verseKey];
    setNoteDraft(existing?.noteText ?? "");
    setIsDifficultDraft(existing?.isDifficult ?? false);
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
      localRecordings.forEach((r) => URL.revokeObjectURL(r.objectUrl));
    };
  }, [localRecordings]);

  async function persistPreferences(patch: Partial<UserPreferencesRecord>) {
    await fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(patch),
    }).catch(() => {});
  }

  async function handleMarkPageStudied() {
    setMarkingPage(true);
    try {
      const res = await fetch("/api/mushaf/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber: pageData.pageNumber }),
      });
      if (res.ok) {
        setPageStudied(true);
      }
    } finally {
      setMarkingPage(false);
    }
  }

  function stopAudio() {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
    }
    setPlayingMode("idle");
    setActiveChapterSurahId(null);
    setActiveAudioVerseKey(null);
    setActiveAudioWordPos(null);
  }

  function playUrl(
    url: string,
    mode: "chapter" | "ayah" | "word",
    verseKey: string | null = null,
    sectionVerses: CanonicalVerse[] = [],
    surahId: number | null = null
  ) {
    setAudioError(null);
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.playbackRate = playbackSpeed;
    audioRef.current = audio;
    setPlayingMode(mode);
    setActiveChapterSurahId(surahId);
    setActiveAudioVerseKey(verseKey);

    if (mode === "chapter") {
      audio.ontimeupdate = () => {
        const ms = audio.currentTime * 1000;
        let matchedVerse: string | null = null;
        let matchedWord: number | null = null;
        for (const v of sectionVerses) {
          const seg = v.audio.alafasyChapterSegment;
          if (!seg) continue;
          if (ms >= seg.timestampFromMs && ms <= seg.timestampToMs) {
            matchedVerse = v.verseKey;
            for (const [wordPos, startMs, endMs] of seg.segments) {
              if (ms >= startMs && ms <= endMs) {
                matchedWord = wordPos;
                break;
              }
            }
            break;
          }
        }
        setActiveAudioVerseKey(matchedVerse);
        setActiveAudioWordPos(matchedWord);
      };
    }

    audio.onended = () => {
      setPlayingMode("idle");
      setActiveChapterSurahId(null);
      setActiveAudioVerseKey(null);
      setActiveAudioWordPos(null);
    };

    audio.onerror = () => {
      setAudioError("Ses dosyası yüklenemedi. İnternet bağlantınızı kontrol edin.");
      setPlayingMode("idle");
      setActiveChapterSurahId(null);
    };

    audio.play().catch(() => {
      setAudioError("Tarayıcı ses oynatmayı engelledi; lütfen tekrar tıklayın.");
      setPlayingMode("idle");
      setActiveChapterSurahId(null);
    });
  }

  function handlePlaySectionChapter(section: MushafPageData["sections"][number]) {
    if (playingMode === "chapter" && activeChapterSurahId === section.surah.id) {
      stopAudio();
      return;
    }
    if (!section.chapterAudioUrl) return;
    playUrl(
      section.chapterAudioUrl,
      "chapter",
      section.verses[0]?.verseKey ?? null,
      section.verses,
      section.surah.id
    );
  }

  function handlePlayVerse(verse: CanonicalVerse) {
    const url =
      reciterId === 12 ? verse.audio.husaryMuallimAyahUrl : verse.audio.alafasyAyahUrl;
    if (!url) return;
    if (playingMode === "ayah" && activeAudioVerseKey === verse.verseKey) {
      stopAudio();
      return;
    }
    selectVerse(verse.verseKey);
    playUrl(url, "ayah", verse.verseKey);
  }

  function handleSelectWord(verse: CanonicalVerse, word: CanonicalWord) {
    selectVerse(verse.verseKey);
    setSelectedWord(word);
    setCardMessage(null);
  }

  async function handleAddWordCard(direction: "ar_to_tr" | "tr_to_ar") {
    if (!selectedWord) return;
    setCardMessage(null);
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "ensure_vocab",
        wordLocation: selectedWord.location,
        direction,
      }),
    });
    if (res.ok) {
      setCardMessage(
        direction === "ar_to_tr"
          ? "Arapça → Türkçe tekrar kartı hazırlandı."
          : "Türkçe → Arapça hatırlama kartı hazırlandı."
      );
    }
  }

  async function handleToggleBookmark(verse: CanonicalVerse) {
    const res = await fetch("/api/mushaf/bookmark", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        verseKey: verse.verseKey,
        pageNumber: verse.pageNumber,
        label: `Sayfa ${verse.pageNumber} · ${verse.verseKey}`,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      setBookmarks((prev) => {
        const next = new Set(prev);
        if (data.bookmarked) next.add(verse.verseKey);
        else next.delete(verse.verseKey);
        return next;
      });
    }
  }

  async function handleSaveNote(e: React.FormEvent) {
    e.preventDefault();
    setSavingNote(true);
    try {
      const res = await fetch("/api/mushaf/note", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          verseKey: selectedVerse.verseKey,
          pageNumber: selectedVerse.pageNumber,
          noteText: noteDraft,
          isDifficult: isDifficultDraft,
        }),
      });
      if (res.ok) {
        const { note } = await res.json();
        setNotesByVerse((prev) => ({ ...prev, [selectedVerse.verseKey]: note }));
      }
    } finally {
      setSavingNote(false);
    }
  }

  async function startRecording() {
    setRecordingError(null);
    setLastAssessment(null);
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      setRecordingError("Bu tarayıcı mikrofon kaydını desteklemiyor.");
      return;
    }

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      const recorder = new MediaRecorder(stream);
      chunksRef.current = [];
      recordStartRef.current = Date.now();

      recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) chunksRef.current.push(ev.data);
      };

      recorder.onstop = async () => {
        stream.getTracks().forEach((t) => t.stop());
        const durationMs = Math.max(500, Date.now() - recordStartRef.current);
        const blob = new Blob(chunksRef.current, {
          type: recorder.mimeType || "audio/webm",
        });
        const objectUrl = URL.createObjectURL(blob);
        const id = crypto.randomUUID();
        const entry: LocalAudioBlobEntry = {
          id,
          verseKey: selectedVerse.verseKey,
          objectUrl,
          durationMs,
          createdAt: new Date().toISOString(),
        };
        setLocalRecordings((prev) => [entry, ...prev]);

        const res = await fetch("/api/audio/assess", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            id,
            verseKey: selectedVerse.verseKey,
            audioMimeType: blob.type || "audio/webm",
            durationMs,
            consentGranted: cloudConsent,
          }),
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
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    setIsRecording(false);
  }

  async function deleteRecording(id: string) {
    setLocalRecordings((prev) => {
      const target = prev.find((r) => r.id === id);
      if (target) URL.revokeObjectURL(target.objectUrl);
      return prev.filter((r) => r.id !== id);
    });
    setServerRecordings((prev) => prev.filter((r) => r.id !== id));
    await fetch("/api/audio/assess", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  const verseLocalRecordings = localRecordings.filter(
    (r) => r.verseKey === selectedVerse.verseKey
  );
  const primarySection = pageData.sections[0]!;

  return (
    <div className="space-y-6">
      {/* Page & Surah Navigator + Toolbar */}
      <div className="rounded-2xl border border-[#e5dec9] bg-white p-4 sm:p-5 flex flex-col gap-4">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div>
            <div className="flex flex-wrap items-center gap-2 text-xs font-semibold text-[#1b4332]">
              <span>Medine Mushafı · Sayfa {pageData.pageNumber}</span>
              <span className="text-[#b08d57]">•</span>
              <span>Cüz {pageData.juzNumber}</span>
              <span className="text-[#b08d57]">•</span>
              <span>
                {pageData.sections.map((s) => s.surah.nameTurkish).join(" / ")}
              </span>
            </div>
            <h1 className="mt-1 text-xl font-bold text-[#1c241f]">
              Sayfa Odaklı Kur&apos;an Çalışması
            </h1>
          </div>

          {/* Page & Surah Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            {prevPage ? (
              <Link
                href={`/mushaf?page=${prevPage}`}
                className="inline-flex items-center gap-1 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1c241f] hover:bg-[#f3efe6]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>Sayfa {prevPage}</span>
              </Link>
            ) : null}

            <select
              aria-label="Mushaf sayfası seç"
              value={String(pageData.pageNumber)}
              onChange={(e) => router.push(`/mushaf?page=${e.target.value}`)}
              className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1b4332]"
            >
              {pageData.availablePages.map((p) => (
                <option key={p} value={String(p)}>
                  Sayfa {p} {p === 1 ? "(Fâtiha)" : "(Cüz Amme)"}
                </option>
              ))}
            </select>

            <select
              aria-label="Sureye git"
              value={String(primarySection.surah.id)}
              onChange={(e) => router.push(`/mushaf?surah=${e.target.value}`)}
              className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1c241f]"
            >
              {availableSurahs.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.id}. {s.nameTurkish} (S.{s.pages[0]})
                </option>
              ))}
            </select>

            {nextPage ? (
              <Link
                href={`/mushaf?page=${nextPage}`}
                className="inline-flex items-center gap-1 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1c241f] hover:bg-[#f3efe6]"
              >
                <span>Sayfa {nextPage}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* Action & Typography Controls */}
        <div className="pt-3 border-t border-[#e5dec9] flex flex-wrap items-center gap-3 text-xs text-[#3f4a43]">
          <button
            type="button"
            disabled={markingPage}
            onClick={handleMarkPageStudied}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition-colors",
              pageStudied
                ? "bg-[#edf5f0] text-[#1b4332] border border-[#2d6a4f]/40"
                : "bg-[#1b4332] text-white hover:bg-[#143326]"
            )}
          >
            <CheckCircle2 className="h-3.5 w-3.5" />
            <span>
              {pageStudied ? `Sayfa ${pageData.pageNumber} Çalışıldı` : "Sayfayı Çalışıldı İşaretle"}
            </span>
          </button>

          <button
            type="button"
            onClick={() => {
              const next = !darkReader;
              setDarkReader(next);
              persistPreferences({ themeMode: next ? "dark" : "light" });
            }}
            aria-label="Okuma temasını değiştir"
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 font-medium text-[#1c241f] hover:bg-[#f3efe6]"
          >
            {darkReader ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{darkReader ? "Aydınlık Sayfa" : "Karanlık Sayfa"}</span>
          </button>

          <label className="flex items-center gap-2">
            <span className="font-medium">Boyut ({fontSize}px):</span>
            <input
              type="range"
              min={24}
              max={50}
              value={fontSize}
              onChange={(e) => {
                const val = Number(e.target.value);
                setFontSize(val);
                persistPreferences({ arabicFontSize: val });
              }}
              className="accent-[#1b4332]"
            />
          </label>

          <label className="flex items-center gap-2">
            <span className="font-medium">Aralık:</span>
            <select
              value={lineHeight}
              onChange={(e) => {
                const val = Number(e.target.value);
                setLineHeight(val);
                persistPreferences({ arabicLineHeight: val });
              }}
              className="rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2 py-1"
            >
              <option value={1.9}>Sıkı (1.9)</option>
              <option value={2.15}>Dengeli (2.15)</option>
              <option value={2.5}>Geniş (2.5)</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="font-medium">Kâri:</span>
            <select
              value={reciterId}
              onChange={(e) => {
                const val = Number(e.target.value);
                setReciterId(val);
                persistPreferences({ preferredReciterId: val });
              }}
              className="rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2 py-1"
            >
              <option value={7}>Mişari Râşid el-Afâsî</option>
              <option value={12}>Mahmud Halîl el-Husarî (Muallim)</option>
            </select>
          </label>

          <label className="flex items-center gap-2">
            <span className="font-medium">Hız:</span>
            <select
              value={playbackSpeed}
              onChange={(e) => {
                const val = Number(e.target.value);
                setPlaybackSpeed(val);
                persistPreferences({ playbackSpeed: val });
              }}
              className="rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2 py-1"
            >
              <option value={0.75}>0.75x (Yavaş)</option>
              <option value={1}>1.0x (Normal)</option>
              <option value={1.25}>1.25x</option>
            </select>
          </label>

          <button
            type="button"
            onClick={() => {
              const next = !showTranslation;
              setShowTranslation(next);
              persistPreferences({ showTranslationDefault: next });
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-1 font-medium hover:bg-[#f3efe6]"
          >
            {showTranslation ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
            <span>{showTranslation ? "Meali Gizle" : "Meali Göster"}</span>
          </button>

          {showTranslation && (
            <select
              aria-label="Meal kaynağı seç"
              value={translationId}
              onChange={(e) => {
                const val = Number(e.target.value);
                setTranslationId(val);
                persistPreferences({ preferredTranslationId: val });
              }}
              className="rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2 py-1"
            >
              <option value={77}>Diyanet İşleri Meali</option>
              <option value={52}>Elmalılı Hamdi Yazır Meali</option>
            </select>
          )}

          <label className="inline-flex items-center gap-1.5 cursor-pointer">
            <input
              type="checkbox"
              checked={showTransliteration}
              onChange={(e) => {
                setShowTransliteration(e.target.checked);
                persistPreferences({ showTransliteration: e.target.checked });
              }}
              className="accent-[#1b4332]"
            />
            <span>Okunuş Yardımı</span>
          </label>
        </div>

        {audioError && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            {audioError}
          </div>
        )}
      </div>

      {/* Main Split: Mushaf Page Sections (Left) + Word & Recording Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          className={cn(
            "lg:col-span-7 rounded-2xl border p-5 sm:p-8 transition-colors space-y-8",
            darkReader
              ? "border-[#2f3d35] bg-[#141c17] text-[#f3efe6]"
              : "border-[#dfD5BC] bg-[#fffdf7] text-[#1c241f]"
          )}
        >
          {pageData.sections.map((section) => {
            const isSectionChapterPlaying =
              playingMode === "chapter" && activeChapterSurahId === section.surah.id;

            return (
              <div key={section.surah.id} className="space-y-5">
                {/* Decorative Surah Header Banner */}
                <div
                  className={cn(
                    "rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
                    darkReader ? "border-[#384a3f] bg-[#1b2620]" : "border-[#e5dec9] bg-[#f7f1e3]/70"
                  )}
                >
                  <div>
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs font-bold text-[#b08d57]">
                        {section.surah.id}. Sure
                      </span>
                      <span className="text-sm font-bold">
                        {section.surah.nameTurkish} Suresi
                      </span>
                    </div>
                    <p
                      className={cn(
                        "text-[11px] mt-0.5",
                        darkReader ? "text-[#b6c2ba]" : "text-[#5a655e]"
                      )}
                    >
                      {section.surah.revelationPlace === "makkah" ? "Mekkî" : "Medenî"} ·{" "}
                      {section.surah.versesCount} Ayet · Sayfa {pageData.pageNumber}
                    </p>
                  </div>

                  <div className="flex items-center gap-3 justify-between sm:justify-end">
                    <span
                      lang="ar"
                      dir="rtl"
                      translate="no"
                      className="font-arabic text-2xl font-bold text-[#b08d57]"
                    >
                      سُورَةُ {section.surah.nameArabic}
                    </span>
                    {section.chapterAudioUrl && (
                      <button
                        type="button"
                        onClick={() => handlePlaySectionChapter(section)}
                        className="inline-flex items-center gap-1.5 rounded-xl bg-[#1b4332] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#143326]"
                      >
                        {isSectionChapterPlaying ? (
                          <>
                            <Pause className="h-3.5 w-3.5" />
                            <span>Durdur</span>
                          </>
                        ) : (
                          <>
                            <Play className="h-3.5 w-3.5" />
                            <span>Takipli Dinle</span>
                          </>
                        )}
                      </button>
                    )}
                  </div>
                </div>

                {/* Explicit Bismillah Header before Verse 1 when applicable */}
                {section.startsOnThisPage &&
                  section.surah.bismillahPre &&
                  section.surah.id !== 1 && (
                    <p
                      lang="ar"
                      dir="rtl"
                      translate="no"
                      className="font-arabic text-2xl sm:text-3xl text-center text-[#b08d57] py-1"
                    >
                      بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
                    </p>
                  )}

                <div className="space-y-5">
                  {section.verses.map((verse) => {
                    const isSelectedVerse = selectedVerse.verseKey === verse.verseKey;
                    const isBookmarked = bookmarks.has(verse.verseKey);
                    const note = notesByVerse[verse.verseKey];
                    const activeTrans =
                      verse.translations.find((t) => t.resourceId === translationId) ??
                      verse.translations[0];
                    const isVerseAudioPlaying =
                      playingMode !== "idle" && activeAudioVerseKey === verse.verseKey;

                    return (
                      <article
                        key={verse.verseKey}
                        className={cn(
                          "rounded-2xl border p-4 sm:p-5 transition-all",
                          isSelectedVerse
                            ? darkReader
                              ? "border-[#4b8a68] bg-[#1b2720]"
                              : "border-[#1b4332]/40 bg-[#f6f9f7]"
                            : darkReader
                              ? "border-[#28352d] bg-transparent"
                              : "border-[#ece4cf] bg-transparent"
                        )}
                      >
                        {/* Verse Top Meta */}
                        <div className="flex items-center justify-between gap-2 mb-3">
                          <div className="flex items-center gap-2">
                            <button
                              type="button"
                              onClick={() => selectVerse(verse.verseKey)}
                              className={cn(
                                "font-mono text-xs font-bold px-2.5 py-1 rounded-lg",
                                isSelectedVerse
                                  ? "bg-[#1b4332] text-white"
                                  : darkReader
                                    ? "bg-[#24322a] text-[#d5dfd9]"
                                    : "bg-[#f3efe6] text-[#1b4332]"
                              )}
                            >
                              {verse.verseKey}
                            </button>
                            {note?.isDifficult && (
                              <span className="rounded-md bg-amber-100 text-amber-900 px-2 py-0.5 text-[11px] font-semibold">
                                Zor İşaretli
                              </span>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => handlePlayVerse(verse)}
                              title="Ayeti dinle"
                              className={cn(
                                "inline-flex items-center gap-1 rounded-lg px-2.5 py-1.5 text-xs font-medium transition-colors",
                                isVerseAudioPlaying
                                  ? "bg-[#1b4332] text-white"
                                  : darkReader
                                    ? "bg-[#24322a] text-[#e7e2d6] hover:bg-[#2f4137]"
                                    : "bg-[#f3efe6] text-[#1b4332] hover:bg-[#e7decb]"
                              )}
                            >
                              {isVerseAudioPlaying ? (
                                <Square className="h-3 w-3" />
                              ) : (
                                <Volume2 className="h-3.5 w-3.5" />
                              )}
                              <span>{isVerseAudioPlaying ? "Durdur" : "Dinle"}</span>
                            </button>

                            <button
                              type="button"
                              onClick={() => handleToggleBookmark(verse)}
                              title="Yer imi ekle/kaldır"
                              className={cn(
                                "rounded-lg p-1.5 transition-colors",
                                isBookmarked
                                  ? "text-[#b08d57]"
                                  : darkReader
                                    ? "text-[#8e9b93] hover:text-white"
                                    : "text-[#6d7871] hover:text-[#1b4332]"
                              )}
                            >
                              {isBookmarked ? (
                                <BookmarkCheck className="h-4 w-4" />
                              ) : (
                                <Bookmark className="h-4 w-4" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Interactive RTL Arabic Words */}
                        <div
                          lang="ar"
                          dir="rtl"
                          translate="no"
                          className="font-arabic flex flex-wrap items-baseline gap-x-2.5 gap-y-2 py-2"
                          style={{
                            fontSize: `${fontSize}px`,
                            lineHeight: lineHeight,
                          }}
                        >
                          {verse.words.map((word) => {
                            const isSelectedWord = selectedWord?.location === word.location;
                            const isWordHighlightedByAudio =
                              playingMode === "chapter" &&
                              activeAudioVerseKey === verse.verseKey &&
                              activeAudioWordPos === word.position;

                            return (
                              <button
                                key={word.location}
                                type="button"
                                onClick={() => handleSelectWord(verse, word)}
                                className={cn(
                                  "rounded-lg px-1.5 py-0.5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#b08d57]",
                                  isWordHighlightedByAudio
                                    ? "bg-[#b08d57]/30 text-[#8a6321] dark:text-[#f5d598]"
                                    : isSelectedWord
                                      ? darkReader
                                        ? "bg-[#2d6a4f] text-white"
                                        : "bg-[#1b4332] text-[#faf8f3]"
                                      : darkReader
                                        ? "hover:bg-[#24332b]"
                                        : "hover:bg-[#ede5d2]"
                                )}
                              >
                                {word.textUthmani}
                              </button>
                            );
                          })}
                          <span
                            className="inline-flex items-center justify-center text-[0.58em] font-sans text-[#b08d57] px-1.5 select-none"
                            aria-label={`Ayet ${verse.verseNumber}`}
                          >
                            ﴿{verse.verseNumber}﴾
                          </span>
                        </div>

                        {/* Optional Contextual Verse Translation (Kept strictly separate from word glosses) */}
                        {showTranslation && activeTrans && (
                          <div
                            className={cn(
                              "mt-3 pt-3 border-t text-sm leading-relaxed",
                              darkReader
                                ? "border-[#2a3830] text-[#d5dfd9]"
                                : "border-[#e7dfc9] text-[#2e3832]"
                            )}
                          >
                            <span className="text-[11px] font-semibold uppercase tracking-wider text-[#b08d57] block mb-1">
                              Ayet Meali · {activeTrans.translatorName}
                            </span>
                            <p>{activeTrans.text}</p>
                          </div>
                        )}
                      </article>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </section>

        {/* Right Side: Word Inspector + Verse Notes + Voice Comparison */}
        <aside className="lg:col-span-5 space-y-6 lg:sticky lg:top-6">
          {/* 1. Word Inspector */}
          <div className="rounded-2xl border border-[#e5dec9] bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1c241f]">Kelime İnceleyici</h2>
                <p className="text-xs text-[#5a655e]">
                  Kelime anlamı ile ayet meali ayrı tutulur
                </p>
              </div>
              {selectedWord && (
                <span className="font-mono text-xs font-semibold rounded-lg bg-[#f3efe6] px-2.5 py-1 text-[#1b4332]">
                  {selectedWord.location}
                </span>
              )}
            </div>

            {selectedWord ? (
              <div className="space-y-4">
                <div className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-4 flex items-center justify-between gap-4">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-wider text-[#5a655e]">
                      Kelime Anlamı (Sözlük / Bağlam)
                    </p>
                    <p className="mt-1 text-lg font-bold text-[#1b4332]">
                      {selectedWord.translationTr}
                    </p>
                    {isEnglishFallbackGloss(selectedWord.translationTr) && (
                      <p className="mt-0.5 text-[11px] text-[#8d682c]">
                        Kaynak sözlük bu kelimede İngilizce karşılık döndürdü; anlam için aşağıdaki ayet mealine bakın.
                      </p>
                    )}
                    {showTransliteration && selectedWord.transliteration && (
                      <p className="mt-0.5 text-xs font-mono text-[#5a655e]">
                        Okunuş yardımı: {selectedWord.transliteration}
                      </p>
                    )}
                  </div>
                  <div className="text-right">
                    <p
                      lang="ar"
                      dir="rtl"
                      translate="no"
                      className="font-arabic text-4xl text-[#1c241f]"
                    >
                      {selectedWord.textUthmani}
                    </p>
                    {selectedWord.audioUrl && (
                      <button
                        type="button"
                        onClick={() =>
                          playUrl(selectedWord.audioUrl!, "word", selectedVerse.verseKey)
                        }
                        className="mt-2 inline-flex items-center gap-1.5 rounded-lg bg-[#1b4332] px-3 py-1.5 text-xs font-semibold text-white hover:bg-[#143326]"
                      >
                        <Volume2 className="h-3.5 w-3.5" />
                        <span>Kelimeyi Dinle</span>
                      </button>
                    )}
                  </div>
                </div>

                {/* Contextual Verse Meaning Kept Distinct */}
                <div className="rounded-xl border border-[#ece4cf] bg-white p-3.5 text-xs space-y-1">
                  <p className="font-semibold text-[#b08d57]">
                    Bulunduğu Ayet Meali ({selectedVerse.verseKey}):
                  </p>
                  <p className="text-[#3f4a43] leading-relaxed">
                    {selectedVerse.translations[0]?.text}
                  </p>
                </div>

                {/* Morphology & Verified Root */}
                <div className="rounded-xl border border-[#ece4cf] bg-[#faf8f3] p-3.5 space-y-2 text-xs">
                  <div className="flex items-center justify-between">
                    <span className="font-semibold text-[#1c241f]">Morfoloji ve Kök Bilgisi</span>
                    <span className="text-[11px] text-[#5a655e]">Quranic Arabic Corpus</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-lg bg-white border border-[#e5dec9] p-2.5">
                      <span className="text-[11px] text-[#5a655e] block">Kök (Cizr)</span>
                      <span
                        lang="ar"
                        dir="rtl"
                        translate="no"
                        className="font-arabic text-xl font-bold text-[#1b4332]"
                      >
                        {selectedWord.morphology.rootArabic ?? "— (Zamir/Edat)"}
                      </span>
                    </div>
                    <div className="rounded-lg bg-white border border-[#e5dec9] p-2.5">
                      <span className="text-[11px] text-[#5a655e] block">Kelime Türü</span>
                      <span className="text-xs font-semibold text-[#1c241f]">
                        {selectedWord.morphology.segments
                          .map((s) => POS_LABELS_TR[s.partOfSpeech] ?? s.partOfSpeech)
                          .join(" + ") || "Doğrulanıyor"}
                      </span>
                    </div>
                  </div>
                  {rootOccurrences.length > 1 && (
                    <div className="pt-1">
                      <p className="text-[11px] font-medium text-[#5a655e] mb-1">
                        Aynı kökten koleksiyondaki örnek geçişler ({rootOccurrences.length}+):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {rootOccurrences.map((occ) => (
                          <Link
                            key={occ.location}
                            href={`/mushaf?page=${occ.pageNumber}`}
                            className="inline-flex items-center gap-1.5 rounded-lg bg-white border border-[#e5dec9] px-2 py-1 hover:border-[#1b4332]"
                          >
                            <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base">
                              {occ.textUthmani}
                            </span>
                            <span className="text-[11px] text-[#5a655e]">({occ.location})</span>
                          </Link>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Add to FSRS Review Deck */}
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddWordCard("ar_to_tr")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#1b4332] bg-[#1b4332]/5 px-3 py-2 text-xs font-semibold text-[#1b4332] hover:bg-[#1b4332]/10"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>AR → TR Kartı</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleAddWordCard("tr_to_ar")}
                    className="inline-flex items-center justify-center gap-1.5 rounded-xl border border-[#b08d57] bg-[#f7f1e3] px-3 py-2 text-xs font-semibold text-[#6e511e] hover:bg-[#efe4ca]"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    <span>TR → AR Kartı</span>
                  </button>
                </div>
                {cardMessage && (
                  <p className="text-xs font-medium text-[#2d6a4f] flex items-center gap-1.5">
                    <Check className="h-3.5 w-3.5" />
                    {cardMessage}
                  </p>
                )}
              </div>
            ) : (
              <p className="text-xs text-[#5a655e]">
                İncelemek için soldaki Mushaf metninden herhangi bir kelimeye dokunun.
              </p>
            )}
          </div>

          {/* 2. Local Recitation Recording & Honest Comparison Studio */}
          <div className="rounded-2xl border border-[#e5dec9] bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1c241f]">
                  Sesli Okuma ve Karşılaştırma ({selectedVerse.verseKey})
                </h2>
                <p className="text-xs text-[#5a655e]">
                  Kendi okumanızı kaydedip referans kâri ile yan yana dinleyin
                </p>
              </div>
              <Mic className="h-4 w-4 text-[#1b4332]" />
            </div>

            <div className="flex flex-wrap items-center gap-2">
              {!isRecording ? (
                <button
                  type="button"
                  onClick={startRecording}
                  className="inline-flex items-center gap-2 rounded-xl bg-[#1b4332] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[#143326]"
                >
                  <Mic className="h-3.5 w-3.5" />
                  <span>Okumamı Kaydet</span>
                </button>
              ) : (
                <button
                  type="button"
                  onClick={stopRecording}
                  className="inline-flex items-center gap-2 rounded-xl bg-red-700 px-4 py-2.5 text-xs font-semibold text-white hover:bg-red-800"
                >
                  <Square className="h-3.5 w-3.5" />
                  <span>Kaydı Durdur</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => handlePlayVerse(selectedVerse)}
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
                onChange={(e) => {
                  setCloudConsent(e.target.checked);
                  persistPreferences({ cloudAiAudioConsent: e.target.checked });
                }}
                className="mt-0.5 accent-[#1b4332]"
              />
              <span>
                İleride yapılandırılacak harici Kur&apos;an ASR değerlendirmesi için ses kaydının sunucuya gönderilmesine açık onay veriyorum (varsayılan kapalı, yalnızca yerelde saklanır).
              </span>
            </label>

            {recordingError && (
              <div className="rounded-xl bg-red-50 border border-red-200 p-3 text-xs text-red-800 flex items-start gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 mt-0.5" />
                <span>{recordingError}</span>
              </div>
            )}

            {verseLocalRecordings.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-semibold text-[#1c241f]">Bu Oturumdaki Kayıtlarınız</p>
                {verseLocalRecordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-2.5 flex items-center justify-between gap-2"
                  >
                    <audio controls src={rec.objectUrl} className="h-8 w-full" />
                    <button
                      type="button"
                      onClick={() => deleteRecording(rec.id)}
                      title="Kaydı kalıcı olarak sil"
                      className="rounded-lg p-1.5 text-red-700 hover:bg-red-50 shrink-0"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {lastAssessment && (
              <div className="rounded-xl border border-[#e3d2ae] bg-[#f7f1e3] p-3.5 text-xs text-[#4a3b1f] space-y-1.5">
                <div className="flex items-center gap-1.5 font-semibold">
                  <Info className="h-4 w-4 text-[#9a7639]" />
                  <span>Değerlendirme Durumu (Şeffaf Bildirim)</span>
                </div>
                <p className="leading-relaxed">{lastAssessment.summaryTr}</p>
                {lastAssessment.findings.map((f, i) => (
                  <p key={i} className="text-[11px] opacity-90">
                    • {f.messageTr}
                  </p>
                ))}
              </div>
            )}

            {serverRecordings.length > 0 && (
              <p className="text-[11px] text-[#5a655e]">
                Toplam kaydedilen çalışma kaydı geçmişi: {serverRecordings.length} kayıt.
              </p>
            )}
          </div>

          {/* 3. Verse Notes & Difficulty Flag */}
          <form
            onSubmit={handleSaveNote}
            className="rounded-2xl border border-[#e5dec9] bg-white p-5 sm:p-6 space-y-3"
          >
            <div className="flex items-center justify-between">
              <h2 className="text-base font-bold text-[#1c241f] flex items-center gap-2">
                <FileText className="h-4 w-4 text-[#1b4332]" />
                <span>Ayet Notu ({selectedVerse.verseKey})</span>
              </h2>
              <label className="inline-flex items-center gap-1.5 text-xs font-medium text-[#5a655e] cursor-pointer">
                <input
                  type="checkbox"
                  checked={isDifficultDraft}
                  onChange={(e) => setIsDifficultDraft(e.target.checked)}
                  className="accent-[#b08d57]"
                />
                <span>Zor Ayet</span>
              </label>
            </div>
            <textarea
              rows={3}
              value={noteDraft}
              onChange={(e) => setNoteDraft(e.target.value)}
              placeholder="Bu ayette dikkat ettiğiniz tecvid, kelime kökü veya tefekkür notunuzu yazın..."
              className="w-full rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-3 text-xs text-[#1c241f] focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
            />
            <button
              type="submit"
              disabled={savingNote}
              className="rounded-xl bg-[#1b4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#143326] disabled:opacity-60"
            >
              {savingNote ? "Kaydediliyor..." : "Notu Kaydet"}
            </button>
          </form>
        </aside>
      </div>
    </div>
  );
}
