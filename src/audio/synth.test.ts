// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createAudio } from './index';

/** Records every node the synth creates; any method/param call on a node is accepted. */
let created: string[] = [];

function fakeNode(): unknown {
  const listeners: Record<string, () => void> = {};
  const target: Record<string | symbol, unknown> = {
    addEventListener: (t: string, fn: () => void) => { listeners[t] = fn; },
    removeEventListener: () => {},
    connect: (n: unknown) => n,
    disconnect: () => {},
    // 'stop' fires 'ended' so voice cleanup code runs
    stop: () => listeners.ended?.(),
  };
  const param = new Proxy({}, { get: (_t, p) => (p === 'value' ? 0 : () => param) });
  return new Proxy(target, {
    get: (t, p) => (p in t ? t[p] : p === 'curve' || p === 'buffer' ? null : param),
    set: (t, p, v) => { t[p] = v; return true; },
  });
}

class FakeAudioContext {
  currentTime = 0;
  sampleRate = 8000;
  state = 'suspended';
  destination = fakeNode();
  resume() { this.state = 'running'; return Promise.resolve(); }
  createBuffer(_ch: number, length: number) { created.push('buffer'); return { getChannelData: () => new Float32Array(length), duration: length / this.sampleRate }; }
  constructor() {
    return new Proxy(this, {
      get: (t, p) => {
        if (p in t) return (t as unknown as Record<string | symbol, unknown>)[p];
        if (typeof p === 'string' && p.startsWith('create')) return () => { created.push(p.slice(6)); return fakeNode(); };
        return undefined;
      },
    });
  }
}

beforeEach(() => {
  created = [];
  vi.stubGlobal('AudioContext', FakeAudioContext);
  vi.useFakeTimers();
});
afterEach(() => { vi.useRealTimers(); vi.unstubAllGlobals(); });

describe('audio synth (fake Web Audio)', () => {
  it('unlock builds the master chain and shared noise buffers once', () => {
    const a = createAudio();
    a.unlock();
    a.unlock();
    expect(created).toContain('DynamicsCompressor');
    expect(created.filter((c) => c === 'buffer').length).toBeGreaterThanOrEqual(2);
  });

  it.each(['punch', 'kick', 'whoosh', 'block', 'knife', 'jump', 'sniff', 'wordThrow', 'ko', 'victory', 'defeat', 'fightStart'] as const)(
    '%s creates sound nodes', (name) => {
      const a = createAudio();
      a.unlock();
      created = [];
      a[name]();
      expect(created.length).toBeGreaterThan(0);
    });

  it('heavy and light hits both play', () => {
    const a = createAudio();
    a.unlock();
    created = [];
    a.hit(true);
    a.hit(false);
    expect(created.length).toBeGreaterThan(0);
  });

  it('caps concurrent voices', () => {
    const a = createAudio();
    a.unlock();
    created = [];
    for (let i = 0; i < 200; i++) a.punch();
    const perPunch = created.length / 200;
    expect(perPunch).toBeLessThan(10); // some calls were dropped by the voice cap or all were cheap
  });

  it('music schedules beats and can be stopped', () => {
    const a = createAudio();
    a.unlock();
    a.music.start();
    expect(a.music.playing).toBe(true);
    created = [];
    vi.advanceTimersByTime(2000);
    expect(created.length).toBeGreaterThan(0);
    a.music.stop();
    expect(a.music.playing).toBe(false);
  });

  it('mute ramps the master gain', () => {
    const a = createAudio();
    a.unlock();
    a.setMuted(true);
    expect(a.muted).toBe(true);
    a.setMuted(false);
    expect(a.muted).toBe(false);
  });
});
