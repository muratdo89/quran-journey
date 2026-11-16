"use client";

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  BookOpen,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  EyeOff,
  Languages,
  Pause,
  Play,
  Settings2,
  Type,
} from "lucide-react";
import type { HifzPageData, HifzVerse } from "@/lib/hifz/page-data";
import { useHifzStore } from "@/lib/hifz/store";
import { playSharedClip } from "@/lib/audio/shared-player";
import { cn, searchKey } from "@/lib/utils";
import { AudioBlockedNote, Sheet, SurahBanner, ToolChip, VerseBlock, VersePaper, useVersePlayer } from "@/components/hifz/shared";

export interface MushafNavData {
  surahs: { id: number; name: string; arabic: string; startPage: number }[];
  /** First page of each juz, index 0 = juz 1. */
  juzStarts: number[];
}

/* ---------- reader options (meal / okunuş / gizle), remembered per device ---------- */

type Options = { meal: boolean; reading: boolean; hidden: boolean };
const OPTIONS_KEY = "qj_mushaf_options";
const OPTIONS_EVENT = "qj-mushaf-options";
const DEFAULT_OPTIONS: Options = { meal: true, reading: false, hidden: false };
let optionsCache: { raw: string | null; value: Options } | null = null;

function readOptions(): Options {
  let raw: string | null = null;
  try {
    raw = localStorage.getItem(OPTIONS_KEY);
  } catch {
    /* storage unavailable */
  }
  if (optionsCache && optionsCache.raw === raw) return optionsCache.value;
  let value = DEFAULT_OPTIONS;
  try {
    if (raw) value = { ...DEFAULT_OPTIONS, ...(JSON.parse(raw) as Partial<Options>) };
  } catch {
    /* keep defaults */
  }
  optionsCache = { raw, value };
  return value;
}

function writeOptions(next: Options) {
  try {
    localStorage.setItem(OPTIONS_KEY, JSON.stringify(next));
  } catch {
    optionsCache = { raw: null, value: next };
  }
  window.dispatchEvent(new Event(OPTIONS_EVENT));
}

function subscribeOptions(cb: () => void) {
  window.addEventListener(OPTIONS_EVENT, cb);
  return () => window.removeEventListener(OPTIONS_EVENT, cb);
}

function useOptions(): [Options, (patch: Partial<Options>) => void] {
  const options = useSyncExternalStore(subscribeOptions, readOptions, () => DEFAULT_OPTIONS);
  return [options, (patch) => writeOptions({ ...readOptions(), ...patch })];
}

/* ---------- reader ---------- */

/**
 * The Mushaf, one page at a time and nothing else: Arabic like a printed Mushaf, meal and
 * Turkish reading on demand, a hide mode to test yourself, tap a word for its meaning, and
 * one button to listen to the page. Tecvid colours, notes and recordings live in the
 * advanced view (/mushaf/detay).
 */
