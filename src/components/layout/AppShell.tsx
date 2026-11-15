"use client";

import React, { useEffect, useState, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  BarChart3,
  BookOpen,
  BookOpenText,
  Brain,
  GraduationCap,
  Languages,
  Menu,
  RotateCcw,
  Sunrise,
  UserRound,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { LastStudyTracker } from "@/components/layout/LastStudyTracker";
import { installSharedAudioUnlock } from "@/lib/audio/shared-player";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  /** Other routes that light up this item (e.g. Statistics under "Ben"). */
  alsoActiveOn?: string[];
}

/** Five primary destinations: what the learner opens daily. */
const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Bugün", icon: Sunrise, alsoActiveOn: ["/review"] },
  { href: "/mushaf", label: "Mushaf", icon: BookOpenText },
  { href: "/memorization", label: "Ezber", icon: Brain },
  { href: "/vocabulary", label: "Kelimeler", icon: Languages, alsoActiveOn: ["/learn-arabic"] },
  { href: "/settings", label: "Ben", icon: UserRound, alsoActiveOn: ["/statistics"] },
];

/** Reachable from the sidebar/drawer and from inside the related primary pages. */
const SECONDARY_NAV: NavItem[] = [
  { href: "/learn-arabic", label: "Arapça Dersleri", icon: GraduationCap },
  { href: "/review", label: "Tekrar Kartları", icon: RotateCcw },
  { href: "/statistics", label: "İstatistikler", icon: BarChart3 },
];

function matches(pathname: string, href: string): boolean {
  return href === "/" ? pathname === "/" : pathname === href || pathname.startsWith(`${href}/`);
}

function isActive(pathname: string, item: NavItem, includeRelated: boolean): boolean {
  if (matches(pathname, item.href)) return true;
  return includeRelated && (item.alsoActiveOn ?? []).some((h) => matches(pathname, h));
}

function NavLink({
  item,
  active,
  onClick,
}: {
  item: NavItem;
  active: boolean;
  onClick?: () => void;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={cn(
        "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
        active ? "bg-forest text-parchment shadow-xs" : "text-ink-soft hover:bg-sand-strong hover:text-forest"
      )}
    >
      <Icon className="h-4 w-4 shrink-0" />
      <span>{item.label}</span>
    </Link>
  );
}

function NavGroups({ pathname, onNavigate }: { pathname: string; onNavigate?: () => void }) {
  return (
    <>
      <div className="space-y-1">
        {PRIMARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item, false)} onClick={onNavigate} />
        ))}
      </div>
      <p className="px-3.5 pt-5 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted">
        Diğer
      </p>
      <div className="space-y-1">
        {SECONDARY_NAV.map((item) => (
          <NavLink key={item.href} item={item} active={isActive(pathname, item, false)} onClick={onNavigate} />
        ))}
      </div>
    </>
  );
}

function subscribeOnlineStatus(callback: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener("online", callback);
  window.addEventListener("offline", callback);
  return () => {
    window.removeEventListener("online", callback);
    window.removeEventListener("offline", callback);
  };
}

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const isOffline = useSyncExternalStore(
    subscribeOnlineStatus,
    () => (typeof navigator !== "undefined" ? !navigator.onLine : false),
    () => false
  );

  // First tap anywhere unlocks the shared audio element, so recitation that continues
  // after a pause or timer (listen-and-repeat, loops, warm-up) isn't blocked on phones.
  useEffect(() => {
    installSharedAudioUnlock();
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-parchment text-ink">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-line bg-sidebar">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-line">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-forest text-parchment shadow-xs">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-forest">Quran Journey</p>
            <p className="text-xs text-muted">Kişisel Kur&apos;an Yolculuğu</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 overflow-y-auto" aria-label="Ana gezinme">
          <NavGroups pathname={pathname} />
        </nav>

        <div className="p-4 m-3 rounded-xl bg-parchment border border-line">
          <p className="text-xs font-semibold text-forest">Medine Mushafı · 604 Sayfa</p>
          <p className="mt-1 text-xs text-muted leading-relaxed">
            114 Sure · 6.236 Ayet · 77.429 doğrulanmış kelime ile aktif çalışma.
          </p>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-line bg-parchment/95 backdrop-blur px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-parchment">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-forest">Quran Journey</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Menüyü aç/kapat"
          className="rounded-lg border border-line bg-surface p-2 text-forest"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="w-72 max-w-[85vw] h-full overflow-y-auto bg-sidebar border-r border-line p-4"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-line">
              <span className="text-sm font-bold text-forest">Menü</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1 text-muted"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <nav aria-label="Menü">
              <NavGroups pathname={pathname} onNavigate={() => setMobileMenuOpen(false)} />
            </nav>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 pb-40 lg:pb-24">
        <LastStudyTracker />
        {isOffline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-950 flex items-center justify-center gap-2">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span>
              Çevrimdışı moddasınız. İndirdiğiniz Mushaf sayfalarını ve yerel ses kayıtlarınızı görüntüleyebilirsiniz.
            </span>
          </div>
        )}
        <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8 py-6 sm:py-8">
          {children}
        </div>
      </main>


      {/* Mobile Bottom Quick Nav */}
      <nav
        aria-label="Hızlı alt menü"
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-line bg-parchment/95 backdrop-blur grid grid-cols-5 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]"
      >
        {PRIMARY_NAV.map((item) => {
          const Icon = item.icon;
          const active = isActive(pathname, item, true);
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium",
                active ? "text-forest" : "text-muted"
              )}
            >
              <span
                className={cn(
                  "flex h-7 w-12 items-center justify-center rounded-full transition-colors",
                  active && "bg-mint-strong"
                )}
              >
                <Icon className={cn("h-[18px] w-[18px]", active && "stroke-[2.4]")} />
              </span>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
