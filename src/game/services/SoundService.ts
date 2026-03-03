/** Named procedural SFX cues used by gameplay/UI flows. */
export type SoundEvent =
  | "uiTap"
  | "nameSaved"
  | "collect"
  | "collectEnergy"
  | "collectBoost"
  | "collectShield"
  | "collectSlow"
  | "collectLife"
  | "boost"
  | "levelUp"
  | "nearMiss"
  | "hit"
  | "hitEnemy"
  | "hitMine"
  | "hitDart"
  | "shieldBlock"
  | "blockEnemy"
  | "blockMine"
  | "blockDart"
  | "pause"
  | "resume"
  | "gameOver";

export class SoundService {
  private readonly sfxGainBoost = 2.25;
  private readonly ambienceGainBoost = 2.45;

  private context: AudioContext | null = null;
  private unlocked = false;
  private gameplayLoopRequested = false;
  private gameplayPaused = false;
  private gameplayIntensity = 0;
  private noiseBuffer: AudioBuffer | null = null;

  private sfxBus: GainNode | null = null;
  private sfxCompressor: DynamicsCompressorNode | null = null;

  private gameplayMaster: GainNode | null = null;
  private gameplayDroneOsc: OscillatorNode | null = null;
  private gameplayDroneGain: GainNode | null = null;
  private gameplayPulseOsc: OscillatorNode | null = null;
  private gameplayPulseGain: GainNode | null = null;
  private gameplayLfoOsc: OscillatorNode | null = null;
  private gameplayLfoGain: GainNode | null = null;

  /** Register one-shot interaction listeners to unlock audio playback. */
  init(): void {
    if (typeof window === "undefined") {
      return;
    }

    const unlock = (): void => {
      this.unlocked = true;
      void this.ensureContext()?.resume();
      if (this.gameplayLoopRequested) {
        this.startGameplayLoop();
      }
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("keydown", unlock);
      window.removeEventListener("touchstart", unlock);
    };

    window.addEventListener("pointerdown", unlock, { once: true });
    window.addEventListener("keydown", unlock, { once: true });
    window.addEventListener("touchstart", unlock, { once: true });
  }

  /** Start the continuous gameplay ambience layer. */
  startGameplayLoop(): void {
    this.gameplayLoopRequested = true;
    if (!this.unlocked || this.gameplayMaster) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const master = ctx.createGain();
    const droneOsc = ctx.createOscillator();
    const droneGain = ctx.createGain();
    const pulseOsc = ctx.createOscillator();
    const pulseGain = ctx.createGain();
    const lfoOsc = ctx.createOscillator();
    const lfoGain = ctx.createGain();

    master.gain.setValueAtTime(0.0001, ctx.currentTime);
    droneOsc.type = "sine";
    droneOsc.frequency.setValueAtTime(62, ctx.currentTime);
    droneGain.gain.setValueAtTime(0.013, ctx.currentTime);

    pulseOsc.type = "triangle";
    pulseOsc.frequency.setValueAtTime(124, ctx.currentTime);
    pulseGain.gain.setValueAtTime(0.0062, ctx.currentTime);

    lfoOsc.type = "sine";
    lfoOsc.frequency.setValueAtTime(2.2, ctx.currentTime);
    lfoGain.gain.setValueAtTime(0.0042, ctx.currentTime);

    droneOsc.connect(droneGain);
    droneGain.connect(master);
    pulseOsc.connect(pulseGain);
    pulseGain.connect(master);
    lfoOsc.connect(lfoGain);
    lfoGain.connect(pulseGain.gain);
    master.connect(ctx.destination);

    droneOsc.start(ctx.currentTime);
    pulseOsc.start(ctx.currentTime);
    lfoOsc.start(ctx.currentTime);

    this.gameplayMaster = master;
    this.gameplayDroneOsc = droneOsc;
    this.gameplayDroneGain = droneGain;
    this.gameplayPulseOsc = pulseOsc;
    this.gameplayPulseGain = pulseGain;
    this.gameplayLfoOsc = lfoOsc;
    this.gameplayLfoGain = lfoGain;

    this.applyGameplayMix();
  }

