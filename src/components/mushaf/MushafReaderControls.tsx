"use client";

import React from "react";
import {
  CheckCircle2,
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
import type { ReaderPreferences } from "./useReaderPreferences";
import type { PageTools } from "./usePageTools";
import type { MushafAudio } from "./useMushafAudio";

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

/** Action and typography controls: study mark, search, offline, theme, reciter, tajweed, page loop. */
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

  return (
    <div className="pt-3 border-t border-[#e5dec9] flex flex-wrap items-center gap-2.5 text-xs text-[#3f4a43]">
      <button
        type="button"
        disabled={markingPage}
        onClick={pageTools.markPageStudied}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition-colors",
          pageStudied
            ? "bg-[#edf5f0] text-[#1b4332] border border-[#2d6a4f]/40"
            : "bg-[#1b4332] text-white hover:bg-[#143326]"
        )}
      >
        <CheckCircle2 className="h-3.5 w-3.5" />
        <span>
          {pageStudied ? `Sayfa ${pageNumber} Çalışıldı` : "Sayfayı Çalışıldı İşaretle"}
        </span>
      </button>

      <button
        type="button"
        onClick={onToggleSearch}
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
        onClick={pageTools.downloadOffline}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 font-semibold transition-colors",
          offlineSaved
            ? "border-[#2d6a4f]/40 bg-[#edf5f0] text-[#1b4332]"
            : "border-[#e5dec9] bg-[#faf8f3] text-[#1c241f] hover:bg-[#f3efe6]"
        )}
      >
        <Download className="h-3.5 w-3.5" />
        <span>
          {savingOffline ? "İndiriliyor..." : offlineSaved ? "Çevrimdışı Hazır" : "Sayfayı İndir"}
        </span>
      </button>

      <button
        type="button"
        onClick={() => prefs.setDarkReader(!prefs.darkReader)}
        aria-label="Okuma temasını değiştir"
        className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 font-medium text-[#1c241f] hover:bg-[#f3efe6]"
      >
        {prefs.darkReader ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
        <span>{prefs.darkReader ? "Aydınlık Sayfa" : "Karanlık Sayfa"}</span>
      </button>

      <label className="flex items-center gap-2">
        <span className="font-medium">Boyut ({prefs.fontSize}px):</span>
        <input
          type="range"
          min={24}
          max={50}
          value={prefs.fontSize}
          onChange={(e) => prefs.setFontSize(Number(e.target.value))}
          className="accent-[#1b4332]"
        />
      </label>

      <label className="flex items-center gap-2">
        <span className="font-medium">Aralık:</span>
        <select
          value={prefs.lineHeight}
          onChange={(e) => prefs.setLineHeight(Number(e.target.value))}
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
          value={prefs.reciterId}
          onChange={(e) => prefs.setReciterId(Number(e.target.value))}
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
          value={prefs.playbackSpeed}
          onChange={(e) => prefs.setPlaybackSpeed(Number(e.target.value))}
          className="rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2 py-1"
        >
          <option value={0.75}>0.75x (Yavaş)</option>
          <option value={1}>1.0x (Normal)</option>
          <option value={1.25}>1.25x</option>
        </select>
      </label>

      <button
        type="button"
        onClick={() => prefs.setShowTranslation(!prefs.showTranslation)}
        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-1 font-medium hover:bg-[#f3efe6]"
      >
        {prefs.showTranslation ? <Eye className="h-3.5 w-3.5" /> : <EyeOff className="h-3.5 w-3.5" />}
        <span>{prefs.showTranslation ? "Meali Gizle" : "Meali Göster"}</span>
      </button>

      {prefs.showTranslation && (
        <select
          aria-label="Meal kaynağı seç"
          value={prefs.translationId}
          onChange={(e) => prefs.setTranslationId(Number(e.target.value))}
          className="rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2 py-1"
        >
          <option value={77}>Diyanet İşleri Meali</option>
          <option value={52}>Elmalılı Hamdi Yazır Meali</option>
        </select>
      )}

      <label className="inline-flex items-center gap-1.5 cursor-pointer">
        <input
          type="checkbox"
          checked={prefs.showTransliteration}
          onChange={(e) => prefs.setShowTransliteration(e.target.checked)}
          className="accent-[#1b4332]"
        />
        <span>Okunuş Yardımı</span>
      </label>

      <button
        type="button"
        onClick={prefs.toggleTajweedColors}
        className={cn(
          "inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1 font-semibold transition-colors",
          prefs.showTajweedColors
            ? "border-[#b08d57] bg-[#f7f1e3] text-[#6e511e]"
            : "border-[#e5dec9] bg-[#faf8f3] text-[#3f4a43] hover:bg-[#f3efe6]"
        )}
      >
        <Sparkles className="h-3.5 w-3.5" />
        <span>{prefs.showTajweedColors ? "Renkli Tecvid: Açık" : "Renkli Tecvid: Kapalı"}</span>
      </button>

      <div className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2 py-1">
        <select
          aria-label="Sayfa tekrar sayısı"
          value={audio.pageLoopRepeatCount}
          onChange={(e) => audio.setPageLoopRepeatCount(Number(e.target.value))}
          className="bg-transparent text-xs font-semibold text-[#1c241f]"
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
            isPageLooping ? "bg-red-700 text-white" : "bg-[#1b4332] text-white hover:bg-[#143326]"
          )}
        >
          <Repeat className="h-3 w-3" />
          <span>
            {isPageLooping && pageLoopStep
              ? `Durdur (${pageLoopStep.verseKey} · ${pageLoopStep.verseRepeatIndex}/${pageLoopStep.verseRepeatTotal})`
              : "Sayfa Döngüsel Dinle"}
          </span>
        </button>
      </div>

      <button
        type="button"
        onClick={onToggleListenRepeat}
        title="Seçili kelimeden başlayarak hoca okur, sen tekrar edersin"
        className={cn(
          "inline-flex items-center gap-1.5 rounded-xl px-3.5 py-2 font-semibold transition-colors",
          listenRepeatActive
            ? "bg-red-700 text-white"
            : "bg-[#b08d57] text-white hover:bg-[#96773f]"
        )}
      >
        <Ear className="h-3.5 w-3.5" />
        <span>{listenRepeatActive ? "Dinle-Tekrar Et: Bitir" : "Dinle ve Tekrar Et"}</span>
      </button>
    </div>
  );
}
