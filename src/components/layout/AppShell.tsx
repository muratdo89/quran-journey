"use client";

import React, { useEffect, useSyncExternalStore } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BookOpen, BookOpenText, ChartNoAxesColumn, ChevronDown, Sunrise, WifiOff } from "lucide-react";
import { TOOLS } from "@/components/layout/tools";
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

/**
 * Three destinations, built around page-by-page hifz: today's work, the Mushaf, and progress.
 * Everything else (settings, word study, Arabic lessons…) is reached from the İlerleme page.
 */
const PRIMARY_NAV: NavItem[] = [
  { href: "/", label: "Bugün", icon: Sunrise, alsoActiveOn: ["/hoca", "/hifz", "/review", "/warmup"] },
  { href: "/mushaf", label: "Mushaf", icon: BookOpenText },
  {
    href: "/ilerleme",
    label: "İlerleme",
    icon: ChartNoAxesColumn,
    alsoActiveOn: ["/settings", "/statistics", "/memorization", "/vocabulary", "/learn-arabic"],
  },
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
}: {
  item: NavItem;
  active: boolean;
}) {
  const Icon = item.icon;
  return (
    <Link
      href={item.href}
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

const TOOLS_OPEN_KEY = "qj.sidebar.toolsOpen";
const toolsOpenListeners = new Set<() => void>();

function readToolsOpen(): boolean {
  try {
    return window.localStorage.getItem(TOOLS_OPEN_KEY) === "1";
  } catch {
    return false;
  }
}

function writeToolsOpen(value: boolean) {
  try {
    window.localStorage.setItem(TOOLS_OPEN_KEY, value ? "1" : "0");
  } catch {}
  toolsOpenListeners.forEach((l) => l());
}

function subscribeToolsOpen(callback: () => void): () => void {
  toolsOpenListeners.add(callback);
  return () => toolsOpenListeners.delete(callback);
}

function NavGroups({ pathname }: { pathname: string }) {
  // A tool page lights up its own row in the sidebar, not Bugün/Mushaf/İlerleme.
  const activeTool = TOOLS.find((t) => matches(pathname, t.href));
  // Collapsed by default so the three main items stay the focus; remembered per device.
  const toolsOpen = useSyncExternalStore(subscribeToolsOpen, readToolsOpen, () => false);
  const open = toolsOpen || Boolean(activeTool);

  function toggle() {
    writeToolsOpen(!open);
  }

  return (
    <div className="space-y-1">
      {PRIMARY_NAV.map((item) => (
        <NavLink key={item.href} item={item} active={!activeTool && isActive(pathname, item, true)} />
      ))}

      <div className="pt-5">
        <div className="mx-3 mb-2 border-t border-line" />
        <button
          type="button"
          onClick={toggle}
          aria-expanded={open}
          aria-controls="sidebar-tools"
          className="flex w-full items-center justify-between rounded-lg px-3.5 py-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-muted hover:text-forest"
        >
          <span>Diğer araçlar</span>
          <ChevronDown className={cn("h-3.5 w-3.5 transition-transform", open && "rotate-180")} />
        </button>
        {open && (
          <ul id="sidebar-tools" className="mt-1 space-y-0.5">
            {TOOLS.map((t) => {
              const Icon = t.icon;
              const active = activeTool?.href === t.href;
              return (
                <li key={t.href}>
                  <Link
                    href={t.href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-2.5 rounded-lg px-3.5 py-1.5 text-[13px] transition-colors",
                      active ? "bg-mint-strong font-medium text-forest" : "text-muted hover:bg-sand-strong hover:text-forest"
                    )}
                  >
                    <Icon className="h-3.5 w-3.5 shrink-0" />
                    <span className="truncate">{t.label}</span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
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
  // The hifz and voice teacher sessions are focus screens: no phone header or bottom menu.
  const focusMode = pathname === "/hifz" || pathname === "/hoca";
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
      <header className={cn("sticky top-0 z-30 flex items-center justify-between border-b border-line bg-parchment/95 backdrop-blur px-4 py-3", focusMode ? "hidden" : "lg:hidden")}>
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-forest text-parchment">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-forest">Quran Journey</span>
        </Link>
      </header>

      {/* Main Content */}
      <main className={cn("flex-1 lg:pl-64", focusMode ? "pb-0" : "pb-40 lg:pb-24")}>
        <LastStudyTracker />
        {isOffline && (
          <div className="bg-amber-50 border-b border-amber-200 px-4 py-2 text-xs text-amber-950 flex items-center justify-center gap-2">
            <WifiOff className="h-3.5 w-3.5 shrink-0" />
            <span>
              Çevrimdışı moddasınız. İndirdiğiniz Mushaf sayfalarını ve yerel ses kayıtlarınızı görüntüleyebilirsiniz.
            </span>
          </div>
        )}
        <div className={cn("mx-auto max-w-6xl px-4 sm:px-6 lg:px-8", focusMode ? "pb-6" : "py-6 sm:py-8")}>
          {children}
        </div>
      </main>


      {/* Mobile Bottom Quick Nav */}
      <nav
        aria-label="Hızlı alt menü"
        className={cn("fixed bottom-0 inset-x-0 z-30 border-t border-line bg-parchment/95 backdrop-blur grid grid-cols-3 pt-1.5 pb-[calc(0.375rem+env(safe-area-inset-bottom))]", focusMode ? "hidden" : "lg:hidden")}
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