  /** Stop and dispose the continuous gameplay ambience layer. */
  stopGameplayLoop(): void {
    this.gameplayLoopRequested = false;
    const ctx = this.getActiveContext();
    if (!ctx || !this.gameplayMaster) {
      return;
    }

    const stopAt = ctx.currentTime + 0.08;
    this.gameplayMaster.gain.exponentialRampToValueAtTime(0.0001, stopAt);

    this.gameplayDroneOsc?.stop(stopAt + 0.01);
    this.gameplayPulseOsc?.stop(stopAt + 0.01);
    this.gameplayLfoOsc?.stop(stopAt + 0.01);

    this.gameplayDroneOsc?.disconnect();
    this.gameplayPulseOsc?.disconnect();
    this.gameplayLfoOsc?.disconnect();
    this.gameplayDroneGain?.disconnect();
    this.gameplayPulseGain?.disconnect();
    this.gameplayLfoGain?.disconnect();
    this.gameplayMaster.disconnect();

    this.gameplayMaster = null;
    this.gameplayDroneOsc = null;
    this.gameplayDroneGain = null;
    this.gameplayPulseOsc = null;
    this.gameplayPulseGain = null;
    this.gameplayLfoOsc = null;
    this.gameplayLfoGain = null;
  }

  /** Change ambience intensity in the inclusive range `[0, 1]`. */
  setGameplayIntensity(intensity: number): void {
    this.gameplayIntensity = Math.min(1, Math.max(0, intensity));
    this.applyGameplayMix();
  }

  /** Mute/unmute ambience during pause and scene overlays. */
  setGameplayPaused(paused: boolean): void {
    this.gameplayPaused = paused;
    this.applyGameplayMix();
  }

  /** Play a predefined procedural sound event. */
  play(event: SoundEvent): void {
    if (!this.unlocked) {
      return;
    }
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const now = ctx.currentTime;

    switch (event) {
      case "uiTap":
        this.tone(530, 0.05, 0.016, "triangle", now, -0.2);
        this.toneSweep(950, 700, 0.05, 0.012, "sine", now + 0.015, 0.2);
        this.noiseBurst(0.03, 0.004, now, 0.1, 1800, 14000);
        return;
      case "nameSaved":
        this.tone(720, 0.08, 0.017, "triangle", now, 0);
        this.tone(1040, 0.07, 0.013, "sine", now + 0.05, 0.1);
        this.noiseBurst(0.03, 0.0038, now + 0.01, 0, 2000, 14000);
        return;
      case "collect":
      case "collectEnergy":
        this.tone(760, 0.07, 0.018, "triangle", now, -0.15);
        this.tone(1140, 0.09, 0.014, "sine", now + 0.03, 0.18);
        this.tone(1520, 0.08, 0.01, "sine", now + 0.06, 0.28);
        this.noiseBurst(0.045, 0.0035, now + 0.01, 0.22, 2500, 16000);
        return;
      case "collectBoost":
      case "boost":
        this.toneSweep(260, 680, 0.16, 0.024, "sawtooth", now, -0.15);
        this.tone(980, 0.14, 0.02, "square", now + 0.09, 0.2);
        this.tone(490, 0.22, 0.014, "triangle", now + 0.02, 0);
        this.noiseBurst(0.09, 0.006, now + 0.06, 0.12, 1200, 9000);
        return;
      case "collectShield":
        this.tone(420, 0.1, 0.02, "square", now, -0.15);
        this.tone(620, 0.11, 0.017, "triangle", now + 0.06, 0.08);
        this.tone(860, 0.1, 0.013, "sine", now + 0.12, 0.2);
        this.noiseBurst(0.06, 0.0048, now + 0.02, 0.1, 1000, 9000);
        return;
      case "collectSlow":
        this.toneSweep(780, 460, 0.14, 0.018, "triangle", now, -0.2);
        this.tone(360, 0.12, 0.013, "sine", now + 0.08, 0.05);
        this.noiseBurst(0.06, 0.0045, now + 0.02, -0.08, 900, 6000);
        return;
      case "collectLife":
        this.tone(560, 0.09, 0.018, "triangle", now, -0.12);
        this.tone(880, 0.09, 0.015, "triangle", now + 0.06, 0);
        this.tone(1240, 0.1, 0.013, "sine", now + 0.12, 0.16);
        this.noiseBurst(0.07, 0.005, now + 0.04, 0.08, 1800, 12000);
        return;
      case "levelUp":
        this.tone(520, 0.09, 0.018, "triangle", now, -0.2);
        this.tone(780, 0.1, 0.016, "triangle", now + 0.08, 0);
        this.tone(1170, 0.12, 0.014, "sine", now + 0.16, 0.18);
        this.tone(1560, 0.11, 0.012, "sine", now + 0.24, 0.24);
        this.toneSweep(220, 320, 0.24, 0.01, "sine", now, 0);
        this.noiseBurst(0.07, 0.004, now + 0.18, 0.1, 1500, 12000);
        return;
      case "nearMiss":
        this.toneSweep(1100, 720, 0.08, 0.013, "square", now, 0.3);
        this.noiseBurst(0.05, 0.0045, now, -0.2, 2500, 15000);
        return;
      case "blockEnemy":
      case "shieldBlock":
        this.tone(260, 0.08, 0.02, "square", now, -0.1);
        this.toneSweep(680, 420, 0.09, 0.015, "triangle", now + 0.015, 0.12);
        this.noiseBurst(0.05, 0.004, now + 0.01, 0, 1200, 7000);
        return;
      case "blockMine":
        this.tone(220, 0.11, 0.022, "square", now, -0.2);
        this.toneSweep(520, 280, 0.11, 0.018, "triangle", now + 0.02, 0.15);
        this.noiseBurst(0.065, 0.0055, now + 0.005, 0, 700, 5000);
        return;
      case "blockDart":
        this.tone(360, 0.07, 0.018, "triangle", now, 0.25);
        this.toneSweep(980, 660, 0.08, 0.014, "sawtooth", now + 0.015, -0.12);
        this.noiseBurst(0.045, 0.0046, now, 0.15, 1500, 11000);
        return;
      case "hitEnemy":
      case "hit":
        this.tone(150, 0.22, 0.032, "sawtooth", now, -0.1);
        this.tone(95, 0.26, 0.02, "sine", now + 0.04, 0);
        this.noiseBurst(0.12, 0.007, now, 0.06, 400, 4500);
        return;
      case "hitMine":
        this.tone(132, 0.28, 0.034, "sawtooth", now, -0.08);
        this.tone(78, 0.34, 0.022, "square", now + 0.05, 0.05);
        this.noiseBurst(0.16, 0.0082, now, 0.02, 260, 3600);
        return;
      case "hitDart":
        this.toneSweep(460, 220, 0.17, 0.024, "square", now, 0.3);
        this.tone(120, 0.22, 0.018, "sine", now + 0.05, -0.15);
        this.noiseBurst(0.1, 0.0065, now + 0.01, -0.2, 600, 6200);
        return;
      case "pause":
        this.tone(450, 0.08, 0.016, "triangle", now, 0);
        return;
      case "resume":
        this.tone(620, 0.07, 0.014, "triangle", now, 0);
        this.tone(860, 0.06, 0.01, "sine", now + 0.04, 0.12);
        return;
      case "gameOver":
        this.tone(380, 0.11, 0.02, "triangle", now, -0.05);
        this.tone(280, 0.16, 0.025, "sawtooth", now + 0.1, 0.04);
        this.tone(180, 0.3, 0.03, "square", now + 0.24, 0);
        this.toneSweep(140, 70, 0.33, 0.018, "sine", now + 0.22, -0.04);
        this.noiseBurst(0.14, 0.006, now + 0.18, 0, 300, 4000);
        return;
    }
  }

