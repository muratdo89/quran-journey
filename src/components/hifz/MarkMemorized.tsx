"use client";

import React, { useMemo, useState } from "react";
import { Check, Search } from "lucide-react";
import type { HifzMeta } from "@/lib/hifz/page-data";
import { setMemorizedPages, type HifzStore } from "@/lib/hifz/plan";
import { updateHifzStore } from "@/lib/hifz/store";
import { Sheet } from "@/components/hifz/shared";
import { cn, searchKey } from "@/lib/utils";

export function memorizedPagesOf(store: HifzStore | null): number[] {
  if (!store) return [];
  return Object.entries(store.pages)
    .filter(([, s]) => s.status === "memorized")
    .map(([p]) => Number(p));
}

/**
 * "Ezberlediğim yerler": tick the surahs (or pages) you already know by heart.
 * A page counts as memorized once every surah on it is ticked, so short surahs that share a page work too.
 */
export function MarkMemorizedSheet({ meta, store, onClose }: { meta: HifzMeta; store: HifzStore; onClose: () => void }) {
  const [pages, setPages] = useState<Set<number>>(() => new Set(memorizedPagesOf(store)));
  // Surahs ticked whose pages are not all marked yet (they share a page with an unticked surah).
  const [pending, setPending] = useState<Set<number>>(() => new Set());
  const [tab, setTab] = useState<"sure" | "sayfa">("sure");
  const [query, setQuery] = useState("");

  const surahsOnPage = useMemo(() => {
    const out = new Map<number, number[]>();
    for (const s of meta.surahs) for (let p = s.start; p <= s.end; p++) out.set(p, [...(out.get(p) ?? []), s.id]);
    return out;
  }, [meta.surahs]);
  const byId = useMemo(() => new Map(meta.surahs.map((s) => [s.id, s])), [meta.surahs]);
  const juzPages = useMemo(() => {
    const out: number[][] = Array.from({ length: 30 }, () => []);
    meta.pageJuz.forEach((j, i) => out[Math.min(29, Math.max(0, j - 1))]!.push(i + 1));
    return out;
  }, [meta.pageJuz]);

  const range = (id: number) => {
    const s = byId.get(id)!;
    return Array.from({ length: s.end - s.start + 1 }, (_, i) => s.start + i);
  };
  const fullyMarked = (id: number, set: Set<number>) => range(id).every((p) => set.has(p));
  const isTicked = (id: number) => pending.has(id) || fullyMarked(id, pages);

  function toggleSurah(id: number) {
    const nextPages = new Set(pages);
    const nextPending = new Set(pending);
    if (isTicked(id)) {
      nextPending.delete(id);
      for (const p of range(id)) {
        // Keep neighbours on a shared page ticked even though that page is no longer complete.
        for (const other of surahsOnPage.get(p) ?? []) if (other !== id && isTicked(other)) nextPending.add(other);
        nextPages.delete(p);
      }
    } else {
      nextPending.add(id);
      const ticked = (s: number) => nextPending.has(s) || fullyMarked(s, pages);
      for (const p of range(id)) if ((surahsOnPage.get(p) ?? []).every(ticked)) nextPages.add(p);
    }
    for (const s of [...nextPending]) if (fullyMarked(s, nextPages)) nextPending.delete(s);
    setPages(nextPages);
    setPending(nextPending);
  }

  function setMany(list: number[], on: boolean) {
    const next = new Set(pages);
    for (const p of list) {
      if (on) next.add(p);
      else next.delete(p);
    }
    setPages(next);
    if (!on) setPending(new Set());
  }

  function save() {
    updateHifzStore((s) => setMemorizedPages(s, pages));
    onClose();
  }

  const q = searchKey(query);
  const surahs = q
    ? meta.surahs.filter((s) => searchKey(s.name).includes(q) || String(s.id) === q)
    : meta.surahs;
  const amme = juzPages[29]!;
  const ammeOn = amme.every((p) => pages.has(p));

  return (
    <Sheet title="Ezberlediğim yerler" onClose={onClose}>
      <p className="-mt-1 text-sm text-muted">
        Bildiğin sureleri işaretle. Bu sayfalar yeni derste atlanır, sadece tekrarlarda gelir.
      </p>

      <div className="mt-3 grid grid-cols-2 rounded-full bg-parchment p-1">
        {(["sure", "sayfa"] as const).map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => setTab(t)}
            className={cn("rounded-full py-2 text-xs font-semibold", tab === t ? "bg-surface text-forest shadow-xs" : "text-muted")}
          >
            {t === "sure" ? "Sure" : "Sayfa"}
          </button>
        ))}
      </div>

      {tab === "sure" ? (
        <>
          <button
            type="button"
            onClick={() => {
              setMany(amme, !ammeOn);
            }}
            className={cn(
              "mt-3 flex w-full items-center gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
              ammeOn ? "border-forest bg-mint" : "border-line hover:bg-sand"
            )}
          >
            <Tick on={ammeOn} />
            <span className="flex-1">
              <span className="block text-sm font-semibold text-ink">Amme cüzünün tamamı</span>
              <span className="block text-xs text-muted">Nebe&apos;den Nâs&apos;a, {amme.length} sayfa</span>
            </span>
          </button>
          <label className="mt-3 flex items-center gap-2 rounded-2xl border border-line bg-parchment px-3 py-2.5">
            <Search className="h-4 w-4 text-muted" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Sure ara"
              className="min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted"
            />
          </label>
          <ul className="mt-2 divide-y divide-line/70">
            {surahs.map((s) => {
              const on = isTicked(s.id);
              const some = !on && range(s.id).some((p) => pages.has(p));
              return (
                <li key={s.id}>
                  <button type="button" onClick={() => toggleSurah(s.id)} className="flex w-full items-center gap-3 py-2.5 text-left">
                    <Tick on={on} />
                    <span className="w-7 text-xs tabular-nums text-muted">{s.id}</span>
                    <span className="min-w-0 flex-1">
                      <span className={cn("block truncate text-sm", on ? "font-semibold text-forest" : "text-ink")}>{s.name}</span>
                      {some && <span className="block text-[11px] text-gold-deep">Bir kısmı işaretli</span>}
                    </span>
                    <span dir="rtl" lang="ar" className="font-arabic text-lg text-ink-soft">
                      {s.arabic}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <div className="mt-3 space-y-1.5">
          <p className="text-xs text-muted">Kareye dokun: sayfa işaretlenir. Cüz numarasına dokun: bütün cüz.</p>
          {juzPages.map((list, i) => {
            const all = list.every((p) => pages.has(p));
            return (
              <div key={i} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setMany(list, !all)}
                  aria-label={`Cüz ${i + 1}, tümünü ${all ? "kaldır" : "işaretle"}`}
                  className={cn(
                    "w-7 shrink-0 rounded-md py-0.5 text-center text-[11px] font-semibold tabular-nums",
                    all ? "bg-forest text-parchment" : "text-muted hover:bg-sand"
                  )}
                >
                  {i + 1}
                </button>
                <div className="grid flex-1 grid-cols-[repeat(23,minmax(0,1fr))] gap-[3px]">
                  {list.map((p) => (
                    <button
                      key={p}
                      type="button"
                      title={`Sayfa ${p}`}
                      aria-label={`Sayfa ${p}`}
                      aria-pressed={pages.has(p)}
                      onClick={() => setMany([p], !pages.has(p))}
                      className={cn("aspect-square rounded-[3px]", pages.has(p) ? "bg-forest" : "bg-track hover:bg-line")}
                    />
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div className="sticky -bottom-5 -mx-5 mt-4 border-t border-line bg-surface/95 px-5 pb-1 pt-3 backdrop-blur">
        <button
          type="button"
          onClick={save}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-forest px-6 py-3.5 text-base font-semibold text-parchment hover:bg-forest-deep"
        >
          <Check className="h-4 w-4" />
          Kaydet · {pages.size} sayfa
        </button>
      </div>
    </Sheet>
  );
}

function Tick({ on }: { on: boolean }) {
  return (
    <span
      className={cn(
        "grid h-5 w-5 shrink-0 place-items-center rounded-md border transition-colors",
        on ? "border-forest bg-forest text-parchment" : "border-line bg-surface"
      )}
    >
      {on && <Check className="h-3.5 w-3.5" strokeWidth={3} />}
    </span>
  );
}
