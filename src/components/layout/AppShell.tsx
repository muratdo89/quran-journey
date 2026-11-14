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
  LayoutDashboard,
  Languages,
  Menu,
  RotateCcw,
  Settings,
  WifiOff,
  X,
} from "lucide-react";
import { cn } from "@/lib/utils";

interface NavItem {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ITEMS: NavItem[] = [
  { href: "/", label: "Panel", icon: LayoutDashboard },
  { href: "/learn-arabic", label: "Arapça Öğren", icon: GraduationCap },
  { href: "/mushaf", label: "Mushaf", icon: BookOpenText },
  { href: "/vocabulary", label: "Kelime Hazinesi", icon: Languages },
  { href: "/memorization", label: "Ezber", icon: Brain },
  { href: "/review", label: "Tekrar", icon: RotateCcw },
  { href: "/statistics", label: "İstatistikler", icon: BarChart3 },
  { href: "/settings", label: "Profil ve Ayarlar", icon: Settings },
];

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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if ("serviceWorker" in navigator) {
      navigator.serviceWorker.register("/sw.js").catch(() => {});
    }
  }, []);

  return (
    <div className="min-h-screen flex flex-col lg:flex-row bg-[#faf8f3] text-[#1c241f]">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex lg:w-64 lg:flex-col lg:fixed lg:inset-y-0 border-r border-[#e5dec9] bg-[#f6f2e9]">
        <div className="flex items-center gap-3 px-6 py-5 border-b border-[#e5dec9]">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[#1b4332] text-[#faf8f3] shadow-xs">
            <BookOpen className="h-5 w-5" />
          </div>
          <div>
            <p className="text-sm font-bold tracking-tight text-[#1b4332]">Quran Journey</p>
            <p className="text-xs text-[#5a655e]">Kişisel Kur&apos;an Yolculuğu</p>
          </div>
        </div>

        <nav className="flex-1 px-3 py-5 space-y-1 overflow-y-auto" aria-label="Ana gezinme">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active =
              item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium transition-colors",
                  active
                    ? "bg-[#1b4332] text-[#faf8f3] shadow-xs"
                    : "text-[#3f4a43] hover:bg-[#ebe4d3] hover:text-[#1b4332]"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="p-4 m-3 rounded-xl bg-[#faf8f3] border border-[#e5dec9]">
          <p className="text-xs font-semibold text-[#1b4332]">Medine Mushafı · 604 Sayfa</p>
          <p className="mt-1 text-xs text-[#5a655e] leading-relaxed">
            114 Sure · 6.236 Ayet · 77.429 doğrulanmış kelime ile aktif çalışma.
          </p>
        </div>
      </aside>

      {/* Mobile Top Bar */}
      <header className="lg:hidden sticky top-0 z-30 flex items-center justify-between border-b border-[#e5dec9] bg-[#faf8f3]/95 backdrop-blur px-4 py-3">
        <Link href="/" className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[#1b4332] text-[#faf8f3]">
            <BookOpen className="h-4 w-4" />
          </div>
          <span className="text-sm font-bold text-[#1b4332]">Quran Journey</span>
        </Link>
        <button
          type="button"
          onClick={() => setMobileMenuOpen((v) => !v)}
          aria-label="Menüyü aç/kapat"
          className="rounded-lg border border-[#e5dec9] bg-white p-2 text-[#1b4332]"
        >
          {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
        </button>
      </header>

      {/* Mobile Drawer */}
      {mobileMenuOpen && (
        <div className="lg:hidden fixed inset-0 z-40 bg-black/30" onClick={() => setMobileMenuOpen(false)}>
          <div
            className="w-72 max-w-[85vw] h-full bg-[#f6f2e9] border-r border-[#e5dec9] p-4 space-y-1"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-[#e5dec9]">
              <span className="text-sm font-bold text-[#1b4332]">Menü</span>
              <button
                type="button"
                onClick={() => setMobileMenuOpen(false)}
                className="rounded-lg p-1 text-[#5a655e]"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {NAV_ITEMS.map((item) => {
              const Icon = item.icon;
              const active =
                item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className={cn(
                    "flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-sm font-medium",
                    active
                      ? "bg-[#1b4332] text-[#faf8f3]"
                      : "text-[#3f4a43] hover:bg-[#ebe4d3]"
                  )}
                >
                  <Icon className="h-4 w-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 lg:pl-64 pb-20 lg:pb-10">
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
        className="lg:hidden fixed bottom-0 inset-x-0 z-30 border-t border-[#e5dec9] bg-[#faf8f3]/95 backdrop-blur grid grid-cols-5 py-1.5"
      >
        {[
          NAV_ITEMS[0],
          NAV_ITEMS[2],
          NAV_ITEMS[3],
          NAV_ITEMS[4],
          NAV_ITEMS[5],
        ].map((item) => {
          const Icon = item.icon;
          const active =
            item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
          return (
            <Link
              key={item.href}
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-0.5 py-1 text-[11px] font-medium",
                active ? "text-[#1b4332]" : "text-[#5a655e]"
              )}
            >
              <Icon className={cn("h-4 w-4", active && "stroke-[2.5]")} />
              <span className="truncate max-w-[68px]">{item.label.split(" ")[0]}</span>
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
