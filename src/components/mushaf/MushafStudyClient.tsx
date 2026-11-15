"use client";

import React, { useEffect, useMemo, useState } from "react";
import type {
  CanonicalSurahMeta,
  CanonicalVerse,
  CanonicalWord,
  MushafPageData,
  MutashabihatMatch,
} from "@/lib/content/types";
import type {
  BookmarkRecord,
  PageProgressRecord,
  RecordingMetadataRecord,
  UserNoteRecord,
  UserPreferencesRecord,
} from "@/lib/db/types";
import { analyzeVerseTajweed, type TajweedWordAnalysis } from "@/lib/content/tajweed-analyzer";
import { cn } from "@/lib/utils";
import type { RootOccurrencePreview } from "./shared";
import { useReaderPreferences } from "./useReaderPreferences";
import { usePageTools } from "./usePageTools";
import { useMushafAudio } from "./useMushafAudio";
import { useRecitationRecorder } from "./useRecitationRecorder";
import { useListenRepeat } from "./useListenRepeat";
import { MushafPageNavigator } from "./MushafPageNavigator";
import { MushafReaderControls } from "./MushafReaderControls";
import { TajweedLegendStrip } from "./TajweedLegendStrip";
import { MushafSearchPanel } from "./MushafSearchPanel";
import { MushafSurahHeader } from "./MushafSurahHeader";
import { MushafVerseCard } from "./MushafVerseCard";
import { WordInspector, WordPeekBar } from "./WordInspector";
import { MutashabihatCard } from "./MutashabihatCard";
import { RecitationStudio } from "./RecitationStudio";
import { VerseNoteForm } from "./VerseNoteForm";
import { ListenRepeatFloatingBar, ListenRepeatPanel } from "./ListenRepeatPanel";

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

  const prefs = useReaderPreferences(initialPreferences);
  const pageTools = usePageTools(
    pageData.pageNumber,
    initialPageProgress.some((p) => p.pageNumber === pageData.pageNumber)
  );
  const [searchOpen, setSearchOpen] = useState(false);

  // Selection & study states
  const [selectedVerseKey, setSelectedVerseKey] = useState<string>(
    initialSelectedVerse?.verseKey ?? "1:1"
  );
  const [selectedWord, setSelectedWord] = useState<CanonicalWord | null>(
    initialSelectedVerse?.words[0] ?? null
  );
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

  const selectedVerse: CanonicalVerse = useMemo(
    () =>
      allVersesOnPage.find((v) => v.verseKey === selectedVerseKey) ?? allVersesOnPage[0]!,
    [allVersesOnPage, selectedVerseKey]
  );

  const recorder = useRecitationRecorder({
    selectedVerse,
    allVersesOnPage,
    cloudConsent: prefs.cloudConsent,
    initialRecordings,
  });

  function selectVerse(verseKey: string) {
    setSelectedVerseKey(verseKey);
    const existing = notesByVerse[verseKey];
    setNoteDraft(existing?.noteText ?? "");
    setIsDifficultDraft(existing?.isDifficult ?? false);
    recorder.clearTeacherReportStatus();
  }

  const audio = useMushafAudio({
    pageData,
    allVersesOnPage,
    reciterId: prefs.reciterId,
    playbackSpeed: prefs.playbackSpeed,
    onSelectVerse: selectVerse,
  });

  const listenRepeat = useListenRepeat({
    allVersesOnPage,
    reciterId: prefs.reciterId,
    onStepChange: followDrill,
  });
  const { isActive: listenRepeatActive, stop: stopListenRepeat } = listenRepeat;

  // Any other playback (ayah, chapter, word, page loop) ends the drill so two voices never overlap.
  useEffect(() => {
    if (audio.playingMode !== "idle" && listenRepeatActive) stopListenRepeat();
  }, [audio.playingMode, listenRepeatActive, stopListenRepeat]);

  function followDrill(verseKey: string, wordLocation: string | null) {
    if (verseKey !== selectedVerseKey) selectVerse(verseKey);
    if (!wordLocation) return;
    const word = allVersesOnPage
      .find((v) => v.verseKey === verseKey)
      ?.words.find((w) => w.location === wordLocation);
    if (word) setSelectedWord(word);
  }

  // Takipli Dinle: the word inspector follows the word being recited.
  const followWordPos = audio.playingMode === "chapter" ? audio.activeAudioWordPos : null;
  const followVerseKey = audio.playingMode === "chapter" ? audio.activeAudioVerseKey : null;
  useEffect(() => {
    if (!followVerseKey || followWordPos === null) return;
    const verse = allVersesOnPage.find((v) => v.verseKey === followVerseKey);
    const word = verse?.words.find((w) => w.position === followWordPos);
    if (!word) return;
    // Mirror the audio position into the inspector (selectVerse also swaps the note draft).
    /* eslint-disable react-hooks/set-state-in-effect */
    if (followVerseKey !== selectedVerseKey) selectVerse(followVerseKey);
    setSelectedWord(word);
    /* eslint-enable react-hooks/set-state-in-effect */
    // eslint-disable-next-line react-hooks/exhaustive-deps -- only react to the audio position
  }, [followVerseKey, followWordPos]);

  function startListenRepeat() {
    audio.stopAudio();
    const startLocation =
      selectedWord && selectedVerse.words.some((w) => w.location === selectedWord.location)
        ? selectedWord.location
        : (selectedVerse.words[0]?.location ?? null);
    listenRepeat.start(startLocation);
  }

  function toggleListenRepeat() {
    if (listenRepeat.isActive) listenRepeat.stop();
    else startListenRepeat();
  }

  const drillStep = listenRepeat.currentStep;
  const drillWordPositions =
    drillStep?.kind === "words" ? drillStep.words.map((w) => w.position) : null;

  // Phase 7A: letter-level Tajweed analysis per verse (cross-word rules need the whole verse)
  const tajweedByVerse = useMemo(() => {
    const map = new Map<string, TajweedWordAnalysis[]>();
    for (const verse of allVersesOnPage) {
      map.set(verse.verseKey, analyzeVerseTajweed(verse.words.map((w) => w.textUthmani)));
    }
    return map;
  }, [allVersesOnPage]);

  const rootOccurrences = useMemo(() => {
    const root = selectedWord?.morphology.rootArabic;
    if (!root) return [];
    return rootOccurrencesMap[root] ?? [];
  }, [rootOccurrencesMap, selectedWord]);

  const selectedMutashabihat = useMemo(
    () => mutashabihatMap[selectedVerse.verseKey] ?? [],
    [mutashabihatMap, selectedVerse.verseKey]
  );

  const selectedWordTajweedRules = useMemo(() => {
    if (!selectedWord) return [];
    const index = selectedVerse.words.findIndex((w) => w.location === selectedWord.location);
    return tajweedByVerse.get(selectedVerse.verseKey)?.[index]?.rules ?? [];
  }, [selectedVerse, selectedWord, tajweedByVerse]);

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

  async function handleSaveNote() {
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

  const { darkReader } = prefs;

  return (
    <div className="space-y-6">
      {/* Page & Surah Navigator + Toolbar */}
      <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5 flex flex-col gap-4">
        <MushafPageNavigator pageData={pageData} availableSurahs={availableSurahs} />

        <MushafReaderControls
          pageNumber={pageData.pageNumber}
          prefs={prefs}
          pageTools={pageTools}
          audio={audio}
          searchOpen={searchOpen}
          onToggleSearch={() => setSearchOpen((v) => !v)}
          listenRepeatActive={listenRepeat.isActive}
          onToggleListenRepeat={toggleListenRepeat}
        />

        {prefs.showTajweedColors && (
          <div className="hidden lg:block">
            <TajweedLegendStrip />
          </div>
        )}

        <MushafSearchPanel open={searchOpen} onClose={() => setSearchOpen(false)} />

        {pageTools.offlineMsg && (
          <div className="rounded-xl bg-mint border border-emerald/30 px-3 py-2 text-xs text-forest">
            {pageTools.offlineMsg}
          </div>
        )}

        {audio.audioError && (
          <div className="rounded-xl bg-amber-50 border border-amber-200 px-3 py-2 text-xs text-amber-900">
            {audio.audioError}
          </div>
        )}
      </div>

      {/* Main Split: Mushaf Page Sections (Left) + Word & Recording Inspector (Right) */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
        <section
          className={cn(
            "lg:col-span-7 rounded-2xl border p-5 sm:p-8 transition-colors space-y-8",
            darkReader
              ? "border-[#2f3d35] bg-[#141c17] text-sand"
              : "border-[#dfD5BC] bg-surface text-ink"
          )}
        >
          {pageData.sections.map((section) => (
            <div key={section.surah.id} className="space-y-5">
              <MushafSurahHeader
                section={section}
                pageNumber={pageData.pageNumber}
                darkReader={darkReader}
                isChapterPlaying={
                  audio.playingMode === "chapter" &&
                  audio.activeChapterSurahId === section.surah.id
                }
                onPlayChapter={() => audio.playSectionChapter(section)}
              />

              <div className="space-y-5">
                {section.verses.map((verse) => (
                  <MushafVerseCard
                    key={verse.verseKey}
                    verse={verse}
                    reader={prefs}
                    audio={audio}
                    isSelected={selectedVerse.verseKey === verse.verseKey}
                    selectedWordLocation={selectedWord?.location ?? null}
                    isBookmarked={bookmarks.has(verse.verseKey)}
                    isDifficult={notesByVerse[verse.verseKey]?.isDifficult ?? false}
                    mutashabihatCount={(mutashabihatMap[verse.verseKey] ?? []).length}
                    tajweed={
                      prefs.showTajweedColors ? tajweedByVerse.get(verse.verseKey) : undefined
                    }
                    drillWordPositions={
                      drillStep?.verseKey === verse.verseKey ? drillWordPositions : null
                    }
                    drillIsLearnerTurn={listenRepeat.phase === "repeat"}
                    onSelectVerse={selectVerse}
                    onSelectWord={handleSelectWord}
                    onPlayVerse={audio.playVerse}
                    onToggleBookmark={handleToggleBookmark}
                  />
                ))}
              </div>
            </div>
          ))}
        </section>

        {/* Right Side: Word Inspector + Mutashabihat + Voice Comparison + Notes */}
        <aside
          aria-label="Çalışma paneli"
          className="lg:col-span-5 space-y-6 lg:sticky lg:top-4 lg:max-h-[calc(100dvh-2rem)] lg:overflow-y-auto lg:overscroll-contain lg:pr-1 lg:[scrollbar-width:thin]"
        >
          <ListenRepeatPanel
            listenRepeat={listenRepeat}
            startWord={
              selectedWord && selectedVerse.words.some((w) => w.location === selectedWord.location)
                ? selectedWord
                : (selectedVerse.words[0] ?? null)
            }
            startVerseKey={selectedVerse.verseKey}
            showTransliteration={prefs.showTransliteration}
            onStart={startListenRepeat}
          />

          <WordInspector
            selectedWord={selectedWord}
            selectedVerse={selectedVerse}
            showTransliteration={prefs.showTransliteration}
            rootOccurrences={rootOccurrences}
            tajweedRules={selectedWordTajweedRules}
            cardMessage={cardMessage}
            onPlayWord={audio.playWord}
            onAddWordCard={handleAddWordCard}
          />

          <MutashabihatCard verseKey={selectedVerse.verseKey} matches={selectedMutashabihat} />

          <RecitationStudio
            verseKey={selectedVerse.verseKey}
            recorder={recorder}
            cloudConsent={prefs.cloudConsent}
            onCloudConsentChange={prefs.setCloudConsent}
            onPlayReference={() => audio.playVerse(selectedVerse)}
            onCopyTeacherReport={(rec) =>
              recorder.copyTeacherReport(rec, {
                pageData,
                translationId: prefs.translationId,
                reciterId: prefs.reciterId,
                noteText: noteDraft,
                isDifficult: isDifficultDraft,
              })
            }
          />

          <VerseNoteForm
            verseKey={selectedVerse.verseKey}
            noteDraft={noteDraft}
            isDifficult={isDifficultDraft}
            saving={savingNote}
            onNoteChange={setNoteDraft}
            onDifficultChange={setIsDifficultDraft}
            onSave={handleSaveNote}
          />
        </aside>
      </div>

      <WordPeekBar
        word={selectedWord}
        verseKey={selectedVerse.verseKey}
        hidden={listenRepeat.isActive}
        onPlayWord={audio.playWord}
      />

      <ListenRepeatFloatingBar
        listenRepeat={listenRepeat}
        showTransliteration={prefs.showTransliteration}
      />
    </div>
  );
}
