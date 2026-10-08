import { describe, expect, it } from 'vitest';
import { updateFighter } from './fighter';
import { createMatch } from '../ecs/index';
import { PHYS } from './constants';
import type { GameEvent, Input } from '../types';

const IDLE: Input = { left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false };
const step = (input: Input, frames = 1) => {
  const m = createMatch();
  const ev: GameEvent[] = [];
  for (let i = 0; i < frames; i++) updateFighter(m.p1, m.p2, input, 1 / 120, m, ev);
  return { m, ev };
};

describe('fighter movement', () => {
  it('walks forward faster than backward', () => {
    const fwd = step({ ...IDLE, right: true }, 60).m.p1;
    const back = step({ ...IDLE, left: true }, 60).m.p1;
    expect(fwd.state).toBe('walk');
    expect(fwd.walkDir).toBe(1);
    expect(back.walkDir).toBe(-1);
    expect(Math.abs(fwd.vx)).toBe(PHYS.walkForward);
    expect(Math.abs(back.vx)).toBe(PHYS.walkBack);
  });

  it('jumps and reports it', () => {
    const { m, ev } = step({ ...IDLE, up: true }, 2);
    expect(m.p1.state).toBe('jump');
    expect(m.p1.y).toBeGreaterThan(0);
    expect(ev.some((e) => e.type === 'jump')).toBe(true);
  });

  it('crouches when holding down', () => {
    const { m } = step({ ...IDLE, down: true }, 2);
    expect(m.p1.state).toBe('crouch');
    expect(m.p1.crouching).toBe(true);
  });

  it('the block button guards even without a threat, and stands still', () => {
    const { m } = step({ ...IDLE, block: true }, 10);
    expect(m.p1.state).toBe('block');
    expect(m.p1.vx).toBe(0);
  });

  it('a punch press starts an attack once (edge, not hold)', () => {
    const { ev } = step({ ...IDLE, punch: true }, 30);
    expect(ev.filter((e) => e.type === 'attack')).toHaveLength(1);
  });

  it('crouching turns punch into a crouch punch', () => {
    const m = createMatch();
    const ev: GameEvent[] = [];
    updateFighter(m.p1, m.p2, { ...IDLE, down: true }, 1 / 120, m, ev);
    updateFighter(m.p1, m.p2, { ...IDLE, down: true, punch: true }, 1 / 120, m, ev);
    expect(m.p1.move).toBe('crouchPunch');
  });

  it('special needs a full meter', () => {
    expect(step({ ...IDLE, special: true }, 2).m.p1.state).not.toBe('special');
    const m = createMatch();
    m.p1.specialMeter = 100;
    updateFighter(m.p1, m.p2, { ...IDLE, special: true }, 1 / 120, m, []);
    expect(m.p1.state).toBe('special');
  });
});
