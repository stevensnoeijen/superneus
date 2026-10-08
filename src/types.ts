// Shared types for the module contracts in CONTRACTS.md.

export type FighterId = 'superneus' | 'potterpim';

export type FighterState =
  | 'idle' | 'walk' | 'jump' | 'crouch'
  | 'punch' | 'kick' | 'special' | 'block'
  | 'hit' | 'ko' | 'victory';

export type AttackPhase = 'startup' | 'active' | 'recovery';

export type MoveKey = 'punch' | 'kick' | 'crouchPunch' | 'crouchKick' | 'jumpPunch' | 'jumpKick' | 'special';
export type MoveAnim = 'punch' | 'kick' | 'special';

export interface Input {
  left: boolean;
  right: boolean;
  up: boolean;
  down: boolean;
  punch: boolean;
  kick: boolean;
  special: boolean;
  /** dedicated block button (same as holding back, but also stands still with no threat) */
  block: boolean;
}
export type Button = keyof Input;

export interface Fighter {
  id: FighterId;
  name: string;
  x: number;
  y: number;
  vx: number;
  vy: number;
  facing: 1 | -1;
  state: FighterState;
  stateTime: number;
  attackPhase: AttackPhase | null;
  health: number;
  maxHealth: number;
  specialMeter: number;
  hitFlash: number;
  walkDir: number;
  // combat internals
  move: MoveKey | null;
  hasHit: boolean;
  spawned: boolean;
  crouching: boolean;
  holdBack: boolean;
  stun: number;
  airAttackUsed: boolean;
  prevInput: Input;
  readyAnnounced: boolean;
}

export type ProjectileKind = 'sniff' | 'word';
export type WeaponKind = 'knife';

export interface Projectile {
  id: number;
  owner: FighterId;
  kind: ProjectileKind;
  x: number;
  y: number;
  vx: number;
  life: number;
  text: string;
  hit: boolean;
}

export type GameEvent =
  | { type: 'attack'; who: FighterId; move: MoveAnim }
  | { type: 'jump'; who: FighterId }
  | { type: 'hit'; attacker: FighterId; target: FighterId; move: MoveAnim; damage: number; x: number; y: number; blocked: boolean }
  | { type: 'ko'; winner: FighterId; loser: FighterId }
  | { type: 'special-ready'; who: FighterId };

/** Read-only view of a match, as the renderer consumes it. */
export interface MatchView {
  readonly p1: Fighter;
  readonly p2: Fighter;
  readonly projectiles: readonly Projectile[];
  /** weapon a fighter currently holds, if any (drawn in hand by the engine) */
  weaponOf(id: FighterId): WeaponKind | null;
  over: boolean;
  winner: FighterId | null;
  time: number;
}
