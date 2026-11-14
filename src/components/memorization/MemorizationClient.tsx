"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDown,
  ArrowUp,
  CheckCircle2,
  Eye,
  EyeOff,
  ListOrdered,
  Repeat,
  RotateCcw,
  Shuffle,
  Sparkles,
  Volume2,
} from "lucide-react";
import type { CanonicalSurahMeta, CanonicalVerse } from "@/lib/content/types";
import type { VerseProgressRecord } from "@/lib/db/types";
import { MEMORIZATION_STATE_LABELS_TR } from "@/lib/learning-engine";
import { cn } from "@/lib/utils";

interface MemorizationClientProps {
  surah: CanonicalSurahMeta;
  verses: CanonicalVerse[];
  availableSurahs: CanonicalSurahMeta[];
  initialVerseProgress: VerseProgressRecord[];
  initialVerseKey?: string;
}

type PracticeMode = "hide_all" | "cloze" | "next_verse" | "order_test";

function buildDeterministicShuffledWindow(
  verses: CanonicalVerse[],
  anchorIdx: number
): CanonicalVerse[] {
  const windowSize = Math.min(7, verses.length);
  const start = Math.max(0, Math.min(anchorIdx, verses.length - windowSize));
  const slice = verses.slice(start, start + windowSize);
  if (slice.length <= 1) return slice;
  if (slice.length === 2) return [slice[1]!, slice[0]!];
  // Deterministic non-sorted permutation
  const rotated = [...slice.slice(Math.floor(slice.length / 2)), ...slice.slice(0, Math.floor(slice.length / 2))];
  return rotated.reverse();
}

