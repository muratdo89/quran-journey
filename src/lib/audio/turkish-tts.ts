/**
 * Calm Turkish speech synthesis helper for the AI Teacher's Turkish coaching sentences.
 * IMPORTANT: Used strictly for Turkish guidance — NEVER for Arabic Quran verses or words.
 */

let activeUtterance: SpeechSynthesisUtterance | null = null;

function pickTurkishVoice(): SpeechSynthesisVoice | null {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices.length) return null;
  // Prefer enhanced/natural Turkish voices (e.g., Yelda / Apple / Google tr-TR)
  const trVoices = voices.filter((v) => v.lang.toLowerCase().startsWith("tr"));
  if (!trVoices.length) return null;
  return (
    trVoices.find((v) => /yelda|cem|google|natural|enhanced/i.test(v.name)) ??
    trVoices[0]!
  );
}

export function stopTurkishSpeech(): void {
  if (typeof window === "undefined" || !("speechSynthesis" in window)) return;
  activeUtterance = null;
  try {
    window.speechSynthesis.cancel();
  } catch {
    /* ignore */
  }
}

export function speakTurkishCoaching(text: string): Promise<void> {
  return new Promise((resolve) => {
    if (
      typeof window === "undefined" ||
      !("speechSynthesis" in window) ||
      !text.trim()
    ) {
      resolve();
      return;
    }

    stopTurkishSpeech();

    const utterance = new SpeechSynthesisUtterance(text.trim());
    utterance.lang = "tr-TR";
    utterance.rate = 0.98;
    utterance.pitch = 1.0;

    const voice = pickTurkishVoice();
    if (voice) {
      utterance.voice = voice;
    }

    let settled = false;
    const finish = () => {
      if (settled) return;
      settled = true;
      if (activeUtterance === utterance) {
        activeUtterance = null;
      }
      resolve();
    };

    // Safety timeout in case mobile Safari drops onend
    const maxMs = Math.max(4500, Math.min(25000, text.length * 115));
    const timer = window.setTimeout(finish, maxMs);

    utterance.onend = () => {
      window.clearTimeout(timer);
      finish();
    };
    utterance.onerror = () => {
      window.clearTimeout(timer);
      finish();
    };

    activeUtterance = utterance;
    try {
      window.speechSynthesis.speak(utterance);
    } catch {
      window.clearTimeout(timer);
      finish();
    }
  });
}
