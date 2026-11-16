"use client";

import React, { useState } from "react";
import Link from "next/link";
import { CheckCircle2, Plus, X } from "lucide-react";
import {
  allowAnotherNewPart,
  buildQueue,
  buildTodayPlan,
  completeNewPart,
  currentNewPage,
  ratePage,
  type HifzQueueItem,
  type HifzRating,
} from "@/lib/hifz/plan";
import { updateHifzStore, useHifzStore } from "@/lib/hifz/store";
import { NewLesson } from "./NewLesson";
import { partLabel } from "./HifzHome";
import {
  ActionBar,
  AudioBlockedNote,
  LoadingCard,
  MealToggle,
  PlayToggle,
  RatingButtons,
  RevealAllToggle,
  StepTitle,
  SurahBanner,
  ToolRow,
  VerseBlock,
  VersePaper,
  useHifzPage,
  useVersePlayer,
} from "./shared";

/**
 * Today's hifz in one run: the next item is always worked out from the plan, so leaving and
 * coming back continues where the learner stopped. The app's menus are hidden here (focus
 * mode); the X in the top bar leads back to Bugün.
 */
export function HifzSession({ pageLabels }: { pageLabels: Record<number, string> }) {
  const store = useHifzStore();
  const [toast, setToast] = useState<string | null>(null);

  if (!store) return <div className="mx-auto max-w-2xl"><LoadingCard error={false} onRetry={() => {}} /></div>;
  if (!store.settings) {
    return (
      <div className="mx-auto max-w-2xl rounded-[28px] border border-line bg-surface p-8 text-center text-sm text-muted">
        Önce başlangıç sayfasını seç.{" "}
        <Link href="/" className="font-semibold text-forest underline">
          Bugün&apos;e git
        </Link>
      </div>
    );
  }

  const plan = buildTodayPlan(store);
  const queue = buildQueue(plan);
  const item = queue[0];
  const doneCount = plan.reviewedToday + (plan.newDoneToday ? 1 : 0);
  const total = doneCount + queue.length;

  function flash(text: string) {
    setToast(text);
    window.setTimeout(() => setToast((t) => (t === text ? null : t)), 2500);
    window.scrollTo({ top: 0 });
  }

  return (
    <div className="mx-auto max-w-2xl pb-48">
      <TopBar item={item} pageLabels={pageLabels} position={Math.min(doneCount + 1, total)} total={total} />

      <div className="space-y-5 pt-4">
        {toast && (
          <p className="mx-auto flex w-fit items-center gap-2 rounded-full bg-mint px-4 py-2 text-sm font-semibold text-forest" role="status">
            <CheckCircle2 className="h-4 w-4" />
            {toast}
          </p>
        )}

        {!item ? (
          <DoneCard canAddPart={!plan.newLesson && plan.blockedBy.length === 0 && currentNewPage(store) !== null} />
        ) : item.kind === "new" ? (
          <NewLessonItem
            key={`new-${item.lesson.page}-${item.lesson.partIndex}`}
            item={item}
            onPartDone={() => {
              updateHifzStore((s) => completeNewPart(s, item.lesson));
              flash("Bugünkü yeni ders kaydedildi");
            }}
            onPageRated={(r) => {
              updateHifzStore((s) => ratePage(s, item.lesson.page, r, { fromNewLesson: true, partCount: item.lesson.partCount }));
              flash(r === "unuttum" ? "Sayfa yarın baştan çalışılacak" : `Sayfa ${item.lesson.page} ezberlendi`);
            }}
          />
        ) : (
          <PageReview
            key={`${item.kind}-${item.page}`}
            page={item.page}
            onRate={(r) => {
              updateHifzStore((s) => ratePage(s, item.page, r));
              flash(r === "akici" ? "Sağlam" : r === "takildim" ? "Yarın yine gelecek" : "Yeniden ezbere alındı");
            }}
          />
        )}
      </div>
    </div>
  );
}

