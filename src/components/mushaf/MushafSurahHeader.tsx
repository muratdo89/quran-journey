import React from "react";
import { Pause, Play } from "lucide-react";
import type { MushafPageData } from "@/lib/content/types";
import { cn } from "@/lib/utils";

interface MushafSurahHeaderProps {
  section: MushafPageData["sections"][number];
  pageNumber: number;
  darkReader: boolean;
  isChapterPlaying: boolean;
  onPlayChapter: () => void;
}

/** Decorative surah banner with word-synced chapter playback, plus the Bismillah when the surah starts here. */
export function MushafSurahHeader({
  section,
  pageNumber,
  darkReader,
  isChapterPlaying,
  onPlayChapter,
}: MushafSurahHeaderProps) {
  return (
    <>
      {/* Decorative Surah Header Banner */}
      <div
        className={cn(
          "rounded-xl border px-4 py-3 flex flex-col sm:flex-row sm:items-center justify-between gap-3",
          darkReader ? "border-[#384a3f] bg-[#1b2620]" : "border-line bg-gold-soft/70"
        )}
      >
        <div>
          <div className="flex items-center gap-2">
            <span className="font-mono text-xs font-bold text-gold">
              {section.surah.id}. Sure
            </span>
            <span className="text-sm font-bold">{section.surah.nameTurkish} Suresi</span>
          </div>
          <p className={cn("text-[11px] mt-0.5", darkReader ? "text-[#b6c2ba]" : "text-muted")}>
            {section.surah.revelationPlace === "makkah" ? "Mekkî" : "Medenî"} ·{" "}
            {section.surah.versesCount} Ayet · Sayfa {pageNumber}
          </p>
        </div>

        <div className="flex items-center gap-3 justify-between sm:justify-end">
          <span
            lang="ar"
            dir="rtl"
            translate="no"
            className="font-arabic text-2xl font-bold text-gold"
          >
            سُورَةُ {section.surah.nameArabic}
          </span>
          {section.chapterAudioUrl && (
            <button
              type="button"
              onClick={onPlayChapter}
              className="inline-flex items-center gap-1.5 rounded-xl bg-forest px-3 py-1.5 text-xs font-semibold text-white hover:bg-forest-deep"
            >
              {isChapterPlaying ? (
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
      {section.startsOnThisPage && section.surah.bismillahPre && section.surah.id !== 1 && (
        <p
          lang="ar"
          dir="rtl"
          translate="no"
          className="font-arabic text-2xl sm:text-3xl text-center text-gold py-1"
        >
          بِسْمِ ٱللَّهِ ٱلرَّحْمَٰنِ ٱلرَّحِيمِ
        </p>
      )}
    </>
  );
}
