/**
 * Hands-free WebAudio Voice Activity Detection (VAD) + MediaRecorder controller.
 *
 * Includes:
 * - Automatic 350ms acoustic cooldown when resuming after speaker playback (prevents room echo triggers)
 * - Adaptive ambient noise-floor calibration (adjusts smoothly to quiet rooms and noisy cafés)
 * - Manual start/stop override for noisy environments
 */

export interface VadCaptureOptions {
  /** Silence duration (ms) before automatically finalizing an utterance. */
  silenceHoldMs?: number;
  /** Minimum speech duration (ms) to avoid triggering on clicks/breaths. */
  minSpeechMs?: number;
  /** Maximum single utterance length (ms) to bound latency and API cost. */
  maxSpeechMs?: number;
  /** Cooldown (ms) after resumeListening() to ignore speaker reverb tails. */
  cooldownMs?: number;
  onSpeechStart?: () => void;
  onLevel?: (rms: number) => void;
  onUtteranceReady: (blob: Blob, durationMs: number) => void;
  onError?: (messageTr: string) => void;
}

export class HandsFreeVadRecorder {
  private stream: MediaStream | null = null;
  private audioCtx: AudioContext | null = null;
  private analyser: AnalyserNode | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private rafId: number | null = null;
  private active = false;
  private paused = true;
  private speaking = false;
  private speechStartedAt = 0;
  private lastVoiceAt = 0;
  private ignoreUntil = 0;
  private noiseFloor = 0.012;
  private options: VadCaptureOptions;

  constructor(options: VadCaptureOptions) {
    this.options = options;
  }

  updateOptions(partial: Partial<VadCaptureOptions>) {
    this.options = { ...this.options, ...partial };
  }

  async init(): Promise<boolean> {
    if (this.stream) return true;
    if (typeof navigator === "undefined" || !navigator.mediaDevices?.getUserMedia) {
      this.options.onError?.("Bu tarayıcı mikrofon erişimini desteklemiyor.");
      return false;
    }
    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.audioCtx = new AudioCtx();
        const source = this.audioCtx.createMediaStreamSource(this.stream);
        this.analyser = this.audioCtx.createAnalyser();
        this.analyser.fftSize = 1024;
        source.connect(this.analyser);
      }
      this.active = true;
      this.startMonitorLoop();
      return true;
    } catch {
      this.options.onError?.(
        "Mikrofon izni alınamadı. Tarayıcı ayarlarından mikrofona izin verip tekrar deneyebilirsin."
      );
      return false;
    }
  }

  /** Enable automatic VAD listening with a short echo-suppression cooldown. */
  resumeListening() {
    if (!this.active) return;
    if (this.audioCtx?.state === "suspended") {
      this.audioCtx.resume().catch(() => {});
    }
    const cooldown = this.options.cooldownMs ?? 350;
    this.ignoreUntil = Date.now() + cooldown;
    this.paused = false;
  }

  /** Pause VAD listening while AI teacher or Quran reciter is speaking (prevents echo). */
  pauseListening() {
    this.paused = true;
    if (this.recorder && this.recorder.state === "recording") {
      try {
        this.recorder.onstop = null;
        this.recorder.stop();
      } catch {
        /* ignore */
      }
    }
    this.speaking = false;
    this.chunks = [];
    this.options.onLevel?.(0);
  }

  /** Manual push-to-talk start (noisy environment override). */
  startManualCapture() {
    if (!this.active || !this.stream) return;
    this.paused = false;
    this.ignoreUntil = 0;
    if (!this.speaking) {
      this.beginRecording();
    }
  }

  /** Manual push-to-talk stop (immediately finalizes current utterance). */
  stopManualCapture() {
    if (this.speaking) {
      this.finishRecording();
    }
  }

  dispose() {
    this.active = false;
    this.pauseListening();
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    this.stream?.getTracks().forEach((t) => t.stop());
    this.stream = null;
    this.audioCtx?.close().catch(() => {});
    this.audioCtx = null;
    this.analyser = null;
  }

  private beginRecording() {
    if (!this.stream || this.speaking) return;
    const preferredMime =
      typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
        ? "audio/webm;codecs=opus"
        : typeof MediaRecorder !== "undefined" && MediaRecorder.isTypeSupported("audio/mp4")
          ? "audio/mp4"
          : "";

    try {
      this.chunks = [];
      this.recorder = preferredMime
        ? new MediaRecorder(this.stream, { mimeType: preferredMime })
        : new MediaRecorder(this.stream);
      this.recorder.ondataavailable = (ev) => {
        if (ev.data.size > 0) this.chunks.push(ev.data);
      };
      this.speaking = true;
      this.speechStartedAt = Date.now();
      this.lastVoiceAt = this.speechStartedAt;
      this.recorder.start();
      this.options.onSpeechStart?.();
    } catch {
      this.speaking = false;
    }
  }

  private finishRecording() {
    if (!this.recorder || this.recorder.state !== "recording") {
      this.speaking = false;
      return;
    }
    const durationMs = Date.now() - this.speechStartedAt;
    const minSpeechMs = this.options.minSpeechMs ?? 420;
    const rec = this.recorder;
    this.speaking = false;

    rec.onstop = () => {
      const blob = new Blob(this.chunks, { type: rec.mimeType || "audio/webm" });
      this.chunks = [];
      if (durationMs >= minSpeechMs && blob.size > 500) {
        this.options.onUtteranceReady(blob, durationMs);
      }
    };
    try {
      rec.stop();
    } catch {
      /* ignore */
    }
  }

  private startMonitorLoop() {
    const buffer = new Uint8Array(1024);
    const tick = () => {
      if (!this.active) return;
      this.rafId = requestAnimationFrame(tick);

      if (this.paused || !this.analyser) return;

      const now = Date.now();
      if (now < this.ignoreUntil) return;

      this.analyser.getByteTimeDomainData(buffer);
      let sumSquares = 0;
      for (let i = 0; i < buffer.length; i += 1) {
        const centered = (buffer[i]! - 128) / 128;
        sumSquares += centered * centered;
      }
      const rms = Math.sqrt(sumSquares / buffer.length);
      this.options.onLevel?.(rms);

      // Slowly adapt ambient noise floor when not speaking
      if (!this.speaking) {
        this.noiseFloor = this.noiseFloor * 0.94 + Math.min(rms, 0.045) * 0.06;
      }

      const dynamicThreshold = Math.min(0.085, Math.max(0.022, this.noiseFloor * 2.5));
      const silenceHoldMs = this.options.silenceHoldMs ?? 1050;
      const maxSpeechMs = this.options.maxSpeechMs ?? 18000;

      if (rms >= dynamicThreshold) {
        this.lastVoiceAt = now;
        if (!this.speaking) {
          this.beginRecording();
        }
      }

      if (this.speaking) {
        const silentFor = now - this.lastVoiceAt;
        const totalFor = now - this.speechStartedAt;
        if (silentFor >= silenceHoldMs || totalFor >= maxSpeechMs) {
          this.finishRecording();
        }
      }
    };

    this.rafId = requestAnimationFrame(tick);
  }
}
