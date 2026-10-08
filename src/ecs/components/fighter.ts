import { createFighter } from '../../combat/fighter';
import type { Fighter, FighterId } from '../../types';

/** Fighter state: position, physics, state machine, health, meter (shape in CONTRACTS.md). */
export type FighterComponent = Fighter;

export function fighterComponent(id: FighterId, x: number, facing: 1 | -1): FighterComponent {
  return createFighter(id, x, facing);
}
