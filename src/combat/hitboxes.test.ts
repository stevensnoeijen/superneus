import { describe, expect, it } from 'vitest';
import { attackHitbox, circleHitsBox, hurtbox, isAirborne, overlaps } from './hitboxes';
import { createFighter } from './fighter';
import { MOVES, WORLD } from './constants';

describe('hitboxes', () => {
  it('detects airborne fighters', () => {
    const f = createFighter('superneus', 300, 1);
    expect(isAirborne(f)).toBe(false);
    f.y = 10;
    expect(isAirborne(f)).toBe(true);
  });

  it('shrinks the hurtbox when crouching', () => {
    const f = createFighter('superneus', 300, 1);
    expect(hurtbox(f).y1).toBe(WORLD.fighterHeight);
    f.crouching = true;
    expect(hurtbox(f).y1).toBe(WORLD.crouchHeight);
  });

  it('only has an attack hitbox during the active phase of an unspent attack', () => {
    const f = createFighter('superneus', 300, 1);
    f.move = 'punch';
    f.attackPhase = 'startup';
    expect(attackHitbox(f)).toBeNull();
    f.attackPhase = 'active';
    const hb = attackHitbox(f)!;
    expect(hb.x1).toBe(300 + MOVES.punch.reach);
    f.hasHit = true;
    expect(attackHitbox(f)).toBeNull();
  });

  it('mirrors the hitbox when facing left', () => {
    const f = createFighter('potterpim', 600, -1);
    f.move = 'kick';
    f.attackPhase = 'active';
    expect(attackHitbox(f)!.x0).toBe(600 - MOVES.kick.reach);
  });

  it('never gives the special a melee hitbox', () => {
    const f = createFighter('superneus', 300, 1);
    f.move = 'special';
    f.attackPhase = 'active';
    expect(attackHitbox(f)).toBeNull();
  });

  it('overlaps and circle tests', () => {
    const a = { x0: 0, x1: 10, y0: 0, y1: 10 };
    expect(overlaps(a, { x0: 5, x1: 15, y0: 5, y1: 15 })).toBe(true);
    expect(overlaps(a, { x0: 10, x1: 20, y0: 0, y1: 10 })).toBe(false);
    expect(circleHitsBox(15, 5, 6, a)).toBe(true);
    expect(circleHitsBox(20, 5, 6, a)).toBe(false);
  });
});
