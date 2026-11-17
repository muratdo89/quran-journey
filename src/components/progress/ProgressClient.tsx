"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { ChevronRight, ListChecks, Settings2 } from "lucide-react";
import { TOOLS } from "@/components/layout/tools";
import { TOTAL_PAGES, buildTodayPlan, type HifzPageState } from "@/lib/hifz/plan";
import { useHifzStore } from "@/lib/hifz/store";
import { SetupCard } from "@/components/hifz/HifzHome";
import { MarkMemorizedSheet } from "@/components/hifz/MarkMemorized";
import type { HifzMeta } from "@/lib/hifz/page-data";
import { cn } from "@/lib/utils";

type Cell = "memorized" | "weak" | "learning" | "none";

function cellOf(s: HifzPageState | undefined): Cell {
  if (!s) return "none";
  if (s.status === "learning") return "learning";
  return s.weak ? "weak" : "memorized";
}

const CELL_CLASS: Record<Cell, string> = {
  memorized: "bg-forest",
  weak: "bg-gold",
  learning: "bg-mint-strong ring-1 ring-inset ring-emerald",
  none: "bg-track",
};

const LEGEND: { cell: Cell; label: string }[] = [
  { cell: "memorized", label: "Ezber" },
  { cell: "weak", label: "Zayıf" },
  { cell: "learning", label: "Öğreniliyor" },
  { cell: "none", label: "Başlanmadı" },
];

const card =
  "rounded-[28px] border border-line bg-surface p-5 sm:p-7 shadow-[0_1px_0_rgba(31,42,35,0.04),0_12px_32px_-18px_rgba(27,67,50,0.18)]";

