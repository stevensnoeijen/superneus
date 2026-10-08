import { COMBAT } from '../combat/constants';
import { EMPTY_INPUT } from '../combat/fighter';
import { createGameWorld, type Match } from './world';
import { knifeComponent } from './components';
import type { GameEvent, Input } from '../types';
import { playerInputSystem, aiSystem } from './systems/input';
import { fighterSystem, bodyCollisionSystem, matchOutcomeSystem } from './systems/movement';
import { meleeSystem, projectileSystem } from './systems/combat';

export { createGameWorld as createMatch };
export type { Match } from './world';

/** One fixed simulation step: systems run in this order. */
function step(ctx: Match, dt: number, input: Input, events: GameEvent[]): void {
  ctx.time += dt;
  playerInputSystem(ctx, input);
  aiSystem(ctx, dt);
  fighterSystem(ctx, dt, events);
  bodyCollisionSystem(ctx);
  meleeSystem(ctx, events);
  projectileSystem(ctx, dt, events);
  matchOutcomeSystem(ctx);
}

/** Advances the world by dt seconds in fixed substeps. Returns GameEvent[]. */
export function updateMatch(ctx: Match, dt: number, input?: Input): GameEvent[] {
  const events: GameEvent[] = [];
  if (!(dt > 0)) return events;
  ctx.accumulator += Math.min(dt, COMBAT.maxDt);
  const inp = input || EMPTY_INPUT;
  while (ctx.accumulator >= COMBAT.step) {
    ctx.accumulator -= COMBAT.step;
    step(ctx, COMBAT.step, inp, events);
  }
  return events;
}

/** Arms the player's fighter with a knife (cheat). Returns false if already armed. */
export function giveKnife(ctx: Match): boolean {
  for (const e of ctx.queries.player) {
    if (e.weapon) return false;
    ctx.world.addComponent(e, 'weapon', knifeComponent());
  }
  return true;
}
