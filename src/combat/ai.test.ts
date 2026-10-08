import { describe, expect, it } from 'vitest';
import { createAI, updateAI } from './ai';
import { createFighter } from './fighter';

describe('AI', () => {
  it('uses the requested difficulty', () => {
    expect(createAI('easy').cfg.block).toBeLessThan(createAI('hard').cfg.block);
  });

  it('walks toward a far-away opponent', () => {
    const ai = createAI('normal');
    const me = createFighter('potterpim', 900, -1);
    const foe = createFighter('superneus', 100, 1);
    let left = 0;
    for (let i = 0; i < 120; i++) if (updateAI(ai, me, foe, 1 / 60).left) left++;
    expect(left).toBeGreaterThan(0);
  });

  it('always returns a complete input snapshot', () => {
    const input = updateAI(createAI(), createFighter('potterpim', 600, -1), createFighter('superneus', 400, 1), 1 / 60);
    expect(new Set(Object.keys(input))).toEqual(new Set(['block', 'down', 'kick', 'left', 'punch', 'right', 'special', 'up']));
  });
});
