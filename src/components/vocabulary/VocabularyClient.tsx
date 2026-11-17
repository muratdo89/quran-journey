"use client";

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Check, ChevronLeft, ChevronRight, Loader2, RotateCcw, Search, Volume2, X } from "lucide-react";
import type { CanonicalWord } from "@/lib/content/types";
import { playSharedClip } from "@/lib/audio/shared-player";
import { toTurkishReading } from "@/lib/content/turkish-reading";
import { currentNewPage } from "@/lib/hifz/plan";
import { useHifzStore } from "@/lib/hifz/store";
import { cn } from "@/lib/utils";

export interface VocabWord extends CanonicalWord {
  surahId: number;
  surahNameTr: string;
  verseKey: string;
  verseTranslationTr: string;
  count?: number;
}

interface VocabularyClientProps {
  initialPage: number;
  initialWords: VocabWord[];
  initialRoot: string | null;
  initialQuery: string;
  /** The URL named a page, so don't jump to the hifz page. */
  explicit: boolean;
}

const ROUND_SIZE = 10;
const TOTAL_PAGES = 604;

/* ---------- known words (this device) ---------- */

const KNOWN_KEY = "qj_vocab_known_v1";
const KNOWN_EVENT = "qj-vocab-known";
const EMPTY: string[] = [];
let knownCache: { raw: string | null; list: string[] } = { raw: null, list: EMPTY };

function readKnown(): string[] {
  try {
    const raw = localStorage.getItem(KNOWN_KEY);
    if (raw !== knownCache.raw) {
      const parsed = raw ? JSON.parse(raw) : [];
      knownCache = { raw, list: Array.isArray(parsed) ? parsed.filter((x) => typeof x === "string") : EMPTY };
    }
  } catch {
    /* storage blocked: nothing known */
  }
  return knownCache.list;
}

function writeKnown(update: (s: Set<string>) => void) {
  const next = new Set(readKnown());
  update(next);
  try {
    localStorage.setItem(KNOWN_KEY, JSON.stringify([...next]));
  } catch {
    /* ignore */
  }
  window.dispatchEvent(new Event(KNOWN_EVENT));
}

