"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BookOpen, Check, Loader2, Plus, Search, Volume2, X } from "lucide-react";
import type { CanonicalWord } from "@/lib/content/types";
import { playSharedClip } from "@/lib/audio/shared-player";
import { toTurkishReading } from "@/lib/content/turkish-reading";
import { currentNewPage } from "@/lib/hifz/plan";
import { useHifzStore } from "@/lib/hifz/store";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";

/** Where to look: one Mushaf page, one surah, or the whole Quran (search only). */
export type VocabularyScope = `page:${number}` | `surah:${number}` | "all";

interface VocabWord extends CanonicalWord {
  surahId: number;
  surahNameTr: string;
  verseKey: string;
  verseTranslationTr: string;
  count?: number;
}

interface WordsData {
  items: VocabWord[];
  total: number;
  page: number;
  totalPages: number;
}

interface VocabularyClientProps {
  surahs: Array<{ id: number; nameTurkish: string }>;
  initial: WordsData;
  initialScope: VocabularyScope;
  initialRoot: string | null;
  initialQuery: string;
  /** The URL asked for a specific scope, so don't jump to the hifz page. */
  explicit: boolean;
}

function scopeParams(scope: VocabularyScope): Record<string, string> {
  if (scope.startsWith("page:")) return { mpage: scope.slice(5) };
  if (scope.startsWith("surah:")) return { surah: scope.slice(6) };
  return { surah: "all" };
}

