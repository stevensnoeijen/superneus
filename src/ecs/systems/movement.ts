import { WORLD } from '../../combat/constants';
import { updateFighter, setState } from '../../combat/fighter';
import { isAirborne } from '../../combat/hitboxes';
import type { Match } from '../world';
import type { Fighter, GameEvent } from '../../types';

function clamp(f: Fighter): void {
  if (f.x < WORLD.minX) { f.x = WORLD.minX; if (f.vx < 0) f.vx = 0; }
  if (f.x > WORLD.maxX) { f.x = WORLD.maxX; if (f.vx > 0) f.vx = 0; }
}

/** Runs each fighter's state machine + physics, then keeps it inside the arena. */
export function fighterSystem(ctx: Match, dt: number, events: GameEvent[]): void {
  for (const e of ctx.queries.fighters) {
    updateFighter(e.fighter, e.opponent.fighter!, e.input, dt, ctx, events);
    clamp(e.fighter);
  }
}

/** Stops fighters from overlapping; a fighter pinned at a wall pushes the other. */
export function bodyCollisionSystem(ctx: Match): void {
  const list = ctx.queries.fighters.entities;
  for (let i = 0; i < list.length; i++) {
    for (let j = i + 1; j < list.length; j++) pushApart(list[i].fighter, list[j].fighter);
  }
}

function pushApart(a: Fighter, b: Fighter): void {
  const min = WORLD.bodyHalfWidth * 2;
  if (a.state === 'ko' || b.state === 'ko') return;
  if (Math.abs(a.y - b.y) > 150) return;
  const dx = b.x - a.x;
  if (Math.abs(dx) >= min) return;
  const dir = dx === 0 ? (a.facing || 1) : Math.sign(dx);
  const overlap = (min - Math.abs(dx)) / 2;
  a.x -= dir * overlap; b.x += dir * overlap;
  clamp(a); clamp(b);
  if (Math.abs(b.x - a.x) < min) {
    if (a.x <= WORLD.minX || a.x >= WORLD.maxX) b.x = a.x + dir * min;
    else a.x = b.x - dir * min;
    clamp(a); clamp(b);
  }
}

/** After a KO, the winner switches to the victory pose once on the ground. */
export function matchOutcomeSystem(ctx: Match): void {
  if (!ctx.over) return;
  for (const { fighter: f } of ctx.queries.fighters) {
    if (f.id === ctx.winner && f.state !== 'victory' && !isAirborne(f)) {
      f.attackPhase = null; f.move = null; f.vx = 0; f.crouching = false;
      setState(f, 'victory');
    }
  }
}
