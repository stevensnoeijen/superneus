import type { With } from 'miniplex';
import type {
  AIComponent, FighterComponent, InputComponent, OpponentComponent,
  PlayerControlledComponent, ProjectileComponent, WeaponComponent,
} from './components';

/** An entity is a bag of optional components; each component lives in ./components/. */
export interface Entity {
  fighter?: FighterComponent;
  input?: InputComponent;
  playerControlled?: PlayerControlledComponent;
  ai?: AIComponent;
  opponent?: OpponentComponent;
  projectile?: ProjectileComponent;
  weapon?: WeaponComponent;
}

export type FighterEntity = With<Entity, 'fighter' | 'input' | 'opponent'>;
export type ProjectileEntity = With<Entity, 'projectile'>;
