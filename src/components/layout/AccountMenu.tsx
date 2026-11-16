"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogIn, LogOut, UserRound } from "lucide-react";
import { cn } from "@/lib/utils";

interface AccountMenuProps {
  /** Signed-in Supabase user's e-mail, or null when nobody is signed in. */
  email: string | null;
  /** Whether Supabase env vars exist; without them sign-in can't work, so we point to Ayarlar. */
  configured: boolean;
}

/**
 * Small account control for the top-right of the home page:
 * a "Giriş" pill when signed out, an initial avatar when signed in. Opens a compact popover.
 */
export function AccountMenu({ email, configured }: AccountMenuProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [formEmail, setFormEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState<{ type: "ok" | "err"; text: string } | null>(null);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    function onPointer(e: PointerEvent) {
      if (rootRef.current && !rootRef.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("pointerdown", onPointer);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("pointerdown", onPointer);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setMessage(null);
    try {
      const res = await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: mode, email: formEmail, password }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ type: "err", text: data.error ?? "İşlem başarısız oldu." });
        return;
      }
      if (data.needsEmailVerification) {
        setMessage({ type: "ok", text: data.messageTr });
        return;
      }
      setPassword("");
      setOpen(false);
      router.refresh();
    } catch {
      setMessage({ type: "err", text: "Bağlantı hatası oluştu." });
    } finally {
      setLoading(false);
    }
  }

  async function signOut() {
    setLoading(true);
    try {
      await fetch("/api/auth", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ action: "signout" }),
      });
      setOpen(false);
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  const initial = email ? email.trim().charAt(0).toLocaleUpperCase("tr") : "";

  return (
    <div ref={rootRef} className="relative">
      {email ? (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={`Hesap: ${email}`}
          aria-expanded={open}
          className="grid h-8 w-8 place-items-center rounded-full bg-forest text-xs font-bold text-parchment shadow-xs ring-2 ring-parchment transition-colors hover:bg-forest-deep"
        >
          {initial}
        </button>
      ) : (
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          className="inline-flex h-8 items-center gap-1.5 rounded-full border border-line bg-surface px-3 text-xs font-semibold text-forest shadow-xs transition-colors hover:bg-sand"
        >
          <UserRound className="h-3.5 w-3.5" />
          Giriş
        </button>
      )}

      {open && (
        <div
          role="dialog"
          aria-label="Hesap"
          className="absolute right-0 top-10 z-40 w-[min(18rem,calc(100vw-2rem))] rounded-2xl border border-line bg-surface p-4 shadow-[0_12px_32px_-12px_rgba(27,67,50,0.28)]"
        >
          {email ? (
            <div className="space-y-3">
              <div>
                <p className="text-[11px] font-medium text-muted">Giriş yapıldı</p>
                <p className="truncate text-sm font-semibold text-ink">{email}</p>
              </div>
              <button
                type="button"
                disabled={loading}
                onClick={signOut}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl border border-line bg-parchment px-3 py-2 text-xs font-semibold text-forest hover:bg-sand disabled:opacity-50"
              >
                <LogOut className="h-3.5 w-3.5" />
                Çıkış yap
              </button>
            </div>
          ) : !configured ? (
            <div className="space-y-2 text-xs text-ink-soft">
              <p>Bulut hesabı henüz ayarlanmamış.</p>
              <Link href="/settings" className="font-semibold text-forest underline underline-offset-2">
                Ayarlar&apos;a git
              </Link>
            </div>
          ) : (
            <form onSubmit={submit} className="space-y-2.5">
              <div className="grid grid-cols-2 rounded-full bg-parchment p-0.5 text-xs font-semibold">
                {(["signin", "signup"] as const).map((m) => (
                  <button
                    key={m}
                    type="button"
                    onClick={() => {
                      setMode(m);
                      setMessage(null);
                    }}
                    className={cn(
                      "rounded-full py-1.5 transition-colors",
                      mode === m ? "bg-surface text-forest shadow-xs" : "text-muted hover:text-forest"
                    )}
                  >
                    {m === "signin" ? "Giriş yap" : "Kayıt ol"}
                  </button>
                ))}
              </div>
              <input
                type="email"
                required
                autoComplete="email"
                value={formEmail}
                onChange={(e) => setFormEmail(e.target.value)}
                placeholder="E-posta"
                className="w-full rounded-xl border border-line bg-parchment px-3 py-2 text-sm"
              />
              <input
                type="password"
                required
                minLength={6}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Parola"
                className="w-full rounded-xl border border-line bg-parchment px-3 py-2 text-sm"
              />
              <button
                type="submit"
                disabled={loading}
                className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-forest px-3 py-2 text-xs font-semibold text-parchment hover:bg-forest-deep disabled:opacity-50"
              >
                <LogIn className="h-3.5 w-3.5" />
                {loading ? "Bağlanılıyor…" : mode === "signin" ? "Giriş yap" : "Hesap oluştur"}
              </button>
              {message && (
                <p className={cn("text-xs font-medium", message.type === "ok" ? "text-emerald" : "text-red-700")}>
                  {message.text}
                </p>
              )}
            </form>
          )}
        </div>
      )}
    </div>
  );
}