  private applyGameplayMix(): void {
    if (!this.unlocked) {
      return;
    }

    const ctx = this.getActiveContext();
    if (!ctx || !this.gameplayMaster) {
      return;
    }

    const now = ctx.currentTime;
    const intensity = this.gameplayIntensity;
    const audible = this.unlocked && !this.gameplayPaused;
    const masterGain = audible ? (0.012 + intensity * 0.012) * this.ambienceGainBoost : 0.0001;

    this.gameplayMaster.gain.setTargetAtTime(masterGain, now, 0.06);
    this.gameplayDroneOsc?.frequency.setTargetAtTime(56 + intensity * 22, now, 0.1);
    this.gameplayPulseOsc?.frequency.setTargetAtTime(112 + intensity * 90, now, 0.1);
    this.gameplayLfoOsc?.frequency.setTargetAtTime(1.8 + intensity * 2.1, now, 0.12);
    this.gameplayDroneGain?.gain.setTargetAtTime(0.011 + intensity * 0.004, now, 0.1);
    this.gameplayPulseGain?.gain.setTargetAtTime(0.0048 + intensity * 0.0032, now, 0.1);
    this.gameplayLfoGain?.gain.setTargetAtTime(0.0038 + intensity * 0.0025, now, 0.1);
  }

  private getActiveContext(): AudioContext | null {
    return this.context;
  }

