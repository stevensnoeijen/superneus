import type { MoveAnim, WeaponKind } from '../../types';

/** A held weapon. Multiplies the damage of the listed move types. */
export interface WeaponComponent {
  kind: WeaponKind;
  damageMultiplier: number;
  /** which attack animations the weapon is used in */
  moves: readonly MoveAnim[];
}

/** The knife: doubles punch damage (standing, crouching and jumping punches). */
export function knifeComponent(): WeaponComponent {
  return { kind: 'knife', damageMultiplier: 2, moves: ['punch'] };
}