export function MemorizationClient({
  surah,
  verses,
  availableSurahs,
  initialVerseProgress,
  initialVerseKey,
}: MemorizationClientProps) {
  const router = useRouter();
  const [verseProgress, setVerseProgress] = useState<Record<string, VerseProgressRecord>>(() => {
    const map: Record<string, VerseProgressRecord> = {};
    for (const vp of initialVerseProgress) map[vp.verseKey] = vp;
    return map;
  });

  const initialKey =
    initialVerseKey && verses.some((v) => v.verseKey === initialVerseKey)
      ? initialVerseKey
      : verses[0]!.verseKey;

  const [selectedVerseKey, setSelectedVerseKey] = useState<string>(initialKey);
  const [mode, setMode] = useState<PracticeMode>("hide_all");
  const [revealedCount, setRevealedCount] = useState<number>(0);
  const [hiddenWordPositions, setHiddenWordPositions] = useState<Set<number>>(() => {
    const first = verses.find((v) => v.verseKey === initialKey) ?? verses[0]!;
    return new Set(first.words.filter((_, idx) => idx % 2 === 1).map((w) => w.position));
  });
  const [revealedCloze, setRevealedCloze] = useState<Set<number>>(() => new Set());
  const [nextVerseRevealed, setNextVerseRevealed] = useState(false);
  const [loopAudio, setLoopAudio] = useState(false);
  const [savingOutcome, setSavingOutcome] = useState(false);
  const [feedbackBanner, setFeedbackBanner] = useState<string | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const [orderedVerses, setOrderedVerses] = useState<CanonicalVerse[]>(() =>
    buildDeterministicShuffledWindow(verses, 0)
  );
  const [orderChecked, setOrderChecked] = useState<boolean | null>(null);

  useEffect(() => {
    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, []);

  const selectedVerse = useMemo(
    () => verses.find((v) => v.verseKey === selectedVerseKey) ?? verses[0]!,
    [verses, selectedVerseKey]
  );

  const nextVerse = useMemo(() => {
    const idx = verses.findIndex((v) => v.verseKey === selectedVerseKey);
    return idx >= 0 && idx + 1 < verses.length ? verses[idx + 1]! : null;
  }, [verses, selectedVerseKey]);

  const surahSolidCount = useMemo(
    () =>
      verses.filter((v) => {
        const st = verseProgress[v.verseKey]?.memorizationState;
        return st === "provisional_mastery" || st === "stable_memorization";
      }).length,
    [verses, verseProgress]
  );

  function selectVerse(key: string) {
    setSelectedVerseKey(key);
    setRevealedCount(0);
    setRevealedCloze(new Set());
    setNextVerseRevealed(false);
    setFeedbackBanner(null);
    const idx = verses.findIndex((item) => item.verseKey === key);
    const v = verses[idx];
    if (v) {
      setHiddenWordPositions(
        new Set(v.words.filter((_, i) => i % 2 === 1).map((w) => w.position))
      );
      setOrderedVerses(buildDeterministicShuffledWindow(verses, Math.max(0, idx)));
      setOrderChecked(null);
    }
  }

  function jumpToRandomPoint() {
    if (verses.length <= 1) return;
    const candidates = verses.filter((v) => v.verseKey !== selectedVerseKey);
    const randomPick = candidates[Math.floor(Math.random() * candidates.length)] ?? verses[0]!;
    selectVerse(randomPick.verseKey);
    setMode("next_verse");
    setFeedbackBanner(
      `Rastgele durak noktası seçildi: ${randomPick.verseKey} ayetinden bakmadan devam edin.`
    );
  }

  function playVerseAudio(verse: CanonicalVerse, useMuallim = false) {
    const url = useMuallim
      ? verse.audio.husaryMuallimAyahUrl
      : verse.audio.alafasyAyahUrl;
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audio.loop = loopAudio;
    audioRef.current = audio;
    audio.play().catch(() => {});
  }

  async function recordRecallOutcome(
    outcome: "failed_recall" | "partial_recall" | "clean_recall" | "delayed_clean_recall"
  ) {
    setSavingOutcome(true);
    setFeedbackBanner(null);
    try {
      const res = await fetch("/api/memorization", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ verseKey: selectedVerse.verseKey, outcome }),
      });
      if (res.ok) {
        const data = await res.json();
        const updated: VerseProgressRecord = data.verseProgress;
        setVerseProgress((prev) => ({ ...prev, [updated.verseKey]: updated }));
        setFeedbackBanner(
          `${updated.verseKey} ayeti yeni durumu: ${MEMORIZATION_STATE_LABELS_TR[updated.memorizationState]}`
        );
      }
    } finally {
      setSavingOutcome(false);
    }
  }

  function moveOrderItem(index: number, delta: -1 | 1) {
    const target = index + delta;
    if (target < 0 || target >= orderedVerses.length) return;
    const copy = [...orderedVerses];
    const [item] = copy.splice(index, 1);
    copy.splice(target, 0, item!);
    setOrderedVerses(copy);
    setOrderChecked(null);
  }

  function checkVerseOrder() {
    const sortedExpected = [...orderedVerses].sort(
      (a, b) => a.verseNumber - b.verseNumber
    );
    const isCorrect = orderedVerses.every(
      (v, idx) => v.verseNumber === sortedExpected[idx]!.verseNumber
    );
    setOrderChecked(isCorrect);
  }

  const currentProgress = verseProgress[selectedVerse.verseKey];

  return (
    <div className="space-y-6">
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1c241f]">
            Kur&apos;an Ezber Motoru (Hıfz Stüdyosu)
          </h1>
          <p className="text-sm text-[#5a655e]">
            Fâtiha ve Cüz Amme ({availableSurahs.length} Sure) için kelime gizleme, boşluk tamamlama, rastgele yerden devam ve sıralama testleri.
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <select
            aria-label="Ezber suresi seç"
            value={String(surah.id)}
            onChange={(e) => router.push(`/memorization?surah=${e.target.value}`)}
            className="rounded-xl border border-[#e5dec9] bg-white px-3.5 py-2.5 text-xs font-semibold text-[#1b4332]"
          >
            {availableSurahs.map((s) => (
              <option key={s.id} value={String(s.id)}>
                {s.id}. {s.nameTurkish} ({s.versesCount} ayet)
              </option>
            ))}
          </select>

          <button
            type="button"
            onClick={jumpToRandomPoint}
            disabled={verses.length <= 1}
            className="inline-flex items-center gap-1.5 rounded-xl border border-[#b08d57] bg-[#f7f1e3] px-3.5 py-2.5 text-xs font-semibold text-[#6e511e] hover:bg-[#efe4ca] disabled:opacity-40"
          >
            <Shuffle className="h-3.5 w-3.5" />
            <span>Rastgele Ayetten Devam Et</span>
          </button>
        </div>
      </div>

      {/* Surah Page Mastery Summary */}
      <div className="rounded-2xl border border-[#e5dec9] bg-white px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2 text-xs">
        <div className="flex items-center gap-2">
          <span className="font-bold text-[#1b4332]">
            {surah.id}. {surah.nameTurkish} Suresi (Sayfa {surah.pages[0]}
            {surah.pages[1] !== surah.pages[0] ? `–${surah.pages[1]}` : ""})
          </span>
          <span
            lang="ar"
            dir="rtl"
            translate="no"
            className="font-arabic text-lg text-[#b08d57]"
          >
            {surah.nameArabic}
          </span>
        </div>
        <div className="flex items-center gap-2">
          <span className="font-semibold text-[#1c241f]">
            Sağlam Ezber: {surahSolidCount} / {verses.length} ayet
          </span>
          {surahSolidCount === verses.length && (
            <span className="rounded-full bg-[#edf5f0] border border-[#2d6a4f]/30 px-2.5 py-0.5 font-bold text-[#1b4332]">
              Sure Tamamlandı!
            </span>
          )}
        </div>
      </div>

      {/* Verse Progress Selector Strip */}
      <section className="grid grid-cols-3 sm:grid-cols-6 lg:grid-cols-10 gap-2">
        {verses.map((v) => {
          const vp = verseProgress[v.verseKey];
          const state = vp?.memorizationState ?? "not_started";
          const active = v.verseKey === selectedVerseKey;
          return (
            <button
              key={v.verseKey}
              type="button"
              onClick={() => selectVerse(v.verseKey)}
              className={cn(
                "rounded-xl border p-2.5 text-left transition-all",
                active
                  ? "border-[#1b4332] bg-[#1b4332] text-white shadow-xs"
                  : "border-[#e5dec9] bg-white hover:bg-[#f3efe6]"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold">{v.verseKey}</span>
                {(state === "provisional_mastery" || state === "stable_memorization") && (
                  <CheckCircle2
                    className={cn("h-3.5 w-3.5", active ? "text-[#f7f1e3]" : "text-[#2d6a4f]")}
                  />
                )}
              </div>
              <p
                className={cn(
                  "mt-1 text-[10px] font-medium truncate",
                  active ? "text-[#e5dec9]" : "text-[#5a655e]"
                )}
              >
                {MEMORIZATION_STATE_LABELS_TR[state]}
              </p>
            </button>
          );
        })}
      </section>

      {/* Practice Mode Tabs */}
      <div className="flex flex-wrap gap-2">
        {[
          { id: "hide_all", label: "Tam Gizle & Kelime Kelime Aç", icon: EyeOff },
          { id: "cloze", label: "Seçili Kelime Boşluğu", icon: Sparkles },
          { id: "next_verse", label: "Sonraki Ayeti Tamamla", icon: Eye },
          { id: "order_test", label: "Ayet Sıralama Testi", icon: ListOrdered },
        ].map((tab) => {
          const Icon = tab.icon;
          const active = mode === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setMode(tab.id as PracticeMode)}
              className={cn(
                "inline-flex items-center gap-2 rounded-xl border px-4 py-2.5 text-xs font-semibold transition-colors",
                active
                  ? "border-[#1b4332] bg-[#1b4332] text-white"
                  : "border-[#e5dec9] bg-white text-[#1c241f] hover:bg-[#f3efe6]"
              )}
            >
              <Icon className="h-3.5 w-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* Main Practice Surface */}
      {mode !== "order_test" ? (
        <section className="rounded-2xl border border-[#e5dec9] bg-white p-6 sm:p-8 space-y-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-[#e5dec9] pb-4">
            <div>
              <span className="font-mono text-xs font-bold text-[#b08d57]">
                Ayet {selectedVerse.verseKey} · Mevcut Durum:{" "}
                {MEMORIZATION_STATE_LABELS_TR[currentProgress?.memorizationState ?? "not_started"]}
              </span>
              <p className="mt-1 text-xs text-[#5a655e]">
                Meal ipucu: {selectedVerse.translations[0]?.text}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <button
                type="button"
                onClick={() => playVerseAudio(selectedVerse, false)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#f3efe6] px-3 py-2 text-xs font-semibold text-[#1b4332] hover:bg-[#e5dec9]"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Afâsî Dinle</span>
              </button>
              <button
                type="button"
                onClick={() => playVerseAudio(selectedVerse, true)}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[#f3efe6] px-3 py-2 text-xs font-semibold text-[#1b4332] hover:bg-[#e5dec9]"
              >
                <Volume2 className="h-3.5 w-3.5" />
                <span>Husarî (Muallim)</span>
              </button>
              <button
                type="button"
                onClick={() => setLoopAudio((v) => !v)}
                className={cn(
                  "inline-flex items-center gap-1.5 rounded-xl border px-3 py-2 text-xs font-semibold",
                  loopAudio
                    ? "border-[#1b4332] bg-[#1b4332] text-white"
                    : "border-[#e5dec9] bg-white text-[#5a655e]"
                )}
              >
                <Repeat className="h-3.5 w-3.5" />
                <span>Tekrarla</span>
              </button>
            </div>
          </div>

          {mode === "hide_all" && (
            <div className="space-y-5">
              <div
                lang="ar"
                dir="rtl"
                translate="no"
                className="font-arabic min-h-[120px] rounded-2xl border border-[#e5dec9] bg-[#faf8f3] p-6 flex flex-wrap items-center justify-center gap-3 text-4xl leading-loose"
              >
                {selectedVerse.words.map((w, idx) => {
                  const visible = idx < revealedCount;
                  return (
                    <span
                      key={w.location}
                      className={cn(
                        "rounded-xl px-3 py-1 transition-all",
                        visible
                          ? "bg-white border border-[#e5dec9] text-[#1c241f]"
                          : "bg-[#e5dec9]/60 text-transparent select-none min-w-[72px] text-center"
                      )}
                    >
                      {w.textUthmani}
                    </span>
                  );
                })}
              </div>

              <div className="flex flex-wrap items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() =>
                    setRevealedCount((c) => Math.min(selectedVerse.words.length, c + 1))
                  }
                  className="rounded-xl bg-[#1b4332] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#143326]"
                >
                  Bir Kelime Aç ({revealedCount}/{selectedVerse.words.length})
                </button>
                <button
                  type="button"
                  onClick={() => setRevealedCount(selectedVerse.words.length)}
                  className="rounded-xl border border-[#e5dec9] bg-white px-4 py-2.5 text-xs font-semibold text-[#1c241f] hover:bg-[#f3efe6]"
                >
                  Tümünü Göster
                </button>
                <button
                  type="button"
                  onClick={() => setRevealedCount(0)}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-[#e5dec9] bg-white px-4 py-2.5 text-xs font-semibold text-[#5a655e] hover:bg-[#f3efe6]"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  <span>Yeniden Gizle</span>
                </button>
              </div>
            </div>
          )}

          {mode === "cloze" && (
            <div className="space-y-5">
              <p className="text-xs text-[#5a655e] text-center">
                Gizlenen boşlukları önce zihninizden/sesli tamamlayın, ardından kontrol etmek için kutucuğa dokunun.
              </p>
              <div
                lang="ar"
                dir="rtl"
                translate="no"
                className="font-arabic min-h-[120px] rounded-2xl border border-[#e5dec9] bg-[#faf8f3] p-6 flex flex-wrap items-center justify-center gap-3 text-4xl leading-loose"
              >
                {selectedVerse.words.map((w) => {
                  const isHidden =
                    hiddenWordPositions.has(w.position) && !revealedCloze.has(w.position);
                  return (
                    <button
                      key={w.location}
                      type="button"
                      onClick={() =>
                        setRevealedCloze((prev) => new Set([...prev, w.position]))
                      }
                      className={cn(
                        "rounded-xl px-3 py-1 transition-all",
                        isHidden
                          ? "border-2 border-dashed border-[#b08d57] bg-[#f7f1e3] text-transparent min-w-[84px] cursor-pointer"
                          : "bg-white border border-[#e5dec9] text-[#1c241f]"
                      )}
                    >
                      {w.textUthmani}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {mode === "next_verse" && (
            <div className="space-y-5">
              <div className="rounded-2xl border border-[#e5dec9] bg-[#faf8f3] p-6 text-center space-y-3">
                <p className="text-xs font-semibold text-[#5a655e]">
                  Bu ayetten sonra gelen ayeti bakmadan okuyun:
                </p>
                <p
                  lang="ar"
                  dir="rtl"
                  translate="no"
                  className="font-arabic text-3xl sm:text-4xl text-[#1c241f] leading-loose"
                >
                  {selectedVerse.textUthmani}
                </p>
              </div>

              {nextVerse ? (
                <div className="rounded-2xl border border-[#e5dec9] bg-white p-6 text-center space-y-4">
                  <p className="font-mono text-xs font-bold text-[#b08d57]">
                    Sonraki Ayet: {nextVerse.verseKey}
                  </p>
                  {nextVerseRevealed ? (
                    <>
                      <p
                        lang="ar"
                        dir="rtl"
                        translate="no"
                        className="font-arabic text-3xl sm:text-4xl text-[#1b4332] leading-loose"
                      >
                        {nextVerse.textUthmani}
                      </p>
                      <button
                        type="button"
                        onClick={() => selectVerse(nextVerse.verseKey)}
                        className="rounded-xl border border-[#1b4332] px-4 py-2 text-xs font-semibold text-[#1b4332] hover:bg-[#1b4332]/5"
                      >
                        Sonraki Ayete İlerle ({nextVerse.verseKey})
                      </button>
                    </>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setNextVerseRevealed(true)}
                      className="rounded-xl bg-[#1b4332] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#143326]"
                    >
                      Sonraki Ayeti Göster ve Kontrol Et
                    </button>
                  )}
                </div>
              ) : (
                <p className="text-center text-xs text-[#5a655e]">
                  {selectedVerse.verseKey} bu surenin son ayetidir.
                </p>
              )}
            </div>
          )}

          {/* Honest Recall Self-Evaluation Buttons */}
          <div className="pt-5 border-t border-[#e5dec9] space-y-3">
            <p className="text-xs font-semibold text-[#1c241f]">
              Geri Çağırma Sonucunu Kaydet ({selectedVerse.verseKey})
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
              <button
                type="button"
                disabled={savingOutcome}
                onClick={() => recordRecallOutcome("failed_recall")}
                className="rounded-xl border border-red-200 bg-red-50 px-3 py-2.5 text-xs font-semibold text-red-900 hover:bg-red-100"
              >
                Takıldım / Tekrar Gerekli
              </button>
              <button
                type="button"
                disabled={savingOutcome}
                onClick={() => recordRecallOutcome("partial_recall")}
                className="rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-xs font-semibold text-amber-900 hover:bg-amber-100"
              >
                İpucuyla Hatırladım
              </button>
              <button
                type="button"
                disabled={savingOutcome}
                onClick={() => recordRecallOutcome("clean_recall")}
                className="rounded-xl border border-[#2d6a4f]/30 bg-[#edf5f0] px-3 py-2.5 text-xs font-semibold text-[#1b4332] hover:bg-[#dcece2]"
              >
                Bakmadan Temiz Okudum
              </button>
              <button
                type="button"
                disabled={savingOutcome}
                onClick={() => recordRecallOutcome("delayed_clean_recall")}
                className="rounded-xl bg-[#1b4332] px-3 py-2.5 text-xs font-semibold text-white hover:bg-[#143326]"
              >
                Ertesi Gün Sorunsuz Okudum
              </button>
            </div>
            {feedbackBanner && (
              <p className="text-xs font-semibold text-[#2d6a4f]">{feedbackBanner}</p>
            )}
          </div>
        </section>
      ) : (
        /* Verse Ordering Test */
        <section className="rounded-2xl border border-[#e5dec9] bg-white p-6 space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h2 className="text-base font-bold text-[#1c241f]">
                {surah.nameTurkish} Suresi Ayet Sıralama Testi
              </h2>
              <p className="text-xs text-[#5a655e]">
                Okları kullanarak gösterilen {orderedVerses.length} ayeti doğru Mushaf sırasına dizin.
              </p>
            </div>
            <button
              type="button"
              onClick={checkVerseOrder}
              className="rounded-xl bg-[#1b4332] px-5 py-2.5 text-xs font-semibold text-white hover:bg-[#143326]"
            >
              Sıralamayı Kontrol Et
            </button>
          </div>

          <div className="space-y-2.5">
            {orderedVerses.map((v, idx) => (
              <div
                key={v.verseKey}
                className="rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-3.5 flex items-center justify-between gap-4"
              >
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => moveOrderItem(idx, -1)}
                    disabled={idx === 0}
                    aria-label="Yukarı taşı"
                    className="rounded-lg border border-[#e5dec9] bg-white p-1.5 disabled:opacity-30"
                  >
                    <ArrowUp className="h-3.5 w-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => moveOrderItem(idx, 1)}
                    disabled={idx === orderedVerses.length - 1}
                    aria-label="Aşağı taşı"
                    className="rounded-lg border border-[#e5dec9] bg-white p-1.5 disabled:opacity-30"
                  >
                    <ArrowDown className="h-3.5 w-3.5" />
                  </button>
                  <span className="font-mono text-xs font-bold text-[#5a655e] w-6 text-center">
                    #{idx + 1}
                  </span>
                </div>

                <p
                  lang="ar"
                  dir="rtl"
                  translate="no"
                  className="font-arabic text-2xl sm:text-3xl text-[#1c241f] text-right flex-1"
                >
                  {v.textUthmani}
                </p>
              </div>
            ))}
          </div>

          {orderChecked !== null && (
            <div
              className={cn(
                "rounded-xl p-4 text-xs font-semibold",
                orderChecked
                  ? "bg-[#edf5f0] text-[#1b4332]"
                  : "bg-amber-50 text-amber-900"
              )}
            >
              {orderChecked
                ? `Tebrikler! ${surah.nameTurkish} Suresi'ndeki bu bölümü doğru sıraya dizdiniz.`
                : "Bazı ayetlerin sırası henüz doğru değil — anlam akışını düşünerek tekrar deneyin."}
            </div>
          )}
        </section>
      )}
    </div>
  );
}
