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
  HeartHandshake,
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

interface DashboardClientProps {
  initialSnapshot: DashboardStateSnapshot;
  initialPlan: DailyLearningPlan;
  backendStatus: BackendConfigurationStatus;
  totalSurahs: number;
  totalPages: number;
  totalReadingModules: number;
  totalTajweedLessons: number;
}

const MODE_LABELS: Record<SessionMode, { title: string; subtitle: string }> = {
  normal: { title: "Normal Mod", subtitle: "~20 dk · %60 Tekrar / %40 Yeni" },
  intensive: { title: "Yoğun Mod", subtitle: "~35 dk · Derin Ezber & Analiz" },
  recovery: { title: "Toparlanma", subtitle: "3–5 dk · Yalnızca Öncelikli Tekrar" },
};

export function DashboardClient({
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
  const nextTaskHref = plan.steps[0]?.href ?? `/mushaf?page=${activePage}`;
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
      {/* Ephemeral / Cloud Sync Honest Banner when running in serverless temp SQLite */}
      {backendStatus.activePersistence === "sqlite_ephemeral_tmp" && (
        <div className="rounded-2xl border border-[#e3d2ae] bg-[#f7f1e3] px-5 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-[#4a3b1f]">
          <div className="flex items-start gap-2.5">
            <Cloud className="h-4 w-4 text-[#9a7639] shrink-0 mt-0.5" />
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
            className="rounded-xl bg-[#1b4332] px-4 py-2 text-xs font-semibold text-white hover:bg-[#143326] shrink-0 text-center"
          >
            Ayarlar / Senkronizasyon
          </Link>
        </div>
      )}

      {/* Hero / Continue Learning */}
      <section className="rounded-2xl border border-[#e5dec9] bg-white p-6 sm:p-8 shadow-xs">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-6">
          <div className="space-y-3 max-w-2xl">
            <div className="inline-flex flex-wrap items-center gap-2 rounded-full bg-[#f3efe6] px-3 py-1 text-xs font-semibold text-[#1b4332]">
              <span>Medine Mushafı · Sayfa {activePage}</span>
              <span className="text-[#b08d57]">•</span>
              <span>{totalSurahs} Sure (Fâtiha + Cüz Amme · {totalPages} Sayfa)</span>
            </div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tight text-[#1c241f]">
              Selam, {snapshot.profile.displayName}. Bugünkü yolculuğunuz hazır.
            </h1>
            <p className="text-sm sm:text-base text-[#5a655e] leading-relaxed">
              {plan.dueCardsCount > 0
                ? `${plan.dueCardsCount} tekrar kartı zamanı geldi. Yeni konuya geçmeden önce kısa bir aktif hatırlama ile öğrendiklerinizi koruyalım.`
                : `Bekleyen tekrarlarınız güncel. Bugün Sayfa ${activePage} üzerinden okumaya, kelime analizine veya Cüz Amme ezberine devam edebilirsiniz.`}
            </p>
          </div>

          <div className="flex flex-col sm:flex-row lg:flex-col items-stretch sm:items-center lg:items-end gap-3 shrink-0">
            <Link
              href={nextTaskHref}
              className="inline-flex items-center justify-center gap-2.5 rounded-xl bg-[#1b4332] px-6 py-3.5 text-sm font-semibold text-[#faf8f3] hover:bg-[#143326] transition-colors shadow-xs"
            >
              <span>Öğrenmeye Başla</span>
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href={`/mushaf?page=${activePage}`}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-4 py-2.5 text-xs font-semibold text-[#1b4332] hover:bg-[#f3efe6] transition-colors"
            >
              <BookOpenText className="h-4 w-4" />
              <span>Mushaf Sayfa {activePage}&apos;i Aç</span>
            </Link>
          </div>
        </div>

        {/* Forgiving Recovery Banner if needed */}
        {plan.recoveryMessageTr && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-[#e3d2ae] bg-[#f7f1e3] p-4 text-sm text-[#4a3b1f]">
            <HeartHandshake className="h-5 w-5 text-[#9a7639] shrink-0 mt-0.5" />
            <div>
              <p className="font-semibold">Esnek Toparlanma Desteği</p>
              <p className="mt-0.5 text-xs sm:text-sm leading-relaxed">{plan.recoveryMessageTr}</p>
            </div>
          </div>
        )}

        {/* Session Mode Switcher */}
        <div className="mt-6 pt-6 border-t border-[#e5dec9] flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-[#5a655e]">
            <Clock className="h-4 w-4 text-[#b08d57]" />
            <span>Günlük Oturum Modu</span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            {(Object.keys(MODE_LABELS) as SessionMode[]).map((mode) => {
              const active = plan.mode === mode;
              return (
                <button
                  key={mode}
                  type="button"
                  disabled={updatingMode}
                  onClick={() => handleModeChange(mode)}
                  className={cn(
                    "rounded-xl border px-3.5 py-2 text-left transition-all",
                    active
                      ? "border-[#1b4332] bg-[#1b4332]/5 ring-1 ring-[#1b4332]"
                      : "border-[#e5dec9] bg-[#faf8f3] hover:bg-[#f3efe6]"
                  )}
                >
                  <p className="text-xs font-bold text-[#1c241f]">{MODE_LABELS[mode].title}</p>
                  <p className="text-[11px] text-[#5a655e]">{MODE_LABELS[mode].subtitle}</p>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      {/* Quick Summary Cards */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="rounded-2xl border border-[#e5dec9] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#5a655e]">
            <span>Bekleyen Tekrar</span>
            <RotateCcw className="h-4 w-4 text-[#1b4332]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#1c241f]">{plan.dueCardsCount}</p>
          <p className="mt-1 text-xs text-[#5a655e]">Aktif hatırlama kartı</p>
        </div>

        <div className="rounded-2xl border border-[#e5dec9] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#5a655e]">
            <span>Güncel Seri</span>
            <Flame className="h-4 w-4 text-[#b08d57]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#1c241f]">{snapshot.currentStreakDays} gün</p>
          <p className="mt-1 text-xs text-[#5a655e]">Cezasız esnek takip</p>
        </div>

        <div className="rounded-2xl border border-[#e5dec9] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#5a655e]">
            <span>Bugünkü Çalışma</span>
            <Clock className="h-4 w-4 text-[#2d6a4f]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#1c241f]">
            {todayStats?.minutesStudied ?? 0} dk
          </p>
          <p className="mt-1 text-xs text-[#5a655e]">
            Hedef: {snapshot.goals.dailyTargetMinutes} dk
          </p>
        </div>

        <div className="rounded-2xl border border-[#e5dec9] bg-white p-4 sm:p-5">
          <div className="flex items-center justify-between text-xs font-medium text-[#5a655e]">
            <span>Öğrenme Puanı</span>
            <Sparkles className="h-4 w-4 text-[#b08d57]" />
          </div>
          <p className="mt-2 text-2xl font-bold text-[#1c241f]">{snapshot.totalXp} XP</p>
          <p className="mt-1 text-xs text-[#5a655e]">Yalnızca gerçek hatırlamadan</p>
        </div>
      </section>

      {/* Main 2-Column Workspace: Today's Plan + 5 Independent Pillars */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Today's Adaptive Plan */}
        <section className="lg:col-span-7 rounded-2xl border border-[#e5dec9] bg-white p-6 space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-lg font-bold text-[#1c241f]">Bugünkü Öğrenme Planı</h2>
              <p className="text-xs text-[#5a655e]">
                Toplam ~{plan.totalEstimatedMinutes} dk · %{plan.reviewSharePercent} Tekrar / %
                {plan.newMaterialSharePercent} Yeni Konu
              </p>
            </div>
            <span className="rounded-full bg-[#f3efe6] px-3 py-1 text-xs font-semibold text-[#1b4332]">
              {plan.steps.length} Adım
            </span>
          </div>

          <div className="space-y-3">
            {plan.steps.map((step) => (
              <Link
                key={step.id}
                href={step.href}
                className="group flex items-start justify-between gap-4 rounded-xl border border-[#e5dec9] bg-[#faf8f3] p-4 hover:border-[#1b4332] hover:bg-white transition-all"
              >
                <div className="flex items-start gap-3.5">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[#1b4332] text-xs font-bold text-white">
                    {step.order}
                  </div>
                  <div>
                    <div className="flex flex-wrap items-center gap-2">
                      <h3 className="text-sm font-semibold text-[#1c241f] group-hover:text-[#1b4332]">
                        {step.titleTr}
                      </h3>
                      {step.priority === "overdue" && (
                        <span className="rounded-md bg-[#f7f1e3] px-2 py-0.5 text-[10px] font-bold text-[#8d682c]">
                          Öncelikli Tekrar
                        </span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-[#5a655e] leading-relaxed">
                      {step.descriptionTr}
                    </p>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0 text-xs font-medium text-[#5a655e]">
                  <span>{step.estimatedMinutes} dk</span>
                  <ArrowRight className="h-3.5 w-3.5 group-hover:translate-x-0.5 transition-transform" />
                </div>
              </Link>
            ))}
          </div>
        </section>

        {/* 5 Independent Learning Pillars */}
        <section className="lg:col-span-5 rounded-2xl border border-[#e5dec9] bg-white p-6 space-y-4">
          <div>
            <h2 className="text-lg font-bold text-[#1c241f]">5 Bağımsız Öğrenme Boyutu</h2>
            <p className="text-xs text-[#5a655e]">
              Her beceri ayrı ölçülür; güçlü olduğunuz alan zayıf olanı gizlemez.
            </p>
          </div>

          <div className="space-y-4">
            {pillars.map((p) => {
              const Icon = p.icon;
              return (
                <Link key={p.key} href={p.href} className="block group">
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center gap-2 font-semibold text-[#1c241f] group-hover:text-[#1b4332]">
                      <Icon className="h-4 w-4 text-[#2d6a4f]" />
                      {p.label}
                    </span>
                    <span className="font-mono text-xs font-bold text-[#1b4332]">%{p.score}</span>
                  </div>
                  <div className="mt-1.5 h-2 w-full rounded-full bg-[#efeae0] overflow-hidden">
                    <div
                      className="h-full rounded-full bg-[#2d6a4f] transition-all duration-500"
                      style={{ width: `${Math.max(2, p.score)}%` }}
                    />
                  </div>
                  <p className="mt-1 text-[11px] text-[#5a655e]">{p.detail}</p>
                </Link>
              );
            })}
          </div>
        </section>
      </div>

      {/* Verse Memorization Status Snapshot */}
      <section className="rounded-2xl border border-[#e5dec9] bg-white p-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
          <div>
            <h2 className="text-lg font-bold text-[#1c241f]">
              Takip Edilen Ayetlerde Ezber Durumu ({snapshot.verseProgress.length} Ayet)
            </h2>
            <p className="text-xs text-[#5a655e]">
              Bir sayfayı yalnızca bir kez okumak ezber sayılmaz; her ayet aktif geri çağırma ile ilerler.
            </p>
          </div>
          <Link
            href="/memorization"
            className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1b4332] hover:underline"
          >
            <span>Ezber Stüdyosuna Git (38 Sure)</span>
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
                    ? "border-[#2d6a4f]/40 bg-[#edf5f0]"
                    : needsRev
                      ? "border-[#b08d57] bg-[#f7f1e3]"
                      : "border-[#e5dec9] bg-[#faf8f3] hover:bg-[#f3efe6]"
                )}
              >
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs font-bold text-[#1c241f]">
                    {vp.verseKey}
                  </span>
                  {isSolid && <CheckCircle2 className="h-3.5 w-3.5 text-[#2d6a4f]" />}
                </div>
                <p className="mt-1.5 text-[11px] font-medium text-[#3f4a43]">
                  {MEMORIZATION_STATE_LABELS_TR[vp.memorizationState]}
                </p>
              </Link>
            );
          })}
        </div>
      </section>
    </div>
  );
}
