import { MOVES, COMBAT } from './constants';
import { isAirborne } from './hitboxes';
import type { Button, Fighter, Input } from '../types';

export type Difficulty = 'easy' | 'normal' | 'hard';

interface Level {
  reaction: [number, number];
  block: number;
  guard: number;
  punish: number;
  antiAir: number;
  aggression: number;
  jump: number;
  decide: [number, number];
}

type Direction = 'left' | 'right' | 'up' | 'down';

export interface AIState {
  cfg: Level;
  t: number;
  nextDecide: number;
  hold: Record<Direction, boolean>;
  holdUntil: number;
  press: Button | null;
  pressUntil: number;
  blockUntil: number;
  pending: { at: number; fn: () => void }[]; // delayed reactions
  seenAttack: boolean;
  seenAir: boolean;
  seenWhiff: boolean;
  wasStunned: 'hit' | 'block' | false;
}

const LEVELS: Record<Difficulty, Level> = {
  easy:   { reaction: [0.28, 0.40], block: 0.35, guard: 0.30, punish: 0.30, antiAir: 0.25, aggression: 0.45, jump: 0.02, decide: [0.16, 0.26] },
  normal: { reaction: [0.15, 0.26], block: 0.68, guard: 0.50, punish: 0.55, antiAir: 0.45, aggression: 0.65, jump: 0.03, decide: [0.09, 0.16] },
  hard:   { reaction: [0.12, 0.18], block: 0.80, guard: 0.70, punish: 0.80, antiAir: 0.70, aggression: 0.75, jump: 0.04, decide: [0.06, 0.12] },
};

const rnd = (a: number, b: number): number => a + Math.random() * (b - a);

export function createAI(difficulty: Difficulty = 'normal'): AIState {
  return {
    cfg: LEVELS[difficulty] || LEVELS.normal,
    t: 0,
    nextDecide: 0,
    hold: { left: false, right: false, up: false, down: false },
    holdUntil: 0,
    press: null, pressUntil: 0,
    blockUntil: 0,
    pending: [],
    seenAttack: false, seenAir: false, seenWhiff: false,
    wasStunned: false,
  };
}

/** Produce a held-input snapshot for `me` (AI) versus `foe` (player). */
export function updateAI(ai: AIState, me: Fighter, foe: Fighter, dt: number): Input {
  ai.t += dt;
  const c = ai.cfg;
  const dx = foe.x - me.x;
  const dist = Math.abs(dx);
  const toward = Math.sign(dx) || me.facing;
  const fwdKey: Direction = toward > 0 ? 'right' : 'left';
  const backKey: Direction = toward > 0 ? 'left' : 'right';
  const busy = me.state !== 'idle' && me.state !== 'walk' && me.state !== 'crouch' && me.state !== 'block';

  const press = (btn: Button): void => { ai.press = btn; ai.pressUntil = ai.t + 0.05; };
  const later = (fn: () => void): void => { ai.pending.push({ at: ai.t + rnd(c.reaction[0], c.reaction[1]), fn }); };

  // --- perception (reactions are delayed) ---
  const foeAttacking = (foe.state === 'punch' || foe.state === 'kick' || foe.state === 'special');
  if (foeAttacking && foe.attackPhase === 'startup' && !ai.seenAttack) {
    ai.seenAttack = true;
    if (dist < 260 || foe.state === 'special') {
      if (Math.random() < c.block) later(() => { ai.blockUntil = ai.t + 0.45; });
    }
  }
  if (!foeAttacking) ai.seenAttack = false;

  const foeAir = isAirborne(foe) && foe.state !== 'ko';
  if (foeAir && !ai.seenAir) {
    ai.seenAir = true;
    if (Math.random() < c.antiAir) later(() => { if (Math.abs(foe.x - me.x) < 220 && isAirborne(foe)) press('kick'); });
  }
  if (!foeAir) ai.seenAir = false;

  const whiff = foeAttacking && foe.attackPhase === 'recovery' && !foe.hasHit;
  if (whiff && !ai.seenWhiff) {
    ai.seenWhiff = true;
    if (Math.random() < c.punish) later(() => {
      const d = Math.abs(foe.x - me.x);
      if (d < MOVES.punch.reach + 30) press('punch'); else if (d < MOVES.kick.reach + 40) press('kick');
    });
  }
  if (!foeAttacking) ai.seenWhiff = false;

  for (let i = ai.pending.length - 1; i >= 0; i--) {
    if (ai.pending[i].at <= ai.t) { const p = ai.pending[i]; ai.pending.splice(i, 1); if (!busy || p.fn.length === 0) p.fn(); }
  }

  // wake-up from hitstun / blockstun: guard or counter
  if (ai.wasStunned && !busy && me.state !== 'block') {
    const fromBlock = ai.wasStunned === 'block';
    if (fromBlock && dist < MOVES.punch.reach + 20 && Math.random() < c.punish) press('punch');
    else if (Math.random() < c.guard) ai.blockUntil = ai.t + 0.3;
    else if (dist < MOVES.punch.reach + 20) press('punch');
    ai.nextDecide = ai.t + 0.05;
  }
  ai.wasStunned = me.state === 'hit' ? 'hit' : (me.state === 'block' && me.stun > 0) ? 'block' : false;

  // --- periodic decisions ---
  if (ai.t >= ai.nextDecide && !busy && ai.t >= ai.blockUntil) {
    ai.nextDecide = ai.t + rnd(c.decide[0], c.decide[1]);
    ai.hold = { left: false, right: false, up: false, down: false };
    const r = Math.random();
    if (me.specialMeter >= COMBAT.maxMeter && ((dist > 300 && r < 0.6) || (dist < 200 && r < 0.12))) {
      press('special');
    } else if (dist > 230) {
      if (r < c.jump) { ai.hold.up = true; ai.hold[fwdKey] = true; ai.holdUntil = ai.t + 0.1; }
      else { ai.hold[fwdKey] = true; ai.holdUntil = ai.t + 0.25; }
    } else if (dist < 110 && r < 0.35) {
      ai.hold[backKey] = true; ai.holdUntil = ai.t + 0.2;
    } else if (r < c.aggression) {
      const r2 = Math.random();
      if (dist < 140) {
        if (r2 < 0.2) { ai.hold.down = true; ai.holdUntil = ai.t + 0.4; press('kick'); }
        else press(r2 < 0.65 ? 'punch' : 'kick');
      } else if (dist < 185) press('kick');
      else { ai.hold[fwdKey] = true; ai.holdUntil = ai.t + 0.15; }
    } else if (dist < 150 && r < c.aggression + 0.2) {
      press('punch');
    } else if (r < c.aggression + 0.1) {
      ai.hold[backKey] = true; ai.holdUntil = ai.t + 0.2;   // space out
    } else if (r < c.aggression + 0.1 + c.jump) {
      ai.hold.up = true; ai.hold[fwdKey] = true; ai.holdUntil = ai.t + 0.1;
    } else if (dist > 170) {
      ai.hold[fwdKey] = true; ai.holdUntil = ai.t + 0.15;
    }
  }

  const input: Input = { left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false };
  if (ai.t < ai.holdUntil) Object.assign(input, ai.hold);
  if (ai.t < ai.blockUntil) { input[backKey] = true; input[fwdKey] = false; input.up = false; }
  if (ai.press && ai.t < ai.pressUntil) input[ai.press] = true;
  else ai.press = null;
  return input;
}
