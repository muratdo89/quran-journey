"use client";

import React, { useEffect, useState } from "react";
import {
  CheckCircle2,
  ChevronDown,
  SlidersHorizontal,
  Download,
  Ear,
  Eye,
  EyeOff,
  Moon,
  Repeat,
  Search,
  Sparkles,
  Sun,
} from "lucide-react";
import { QURAN_RECITERS } from "@/lib/audio/reciters";
import { cn } from "@/lib/utils";
import { TajweedLegendStrip } from "./TajweedLegendStrip";
import type { ReaderPreferences } from "./useReaderPreferences";
import type { PageTools } from "./usePageTools";
import type { MushafAudio } from "./useMushafAudio";

const VIEW_OPEN_KEY = "qj_mushaf_view_open";

interface MushafReaderControlsProps {
  pageNumber: number;
  prefs: ReaderPreferences;
  pageTools: PageTools;
  audio: MushafAudio;
  searchOpen: boolean;
  onToggleSearch: () => void;
  listenRepeatActive: boolean;
  onToggleListenRepeat: () => void;
}

/**
 * Only the page's main actions (mark studied, listen-repeat, search) stay visible; page loop,
 * tajweed legend and reading preferences live in a folded "Ayarlar" panel so the verses come first.
 */
export function MushafReaderControls({
  pageNumber,
  prefs,
  pageTools,
  audio,
  searchOpen,
  onToggleSearch,
  listenRepeatActive,
  onToggleListenRepeat,
}: MushafReaderControlsProps) {
  const { pageStudied, markingPage, offlineSaved, savingOffline } = pageTools;
  const { isPageLooping, pageLoopStep } = audio;
  const [viewOpen, setViewOpen] = useState(false);

  useEffect(() => {
    try {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- restore persisted UI preference after hydration
      if (localStorage.getItem(VIEW_OPEN_KEY) === "1") setViewOpen(true);
    } catch {
      /* storage unavailable */
    }
  }, []);

  function toggleView() {
    setViewOpen((open) => {
      try {
        localStorage.setItem(VIEW_OPEN_KEY, open ? "0" : "1");
      } catch {
        /* storage unavailable */
      }
      return !open;
    });
  }

  return (
    <div className="pt-3 border-t border-line space-y-3 text-xs text-ink-soft">
      {/* Primary actions: what you do on a page */}
      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          disabled={markingPage}
          onClick={pageTools.markPageStudied}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition-colors",
            pageStudied
              ? "bg-mint text-forest border border-emerald/40"
              : "bg-forest text-white hover:bg-forest-deep"
          )}
        >
          <CheckCircle2 className="h-3.5 w-3.5" />
          <span>
            {pageStudied ? (
            `Sayfa ${pageNumber} Çalışıldı`
          ) : (
            <>
              <span className="sm:hidden">Çalışıldı İşaretle</span>
              <span className="hidden sm:inline">Sayfayı Çalışıldı İşaretle</span>
            </>
          )}
          </span>
        </button>
        <button
          type="button"
          onClick={onToggleListenRepeat}
          title="Seçili kelimeden başlayarak hoca okur, sen tekrar edersin"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition-colors",
            listenRepeatActive
              ? "bg-red-700 text-white"
              : "bg-gold text-white hover:bg-gold-ink"
          )}
        >
          <Ear className="h-3.5 w-3.5" />
          <span>{listenRepeatActive ? "Dinle-Tekrar Et: Bitir" : "Dinle ve Tekrar Et"}</span>
        </button>
        {isPageLooping && (
          <button
            type="button"
            onClick={audio.startPageLoop}
            className="inline-flex items-center gap-1.5 rounded-xl bg-red-700 px-3.5 py-2 font-semibold text-white"
          >
            <Repeat className="h-3.5 w-3.5" />
            <span>
              Döngüyü Durdur
              {pageLoopStep ? ` (${pageLoopStep.verseKey} · ${pageLoopStep.verseRepeatIndex}/${pageLoopStep.verseRepeatTotal})` : ""}
            </span>
          </button>
        )}
        <button
          type="button"
          onClick={onToggleSearch}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition-colors",
            searchOpen
              ? "border-forest bg-forest text-white"
              : "border-line bg-parchment text-ink hover:bg-sand"
          )}
        >
          <Search className="h-3.5 w-3.5" />
          <span>Ara</span>
        </button>
        <button
          type="button"
          onClick={toggleView}
          aria-expanded={viewOpen}
          aria-controls="mushaf-view-settings"
          className={cn(
            "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition-colors",
            viewOpen ? "border-forest bg-mint text-forest" : "border-line bg-parchment text-ink hover:bg-sand"
          )}
        >
          <SlidersHorizontal className="h-3.5 w-3.5" />
          <span>Ayarlar</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", viewOpen && "rotate-180")} />
        </button>
      </div>

      {/* Reading preferences, folded away so the first verse is visible right away */}
      {viewOpen && (
        <div
          id="mushaf-view-settings"
          className="grid gap-3 rounded-2xl border border-line bg-parchment p-3.5 sm:grid-cols-2 lg:grid-cols-3"
        >
          <div className="sm:col-span-2 lg:col-span-3 flex flex-wrap items-center gap-2">
            <span className="font-semibold text-ink">Sayfayı döngüyle dinle:</span>
            <div className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-parchment px-2 py-1">
              <select
                aria-label="Sayfa tekrar sayısı"
                value={audio.pageLoopRepeatCount}
                onChange={(e) => audio.setPageLoopRepeatCount(Number(e.target.value))}
                className="bg-transparent text-xs font-semibold text-ink"
              >
                <option value={1}>1x</option>
                <option value={2}>2x</option>
                <option value={3}>3x</option>
              </select>
              <button
                type="button"
                onClick={audio.startPageLoop}
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-2 py-0.5 font-semibold transition-colors",
                  isPageLooping ? "bg-red-700 text-white" : "bg-forest text-white hover:bg-forest-deep"
                )}
              >
                <Repeat className="h-3 w-3" />
                <span>
                  {isPageLooping && pageLoopStep
                    ? `Durdur (${pageLoopStep.verseKey} · ${pageLoopStep.verseRepeatIndex}/${pageLoopStep.verseRepeatTotal})`
                    : (
                      <>
                        <span className="sm:hidden">Döngü</span>
                        <span className="hidden sm:inline">Sayfa Döngüsel Dinle</span>
                      </>
                    )}
                </span>
              </button>
            </div>
          </div>
          {prefs.showTajweedColors && (
            <div className="sm:col-span-2 lg:col-span-3">
              <TajweedLegendStrip />
            </div>
          )}
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={prefs.toggleTajweedColors}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold transition-colors",
                prefs.showTajweedColors
                  ? "border-gold bg-gold-soft text-gold-deep"
                  : "border-line bg-parchment text-ink-soft hover:bg-sand"
              )}
            >
              <Sparkles className="h-3.5 w-3.5" />
              <span>{prefs.showTajweedColors ? "Renkli Tecvid: Açık" : "Renkli Tecvid: Kapalı"}</span>
            </button>
            <button
              type="button"
              onClick={() => prefs.setDarkReader(!prefs.darkReader)}
              aria-label="Okuma temasını değiştir"
              className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-parchment px-3 py-2 font-medium text-ink hover:bg-sand"
            >
              {prefs.darkReader ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
              <span>{prefs.darkReader ? "Aydınlık Sayfa" : "Karanlık Sayfa"}</span>
            </button>
          </div>
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex items-center gap-2">
              <span className="font-medium">Boyut ({prefs.fontSize}px):</span>
              <input
                type="range"
                min={24}
                max={50}
                value={prefs.fontSize}
                onChange={(e) => prefs.setFontSize(Number(e.target.value))}
                className="accent-forest"
              />
            </label>
            <label className="flex items-center gap-2">
              <span className="font-medium">Aralık:</span>
              <select
                value={prefs.lineHeight}
                onChange={(e) => prefs.setLineHeight(Number(e.target.value))}
                className="rounded-lg border border-line bg-parchment px-2 py-1"
              >
                <option value={1.9}>Sıkı (1.9)</option>
                <option value={2.15}>Dengeli (2.15)</option>
                <option value={2.5}>Geniş (2.5)</option>
              </select>
            </label>
          </div>
          <div className="flex min-w-0 flex-wrap items-center gap-x-4 gap-y-2">
            <label className="flex min-w-0 max-w-full items-center gap-2">
              <span className="font-medium shrink-0">Kâri:</span>
              <select
                aria-label="Kâri seç"
                value={prefs.reciterId}
                onChange={(e) => prefs.setReciterId(Number(e.target.value))}
                className="min-w-0 max-w-full flex-1 rounded-lg border border-line bg-parchment px-2 py-1"
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
                value={prefs.playbackSpeed}
                onChange={(e) => prefs.setPlaybackSpeed(Number(e.target.value))}
                className="rounded-lg border border-line bg-parchment px-2 py-1"
              >
                <option value={0.75}>0.75x (Yavaş)</option>
                <option value={1}>1.0x (Normal)</option>
                <option value={1.25}>1.25x</option>
              </select>
            </label>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => prefs.setShowTranslation(!prefs.showTranslation)}
              className="inline-flex items-center gap-1.5 rounded-lg border border-line bg-parchment px-2.5 py-1 font-medium hover:bg-sand"
            >
              {prefs.showTranslation ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
              <span>{prefs.showTranslation ? "Meali Gizle" : "Meali Göster"}</span>
            </button>

            {prefs.showTranslation && (
              <select
                aria-label="Meal kaynağı seç"
                value={prefs.translationId}
                onChange={(e) => prefs.setTranslationId(Number(e.target.value))}
                className="rounded-lg border border-line bg-parchment px-2 py-1"
              >
                <option value={77}>Diyanet İşleri Meali</option>
                <option value={52}>Elmalılı Hamdi Yazır Meali</option>
              </select>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <label className="inline-flex items-center gap-1.5 cursor-pointer">
              <input
                type="checkbox"
                checked={prefs.showTransliteration}
                onChange={(e) => prefs.setShowTransliteration(e.target.checked)}
                className="accent-forest"
              />
              <span>Okunuş Yardımı</span>
            </label>
            <button
              type="button"
              disabled={savingOffline}
              onClick={pageTools.downloadOffline}
              className={cn(
                "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition-colors",
                offlineSaved
                  ? "border-emerald/40 bg-mint text-forest"
                  : "border-line bg-parchment text-ink hover:bg-sand"
              )}
            >
              <Download className="h-3.5 w-3.5" />
              <span>
                {savingOffline ? "İndiriliyor..." : offlineSaved ? "Çevrimdışı Hazır" : "Sayfayı İndir"}
              </span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
