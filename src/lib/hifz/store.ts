"use client";

/**
 * Hifz progress lives in localStorage, like the study session: on Vercel without Supabase the
 * server database is temporary, and memorization progress must never be lost between visits.
 */

import { useSyncExternalStore } from "react";
import { EMPTY_HIFZ_STORE, normalizeHifzStore, type HifzStore } from "./plan";

const KEY = "qj_hifz_v1";
const EVENT = "qj-hifz";

let cache: { raw: string | null; value: HifzStore } | null = null;

function readRaw(): string | null {
  try {
    return localStorage.getItem(KEY);
  } catch {
    return null;
  }
}

export function readHifzStore(): HifzStore {
  const raw = readRaw();
  if (cache && cache.raw === raw) return cache.value;
  let value = EMPTY_HIFZ_STORE;
  if (raw) {
    try {
      value = normalizeHifzStore(JSON.parse(raw));
    } catch {
      value = EMPTY_HIFZ_STORE;
    }
  }
  cache = { raw, value };
  return value;
}

export function writeHifzStore(next: HifzStore) {
  try {
    localStorage.setItem(KEY, JSON.stringify(next));
  } catch {
    /* storage unavailable: progress lives only for this visit */
    cache = { raw: readRaw(), value: next };
  }
  window.dispatchEvent(new Event(EVENT));
}

export function updateHifzStore(fn: (s: HifzStore) => HifzStore) {
  writeHifzStore(fn(readHifzStore()));
}

function subscribe(cb: () => void): () => void {
  window.addEventListener(EVENT, cb);
  window.addEventListener("storage", cb);
  return () => {
    window.removeEventListener(EVENT, cb);
    window.removeEventListener("storage", cb);
  };
}

/** Returns null during server render / first hydration pass, then the stored value. */
export function useHifzStore(): HifzStore | null {
  return useSyncExternalStore<HifzStore | null>(subscribe, readHifzStore, () => null);
}
