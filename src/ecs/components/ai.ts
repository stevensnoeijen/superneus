import { createAI, type AIState, type Difficulty } from '../../combat/ai';

/** AI brain state: this fighter's input is produced by aiSystem. */
export type AIComponent = AIState;

export function aiComponent(difficulty: Difficulty = 'normal'): AIComponent {
  return createAI(difficulty);
}
