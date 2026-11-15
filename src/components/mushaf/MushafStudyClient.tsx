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
  Copy,
  Download,
  Eye,
  EyeOff,
  FileText,
  GitCompareArrows,
  Info,
  Mic,
  Moon,
  Pause,
  Play,
  Plus,
  Search,
  Square,
  Sun,
  Trash2,
  Volume2,
  X,
} from "lucide-react";
import type {
  CanonicalSurahMeta,
  CanonicalVerse,
  CanonicalWord,
  MushafPageData,
  MutashabihatMatch,
  RootFrequencyEntry,
} from "@/lib/content/types";
import type {
  BookmarkRecord,
  PageProgressRecord,
  RecordingMetadataRecord,
  UserNoteRecord,
  UserPreferencesRecord,
} from "@/lib/db/types";
import type { RecitationEvaluationResult } from "@/lib/audio/assessment-provider";
import {
  QURAN_RECITERS,
  getReciterAyahAudioUrl,
  getReciterById,
} from "@/lib/audio/reciters";
import { buildVerseTeacherReviewPackage } from "@/lib/audio/teacher-review";
import {
  deleteLocalRecordingBlob,
  getLocalRecordingBlob,
  saveLocalRecordingBlob,
} from "@/lib/audio/local-recordings";
import { MADINAH_JUZ_RANGES } from "@/lib/learning-engine/analytics";
import { cn } from "@/lib/utils";

interface RootOccurrencePreview {
  location: string;
  verseKey: string;
  textUthmani: string;
  translationTr: string;
  pageNumber: number;
}

interface SearchVerseItem {
  verseKey: string;
  surahId: number;
  surahNameTr: string;
  pageNumber: number;
  textUthmani: string;
  translationDiyanet: string;
  translationElmalili: string;
}

