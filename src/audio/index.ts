// Programmatic Web Audio SFX for Superneus vs Potterpim. No audio files.
// API: createAudio() -> { unlock, punch, kick, whoosh, hit(heavy), block, jump,
//   sniff, wordThrow, ko, victory, defeat, fightStart, setMuted(bool), muted,
//   music: { start(), stop(), playing } }
// music is an optional low-volume looping beat; it stays silent until music.start().

export interface AudioMusic {
  readonly playing: boolean;
  start(): void;
  stop(): void;
}

export interface Audio {
  unlock(): void;
  readonly muted: boolean;
  setMuted(m: boolean): void;
  punch(): void;
  kick(): void;
  whoosh(): void;
  hit(heavy?: boolean): void;
  block(): void;
  /** blade being drawn: metallic scrape + ringing 'shiiing' */
  knife(): void;
  jump(): void;
  sniff(): void;
  wordThrow(): void;
  ko(): void;
  victory(): void;
  defeat(): void;
  fightStart(): void;
  music: AudioMusic;
}

type Reg = <T extends AudioNode>(n: T) => T;
type Builder = (t: number, out: GainNode, reg: Reg) => AudioScheduledSourceNode[] | undefined;
type WindowWithWebkit = Window & { webkitAudioContext?: typeof AudioContext };

const MAX_VOICES = 16;
const MASTER_VOL = 0.8;

const vary = (amt = 0.06): number => 1 + (Math.random() * 2 - 1) * amt;