  private ensureContext(): AudioContext | null {
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
    startAt?: number,
    pan = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const start = startAt ?? ctx.currentTime;
    const stop = start + duration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const output = this.createVoiceOutput(ctx, gain, pan);

    osc.type = type;
    osc.frequency.setValueAtTime(frequency, start);
    const scaledVolume = this.scaleSfxVolume(volume);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(scaledVolume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    osc.connect(gain);
    output.connect(this.getSfxInput(ctx));

    osc.start(start);
    osc.stop(stop + 0.01);
  }

  /** Play a tone that sweeps pitch between two frequencies. */
  private toneSweep(
    startFrequency: number,
    endFrequency: number,
    duration: number,
    volume: number,
    type: OscillatorType,
    startAt?: number,
    pan = 0
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const start = startAt ?? ctx.currentTime;
    const stop = start + duration;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    const output = this.createVoiceOutput(ctx, gain, pan);

    osc.type = type;
    osc.frequency.setValueAtTime(Math.max(20, startFrequency), start);
    osc.frequency.exponentialRampToValueAtTime(Math.max(20, endFrequency), stop);
    const scaledVolume = this.scaleSfxVolume(volume);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(scaledVolume, start + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    osc.connect(gain);
    output.connect(this.getSfxInput(ctx));

    osc.start(start);
    osc.stop(stop + 0.01);
  }

  /** Play filtered white-noise burst used for impacts and air/transient details. */
  private noiseBurst(
    duration: number,
    volume: number,
    startAt?: number,
    pan = 0,
    highpass = 500,
    lowpass = 12000
  ): void {
    const ctx = this.ensureContext();
    if (!ctx) {
      return;
    }

    const buffer = this.getNoiseBuffer(ctx);
    const source = ctx.createBufferSource();
    const hp = ctx.createBiquadFilter();
    const lp = ctx.createBiquadFilter();
    const gain = ctx.createGain();
    const output = this.createVoiceOutput(ctx, gain, pan);

    const start = startAt ?? ctx.currentTime;
    const stop = start + duration;

    source.buffer = buffer;
    hp.type = "highpass";
    hp.frequency.setValueAtTime(highpass, start);
    lp.type = "lowpass";
    lp.frequency.setValueAtTime(lowpass, start);
    const scaledVolume = this.scaleSfxVolume(volume);
    gain.gain.setValueAtTime(0.0001, start);
    gain.gain.exponentialRampToValueAtTime(scaledVolume, start + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, stop);

    source.connect(hp);
    hp.connect(lp);
    lp.connect(gain);
    output.connect(this.getSfxInput(ctx));

    source.start(start);
    source.stop(stop + 0.01);
  }

  private createVoiceOutput(ctx: AudioContext, gain: GainNode, pan: number): AudioNode {
    if (typeof ctx.createStereoPanner !== "function") {
      return gain;
    }
    const panner = ctx.createStereoPanner();
    panner.pan.setValueAtTime(Math.max(-1, Math.min(1, pan)), ctx.currentTime);
    gain.connect(panner);
    return panner;
  }

  private getSfxInput(ctx: AudioContext): GainNode {
    if (!this.sfxBus || !this.sfxCompressor) {
      const bus = ctx.createGain();
      const compressor = ctx.createDynamicsCompressor();
      bus.gain.setValueAtTime(1.6, ctx.currentTime);
      compressor.threshold.setValueAtTime(-18, ctx.currentTime);
      compressor.knee.setValueAtTime(24, ctx.currentTime);
      compressor.ratio.setValueAtTime(3, ctx.currentTime);
      compressor.attack.setValueAtTime(0.003, ctx.currentTime);
      compressor.release.setValueAtTime(0.2, ctx.currentTime);
      bus.connect(compressor);
      compressor.connect(ctx.destination);
      this.sfxBus = bus;
      this.sfxCompressor = compressor;
    }
    return this.sfxBus;
  }

  private scaleSfxVolume(baseVolume: number): number {
    return Math.min(0.15, Math.max(0.0001, baseVolume * this.sfxGainBoost));
  }

  private getNoiseBuffer(ctx: AudioContext): AudioBuffer {
    if (this.noiseBuffer && this.noiseBuffer.sampleRate === ctx.sampleRate) {
      return this.noiseBuffer;
    }

    const length = ctx.sampleRate * 2;
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < length; i += 1) {
      data[i] = Math.random() * 2 - 1;
    }
    this.noiseBuffer = buffer;
    return buffer;
  }
}
