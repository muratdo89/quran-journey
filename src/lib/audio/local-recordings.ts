"use client";

const DB_NAME = "quran_journey_audio_v1";
const STORE_NAME = "recordings";

function openAudioDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === "undefined") {
      reject(new Error("IndexedDB bu tarayıcıda desteklenmiyor."));
      return;
    }
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        db.createObjectStore(STORE_NAME, { keyPath: "id" });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error ?? new Error("IndexedDB açılamadı."));
  });
}

export async function saveLocalRecordingBlob(id: string, blob: Blob): Promise<void> {
  try {
    const db = await openAudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).put({
        id,
        blob,
        savedAt: new Date().toISOString(),
      });
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Graceful no-op in restricted browsing contexts
  }
}

export async function getLocalRecordingBlob(id: string): Promise<Blob | null> {
  try {
    const db = await openAudioDb();
    const record = await new Promise<{ id: string; blob: Blob } | undefined>(
      (resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readonly");
        const req = tx.objectStore(STORE_NAME).get(id);
        req.onsuccess = () => resolve(req.result as { id: string; blob: Blob } | undefined);
        req.onerror = () => reject(req.error);
      }
    );
    db.close();
    return record?.blob ?? null;
  } catch {
    return null;
  }
}

export async function deleteLocalRecordingBlob(id: string): Promise<void> {
  try {
    const db = await openAudioDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(STORE_NAME, "readwrite");
      tx.objectStore(STORE_NAME).delete(id);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // Graceful no-op
  }
}
