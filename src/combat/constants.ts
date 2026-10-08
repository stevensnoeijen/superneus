// Shared world + move tuning for combat (pure data).
import type { MoveAnim, MoveKey, ProjectileKind } from '../types';

export interface MoveSpec {
  anim: MoveAnim;
  startup: number;
  active: number;
  recovery: number;
  damage: number;
  reach: number;
  yMin: number;
  yMax: number;
  knockback: number;
  hitstun: number;
  blockstun: number;
  meter: number;
  low?: boolean;
  air?: boolean;
}

/** The parts of a move/special that applyHit needs. */
export type HitSpec = Pick<MoveSpec, 'damage' | 'knockback' | 'hitstun' | 'blockstun' | 'meter'>;

export interface SpecialSpec {
  damage: number;
  life: number;
  offset: number;
  vx: number;
  radius: number;
  y: number;
  knockback: number;
  hitstun: number;
  blockstun: number;
  range?: number;
  pull?: number;
}
export const WORLD = {
  width: 1000,
  fighterHeight: 200,
  crouchHeight: 130,
  minX: 60,
  maxX: 940,
  floorY: 0,
  gravity: 2600,       // units/s^2
  bodyHalfWidth: 40,   // push-box half width
  startP1X: 330,
  startP2X: 670,
};

export const PHYS = {
  walkForward: 270,
  walkBack: 200,
  jumpVy: 1050,        // apex ~212 units, airtime ~0.8s
  jumpVx: 300,
  groundFriction: 2200, // units/s^2 decel for knockback slide
  koVx: 420,
  koVy: 620,
};

// times in seconds; reach measured from fighter centre; yMin/yMax relative to attacker feet.
export const MOVES: Record<MoveKey, MoveSpec> = {
  punch:       { anim: 'punch',   startup: 0.06, active: 0.08, recovery: 0.14, damage: 6,  reach: 118, yMin: 115, yMax: 180, knockback: 170, hitstun: 0.21, blockstun: 0.12, meter: 9 },
  kick:        { anim: 'kick',    startup: 0.12, active: 0.10, recovery: 0.26, damage: 10, reach: 158, yMin: 55,  yMax: 140, knockback: 280, hitstun: 0.32, blockstun: 0.18, meter: 13 },
  crouchPunch: { anim: 'punch',   startup: 0.07, active: 0.08, recovery: 0.16, damage: 5,  reach: 112, yMin: 45,  yMax: 105, knockback: 140, hitstun: 0.22, blockstun: 0.12, meter: 8, low: true },
  crouchKick:  { anim: 'kick',    startup: 0.13, active: 0.10, recovery: 0.30, damage: 9,  reach: 160, yMin: 0,   yMax: 45,  knockback: 220, hitstun: 0.30, blockstun: 0.16, meter: 12, low: true },
  jumpPunch:   { anim: 'punch',   startup: 0.05, active: 0.16, recovery: 0.10, damage: 7,  reach: 105, yMin: 50,  yMax: 145, knockback: 180, hitstun: 0.26, blockstun: 0.14, meter: 9, air: true },
  jumpKick:    { anim: 'kick',    startup: 0.08, active: 0.22, recovery: 0.10, damage: 10, reach: 130, yMin: -10, yMax: 110, knockback: 260, hitstun: 0.32, blockstun: 0.18, meter: 13, air: true },
  special:     { anim: 'special', startup: 0.25, active: 0.10, recovery: 0.45, damage: 0, reach: 0, yMin: 0, yMax: 0, knockback: 0, hitstun: 0, blockstun: 0, meter: 0 },
};

export const SPECIALS: Record<ProjectileKind, SpecialSpec> = {
  sniff: { damage: 18, life: 0.6, offset: 90, vx: 120, range: 240, pull: 650, radius: 70, y: 110, knockback: 420, hitstun: 0.5, blockstun: 0.3 },
  word:  { damage: 14, life: 3.2, offset: 70, vx: 380, radius: 45, y: 130, knockback: 300, hitstun: 0.4, blockstun: 0.25 },
};

export const WORD_TEXTS = ['OBJECTIVERING!', 'ESTHETIEK!', 'DISCOURS!', 'SEKSISME?'];

export const COMBAT = {
  maxHealth: 100,
  maxMeter: 100,
  chipFactor: 0.2,
  hitFlash: 0.12,
  takeMeterFactor: 0.6, // meter gained per damage point taken
  blockMeterFactor: 0.5,
  maxDt: 1 / 20,
  step: 1 / 120,
};
