"use client";

import React from "react";
import { Bookmark, BookmarkCheck, GitCompareArrows, Square, Volume2 } from "lucide-react";
import type { CanonicalVerse, CanonicalWord } from "@/lib/content/types";
import { getTajweedLegend, type TajweedWordAnalysis } from "@/lib/content/tajweed-analyzer";
import { cn } from "@/lib/utils";
import { getActiveTranslation } from "./shared";
import type { MushafPlayingMode } from "./useMushafAudio";

export interface VerseCardReaderSettings {
  darkReader: boolean;
  fontSize: number;
  lineHeight: number;
  showTranslation: boolean;
  translationId: number;
}

export interface VerseCardAudioState {
  playingMode: MushafPlayingMode;
  activeAudioVerseKey: string | null;
  activeAudioWordPos: number | null;
}

interface MushafVerseCardProps {
  verse: CanonicalVerse;
  reader: VerseCardReaderSettings;
  audio: VerseCardAudioState;
  isSelected: boolean;
  selectedWordLocation: string | null;
  isBookmarked: boolean;
  isDifficult: boolean;
  mutashabihatCount: number;
  /** Letter-level tajweed per word, or undefined when the overlay is off. */
  tajweed: TajweedWordAnalysis[] | undefined;
  onSelectVerse: (verseKey: string) => void;
  onSelectWord: (verse: CanonicalVerse, word: CanonicalWord) => void;
  onPlayVerse: (verse: CanonicalVerse) => void;
  onToggleBookmark: (verse: CanonicalVerse) => void;
}

/** One verse: meta row (key, flags, listen, bookmark), tappable words and the translation. */
export function MushafVerseCard({
  verse,
  reader,
  audio,
  isSelected,
  selectedWordLocation,
  isBookmarked,
  isDifficult,
  mutashabihatCount,
  tajweed,
  onSelectVerse,
  onSelectWord,
  onPlayVerse,
  onToggleBookmark,
}: MushafVerseCardProps) {
  const { darkReader } = reader;
  const activeTrans = getActiveTranslation(verse, reader.translationId);
  const isVerseAudioPlaying =
    audio.playingMode !== "idle" && audio.activeAudioVerseKey === verse.verseKey;

  return (
    <article
      className={cn(
        "rounded-2xl border p-4 sm:p-5 transition-all",
        isSelected
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
            onClick={() => onSelectVerse(verse.verseKey)}
            className={cn(
              "font-mono text-xs font-bold px-2.5 py-1 rounded-lg",
              isSelected
                ? "bg-[#1b4332] text-white"
                : darkReader
                  ? "bg-[#24322a] text-[#d5dfd9]"
                  : "bg-[#f3efe6] text-[#1b4332]"
            )}
          >
            {verse.verseKey}
          </button>
          {isDifficult && (
            <span className="rounded-md bg-amber-100 text-amber-900 px-2 py-0.5 text-[11px] font-semibold">
              Zor İşaretli
            </span>
          )}
          {mutashabihatCount > 0 && (
            <button
              type="button"
              onClick={() => onSelectVerse(verse.verseKey)}
              className="inline-flex items-center gap-1 rounded-md bg-[#f7f1e3] text-[#8d682c] px-2 py-0.5 text-[11px] font-semibold"
            >
              <GitCompareArrows className="h-3 w-3" />
              <span>{mutashabihatCount} Müteşâbih</span>
            </button>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          <button
            type="button"
            onClick={() => onPlayVerse(verse)}
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
            onClick={() => onToggleBookmark(verse)}
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
            {isBookmarked ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
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
          fontSize: `${reader.fontSize}px`,
          lineHeight: reader.lineHeight,
        }}
      >
        {verse.words.map((word, wordIndex) => {
          const isSelectedWord = selectedWordLocation === word.location;
          const isWordHighlightedByAudio =
            audio.playingMode === "chapter" &&
            audio.activeAudioVerseKey === verse.verseKey &&
            audio.activeAudioWordPos === word.position;
          const wordTajweed = tajweed?.[wordIndex];

          return (
            <button
              key={word.location}
              type="button"
              onClick={() => onSelectWord(verse, word)}
              title={tajweedTitle(wordTajweed)}
              className={cn(
                "inline-flex flex-col items-center rounded-lg px-1.5 py-0.5 transition-all cursor-pointer focus:outline-none focus:ring-2 focus:ring-[#b08d57]",
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
              {wordTajweed && !isSelectedWord && !isWordHighlightedByAudio ? (
                <TajweedColoredWord analysis={wordTajweed} darkReader={darkReader} />
              ) : (
                <span>{word.textUthmani}</span>
              )}
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
      {reader.showTranslation && activeTrans && (
        <div
          className={cn(
            "mt-3 pt-3 border-t text-sm leading-relaxed",
            darkReader ? "border-[#2a3830] text-[#d5dfd9]" : "border-[#e7dfc9] text-[#2e3832]"
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
}

function tajweedTitle(analysis: TajweedWordAnalysis | undefined): string | undefined {
  const highlighted = analysis?.rules.filter((r) => r.highlighted) ?? [];
  return highlighted.length > 0 ? highlighted.map((r) => r.titleTr).join(" · ") : undefined;
}

/** Word text with each tajweed letter colored by its legend category. */
function TajweedColoredWord({
  analysis,
  darkReader,
}: {
  analysis: TajweedWordAnalysis;
  darkReader: boolean;
}) {
  return (
    <span>
      {analysis.segments.map((seg, segIndex) =>
        seg.category ? (
          <span
            key={segIndex}
            style={{
              color: darkReader
                ? getTajweedLegend(seg.category).colorHexDark
                : getTajweedLegend(seg.category).colorHex,
            }}
          >
            {seg.text}
          </span>
        ) : (
          <React.Fragment key={segIndex}>{seg.text}</React.Fragment>
        )
      )}
    </span>
  );
}
