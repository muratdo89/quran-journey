"use client";

import React, { useState } from "react";
import Link from "next/link";
import { X } from "lucide-react";
import type { RootFrequencyEntry } from "@/lib/content/types";
import type { SearchVerseItem } from "./shared";

interface MushafSearchPanelProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Full-Quran normalized search drawer. It stays mounted while closed so the
 * query and results are kept when the drawer is reopened.
 */
export function MushafSearchPanel({ open, onClose }: MushafSearchPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<SearchVerseItem[]>([]);
  const [searchRoots, setSearchRoots] = useState<RootFrequencyEntry[]>([]);
  const [searchTotal, setSearchTotal] = useState(0);

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

  if (!open) return null;

  return (
    <div className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-4 space-y-3">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs font-bold text-[#1b4332]">
          Tam Kur&apos;an Arama (6.236 Ayet · Harekeli/Harekesiz Arapça, Türkçe Meal veya 2:255)
        </p>
        <button
          type="button"
          onClick={onClose}
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
              onClick={onClose}
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
  );
}
