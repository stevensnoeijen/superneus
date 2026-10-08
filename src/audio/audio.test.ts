import { describe, expect, it } from 'vitest';
import { createAudio } from './index';

describe('audio before unlock (no AudioContext)', () => {
  it('every sound is a safe no-op', () => {
    const a = createAudio();
    const calls = [a.punch, a.kick, a.whoosh, () => a.hit(true), () => a.hit(false), a.block, a.knife, a.jump,
      a.sniff, a.wordThrow, a.ko, a.victory, a.defeat, a.fightStart, a.music.start, a.music.stop];
    for (const c of calls) expect(() => c()).not.toThrow();
  });

  it('mute state is remembered even before unlock', () => {
    const a = createAudio();
    expect(a.muted).toBe(false);
    a.setMuted(true);
    expect(a.muted).toBe(true);
  });

  it('unlock without Web Audio does not throw', () => {
    expect(() => createAudio().unlock()).not.toThrow();
  });
});
