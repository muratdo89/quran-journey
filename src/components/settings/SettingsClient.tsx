"use client";

import React, { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import {
  Activity,
  Bell,
  Check,
  Cloud,
  Database,
  Download,
  LogIn,
  LogOut,
  ShieldCheck,
  UserPlus,
} from "lucide-react";
import type { ContentManifest } from "@/lib/content/types";
import type {
  BackendConfigurationStatus,
  LearningGoalRecord,
  UserPreferencesRecord,
  UserProfileRecord,
} from "@/lib/db/types";
import { PageHeader } from "@/components/ui/PageHeader";

interface SettingsClientProps {
  profile: UserProfileRecord;
  preferences: UserPreferencesRecord;
  goals: LearningGoalRecord;
  backendStatus: BackendConfigurationStatus;
  manifest: ContentManifest;
}

interface HealthCheckReport {
  ok: boolean;
  timestamp: string;
  canonicalCorpus: {
    totalSurahs: number;
    totalPages: number;
    totalVerses: number;
    totalWords: number;
    quranMetaSha256: string | null;
  };
  backend: BackendConfigurationStatus;
  deploymentReady: {
    localSqliteReady: boolean;
    supabaseSqlFilesReady: boolean;
    supabaseConfigured: boolean;
    asrProviderConfigured: boolean;
  };
}

const REMINDER_EVENT = "qj-reminder-change";

function subscribeReminderStore(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("storage", callback);
  window.addEventListener(REMINDER_EVENT, callback);
  return () => {
    window.removeEventListener("storage", callback);
    window.removeEventListener(REMINDER_EVENT, callback);
  };
}

export function SettingsClient({
  profile,
  preferences,
  goals,
  backendStatus,
  manifest,
}: SettingsClientProps) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(profile.displayName);
  const [dailyMinutes, setDailyMinutes] = useState(goals.dailyTargetMinutes);
  const [cloudConsent, setCloudConsent] = useState(preferences.cloudAiAudioConsent);
  const [saving, setSaving] = useState(false);
  const [savedMsg, setSavedMsg] = useState(false);

  // Gentle local notification reminder state (SSR-safe via useSyncExternalStore)
  const reminderEnabled = useSyncExternalStore(
    subscribeReminderStore,
    () => (typeof window !== "undefined" ? localStorage.getItem("qj_reminder_enabled") === "1" : false),
    () => false
  );
  const reminderTime = useSyncExternalStore(
    subscribeReminderStore,
    () => (typeof window !== "undefined" ? localStorage.getItem("qj_reminder_time") ?? "21:00" : "21:00"),
    () => "21:00"
  );
  const [reminderStatusTr, setReminderStatusTr] = useState<string | null>(null);

  // Supabase Auth states
  const [authMode, setAuthMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authLoading, setAuthLoading] = useState(false);
  const [authMessage, setAuthMessage] = useState<{ type: "ok" | "err"; text: string } | null>(
    null
  );

  // Health check & backup export states
  const [healthChecking, setHealthChecking] = useState(false);
  const [healthReport, setHealthReport] = useState<HealthCheckReport | null>(null);
  const [healthError, setHealthError] = useState<string | null>(null);
  const [exportingBackup, setExportingBackup] = useState(false);
  const [exportStatusTr, setExportStatusTr] = useState<string | null>(null);

  async function toggleReminder(nextEnabled: boolean) {
    setReminderStatusTr(null);
    if (nextEnabled) {
      if (typeof Notification === "undefined") {
        setReminderStatusTr("Bu tarayıcı bildirim API'sini desteklemiyor.");
        return;
      }
      const perm = await Notification.requestPermission();
      if (perm !== "granted") {
        setReminderStatusTr(
          "Bildirim izni verilmedi. Tarayıcı ayarlarından bildirimlere izin verebilirsiniz."
        );
        return;
      }
      localStorage.setItem("qj_reminder_enabled", "1");
      localStorage.setItem("qj_reminder_time", reminderTime);
      window.dispatchEvent(new Event(REMINDER_EVENT));
      setReminderStatusTr(
        `Nazik hatırlatıcı ${reminderTime} için etkinleştirildi (uygulama açıkken tarayıcı bildirimi gösterir).`
      );
      new Notification("Quran Journey", {
        body: `Günlük Kur'an hatırlatıcısı (${reminderTime}) hazır. Başarı istikrarla gelir.`,
      });
    } else {
      localStorage.setItem("qj_reminder_enabled", "0");
      window.dispatchEvent(new Event(REMINDER_EVENT));
      setReminderStatusTr("Tarayıcı hatırlatıcısı kapatıldı.");
    }
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setSavedMsg(false);
    try {
      const res = await fetch("/api/preferences", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          displayName,
          dailyTargetMinutes: dailyMinutes,
          cloudAiAudioConsent: cloudConsent,
        }),
      });
      if (res.ok) setSavedMsg(true);
    } finally {
      setSaving(false);
    }
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          action: authMode,
          email,
          password,
        }),
      });
      const data = await res.json();
      if (!res.ok) {
        setAuthMessage({ type: "err", text: data.error ?? "İşlem başarısız oldu." });
        return;
      }
      if (data.needsEmailVerification) {
        setAuthMessage({ type: "ok", text: data.messageTr });
        return;
      }
      setAuthMessage({
        type: "ok",
        text: "Supabase oturumu açıldı! Verileriniz artık PostgreSQL üzerinde saklanıyor.",
      });
      router.refresh();
    } catch {
      setAuthMessage({ type: "err", text: "Bağlantı hatası oluştu." });
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleSignOut() {
    setAuthLoading(true);
    setAuthMessage(null);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signout" }),
      });
      router.refresh();
    } finally {
      setAuthLoading(false);
    }
  }

  async function handleHealthCheck() {
    setHealthChecking(true);
    setHealthError(null);
    try {
      const res = await fetch("/api/health", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const data = (await res.json()) as HealthCheckReport;
      setHealthReport(data);
    } catch {
      setHealthError("Sistem sağlık kontrolü alınamadı.");
    } finally {
      setHealthChecking(false);
    }
  }

  async function handleExportBackup() {
    setExportingBackup(true);
    setExportStatusTr(null);
    try {
      const res = await fetch("/api/state", { cache: "no-store" });
      if (!res.ok) {
        throw new Error(`HTTP ${res.status}`);
      }
      const stateData = (await res.json()) as {
        snapshot: {
          profile: UserProfileRecord;
          goals: LearningGoalRecord;
          pillarScores: Record<string, number>;
          verseProgress: Array<{ verseKey: string; memorizationState: string }>;
          pageProgress: Array<{ pageNumber: number }>;
          notes: Array<{ verseKey: string; isDifficult: boolean; noteText: string }>;
          bookmarks: Array<{ verseKey: string }>;
          cards: unknown[];
          recordings: unknown[];
        };
        dueCardsCount: number;
      };

      const difficultVerses = stateData.snapshot.notes.filter((n) => n.isDifficult);
      const exportPayload = {
        exportedAt: new Date().toISOString(),
        version: "1.0",
        app: "Quran Journey",
        teacherReviewSummary: {
          learnerName: stateData.snapshot.profile.displayName,
          currentPageNumber: stateData.snapshot.profile.currentPageNumber,
          pillarScores: stateData.snapshot.pillarScores,
          memorizationTrackedCount: stateData.snapshot.verseProgress.length,
          difficultVerses,
          notes: stateData.snapshot.notes,
        },
        snapshot: stateData.snapshot,
      };

      const blob = new Blob([JSON.stringify(exportPayload, null, 2)], {
        type: "application/json;charset=utf-8",
      });
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "quran-journey-yedek.json";
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);

      setExportStatusTr(
        `Yedek indirildi (${stateData.snapshot.verseProgress.length} ayet ilerlemesi, ${stateData.snapshot.notes.length} not, ${stateData.snapshot.cards.length} FSRS kartı).`
      );
    } catch {
      setExportStatusTr("Çalışma yedeği hazırlanırken hata oluştu.");
    } finally {
      setExportingBackup(false);
    }
  }

  const persistenceLabel =
    backendStatus.activePersistence === "supabase_postgres"
      ? `Supabase PostgreSQL (${backendStatus.supabaseAuthenticatedUserEmail ?? "Aktif"})`
      : backendStatus.activePersistence === "sqlite_ephemeral_tmp"
        ? `Geçici Sunucu SQLite (${backendStatus.sqlitePath})`
        : `Yerel SQLite (${backendStatus.sqlitePath})`;

  return (
    <div className="space-y-6">
      <div>
        <PageHeader
          eyebrow="Ben"
          title="Profil ve Ayarlar"
          description={<>Kişisel öğrenme hedefleri, Supabase bulut oturumu, nazik hatırlatıcı ve doğrulanmış kaynak lisansları.</>}
          related={[{ href: "/statistics", label: "İstatistikler" }]}
        />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Profile & Preferences Form */}
        <form
          onSubmit={handleSave}
          className="lg:col-span-6 rounded-2xl border border-line bg-surface p-6 space-y-4"
        >
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink">Kişisel Tercihler</h2>

          <label className="block space-y-1.5 text-xs">
            <span className="font-semibold text-ink">Hitap Edilecek İsim</span>
            <input
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full rounded-xl border border-line bg-parchment px-3.5 py-2.5 text-sm"
            />
          </label>

          <label className="block space-y-1.5 text-xs">
            <span className="font-semibold text-ink">
              Günlük Hedef Süre ({dailyMinutes} dakika)
            </span>
            <input
              type="range"
              min={5}
              max={60}
              step={5}
              value={dailyMinutes}
              onChange={(e) => setDailyMinutes(Number(e.target.value))}
              className="w-full accent-forest"
            />
          </label>

          <label className="flex items-start gap-2.5 rounded-xl border border-line bg-parchment p-3.5 text-xs cursor-pointer">
            <input
              type="checkbox"
              checked={cloudConsent}
              onChange={(e) => setCloudConsent(e.target.checked)}
              className="mt-0.5 accent-forest"
            />
            <span className="text-ink-soft leading-relaxed">
              Yapılandırılmış sunucu tarafı Kur&apos;an ASR kelime sırası kontrolü için ses kayıtlarımın açık onayımla gönderilmesine izin veriyorum (kapalıyken hiçbir ses dosyası harici servise aktarılmaz).
            </span>
          </label>

          {/* Gentle Browser Reminder */}
          <div className="rounded-xl border border-line bg-parchment p-3.5 space-y-2.5 text-xs">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-semibold text-ink flex items-center gap-1.5">
                <Bell className="h-3.5 w-3.5 text-forest" />
                <span>Nazik Çalışma Hatırlatıcısı</span>
              </span>
              <div className="flex items-center gap-2">
                <input
                  type="time"
                  aria-label="Hatırlatma saati"
                  value={reminderTime}
                  onChange={(e) => {
                    if (typeof window !== "undefined") {
                      localStorage.setItem("qj_reminder_time", e.target.value);
                      window.dispatchEvent(new Event(REMINDER_EVENT));
                    }
                  }}
                  className="rounded-lg border border-line bg-surface px-2 py-1 text-xs"
                />
                <button
                  type="button"
                  onClick={() => toggleReminder(!reminderEnabled)}
                  className={
                    reminderEnabled
                      ? "rounded-lg bg-forest px-3 py-1 font-semibold text-white"
                      : "rounded-lg border border-forest bg-surface px-3 py-1 font-semibold text-forest"
                  }
                >
                  {reminderEnabled ? "Açık" : "Etkinleştir"}
                </button>
              </div>
            </div>
            {reminderStatusTr && <p className="text-[11px] text-emerald">{reminderStatusTr}</p>}
          </div>

          <div className="flex items-center gap-3">
            <button
              type="submit"
              disabled={saving}
              className="rounded-xl bg-forest px-5 py-2.5 text-xs font-semibold text-white hover:bg-forest-deep"
            >
              {saving ? "Kaydediliyor..." : "Ayarları Kaydet"}
            </button>
            {savedMsg && (
              <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald">
                <Check className="h-3.5 w-3.5" />
                Kaydedildi
              </span>
            )}
          </div>
        </form>

        {/* Backend & Integration Status */}
        <section className="lg:col-span-6 rounded-2xl border border-line bg-surface p-6 space-y-4">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
            <Database className="h-4 w-4 text-forest" />
            <span>Veritabanı ve Entegrasyon Durumu</span>
          </h2>

          <div className="space-y-2.5 text-xs">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1 rounded-xl border border-line bg-parchment p-3">
              <span className="font-semibold">Aktif Kalıcı Depolama</span>
              <span
                className={
                  backendStatus.activePersistence === "sqlite_ephemeral_tmp"
                    ? "rounded-full bg-amber-100 px-2.5 py-0.5 font-semibold text-amber-900"
                    : "rounded-full bg-mint px-2.5 py-0.5 font-semibold text-forest"
                }
              >
                {persistenceLabel}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-line bg-parchment p-3">
              <span className="font-semibold">Supabase PostgreSQL &amp; Auth</span>
              <span
                className={
                  backendStatus.supabaseConfigured
                    ? "rounded-full bg-mint px-2.5 py-0.5 font-semibold text-forest"
                    : "rounded-full bg-gold-soft px-2.5 py-0.5 font-semibold text-gold-ink"
                }
              >
                {backendStatus.supabaseConfigured
                  ? backendStatus.supabaseAuthenticatedUserEmail
                    ? "Bağlı (Oturum Açık)"
                    : "Yapılandırıldı (Giriş Bekliyor)"
                  : "Ortam Değişkeni Bekliyor"}
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-line bg-parchment p-3">
              <span className="font-semibold">Doğrulanmış Mushaf Kapsamı</span>
              <span className="rounded-full bg-mint px-2.5 py-0.5 font-semibold text-forest">
                Tam Kur&apos;an (114 Sure · 604 Sayfa · 6.236 Ayet)
              </span>
            </div>

            <div className="flex items-center justify-between rounded-xl border border-line bg-parchment p-3">
              <span className="font-semibold">Kur&apos;an ASR / Kelime Sırası Kontrolü</span>
              <span
                className={
                  backendStatus.asrProviderConfigured
                    ? "rounded-full bg-mint px-2.5 py-0.5 font-semibold text-forest"
                    : "rounded-full bg-gold-soft px-2.5 py-0.5 font-semibold text-gold-ink"
                }
              >
                {backendStatus.asrProviderConfigured
                  ? "Harici ASR Bağlı (İnsan teyidi gerekir)"
                  : "Yalnızca Yerel Karşılaştırma"}
              </span>
            </div>
          </div>

          {backendStatus.activePersistence === "sqlite_ephemeral_tmp" && (
            <div className="rounded-xl border border-amber-200 bg-amber-50 p-3 text-[11px] text-amber-950 leading-relaxed">
              <strong>Önemli:</strong> Sunucusuz (ör. Vercel) ortamda yerel dosya sistemi salt okunur olduğu için geçici <code className="font-mono">/tmp</code> veritabanı çalışır. Telefon ve masaüstü kalıcılığı için aşağıdaki Supabase hesabıyla giriş yapın.
            </div>
          )}

          <div className="pt-2 border-t border-line space-y-2.5">
            <button
              type="button"
              disabled={healthChecking}
              onClick={handleHealthCheck}
              className="inline-flex items-center gap-2 rounded-xl border border-forest bg-mint px-4 py-2 text-xs font-semibold text-forest hover:bg-mint-strong disabled:opacity-60"
            >
              <Activity className="h-3.5 w-3.5" />
              <span>
                {healthChecking
                  ? "Doğrulanıyor..."
                  : "Bağlantı ve Sistem Sağlığını Doğrula (/api/health)"}
              </span>
            </button>

            {healthError && (
              <p className="text-xs font-semibold text-red-700">{healthError}</p>
            )}

            {healthReport && (
              <div className="rounded-xl border border-emerald/30 bg-mint p-3 text-[11px] text-forest space-y-1">
                <p className="font-bold">
                  Sistem Sağlığı: {healthReport.ok ? "Çalışır ve Doğrulandı" : "Sorun Bildirildi"}
                </p>
                <p>
                  Kanonik Veri: {healthReport.canonicalCorpus.totalSurahs} Sure ·{" "}
                  {healthReport.canonicalCorpus.totalPages} Sayfa ·{" "}
                  {healthReport.canonicalCorpus.totalVerses} Ayet ·{" "}
                  {healthReport.canonicalCorpus.totalWords} Kelime
                </p>
                <p>
                  Depolama: {healthReport.backend.activePersistence} · Supabase SQL Hazır:{" "}
                  {healthReport.deploymentReady.supabaseSqlFilesReady ? "Evet" : "Hayır"} · ASR:{" "}
                  {healthReport.deploymentReady.asrProviderConfigured ? "Yapılandırıldı" : "Yerel Mod"}
                </p>
              </div>
            )}
          </div>
        </section>
      </div>

      {/* Supabase Cloud Account Sync Section */}
      <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
              <Cloud className="h-4 w-4 text-forest" />
              <span>Supabase Bulut Senkronizasyonu (Telefon &amp; Masaüstü)</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              İlerlemenizi kişisel Supabase PostgreSQL veritabanınızda güvenle tutar.
            </p>
          </div>
        </div>

        {!backendStatus.supabaseConfigured ? (
          <div className="rounded-xl border border-line bg-parchment p-4 text-xs text-ink-soft space-y-2 leading-relaxed">
            <p className="font-semibold text-ink">
              Bilgisayarsız (Telefon Tarayıcısından) 2 Adımlı Bulut Kurulumu:
            </p>
            <ol className="list-decimal list-inside space-y-1">
              <li>
                <strong>Supabase</strong> SQL Editor içinde tek dosya olan{" "}
                <code className="font-mono font-bold">supabase/setup_all.sql</code> içeriğini yapıştırıp{" "}
                <strong>Run</strong> tuşuna basın (tüm tablolar ve güvenlik kuralları tek seferde kurulur).
              </li>
              <li>
                Supabase <em>Settings → API</em> kısmından <strong>Project URL</strong> ve{" "}
                <strong>anon public key</strong> değerlerini kopyalayın.
              </li>
              <li>
                <strong>Vercel</strong>&apos;de projeyi açıp <code className="font-mono">NEXT_PUBLIC_SUPABASE_URL</code> ve{" "}
                <code className="font-mono">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> değişkenlerini ekleyerek yayınlayın.
              </li>
            </ol>
          </div>
        ) : backendStatus.supabaseAuthenticatedUserEmail ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-emerald/30 bg-mint p-4 text-xs">
            <div>
              <p className="font-bold text-forest">
                Bulut Hesabı Aktif: {backendStatus.supabaseAuthenticatedUserEmail}
              </p>
              <p className="text-ink-soft mt-0.5">
                Tüm kelime kartlarınız, FSRS aralıkları, ezber durumları ve ayet notları PostgreSQL üzerine yazılıyor.
              </p>
            </div>
            <button
              type="button"
              disabled={authLoading}
              onClick={handleSignOut}
              className="inline-flex items-center gap-1.5 rounded-xl border border-forest bg-surface px-4 py-2 font-semibold text-forest hover:bg-parchment shrink-0"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span>Oturumu Kapat</span>
            </button>
          </div>
        ) : (
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => setAuthMode("signin")}
                className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                  authMode === "signin"
                    ? "bg-forest text-white"
                    : "border border-line bg-parchment text-ink"
                }`}
              >
                Giriş Yap
              </button>
              <button
                type="button"
                onClick={() => setAuthMode("signup")}
                className={`rounded-xl px-4 py-2 text-xs font-semibold ${
                  authMode === "signup"
                    ? "bg-forest text-white"
                    : "border border-line bg-parchment text-ink"
                }`}
              >
                Yeni Hesap Oluştur
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="E-posta adresiniz"
                className="rounded-xl border border-line bg-parchment px-3.5 py-2.5 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parola (en az 6 karakter)"
                className="rounded-xl border border-line bg-parchment px-3.5 py-2.5 text-sm"
              />
            </div>

            <button
              type="submit"
              disabled={authLoading}
              className="inline-flex items-center gap-2 rounded-xl bg-forest px-5 py-2.5 text-xs font-semibold text-white hover:bg-forest-deep disabled:opacity-50"
            >
              {authMode === "signin" ? (
                <LogIn className="h-3.5 w-3.5" />
              ) : (
                <UserPlus className="h-3.5 w-3.5" />
              )}
              <span>
                {authLoading
                  ? "Bağlanılıyor..."
                  : authMode === "signin"
                    ? "Supabase ile Giriş Yap"
                    : "Hesap Oluştur ve Bağla"}
              </span>
            </button>

            {authMessage && (
              <p
                className={`text-xs font-semibold ${
                  authMessage.type === "ok" ? "text-emerald" : "text-red-700"
                }`}
              >
                {authMessage.text}
              </p>
            )}
          </form>
        )}
      </section>

      {/* Study Backup & Teacher Summary Export Section */}
      <section className="rounded-2xl border border-line bg-surface p-6 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
              <Download className="h-4 w-4 text-forest" />
              <span>Çalışma Yedeği ve Hoca İnceleme Özeti Dışa Aktarma</span>
            </h2>
            <p className="text-xs text-muted mt-0.5">
              Tüm ezber durumlarınızı, zor işaretli ayetlerinizi, FSRS kart özetinizi ve ayet notlarınızı JSON yedeği olarak indirin.
            </p>
          </div>
          <button
            type="button"
            disabled={exportingBackup}
            onClick={handleExportBackup}
            className="inline-flex items-center gap-2 rounded-xl bg-forest px-4 py-2.5 text-xs font-semibold text-white hover:bg-forest-deep disabled:opacity-60 shrink-0"
          >
            <Download className="h-3.5 w-3.5" />
            <span>{exportingBackup ? "Hazırlanıyor..." : "Yedek ve Özeti İndir (.json)"}</span>
          </button>
        </div>
        {exportStatusTr && (
          <p className="text-xs font-semibold text-emerald flex items-center gap-1.5">
            <Check className="h-3.5 w-3.5" />
            <span>{exportStatusTr}</span>
          </p>
        )}
      </section>

      {/* Verified Source & Licensing Manifest */}
      <section className="rounded-2xl border border-line bg-surface p-6 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <h2 className="font-display text-lg font-semibold tracking-tight text-ink flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-forest" />
            <span>Doğrulanmış İçerik Kaynakları ve Lisans Bildirimi</span>
          </h2>
          <span className="font-mono text-[11px] text-muted">
            Tam Kur&apos;an Meta SHA-256:{" "}
            {manifest.datasets["quran-meta"]?.sha256.slice(0, 16) ??
              manifest.datasets["surah-1-fatiha"]?.sha256.slice(0, 16)}
            ...
          </span>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {manifest.sources.map((src) => (
            <article
              key={src.id}
              className="rounded-xl border border-line bg-parchment p-4 space-y-2 text-xs"
            >
              <p className="font-bold text-forest">{src.provider}</p>
              <p className="font-medium text-ink">{src.resource}</p>
              <p className="text-[11px] text-muted">
                <strong>Lisans:</strong> {src.license}
              </p>
              <p className="text-[11px] text-muted">
                <strong>Kısıtlama:</strong> {src.usageRestrictions}
              </p>
              <p className="text-[11px] text-muted break-all">
                <strong>Kaynak:</strong> {src.url}
              </p>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}
