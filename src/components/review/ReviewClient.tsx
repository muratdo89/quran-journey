"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { CheckCircle2, Eye, RotateCcw, Volume2 } from "lucide-react";
import type { CanonicalWord } from "@/lib/content/types";
import {
  previewIntervals,
  prioritizeDueCards,
  type ReviewRating,
  type StoredLearningCard,
} from "@/lib/learning-engine";
import { PageHeader } from "@/components/ui/PageHeader";

interface WordLookupEntry extends CanonicalWord {
  verseKey: string;
  verseTranslationTr: string;
}

interface ReviewClientProps {
  initialCards: StoredLearningCard[];
  wordsByLocation: Record<string, WordLookupEntry>;
  isRecoveryMode?: boolean;
}

export function ReviewClient({
  initialCards,
  wordsByLocation,
  isRecoveryMode = false,
}: ReviewClientProps) {
  const [cards, setCards] = useState<StoredLearningCard[]>(initialCards);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [sessionReviewed, setSessionReviewed] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [lastFeedback, setLastFeedback] = useState<string | null>(null);

  const dueQueue = useMemo(() => {
    const due = prioritizeDueCards(cards);
    return isRecoveryMode ? due.slice(0, 6) : due;
  }, [cards, isRecoveryMode]);

  const currentCard = dueQueue[0] ?? null;
  const currentWord = currentCard ? wordsByLocation[currentCard.targetKey] : undefined;

  const intervals = useMemo(() => {
    if (!currentCard) return null;
    return previewIntervals(currentCard, new Date());
  }, [currentCard]);

  function playWordAudio(url: string | null | undefined) {
    if (!url) return;
    new Audio(url).play().catch(() => {});
  }

  async function handleRate(rating: ReviewRating) {
    if (!currentCard) return;
    setSubmitting(true);
    try {
      const res = await fetch("/api/review", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId: currentCard.id, rating }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated: StoredLearningCard = data.updatedCard;
        setCards((prev) => prev.map((c) => (c.id === updated.id ? updated : c)));
        setRevealed(false);
        setSessionReviewed((n) => n + 1);
        setSessionXp((x) => x + (data.xpAwarded ?? 0));
        setLastFeedback(
          `Kart güncellendi · Bir sonraki tekrar: ${data.intervalLabelTr}`
        );
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
        <div>
          <PageHeader
            eyebrow="Bugün"
            title="Tekrar Kartları"
            description={isRecoveryMode
              ? "Toparlanma modu: Yalnızca en öncelikli 6 kart seçildi."
              : "Cevabı görmeden önce zihninizden hatırlamaya çalışın; ardından dürüstçe değerlendirin."}
            related={[{ href: "/", label: "Bugünkü plan" }]}
          />
        </div>
        <div className="rounded-xl border border-line bg-surface px-4 py-2 text-xs font-semibold text-forest">
          Kalan: {dueQueue.length} · Tamamlanan: {sessionReviewed} (+{sessionXp} XP)
        </div>
      </div>

      {lastFeedback && (
        <div className="rounded-xl border border-emerald/30 bg-mint px-4 py-2.5 text-xs font-semibold text-forest">
          {lastFeedback}
        </div>
      )}

      {currentCard && currentWord ? (
        <section className="rounded-2xl border border-line bg-surface p-6 sm:p-10 space-y-8 shadow-xs">
          <div className="flex items-center justify-between text-xs text-muted">
            <span className="font-mono font-semibold">
              {currentWord.location} ·{" "}
              {currentCard.direction === "ar_to_tr"
                ? "Arapça → Türkçe"
                : "Türkçe → Arapça"}
            </span>
            <span>Tekrar sayısı: {currentCard.reps}</span>
          </div>

          {/* Prompt before reveal (Active Recall) */}
          <div className="py-6 text-center space-y-4">
            {currentCard.direction === "ar_to_tr" ? (
              <>
                <p className="text-xs font-medium text-muted">
                  Bu Kur&apos;an kelimesinin Türkçe anlamını hatırlayın:
                </p>
                <p
                  lang="ar"
                  dir="rtl"
                  translate="no"
                  className="font-arabic text-5xl sm:text-6xl leading-[1.7] sm:leading-[1.7] text-ink"
                >
                  {currentWord.textUthmani}
                </p>
              </>
            ) : (
              <>
                <p className="text-xs font-medium text-muted">
                  Bu Türkçe anlamın Kur&apos;an&apos;daki Arapça karşılığını hatırlayın:
                </p>
                <p className="text-2xl sm:text-3xl font-bold text-forest">
                  {currentWord.translationTr}
                </p>
              </>
            )}

            {currentWord.audioUrl && (
              <button
                type="button"
                onClick={() => playWordAudio(currentWord.audioUrl)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-line bg-parchment px-3.5 py-2 text-xs font-semibold text-forest hover:bg-sand"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Telaffuzu Dinle</span>
              </button>
            )}
          </div>

          {!revealed ? (
            <div className="flex justify-center">
              <button
                type="button"
                onClick={() => setRevealed(true)}
                className="inline-flex items-center gap-2 rounded-xl bg-forest px-8 py-3.5 text-sm font-semibold text-white hover:bg-forest-deep"
              >
                <Eye className="h-4 w-4" />
                <span>Cevabı Göster</span>
              </button>
            </div>
          ) : (
            <div className="space-y-6 pt-6 border-t border-line">
              <div className="rounded-xl border border-line bg-parchment p-5 text-center space-y-2">
                {currentCard.direction === "ar_to_tr" ? (
                  <p className="text-xl font-bold text-forest">
                    {currentWord.translationTr}
                  </p>
                ) : (
                  <p
                    lang="ar"
                    dir="rtl"
                    translate="no"
                    className="font-arabic text-4xl leading-[1.6] text-forest"
                  >
                    {currentWord.textUthmani}
                  </p>
                )}
                {currentWord.morphology.rootArabic && (
                  <p className="text-xs text-muted">
                    Kök:{" "}
                    <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base">
                      {currentWord.morphology.rootArabic}
                    </span>
                  </p>
                )}
                <p className="text-xs text-muted">
                  <strong>Ayet bağlamı ({currentWord.verseKey}):</strong>{" "}
                  {currentWord.verseTranslationTr}
                </p>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                {[
                  { rating: 1 as ReviewRating, label: "Tekrar", style: "border-red-200 bg-red-50 text-red-900 hover:bg-red-100" },
                  { rating: 2 as ReviewRating, label: "Zor", style: "border-amber-200 bg-amber-50 text-amber-900 hover:bg-amber-100" },
                  { rating: 3 as ReviewRating, label: "İyi", style: "border-emerald/30 bg-mint text-forest hover:bg-mint-strong" },
                  { rating: 4 as ReviewRating, label: "Kolay", style: "bg-forest text-white hover:bg-forest-deep" },
                ].map((btn) => (
                  <button
                    key={btn.rating}
                    type="button"
                    disabled={submitting}
                    onClick={() => handleRate(btn.rating)}
                    className={`rounded-xl border px-3 py-3 text-center transition-colors ${btn.style}`}
                  >
                    <span className="block text-xs font-bold">{btn.label}</span>
                    <span className="block text-[11px] opacity-80 mt-0.5">
                      {intervals?.[btn.rating]}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          )}
        </section>
      ) : (
        <section className="rounded-2xl border border-line bg-surface p-8 text-center space-y-4">
          <CheckCircle2 className="h-10 w-10 text-emerald mx-auto" />
          <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
            Şu an bekleyen tekrar kartınız kalmadı
          </h2>
          <p className="text-sm text-muted max-w-md mx-auto">
            FSRS algoritması kartlarınızı bir sonraki optimal unutma eşiğine göre zamanladı. Kelime Hazinesi&apos;nden yeni kartlar ekleyebilir veya Mushaf çalışmasına geçebilirsiniz.
          </p>
          <div className="flex justify-center gap-3 pt-2">
            <Link
              href="/vocabulary"
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-xs font-semibold text-white"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              <span>Kelime Hazinesinden Kart Ekle</span>
            </Link>
            <Link
              href="/mushaf"
              className="inline-flex items-center gap-2 rounded-xl border border-line bg-parchment px-5 py-2.5 text-xs font-semibold text-ink"
            >
              <span>Mushaf&apos;a Dön</span>
            </Link>
          </div>
        </section>
      )}
    </div>
  );
}
