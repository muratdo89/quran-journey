"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import {
  Check,
  ChevronLeft,
  ChevronRight,
  GitBranch,
  Layers,
  Plus,
  Search,
  Volume2,
  X,
} from "lucide-react";
import type {
  CanonicalSurahMeta,
  CanonicalWord,
  RootFrequencyEntry,
} from "@/lib/content/types";
import type { WordProgressRecord } from "@/lib/db/types";
import { cn } from "@/lib/utils";

interface WordWithVerse extends CanonicalWord {
  surahId: number;
  surahNameTr: string;
  verseKey: string;
  verseTranslationTr: string;
}

interface PaginatedWordsData {
  items: WordWithVerse[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
}

interface PaginatedRootsData {
  items: RootFrequencyEntry[];
  total: number;
  page: number;
  totalPages: number;
}

interface VocabularyClientProps {
  initialTab?: "words" | "roots";
  initialWordsResult: PaginatedWordsData;
  initialRootsResult: PaginatedRootsData;
  surahs: CanonicalSurahMeta[];
  totals: {
    totalSurahs: number;
    totalPages: number;
    totalVerses: number;
    totalWords: number;
  };
  initialProgress: WordProgressRecord[];
  initialFilters: {
    surah: string;
    root: string;
    status: string;
    query: string;
  };
}

const STATUS_LABELS: Record<WordProgressRecord["status"], string> = {
  new: "Yeni",
  learning: "Öğreniliyor",
  known: "Bilinmekte",
  difficult: "Zorlanılan",
};

export function VocabularyClient({
  initialTab = "words",
  initialWordsResult,
  initialRootsResult,
  surahs,
  totals,
  initialProgress,
  initialFilters,
}: VocabularyClientProps) {
  const [activeTab, setActiveTab] = useState<"words" | "roots">(initialTab);

  // Word Explorer State
  const [query, setQuery] = useState(initialFilters.query);
  const [surahFilter, setSurahFilter] = useState(initialFilters.surah);
  const [statusFilter, setStatusFilter] = useState(initialFilters.status);
  const [rootFilter, setRootFilter] = useState(initialFilters.root);
  const [wordsData, setWordsData] = useState<PaginatedWordsData>(initialWordsResult);
  const [loadingWords, setLoadingWords] = useState(false);

  // Root Family Explorer State
  const [rootQuery, setRootQuery] = useState("");
  const [rootsData, setRootsData] = useState<PaginatedRootsData>(initialRootsResult);
  const [loadingRoots, setLoadingRoots] = useState(false);

  const [addedLocations, setAddedLocations] = useState<Set<string>>(() => new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);
  const isInitialMount = useRef(true);

  const progressMap = useMemo(() => {
    const map = new Map<string, WordProgressRecord>();
    for (const p of initialProgress) map.set(p.wordLocation, p);
    return map;
  }, [initialProgress]);

  async function fetchWords(params: {
    q: string;
    surah: string;
    status: string;
    root: string;
    page: number;
  }) {
    setLoadingWords(true);
    try {
      const sp = new URLSearchParams({
        tab: "words",
        surah: params.surah,
        status: params.status,
        root: params.root,
        q: params.q,
        page: String(params.page),
      });
      const res = await fetch(`/api/vocabulary?${sp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setWordsData({
          items: json.items,
          total: json.total,
          page: json.page,
          pageSize: json.pageSize,
          totalPages: json.totalPages,
        });
      }
    } finally {
      setLoadingWords(false);
    }
  }

  async function fetchRoots(q: string, page: number) {
    setLoadingRoots(true);
    try {
      const sp = new URLSearchParams({
        tab: "roots",
        q,
        page: String(page),
      });
      const res = await fetch(`/api/vocabulary?${sp.toString()}`);
      if (res.ok) {
        const json = await res.json();
        setRootsData({
          items: json.items,
          total: json.total,
          page: json.page,
          totalPages: json.totalPages,
        });
      }
    } finally {
      setLoadingRoots(false);
    }
  }

  // Debounced server fetch on words filter changes
  useEffect(() => {
    if (isInitialMount.current) {
      isInitialMount.current = false;
      return;
    }
    const timer = setTimeout(() => {
      fetchWords({
        q: query,
        surah: surahFilter,
        status: statusFilter,
        root: rootFilter,
        page: 1,
      });
    }, 240);
    return () => clearTimeout(timer);
  }, [query, surahFilter, statusFilter, rootFilter]);

  function playWord(url: string | null) {
    if (!url) return;
    new Audio(url).play().catch(() => {});
  }

  async function addCard(wordLocation: string, direction: "ar_to_tr" | "tr_to_ar") {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_vocab", wordLocation, direction }),
    });
    if (res.ok) {
      setAddedLocations((prev) => new Set([...prev, `${wordLocation}:${direction}`]));
    }
  }

  async function addSurahBulkCards(direction: "ar_to_tr" | "tr_to_ar") {
    if (surahFilter === "all") return;
    const surahId = Number(surahFilter);
    setBulkAdding(true);
    setBulkMessage(null);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "ensure_surah_vocab", surahId, direction }),
      });
      if (res.ok) {
        const data = await res.json();
        const dirLabel = direction === "ar_to_tr" ? "AR → TR" : "TR → AR";
        setBulkMessage(
          `${dirLabel} destesine ${data.addedCount} yeni kart eklendi (Sure toplamı: ${data.totalSurahCards} benzersiz kelime).`
        );
      }
    } finally {
      setBulkAdding(false);
    }
  }

  const activeSurahMeta =
    surahFilter !== "all" ? surahs.find((s) => String(s.id) === surahFilter) : null;

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1c241f]">
            Tam Kur&apos;an Kelime Hazinesi ve Kök Gezgini
          </h1>
          <p className="text-sm text-[#5a655e]">
            {totals.totalSurahs} Sure, {totals.totalWords.toLocaleString("tr-TR")} kelime ve{" "}
            {initialRootsResult.total.toLocaleString("tr-TR")} Kur&apos;an kökü arasında arama yapın, çift yönlü FSRS tekrar destenize ekleyin.
          </p>
        </div>

        {/* Mode Tabs */}
        <div className="inline-flex rounded-xl border border-[#e5dec9] bg-white p-1 self-start">
          <button
            type="button"
            onClick={() => setActiveTab("words")}
            className={cn(
              "rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
              activeTab === "words" ? "bg-[#1b4332] text-white" : "text-[#5a655e] hover:text-[#1c241f]"
            )}
          >
            Kelime Listesi ({totals.totalWords.toLocaleString("tr-TR")})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("roots")}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-lg px-4 py-2 text-xs font-semibold transition-colors",
              activeTab === "roots" ? "bg-[#1b4332] text-white" : "text-[#5a655e] hover:text-[#1c241f]"
            )}
          >
            <GitBranch className="h-3.5 w-3.5" />
            <span>Kök Ailesi Gezgini ({initialRootsResult.total})</span>
          </button>
        </div>
      </div>

      {activeTab === "words" ? (
        <>
          {/* Filters */}
          <div className="rounded-2xl border border-[#e5dec9] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            <div className="lg:col-span-2 relative">
              <Search className="h-4 w-4 text-[#5a655e] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Türkçe anlam, Arapça (harekeli/harekesiz) veya 2:255..."
                className="w-full rounded-xl border border-[#e5dec9] bg-[#faf8f3] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>

            <select
              aria-label="Sureye göre filtrele"
              value={surahFilter}
              onChange={(e) => {
                setSurahFilter(e.target.value);
                setBulkMessage(null);
              }}
              className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-medium"
            >
              <option value="all">Tüm Sureler ({surahs.length})</option>
              {surahs.map((s) => (
                <option key={s.id} value={String(s.id)}>
                  {s.id}. {s.nameTurkish} ({s.versesCount} ayet)
                </option>
              ))}
            </select>

            <select
              aria-label="Öğrenme durumuna göre filtrele"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-medium"
            >
              <option value="all">Tüm Durumlar</option>
              <option value="new">Yeni</option>
              <option value="learning">Öğreniliyor</option>
              <option value="known">Bilinmekte</option>
              <option value="difficult">Zorlanılan</option>
            </select>

            <select
              aria-label="Köke göre filtrele"
              value={rootFilter}
              onChange={(e) => setRootFilter(e.target.value)}
              className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-medium"
            >
              <option value="all">Tüm Kökler ({initialRootsResult.total})</option>
              {rootFilter !== "all" &&
                !initialRootsResult.items.some((r) => r.root === rootFilter) && (
                  <option value={rootFilter}>Seçili Kök: {rootFilter}</option>
                )}
              {initialRootsResult.items.map((r) => (
                <option key={r.root} value={r.root}>
                  Kök: {r.root} ({r.count}x)
                </option>
              ))}
            </select>
          </div>

          {rootFilter !== "all" && (
            <div className="flex items-center gap-2 text-xs">
              <span className="inline-flex items-center gap-2 rounded-full border border-[#1b4332]/30 bg-[#edf5f0] px-3.5 py-1 font-semibold text-[#1b4332]">
                <span>Aktif Kök Filtresi:</span>
                <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base">
                  {rootFilter}
                </span>
                <button
                  type="button"
                  onClick={() => setRootFilter("all")}
                  aria-label="Kök filtresini temizle"
                  className="hover:text-red-700"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </span>
            </div>
          )}

          {/* Bulk Surah Vocabulary Action Bar */}
          {activeSurahMeta && (
            <div className="rounded-2xl border border-[#e3d2ae] bg-[#f7f1e3] p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="flex items-start gap-2.5 text-xs text-[#4a3b1f]">
                <Layers className="h-4 w-4 text-[#9a7639] shrink-0 mt-0.5" />
                <div>
                  <p className="font-bold">
                    {activeSurahMeta.id}. {activeSurahMeta.nameTurkish} Suresi Kelime Desteği
                  </p>
                  <p className="opacity-90 mt-0.5">
                    {bulkMessage ??
                      "Bu suredeki benzersiz kelimeleri tek dokunuşla Aralıklı Tekrar (FSRS) kuyruğuna ekleyebilirsiniz."}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap gap-2 shrink-0">
                <button
                  type="button"
                  disabled={bulkAdding}
                  onClick={() => addSurahBulkCards("ar_to_tr")}
                  className="rounded-xl bg-[#1b4332] px-3.5 py-2 text-xs font-semibold text-white hover:bg-[#143326] disabled:opacity-50"
                >
                  Sureyi Ekle (AR → TR)
                </button>
                <button
                  type="button"
                  disabled={bulkAdding}
                  onClick={() => addSurahBulkCards("tr_to_ar")}
                  className="rounded-xl border border-[#8d682c] bg-white px-3.5 py-2 text-xs font-semibold text-[#6e511e] hover:bg-[#faf8f3] disabled:opacity-50"
                >
                  Sureyi Ekle (TR → AR)
                </button>
              </div>
            </div>
          )}

          {/* Results count & pagination top */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs text-[#5a655e]">
            <span>
              {loadingWords ? "Aranıyor..." : "Toplam "}
              <strong className="text-[#1c241f]">
                {wordsData.total.toLocaleString("tr-TR")}
              </strong>{" "}
              eşleşen kelime (Sayfa {wordsData.page}/{wordsData.totalPages})
            </span>
            {wordsData.totalPages > 1 && (
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  disabled={wordsData.page <= 1 || loadingWords}
                  onClick={() =>
                    fetchWords({
                      q: query,
                      surah: surahFilter,
                      status: statusFilter,
                      root: rootFilter,
                      page: Math.max(1, wordsData.page - 1),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e5dec9] bg-white px-3 py-1.5 font-semibold text-[#1c241f] disabled:opacity-40"
                >
                  <ChevronLeft className="h-3.5 w-3.5" />
                  <span>Önceki</span>
                </button>
                <button
                  type="button"
                  disabled={wordsData.page >= wordsData.totalPages || loadingWords}
                  onClick={() =>
                    fetchWords({
                      q: query,
                      surah: surahFilter,
                      status: statusFilter,
                      root: rootFilter,
                      page: Math.min(wordsData.totalPages, wordsData.page + 1),
                    })
                  }
                  className="inline-flex items-center gap-1 rounded-lg border border-[#e5dec9] bg-white px-3 py-1.5 font-semibold text-[#1c241f] disabled:opacity-40"
                >
                  <span>Sonraki</span>
                  <ChevronRight className="h-3.5 w-3.5" />
                </button>
              </div>
            )}
          </div>

          {/* Word Cards Grid */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {wordsData.items.map((w) => {
              const prog = progressMap.get(w.location);
              const status = prog?.status ?? "new";
              const addedAr = addedLocations.has(`${w.location}:ar_to_tr`);
              const addedTr = addedLocations.has(`${w.location}:tr_to_ar`);

              return (
                <article
                  key={w.location}
                  className="rounded-2xl border border-[#e5dec9] bg-white p-5 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <Link
                        href={`/mushaf?page=${w.pageNumber}&verse=${w.verseKey}`}
                        className="font-mono text-xs font-bold text-[#5a655e] hover:text-[#1b4332] hover:underline"
                      >
                        {w.surahNameTr} · {w.location}
                      </Link>
                      <span
                        className={cn(
                          "rounded-full px-2.5 py-0.5 text-[11px] font-semibold",
                          status === "known"
                            ? "bg-[#edf5f0] text-[#1b4332]"
                            : status === "difficult"
                              ? "bg-amber-100 text-amber-900"
                              : "bg-[#f3efe6] text-[#5a655e]"
                        )}
                      >
                        {STATUS_LABELS[status]}
                      </span>
                    </div>

                    <div className="flex items-center justify-between gap-3">
                      <div>
                        <p className="text-base font-bold text-[#1b4332]">{w.translationTr}</p>
                        <p className="text-[11px] text-[#5a655e] mt-0.5">
                          Kök:{" "}
                          {w.morphology.rootArabic ? (
                            <button
                              type="button"
                              onClick={() => setRootFilter(w.morphology.rootArabic!)}
                              className="underline decoration-dotted hover:text-[#1b4332]"
                            >
                              <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base">
                                {w.morphology.rootArabic}
                              </span>
                            </button>
                          ) : (
                            "—"
                          )}
                        </p>
                      </div>

                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          lang="ar"
                          dir="rtl"
                          translate="no"
                          className="font-arabic text-3xl text-[#1c241f]"
                        >
                          {w.textUthmani}
                        </span>
                        {w.audioUrl && (
                          <button
                            type="button"
                            onClick={() => playWord(w.audioUrl)}
                            aria-label={`${w.location} kelimesini dinle`}
                            className="rounded-lg bg-[#f3efe6] p-2 text-[#1b4332] hover:bg-[#e5dec9]"
                          >
                            <Volume2 className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    <p className="text-[11px] text-[#5a655e] border-t border-[#f3efe6] pt-2 leading-relaxed">
                      <strong>Ayet bağlamı ({w.verseKey}):</strong> {w.verseTranslationTr}
                    </p>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => addCard(w.location, "ar_to_tr")}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-1.5 text-[11px] font-semibold text-[#1b4332] hover:bg-[#f3efe6]"
                    >
                      {addedAr ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      <span>AR → TR Kart</span>
                    </button>
                    <button
                      type="button"
                      onClick={() => addCard(w.location, "tr_to_ar")}
                      className="inline-flex items-center justify-center gap-1 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-1.5 text-[11px] font-semibold text-[#6e511e] hover:bg-[#f7f1e3]"
                    >
                      {addedTr ? <Check className="h-3 w-3" /> : <Plus className="h-3 w-3" />}
                      <span>TR → AR Kart</span>
                    </button>
                  </div>
                </article>
              );
            })}
          </div>

          {wordsData.items.length === 0 && !loadingWords && (
            <div className="rounded-2xl border border-[#e5dec9] bg-white p-8 text-center text-sm text-[#5a655e]">
              Arama ölçütünüze uygun kelime bulunamadı.
            </div>
          )}
        </>
      ) : (
        /* Phase 3: Root Family Explorer Tab (1,651 Quranic Roots) */
        <div className="space-y-4">
          <div className="rounded-2xl border border-[#e5dec9] bg-white p-4 flex flex-col sm:flex-row gap-3">
            <div className="flex-1 relative">
              <Search className="h-4 w-4 text-[#5a655e] absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                value={rootQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  setRootQuery(val);
                  fetchRoots(val, 1);
                }}
                placeholder="Arapça kök (ör. رحم) veya Türkçe türev anlamı (ör. merhamet, kitap)..."
                className="w-full rounded-xl border border-[#e5dec9] bg-[#faf8f3] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
              />
            </div>
            <div className="flex items-center gap-2 text-xs text-[#5a655e]">
              <span>
                {loadingRoots ? "Yükleniyor..." : `${rootsData.total} kök`} (Sayfa {rootsData.page}/
                {rootsData.totalPages})
              </span>
              {rootsData.totalPages > 1 && (
                <div className="flex items-center gap-1.5">
                  <button
                    type="button"
                    disabled={rootsData.page <= 1}
                    onClick={() => fetchRoots(rootQuery, Math.max(1, rootsData.page - 1))}
                    className="rounded-lg border border-[#e5dec9] bg-white px-2.5 py-1.5 font-semibold disabled:opacity-40"
                  >
                    <ChevronLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={rootsData.page >= rootsData.totalPages}
                    onClick={() =>
                      fetchRoots(rootQuery, Math.min(rootsData.totalPages, rootsData.page + 1))
                    }
                    className="rounded-lg border border-[#e5dec9] bg-white px-2.5 py-1.5 font-semibold disabled:opacity-40"
                  >
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              )}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {rootsData.items.map((rootEntry) => (
              <article
                key={rootEntry.root}
                className="rounded-2xl border border-[#e5dec9] bg-white p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span
                      lang="ar"
                      dir="rtl"
                      translate="no"
                      className="font-arabic text-3xl font-bold text-[#1b4332]"
                    >
                      {rootEntry.root}
                    </span>
                    <div className="text-right text-[11px] text-[#5a655e]">
                      <p className="font-bold text-[#1c241f]">
                        {rootEntry.count.toLocaleString("tr-TR")} geçiş
                      </p>
                      <p>{rootEntry.surahsCount} surede</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1.5">
                    {rootEntry.samples.slice(0, 6).map((s) => (
                      <Link
                        key={s.location}
                        href={`/mushaf?page=${s.pageNumber}&verse=${s.verseKey}`}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-[#e5dec9] bg-[#faf8f3] px-2.5 py-1 text-xs hover:border-[#1b4332]"
                      >
                        <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base">
                          {s.textUthmani}
                        </span>
                        <span className="text-[11px] text-[#5a655e]">{s.translationTr}</span>
                      </Link>
                    ))}
                  </div>
                </div>

                <button
                  type="button"
                  onClick={() => {
                    setRootFilter(rootEntry.root);
                    setSurahFilter("all");
                    setStatusFilter("all");
                    setQuery("");
                    setActiveTab("words");
                  }}
                  className="rounded-xl bg-[#1b4332]/5 border border-[#1b4332]/30 px-3.5 py-2 text-xs font-semibold text-[#1b4332] hover:bg-[#1b4332] hover:text-white transition-colors"
                >
                  Bu Kökün Tüm Kelimelerini İncele →
                </button>
              </article>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
