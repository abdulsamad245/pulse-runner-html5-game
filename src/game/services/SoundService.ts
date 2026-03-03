/** Named procedural SFX cues used by gameplay/UI flows. */
export type SoundEvent =
  | "uiTap"
  | "collect"
  | "boost"
  | "levelUp"
  | "nearMiss"
  | "hit"
  | "shieldBlock"
  | "pause"
  | "resume"
  | "gameOver";

export class SoundService {
  private context: AudioContext | null = null;
  private unlocked = false;

  /** Register one-shot interaction listeners to unlock audio playback. */
  init(): void {
    if (typeof window === "undefined") {
      return;
    }

    const unlock = (): void => {
      this.unlocked = true;
      void this.getContext()?.resume();
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
  }

  /** Play a predefined procedural sound event. */
  play(event: SoundEvent): void {
    const ctx = this.getContext();
    if (!ctx || !this.unlocked) {
      return;
    }

    const now = ctx.currentTime;

    switch (event) {
      case "uiTap":
        this.tone(600, 0.045, 0.018, "triangle");
        this.tone(760, 0.05, 0.01, "triangle", now + 0.04);
        return;
      case "collect":
        this.tone(680, 0.05, 0.02, "triangle");
        this.tone(960, 0.08, 0.018, "sine", now + 0.05);
        return;
      case "boost":
        this.tone(400, 0.08, 0.03, "sawtooth");
        this.tone(900, 0.14, 0.03, "square", now + 0.08);
        return;
      case "levelUp":
        this.tone(520, 0.07, 0.025, "triangle");
        this.tone(760, 0.08, 0.023, "triangle", now + 0.07);
        this.tone(980, 0.1, 0.02, "sine", now + 0.14);
        return;
      case "nearMiss":
        this.tone(520, 0.04, 0.013, "square");
        return;
      case "shieldBlock":
        this.tone(300, 0.06, 0.024, "square");
        this.tone(240, 0.08, 0.02, "triangle", now + 0.05);
        return;
      case "hit":
        this.tone(170, 0.15, 0.04, "sawtooth");
        return;
      case "pause":
        this.tone(520, 0.08, 0.025, "triangle");
        return;
      case "resume":
        this.tone(700, 0.09, 0.02, "triangle");
        return;
      case "gameOver":
        this.tone(420, 0.08, 0.02, "triangle");
        this.tone(300, 0.13, 0.024, "sawtooth", now + 0.08);
        this.tone(200, 0.22, 0.03, "square", now + 0.22);
        return;
    }
  }

  private getContext(): AudioContext | null {
    if (typeof window === "undefined") {
      return null;
    }

    if (!this.context) {
      const AudioCtor = window.AudioContext || (window as Window & { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!AudioCtor) {
        return null;
      }
      this.context = new AudioCtor();
    }

    return this.context;
  }

  /** Play a lightweight synthesized tone envelope. */
  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    startAt?: number
  ): void {
    const ctx = this.getContext();
    if (!ctx) {
      return;
    }

    const start = startAt ?? ctx.currentTime;
    const stop = start + duration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(volume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    osc.connect(gain);
    gain.connect(ctx.destination);

    osc.start(start);
    osc.stop(stop + 0.01);
  }
}