export function MushafReader({
  data,
  nav,
  focusVerse,
}: {
  data: HifzPageData;
  nav: MushafNavData;
  focusVerse: string | null;
}) {
  const router = useRouter();
  const [options, setOptions] = useOptions();
  const [jumpOpen, setJumpOpen] = useState(false);
  const [word, setWord] = useState<{ verse: HifzVerse; index: number } | null>(null);
  const [hideToken, setHideToken] = useState(0);
  const player = useVersePlayer();
  const store = useHifzStore();
  const touch = useRef<{ x: number; y: number } | null>(null);

  const page = data.page;
  const prev = page > 1 ? page - 1 : null;
  const next = page < 604 ? page + 1 : null;
  const hifz = store?.pages[page];
  const status = !hifz ? null : hifz.status === "learning" ? "Öğreniliyor" : hifz.weak ? "Zayıf" : "Ezberlendi";

  // Remember the page, so Mushaf opens here next time.
  useEffect(() => {
    void fetch("/api/preferences", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ currentPageNumber: page }),
    }).catch(() => {});
  }, [page]);

  useEffect(() => {
    if (!focusVerse) return;
    document.getElementById(`v-${focusVerse}`)?.scrollIntoView({ block: "center" });
  }, [focusVerse]);

  // Keep the verse being recited in view.
  useEffect(() => {
    if (!player.activeKey) return;
    document.getElementById(`v-${player.activeKey}`)?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [player.activeKey]);

  function go(p: number | null) {
    if (!p) return;
    player.stop();
    router.push(`/mushaf?page=${p}`);
  }

  const startIndex = useMemo(() => {
    if (!player.activeKey) return 0;
    return Math.max(0, data.verses.findIndex((v) => v.key === player.activeKey));
  }, [player.activeKey, data.verses]);

  return (
    <div
      className="mx-auto max-w-2xl pb-28"
      onTouchStart={(e) => (touch.current = { x: e.touches[0]!.clientX, y: e.touches[0]!.clientY })}
      onTouchEnd={(e) => {
        const t = touch.current;
        touch.current = null;
        if (!t) return;
        const dx = e.changedTouches[0]!.clientX - t.x;
        const dy = e.changedTouches[0]!.clientY - t.y;
        // Like a printed Mushaf (right to left): swipe right for the next page.
        if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) go(dx > 0 ? next : prev);
      }}
    >
      {/* Page header: arrows follow the Mushaf (next page is on the left). */}
      <div className="sticky top-[57px] z-20 -mx-4 -mt-6 sm:-mt-8 border-b border-line/70 bg-parchment/95 px-4 py-2 backdrop-blur sm:-mx-6 sm:px-6 lg:top-0 lg:-mx-8 lg:px-8">
        <div className="flex items-center gap-2">
          <PageArrow dir="next" page={next} />
          <button
            type="button"
            onClick={() => setJumpOpen(true)}
            className="min-w-0 flex-1 rounded-2xl px-2 py-1 text-center hover:bg-sand"
            aria-label="Sayfa veya sure seç"
          >
            <span className="flex items-center justify-center gap-1 truncate text-sm font-semibold text-ink">
              {data.label}
              <ChevronDown className="h-3.5 w-3.5 shrink-0 text-muted" />
            </span>
            <span className="block text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-ink">
              Sayfa {page} · Cüz {data.juz}
            </span>
          </button>
          <PageArrow dir="prev" page={prev} />
        </div>
      </div>

      <div className="space-y-4 pt-4">
        <div className="flex flex-wrap items-center justify-center gap-2">
          <ToolChip on={options.meal} onClick={() => setOptions({ meal: !options.meal })}>
            <Languages className="h-3.5 w-3.5" />
            Meal
          </ToolChip>
          <ToolChip on={options.reading} onClick={() => setOptions({ reading: !options.reading })}>
            <Type className="h-3.5 w-3.5" />
            Okunuş
          </ToolChip>
          <ToolChip
            on={options.hidden}
            onClick={() => {
              setOptions({ hidden: !options.hidden });
              setHideToken((t) => t + 1);
            }}
          >
            <EyeOff className="h-3.5 w-3.5" />
            Ezber testi
          </ToolChip>
          {status && (
            <span
              className={cn(
                "rounded-full px-3 py-2 text-xs font-semibold",
                status === "Ezberlendi" ? "bg-mint text-forest" : status === "Zayıf" ? "bg-gold-soft text-gold-text" : "bg-sand text-ink-soft"
              )}
            >
              {status}
            </span>
          )}
        </div>
        {options.hidden && (
          <p className="text-center text-xs text-muted">Kelimeler gizli. Ezberden oku, takıldığın kelimeye dokun.</p>
        )}

        <VersePaper>
          {data.verses.map((v, i) => (
            <div key={`${v.key}-${options.hidden ? hideToken : "v"}`} id={`v-${v.key}`} className="scroll-mt-32">
              <SurahBanner verse={v} />
              <VerseBlock
                verse={v}
                hidden={options.hidden}
                active={player.activeKey === v.key || focusVerse === v.key}
                // Diyanet gives one meal for some verse groups: show it once, under the last verse.
                showMeal={options.meal && (!v.meal || data.verses[i + 1]?.meal !== v.meal)}
                showReading={options.reading}
                onWordTap={(index) => {
                  const w = v.words[index];
                  if (w?.audioUrl) playSharedClip(w.audioUrl);
                  setWord({ verse: v, index });
                }}
                activeWord={word?.verse.key === v.key ? word.index : null}
                onWordClose={() => setWord(null)}
              />
            </div>
          ))}
        </VersePaper>

        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            disabled={!next}
            onClick={() => go(next)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-forest hover:bg-sand disabled:opacity-40"
          >
            <ChevronLeft className="h-4 w-4" />
            Sonraki sayfa
          </button>
          <button
            type="button"
            disabled={!prev}
            onClick={() => go(prev)}
            className="flex items-center justify-center gap-1.5 rounded-2xl border border-line bg-surface px-4 py-3 text-sm font-semibold text-forest hover:bg-sand disabled:opacity-40"
          >
            Önceki sayfa
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
        <Link
          href={`/mushaf/detay?page=${page}`}
          className="mx-auto flex w-fit items-center gap-1.5 text-xs font-semibold text-muted hover:text-forest"
        >
          <Settings2 className="h-3.5 w-3.5" />
          Gelişmiş görünüm: renkli tecvid, notlar, ses kaydı
        </Link>
      </div>

      {/* Listen bar, above the phone menu. */}
      <div className="fixed inset-x-0 bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-30 px-4 lg:bottom-6 lg:pl-64">
        <div className="mx-auto flex max-w-2xl justify-center">
          <div className="flex items-center gap-2 rounded-full border border-line bg-surface/95 p-1.5 pr-4 shadow-lg shadow-forest/10 backdrop-blur">
            <button
              type="button"
              onClick={() => (player.playing ? player.stop() : void player.play(data.verses.slice(startIndex), 1))}
              aria-label={player.playing ? "Durdur" : "Sayfayı dinle"}
              className="flex h-11 w-11 items-center justify-center rounded-full bg-forest text-parchment"
            >
              {player.playing ? <Pause className="h-5 w-5" /> : <Play className="h-5 w-5 translate-x-0.5 fill-current" />}
            </button>
            <span className="text-sm font-semibold text-ink">
              {player.playing
                ? `${data.verses.find((v) => v.key === player.activeKey)?.surahNameTr ?? ""} ${data.verses.find((v) => v.key === player.activeKey)?.verseNumber ?? ""}. ayet`
                : "Sayfayı dinle"}
            </span>
          </div>
        </div>
        <div className="mx-auto mt-1 max-w-2xl">
          <AudioBlockedNote show={player.blocked} />
        </div>
      </div>

      {jumpOpen && <JumpSheet nav={nav} page={page} onClose={() => setJumpOpen(false)} onGo={(p) => { setJumpOpen(false); go(p); }} />}
    </div>
  );
}

