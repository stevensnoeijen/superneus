import { EMPTY_INPUT } from '../../combat/fighter';
import type { Input } from '../../types';

/** Held-button snapshot driving the fighter this step (written by the input/AI systems). */
export type InputComponent = Input;

export function inputComponent(): InputComponent {
  return { ...EMPTY_INPUT };
}
