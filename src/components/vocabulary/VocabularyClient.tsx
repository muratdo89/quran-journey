"use client";

import React, { useMemo, useState } from "react";
import { Check, ChevronLeft, ChevronRight, Layers, Plus, Search, Volume2 } from "lucide-react";
import type { CanonicalSurahMeta, CanonicalWord } from "@/lib/content/types";
import type { WordProgressRecord } from "@/lib/db/types";
import { cn } from "@/lib/utils";

interface WordWithVerse extends CanonicalWord {
  surahId: number;
  surahNameTr: string;
  verseKey: string;
  verseTranslationTr: string;
}

interface VocabularyClientProps {
  words: WordWithVerse[];
  surahs: CanonicalSurahMeta[];
  initialProgress: WordProgressRecord[];
}

const STATUS_LABELS: Record<WordProgressRecord["status"], string> = {
  new: "Yeni",
  learning: "Öğreniliyor",
  known: "Bilinmekte",
  difficult: "Zorlanılan",
};

const PAGE_SIZE = 24;

export function VocabularyClient({
  words,
  surahs,
  initialProgress,
}: VocabularyClientProps) {
  const [query, setQuery] = useState("");
  const [surahFilter, setSurahFilter] = useState<string>("all");
  const [statusFilter, setStatusFilter] = useState<string>("all");
  const [rootFilter, setRootFilter] = useState<string>("all");
  const [page, setPage] = useState(1);
  const [addedLocations, setAddedLocations] = useState<Set<string>>(() => new Set());
  const [bulkAdding, setBulkAdding] = useState(false);
  const [bulkMessage, setBulkMessage] = useState<string | null>(null);

  const progressMap = useMemo(() => {
    const map = new Map<string, WordProgressRecord>();
    for (const p of initialProgress) map.set(p.wordLocation, p);
    return map;
  }, [initialProgress]);

  const uniqueRoots = useMemo(() => {
    const set = new Set<string>();
    for (const w of words) {
      if (surahFilter !== "all" && String(w.surahId) !== surahFilter) continue;
      if (w.morphology.rootArabic) set.add(w.morphology.rootArabic);
    }
    return Array.from(set).sort();
  }, [words, surahFilter]);

  const filteredWords = useMemo(() => {
    const q = query.trim().toLowerCase();
    return words.filter((w) => {
      if (surahFilter !== "all" && String(w.surahId) !== surahFilter) return false;
      const prog = progressMap.get(w.location);
      const st = prog?.status ?? "new";
      if (statusFilter !== "all" && st !== statusFilter) return false;
      if (rootFilter !== "all" && w.morphology.rootArabic !== rootFilter) return false;
      if (!q) return true;
      return (
        w.textUthmani.includes(query.trim()) ||
        w.textImlaei.includes(query.trim()) ||
        w.translationTr.toLowerCase().includes(q) ||
        w.verseKey.includes(q) ||
        (w.morphology.rootArabic ?? "").includes(query.trim())
      );
    });
  }, [words, query, surahFilter, statusFilter, rootFilter, progressMap]);

  const totalPages = Math.max(1, Math.ceil(filteredWords.length / PAGE_SIZE));
  const safePage = Math.min(page, totalPages);
  const pagedWords = useMemo(() => {
    const start = (safePage - 1) * PAGE_SIZE;
    return filteredWords.slice(start, start + PAGE_SIZE);
  }, [filteredWords, safePage]);

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
      <div>
        <h1 className="text-2xl font-bold text-[#1c241f]">
          Kişisel Kur&apos;an Kelime Hazinesi
        </h1>
        <p className="text-sm text-[#5a655e]">
          Fâtiha ve Cüz Amme ({surahs.length} Sure, toplam {words.length} kelime) içinde Arapça/Türkçe arama yapın, kökleri inceleyin ve çift yönlü FSRS tekrar destenize ekleyin.
        </p>
      </div>

      {/* Filters */}
      <div className="rounded-2xl border border-[#e5dec9] bg-white p-4 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        <div className="lg:col-span-2 relative">
          <Search className="h-4 w-4 text-[#5a655e] absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setPage(1);
            }}
            placeholder="Türkçe anlam, Arapça kelime, kök veya ayet (ör. 112:1)..."
            className="w-full rounded-xl border border-[#e5dec9] bg-[#faf8f3] pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1b4332]"
          />
        </div>

        <select
          aria-label="Sureye göre filtrele"
          value={surahFilter}
          onChange={(e) => {
            setSurahFilter(e.target.value);
            setRootFilter("all");
            setBulkMessage(null);
            setPage(1);
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
          onChange={(e) => {
            setStatusFilter(e.target.value);
            setPage(1);
          }}
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
          onChange={(e) => {
            setRootFilter(e.target.value);
            setPage(1);
          }}
          className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3 py-2 text-xs font-medium"
        >
          <option value="all">Tüm Kökler ({uniqueRoots.length})</option>
          {uniqueRoots.map((root) => (
            <option key={root} value={root}>
              Kök: {root}
            </option>
          ))}
        </select>
      </div>

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
          Gösterilen: <strong className="text-[#1c241f]">{filteredWords.length}</strong> eşleşen kelime (Sayfa {safePage}/{totalPages})
        </span>
        {totalPages > 1 && (
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={safePage <= 1}
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              className="inline-flex items-center gap-1 rounded-lg border border-[#e5dec9] bg-white px-3 py-1.5 font-semibold text-[#1c241f] disabled:opacity-40"
            >
              <ChevronLeft className="h-3.5 w-3.5" />
              <span>Önceki</span>
            </button>
            <button
              type="button"
              disabled={safePage >= totalPages}
              onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
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
        {pagedWords.map((w) => {
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
                  <span className="font-mono text-xs font-bold text-[#5a655e]">
                    {w.surahNameTr} · {w.location}
                  </span>
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
                      <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base">
                        {w.morphology.rootArabic ?? "—"}
                      </span>
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

      {filteredWords.length === 0 && (
        <div className="rounded-2xl border border-[#e5dec9] bg-white p-8 text-center text-sm text-[#5a655e]">
          Arama ölçütünüze uygun kelime bulunamadı.
        </div>
      )}
    </div>
  );
}
