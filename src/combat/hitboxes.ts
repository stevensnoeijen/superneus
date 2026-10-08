import { WORLD, MOVES } from './constants';
import type { Fighter } from '../types';

export interface Box { x0: number; x1: number; y0: number; y1: number }

const HW = WORLD.bodyHalfWidth;

export function isAirborne(f: Fighter): boolean { return f.y > 0.01 || f.vy > 0; }

export function hurtbox(f: Fighter): Box {
  if (isAirborne(f)) return { x0: f.x - HW, x1: f.x + HW, y0: f.y + 20, y1: f.y + 175 };
  if (f.crouching) return { x0: f.x - HW - 5, x1: f.x + HW + 5, y0: 0, y1: WORLD.crouchHeight };
  return { x0: f.x - HW, x1: f.x + HW, y0: 0, y1: WORLD.fighterHeight };
}

// Returns the active-phase hitbox for the fighter's current attack, or null.
export function attackHitbox(f: Fighter): Box | null {
  if (f.attackPhase !== 'active' || !f.move || f.move === 'special' || f.hasHit) return null;
  const m = MOVES[f.move];
  const a = f.x + f.facing * 10, b = f.x + f.facing * m.reach;
  return { x0: Math.min(a, b), x1: Math.max(a, b), y0: f.y + m.yMin, y1: f.y + m.yMax };
}

export function overlaps(a: Box, b: Box): boolean {
  return a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
}

export function circleHitsBox(cx: number, cy: number, r: number, b: Box): boolean {
  const nx = Math.max(b.x0, Math.min(cx, b.x1)), ny = Math.max(b.y0, Math.min(cy, b.y1));
  return (cx - nx) ** 2 + (cy - ny) ** 2 <= r * r;
}