export function VocabularyClient({
  surahs,
  initial,
  initialScope,
  initialRoot,
  initialQuery,
  explicit,
}: VocabularyClientProps) {
  const store = useHifzStore();
  const hifzPage = store ? currentNewPage(store) : null;

  const [scope, setScope] = useState<VocabularyScope>(initialScope);
  const [query, setQuery] = useState(initialQuery);
  const [root, setRoot] = useState<string | null>(initialRoot);
  const [data, setData] = useState<WordsData>(initial);
  const [loading, setLoading] = useState(false);
  const [openLocation, setOpenLocation] = useState<string | null>(null);
  const [added, setAdded] = useState<Set<string>>(() => new Set());
  const requestId = useRef(0);
  const skipNextFetch = useRef(true);
  const [autoScoped, setAutoScoped] = useState(explicit);

  // Without an explicit link, start on the page being memorized (store is read after hydration).
  if (!autoScoped && store) {
    setAutoScoped(true);
    if (hifzPage) setScope(`page:${hifzPage}`);
  }

  const needsSearch = scope === "all" && !root && !query.trim();

  async function load(page: number, append: boolean) {
    const id = ++requestId.current;
    if (needsSearch) {
      setData({ items: [], total: 0, page: 1, totalPages: 1 });
      return;
    }
    setLoading(true);
    try {
      const sp = new URLSearchParams({
        ...scopeParams(scope),
        q: query.trim(),
        root: root ?? "all",
        page: String(page),
        unique: "1",
      });
      const res = await fetch(`/api/vocabulary?${sp.toString()}`);
      if (!res.ok || id !== requestId.current) return;
      const json = (await res.json()) as WordsData;
      setData((prev) => ({
        items: append ? [...prev.items, ...json.items] : json.items,
        total: json.total,
        page: json.page,
        totalPages: json.totalPages,
      }));
    } finally {
      if (id === requestId.current) setLoading(false);
    }
  }

  useEffect(() => {
    if (skipNextFetch.current) {
      skipNextFetch.current = false;
      return;
    }
    setOpenLocation(null);
    const timer = setTimeout(() => load(1, false), query ? 250 : 0);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope, query, root]);

  async function addToReview(location: string) {
    const res = await fetch("/api/review", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action: "ensure_vocab", wordLocation: location, direction: "ar_to_tr" }),
    });
    if (res.ok) setAdded((prev) => new Set(prev).add(location));
  }

  function openWord(w: VocabWord) {
    const next = openLocation === w.location ? null : w.location;
    setOpenLocation(next);
    if (next && w.audioUrl) playSharedClip(w.audioUrl);
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <PageHeader
        eyebrow="Kelimeler"
        title="Kelime hazinesi"
        description="Bir kelimeye dokun: sesi çalar, okunuşu ve anlamı açılır."
      />

      <div className="space-y-2.5">
        <label className="relative block">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Kelime ara (Türkçe ya da Arapça)"
            aria-label="Kelime ara"
            className="w-full rounded-2xl border border-line bg-surface py-3 pl-10 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </label>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Nerede aransın"
            value={scope}
            onChange={(e) => setScope(e.target.value as VocabularyScope)}
            className="min-w-0 flex-1 rounded-xl border border-line bg-surface px-3 py-2 text-sm font-medium text-ink sm:flex-none"
          >
            {hifzPage && <option value={`page:${hifzPage}`}>Ezber sayfam (s. {hifzPage})</option>}
            {scope.startsWith("page:") && scope !== `page:${hifzPage}` && (
              <option value={scope}>Sayfa {scope.slice(5)}</option>
            )}
            <option value="all">Tüm Kur&apos;an</option>
            <optgroup label="Sure">
              {surahs.map((s) => (
                <option key={s.id} value={`surah:${s.id}`}>
                  {s.id}. {s.nameTurkish}
                </option>
              ))}
            </optgroup>
          </select>

          {root && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-mint py-1 pl-3 pr-1.5 text-sm font-semibold text-forest">
              Kök
              <span lang="ar" dir="rtl" translate="no" className="font-arabic text-lg leading-none">
                {root}
              </span>
              <button
                type="button"
                onClick={() => setRoot(null)}
                aria-label="Kök filtresini kaldır"
                className="rounded-full p-1 hover:bg-forest/10"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </span>
          )}

          <span className="ml-auto text-xs text-muted" aria-live="polite">
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin" aria-label="Yükleniyor" />
            ) : needsSearch ? null : (
              `${data.total.toLocaleString("tr-TR")} kelime`
            )}
          </span>
        </div>
      </div>

      {needsSearch ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          Tüm Kur&apos;an&apos;da aramak için yukarıya bir kelime yaz.
        </p>
      ) : data.items.length === 0 && !loading ? (
        <p className="rounded-2xl border border-dashed border-line px-5 py-10 text-center text-sm text-muted">
          Kelime bulunamadı.
        </p>
      ) : (
        <ul className="divide-y divide-sand overflow-hidden rounded-2xl border border-line bg-surface">
          {data.items.map((w) => {
            const open = openLocation === w.location;
            const reading = toTurkishReading(w.transliteration);
            const isAdded = added.has(w.location);
            return (
              <li key={w.location} className={cn(open && "bg-gold-soft/30")}>
                <button
                  type="button"
                  onClick={() => openWord(w)}
                  aria-expanded={open}
                  className="flex w-full items-center gap-3 px-4 py-3 text-left hover:bg-parchment"
                >
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-base font-semibold text-forest">{w.translationTr || "—"}</span>
                    {reading && <span className="block truncate text-sm italic text-muted">{reading}</span>}
                  </span>
                  {w.count && w.count > 1 ? (
                    <span className="shrink-0 rounded-full bg-sand px-2 py-0.5 text-[11px] font-semibold text-muted">
                      {w.count}×
                    </span>
                  ) : null}
                  <span lang="ar" dir="rtl" translate="no" className="shrink-0 font-arabic text-[1.7rem] leading-[2.6rem] text-ink">
                    {w.textUthmani}
                  </span>
                </button>

                {open && (
                  <div className="space-y-3 px-4 pb-4">
                    <p className="text-sm leading-relaxed text-ink-soft">
                      <Link
                        href={`/mushaf?page=${w.pageNumber}&verse=${w.verseKey}`}
                        className="mr-1.5 inline-flex items-center gap-1 font-semibold text-forest hover:underline"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        {w.surahNameTr} {w.verseKey}
                      </Link>
                      {w.verseTranslationTr}
                    </p>
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={!w.audioUrl}
                        onClick={() => w.audioUrl && playSharedClip(w.audioUrl)}
                        className="inline-flex items-center gap-1.5 rounded-full bg-forest px-3.5 py-1.5 text-sm font-semibold text-parchment hover:bg-forest-deep disabled:opacity-40"
                      >
                        <Volume2 className="h-4 w-4" />
                        Dinle
                      </button>
                      <button
                        type="button"
                        disabled={isAdded}
                        onClick={() => addToReview(w.location)}
                        className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold text-forest hover:bg-sand disabled:opacity-70"
                      >
                        {isAdded ? <Check className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
                        {isAdded ? "Tekrara eklendi" : "Tekrara ekle"}
                      </button>
                      {w.morphology.rootArabic && w.morphology.rootArabic !== root && (
                        <button
                          type="button"
                          onClick={() => {
                            setRoot(w.morphology.rootArabic);
                            setScope("all");
                            setQuery("");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-full border border-line bg-surface px-3.5 py-1.5 text-sm font-semibold text-forest hover:bg-sand"
                        >
                          Aynı kökten
                          <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base leading-none">
                            {w.morphology.rootArabic}
                          </span>
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}

      {!needsSearch && data.page < data.totalPages && (
        <button
          type="button"
          disabled={loading}
          onClick={() => load(data.page + 1, true)}
          className="w-full rounded-2xl border border-line bg-surface py-3 text-sm font-semibold text-forest hover:bg-sand disabled:opacity-50"
        >
          Daha fazla göster
        </button>
      )}
    </div>
  );
}
