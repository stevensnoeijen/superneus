import { EMPTY_INPUT } from '../../combat/fighter';
import { updateAI } from '../../combat/ai';
import type { Match } from '../world';
import type { Input } from '../../types';

/** Copies the UI's held-button snapshot onto player-controlled fighters. */
export function playerInputSystem(ctx: Match, input: Input): void {
  for (const e of ctx.queries.player) e.input = ctx.active && !ctx.over ? input : EMPTY_INPUT;
}

/** Lets the AI brain produce an input snapshot for CPU fighters. */
export function aiSystem(ctx: Match, dt: number): void {
  for (const e of ctx.queries.ai) {
    e.input = ctx.active && !ctx.over ? updateAI(e.ai, e.fighter, e.opponent.fighter!, dt) : EMPTY_INPUT;
  }
}
