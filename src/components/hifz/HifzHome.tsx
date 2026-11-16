"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRight, BookOpenText, CheckCircle2, Circle, Play, Settings2 } from "lucide-react";
import {
  DAILY_PART_OPTIONS,
  TOTAL_PAGES,
  buildTodayPlan,
  estimateMinutes,
  importLegacyPages,
  saveSettings,
  type HifzDailyParts,
  type HifzDirection,
  type HifzSettings,
  type TodayPlan,
} from "@/lib/hifz/plan";
import { updateHifzStore, useHifzStore } from "@/lib/hifz/store";
import { cn } from "@/lib/utils";

interface HifzHomeProps {
  pageLabels: Record<number, string>;
  currentPageNumber: number;
  /** Pages fully memorized on the older Ezber page, carried over once. */
  legacyPages?: number[];
}

const card =
  "rounded-[28px] border border-line bg-surface p-5 sm:p-8 shadow-[0_1px_0_rgba(31,42,35,0.04),0_12px_32px_-18px_rgba(27,67,50,0.18)]";

export function partLabel(partIndex: number, partCount: number): string {
  if (partCount === 1) return "tam sayfa";
  if (partCount === 2) return partIndex === 0 ? "ilk yarı" : "ikinci yarı";
  return `${partIndex + 1}. çeyrek`;
}

/**
 * Today screen: one sentence, one button. Everything comes from the page-by-page hifz plan.
 */
export function HifzHome({ pageLabels, currentPageNumber, legacyPages = [] }: HifzHomeProps) {
  const store = useHifzStore();
  const [editing, setEditing] = useState(false);
  const needsImport = !!store && !store.importedLegacy;

  useEffect(() => {
    if (needsImport) updateHifzStore((s) => importLegacyPages(s, legacyPages));
  }, [needsImport, legacyPages]);

  if (!store) return <div className="mx-auto max-w-2xl"><div className={cn(card, "h-64 animate-pulse")} /></div>;

  if (!store.settings || editing) {
    return (
      <div className="mx-auto max-w-2xl">
        <SetupCard
          initial={store.settings}
          currentPageNumber={currentPageNumber}
          onDone={() => setEditing(false)}
          canCancel={!!store.settings}
        />
      </div>
    );
  }

  const plan = buildTodayPlan(store);
  return (
    <div className="mx-auto max-w-2xl space-y-4">
      <TodayCard plan={plan} pageLabels={pageLabels} />
      <div className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-semibold text-muted">
        <span>
          Ezberlenen: {plan.memorizedCount} / {TOTAL_PAGES} sayfa
        </span>
        <button type="button" onClick={() => setEditing(true)} className="inline-flex items-center gap-1.5 hover:text-forest">
          <Settings2 className="h-3.5 w-3.5" />
          Başlangıç ve günlük miktar
        </button>
      </div>
    </div>
  );
}

