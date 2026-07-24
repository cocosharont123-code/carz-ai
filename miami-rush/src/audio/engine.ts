/**
 * Fully synthesized audio (no files). A saw+square engine tone pitched to speed
 * through a lowpass, a noise-band boost layer that grows with speed, a whoosh on
 * near miss, and an impact + pitch-drop on crash. Context is created on the
 * first user gesture; mute toggle included.
 */
export class AudioEngine {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private muted = false;
  private started = false;

  // engine graph
  private saw: OscillatorNode | null = null;
  private square: OscillatorNode | null = null;
  private engineGain: GainNode | null = null;
  private engineLow: BiquadFilterNode | null = null;
  private noiseSrc: AudioBufferSourceNode | null = null;
  private noiseBand: BiquadFilterNode | null = null;
  private noiseGain: GainNode | null = null;
  private noiseBuf: AudioBuffer | null = null;

  /** Must be called from a user gesture. Safe to call repeatedly. */
  ensure(): void {
    if (this.ctx) {
      if (this.ctx.state === "suspended") void this.ctx.resume();
      return;
    }
    const Ctor = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    this.ctx = new Ctor();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.9;
    this.master.connect(this.ctx.destination);

    // reusable white-noise buffer
    const len = this.ctx.sampleRate * 2;
    this.noiseBuf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = this.noiseBuf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
  }

  /** Start the continuous engine tone (call when entering play). */
  startEngine(): void {
    if (!this.ctx || !this.master || this.started) return;
    const ctx = this.ctx;

    this.engineLow = ctx.createBiquadFilter();
    this.engineLow.type = "lowpass";
    this.engineLow.frequency.value = 700;

    this.engineGain = ctx.createGain();
    this.engineGain.gain.value = 0.16;

    this.saw = ctx.createOscillator();
    this.saw.type = "sawtooth";
    this.saw.frequency.value = 70;
    this.square = ctx.createOscillator();
    this.square.type = "square";
    this.square.frequency.value = 47;

    this.saw.connect(this.engineGain);
    this.square.connect(this.engineGain);
    this.engineGain.connect(this.engineLow);
    this.engineLow.connect(this.master);
    this.saw.start();
    this.square.start();

    // noise boost layer
    this.noiseSrc = ctx.createBufferSource();
    this.noiseSrc.buffer = this.noiseBuf;
    this.noiseSrc.loop = true;
    this.noiseBand = ctx.createBiquadFilter();
    this.noiseBand.type = "bandpass";
    this.noiseBand.frequency.value = 900;
    this.noiseBand.Q.value = 0.8;
    this.noiseGain = ctx.createGain();
    this.noiseGain.gain.value = 0.0;
    this.noiseSrc.connect(this.noiseBand);
    this.noiseBand.connect(this.noiseGain);
    this.noiseGain.connect(this.master);
    this.noiseSrc.start();

    this.started = true;
  }

  stopEngine(): void {
    this.saw?.stop();
    this.square?.stop();
    this.noiseSrc?.stop();
    this.saw = this.square = null;
    this.noiseSrc = null;
    this.started = false;
  }

  /** speedFrac 0..1 of top speed. */
  setSpeed(frac: number): void {
    if (!this.ctx || !this.saw || !this.square || !this.engineLow || !this.noiseBand || !this.noiseGain) return;
    const t = this.ctx.currentTime;
    const base = 70 + frac * 230; // engine pitch
    this.saw.frequency.setTargetAtTime(base, t, 0.08);
    this.square.frequency.setTargetAtTime(base * 0.66, t, 0.08);
    this.engineLow.frequency.setTargetAtTime(600 + frac * 5200, t, 0.1);
    this.noiseBand.frequency.setTargetAtTime(700 + frac * 2600, t, 0.12);
    this.noiseGain.gain.setTargetAtTime(0.015 + frac * 0.11, t, 0.15);
  }

  nearMiss(): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const band = ctx.createBiquadFilter();
    band.type = "bandpass";
    band.Q.value = 1.1;
    band.frequency.setValueAtTime(500, ctx.currentTime);
    band.frequency.exponentialRampToValueAtTime(4200, ctx.currentTime + 0.22);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 0.04);
    g.gain.exponentialRampToValueAtTime(0.0001, ctx.currentTime + 0.34);
    src.connect(band);
    band.connect(g);
    g.connect(this.master);
    src.start();
    src.stop(ctx.currentTime + 0.36);
  }

  crash(): void {
    if (!this.ctx || !this.master || !this.noiseBuf) return;
    const ctx = this.ctx;
    const t = ctx.currentTime;

    // impact noise burst
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    const low = ctx.createBiquadFilter();
    low.type = "lowpass";
    low.frequency.setValueAtTime(2600, t);
    low.frequency.exponentialRampToValueAtTime(200, t + 0.5);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.7);
    src.connect(low);
    low.connect(g);
    g.connect(this.master);
    src.start();
    src.stop(t + 0.72);

    // pitch-drop thump
    const osc = ctx.createOscillator();
    osc.type = "sawtooth";
    osc.frequency.setValueAtTime(220, t);
    osc.frequency.exponentialRampToValueAtTime(40, t + 0.5);
    const og = ctx.createGain();
    og.gain.setValueAtTime(0.5, t);
    og.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
    osc.connect(og);
    og.connect(this.master);
    osc.start();
    osc.stop(t + 0.62);

    // drop the engine layer out
    this.noiseGain?.gain.setTargetAtTime(0, t, 0.1);
  }

  toggleMute(): boolean {
    this.muted = !this.muted;
    if (this.master && this.ctx) this.master.gain.setTargetAtTime(this.muted ? 0 : 0.9, this.ctx.currentTime, 0.02);
    return this.muted;
  }

  get isMuted(): boolean {
    return this.muted;
  }

  suspend(): void {
    if (this.ctx?.state === "running") void this.ctx.suspend();
  }

  resume(): void {
    if (this.ctx?.state === "suspended") void this.ctx.resume();
  }
}