function PageArrow({ dir, page }: { dir: "next" | "prev"; page: number | null }) {
  const Icon = dir === "next" ? ChevronLeft : ChevronRight;
  const label = dir === "next" ? "Sonraki sayfa" : "Önceki sayfa";
  if (!page) return <span className="h-10 w-10" />;
  return (
    <Link
      href={`/mushaf?page=${page}`}
      aria-label={label}
      title={label}
      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-line bg-surface text-forest hover:bg-sand"
    >
      <Icon className="h-5 w-5" />
    </Link>
  );
}

/* ---------- sheets ---------- */

function JumpSheet({
  nav,
  page,
  onClose,
  onGo,
}: {
  nav: MushafNavData;
  page: number;
  onClose: () => void;
  onGo: (page: number) => void;
}) {
  const [tab, setTab] = useState<"sure" | "cuz" | "sayfa">("sure");
  const [query, setQuery] = useState("");
  const [pageInput, setPageInput] = useState(String(page));
  const q = searchKey(query);
  const surahs = q
    ? nav.surahs.filter((s) => searchKey(s.name).includes(q) || String(s.id) === q)
    : nav.surahs;

  return (
    <Sheet title="Git" onClose={onClose}>
      <div className="mb-3 grid grid-cols-3 rounded-full bg-parchment p-1">
        {(["sure", "cuz", "sayfa"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn(
              "rounded-full py-2 text-xs font-semibold",
              tab === t ? "bg-surface text-forest shadow-xs" : "text-muted"
            )}
          >
            {t === "sure" ? "Sure" : t === "cuz" ? "Cüz" : "Sayfa"}
          </button>
        ))}
      </div>

      {tab === "sure" && (
        <>
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Sure ara (ör. Yâsîn)"
            className="mb-2 w-full rounded-xl border border-line bg-parchment px-3 py-2 text-sm"
          />
          <ul className="max-h-[50vh] divide-y divide-line overflow-y-auto">
            {surahs.map((s) => (
              <li key={s.id}>
                <button type="button" onClick={() => onGo(s.startPage)} className="flex w-full items-center gap-3 py-2.5 text-left hover:text-forest">
                  <span className="w-7 text-right text-xs font-semibold tabular-nums text-muted">{s.id}</span>
                  <span className="flex-1 text-sm font-medium text-ink">{s.name}</span>
                  <span dir="rtl" lang="ar" className="font-arabic text-lg text-ink-soft">
                    {s.arabic}
                  </span>
                  <span className="w-10 text-right text-[11px] text-muted">s. {s.startPage}</span>
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      {tab === "cuz" && (
        <div className="grid grid-cols-5 gap-2">
          {nav.juzStarts.map((p, i) => (
            <button
              key={i}
              type="button"
              onClick={() => onGo(p)}
              className="rounded-xl border border-line bg-parchment py-3 text-sm font-semibold text-ink hover:border-forest hover:text-forest"
            >
              {i + 1}
            </button>
          ))}
        </div>
      )}

      {tab === "sayfa" && (
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const p = Math.round(Number(pageInput));
            if (p >= 1 && p <= 604) onGo(p);
          }}
          className="flex gap-2"
        >
          <input
            type="number"
            inputMode="numeric"
            min={1}
            max={604}
            value={pageInput}
            onChange={(e) => setPageInput(e.target.value)}
            className="flex-1 rounded-xl border border-line bg-parchment px-3 py-3 text-base"
            aria-label="Sayfa numarası"
          />
          <button type="submit" className="flex items-center gap-1.5 rounded-xl bg-forest px-5 text-sm font-semibold text-parchment">
            <BookOpen className="h-4 w-4" />
            Aç
          </button>
        </form>
      )}
    </Sheet>
  );
}
