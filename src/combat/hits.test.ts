import { describe, expect, it } from 'vitest';
import { applyHit } from './fighter';
import { COMBAT, MOVES, SPECIALS } from './constants';
import { createMatch, giveKnife, updateMatch } from '../ecs/index';
import type { GameEvent, Input } from '../types';

const IDLE: Input = { left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false };

describe('hit details', () => {
  it('knocks the target away from the attacker', () => {
    const m = createMatch();
    applyHit(m, m.p1, m.p2, 'kick', MOVES.kick, 450, 100, []);
    expect(m.p2.vx).toBeGreaterThan(0);
  });

  it('flashes the target white on a clean hit', () => {
    const m = createMatch();
    applyHit(m, m.p1, m.p2, 'punch', MOVES.punch, 450, 150, []);
    expect(m.p2.hitFlash).toBe(COMBAT.hitFlash);
  });

  it('gives meter to both attacker and defender', () => {
    const m = createMatch();
    applyHit(m, m.p1, m.p2, 'kick', MOVES.kick, 450, 100, []);
    expect(m.p1.specialMeter).toBeGreaterThan(0);
    expect(m.p2.specialMeter).toBeGreaterThan(0);
  });

  it('an airborne fighter cannot block', () => {
    const m = createMatch();
    m.p2.holdBack = true;
    m.p2.y = 50;
    const ev: GameEvent[] = [];
    applyHit(m, m.p1, m.p2, 'punch', MOVES.punch, 450, 150, ev);
    expect(ev[0]).toMatchObject({ blocked: false });
  });

  it('chip damage is at least 1', () => {
    const m = createMatch();
    m.p2.holdBack = true;
    applyHit(m, m.p1, m.p2, 'punch', { ...MOVES.punch, damage: 1 }, 450, 150, []);
    expect(m.p2.health).toBe(COMBAT.maxHealth - 1);
  });

  it('only one KO per match', () => {
    const m = createMatch();
    m.p2.health = 1;
    const ev: GameEvent[] = [];
    applyHit(m, m.p1, m.p2, 'punch', MOVES.punch, 450, 150, ev);
    applyHit(m, m.p1, m.p2, 'punch', MOVES.punch, 450, 150, ev);
    expect(ev.filter((e) => e.type === 'ko')).toHaveLength(1);
    expect(m.p2.health).toBe(0);
  });

  it('the sniff special does more damage than a kick', () => {
    expect(SPECIALS.sniff.damage).toBeGreaterThan(MOVES.kick.damage);
  });
});

describe('knife in a real exchange', () => {
  it('Superneus punches for double damage while armed', () => {
    const m = createMatch();
    m.active = true;
    for (const e of m.queries.ai) m.world.removeComponent(e, 'ai');
    giveKnife(m);
    m.p1.x = 450; m.p2.x = 540;
    const hits: number[] = [];
    for (let i = 0; i < 40; i++) {
      for (const e of updateMatch(m, 1 / 60, { ...IDLE, punch: i === 0 })) if (e.type === 'hit') hits.push(e.damage);
    }
    expect(hits).toEqual([MOVES.punch.damage * 2]);
  });

  it('kicks are not boosted by the knife', () => {
    const m = createMatch();
    m.active = true;
    for (const e of m.queries.ai) m.world.removeComponent(e, 'ai');
    giveKnife(m);
    m.p1.x = 450; m.p2.x = 560;
    const hits: number[] = [];
    for (let i = 0; i < 60; i++) {
      for (const e of updateMatch(m, 1 / 60, { ...IDLE, kick: i === 0 })) if (e.type === 'hit') hits.push(e.damage);
    }
    expect(hits).toEqual([MOVES.kick.damage]);
  });
});