export function createAudio(): Audio {
  let ctx: AudioContext | null = null;
  let master: GainNode | null = null;
  let noise: AudioBuffer | null = null;
  let brown: AudioBuffer | null = null;
  let shaper: Float32Array<ArrayBuffer> | null = null;
  let voices = 0;
  let muted = false;

  function unlock() {
    try {
      if (!ctx) {
        const AC = typeof window !== 'undefined' && (window.AudioContext || (window as WindowWithWebkit).webkitAudioContext);
        if (!AC) return;
        ctx = new AC();
        master = ctx.createGain();
        master.gain.value = muted ? 0 : MASTER_VOL;
        const comp = ctx.createDynamicsCompressor();
        comp.threshold.value = -14;
        comp.ratio.value = 6;
        master.connect(comp);
        comp.connect(ctx.destination);

        const len = ctx.sampleRate * 2;
        noise = ctx.createBuffer(1, len, ctx.sampleRate);
        brown = ctx.createBuffer(1, len, ctx.sampleRate);
        const w = noise.getChannelData(0);
        const b = brown.getChannelData(0);
        let last = 0;
        for (let i = 0; i < len; i++) {
          w[i] = Math.random() * 2 - 1;
          last = (last + 0.02 * w[i]) / 1.02;
          b[i] = last * 3.5;
        }
        const curve = new Float32Array(1024);
        for (let i = 0; i < 1024; i++) {
          const x = (i / 1023) * 2 - 1;
          curve[i] = ((Math.PI + 30) * x) / (Math.PI + 30 * Math.abs(x));
        }
        shaper = curve;
      }
      if (ctx.state === 'suspended') ctx.resume();
    } catch {
      ctx = null;
    }
  }

  const ready = (): boolean => !!ctx && !!master && ctx.state !== 'closed';
  // Only called after ready() has been checked (or inside a try that tolerates a throw).
  const ac = (): AudioContext => {
    if (!ctx) throw new Error('audio not ready');
    return ctx;
  };
  const mst = (): GainNode => {
    if (!master) throw new Error('audio not ready');
    return master;
  };

  // Run a sound builder safely with voice cap. builder(t, out) returns list of sources.
  function play(builder: Builder, gain = 1) {
    if (!ready() || voices >= MAX_VOICES) return;
    try {
      const t = ac().currentTime + 0.005;
      const out = ac().createGain();
      out.gain.value = gain;
      out.connect(mst());
      const nodes: AudioNode[] = [out];
      const reg: Reg = (n) => (nodes.push(n), n);
      const sources = builder(t, out, reg) || [];
      if (!sources.length) return;
      voices++;
      let left = sources.length;
      for (const s of sources) {
        s.addEventListener('ended', () => {
          if (--left === 0) {
            voices--;
            for (const n of nodes) { try { n.disconnect(); } catch {} }
            for (const x of sources) { try { x.disconnect(); } catch {} }
          }
        });
      }
    } catch { /* ignore */ }
  }

  // helpers
  function env(reg: Reg, dest: AudioNode, t: number, a: number, peak: number, d: number) {
    const g = reg(ac().createGain());
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + d);
    g.connect(dest);
    return g;
  }
  function osc(type: OscillatorType, freq: number, t: number, dur: number) {
    const o = ac().createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t);
    o.start(t);
    o.stop(t + dur + 0.05);
    return o;
  }
  function noiseSrc(t: number, dur: number, buf: AudioBuffer | null = noise) {
    const s = ac().createBufferSource();
    s.buffer = buf;
    s.loop = true;
    s.start(t, Math.random() * 1.5);
    s.stop(t + dur + 0.05);
    return s;
  }
  function filt(reg: Reg, type: BiquadFilterType, f: number, q = 1) {
    const b = reg(ac().createBiquadFilter());
    b.type = type;
    b.frequency.value = f;
    b.Q.value = q;
    return b;
  }

  function thud(t: number, out: AudioNode, reg: Reg, f0: number, f1: number, dur: number, vol: number) {
    const o = osc('sine', f0, t, dur);
    o.frequency.exponentialRampToValueAtTime(f1, t + dur);
    o.connect(env(reg, out, t, 0.004, vol, dur));
    return o;
  }

  const api = {
    unlock,
    get muted() { return muted; },
    setMuted(m: boolean) {
      muted = !!m;
      if (!ready()) return;
      try {
        const g = mst().gain, t = ac().currentTime;
        g.cancelScheduledValues(t);
        g.setValueAtTime(g.value, t);
        g.linearRampToValueAtTime(muted ? 0 : MASTER_VOL, t + 0.08);
      } catch {}
    },

    punch() {
      play((t, out, reg) => {
        const p = vary();
        const o = thud(t, out, reg, 150 * p, 50, 0.14, 0.9);
        const n = noiseSrc(t, 0.03);
        const f = filt(reg, 'bandpass', 2500 * p, 1.2);
        n.connect(f); f.connect(env(reg, out, t, 0.001, 0.5, 0.03));
        return [o, n];
      });
    },

    kick() {
      play((t, out, reg) => {
        const p = vary();
        const o = thud(t, out, reg, 120 * p, 35, 0.25, 1);
        const n = noiseSrc(t, 0.12, brown);
        const f = filt(reg, 'lowpass', 900 * p, 0.8);
        n.connect(f); f.connect(env(reg, out, t, 0.002, 0.8, 0.12));
        return [o, n];
      });
    },

    whoosh() {
      play((t, out, reg) => {
        const p = vary(0.15);
        const n = noiseSrc(t, 0.25);
        const f = filt(reg, 'bandpass', 400 * p, 2.5);
        f.frequency.exponentialRampToValueAtTime(2800 * p, t + 0.12);
        f.frequency.exponentialRampToValueAtTime(900, t + 0.25);
        n.connect(f); f.connect(env(reg, out, t, 0.06, 0.45, 0.19));
        return [n];
      });
    },

    hit(heavy = false) {
      play((t, out, reg) => {
        const p = vary();
        const dur = heavy ? 0.35 : 0.18;
        const o = thud(t, out, reg, (heavy ? 110 : 180) * p, heavy ? 30 : 60, dur, 1);
        const n = noiseSrc(t, dur);
        const f = filt(reg, 'lowpass', heavy ? 2000 : 3500, 1);
        const e = env(reg, out, t, 0.002, heavy ? 0.9 : 0.6, dur * 0.7);
        n.connect(f);
        if (heavy) {
          const ws = reg(ac().createWaveShaper());
          ws.curve = shaper; ws.oversample = '2x';
          f.connect(ws); ws.connect(e);
        } else f.connect(e);
        // crunchy square crack
        const c = osc('square', 90 * p, t, 0.05);
        c.connect(env(reg, out, t, 0.001, 0.25, 0.05));
        return [o, n, c];
      }, 1);
    },

    knife() {
      play((t, out, reg) => {
        // scrape: noise through a rising, resonant bandpass (blade sliding out of the sheath)
        const n = noiseSrc(t, 0.32);
        const bp = filt(reg, 'bandpass', 1800, 7);
        bp.frequency.setValueAtTime(1800, t);
        bp.frequency.exponentialRampToValueAtTime(7200, t + 0.28);
        n.connect(bp);
        bp.connect(env(reg, out, t, 0.02, 0.35, 0.3));
        // ring: inharmonic metal partials that start as the scrape ends and decay slowly
        const ring = t + 0.22;
        const partials: [number, number][] = [[2480, 0.16], [3710, 0.11], [5230, 0.08], [7390, 0.05]];
        const oscs = partials.map(([f, peak]) => {
          const o = osc('sine', f * vary(0.01), ring, 1.4);
          o.connect(env(reg, out, ring, 0.004, peak, 1.3));
          return o;
        });
        return [n, ...oscs];
      });
    },

    block() {
      play((t, out, reg) => {
        const p = vary(0.08);
        const a = osc('triangle', 820 * p, t, 0.12);
        const b = osc('square', 1230 * p, t, 0.06);
        const lp = filt(reg, 'lowpass', 2200, 0.7);
        a.connect(lp); b.connect(lp);
        lp.connect(env(reg, out, t, 0.001, 0.4, 0.1));
        const n = noiseSrc(t, 0.02);
        n.connect(env(reg, out, t, 0.001, 0.2, 0.02));
        return [a, b, n];
      });
    },

    jump() {
      play((t, out, reg) => {
        const p = vary(0.05);
        const o = osc('square', 260 * p, t, 0.14);
        o.frequency.exponentialRampToValueAtTime(760 * p, t + 0.12);
        o.connect(env(reg, out, t, 0.005, 0.18, 0.13));
        return [o];
      });
    },

    sniff() {
      play((t, out, reg) => {
        const D = 0.8;
        const n = noiseSrc(t, D);
        const f = filt(reg, 'bandpass', 300, 4);
        f.frequency.exponentialRampToValueAtTime(3500, t + D);
        const g = reg(ac().createGain());
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.7, t + D * 0.85);
        g.gain.exponentialRampToValueAtTime(0.0001, t + D);
        n.connect(f); f.connect(g); g.connect(out);
        // nasal honk
        const h = t + D;
        const o1 = osc('sawtooth', 330, h, 0.22);
        const o2 = osc('square', 336, h, 0.22);
        o1.frequency.linearRampToValueAtTime(300, h + 0.22);
        const nf = filt(reg, 'bandpass', 1100, 6);
        o1.connect(nf); o2.connect(nf);
        nf.connect(env(reg, out, h, 0.01, 0.6, 0.21));
        return [n, o1, o2];
      });
    },

    wordThrow() {
      play((t, out, reg) => {
        const p = vary(0.08);
        const D = 0.6;
        const o = osc('sawtooth', 170 * p, t, D);
        const lfo = osc('sine', 7, t, D);
        const lg = reg(ac().createGain()); lg.gain.value = 12;
        lfo.connect(lg); lg.connect(o.frequency);
        const f = filt(reg, 'bandpass', 700, 5);
        // "blah-blah-blah": formant hops + amplitude syllables
        const g = reg(ac().createGain());
        g.gain.setValueAtTime(0.0001, t);
        const syl = 4, sd = D / syl;
        for (let i = 0; i < syl; i++) {
          const s = t + i * sd;
          f.frequency.setValueAtTime(i % 2 ? 1100 : 650, s);
          f.frequency.linearRampToValueAtTime(i % 2 ? 750 : 1000, s + sd);
          g.gain.setValueAtTime(0.0001, s);
          g.gain.exponentialRampToValueAtTime(0.6, s + 0.02);
          g.gain.exponentialRampToValueAtTime(0.0001, s + sd * 0.9);
        }
        o.connect(f); f.connect(g); g.connect(out);
        return [o, lfo];
      });
    },

    ko() {
      play((t, out, reg) => {
        const o = osc('sine', 1800, t, 0.9);
        o.frequency.exponentialRampToValueAtTime(180, t + 0.9);
        const v = osc('sine', 6, t, 0.9);
        const vg = reg(ac().createGain()); vg.gain.value = 25;
        v.connect(vg); vg.connect(o.frequency);
        o.connect(env(reg, out, t, 0.02, 0.35, 0.88));
        const b = t + 0.9;
        const boom = thud(b, out, reg, 90, 25, 1.0, 1);
        const n = noiseSrc(b, 0.9, brown);
        const ws = reg(ac().createWaveShaper()); ws.curve = shaper;
        const lp = filt(reg, 'lowpass', 600, 0.7);
        n.connect(ws); ws.connect(lp); lp.connect(env(reg, out, b, 0.003, 1, 0.9));
        return [o, v, boom, n];
      });
    },

    victory() {
      play((t, out, reg) => {
        // C E G C' - G C'' (8-bit fanfare)
        const notes: [number, number][] = [[523, 0.12], [659, 0.12], [784, 0.12], [1047, 0.25], [0, 0.08],
          [784, 0.12], [1047, 0.6]];
        const srcs: AudioScheduledSourceNode[] = [];
        let s = t;
        for (const [f, d] of notes) {
          if (f) {
            const a = osc('square', f, s, d);
            a.connect(env(reg, out, s, 0.005, 0.18, d));
            const b = osc('triangle', f / 2, s, d);
            b.connect(env(reg, out, s, 0.005, 0.35, d));
            srcs.push(a, b);
          }
          s += d + 0.03;
        }
        return srcs;
      });
    },

    defeat() {
      play((t, out, reg) => {
        const notes: [number, number][] = [[311, 0.35], [294, 0.35], [277, 0.35], [262, 1.1]];
        const srcs: AudioScheduledSourceNode[] = [];
        let s = t;
        notes.forEach(([f, d], i) => {
          const o = osc('sawtooth', f, s, d);
          if (i === 3) {
            const v = osc('sine', 5, s, d);
            const vg = reg(ac().createGain()); vg.gain.value = 8;
            v.connect(vg); vg.connect(o.frequency);
            o.frequency.linearRampToValueAtTime(f * 0.92, s + d);
            srcs.push(v);
          }
          const lp = filt(reg, 'lowpass', 900, 3);
          lp.frequency.setValueAtTime(400, s);
          lp.frequency.linearRampToValueAtTime(1200, s + 0.12);
          lp.frequency.linearRampToValueAtTime(500, s + d);
          o.connect(lp);
          lp.connect(env(reg, out, s, 0.04, 0.45, d - 0.04));
          srcs.push(o);
          s += d + 0.05;
        });
        return srcs;
      });
    },

    fightStart() {
      play((t, out, reg) => {
        const srcs: AudioScheduledSourceNode[] = [];
        // gong: inharmonic partials
        ([[110, 1], [167, 0.6], [231, 0.45], [298, 0.3], [412, 0.2]] as [number, number][]).forEach(([f, a]) => {
          const o = osc('sine', f, t, 2);
          o.connect(env(reg, out, t, 0.005, 0.45 * a, 2));
          srcs.push(o);
        });
        const n = noiseSrc(t, 0.15);
        const hp = filt(reg, 'highpass', 3000, 0.7);
        n.connect(hp); hp.connect(env(reg, out, t, 0.001, 0.3, 0.15));
        srcs.push(n);
        // stinger: two quick power chords
        ([[0.35, 196], [0.5, 262]] as [number, number][]).forEach(([dt, f]) => {
          const s = t + dt;
          [f, f * 1.5, f * 2].forEach((ff) => {
            const o = osc('sawtooth', ff, s, 0.3);
            const lp = filt(reg, 'lowpass', 2000, 1);
            o.connect(lp); lp.connect(env(reg, out, s, 0.005, 0.15, 0.3));
            srcs.push(o);
          });
        });
        return srcs;
      });
    },
  };

  // ---- optional background beat (lookahead scheduler) ----
  const music = (() => {
    let timer: ReturnType<typeof setInterval> | null = null, nextTime = 0, step = 0;
    let bus: GainNode | null = null;
    const BPM = 132, SPB = 60 / BPM / 4; // 16th notes
    const bass: number[] = [55, 0, 55, 0, 65.4, 0, 55, 0, 73.4, 0, 55, 0, 65.4, 0, 49, 0];
    function tick() {
      if (!ready()) return;
      while (nextTime < ac().currentTime + 0.12) {
        const t = nextTime, s = step % 16;
        try {
          if (s % 4 === 0) beatVoice(t, 'kick');
          if (s === 4 || s === 12) beatVoice(t, 'snare');
          if (s % 2 === 0) beatVoice(t, 'hat');
          const bf = bass[s];
          if (bf) beatVoice(t, 'bass', bf);
        } catch {}
        nextTime += SPB; step++;
      }
    }
    function beatVoice(t: number, kind: 'kick' | 'snare' | 'hat' | 'bass', f = 0) {
      const g = ac().createGain();
      if (!bus) return;
      g.connect(bus);
      let src: AudioScheduledSourceNode;
      if (kind === 'kick') {
        const o = osc('sine', 120, t, 0.15);
        src = o;
        o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
        g.gain.setValueAtTime(0.8, t); g.gain.exponentialRampToValueAtTime(0.0001, t + 0.15);
        src.connect(g);
      } else if (kind === 'bass') {
        src = osc('triangle', f, t, SPB * 1.8);
        g.gain.setValueAtTime(0.5, t); g.gain.exponentialRampToValueAtTime(0.0001, t + SPB * 1.8);
        src.connect(g);
      } else {
        const d = kind === 'hat' ? 0.03 : 0.1;
        src = noiseSrc(t, d);
        const f2 = ac().createBiquadFilter();
        f2.type = kind === 'hat' ? 'highpass' : 'bandpass';
        f2.frequency.value = kind === 'hat' ? 7000 : 1800;
        g.gain.setValueAtTime(kind === 'hat' ? 0.15 : 0.4, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + d);
        src.connect(f2); f2.connect(g);
        src.addEventListener('ended', () => { try { f2.disconnect(); g.disconnect(); } catch {} });
        return;
      }
      const node = src;
      src.addEventListener('ended', () => { try { node.disconnect(); g.disconnect(); } catch {} });
    }
    return {
      get playing() { return !!timer; },
      start() {
        if (!ready() || timer) return;
        try {
          const b = ac().createGain();
          b.gain.value = 0.18;
          b.connect(mst());
          bus = b;
          nextTime = ac().currentTime + 0.05; step = 0;
          timer = setInterval(tick, 25);
        } catch {}
      },
      stop() {
        if (timer) clearInterval(timer);
        timer = null;
        if (bus && ready()) {
          try {
            const b = bus, t = ac().currentTime;
            b.gain.setValueAtTime(b.gain.value, t);
            b.gain.linearRampToValueAtTime(0, t + 0.2);
            setTimeout(() => { try { b.disconnect(); } catch {} }, 400);
          } catch {}
        }
        bus = null;
      },
    };
  })();
  const audio: Audio = Object.assign(api, { music });
  return audio;
}
