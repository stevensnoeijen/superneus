import { describe, expect, it } from 'vitest';
import { COMBAT, MOVES, SPECIALS, WORD_TEXTS, WORLD } from './constants';
import { aiComponent, fighterComponent, inputComponent, playerControlledComponent } from '../ecs/components';
import { perfEnabled, perfMeasure } from '../perf';

describe('tuning data', () => {
  it('every move has positive timings and a sane hit band', () => {
    for (const [key, m] of Object.entries(MOVES)) {
      expect(m.startup, key).toBeGreaterThan(0);
      expect(m.active, key).toBeGreaterThan(0);
      expect(m.recovery, key).toBeGreaterThan(0);
      expect(m.yMax, key).toBeGreaterThanOrEqual(m.yMin);
    }
  });

  it('kicks reach further than punches; punches are faster', () => {
    expect(MOVES.kick.reach).toBeGreaterThan(MOVES.punch.reach);
    expect(MOVES.punch.startup).toBeLessThan(MOVES.kick.startup);
  });

  it('specials and words are defined', () => {
    expect(SPECIALS.sniff.damage).toBeGreaterThan(0);
    expect(SPECIALS.word.vx).toBeGreaterThan(0);
    expect(WORD_TEXTS.length).toBeGreaterThan(0);
  });

  it('the arena and fixed step are consistent', () => {
    expect(WORLD.minX).toBeLessThan(WORLD.startP1X);
    expect(WORLD.startP2X).toBeLessThan(WORLD.maxX);
    expect(COMBAT.step).toBeLessThan(COMBAT.maxDt);
  });
});

describe('component constructors', () => {
  it('build fresh, independent components', () => {
    const a = inputComponent();
    a.punch = true;
    expect(inputComponent().punch).toBe(false);
    expect(playerControlledComponent).toBe(true);
    expect(fighterComponent('potterpim', 670, -1)).toMatchObject({ id: 'potterpim', x: 670, facing: -1 });
    expect(aiComponent('hard').cfg).toBeDefined();
  });
});

describe('perf (disabled outside ?perf)', () => {
  it('is off in tests and still returns measured results', () => {
    expect(perfEnabled).toBe(false);
    expect(perfMeasure('x', () => 42)).toBe(42);
  });
});