interface MushafStudyClientProps {
  pageData: MushafPageData;
  availableSurahs: CanonicalSurahMeta[];
  rootOccurrencesMap: Record<string, RootOccurrencePreview[]>;
  mutashabihatMap: Record<string, MutashabihatMatch[]>;
  initialVerseKey?: string;
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

const OFFLINE_CACHE_NAME = "quran-journey-offline-data-v1";

export function MushafStudyClient({
  pageData,
  availableSurahs,
  rootOccurrencesMap,
  mutashabihatMap,
  initialVerseKey,
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

  const initialSelectedVerse = useMemo(() => {
    if (initialVerseKey) {
      const found = allVersesOnPage.find((v) => v.verseKey === initialVerseKey);
      if (found) return found;
    }
    return allVersesOnPage[0];
  }, [allVersesOnPage, initialVerseKey]);

  const firstWord = initialSelectedVerse?.words[0] ?? null;

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

  // Page navigation, search & offline state
  const [pageJumpInput, setPageJumpInput] = useState(String(pageData.pageNumber));
  const [pageStudied, setPageStudied] = useState(() =>
    initialPageProgress.some((p) => p.pageNumber === pageData.pageNumber)
  );
  const [markingPage, setMarkingPage] = useState(false);

  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchVerseItem[]>([]);
  const [searchRoots, setSearchRoots] = useState<RootFrequencyEntry[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);

  const [offlineSaved, setOfflineSaved] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null);

  // Selection & study states
  const [selectedVerseKey, setSelectedVerseKey] = useState<string>(
    initialSelectedVerse?.verseKey ?? "1:1"
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
    (initialSelectedVerse &&
      initialNotes.find((n) => n.verseKey === initialSelectedVerse.verseKey)?.noteText) ??
      ""
  );
  const [isDifficultDraft, setIsDifficultDraft] = useState<boolean>(
    (initialSelectedVerse &&
      initialNotes.find((n) => n.verseKey === initialSelectedVerse.verseKey)?.isDifficult) ??
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

  // Local microphone recording state (backed by IndexedDB)
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

  const selectedMutashabihat = useMemo(
    () => mutashabihatMap[selectedVerse.verseKey] ?? [],
    [mutashabihatMap, selectedVerse.verseKey]
  );

  function selectVerse(verseKey: string) {
    setSelectedVerseKey(verseKey);
    const existing = notesByVerse[verseKey];
    setNoteDraft(existing?.noteText ?? "");
    setIsDifficultDraft(existing?.isDifficult ?? false);
    setTeacherReportStatus(null);
  }

  useEffect(() => {
    if (audioRef.current) {
      audioRef.current.playbackRate = playbackSpeed;
    }
  }, [playbackSpeed]);

  // Check if this page is already cached for offline use
  useEffect(() => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    caches
      .open(OFFLINE_CACHE_NAME)
      .then((cache) => cache.match(`/api/mushaf/offline?page=${pageData.pageNumber}`))
      .then((match) => {
        if (match) setOfflineSaved(true);
      })
      .catch(() => {});
  }, [pageData.pageNumber]);

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
      if (audioRef.current) {
        audioRef.current.pause();
      }
      urlsRef.current.forEach((u) => URL.revokeObjectURL(u));
    };
  }, []);

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

  async function handleDownloadOffline() {
    if (typeof window === "undefined" || !("caches" in window)) {
      setOfflineMsg("Bu tarayıcı çevrimdışı önbellek (Cache API) desteklemiyor.");
      return;
    }
    setSavingOffline(true);
    setOfflineMsg(null);
    try {
      const offlineUrl = `/api/mushaf/offline?page=${pageData.pageNumber}`;
      const res = await fetch(offlineUrl);
      if (!res.ok) throw new Error("fetch failed");
      const payload = (await res.clone().json()) as { audioUrls?: string[] };
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      await cache.put(offlineUrl, res);
      // Also cache current navigation URL HTML if possible
      await cache.add(`/mushaf?page=${pageData.pageNumber}`).catch(() => {});

      const audioList = (payload.audioUrls ?? []).slice(0, 20);
      await Promise.all(
        audioList.map((aUrl) =>
          fetch(aUrl, { mode: "no-cors" })
            .then((audioRes) => cache.put(aUrl, audioRes))
            .catch(() => {})
        )
      );
      setOfflineSaved(true);
      setOfflineMsg(
        `Sayfa ${pageData.pageNumber} ve ${audioList.length} ses dosyası çevrimdışı kullanım için kaydedildi.`
      );
    } catch {
      setOfflineMsg("Çevrimdışı indirme sırasında hata oluştu.");
    } finally {
      setSavingOffline(false);
    }
  }

  async function handleSearchSubmit(e: React.FormEvent) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (!q) return;
    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (res.ok) {
        const data = await res.json();
        setSearchResults(data.results ?? []);
        setSearchRoots(data.matchingRoots ?? []);
        setSearchTotal(data.totalMatches ?? 0);
      }
    } finally {
      setSearching(false);
    }
  }

  function handlePageJump(e: React.FormEvent) {
    e.preventDefault();
    const num = Number(pageJumpInput);
    if (Number.isInteger(num) && num >= 1 && num <= pageData.edition.totalPages) {
      router.push(`/mushaf?page=${num}`);
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
    const url = getReciterAyahAudioUrl(verse, reciterId);
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
    await deleteLocalRecordingBlob(id);
    await fetch("/api/audio/assess", {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id }),
    });
  }

  async function handleCopyTeacherReport(rec: LocalAudioBlobEntry) {
    const verseSection = pageData.sections.find(
      (s) => s.surah.id === selectedVerse.surahId
    );
    const surahNameTr = verseSection
      ? `${verseSection.surah.nameTurkish} Suresi`
      : `Sure ${selectedVerse.surahId}`;
    const activeTrans =
      selectedVerse.translations.find((t) => t.resourceId === translationId) ??
      selectedVerse.translations[0];

    const pkg = buildVerseTeacherReviewPackage({
      verseKey: selectedVerse.verseKey,
      pageNumber: selectedVerse.pageNumber,
      surahNameTr,
      textUthmani: selectedVerse.textUthmani,
      translationTr: activeTrans?.text ?? "",
      durationMs: rec.durationMs,
      createdAt: rec.createdAt,
      reciterNameTr: getReciterById(reciterId).nameTr,
      noteText: noteDraft,
      isDifficult: isDifficultDraft,
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
              <span>Medine Mushafı · Sayfa {pageData.pageNumber} / {pageData.edition.totalPages}</span>
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

          {/* 604-Page, 30-Juz & 114-Surah Navigation */}
          <div className="flex flex-wrap items-center gap-2">
            {prevPage ? (
              <Link
                href={`/mushaf?page=${prevPage}`}
                className="inline-flex items-center gap-1 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1c241f] hover:bg-[#f3efe6]"
              >
                <ChevronLeft className="h-3.5 w-3.5" />
                <span>S.{prevPage}</span>
              </Link>
            ) : null}

            <form onSubmit={handlePageJump} className="inline-flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={pageData.edition.totalPages}
                aria-label="Sayfa numarasına git (1-604)"
                value={pageJumpInput}
                onChange={(e) => setPageJumpInput(e.target.value)}
                className="w-16 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-2 text-xs font-semibold text-[#1b4332] text-center"
              />
              <button
                type="submit"
                className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-2 text-xs font-semibold text-[#1b4332] hover:bg-[#f3efe6]"
              >
                Git
              </button>
            </form>

            <select
              aria-label="Cüz seç"
              value={String(pageData.juzNumber)}
              onChange={(e) => {
                const chosen = MADINAH_JUZ_RANGES.find(
                  (j) => j.juz === Number(e.target.value)
                );
                if (chosen) router.push(`/mushaf?page=${chosen.startPage}`);
              }}
              className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-2 text-xs font-semibold text-[#1c241f]"
            >
              {MADINAH_JUZ_RANGES.map((j) => (
                <option key={j.juz} value={String(j.juz)}>
                  Cüz {j.juz} (S.{j.startPage})
                </option>
              ))}
            </select>

            <select
              aria-label="Sureye git"
              value={String(primarySection.surah.id)}
              onChange={(e) => router.push(`/mushaf?surah=${e.target.value}`)}
              className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-semibold text-[#1c241f] max-w-[200px]"
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
                <span>S.{nextPage}</span>
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            ) : null}
          </div>
        </div>

        {/* Action & Typography Controls */}
        <div className="pt-3 border-t border-[#e5dec9] flex flex-wrap items-center gap-2.5 text-xs text-[#3f4a43]">
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
            onClick={() => setSearchOpen((v) => !v)}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition-colors",
              searchOpen
                ? "border-[#1b4332] bg-[#1b4332] text-white"
                : "border-[#e5dec9] bg-[#faf8f3] text-[#1c241f] hover:bg-[#f3efe6]"
            )}
          >
            <Search className="h-3.5 w-3.5" />
            <span>Kur&apos;an İçi Ara</span>
          </button>

          <button
            type="button"
            disabled={savingOffline}
            onClick={handleDownloadOffline}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition-colors",
              offlineSaved
                ? "border-[#2d6a4f]/40 bg-[#edf5f0] text-[#1b4332]"
                : "border-[#e5dec9] bg-[#faf8f3] text-[#1c241f] hover:bg-[#f3efe6]"
            )}
          >
            <Download className="h-3.5 w-3.5" />
            <span>
              {savingOffline
                ? "İndiriliyor..."
                : offlineSaved
                  ? "Çevrimdışı Hazır"
                  : "Sayfayı İndir"}
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
              aria-label="Kâri seç"
              value={reciterId}
              onChange={(e) => {
                const val = Number(e.target.value);
                setReciterId(val);
                persistPreferences({ preferredReciterId: val });
              }}
              className="rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2 py-1"
            >
              {QURAN_RECITERS.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.nameTr} ({r.styleTr})
                </option>
              ))}
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

        {/* Full-Quran Normalized Search Drawer */}
        {searchOpen && (
          <div className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2">
              <p className="text-xs font-bold text-[#1b4332]">
                Tam Kur&apos;an Arama (6.236 Ayet · Harekeli/Harekesiz Arapça, Türkçe Meal veya 2:255)
              </p>
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                aria-label="Aramayı kapat"
                className="text-[#5a655e] hover:text-[#1c241f]"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <form onSubmit={handleSearchSubmit} className="flex flex-col sm:flex-row gap-2">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Aramak istediğiniz kelime (ör. rahmet, الله, 2:255)..."
                className="flex-1 rounded-xl border border-[#e5dec9] bg-white px-3.5 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={searching}
                className="rounded-xl bg-[#1b4332] px-5 py-2 text-xs font-semibold text-white hover:bg-[#143326]"
              >
                {searching ? "Aranıyor..." : "Kur'an'da Ara"}
              </button>
            </form>

            {searchRoots.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 text-xs">
                <span className="font-semibold text-[#5a655e]">Eşleşen Kökler:</span>
                {searchRoots.map((rt) => (
                  <Link
                    key={rt.root}
                    href={`/vocabulary?root=${encodeURIComponent(rt.root)}`}
                    className="inline-flex items-center gap-1 rounded-lg border border-[#e5dec9] bg-white px-2 py-1 hover:border-[#1b4332]"
                  >
                    <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base font-bold text-[#1b4332]">
                      {rt.root}
                    </span>
                    <span className="text-[11px] text-[#5a655e]">({rt.count})</span>
                  </Link>
                ))}
              </div>
            )}

            {searchResults.length > 0 && (
              <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
                <p className="text-[11px] text-[#5a655e]">
                  Toplam {searchTotal} eşleşme (ilk {searchResults.length} gösteriliyor):
                </p>
                {searchResults.map((item) => (
                  <Link
                    key={item.verseKey}
                    href={`/mushaf?page=${item.pageNumber}&verse=${item.verseKey}`}
                    onClick={() => setSearchOpen(false)}
                    className="block rounded-xl border border-[#e5dec9] bg-white p-3 hover:border-[#1b4332] space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold text-[#1b4332]">
                        {item.surahNameTr} · {item.verseKey}
                      </span>
                      <span className="font-mono text-[11px] text-[#5a655e]">
                        Sayfa {item.pageNumber}
                      </span>
                    </div>
                    <p lang="ar" dir="rtl" translate="no" className="font-arabic text-xl text-right text-[#1c241f]">
                      {item.textUthmani}
                    </p>
                    <p className="text-xs text-[#3f4a43]">{item.translationDiyanet}</p>
                  </Link>
                ))}
              </div>
            )}
          </div>
        )}

        {offlineMsg && (
          <div className="rounded-xl bg-[#edf5f0] border border-[#2d6a4f]/30 px-3 py-2 text-xs text-[#1b4332]">
            {offlineMsg}
          </div>
        )}

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
                    const mutMatches = mutashabihatMap[verse.verseKey] ?? [];
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
                          <div className="flex flex-wrap items-center gap-2">
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
                            {mutMatches.length > 0 && (
                              <button
                                type="button"
                                onClick={() => selectVerse(verse.verseKey)}
                                className="inline-flex items-center gap-1 rounded-md bg-[#f7f1e3] text-[#8d682c] px-2 py-0.5 text-[11px] font-semibold"
                              >
                                <GitCompareArrows className="h-3 w-3" />
                                <span>{mutMatches.length} Müteşâbih</span>
                              </button>
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

        {/* Right Side: Word Inspector + Mutashabihat + Voice Comparison + Notes */}
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
                        Aynı kökten Kur&apos;an genelindeki örnek geçişler ({rootOccurrences.length}+):
                      </p>
                      <div className="flex flex-wrap gap-1.5">
                        {rootOccurrences.map((occ) => (
                          <Link
                            key={occ.location}
                            href={`/mushaf?page=${occ.pageNumber}&verse=${occ.verseKey}`}
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

          {/* Mutashabihat Similar Verses Card when applicable */}
          {selectedMutashabihat.length > 0 && (
            <div className="rounded-2xl border border-[#e3d2ae] bg-[#f7f1e3]/70 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h2 className="text-sm font-bold text-[#6e511e] flex items-center gap-1.5">
                  <GitCompareArrows className="h-4 w-4" />
                  <span>Müteşâbihât (Benzer Ayetler · {selectedVerse.verseKey})</span>
                </h2>
              </div>
              <div className="space-y-2">
                {selectedMutashabihat.map((m) => (
                  <Link
                    key={m.targetKey}
                    href={`/mushaf?page=${m.targetPage}&verse=${m.targetKey}`}
                    className="block rounded-xl border border-[#e3d2ae] bg-white p-3 hover:border-[#1b4332] space-y-1"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-mono font-bold text-[#1b4332]">
                        {m.targetKey} (Sayfa {m.targetPage})
                      </span>
                      <span className="rounded-md bg-[#f7f1e3] px-2 py-0.5 text-[11px] font-semibold text-[#6e511e]">
                        %{m.similarity} benzerlik
                      </span>
                    </div>
                    <p lang="ar" dir="rtl" translate="no" className="font-arabic text-xl text-right text-[#1c241f]">
                      {m.textUthmani}
                    </p>
                  </Link>
                ))}
              </div>
            </div>
          )}

          {/* 2. Local Recitation Recording & Honest Comparison Studio */}
          <div className="rounded-2xl border border-[#e5dec9] bg-white p-5 sm:p-6 space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold text-[#1c241f]">
                  Sesli Okuma ve Karşılaştırma ({selectedVerse.verseKey})
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
                Harici Kur&apos;an ASR kelime sırası kontrolü için ses kaydımın sunucuya gönderilmesine açık onay veriyorum (kapalıyken hiçbir ses verisi dışarı gönderilmez).
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
                <p className="text-xs font-semibold text-[#1c241f]">Bu Ayet İçin Kayıtlarınız</p>
                {verseLocalRecordings.map((rec) => (
                  <div
                    key={rec.id}
                    className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-2.5 space-y-2"
                  >
                    <div className="flex items-center justify-between gap-2">
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
                        onClick={() => handleCopyTeacherReport(rec)}
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
