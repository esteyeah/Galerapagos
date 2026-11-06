/**
 * Audio généré dans le navigateur (Web Audio), sans aucun fichier :
 * une ambiance tropicale (vagues + marimba pentatonique) et des bruitages.
 */
export type Sfx = 'draw' | 'white' | 'black' | 'disease' | 'death' | 'vote' | 'card' | 'shot' | 'thunder' | 'victory' | 'defeat' | 'click';

class AudioManager {
  private ctx: AudioContext | null = null;
  private master: GainNode | null = null;
  private musicGain: GainNode | null = null;
  private musicTimer: number | null = null;
  private waves: AudioBufferSourceNode | null = null;
  musicOn = false;
  sfxOn = true;

  private ensure(): AudioContext | null {
    if (!this.ctx) {
      try {
        this.ctx = new AudioContext();
        this.master = this.ctx.createGain();
        this.master.gain.value = 0.7;
        this.master.connect(this.ctx.destination);
      } catch {
        return null;
      }
    }
    if (this.ctx.state === 'suspended') void this.ctx.resume();
    return this.ctx;
  }

  private noiseBuffer(ctx: AudioContext, seconds: number): AudioBuffer {
    const buf = ctx.createBuffer(1, ctx.sampleRate * seconds, ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  private tone(freq: number, start: number, dur: number, type: OscillatorType, vol: number, dest?: AudioNode): void {
    const ctx = this.ctx!;
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    g.gain.setValueAtTime(0.0001, start);
    g.gain.exponentialRampToValueAtTime(vol, start + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, start + dur);
    osc.connect(g).connect(dest ?? this.master!);
    osc.start(start);
    osc.stop(start + dur + 0.05);
  }

  setMusic(on: boolean): void {
    this.musicOn = on;
    if (on) this.startMusic();
    else this.stopMusic();
  }

  private startMusic(): void {
    const ctx = this.ensure();
    if (!ctx || this.musicTimer !== null) return;
    this.musicGain = ctx.createGain();
    this.musicGain.gain.value = 0.0001;
    this.musicGain.gain.exponentialRampToValueAtTime(0.5, ctx.currentTime + 2);
    this.musicGain.connect(this.master!);

    // Vagues : bruit filtré dont le volume ondule lentement
    const waves = ctx.createBufferSource();
    waves.buffer = this.noiseBuffer(ctx, 4);
    waves.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 500;
    const wg = ctx.createGain();
    wg.gain.value = 0.05;
    const lfo = ctx.createOscillator();
    lfo.frequency.value = 0.12;
    const lfoGain = ctx.createGain();
    lfoGain.gain.value = 0.04;
    lfo.connect(lfoGain).connect(wg.gain);
    waves.connect(lp).connect(wg).connect(this.musicGain);
    waves.start();
    lfo.start();
    this.waves = waves;

    // Marimba pentatonique sur une grille d'accords
    const scale = [0, 2, 4, 7, 9];
    const roots = [57, 53, 60, 55]; // la, fa, do, sol
    let step = 0;
    const midi = (m: number) => 440 * Math.pow(2, (m - 69) / 12);
    const tick = () => {
      if (!this.ctx || !this.musicGain) return;
      const t = this.ctx.currentTime + 0.05;
      const root = roots[Math.floor(step / 16) % roots.length];
      if (step % 16 === 0) {
        this.tone(midi(root - 12), t, 3.5, 'sine', 0.08, this.musicGain);
        this.tone(midi(root - 5), t, 3.5, 'sine', 0.04, this.musicGain);
      }
      if (Math.random() < 0.55 || step % 4 === 0) {
        const note = root + 12 + scale[Math.floor(Math.random() * scale.length)] + (Math.random() < 0.3 ? 12 : 0);
        this.tone(midi(note), t, 0.5, 'triangle', 0.05, this.musicGain);
      }
      step++;
    };
    this.musicTimer = window.setInterval(tick, 230);
  }

  private stopMusic(): void {
    if (this.musicTimer !== null) window.clearInterval(this.musicTimer);
    this.musicTimer = null;
    if (this.ctx && this.musicGain) {
      const g = this.musicGain;
      g.gain.exponentialRampToValueAtTime(0.0001, this.ctx.currentTime + 0.8);
      const w = this.waves;
      window.setTimeout(() => {
        w?.stop();
        g.disconnect();
      }, 900);
    }
    this.musicGain = null;
    this.waves = null;
  }

  play(sfx: Sfx): void {
    if (!this.sfxOn) return;
    const ctx = this.ensure();
    if (!ctx) return;
    const t = ctx.currentTime + 0.01;
    switch (sfx) {
      case 'click':
        this.tone(880, t, 0.08, 'triangle', 0.08);
        break;
      case 'draw':
        this.tone(320, t, 0.09, 'square', 0.04);
        break;
      case 'white':
        this.tone(660, t, 0.15, 'triangle', 0.12);
        this.tone(990, t + 0.08, 0.2, 'triangle', 0.1);
        break;
      case 'black':
        this.tone(140, t, 0.5, 'sawtooth', 0.12);
        this.tone(110, t + 0.12, 0.6, 'sawtooth', 0.1);
        break;
      case 'disease':
        [400, 360, 320].forEach((f, i) => this.tone(f, t + i * 0.12, 0.25, 'sine', 0.1));
        break;
      case 'death':
        [220, 207, 196, 147].forEach((f, i) => this.tone(f, t + i * 0.35, 1.2, 'sine', 0.16));
        break;
      case 'vote':
        this.tone(523, t, 0.12, 'square', 0.05);
        break;
      case 'card':
        this.tone(740, t, 0.1, 'triangle', 0.08);
        this.tone(1100, t + 0.06, 0.12, 'triangle', 0.06);
        break;
      case 'shot': {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer(ctx, 0.5);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.6, t);
        g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
        src.connect(g).connect(this.master!);
        src.start(t);
        break;
      }
      case 'thunder': {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer(ctx, 3);
        const lp = ctx.createBiquadFilter();
        lp.type = 'lowpass';
        lp.frequency.value = 180;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.9, t + 0.1);
        g.gain.exponentialRampToValueAtTime(0.001, t + 2.8);
        src.connect(lp).connect(g).connect(this.master!);
        src.start(t);
        break;
      }
      case 'victory':
        [523, 659, 784, 1047].forEach((f, i) => this.tone(f, t + i * 0.15, 0.5, 'triangle', 0.12));
        break;
      case 'defeat':
        [392, 330, 262, 196].forEach((f, i) => this.tone(f, t + i * 0.3, 0.8, 'sine', 0.12));
        break;
    }
  }
}

export const audio = new AudioManager();
