"use client";

import React, { useMemo, useRef, useState } from "react";
import {
  BookOpen,
  CheckCircle2,
  ChevronRight,
  GraduationCap,
  HelpCircle,
  RefreshCcw,
  Sparkles,
  Volume2,
} from "lucide-react";
import {
  ARABIC_READING_MODULES,
  ELIFBA_LETTERS,
  PLACEMENT_QUESTIONS,
  TAJWEED_LESSONS,
} from "@/lib/content/arabic-curriculum";
import type { PlacementEvaluation } from "@/lib/learning-engine";
import { cn } from "@/lib/utils";
import { PageHeader } from "@/components/ui/PageHeader";

interface LearnArabicClientProps {
  initialPlacementCompleted: boolean;
  initialPlacementLevel: string | null;
  initialPlacementScore: number | null;
  initialCompletedModuleIds: string[];
  initialPracticedTajweedSlugs: string[];
  initialTab?: string;
  /** Open the placement test right away (when arriving from the daily plan). */
  openPlacement?: boolean;
}

export function LearnArabicClient({
  initialPlacementCompleted,
  initialPlacementLevel,
  initialPlacementScore,
  initialCompletedModuleIds,
  initialPracticedTajweedSlugs,
  initialTab = "reading",
  openPlacement = false,
}: LearnArabicClientProps) {
  const [activeTab, setActiveTab] = useState<"reading" | "alphabet" | "tajweed">(
    initialTab === "tajweed"
      ? "tajweed"
      : initialTab === "alphabet"
        ? "alphabet"
        : "reading"
  );
  const [showPlacement, setShowPlacement] = useState(openPlacement && !initialPlacementCompleted);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [evaluation, setEvaluation] = useState<PlacementEvaluation | null>(null);
  const [placementMeta, setPlacementMeta] = useState({
    completed: initialPlacementCompleted,
    level: initialPlacementLevel,
    score: initialPlacementScore,
  });

  const [completedModules, setCompletedModules] = useState<Set<string>>(
    () => new Set(initialCompletedModuleIds)
  );
  const [practicedTajweed, setPracticedTajweed] = useState<Set<string>>(
    () => new Set(initialPracticedTajweedSlugs)
  );
  const [activeModuleId, setActiveModuleId] = useState<string>(
    ARABIC_READING_MODULES[0].id
  );
  const [quizChoice, setQuizChoice] = useState<Record<string, string>>({});
  const [submittingPlacement, setSubmittingPlacement] = useState(false);

  // Elif-Ba 28 letter filter
  const [letterFilter, setLetterFilter] = useState<
    "all" | "ince" | "kalın" | "peltek" | "boğaz" | "non_connecting"
  >("all");
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const activeModule =
    ARABIC_READING_MODULES.find((m) => m.id === activeModuleId) ??
    ARABIC_READING_MODULES[0];

  const filteredLetters = useMemo(() => {
    if (letterFilter === "all") return ELIFBA_LETTERS;
    if (letterFilter === "non_connecting") {
      return ELIFBA_LETTERS.filter((l) => l.nonConnecting);
    }
    return ELIFBA_LETTERS.filter((l) => l.soundCategory === letterFilter);
  }, [letterFilter]);

  function playSampleAudio(url: string | undefined) {
    if (!url) return;
    if (audioRef.current) {
      audioRef.current.pause();
    }
    const audio = new Audio(url);
    audioRef.current = audio;
    audio.play().catch(() => {});
  }

  async function handleSubmitPlacement(e: React.FormEvent) {
    e.preventDefault();
    setSubmittingPlacement(true);
    try {
      const res = await fetch("/api/placement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      if (res.ok) {
        const data = await res.json();
        const evalRes: PlacementEvaluation = data.evaluation;
        setEvaluation(evalRes);
        setPlacementMeta({
          completed: true,
          level: evalRes.levelLabelTr,
          score: evalRes.scorePercent,
        });
        setShowPlacement(false);
        const nextCompleted = new Set(completedModules);
        for (const m of ARABIC_READING_MODULES) {
          if (evalRes.masteredCategories.includes(m.category)) {
            nextCompleted.add(m.id);
          }
        }
        setCompletedModules(nextCompleted);
        if (evalRes.recommendedModuleIds[0]) {
          setActiveModuleId(evalRes.recommendedModuleIds[0]);
        }
      }
    } finally {
      setSubmittingPlacement(false);
    }
  }

  async function handleCompleteModule(moduleId: string) {
    const res = await fetch("/api/reading/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "reading_module", moduleId }),
    });
    if (res.ok) {
      setCompletedModules((prev) => new Set([...prev, moduleId]));
    }
  }

  async function handlePracticeTajweed(slug: string) {
    const res = await fetch("/api/reading/complete", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ kind: "tajweed", slug }),
    });
    if (res.ok) {
      setPracticedTajweed((prev) => new Set([...prev, slug]));
    }
  }

  const selectedQuizOpt = quizChoice[activeModule.id];
  const quizOptionObj = activeModule.miniCheck.options.find(
    (o) => o.id === selectedQuizOpt
  );

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <PageHeader
            eyebrow="Kelimeler"
            title="Arapça Okuma ve Tecvid"
            description={<>28 harf şekilleri, harekeler, bağlantı kuralları ve 8 aşamalı Kur&apos;an tecvidi.</>}
            related={[{ href: "/vocabulary", label: "Kelime Hazinesi" }]}
          />
        </div>

        <div className="flex flex-wrap items-center gap-1.5 rounded-xl border border-line bg-surface p-1">
          <button
            type="button"
            onClick={() => setActiveTab("reading")}
            className={cn(
              "rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              activeTab === "reading"
                ? "bg-forest text-white"
                : "text-muted hover:text-ink"
            )}
          >
            Dersler ({ARABIC_READING_MODULES.length})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("alphabet")}
            className={cn(
              "rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              activeTab === "alphabet"
                ? "bg-forest text-white"
                : "text-muted hover:text-ink"
            )}
          >
            28 Harf Tablosu
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("tajweed")}
            className={cn(
              "rounded-lg px-3.5 py-2 text-xs font-semibold transition-colors",
              activeTab === "tajweed"
                ? "bg-forest text-white"
                : "text-muted hover:text-ink"
            )}
          >
            Tecvid ({TAJWEED_LESSONS.length})
          </button>
        </div>
      </div>

      {activeTab === "reading" && (
        <>
          {/* Placement: a one-line optional link until opened, so the lessons come first */}
          {!showPlacement && (
            <button
              type="button"
              onClick={() => setShowPlacement(true)}
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-muted underline-offset-2 hover:text-forest hover:underline"
            >
              <GraduationCap className="h-3.5 w-3.5" />
              {placementMeta.completed
                ? `Seviyen: ${placementMeta.level} (%${placementMeta.score ?? 0}) · testi yenile`
                : "İsteğe bağlı: 6 soruluk seviye testi"}
            </button>
          )}
          {showPlacement && (
          <section className="rounded-2xl border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="flex items-start gap-3">
                <div className="h-10 w-10 rounded-xl bg-sand flex items-center justify-center shrink-0">
                  <GraduationCap className="h-5 w-5 text-forest" />
                </div>
                <div>
                  <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                    {placementMeta.completed
                      ? `Seviye Değerlendirmesi: ${placementMeta.level} (%${placementMeta.score ?? 0})`
                      : "Başlangıç Seviye Değerlendirmesi"}
                  </h2>
                  <p className="text-xs text-muted mt-0.5">
                    {evaluation?.summaryTr ??
                      "Zaten bildiğiniz harf ve harekeleri tekrarlamak zorunda kalmamak için 6 soruluk hızlı değerlendirmeyi tamamlayın."}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setShowPlacement((v) => !v)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-forest px-4 py-2 text-xs font-semibold text-forest hover:bg-forest/5 shrink-0"
              >
                <RefreshCcw className="h-3.5 w-3.5" />
                <span>
                  {showPlacement
                    ? "Değerlendirmeyi Gizle"
                    : placementMeta.completed
                      ? "Değerlendirmeyi Yenile"
                      : "Değerlendirmeyi Başlat"}
                </span>
              </button>
            </div>

            {showPlacement && (
              <form
                onSubmit={handleSubmitPlacement}
                className="mt-6 pt-6 border-t border-line space-y-5"
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {PLACEMENT_QUESTIONS.map((q, idx) => (
                    <div
                      key={q.id}
                      className="rounded-xl border border-line bg-parchment p-4 space-y-3"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-forest">
                          Soru {idx + 1}
                        </span>
                        <span
                          lang="ar"
                          dir="rtl"
                          translate="no"
                          className="font-arabic text-3xl text-ink"
                        >
                          {q.arabicSample}
                        </span>
                      </div>
                      <p className="text-xs font-medium text-ink">{q.promptTr}</p>
                      <div className="space-y-1.5">
                        {q.options.map((opt) => (
                          <label
                            key={opt.id}
                            className={cn(
                              "flex items-center gap-2 rounded-lg border px-3 py-2 text-xs cursor-pointer transition-colors",
                              answers[q.id] === opt.id
                                ? "border-forest bg-surface font-semibold"
                                : "border-line bg-surface/60 hover:bg-surface"
                            )}
                          >
                            <input
                              type="radio"
                              name={q.id}
                              value={opt.id}
                              checked={answers[q.id] === opt.id}
                              onChange={() =>
                                setAnswers((prev) => ({ ...prev, [q.id]: opt.id }))
                              }
                              className="accent-forest"
                            />
                            <span>{opt.label}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                <button
                  type="submit"
                  disabled={
                    submittingPlacement ||
                    Object.keys(answers).length < PLACEMENT_QUESTIONS.length
                  }
                  className="rounded-xl bg-forest px-6 py-3 text-xs font-semibold text-white hover:bg-forest-deep disabled:opacity-50"
                >
                  {submittingPlacement
                    ? "Analiz Ediliyor..."
                    : "Değerlendirmeyi Tamamla ve Kişisel Planı Oluştur"}
                </button>
              </form>
            )}
          </section>
          )}

          {/* Curriculum Sidebar + Active Lesson */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <aside className="lg:col-span-4 space-y-2">
              {ARABIC_READING_MODULES.map((mod) => {
                const done = completedModules.has(mod.id);
                const recommended = evaluation?.recommendedModuleIds.includes(mod.id);
                const active = activeModule.id === mod.id;
                return (
                  <button
                    key={mod.id}
                    type="button"
                    onClick={() => setActiveModuleId(mod.id)}
                    className={cn(
                      "w-full text-left rounded-xl border p-3.5 transition-all flex items-start justify-between gap-2",
                      active
                        ? "border-forest bg-surface ring-1 ring-forest"
                        : "border-line bg-surface/70 hover:bg-surface"
                    )}
                  >
                    <div>
                      <div className="flex items-center gap-2">
                        <span className="font-mono text-[11px] font-bold text-muted">
                          {String(mod.order).padStart(2, "0")}
                        </span>
                        {recommended && (
                          <span className="rounded bg-gold-soft px-1.5 py-0.5 text-[10px] font-bold text-gold-ink">
                            Öncelikli
                          </span>
                        )}
                      </div>
                      <p className="mt-1 text-xs font-bold text-ink">{mod.titleTr}</p>
                    </div>
                    {done ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald shrink-0 mt-1" />
                    ) : (
                      <ChevronRight className="h-4 w-4 text-[#8e9b93] shrink-0 mt-1" />
                    )}
                  </button>
                );
              })}
            </aside>

            <section className="lg:col-span-8 rounded-2xl border border-line bg-surface p-6 space-y-6">
              <div>
                <span className="text-xs font-semibold text-gold">
                  Modül {activeModule.order} / {ARABIC_READING_MODULES.length}
                </span>
                <h2 className="mt-1 text-xl font-bold text-ink">
                  {activeModule.titleTr}
                </h2>
                <p className="text-sm text-muted">{activeModule.subtitleTr}</p>
              </div>

              <div className="space-y-3 text-sm text-[#2e3832] leading-relaxed">
                <p>{activeModule.explanationTr}</p>
                <div className="rounded-xl border border-gold-line bg-gold-soft p-4 text-xs text-gold-text">
                  <strong className="block mb-1">Sık Yapılan Okuma Hatası:</strong>
                  {activeModule.commonMistakeTr}
                </div>
              </div>

              {/* Examples with Verified Audio */}
              <div className="space-y-3">
                <h3 className="text-sm font-bold text-ink">
                  Arapça Örnekler (Doğrulanmış Mushaf Yazımıyla)
                </h3>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  {activeModule.examples.map((ex, i) => (
                    <div
                      key={i}
                      className="rounded-xl border border-line bg-parchment p-4 flex flex-col justify-between gap-2"
                    >
                      <div className="space-y-2">
                        <p
                          lang="ar"
                          dir="rtl"
                          translate="no"
                          className="font-arabic text-3xl text-center text-ink py-1"
                        >
                          {ex.arabic}
                        </p>
                        <p className="text-xs font-bold text-forest">{ex.labelTr}</p>
                        <p className="text-[11px] text-muted leading-relaxed">
                          {ex.noteTr}
                        </p>
                      </div>

                      {ex.audioUrl && (
                        <button
                          type="button"
                          onClick={() => playSampleAudio(ex.audioUrl)}
                          className="mt-1 inline-flex items-center justify-center gap-1.5 rounded-lg bg-mint px-2.5 py-1.5 text-[11px] font-semibold text-forest hover:bg-mint-strong"
                        >
                          <Volume2 className="h-3.5 w-3.5" />
                          <span>Dinle ({ex.isQuranicRef})</span>
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Mini Mastery Check */}
              <div className="rounded-xl border border-line bg-parchment p-5 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="inline-flex items-center gap-1.5 text-xs font-bold text-forest">
                    <HelpCircle className="h-4 w-4" />
                    Hızlı Kavrama Kontrolü
                  </span>
                  <span
                    lang="ar"
                    dir="rtl"
                    translate="no"
                    className="font-arabic text-2xl text-ink"
                  >
                    {activeModule.miniCheck.arabicPrompt}
                  </span>
                </div>
                <p className="text-xs font-medium text-ink">
                  {activeModule.miniCheck.promptTr}
                </p>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                  {activeModule.miniCheck.options.map((opt) => {
                    const picked = selectedQuizOpt === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => {
                          setQuizChoice((prev) => ({
                            ...prev,
                            [activeModule.id]: opt.id,
                          }));
                          if (opt.isCorrect) {
                            handleCompleteModule(activeModule.id);
                          }
                        }}
                        className={cn(
                          "rounded-xl border px-3 py-2.5 text-xs font-medium text-left transition-all",
                          picked
                            ? opt.isCorrect
                              ? "border-emerald bg-mint text-forest font-bold"
                              : "border-red-300 bg-red-50 text-red-900"
                            : "border-line bg-surface hover:bg-sand"
                        )}
                      >
                        {opt.labelTr}
                      </button>
                    );
                  })}
                </div>
                {quizOptionObj && (
                  <p
                    className={cn(
                      "text-xs font-semibold",
                      quizOptionObj.isCorrect ? "text-emerald" : "text-red-700"
                    )}
                  >
                    {quizOptionObj.isCorrect
                      ? "Doğru! Modül tamamlandı olarak kaydedildi."
                      : "Henüz tam değil — yukarıdaki örneği inceleyip tekrar deneyin."}
                  </p>
                )}
              </div>
            </section>
          </div>
        </>
      )}

      {activeTab === "alphabet" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-line bg-surface p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="h-10 w-10 rounded-xl bg-sand flex items-center justify-center shrink-0">
                <BookOpen className="h-5 w-5 text-forest" />
              </div>
              <div>
                <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
                  28 Harf Elif-Bâ ve Kur&apos;an Örnekleri Rehberi
                </h2>
                <p className="text-xs text-muted mt-0.5">
                  Her harfin yalın, başta, ortada ve sonda biçimlerini görün; örnek Kur&apos;an kelimesinin doğrulanmış telaffuzunu dinleyin.
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {[
                { id: "all", label: "Tümü (28)" },
                { id: "ince", label: "İnce" },
                { id: "kalın", label: "Kalın" },
                { id: "peltek", label: "Peltek" },
                { id: "boğaz", label: "Boğaz" },
                { id: "non_connecting", label: "Bitişmeyen (6)" },
              ].map((f) => (
                <button
                  key={f.id}
                  type="button"
                  onClick={() => setLetterFilter(f.id as typeof letterFilter)}
                  className={cn(
                    "rounded-lg px-3 py-1.5 text-xs font-semibold transition-colors",
                    letterFilter === f.id
                      ? "bg-forest text-white"
                      : "border border-line bg-parchment text-ink"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {filteredLetters.map((letter) => (
              <article
                key={letter.order}
                className="rounded-2xl border border-line bg-surface p-5 flex flex-col justify-between gap-4"
              >
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <span className="font-mono text-[11px] font-bold text-muted">
                        #{letter.order}
                      </span>
                      <h3 className="text-base font-bold text-ink">{letter.nameTr}</h3>
                      <div className="flex flex-wrap gap-1 mt-1">
                        <span className="rounded-full bg-mint px-2 py-0.5 text-[10px] font-semibold text-forest capitalize">
                          {letter.soundCategory}
                        </span>
                        {letter.nonConnecting && (
                          <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-semibold text-amber-900">
                            Sonrasına bitişmez
                          </span>
                        )}
                      </div>
                    </div>

                    <span
                      lang="ar"
                      dir="rtl"
                      translate="no"
                      className="font-arabic text-5xl text-forest leading-none pt-1"
                    >
                      {letter.isolated}
                    </span>
                  </div>

                  {/* 4 Forms Strip (RTL) */}
                  <div className="grid grid-cols-4 gap-1.5 rounded-xl border border-line bg-parchment p-2 text-center">
                    {[
                      { label: "Sonda", val: letter.final },
                      { label: "Ortada", val: letter.medial },
                      { label: "Başta", val: letter.initial },
                      { label: "Yalın", val: letter.isolated },
                    ].map((form) => (
                      <div key={form.label} className="rounded-lg bg-surface p-1.5">
                        <span className="block text-[10px] text-muted">{form.label}</span>
                        <span
                          lang="ar"
                          dir="rtl"
                          translate="no"
                          className="font-arabic text-2xl text-ink"
                        >
                          {form.val}
                        </span>
                      </div>
                    ))}
                  </div>

                  <p className="text-xs text-ink-soft leading-relaxed">{letter.makhrajTipTr}</p>
                </div>

                <div className="rounded-xl border border-[#ece4cf] bg-parchment p-3 flex items-center justify-between gap-2">
                  <div>
                    <span className="text-[10px] font-mono text-muted block">
                      Örnek ({letter.exampleWordLocation})
                    </span>
                    <span className="text-xs font-semibold text-forest">
                      {letter.exampleMeaningTr}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <span
                      lang="ar"
                      dir="rtl"
                      translate="no"
                      className="font-arabic text-2xl text-ink"
                    >
                      {letter.exampleArabic}
                    </span>
                    <button
                      type="button"
                      onClick={() => playSampleAudio(letter.exampleAudioUrl)}
                      aria-label={`${letter.nameTr} harfini örnek kelimede dinle`}
                      className="rounded-lg bg-forest p-2 text-white hover:bg-forest-deep"
                    >
                      <Volume2 className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {activeTab === "tajweed" && (
        <section className="space-y-4">
          <div className="rounded-2xl border border-gold-line bg-gold-soft p-4 text-xs text-gold-text">
            <strong>Pedagojik İlke:</strong> Bir kelimeyi doğru tanımak ile mahreç/tecvid kalitesini uygulamak farklı aşamalardır. Her kuralı önce dinleyerek ayırt edin, ardından Mushaf ekranında kendi sesinizi kaydedip kâri ile karşılaştırın.
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {TAJWEED_LESSONS.map((lesson) => {
              const practiced = practicedTajweed.has(lesson.slug);
              return (
                <article
                  key={lesson.slug}
                  className="rounded-2xl border border-line bg-surface p-6 flex flex-col justify-between gap-4"
                >
                  <div className="space-y-3">
                    <div className="flex items-start justify-between gap-3">
                      <div>
                        <span className="text-[11px] font-semibold text-gold">
                          {lesson.categoryTr} · Seviye {lesson.difficulty}
                        </span>
                        <h2 className="mt-0.5 text-base font-bold text-ink">
                          {lesson.nameTr}
                        </h2>
                      </div>
                      <span
                        lang="ar"
                        dir="rtl"
                        translate="no"
                        className="font-arabic text-xl text-forest"
                      >
                        {lesson.nameArabic}
                      </span>
                    </div>

                    <p className="text-xs text-ink-soft leading-relaxed">
                      {lesson.summaryTr}
                    </p>

                    {lesson.fatihaExample && (
                      <div className="rounded-xl border border-line bg-parchment p-3.5 space-y-2">
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-mono text-[11px] font-semibold text-forest">
                            Kur&apos;an Örneği ({lesson.fatihaExample.verseKey})
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              lang="ar"
                              dir="rtl"
                              translate="no"
                              className="font-arabic text-2xl text-ink"
                            >
                              {lesson.fatihaExample.arabic}
                            </span>
                            {lesson.fatihaExample.audioUrl && (
                              <button
                                type="button"
                                onClick={() => playSampleAudio(lesson.fatihaExample?.audioUrl)}
                                aria-label={`${lesson.nameTr} örneğini dinle`}
                                className="rounded-lg bg-forest p-1.5 text-white hover:bg-forest-deep"
                              >
                                <Volume2 className="h-3.5 w-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                        <p className="text-[11px] text-muted">
                          {lesson.fatihaExample.explanationTr}
                        </p>
                      </div>
                    )}

                    <div className="flex items-start gap-2 text-[11px] text-muted">
                      <Volume2 className="h-3.5 w-3.5 text-emerald shrink-0 mt-0.5" />
                      <span>{lesson.listenDiscriminationTipTr}</span>
                    </div>
                  </div>

                  <button
                    type="button"
                    onClick={() => handlePracticeTajweed(lesson.slug)}
                    className={cn(
                      "inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-xs font-semibold transition-colors",
                      practiced
                        ? "bg-mint text-forest border border-emerald/40"
                        : "bg-forest text-white hover:bg-forest-deep"
                    )}
                  >
                    <Sparkles className="h-3.5 w-3.5" />
                    <span>
                      {practiced ? "Çalışıldı Olarak İşaretlendi" : "Kuralı Çalıştım"}
                    </span>
                  </button>
                </article>
              );
            })}
          </div>
        </section>
      )}
    </div>
  );
}
