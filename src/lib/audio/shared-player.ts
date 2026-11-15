/**
 * One shared <audio> element for every recitation in the app.
 *
 * Why: mobile browsers (iOS Safari above all) only let an audio element start playing
 * from inside a user tap. A brand-new `new Audio()` created after a timer or an `await`
 * (the next word of listen-and-repeat, the next verse of a loop, the warm-up's next
 * round) is a fresh, "locked" element and `play()` is rejected with NotAllowedError.
 * An element that has played once from a tap stays unlocked, so we keep a single
 * element, unlock it on the first tap anywhere, and only swap its `src` afterwards.
 *
 * Only one clip plays at a time: starting a clip stops the previous one, and the
 * previous clip's `done` promise resolves with `"stopped"`.
 */

export type ClipResult =
  | { status: "ended"; /** Heard length in ms, after the speed change. */ heardMs: number }
  | { status: "stopped" }
  | { status: "error" }
  | { status: "blocked" };

export interface ClipOptions {
  rate?: number;
  loop?: boolean;
  onTimeUpdate?: (currentTimeSeconds: number) => void;
}

export interface ClipHandle {
  /** Resolves once: the clip ended, was stopped/replaced, failed to load, or was blocked. */
  done: Promise<ClipResult>;
  /** Stops this clip if it is still the current one. */
  stop: () => void;
  /** Changes the speed of this clip if it is still playing. */
  setRate: (rate: number) => void;
  isCurrent: () => boolean;
}

let element: HTMLAudioElement | null = null;
let unlocked = false;
let current: { id: number; finish: (r: ClipResult) => void } | null = null;
let nextId = 0;
let silentSrc: string | null = null;

function getElement(): HTMLAudioElement | null {
  if (typeof window === "undefined") return null;
  if (!element) {
    element = new Audio();
    element.preload = "auto";
    element.setAttribute("playsinline", "");
    // Keep the qari's pitch when the learner slows the recitation down.
    element.preservesPitch = true;
  }
  return element;
}

/** ~50 ms of silence as a WAV data URI, built once (no network, no asset file). */
function getSilentSrc(): string {
  if (silentSrc) return silentSrc;
  const samples = 400;
  const bytes = new Uint8Array(44 + samples);
  const view = new DataView(bytes.buffer);
  const ascii = (offset: number, text: string) => {
    for (let i = 0; i < text.length; i += 1) bytes[offset + i] = text.charCodeAt(i);
  };
  ascii(0, "RIFF");
  view.setUint32(4, 36 + samples, true);
  ascii(8, "WAVE");
  ascii(12, "fmt ");
  view.setUint32(16, 16, true);
  view.setUint16(20, 1, true); // PCM
  view.setUint16(22, 1, true); // mono
  view.setUint32(24, 8000, true);
  view.setUint32(28, 8000, true);
  view.setUint16(32, 1, true);
  view.setUint16(34, 8, true);
  ascii(36, "data");
  view.setUint32(40, samples, true);
  bytes.fill(0x80, 44);
  let binary = "";
  bytes.forEach((b) => (binary += String.fromCharCode(b)));
  silentSrc = `data:audio/wav;base64,${btoa(binary)}`;
  return silentSrc;
}

function detachHandlers(audio: HTMLAudioElement) {
  audio.onended = null;
  audio.onerror = null;
  audio.ontimeupdate = null;
}

/** Stops whatever clip is playing (its `done` resolves with "stopped"). */
export function stopSharedAudio() {
  const audio = element;
  if (current) {
    const { finish } = current;
    current = null;
    finish({ status: "stopped" });
  }
  if (audio) {
    detachHandlers(audio);
    audio.pause();
  }
}

/**
 * Unlocks the shared element. Must run synchronously inside a tap/click/key handler.
 * Does nothing once unlocked or while a real clip is playing.
 */
