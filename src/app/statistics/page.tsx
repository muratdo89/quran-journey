import { Award, BarChart3, BookOpenCheck, Brain, Calendar, Languages } from "lucide-react";
import { getAvailablePages } from "@/lib/content/canonical-loader";
import { getRepository } from "@/lib/db";
import { MEMORIZATION_STATE_LABELS_TR } from "@/lib/learning-engine";

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
        <h1 className="text-2xl font-bold text-[#1c241f]">İstatistikler ve İlerleme</h1>
        <p className="text-sm text-[#5a655e]">
          Yalnızca doğrulanmış aktif hatırlama, okuma tamamlama ve ezber testlerinden üretilen dürüst ölçümler ({totalReviews} tekrar).
        </p>
      </div>

      {/* Top Real Metrics */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {metrics.map((m) => {
          const Icon = m.icon;
          return (
            <div
              key={m.label}
              className="rounded-2xl border border-[#e5dec9] bg-white p-5 space-y-2"
            >
              <div className="flex items-center justify-between text-xs font-medium text-[#5a655e]">
                <span>{m.label}</span>
                <Icon className="h-4 w-4 text-[#1b4332]" />
              </div>
              <p className="text-xl font-bold text-[#1c241f]">{m.value}</p>
            </div>
          );
        })}
      </section>

      {/* 5 Independent Dimensions + Verse Breakdown */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-[#e5dec9] bg-white p-6 space-y-4">
          <h2 className="text-base font-bold text-[#1c241f]">
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
                  <span className="font-mono text-[#1b4332]">%{item.val}</span>
                </div>
                <div className="h-2 rounded-full bg-[#efeae0] overflow-hidden">
                  <div
                    className="h-full rounded-full bg-[#1b4332]"
                    style={{ width: `${Math.max(2, item.val)}%` }}
                  />
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-2xl border border-[#e5dec9] bg-white p-6 space-y-4">
          <h2 className="text-base font-bold text-[#1c241f]">
            Ayet ve Sayfa Bazlı Hıfz Dağılımı ({snapshot.verseProgress.length} Ayet)
          </h2>
          <div className="space-y-2 max-h-72 overflow-y-auto pr-1">
            {snapshot.verseProgress.map((vp) => (
              <div
                key={vp.verseKey}
                className="flex items-center justify-between rounded-xl border border-[#e5dec9] bg-[#faf8f3] px-3.5 py-2.5 text-xs"
              >
                <span className="font-mono font-bold text-[#1b4332]">{vp.verseKey}</span>
                <span className="font-medium text-[#1c241f]">
                  {MEMORIZATION_STATE_LABELS_TR[vp.memorizationState]}
                </span>
                <span className="text-[#5a655e]">
                  Kavrama: %{vp.comprehensionScore}
                </span>
              </div>
            ))}
          </div>
          {snapshot.pageProgress.length > 0 && (
            <div className="pt-3 border-t border-[#e5dec9]">
              <p className="text-xs font-semibold text-[#1c241f] mb-1.5">
                Çalışılan Mushaf Sayfaları ({snapshot.pageProgress.length}/{totalAvailablePages})
              </p>
              <div className="flex flex-wrap gap-1.5">
                {snapshot.pageProgress.map((pp) => (
                  <span
                    key={pp.pageNumber}
                    className="rounded-lg bg-[#edf5f0] border border-[#2d6a4f]/25 px-2.5 py-1 text-[11px] font-semibold text-[#1b4332]"
                  >
                    Sayfa {pp.pageNumber} ({pp.memorizedVersesCount}/{pp.studiedVersesCount} ezber)
                  </span>
                ))}
              </div>
            </div>
          )}
        </section>
      </div>

      {/* Activity History & Achievements */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="rounded-2xl border border-[#e5dec9] bg-white p-6 space-y-4">
          <h2 className="text-base font-bold text-[#1c241f] flex items-center gap-2">
            <Calendar className="h-4 w-4 text-[#1b4332]" />
            <span>Son Çalışma Günlüğü</span>
          </h2>
          {snapshot.activityHistory.length > 0 ? (
            <div className="space-y-2">
              {snapshot.activityHistory.slice(0, 10).map((day) => (
                <div
                  key={day.activityDate}
                  className="flex items-center justify-between rounded-xl bg-[#faf8f3] border border-[#e5dec9] px-3.5 py-2 text-xs"
                >
                  <span className="font-mono font-semibold">{day.activityDate}</span>
                  <span>{day.minutesStudied} dk</span>
                  <span>{day.reviewsCompleted} tekrar</span>
                  <span className="font-semibold text-[#1b4332]">+{day.xpEarned} XP</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#5a655e]">
              Henüz kayıtlı çalışma oturumu yok. Tekrar veya ezber oturumu tamamladığınızda gerçek çalışma günlüğünüz burada oluşur.
            </p>
          )}
        </section>

        <section className="rounded-2xl border border-[#e5dec9] bg-white p-6 space-y-4">
          <h2 className="text-base font-bold text-[#1c241f] flex items-center gap-2">
            <Award className="h-4 w-4 text-[#b08d57]" />
            <span>Kazanılan Kilometre Taşları & Zorlanılan Kelimeler</span>
          </h2>

          {snapshot.achievements.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {snapshot.achievements.map((ach) => (
                <span
                  key={ach.badgeCode}
                  className="inline-flex items-center gap-1.5 rounded-full bg-[#f7f1e3] border border-[#e3d2ae] px-3 py-1 text-xs font-semibold text-[#6e511e]"
                >
                  <Award className="h-3.5 w-3.5" />
                  {ach.titleTr}
                </span>
              ))}
            </div>
          ) : (
            <p className="text-xs text-[#5a655e]">
              İlk aktif hatırlama, seviye değerlendirmesi veya ses kaydınızı tamamladığınızda kilometre taşları açılır.
            </p>
          )}

          <div className="pt-3 border-t border-[#e5dec9]">
            <p className="text-xs font-semibold text-[#1c241f] mb-1.5">
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
              <p className="text-xs text-[#5a655e]">
                Şu an tekrar tekrar hata yapılan kelime yok.
              </p>
            )}
          </div>
        </section>
      </div>
    </div>
  );
}
