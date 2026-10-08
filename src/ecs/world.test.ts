import { describe, expect, it } from 'vitest';
import { createMatch, updateMatch } from './index';
import type { Input } from '../types';

const IDLE: Input = { left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false };

describe('game world', () => {
  it('links the fighters as each other\'s opponent', () => {
    const m = createMatch();
    const [a, b] = m.queries.fighters.entities;
    expect(a.opponent).toBe(b);
    expect(b.opponent).toBe(a);
  });

  it('has exactly one player and one AI', () => {
    const m = createMatch();
    expect(m.queries.player.entities).toHaveLength(1);
    expect(m.queries.ai.entities).toHaveLength(1);
    expect(m.queries.player.entities[0].fighter.id).toBe('superneus');
  });

  it('uses the requested AI difficulty', () => {
    expect(createMatch({ difficulty: 'easy' }).queries.ai.entities[0].ai.cfg.block)
      .toBeLessThan(createMatch({ difficulty: 'hard' }).queries.ai.entities[0].ai.cfg.block);
  });

  it('advances match time in fixed steps', () => {
    const m = createMatch();
    updateMatch(m, 0.05, IDLE);
    expect(m.time).toBeCloseTo(0.05, 2);
    updateMatch(m, 5, IDLE); // a huge frame is clamped
    expect(m.time).toBeLessThan(0.2);
  });

  it('ignores input after the match is over', () => {
    const m = createMatch();
    m.active = true;
    m.over = true;
    const x = m.p1.x;
    updateMatch(m, 0.5, { ...IDLE, right: true });
    expect(m.p1.x).toBe(x);
  });
});