export function unlockSharedAudio() {
  if (unlocked || current) return;
  const audio = getElement();
  if (!audio) return;
  // Not muted: some browsers don't count a muted play as unlocking the element.
  audio.src = getSilentSrc();
  const attempt = audio.play();
  const done = () => {
    // A real clip may have taken over while the silent one was starting.
    if (!current) audio.pause();
  };
  if (attempt && typeof attempt.then === "function") {
    attempt.then(
      () => {
        unlocked = true;
        done();
      },
      () => done()
    );
  } else {
    unlocked = true;
    done();
  }
}

let listenersInstalled = false;
const GESTURE_EVENTS = ["touchend", "click", "keydown"] as const;

/**
 * Unlocks audio on the first tap anywhere in the app, so later playback that starts
 * after a timer or network wait is allowed. Safe to call many times.
 */
export function installSharedAudioUnlock() {
  if (listenersInstalled || typeof window === "undefined") return;
  listenersInstalled = true;
  const onGesture = () => {
    if (unlocked) {
      GESTURE_EVENTS.forEach((type) => window.removeEventListener(type, onGesture, true));
      return;
    }
    unlockSharedAudio();
  };
  GESTURE_EVENTS.forEach((type) => window.addEventListener(type, onGesture, true));
}

/** Plays a recording on the shared element, replacing whatever was playing. */
export function playSharedClip(url: string, options: ClipOptions = {}): ClipHandle {
  const rate = options.rate ?? 1;
  const id = (nextId += 1);
  let settled = false;
  let resolveDone!: (r: ClipResult) => void;
  const done = new Promise<ClipResult>((resolve) => {
    resolveDone = resolve;
  });
  const finish = (result: ClipResult) => {
    if (settled) return;
    settled = true;
    resolveDone(result);
  };
  const isCurrent = () => current?.id === id;
  const handle: ClipHandle = {
    done,
    isCurrent,
    stop: () => {
      if (isCurrent()) stopSharedAudio();
    },
    setRate: (next) => {
      if (isCurrent() && element) {
        element.defaultPlaybackRate = next;
        element.playbackRate = next;
      }
    },
  };

  const audio = getElement();
  if (!audio) {
    finish({ status: "error" });
    return handle;
  }

  stopSharedAudio();
  current = { id, finish };

  audio.loop = options.loop ?? false;
  // Loading a new src resets playbackRate to defaultPlaybackRate, so set both.
  audio.defaultPlaybackRate = rate;
  audio.playbackRate = rate;
  audio.src = url;

  const end = (result: ClipResult) => {
    if (!isCurrent()) return;
    current = null;
    detachHandlers(audio);
    finish(result);
  };

  audio.onended = () => {
    const seconds = Number.isFinite(audio.duration) ? audio.duration : 0;
    end({ status: "ended", heardMs: (seconds * 1000) / (audio.playbackRate || rate) });
  };
  audio.onerror = () => end({ status: "error" });
  if (options.onTimeUpdate) {
    const onTimeUpdate = options.onTimeUpdate;
    audio.ontimeupdate = () => {
      if (isCurrent()) onTimeUpdate(audio.currentTime);
    };
  }

  const attempt = audio.play();
  if (attempt && typeof attempt.then === "function") {
    attempt.then(
      () => {
        unlocked = true;
      },
      (err: unknown) => {
        const name = err instanceof DOMException ? err.name : "";
        // AbortError: a newer clip or a stop interrupted this one (already settled then).
        if (name === "AbortError") return end({ status: "stopped" });
        end(name === "NotAllowedError" ? { status: "blocked" } : { status: "error" });
      }
    );
  }
  return handle;
}

/** Shared wording so every screen explains a blocked clip the same way. */
export const AUDIO_BLOCKED_MESSAGE = "Tarayıcı sesi engelledi; ekrana bir kez dokunun.";
export const AUDIO_LOAD_ERROR_MESSAGE = "Ses dosyası yüklenemedi. İnternet bağlantınızı kontrol edin.";