/** İlerleme: the 604-page memorization map, hifz settings and the less-used tools. */
export function ProgressClient({
  meta,
  pageLabels,
  currentPageNumber,
}: {
  meta: HifzMeta;
  pageLabels: Record<number, string>;
  currentPageNumber: number;
}) {
  const store = useHifzStore();
  const [editing, setEditing] = useState(false);
  const [marking, setMarking] = useState(false);
  const pageJuz = meta.pageJuz;

  const juzPages = useMemo(() => {
    const out: number[][] = Array.from({ length: 30 }, () => []);
    pageJuz.forEach((j, i) => out[Math.min(29, Math.max(0, j - 1))]!.push(i + 1));
    return out;
  }, [pageJuz]);

  if (!store) return <div className="mx-auto max-w-2xl"><div className={cn(card, "h-64 animate-pulse")} /></div>;
  if (editing) {
    return (
      <div className="mx-auto max-w-2xl">
        <SetupCard
          initial={store.settings}
          currentPageNumber={currentPageNumber}
          meta={meta}
          pageLabels={pageLabels}
          onDone={() => setEditing(false)}
          canCancel
        />
      </div>
    );
  }

  const counts = { memorized: 0, weak: 0, learning: 0 };
  for (const s of Object.values(store.pages)) {
    const c = cellOf(s);
    if (c !== "none") counts[c] += 1;
  }
  const done = counts.memorized + counts.weak;
  const plan = buildTodayPlan(store);
  const percent = Math.round((done / TOTAL_PAGES) * 1000) / 10;
  const settings = store.settings;
  const amountLabel = settings ? { 1: "Tam sayfa", 2: "Yarım sayfa", 4: "Çeyrek sayfa" }[settings.dailyParts] : null;

  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <section className={card}>
        <p className="text-xs font-medium text-muted">İlerleme</p>
        <div className="mt-2 flex items-end justify-between gap-4">
          <h1 className="font-display text-[2rem] font-semibold leading-none tracking-tight text-ink sm:text-[2.5rem]">
            {done} <span className="text-lg font-medium text-muted">/ {TOTAL_PAGES} sayfa</span>
          </h1>
          <span className="pb-1 text-sm font-semibold text-forest">%{percent.toLocaleString("tr-TR")}</span>
        </div>
        <div className="mt-3 h-2 overflow-hidden rounded-full bg-track">
          <div className="h-full rounded-full bg-forest" style={{ width: `${Math.max(done > 0 ? 1 : 0, (done / TOTAL_PAGES) * 100)}%` }} />
        </div>
        <dl className="mt-4 grid grid-cols-3 gap-2 text-center">
          <Stat label="Zayıf" value={counts.weak} />
          <Stat label="Öğreniliyor" value={counts.learning} />
          <Stat label="Bugün tekrar" value={plan.recent.length + plan.manzil.length} />
        </dl>
      </section>

      <section className={card}>
        <h2 className="font-display text-xl font-semibold text-ink">Sayfa haritası</h2>
        <p className="mt-1 text-xs text-muted">Her satır bir cüz, her kare bir sayfa. Dokununca Mushaf&apos;ta açılır.</p>
        <div className="mt-3 flex flex-wrap gap-x-3 gap-y-1">
            {LEGEND.map((l) => (
              <span key={l.cell} className="inline-flex items-center gap-1 text-[11px] text-muted">
                <span className={cn("h-2.5 w-2.5 rounded-[3px]", CELL_CLASS[l.cell])} />
                {l.label}
              </span>
            ))}
        </div>
        <div className="mt-4 space-y-1.5">
          {juzPages.map((pages, i) => (
            <div key={i} className="flex items-center gap-2">
              <span className="w-6 shrink-0 text-right text-[11px] font-semibold tabular-nums text-muted">{i + 1}</span>
              <div className="grid flex-1 grid-cols-[repeat(23,minmax(0,1fr))] gap-[3px] sm:max-w-md">
                {pages.map((p) => {
                  const c = cellOf(store.pages[p]);
                  return (
                    <Link
                      key={p}
                      href={`/mushaf?page=${p}`}
                      title={`Sayfa ${p}`}
                      aria-label={`Sayfa ${p}: ${LEGEND.find((l) => l.cell === c)!.label}`}
                      className={cn("aspect-square rounded-[3px] transition-transform hover:scale-125", CELL_CLASS[c])}
                    />
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className={cn(card, "divide-y divide-line py-2 sm:py-3")}>
        <button type="button" onClick={() => setMarking(true)} className="flex w-full items-center gap-3 py-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-gold-soft text-gold-deep">
            <ListChecks className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Ezberlediğim yerleri işaretle</span>
            <span className="block truncate text-xs text-muted">Bildiğin sureleri veya sayfaları işaretle</span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>
        <button type="button" onClick={() => setEditing(true)} className="flex w-full items-center gap-3 py-3 text-left">
          <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-mint text-forest">
            <Settings2 className="h-5 w-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-sm font-semibold text-ink">Ezber ayarları</span>
            <span className="block truncate text-xs text-muted">
              {settings
                ? `Sayfa ${settings.startPage}'dan ${settings.direction === "backward" ? "geriye" : "ileri"} · ${amountLabel}`
                : "Başlangıç sayfası ve günlük miktar"}
            </span>
          </span>
          <ChevronRight className="h-4 w-4 text-muted" />
        </button>
      </section>

      <section className={cn(card, "py-3 sm:py-4")}>
        <h2 className="px-1 pt-1 pb-2 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted">Diğer araçlar</h2>
        <ul className="divide-y divide-line">
          {TOOLS.map((t) => {
            const Icon = t.icon;
            return (
              <li key={t.href}>
                <Link href={t.href} className="flex items-center gap-3 px-1 py-3 hover:text-forest">
                  <Icon className="h-4 w-4 shrink-0 text-muted" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-sm font-medium text-ink">{t.label}</span>
                    <span className="block truncate text-xs text-muted">{t.hint}</span>
                  </span>
                  <ChevronRight className="h-4 w-4 text-muted" />
                </Link>
              </li>
            );
          })}
        </ul>
      </section>
      {marking && <MarkMemorizedSheet meta={meta} store={store} onClose={() => setMarking(false)} />}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-parchment px-2 py-2.5">
      <dt className="text-[11px] text-muted">{label}</dt>
      <dd className="text-lg font-semibold tabular-nums text-ink">{value}</dd>
    </div>
  );
}