function subscribeKnown(cb: () => void) {
  window.addEventListener(KNOWN_EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(KNOWN_EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Same word in another place counts as the same word. */
const wordKey = (w: Pick<CanonicalWord, "textUthmani">) => w.textUthmani;

/* ---------- page ---------- */

export function VocabularyClient({ initialPage, initialWords, initialRoot, initialQuery, explicit }: VocabularyClientProps) {
  const store = useHifzStore();
  const hifzPage = store ? currentNewPage(store) : null;
  const knownList = useSyncExternalStore(subscribeKnown, readKnown, () => EMPTY);
  const known = useMemo(() => new Set(knownList), [knownList]);

  const [page, setPage] = useState(initialPage);
  const [words, setWords] = useState<VocabWord[]>(initialWords);
  const [loading, setLoading] = useState(false);
  const [autoScoped, setAutoScoped] = useState(explicit);
  const [round, setRound] = useState<VocabWord[] | null>(null);
  const [searchOpen, setSearchOpen] = useState(Boolean(initialRoot || initialQuery));
  const skipFirst = useRef(true);

  // Start on the page being memorized unless a link named a page.
  if (!autoScoped && store) {
    setAutoScoped(true);
    if (hifzPage && hifzPage !== page) setPage(hifzPage);
  }

  useEffect(() => {
    if (skipFirst.current) {
      skipFirst.current = false;
      return;
    }
    let cancelled = false;
    setLoading(true);
    fetch(`/api/vocabulary?mpage=${page}&unique=1`)
      .then((r) => (r.ok ? r.json() : null))
      .then((json) => {
        if (!cancelled && json) setWords(json.items);
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [page]);

  const knownCount = words.filter((w) => known.has(wordKey(w))).length;
  const unknown = words.filter((w) => !known.has(wordKey(w)));
  const pct = words.length ? Math.round((knownCount / words.length) * 100) : 0;
  const surahName = words[0]?.surahNameTr;

  function startRound() {
    const pool = unknown.length > 0 ? unknown : words;
    setRound(pool.slice(0, ROUND_SIZE));
  }

  if (round) {
    return <LearnRound words={round} onExit={() => setRound(null)} />;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-5">
      <div className="space-y-1">
        <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-ink">Kelimeler</p>
        <h1 className="font-display text-[1.75rem] font-semibold leading-tight tracking-tight text-ink sm:text-[2rem]">
          Sayfanın kelimeleri
        </h1>
        <p className="text-sm text-muted">Ezberlediğin sayfadaki kelimeleri kart kart öğren.</p>
      </div>

      {/* The one thing to do */}
      <section className="rounded-3xl border border-line bg-surface p-5 sm:p-6">
        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={page <= 1}
            aria-label="Önceki sayfa"
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sand disabled:opacity-30"
          >
            <ChevronLeft className="h-5 w-5" />
          </button>
          <div className="text-center">
            <p className="text-base font-semibold text-ink">
              Sayfa {page}
              {surahName && <span className="font-normal text-muted"> · {surahName}</span>}
            </p>
            {page === hifzPage && <p className="text-xs font-semibold text-gold-ink">Ezber sayfan</p>}
          </div>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(TOTAL_PAGES, p + 1))}
            disabled={page >= TOTAL_PAGES}
            aria-label="Sonraki sayfa"
            className="grid h-9 w-9 place-items-center rounded-full text-muted hover:bg-sand disabled:opacity-30"
          >
            <ChevronRight className="h-5 w-5" />
          </button>
        </div>

        <div className="mt-5 space-y-2">
          <div className="flex items-baseline justify-between text-sm">
            <span className="text-ink-soft">
              <strong className="text-ink">{knownCount}</strong> / {words.length} kelimeyi biliyorsun
            </span>
            {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Yükleniyor" />}
          </div>
          <div className="h-2 overflow-hidden rounded-full bg-sand">
            <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${pct}%` }} />
          </div>
        </div>

        <button
          type="button"
          onClick={startRound}
          disabled={loading || words.length === 0}
          className="mt-5 w-full rounded-2xl bg-forest py-3.5 text-base font-semibold text-parchment hover:bg-forest-deep disabled:opacity-50"
        >
          {unknown.length === 0 && words.length > 0
            ? "Hepsini biliyorsun · Tekrar et"
            : `Öğrenmeye başla · ${Math.min(ROUND_SIZE, unknown.length)} kelime`}
        </button>
      </section>

      {/* Glance at the page's words */}
      <section className="space-y-2.5">
        <h2 className="text-sm font-semibold text-ink-soft">Bu sayfadaki kelimeler</h2>
        <WordTiles words={words} known={known} />
      </section>

      <div className="border-t border-line pt-4">
        {searchOpen ? (
          <WordSearch initialQuery={initialQuery} initialRoot={initialRoot} known={known} onClose={() => setSearchOpen(false)} />
        ) : (
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="inline-flex items-center gap-2 text-sm font-semibold text-forest hover:underline"
          >
            <Search className="h-4 w-4" />
            Başka bir kelime ara
          </button>
        )}
      </div>
    </div>
  );
}

/* ---------- tiles: tap to hear ---------- */

function WordTiles({ words, known }: { words: VocabWord[]; known: Set<string> }) {
  if (words.length === 0) return null;
  return (
    <ul className="grid grid-cols-2 gap-2 sm:grid-cols-3">
      {words.map((w) => {
        const isKnown = known.has(wordKey(w));
        return (
          <li key={w.location}>
            <button
              type="button"
              onClick={() => w.audioUrl && playSharedClip(w.audioUrl)}
              className={cn(
                "relative flex w-full flex-col items-center gap-0.5 rounded-2xl border px-2 pb-2.5 pt-1.5 text-center transition-colors",
                isKnown ? "border-forest/25 bg-mint/60" : "border-line bg-surface hover:bg-parchment",
              )}
            >
              {isKnown && <Check className="absolute left-2 top-2 h-3.5 w-3.5 text-forest" aria-label="Biliyorsun" />}
              <span lang="ar" dir="rtl" translate="no" className="font-arabic text-[1.6rem] leading-[2.6rem] text-ink">
                {w.textUthmani}
              </span>
              <span className="line-clamp-1 text-xs font-medium text-ink-soft">{w.translationTr || "—"}</span>
            </button>
          </li>
        );
      })}
    </ul>
  );
}

/* ---------- learning round: one card at a time ---------- */

function LearnRound({ words, onExit }: { words: VocabWord[]; onExit: () => void }) {
  const [queue, setQueue] = useState<VocabWord[]>(words);
  const [revealed, setRevealed] = useState(false);
  const [learned, setLearned] = useState(0);
  const current = queue[0];

  useEffect(() => {
    if (current?.audioUrl) playSharedClip(current.audioUrl);
  }, [current]);

  if (!current) {
    return (
      <div className="mx-auto flex min-h-[60vh] max-w-md flex-col items-center justify-center gap-4 text-center">
        <div className="grid h-16 w-16 place-items-center rounded-full bg-mint text-forest">
          <Check className="h-8 w-8" />
        </div>
        <h1 className="font-display text-2xl font-semibold text-ink">Tur bitti</h1>
        <p className="text-sm text-muted">{learned} kelimeyi öğrendin. Bu cihazda hatırlanıyor.</p>
        <button
          type="button"
          onClick={onExit}
          className="mt-2 w-full rounded-2xl bg-forest py-3.5 text-base font-semibold text-parchment hover:bg-forest-deep"
        >
          Kelimelere dön
        </button>
      </div>
    );
  }

  const reading = toTurkishReading(current.transliteration);
  const done = words.length - new Set(queue.map((w) => w.location)).size;

  function answer(knowIt: boolean) {
    const [head, ...rest] = queue;
    if (knowIt) {
      writeKnown((s) => s.add(wordKey(head)));
      setLearned((n) => n + 1);
      setQueue(rest);
    } else {
      setQueue([...rest, head]);
    }
    setRevealed(false);
  }

  return (
    <div className="mx-auto flex max-w-md flex-col gap-5">
      <div className="flex items-center gap-3">
        <button type="button" onClick={onExit} aria-label="Turu bitir" className="rounded-full p-2 text-muted hover:bg-sand">
          <X className="h-5 w-5" />
        </button>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-sand">
          <div className="h-full rounded-full bg-forest transition-all" style={{ width: `${(done / words.length) * 100}%` }} />
        </div>
        <span className="w-12 text-right text-sm tabular-nums text-muted">
          {done}/{words.length}
        </span>
      </div>

      <section className="flex min-h-[22rem] flex-col items-center justify-center gap-4 rounded-3xl border border-line bg-surface px-6 py-8 text-center">
        <span lang="ar" dir="rtl" translate="no" className="font-arabic text-[3.5rem] leading-[5.5rem] text-ink">
          {current.textUthmani}
        </span>
        <button
          type="button"
          onClick={() => current.audioUrl && playSharedClip(current.audioUrl)}
          disabled={!current.audioUrl}
          aria-label="Tekrar dinle"
          className="grid h-11 w-11 place-items-center rounded-full bg-sand text-forest hover:bg-line disabled:opacity-40"
        >
          <Volume2 className="h-5 w-5" />
        </button>

        {revealed ? (
          <div className="space-y-2 pt-1">
            {reading && <p className="text-base italic text-muted">{reading}</p>}
            <p className="text-2xl font-semibold text-forest">{current.translationTr || "—"}</p>
            <p className="pt-2 text-sm leading-relaxed text-ink-soft">
              <span className="font-semibold">{current.verseKey}</span> {current.verseTranslationTr}
            </p>
          </div>
        ) : (
          <p className="pt-1 text-sm text-muted">Anlamını hatırlıyor musun?</p>
        )}
      </section>

      {revealed ? (
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => answer(false)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl border border-gold-line bg-gold-soft py-3.5 text-base font-semibold text-gold-deep hover:brightness-95"
          >
            <RotateCcw className="h-4 w-4" />
            Tekrar sor
          </button>
          <button
            type="button"
            onClick={() => answer(true)}
            className="inline-flex items-center justify-center gap-2 rounded-2xl bg-forest py-3.5 text-base font-semibold text-parchment hover:bg-forest-deep"
          >
            <Check className="h-4 w-4" />
            Biliyorum
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setRevealed(true)}
          className="w-full rounded-2xl bg-forest py-3.5 text-base font-semibold text-parchment hover:bg-forest-deep"
        >
          Anlamını göster
        </button>
      )}
    </div>
  );
}

/* ---------- search (secondary) ---------- */

function WordSearch({
  initialQuery,
  initialRoot,
  known,
  onClose,
}: {
  initialQuery: string;
  initialRoot: string | null;
  known: Set<string>;
  onClose: () => void;
}) {
  const [query, setQuery] = useState(initialQuery);
  const [root, setRoot] = useState(initialRoot);
  const [results, setResults] = useState<VocabWord[]>([]);
  const [loading, setLoading] = useState(false);
  const empty = !query.trim() && !root;

  useEffect(() => {
    if (empty) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setLoading(true);
      const sp = new URLSearchParams({ surah: "all", q: query.trim(), root: root ?? "all", unique: "1" });
      fetch(`/api/vocabulary?${sp.toString()}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((json) => {
          if (!cancelled && json) setResults(json.items);
        })
        .finally(() => !cancelled && setLoading(false));
    }, 250);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [query, root, empty]);

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <label className="relative block flex-1">
          <Search className="pointer-events-none absolute left-3.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted" />
          <input
            type="search"
            autoFocus={!initialRoot}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Türkçe ya da Arapça yaz"
            aria-label="Kelime ara"
            className="w-full rounded-2xl border border-line bg-surface py-2.5 pl-10 pr-3 text-base focus:outline-none focus:ring-2 focus:ring-forest"
          />
        </label>
        <button type="button" onClick={onClose} aria-label="Aramayı kapat" className="rounded-full p-2 text-muted hover:bg-sand">
          <X className="h-5 w-5" />
        </button>
      </div>
      {root && (
        <span className="inline-flex items-center gap-1.5 rounded-full bg-mint py-1 pl-3 pr-1.5 text-sm font-semibold text-forest">
          Kök
          <span lang="ar" dir="rtl" translate="no" className="font-arabic text-lg leading-none">
            {root}
          </span>
          <button type="button" onClick={() => setRoot(null)} aria-label="Kök filtresini kaldır" className="rounded-full p-1 hover:bg-forest/10">
            <X className="h-3.5 w-3.5" />
          </button>
        </span>
      )}
      {loading && <Loader2 className="h-4 w-4 animate-spin text-muted" aria-label="Aranıyor" />}
      {!empty && !loading && results.length === 0 && <p className="text-sm text-muted">Kelime bulunamadı.</p>}
      {!empty && <WordTiles words={results} known={known} />}
    </div>
  );
}
