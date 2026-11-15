"use client";

import { useEffect, useState } from "react";
import { OFFLINE_CACHE_NAME } from "./shared";

/** "Mark page studied" and per-page offline download (Cache API) for the Mushaf page. */
export function usePageTools(pageNumber: number, initiallyStudied: boolean) {
  const [pageStudied, setPageStudied] = useState(initiallyStudied);
  const [markingPage, setMarkingPage] = useState(false);
  const [offlineSaved, setOfflineSaved] = useState(false);
  const [savingOffline, setSavingOffline] = useState(false);
  const [offlineMsg, setOfflineMsg] = useState<string | null>(null);

  // Check if this page is already cached for offline use
  useEffect(() => {
    if (typeof window === "undefined" || !("caches" in window)) return;
    caches
      .open(OFFLINE_CACHE_NAME)
      .then((cache) => cache.match(`/api/mushaf/offline?page=${pageNumber}`))
      .then((match) => {
        if (match) setOfflineSaved(true);
      })
      .catch(() => {});
  }, [pageNumber]);

  async function markPageStudied() {
    setMarkingPage(true);
    try {
      const res = await fetch("/api/mushaf/page", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pageNumber }),
      });
      if (res.ok) {
        setPageStudied(true);
      }
    } finally {
      setMarkingPage(false);
    }
  }

  async function downloadOffline() {
    if (typeof window === "undefined" || !("caches" in window)) {
      setOfflineMsg("Bu tarayıcı çevrimdışı önbellek (Cache API) desteklemiyor.");
      return;
    }
    setSavingOffline(true);
    setOfflineMsg(null);
    try {
      const offlineUrl = `/api/mushaf/offline?page=${pageNumber}`;
      const res = await fetch(offlineUrl);
      if (!res.ok) throw new Error("fetch failed");
      const payload = (await res.clone().json()) as { audioUrls?: string[] };
      const cache = await caches.open(OFFLINE_CACHE_NAME);
      await cache.put(offlineUrl, res);
      // Also cache current navigation URL HTML if possible
      await cache.add(`/mushaf?page=${pageNumber}`).catch(() => {});

      const audioList = (payload.audioUrls ?? []).slice(0, 20);
      await Promise.all(
        audioList.map((aUrl) =>
          fetch(aUrl, { mode: "no-cors" })
            .then((audioRes) => cache.put(aUrl, audioRes))
            .catch(() => {})
        )
      );
      setOfflineSaved(true);
      setOfflineMsg(
        `Sayfa ${pageNumber} ve ${audioList.length} ses dosyası çevrimdışı kullanım için kaydedildi.`
      );
    } catch {
      setOfflineMsg("Çevrimdışı indirme sırasında hata oluştu.");
    } finally {
      setSavingOffline(false);
    }
  }

  return {
    pageStudied,
    markingPage,
    markPageStudied,
    offlineSaved,
    savingOffline,
    offlineMsg,
    downloadOffline,
  };
}

export type PageTools = ReturnType<typeof usePageTools>;
