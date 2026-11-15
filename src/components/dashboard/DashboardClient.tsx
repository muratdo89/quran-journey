"use client";

import React, { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BookOpenText,
  Brain,
  CheckCircle2,
  Clock,
  Cloud,
  Flame,
  GraduationCap,
  Languages,
  Mic,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import type {
  BackendConfigurationStatus,
  DashboardStateSnapshot,
} from "@/lib/db/types";
import type { DailyLearningPlan, SessionMode } from "@/lib/learning-engine";
import { MEMORIZATION_STATE_LABELS_TR } from "@/lib/learning-engine";
import { cn } from "@/lib/utils";
import type { DailyVerse, JuzProgress } from "@/lib/content/daily-focus";
import { startSession } from "@/lib/study-session";
import { TodayFocusCard, toSessionSteps } from "@/components/dashboard/TodayFocusCard";

interface DashboardClientProps {
  dailyVerse: DailyVerse | null;
  juzProgress: JuzProgress;
  initialSnapshot: DashboardStateSnapshot;
  initialPlan: DailyLearningPlan;
  backendStatus: BackendConfigurationStatus;
  totalSurahs: number;
  totalPages: number;
  totalReadingModules: number;
  totalTajweedLessons: number;
}

const MODE_LABELS: Record<SessionMode, { short: string; subtitle: string }> = {
  recovery: { short: "Kısa", subtitle: "3–5 dk · Yalnızca öncelikli tekrar" },
  normal: { short: "Normal", subtitle: "~20 dk · %60 tekrar / %40 yeni" },
  intensive: { short: "Yoğun", subtitle: "~35 dk · Derin ezber ve analiz" },
};

export function DashboardClient({
  dailyVerse,
  juzProgress,
  initialSnapshot,
  initialPlan,
  backendStatus,
  totalSurahs,
  totalPages,
  totalReadingModules,
  totalTajweedLessons,
}: DashboardClientProps) {
  const [snapshot, setSnapshot] = useState(initialSnapshot);
  const [plan, setPlan] = useState(initialPlan);
  const [updatingMode, setUpdatingMode] = useState(false);

  async function handleModeChange(mode: SessionMode) {
    setUpdatingMode(true);
    try {
      await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionMode: mode,
          dailyTargetMinutes: mode === "recovery" ? 5 : mode === "intensive" ? 35 : 20,
        }),
      });
      const res = await fetch("/api/state");
      if (res.ok) {
        const data = await res.json();
        setSnapshot(data.snapshot);
        setPlan(data.dailyPlan);
      }
    } finally {
      setUpdatingMode(false);
    }
  }

  const activePage = snapshot.profile.currentPageNumber;
  const memorizedVersesCount = snapshot.verseProgress.filter(
    (v) =>
      v.memorizationState === "provisional_mastery" ||
      v.memorizationState === "stable_memorization"
  ).length;

  const pillars = [
    {
      key: "arabicReading",
      label: "Arapça Okuma",
      score: snapshot.pillarScores.arabicReading,
      detail: snapshot.profile.placementCompleted
        ? `${snapshot.completedReadingModuleIds.length}/${totalReadingModules} modül tamamlandı`
        : "Başlangıç değerlendirmesi bekliyor",
      href: "/learn-arabic",
      icon: GraduationCap,
    },
    {
      key: "tajweed",
      label: "Telaffuz ve Tecvid",
      score: snapshot.pillarScores.tajweed,
      detail: `${snapshot.practicedTajweedSlugs.length}/${totalTajweedLessons} tecvid konusu · ${snapshot.recordings.length} ses kaydı`,
      href: "/learn-arabic?tab=tajweed",
      icon: Mic,
    },
    {
      key: "vocabulary",
      label: "Kelime Hazinesi",
      score: snapshot.pillarScores.vocabulary,
      detail: `${snapshot.wordProgress.filter((w) => w.status === "known").length}/${snapshot.wordProgress.length} aktif kelime pekişti`,
      href: "/vocabulary",
      icon: Languages,
    },
    {
      key: "comprehension",
      label: "Ayet Anlama",
      score: snapshot.pillarScores.comprehension,
      detail: `${snapshot.pageProgress.length}/${totalPages} Mushaf sayfası çalışıldı`,
      href: `/mushaf?page=${activePage}`,
      icon: BookOpenText,
    },
    {
      key: "memorization",
      label: "Ezber (Hıfz)",
      score: snapshot.pillarScores.memorization,
      detail: `${memorizedVersesCount}/${snapshot.verseProgress.length} çalışılan ayet sağlam`,
      href: "/memorization",
      icon: Brain,
    },
  ];

  const todayStr = new Date().toISOString().slice(0, 10);
  const todayStats = snapshot.activityHistory.find((a) => a.activityDate === todayStr);

  return (
    <div className="space-y-8">
      <TodayFocusCard
        displayName={snapshot.profile.displayName}
        plan={plan}
        streakDays={snapshot.currentStreakDays}
        activePage={activePage}
        dailyVerse={dailyVerse}
        juzProgress={juzProgress}
      />

      {/* Quick Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <span>Bekleyen Tekrar</span>
            <RotateCcw className="h-4 w-4 text-forest" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{plan.dueCardsCount}</p>
          <p className="mt-1 text-xs text-muted">Aktif hatırlama kartı</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <span>Güncel Seri</span>
            <Flame className="h-4 w-4 text-gold" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{snapshot.currentStreakDays} gün</p>
          <p className="mt-1 text-xs text-muted">Cezasız esnek takip</p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <span>Bugünkü Çalışma</span>
            <Clock className="h-4 w-4 text-emerald" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">
            {todayStats?.minutesStudied ?? 0} dk
          </p>
          <p className="mt-1 text-xs text-muted">
            Hedef: {snapshot.goals.dailyTargetMinutes} dk
          </p>
        </div>

        <div className="rounded-2xl border border-line bg-surface p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-muted">
            <span>Öğrenme Puanı</span>
            <Sparkles className="h-4 w-4 text-gold" />
          </div>
          <p className="mt-2 text-2xl font-bold text-ink">{snapshot.totalXp} XP</p>
          <p className="mt-1 text-xs text-muted">Yalnızca gerçek hatırlamadan</p>
        </div>
      </section>

      {/* Main 2-Column Workspace: Today's Plan + 5 Independent Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Adaptive Plan */}
        <section className="lg:col-span-7 rounded-2xl border border-line bg-surface p-6 space-y-4">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <h2 className="font-display text-xl font-semibold tracking-tight text-ink">Bugünkü Öğrenme Planı</h2>
              <p className="text-xs text-muted">
                Toplam ~{plan.totalEstimatedMinutes} dk · %{plan.reviewSharePercent} Tekrar / %
                {plan.newMaterialSharePercent} Yeni Konu
              </p>
            </div>
            <div
              role="radiogroup"
              aria-label="Günlük oturum süresi"
              className="inline-flex shrink-0 rounded-xl border border-line bg-parchment p-0.5"
            >
              {(Object.keys(MODE_LABELS) as SessionMode[]).map((mode) => {
                const active = plan.mode === mode;
                return (
                  <button
                    key={mode}
                    type="button"
                    role="radio"
                    aria-checked={active}
                    title={MODE_LABELS[mode].subtitle}
                    disabled={updatingMode}
                    onClick={() => handleModeChange(mode)}
                    className={cn(
                      "rounded-lg px-2.5 py-1 text-[11px] font-semibold transition-colors",
                      active ? "bg-forest text-parchment" : "text-muted hover:text-forest"
                    )}
                  >
                    {MODE_LABELS[mode].short}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="space-y-3">
            {plan.steps.map((step, i) => (
              <Link
                key={step.id}
                href={step.href}
                onClick={() => startSession(toSessionSteps(plan), i)}
                className="group flex items-start justify-between gap-4 rounded-xl border border-line bg-parchment p-4 hover:border-forest hover:bg-surface transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">
                    {step.order}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-ink group-hover:text-forest">
                        {step.titleTr}
                      </h3>
                      {step.priority === "overdue" && (
                        <span className="rounded-md bg-gold-soft px-2 py-0.5 text-[10px] font-bold text-gold-ink">
                          Öncelikli Tekrar
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-muted leading-relaxed">
                      {step.descriptionTr}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-muted">
                  <span>{step.estimatedMinutes} dk</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 5 Independent Learning Pillars */}
        <section className="lg:col-span-5 rounded-2xl border border-line bg-surface p-6 space-y-4">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink">5 Bağımsız Öğrenme Boyutu</h2>
            <p className="text-xs text-muted">
              Her beceri ayrı ölçülür; güçlü olduğunuz alan zayıf olanı gizlemez.
            </p>
          </div>

          <div className="space-y-4">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <Link key={p.key} href={p.href} className="block group">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 font-semibold text-ink group-hover:text-forest">
                      <Icon className="h-4 w-4 text-emerald" />
                      {p.label}
                    </span>
                    <span className="font-mono text-xs font-bold text-forest">%{p.score}</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-track overflow-hidden">
                    <div
                      className="h-full rounded-full bg-emerald transition-all duration-500"
                      style={{ width: `${Math.max(2, p.score)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-muted">{p.detail}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* Verse Memorization Status Snapshot */}
      <section className="rounded-2xl border border-line bg-surface p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="font-display text-xl font-semibold tracking-tight text-ink">
              Takip Edilen Ayetlerde Ezber Durumu ({snapshot.verseProgress.length} Ayet)
            </h2>
            <p className="text-xs text-muted">
              Bir sayfayı yalnızca bir kez okumak ezber sayılmaz; her ayet aktif geri çağırma ile ilerler.
            </p>
          </div>
          <Link
            href="/memorization"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-forest hover:underline"
          >
            <span>Ezber Stüdyosuna Git ({totalSurahs} Sure)</span>
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-7 gap-2.5">
          {snapshot.verseProgress.slice(0, 14).map((vp) => {
            const isSolid =
              vp.memorizationState === "provisional_mastery" ||
              vp.memorizationState === "stable_memorization";
            const needsRev = vp.memorizationState === "needs_revision";
            return (
              <Link
                key={vp.verseKey}
                href={`/memorization?verse=${vp.verseKey}`}
                className={cn(
                  "rounded-xl border p-3 transition-colors",
                  isSolid
                    ? "border-emerald/40 bg-mint"
                    : needsRev
                      ? "border-gold bg-gold-soft"
                      : "border-line bg-parchment hover:bg-sand"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-ink">
                    {vp.verseKey}
                  </span>
                  {isSolid && <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />}
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-ink-soft">
                  {MEMORIZATION_STATE_LABELS_TR[vp.memorizationState]}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
      {/* Ephemeral / Cloud Sync Honest Banner when running in serverless temp SQLite */}
      {backendStatus.activePersistence === "sqlite_ephemeral_tmp" && (
        <div className="rounded-2xl border border-gold-line bg-gold-soft px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-gold-text">
          <div className="flex items-start gap-2.5">
            <Cloud className="h-4 w-4 text-gold-ink shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">
                {backendStatus.supabaseConfigured
                  ? "Bulut Senkronizasyonu Hazır — Giriş Bekleniyor"
                  : "Geçici Sunucu Belleği (/tmp SQLite) Aktif"}
              </p>
              <p className="opacity-90 mt-0.5">
                {backendStatus.supabaseConfigured
                  ? "Supabase bağlantınız hazır. İlerlemenizi telefon ve masaüstünde kalıcı tutmak için Ayarlar'dan giriş yapın."
                  : "Bulut ortamında kalıcı kayıt için Ayarlar ekranından Supabase PostgreSQL kurulumunu tamamlayabilirsiniz."}
              </p>
            </div>
          </div>
          <Link
            href="/settings"
            className="rounded-xl bg-forest px-4 py-2 text-xs font-semibold text-white hover:bg-forest-deep shrink-0 text-center"
          >
            Ayarlar / Senkronizasyon
          </Link>
        </div>
      )}
    </div>
  );
}