function TopBar({
  item,
  pageLabels,
  position,
  total,
}: {
  item: HifzQueueItem | undefined;
  pageLabels: Record<number, string>;
  position: number;
  total: number;
}) {
  const page = item ? (item.kind === "new" ? item.lesson.page : item.page) : null;
  const kind = item ? itemKindLabel(item) : "Bugün";
  const detail = item?.kind === "new" ? partLabel(item.lesson.partIndex, item.lesson.partCount) : null;
  return (
    <div className="sticky top-0 z-20 -mx-4 border-b border-line/70 bg-parchment/95 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6 lg:-mx-8 lg:px-8">
      <div className="flex items-center gap-3">
        <Link href="/" aria-label="Bugün'e dön" className="-ml-2 rounded-full p-2 text-muted hover:bg-sand hover:text-forest">
          <X className="h-5 w-5" />
        </Link>
        <div className="min-w-0 flex-1 text-center">
          <p className="truncate text-sm font-semibold text-ink">
            {page ? `Sayfa ${page} · ${pageLabels[page] ?? ""}` : "Bugünkü ezber"}
          </p>
          <p className="truncate text-[11px] font-semibold uppercase tracking-[0.12em] text-gold-ink">
            {kind}
            {detail ? ` · ${detail}` : ""}
          </p>
        </div>
        <span className="min-w-9 rounded-full bg-sand px-2 py-1 text-center text-xs font-semibold text-ink-soft">
          {item ? `${position}/${total}` : "✓"}
        </span>
      </div>
    </div>
  );
}

function itemKindLabel(item: HifzQueueItem): string {
  if (item.kind === "new") return item.lesson.isRelearn ? "Yeniden ezber" : "Yeni ders";
  return item.kind === "recent" ? "Yakın tekrar" : "Eski tekrar";
}

function NewLessonItem({
  item,
  onPartDone,
  onPageRated,
}: {
  item: Extract<HifzQueueItem, { kind: "new" }>;
  onPartDone: () => void;
  onPageRated: (r: HifzRating) => void;
}) {
  const { data, error, retry } = useHifzPage(item.lesson.page);
  if (!data) return <LoadingCard error={error} onRetry={retry} />;
  return <NewLesson lesson={item.lesson} data={data} onPartDone={onPartDone} onPageRated={onPageRated} />;
}

function PageReview({ page, onRate }: { page: number; onRate: (r: HifzRating) => void }) {
  const { data, error, retry } = useHifzPage(page);
  const [revealAll, setRevealAll] = useState(false);
  const [showMeal, setShowMeal] = useState(false);
  const player = useVersePlayer();

  if (!data) return <LoadingCard error={error} onRetry={retry} />;
  return (
    <div className="space-y-5">
      <StepTitle title="Bakmadan oku" hint="Sayfayı baştan sona ezberden oku. Takılırsan kelimeye dokun." />
      <ToolRow>
        <PlayToggle playing={player.playing} onPlay={() => void player.play(data.verses, 1)} onStop={player.stop} label="Dinle" />
        <MealToggle on={showMeal} onToggle={() => setShowMeal((m) => !m)} />
        <RevealAllToggle on={revealAll} onToggle={() => setRevealAll((r) => !r)} />
      </ToolRow>
      <AudioBlockedNote show={player.blocked} />
      <VersePaper>
        {data.verses.map((v) => (
          <div key={`${v.key}-${revealAll}`}>
            <SurahBanner verse={v} />
            <VerseBlock verse={v} hidden revealAll={revealAll} showMeal={showMeal} active={player.activeKey === v.key} />
          </div>
        ))}
      </VersePaper>
      <ActionBar>
        <RatingButtons
          onRate={(r) => {
            player.stop();
            onRate(r);
          }}
        />
      </ActionBar>
    </div>
  );
}

function DoneCard({ canAddPart }: { canAddPart: boolean }) {
  return (
    <section className="rounded-[28px] border border-line bg-surface p-8 text-center">
      <CheckCircle2 className="mx-auto h-10 w-10 text-emerald" />
      <h2 className="mt-3 font-display text-2xl font-semibold text-ink">Bugünkü ezber tamam.</h2>
      <p className="mt-1 text-sm text-muted">Allah kabul etsin. Yarın kaldığın yerden devam.</p>
      <div className="mt-6 space-y-3">
        <Link
          href="/"
          className="flex w-full items-center justify-center rounded-2xl bg-forest px-6 py-4 text-base font-semibold text-parchment hover:bg-forest-deep"
        >
          Bugün&apos;e dön
        </Link>
        {canAddPart && (
          <button
            type="button"
            onClick={() => updateHifzStore(allowAnotherNewPart)}
            className="mx-auto flex items-center gap-1.5 text-sm font-semibold text-forest hover:underline"
          >
            <Plus className="h-4 w-4" />
            Bir parça daha ezberle
          </button>
        )}
      </div>
    </section>
  );
}