function TodayCard({ plan, pageLabels }: { plan: TodayPlan; pageLabels: Record<number, string> }) {
  const router = useRouter();
  const minutes = estimateMinutes(plan);
  const reviewCount = plan.recent.length + plan.manzil.length;
  const allDone = !plan.newLesson && reviewCount === 0;
  const started = plan.newDoneToday || plan.reviewedToday > 0;

  const rows: { done: boolean; text: string }[] = [];
  if (plan.blockedBy.length > 0) {
    rows.push({
      done: false,
      text: `Önce dünkü sayfayı sağlamlaştır: Sayfa ${plan.blockedBy.join(", ")}`,
    });
  }
  if (plan.newLesson) {
    const { page, partIndex, partCount, isRelearn } = plan.newLesson;
    rows.push({
      done: false,
      text: `${isRelearn ? "Yeniden ezber" : "Yeni ders"}: Sayfa ${page}, ${partLabel(partIndex, partCount)} · ${pageLabels[page] ?? ""}`,
    });
  } else if (plan.newDoneToday) {
    rows.push({ done: true, text: "Bugünkü yeni ders tamam" });
  }
  if (plan.recent.length > 0) rows.push({ done: false, text: `Yakın tekrar: ${plan.recent.length} sayfa` });
  if (plan.manzil.length > 0) rows.push({ done: false, text: `Eski tekrar: ${plan.manzil.length} sayfa` });
  if (plan.reviewedToday > 0) rows.push({ done: true, text: `Bugün ${plan.reviewedToday} sayfa tekrar edildi` });

  const title = allDone ? "Bugünkü ezber tamam." : started ? `Devam edelim, ~${minutes} dk kaldı.` : `Bugün ~${minutes} dakika.`;

  return (
    <section className={card}>
      <p className="text-xs font-medium text-muted">Sayfa sayfa ezber</p>
      <h1 className="mt-2 font-display text-[1.75rem] sm:text-[2.25rem] font-semibold leading-[1.15] tracking-tight text-ink text-balance">
        {title}
      </h1>

      {allDone ? (
        <Link
          href="/mushaf"
          className="mt-5 flex w-full items-center justify-center gap-3 rounded-2xl border border-line bg-parchment px-6 py-4 text-base font-semibold text-forest hover:bg-sand"
        >
          <BookOpenText className="h-4 w-4" />
          Mushaf&apos;ta serbest oku
        </Link>
      ) : (
        <button
          type="button"
          onClick={() => router.push("/hifz")}
          className="group mt-5 flex w-full items-center justify-center gap-3 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment shadow-sm shadow-forest/20 transition-colors hover:bg-forest-deep"
        >
          <Play className="h-4 w-4 fill-current" />
          <span>{started ? "Devam et" : "Başla"}</span>
          <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" />
        </button>
      )}

      {rows.length > 0 && (
        <ul className="mt-5 divide-y divide-line">
          {rows.map((r) => (
            <li key={r.text} className="flex items-center gap-3 py-3">
              {r.done ? (
                <CheckCircle2 className="h-5 w-5 shrink-0 text-emerald" />
              ) : (
                <Circle className="h-5 w-5 shrink-0 text-line" />
              )}
              <span className={cn("min-w-0 flex-1 text-sm", r.done ? "text-muted" : "text-ink-soft")}>{r.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

type StartChoice = "amme" | "fatiha" | "page";

export function SetupCard({
  initial,
  currentPageNumber,
  onDone,
  canCancel,
}: {
  initial: HifzSettings | null;
  currentPageNumber: number;
  onDone: () => void;
  canCancel: boolean;
}) {
  const router = useRouter();
  const initialChoice: StartChoice = !initial
    ? "amme"
    : initial.startPage === TOTAL_PAGES && initial.direction === "backward"
      ? "amme"
      : initial.startPage === 1 && initial.direction === "forward"
        ? "fatiha"
        : "page";
  const [choice, setChoice] = useState<StartChoice>(initialChoice);
  const [page, setPage] = useState<number>(initial?.startPage ?? currentPageNumber ?? 1);
  const [direction, setDirection] = useState<HifzDirection>(initial?.direction ?? "forward");
  const [parts, setParts] = useState<HifzDailyParts>(initial?.dailyParts ?? 2);

  function submit() {
    const settings: HifzSettings =
      choice === "amme"
        ? { startPage: TOTAL_PAGES, direction: "backward", dailyParts: parts }
        : choice === "fatiha"
          ? { startPage: 1, direction: "forward", dailyParts: parts }
          : { startPage: Math.min(TOTAL_PAGES, Math.max(1, Math.round(page) || 1)), direction, dailyParts: parts };
    updateHifzStore((s) => saveSettings(s, settings));
    onDone();
    if (!initial) router.push("/hifz");
  }

  const choices: { id: StartChoice; label: string; hint: string }[] = [
    { id: "amme", label: "Amme cüzünün sonundan", hint: "Nâs, Felak, İhlâs… kısa surelerle geriye doğru" },
    { id: "fatiha", label: "Baştan", hint: "Fâtiha ve Bakara'dan ileri doğru" },
    { id: "page", label: "Seçtiğim sayfadan", hint: "Sayfa numarası ve yön seç" },
  ];

  return (
    <section className={card}>
      <p className="text-xs font-medium text-muted">Sayfa sayfa ezber</p>
      <h1 className="mt-2 font-display text-[1.75rem] sm:text-[2.25rem] font-semibold leading-[1.15] tracking-tight text-ink">
        {initial ? "Ezber ayarları" : "Nereden başlayalım?"}
      </h1>

      <div role="radiogroup" aria-label="Başlangıç" className="mt-5 space-y-2">
        {choices.map((c) => (
          <button
            key={c.id}
            type="button"
            role="radio"
            aria-checked={choice === c.id}
            onClick={() => setChoice(c.id)}
            className={cn(
              "flex w-full items-start gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
              choice === c.id ? "border-forest bg-mint" : "border-line hover:bg-sand"
            )}
          >
            {choice === c.id ? (
              <CheckCircle2 className="mt-0.5 h-5 w-5 shrink-0 text-forest" />
            ) : (
              <Circle className="mt-0.5 h-5 w-5 shrink-0 text-line" />
            )}
            <span>
              <span className="block text-sm font-semibold text-ink">{c.label}</span>
              <span className="block text-xs text-muted">{c.hint}</span>
            </span>
          </button>
        ))}
      </div>

      {choice === "page" && (
        <div className="mt-3 flex flex-wrap items-center gap-3 rounded-2xl bg-parchment px-4 py-3 text-sm">
          <label className="flex items-center gap-2">
            Sayfa
            <input
              type="number"
              min={1}
              max={TOTAL_PAGES}
              value={page}
              onChange={(e) => setPage(Number(e.target.value))}
              className="w-20 rounded-lg border border-line bg-surface px-2 py-1"
            />
          </label>
          <div className="inline-flex rounded-full bg-surface p-0.5">
            {(["forward", "backward"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => setDirection(d)}
                className={cn(
                  "rounded-full px-3 py-1 text-xs font-semibold",
                  direction === d ? "bg-forest text-parchment" : "text-muted"
                )}
              >
                {d === "forward" ? "İleri" : "Geriye"}
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-6 text-sm font-semibold text-ink">Günde ne kadar?</p>
      <div role="radiogroup" aria-label="Günlük miktar" className="mt-2 grid grid-cols-3 gap-2">
        {DAILY_PART_OPTIONS.map((o) => (
          <button
            key={o.value}
            type="button"
            role="radio"
            aria-checked={parts === o.value}
            onClick={() => setParts(o.value)}
            className={cn(
              "rounded-2xl border px-2 py-3 text-center transition-colors",
              parts === o.value ? "border-forest bg-mint" : "border-line hover:bg-sand"
            )}
          >
            <span className="block text-sm font-semibold text-ink">{o.labelTr}</span>
            <span className="block text-[11px] text-muted">{o.hintTr}</span>
          </button>
        ))}
      </div>

      <button
        type="button"
        onClick={submit}
        className="mt-6 flex w-full items-center justify-center gap-3 rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment shadow-sm shadow-forest/20 hover:bg-forest-deep"
      >
        <Play className="h-4 w-4 fill-current" />
        {initial ? "Kaydet" : "Başla"}
      </button>
      {canCancel && (
        <button type="button" onClick={onDone} className="mt-3 w-full text-center text-xs font-semibold text-muted hover:text-forest">
          Vazgeç
        </button>
      )}
    </section>
  );
}
