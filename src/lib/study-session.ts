"use client";

/**
 * Client-side "today's session" + "continue where you left off" state.
 *
 * Both live in localStorage so that starting a session is one tap and the
 * learner keeps a visible thread (step k of N, next step button) while moving
 * between Mushaf, review and memorization pages.
 */

import { useSyncExternalStore } from "react";

export interface SessionStep {
  id: string;
  titleTr: string;
  href: string;
  estimatedMinutes: number;
}

export interface ActiveSession {
  /** YYYY-MM-DD the session was started (sessions expire at day change). */
  day: string;
  steps: SessionStep[];
  index: number;
  startedAt: number;
}

export interface LastStudyLocation {
  href: string;
  labelTr: string;
  at: number;
}

const SESSION_KEY = "qj_active_session";
const LAST_KEY = "qj_last_study";
const EVENT = "qj-study-session";

function todayKey(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function readRaw(key: string): string | null {
  try {
    return localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeRaw(key: string, value: string | null) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, value);
  } catch {
    /* storage unavailable: session simply isn't persisted */
  }
  window.dispatchEvent(new Event(EVENT));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

// useSyncExternalStore needs referentially stable snapshots: cache by raw string.
const parseCache = new Map<string, { raw: string | null; value: unknown }>();
function parsed<T>(key: string): T | null {
  const raw = readRaw(key);
  const hit = parseCache.get(key);
  if (hit && hit.raw === raw) return hit.value as T | null;
  let value: T | null = null;
  try {
    value = raw ? (JSON.parse(raw) as T) : null;
  } catch {
    value = null;
  }
  parseCache.set(key, { raw, value });
  return value;
}

function getSession(): ActiveSession | null {
  const s = parsed<ActiveSession>(SESSION_KEY);
  if (!s || s.day !== todayKey() || !Array.isArray(s.steps) || s.steps.length === 0) return null;
  return s;
}

export function useActiveSession(): ActiveSession | null {
  return useSyncExternalStore(subscribe, getSession, () => null);
}

export function useLastStudy(): LastStudyLocation | null {
  return useSyncExternalStore(subscribe, () => parsed<LastStudyLocation>(LAST_KEY), () => null);
}

/** Starts today's session (or restarts it at `startIndex`) and returns the href to open. */
export function startSession(steps: SessionStep[], startIndex = 0): string {
  const index = Math.min(Math.max(0, startIndex), steps.length - 1);
  const session: ActiveSession = { day: todayKey(), steps, index, startedAt: Date.now() };
  writeRaw(SESSION_KEY, JSON.stringify(session));
  return steps[index].href;
}

/** Moves to the next step. Returns its href, or null when the session is finished. */
export function advanceSession(): string | null {
  const s = getSession();
  if (!s) return null;
  if (s.index + 1 >= s.steps.length) {
    writeRaw(SESSION_KEY, JSON.stringify({ ...s, index: s.steps.length }));
    return null;
  }
  const next = { ...s, index: s.index + 1 };
  writeRaw(SESSION_KEY, JSON.stringify(next));
  return next.steps[next.index].href;
}

export function endSession() {
  writeRaw(SESSION_KEY, null);
}

export function isSessionFinished(s: ActiveSession | null): boolean {
  return !!s && s.index >= s.steps.length;
}

const STUDY_ROUTES: Record<string, string> = {
  "/mushaf": "Mushaf",
  "/memorization": "Ezber",
  "/learn-arabic": "Arapça dersleri",
  "/vocabulary": "Kelime Hazinesi",
  "/review": "Tekrar kartları",
};

export function describeStudyLocation(pathname: string, search: string): string | null {
  const base = STUDY_ROUTES[pathname];
  if (!base) return null;
  const params = new URLSearchParams(search);
  if (pathname === "/mushaf" && params.get("page")) return `Mushaf · Sayfa ${params.get("page")}`;
  if (pathname === "/mushaf" && params.get("surah")) return `Mushaf · ${params.get("surah")}. sure`;
  if (pathname === "/memorization" && params.get("verse")) return `Ezber · ${params.get("verse")} ayeti`;
  if (pathname === "/memorization" && params.get("surah")) return `Ezber · ${params.get("surah")}. sure`;
  if (pathname === "/learn-arabic" && params.get("tab") === "tajweed") return "Tecvid dersleri";
  return base;
}

export function recordStudyLocation(pathname: string, search: string) {
  const labelTr = describeStudyLocation(pathname, search);
  if (!labelTr) return;
  const href = search ? `${pathname}?${search}` : pathname;
  const prev = parsed<LastStudyLocation>(LAST_KEY);
  if (prev && prev.href === href) return;
  writeRaw(LAST_KEY, JSON.stringify({ href, labelTr, at: Date.now() } satisfies LastStudyLocation));
}
