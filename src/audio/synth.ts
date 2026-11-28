// Procedural Web Audio API tactile sound synthesizer (muted by default for distraction-free focus)

class DojoSynth {
  private ctx: AudioContext | null = null;
  private muted = true;

  constructor() {
    try {
      // Keystroke SFX is OFF by default for distraction-free memory building; only enable if user explicitly opts in
      this.muted = localStorage.getItem('inkkey_sfx_enabled') !== 'true';
    } catch {
      this.muted = true;
    }
  }

  public isMuted(): boolean {
    return this.muted;
  }

  public setMuted(val: boolean): void {
    this.muted = val;
    try {
      localStorage.setItem('inkkey_sfx_enabled', String(!val));
    } catch {
      // Ignore
    }
  }

  private ensureContext(ignoreKeySfxMute = false): AudioContext | null {
    if (!ignoreKeySfxMute && this.muted) return null;
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume().catch(() => {});
    }
    return this.ctx;
  }

  public getMetronomeAudioTime(): number | null {
    const ctx = this.ensureContext(true);
    if (!ctx || ctx.state !== 'running') return null;
    return ctx.currentTime;
  }

  // Whisper-soft sandalwood/guqin damped pulse for the invisible rhythm beat track
  public playMetronomeTick(isDownbeat: boolean, volumeScale = 1, when?: number): void {
    const ctx = this.ensureContext(true);
    if (!ctx) return;
    const t = when !== undefined ? Math.max(ctx.currentTime, when) : ctx.currentTime;
    const vol = Math.max(0, Math.min(1.5, volumeScale));

    const osc = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc.type = isDownbeat ? 'triangle' : 'sine';
    const startHz = isDownbeat ? 295 : 225;
    const endHz = isDownbeat ? 168 : 142;
    const decay = isDownbeat ? 0.044 : 0.030;
    const peakGain = (isDownbeat ? 0.048 : 0.025) * vol;

    osc.frequency.setValueAtTime(startHz, t);
    osc.frequency.exponentialRampToValueAtTime(endHz, t + decay);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(isDownbeat ? 640 : 460, t);

    gain.gain.setValueAtTime(0.0001, t);
    gain.gain.linearRampToValueAtTime(peakGain, t + 0.004);
    gain.gain.exponentialRampToValueAtTime(0.0001, t + decay + 0.008);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(t);
    osc.stop(t + decay + 0.015);
  }

  // Soft muted mechanical keycap thock (no distracting ding-ding chimes)
  public playKeyHit(_combo: number, isWordComplete: boolean): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const bodyOsc = ctx.createOscillator();
    const bodyGain = ctx.createGain();
    bodyOsc.type = 'triangle';
    bodyOsc.frequency.setValueAtTime(isWordComplete ? 185 : 155, now);
    bodyOsc.frequency.exponentialRampToValueAtTime(56, now + 0.042);
    bodyGain.gain.setValueAtTime(isWordComplete ? 0.14 : 0.1, now);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, now + 0.048);
    bodyOsc.connect(bodyGain).connect(ctx.destination);
    bodyOsc.start(now);
    bodyOsc.stop(now + 0.052);
  }

  // Muted wooden tap for wrong key (non-harsh, fast motor feedback)
  public playKeyMiss(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;

    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sawtooth';
    osc.frequency.setValueAtTime(145, now);
    osc.frequency.exponentialRampToValueAtTime(78, now + 0.09);

    const filter = ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(340, now);

    gain.gain.setValueAtTime(0.14, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.1);

    osc.connect(filter).connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.11);
  }

  // Combo milestone fanfare (10x, 25x, 50x)
  public playMilestone(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.5];
    notes.forEach((hz, i) => {
      const t = now + i * 0.055;
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(hz, t);
      gain.gain.setValueAtTime(0.09, t);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.28);
      osc.connect(gain).connect(ctx.destination);
      osc.start(t);
      osc.stop(t + 0.3);
    });
  }

  // Tile reached bottom / life lost
  public playLifeLost(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(220, now);
    osc.frequency.exponentialRampToValueAtTime(92, now + 0.28);
    gain.gain.setValueAtTime(0.18, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.3);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.32);
  }

  // Clean UI click
  public playClick(): void {
    const ctx = this.ensureContext();
    if (!ctx) return;
    const now = ctx.currentTime;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(420, now);
    osc.frequency.exponentialRampToValueAtTime(260, now + 0.035);
    gain.gain.setValueAtTime(0.07, now);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 0.04);
    osc.connect(gain).connect(ctx.destination);
    osc.start(now);
    osc.stop(now + 0.045);
  }

  // Warm C-major pentatonic + color tones mapped smoothly from Left bass to Right treble across all 26 keys
  private static readonly PIANO_KEY_FREQ: Record<string, number> = {
    // Left hand (warm bass & tenor, C3–A4)
    q: 130.81, // C3
    a: 146.83, // D3
    z: 164.81, // E3
    w: 196.0,  // G3
    s: 174.61, // F3 (home ring)
    x: 164.81, // E3
    e: 220.0,  // A3
    d: 196.0,  // G3 (home middle)
    c: 196.0,  // G3
    r: 261.63, // C4
    f: 220.0,  // A3 (home index)
    v: 246.94, // B3
    t: 293.66, // D4
    g: 261.63, // C4 (home inner)
    b: 293.66, // D4
    // Right hand (bright lyrical treble, D4–G5)
    y: 329.63, // E4
    h: 293.66, // D4 (home inner)
    n: 329.63, // E4
    u: 392.0,  // G4
    j: 329.63, // E4 (home index)
    m: 392.0,  // G4
    i: 440.0,  // A4
    k: 392.0,  // G4 (home middle)
    o: 523.25, // C5
    l: 440.0,  // A4 (home ring)
    p: 587.33, // D5
    ';': 523.25, // C5 (home pinky)
    ',': 440.0,  // A4
    '.': 523.25, // C5
    '/': 587.33, // D5
  };

  // Gentle Rhodes-like felt-piano single key depression tone
  public playPianoNote(key: string, forceSound = false): void {
    const ctx = this.ensureContext(forceSound);
    if (!ctx) return;
    const hz = DojoSynth.PIANO_KEY_FREQ[key.toLowerCase()] ?? 261.63;
    const now = ctx.currentTime;

    const osc1 = ctx.createOscillator();
    const osc2 = ctx.createOscillator();
    const filter = ctx.createBiquadFilter();
    const gain = ctx.createGain();

    osc1.type = 'sine';
    osc2.type = 'triangle';
    osc1.frequency.setValueAtTime(hz, now);
    osc2.frequency.setValueAtTime(hz * 2, now);

    const harmGain = ctx.createGain();
    harmGain.gain.setValueAtTime(0.18, now);
    harmGain.gain.exponentialRampToValueAtTime(0.01, now + 0.14);

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(Math.min(2600, hz * 5.2), now);
    filter.frequency.exponentialRampToValueAtTime(Math.max(480, hz * 2.1), now + 0.24);

    gain.gain.setValueAtTime(0.0001, now);
    gain.gain.linearRampToValueAtTime(0.085, now + 0.008);
    gain.gain.exponentialRampToValueAtTime(0.0008, now + 0.32);

    osc1.connect(filter);
    osc2.connect(harmGain).connect(filter);
    filter.connect(gain).connect(ctx.destination);

    osc1.start(now);
    osc2.start(now);
    osc1.stop(now + 0.34);
    osc2.stop(now + 0.34);
  }

  // Expressive warm piano chord bloom when a simultaneous chord commits
  public playPianoChord(keys: string[], isCharComplete = false, forceSound = false): void {
    const ctx = this.ensureContext(forceSound);
    if (!ctx || keys.length === 0) return;
    const now = ctx.currentTime;
    const uniqueKeys = Array.from(new Set(keys.map((k) => k.toLowerCase())));
    const freqs = uniqueKeys
      .map((k) => DojoSynth.PIANO_KEY_FREQ[k] ?? 261.63)
      .sort((a, b) => a - b);

    // On full character completion, add a luminous octave shimmer on the top voice
    const notes = isCharComplete ? [...freqs, Math.min(1046.5, freqs[freqs.length - 1] * 2)] : freqs;
    const perVoicePeak = Math.min(0.095, 0.22 / Math.max(1, notes.length));
    const sustain = isCharComplete ? 0.68 : 0.44;

    notes.forEach((hz, idx) => {
      const start = now + idx * 0.012; // subtle harp-like micro-roll (12ms) for natural pianist bloom
      const fundamental = ctx.createOscillator();
      const overtone = ctx.createOscillator();
      const overtoneGain = ctx.createGain();
      const filter = ctx.createBiquadFilter();
      const gain = ctx.createGain();

      fundamental.type = 'sine';
      overtone.type = 'triangle';
      fundamental.frequency.setValueAtTime(hz, start);
      overtone.frequency.setValueAtTime(hz * 2, start);

      overtoneGain.gain.setValueAtTime(0.22, start);
      overtoneGain.gain.exponentialRampToValueAtTime(0.008, start + sustain * 0.65);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(Math.min(3200, hz * 6), start);
      filter.frequency.exponentialRampToValueAtTime(Math.max(520, hz * 2.2), start + sustain);

      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.linearRampToValueAtTime(perVoicePeak, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0008, start + sustain);

      fundamental.connect(filter);
      overtone.connect(overtoneGain).connect(filter);
      filter.connect(gain).connect(ctx.destination);

      fundamental.start(start);
      overtone.start(start);
      fundamental.stop(start + sustain + 0.04);
      overtone.stop(start + sustain + 0.04);
    });
  }
}

export const synth = new DojoSynth();
