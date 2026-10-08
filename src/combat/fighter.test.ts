import { describe, expect, it } from 'vitest';
import { addMeter, applyHit, createFighter, setState } from './fighter';
import { COMBAT, MOVES } from './constants';
import { createMatch } from '../ecs/index';
import type { GameEvent } from '../types';

describe('fighter rules', () => {
  it('creates a fresh fighter at full health', () => {
    const f = createFighter('superneus', 330, 1);
    expect(f).toMatchObject({ id: 'superneus', name: 'SUPERNEUS', health: COMBAT.maxHealth, state: 'idle', specialMeter: 0 });
  });

  it('setState resets the state timer only on change', () => {
    const f = createFighter('superneus', 330, 1);
    f.stateTime = 1;
    setState(f, 'idle');
    expect(f.stateTime).toBe(1);
    setState(f, 'walk');
    expect(f.stateTime).toBe(0);
  });

  it('meter caps at max and announces special-ready once', () => {
    const f = createFighter('superneus', 330, 1);
    const ev: GameEvent[] = [];
    addMeter(f, 80, ev);
    addMeter(f, 80, ev);
    addMeter(f, 10, ev);
    expect(f.specialMeter).toBe(COMBAT.maxMeter);
    expect(ev.filter((e) => e.type === 'special-ready')).toHaveLength(1);
  });

  it('a clean hit deals full damage and stuns', () => {
    const m = createMatch();
    const ev: GameEvent[] = [];
    applyHit(m, m.p1, m.p2, 'punch', MOVES.punch, 400, 150, ev);
    expect(m.p2.health).toBe(COMBAT.maxHealth - MOVES.punch.damage);
    expect(m.p2.state).toBe('hit');
    expect(ev[0]).toMatchObject({ type: 'hit', blocked: false, damage: MOVES.punch.damage });
  });

  it('a blocked hit only chips', () => {
    const m = createMatch();
    m.p2.holdBack = true;
    const ev: GameEvent[] = [];
    applyHit(m, m.p1, m.p2, 'kick', MOVES.kick, 400, 100, ev);
    expect(m.p2.state).toBe('block');
    expect(m.p2.health).toBe(COMBAT.maxHealth - Math.max(1, Math.round(MOVES.kick.damage * COMBAT.chipFactor)));
    expect(ev[0]).toMatchObject({ blocked: true });
  });

  it('a lethal hit ends the match with a KO', () => {
    const m = createMatch();
    m.p2.health = 3;
    const ev: GameEvent[] = [];
    applyHit(m, m.p1, m.p2, 'punch', MOVES.punch, 400, 150, ev);
    expect(m.over).toBe(true);
    expect(m.winner).toBe('superneus');
    expect(m.p2.state).toBe('ko');
    expect(ev.some((e) => e.type === 'ko')).toBe(true);
  });
});
