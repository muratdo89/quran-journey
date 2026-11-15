import Link from "next/link";
import {
  AlertTriangle,
  Award,
  BarChart3,
  BookOpenCheck,
  Brain,
  Calendar,
  Compass,
  Info,
  Languages,
} from "lucide-react";
import { ARABIC_READING_MODULES, TAJWEED_LESSONS } from "@/lib/content/arabic-curriculum";
import { getAvailablePages, getWordByLocation } from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import {
  buildErrorPatternInsights,
  buildJuzProgressGrid,
  MEMORIZATION_STATE_LABELS_TR,
} from "@/lib/learning-engine";
import { PageHeader } from "@/components/ui/PageHeader";

export const dynamic = "force-dynamic";

export default async function StatisticsPage() {
  const repo = await getRepository();
  const snapshot = await repo.getDashboardSnapshot();
  const totalAvailablePages = getAvailablePages().length;

  const totalAttempts = snapshot.wordProgress.reduce(
    (sum, w) => sum + w.timesCorrect + w.timesMissed,
    0
  );
  const totalCorrect = snapshot.wordProgress.reduce(
    (sum, w) => sum + w.timesCorrect,
    0
  );
  const recallRate =
    totalAttempts > 0 ? Math.round((totalCorrect / totalAttempts) * 100) : null;

  const knownWords = snapshot.wordProgress.filter((w) => w.status === "known").length;
  const difficultWords = snapshot.wordProgress.filter((w) => w.status === "difficult");
  const memorizedVerses = snapshot.verseProgress.filter(
    (v) =>
      v.memorizationState === "provisional_mastery" ||
      v.memorizationState === "stable_memorization"
  ).length;
  const stableVerses = snapshot.verseProgress.filter(
    (v) => v.memorizationState === "stable_memorization"
  ).length;

  const totalMinutes = snapshot.activityHistory.reduce(
    (sum, a) => sum + a.minutesStudied,
    0
  );
  const totalReviews = snapshot.activityHistory.reduce(
    (sum, a) => sum + a.reviewsCompleted,
    0
  );

  // Enrich missed words cleanly from canonical gzipped Surahs
  const wordMistakes = snapshot.wordProgress
    .filter((wp) => wp.timesMissed > 0)
    .map((wp) => {
      const canonical = getWordByLocation(wp.wordLocation);
      return {
        wordLocation: wp.wordLocation,
        arabic: canonical?.textUthmani ?? wp.wordLocation,
        meaningTr: canonical?.translationTr ?? "",
        rootArabic: canonical?.morphology.rootArabic ?? null,
        partOfSpeech: canonical?.morphology.segments[0]?.partOfSpeech ?? null,
        timesMissed: wp.timesMissed,
      };
    });

  const errorReport = buildErrorPatternInsights({
    cards: snapshot.cards,
    wordMistakes,
    verseStates: snapshot.verseProgress.map((v) => ({
      verseKey: v.verseKey,
      memorizationState: v.memorizationState,
    })),
    completedReadingModuleIds: snapshot.completedReadingModuleIds,
    totalReadingModules: ARABIC_READING_MODULES.length,
    practicedTajweedSlugs: snapshot.practicedTajweedSlugs,
    totalTajweedLessons: TAJWEED_LESSONS.length,
  });

  const juzGrid = buildJuzProgressGrid(
    snapshot.pageProgress.map((p) => ({ pageNumber: p.pageNumber, status: p.status }))
  );

  const metrics = [
    {
      label: "Pekiştirilen Kelimeler",
      value: `${knownWords} / ${snapshot.wordProgress.length}`,
      icon: Languages,
    },
    {
      label: "Kelime Hatırlama Oranı",
      value: recallRate !== null ? `%${recallRate}` : "Henüz veri yok",
      icon: BarChart3,
    },
    {
      label: "Ezberlenen / Kalıcı Ayet",
      value: `${memorizedVerses} / ${stableVerses} kalıcı`,
      icon: Brain,
    },
    {
      label: "Mushaf Sayfaları & Çalışma",
      value: `${snapshot.pageProgress.length}/${totalAvailablePages} sayfa · ${totalMinutes} dk`,
      icon: BookOpenCheck,
    },
  ];

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          eyebrow="Ben"
          title="İstatistikler"
          description={<>Yalnızca doğrulanmış aktif hatırlama, FSRS unutma (lapse) örüntüleri, okuma tamamlama ve ezber testlerinden üretilen dürüst ölçümler ({totalReviews} tekrar).</>}
          related={[{ href: "/settings", label: "Profil ve Ayarlar" }]}
        />
      </div>

      {/* Top Real Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-2xl border border-line bg-surface p-5 space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-medium text-muted">
                <span>{m.label}</span>
                <Icon className="h-4 w-4 text-forest" />
              </div>
              <p className="text-xl font-bold text-ink">{m.value}</p>
            </div>
          );
        })}
      </section>

      {/* Phase 5: Longitudinal Error-Pattern Analytics */}
      <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gold" />
              <span>Hata Örüntüsü Analizi ve Öncelikli Öneriler</span>
            </h2>
            <p className="text-xs text-muted">
              FSRS kart düşüşleri, kaçırılan kökler, okuma boşlukları ve zayıflayan ezberler taranarak oluşturulur.
            </p>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <span className="rounded-lg bg-parchment border border-line px-2.5 py-1 font-semibold">
              Lapse Kart: {errorReport.lapsedCardsCount}
            </span>
            <span className="rounded-lg bg-parchment border border-line px-2.5 py-1 font-semibold">
              Tekrar Bekleyen Ayet: {errorReport.revisionVersesCount}
            </span>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {errorReport.insights.map((ins) => (
            <article
              key={ins.id}
              className={
                ins.severity === "high"
                  ? "rounded-xl border border-amber-300 bg-amber-50/70 p-4 space-y-2"
                  : ins.severity === "medium"
                    ? "rounded-xl border border-gold-line bg-gold-soft/70 p-4 space-y-2"
                    : "rounded-xl border border-line bg-parchment p-4 space-y-2"
              }
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-gold-ink">
                  {ins.categoryTr}
                </span>
                {ins.severity === "high" ? (
                  <AlertTriangle className="h-3.5 w-3.5 text-amber-700" />
                ) : (
                  <Info className="h-3.5 w-3.5 text-forest" />
                )}
              </div>
              <h3 className="text-sm font-bold text-ink">{ins.titleTr}</h3>
              <p className="text-xs text-ink-soft leading-relaxed">{ins.detailTr}</p>
              <div className="pt-1">
                <Link
                  href={ins.actionHref}
                  className="inline-flex items-center rounded-lg bg-forest px-3 py-1.5 text-[11px] font-semibold text-white hover:bg-forest-deep"
                >
                  {ins.actionLabelTr}
                </Link>
              </div>
            </article>
          ))}
        </div>

        {errorReport.topMissedRoots.length > 0 && (
          <div className="pt-3 border-t border-line space-y-2">
            <p className="text-xs font-semibold text-ink">
              En Sık Hata Yapılan Kelime Kökleri:
            </p>
            <div className="flex flex-wrap gap-2">
              {errorReport.topMissedRoots.map((bucket) => (
                <Link
                  key={bucket.rootArabic}
                  href={`/vocabulary?root=${encodeURIComponent(bucket.rootArabic)}`}
                  className="inline-flex items-center gap-2 rounded-xl border border-line bg-parchment px-3 py-1.5 text-xs hover:border-forest"
                >
                  <span lang="ar" dir="rtl" translate="no" className="font-arabic text-base font-bold text-forest">
                    {bucket.rootArabic}
                  </span>
                  <span className="text-muted">{bucket.missedCount} hata</span>
                </Link>
              ))}
            </div>
          </div>
        )}
      </section>

      {/* 30-Juz / 604-Page Madinah Mushaf Coverage Map */}
      <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
              <Compass className="h-4 w-4 text-forest" />
              <span>30 Cüz / 604 Sayfa Medine Mushafı Haritası</span>
            </h2>
            <p className="text-xs text-muted">
              Her cüz kartına tıklayarak doğrudan o cüzün başlangıç Mushaf sayfasına gidebilirsiniz.
            </p>
          </div>
          <span className="text-xs font-semibold text-forest">
            {snapshot.pageProgress.length} / 604 sayfa çalışıldı
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5 lg:grid-cols-6 gap-2.5">
          {juzGrid.map((juz) => {
            const hasStudy = juz.studiedPages > 0;
            const isComplete = juz.completedPages === juz.totalPages;
            return (
              <Link
                key={juz.juzNumber}
                href={`/mushaf?page=${juz.startPage}`}
                className={
                  isComplete
                    ? "rounded-xl border border-emerald bg-mint p-3 text-xs transition-colors"
                    : hasStudy
                      ? "rounded-xl border border-gold bg-gold-soft/70 p-3 text-xs transition-colors hover:bg-gold-soft"
                      : "rounded-xl border border-line bg-parchment p-3 text-xs transition-colors hover:border-forest"
                }
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-ink">{juz.juzNumber}. Cüz</span>
                  <span className="font-mono text-[10px] text-muted">
                    {juz.startPage}–{juz.endPage}
                  </span>
                </div>
                <p className="mt-1.5 text-[11px] text-muted">
                  {juz.studiedPages}/{juz.totalPages} sayfa
                </p>
                <div className="mt-1.5 h-1.5 rounded-full bg-line overflow-hidden">
                  <div
                    className="h-full rounded-full bg-forest"
                    style={{
                      width: `${Math.round((juz.studiedPages / juz.totalPages) * 100)}%`,
                    }}
                  />
                </div>
              </Link>
            );
          })}
        </div>
      </section>

      {/* 5 Independent Dimensions + Verse Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            5 Bağımsız Beceri Puanı
          </h2>
          <div className="space-y-3.5">
            {[
              { name: "Arapça Okuma", val: snapshot.pillarScores.arabicReading },
              { name: "Telaffuz ve Tecvid", val: snapshot.pillarScores.tajweed },
              { name: "Kelime Hazinesi", val: snapshot.pillarScores.vocabulary },
              { name: "Ayet Anlama", val: snapshot.pillarScores.comprehension },
              { name: "Ezber (Hıfz)", val: snapshot.pillarScores.memorization },
            ].map((item) => (
              <div key={item.name}>
                <div className="flex justify-between text-xs font-semibold mb-1">
                  <span>{item.name}</span>
                  <span className="font-mono text-forest">%{item.val}</span>
                </div>
                <div className="h-2 rounded-full bg-track overflow-hidden">
                  <div
                    className="h-full rounded-full bg-forest"
                    style={{ width: `${Math.max(2, item.val)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">
            Ayet ve Sayfa Bazlı Hıfz Dağılımı ({snapshot.verseProgress.length} Ayet)
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {snapshot.verseProgress.map((vp) => (
              <div
                key={vp.verseKey}
                className="flex items-center justify-between rounded-xl border border-line bg-parchment px-3.5 py-2.5 text-xs"
              >
                <span className="font-mono font-bold text-forest">{vp.verseKey}</span>
                <span className="font-medium text-ink">
                  {MEMORIZATION_STATE_LABELS_TR[vp.memorizationState]}
                </span>
                <span className="text-muted">
                  Kavrama: %{vp.comprehensionScore}
                </span>
              </div>
            ))}
          </div>
          {snapshot.pageProgress.length > 0 && (
            <div className="pt-3 border-t border-line">
              <p className="text-xs font-semibold text-ink mb-1.5">
                Çalışılan Mushaf Sayfaları ({snapshot.pageProgress.length}/{totalAvailablePages})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.pageProgress.map((pp) => (
                  <Link
                    key={pp.pageNumber}
                    href={`/mushaf?page=${pp.pageNumber}`}
                    className="rounded-lg bg-mint border border-emerald/25 px-2.5 py-1 text-[11px] font-semibold text-forest hover:border-forest"
                  >
                    Sayfa {pp.pageNumber} ({pp.memorizedVersesCount}/{pp.studiedVersesCount} ezber)
                  </Link>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Activity History & Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
            <Calendar className="h-4 w-4 text-forest" />
            <span>Son Çalışma Günlüğü</span>
          </h2>
          {snapshot.activityHistory.length > 0 ? (
            <div className="space-y-2">
              {snapshot.activityHistory.slice(0, 10).map((day) => (
                <div
                  key={day.activityDate}
                  className="flex items-center justify-between rounded-xl bg-parchment border border-line px-3.5 py-2 text-xs"
                >
                  <span className="font-mono font-semibold">{day.activityDate}</span>
                  <span>{day.minutesStudied} dk</span>
                  <span>{day.reviewsCompleted} tekrar</span>
                  <span className="font-semibold text-forest">+{day.xpEarned} XP</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">
              Henüz kayıtlı çalışma oturumu yok. Tekrar veya ezber oturumu tamamladığınızda gerçek çalışma günlüğünüz burada oluşur.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
            <Award className="h-4 w-4 text-gold" />
            <span>Kazanılan Kilometre Taşları & Zorlanılan Kelimeler</span>
          </h2>

          {snapshot.achievements.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {snapshot.achievements.map((ach) => (
                <span
                  key={ach.badgeCode}
                  className="inline-flex items-center gap-1.5 rounded-full bg-gold-soft border border-gold-line px-3 py-1 text-xs font-semibold text-gold-deep"
                >
                  <Award className="h-3.5 w-3.5" />
                  {ach.titleTr}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-muted">
              İlk aktif hatırlama, seviye değerlendirmesi veya ses kaydınızı tamamladığınızda kilometre taşları açılır.
            </p>
          )}

          <div className="pt-3 border-t border-line">
            <p className="text-xs font-semibold text-ink mb-1.5">
              Tekrar Gerektiren Zorlanılan Kelimeler ({difficultWords.length})
            </p>
            {difficultWords.length > 0 ? (
              <div className="flex flex-wrap gap-1.5">
                {difficultWords.map((dw) => (
                  <span
                    key={dw.wordLocation}
                    className="rounded-lg bg-amber-50 border border-amber-200 px-2.5 py-1 font-mono text-xs text-amber-900"
                  >
                    {dw.wordLocation} ({dw.timesMissed} hata)
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted">
                Şu an tekrar tekrar hata yapılan kelime yok.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
