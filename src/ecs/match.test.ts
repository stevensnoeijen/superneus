import { describe, expect, it } from 'vitest';
import { createMatch, giveKnife, updateMatch } from './index';
import { knifeComponent } from './components';
import { WORLD } from '../combat/constants';
import type { GameEvent, Input } from '../types';

const IDLE: Input = { left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false };

function run(m: ReturnType<typeof createMatch>, seconds: number, input: Input = IDLE): GameEvent[] {
  const ev: GameEvent[] = [];
  for (let i = 0; i < seconds * 60; i++) ev.push(...updateMatch(m, 1 / 60, input));
  return ev;
}

describe('match (ECS)', () => {
  it('starts with two fighters facing each other and no projectiles', () => {
    const m = createMatch();
    expect(m.p1.id).toBe('superneus');
    expect(m.p2.id).toBe('potterpim');
    expect(m.p1.facing).toBe(1);
    expect(m.p2.facing).toBe(-1);
    expect(m.projectiles).toHaveLength(0);
    expect(m.active).toBe(false);
  });

  it('nobody acts until the round is active', () => {
    const m = createMatch();
    const x = [m.p1.x, m.p2.x];
    const ev = run(m, 3, { ...IDLE, right: true, punch: true });
    expect(ev).toHaveLength(0);
    expect([m.p1.x, m.p2.x]).toEqual(x);
  });

  it('the AI starts fighting once active', () => {
    const m = createMatch();
    m.active = true;
    const x = m.p2.x;
    run(m, 3);
    expect(m.p2.x).not.toBe(x);
  });

  it('keeps fighters inside the arena and apart', () => {
    const m = createMatch();
    m.active = true;
    run(m, 10, { ...IDLE, right: true });
    for (const f of [m.p1, m.p2]) {
      expect(f.x).toBeGreaterThanOrEqual(WORLD.minX);
      expect(f.x).toBeLessThanOrEqual(WORLD.maxX);
    }
    expect(Math.abs(m.p2.x - m.p1.x)).toBeGreaterThanOrEqual(WORLD.bodyHalfWidth * 2 - 1);
  });

  it('ignores zero / negative dt', () => {
    const m = createMatch();
    expect(updateMatch(m, 0, IDLE)).toEqual([]);
    expect(updateMatch(m, -1, IDLE)).toEqual([]);
  });

  it('an idle player is eventually knocked out', () => {
    const m = createMatch();
    m.active = true;
    const ev = run(m, 60);
    expect(m.over).toBe(true);
    expect(m.winner).toBe('potterpim');
    expect(ev.some((e) => e.type === 'ko')).toBe(true);
  });
});

describe('knife (weapon component)', () => {
  it('doubles punch damage only', () => {
    expect(knifeComponent()).toEqual({ kind: 'knife', damageMultiplier: 2, moves: ['punch'] });
  });

  it('arms the player once and is visible to the renderer', () => {
    const m = createMatch();
    expect(m.weaponOf('superneus')).toBeNull();
    expect(giveKnife(m)).toBe(true);
    expect(giveKnife(m)).toBe(false);
    expect(m.weaponOf('superneus')).toBe('knife');
    expect(m.weaponOf('potterpim')).toBeNull();
  });
});

describe('specials (projectiles)', () => {
  it("Superneus's full meter fires the sniff vortex, which hits at close range", () => {
    const m = createMatch();
    m.active = true;
    // a passive Potterpim (no AI component) can't interrupt the wind-up, so the test is deterministic
    for (const e of m.queries.ai) m.world.removeComponent(e, 'ai'); // miniplex queries iterate safely while removing
    m.p1.specialMeter = 100;
    m.p1.x = 450; m.p2.x = 560;
    const ev: GameEvent[] = [];
    let sawVortex = false;
    for (let i = 0; i < 60; i++) {
      ev.push(...updateMatch(m, 1 / 60, { ...IDLE, special: i === 0 }));
      if (m.projectiles.some((p) => p.kind === 'sniff')) sawVortex = true;
    }
    expect(sawVortex).toBe(true);
    expect(ev.some((e) => e.type === 'attack' && e.who === 'superneus' && e.move === 'special')).toBe(true);
    expect(ev.some((e) => e.type === 'hit' && e.attacker === 'superneus' && e.move === 'special')).toBe(true);
    expect(m.p1.specialMeter).toBeLessThan(100);
  });

  it('projectiles despawn after their lifetime', () => {
    const m = createMatch();
    m.active = true;
    m.p1.specialMeter = 100;
    updateMatch(m, 1 / 60, { ...IDLE, special: true });
    run(m, 5);
    expect(m.projectiles.filter((p) => p.owner === 'superneus')).toHaveLength(0);
  });
});
