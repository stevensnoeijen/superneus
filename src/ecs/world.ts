import { World, type Query, type With } from 'miniplex';
import { WORLD } from '../combat/constants';
import type { Difficulty } from '../combat/ai';
import type { FighterId, MatchView, Projectile } from '../types';
import { aiComponent, fighterComponent, inputComponent, playerControlledComponent } from './components';
import type { Entity, FighterEntity, ProjectileEntity } from './entity';

export type { Entity, FighterEntity, ProjectileEntity } from './entity';

/*
 * The miniplex world plus match state. Components live in ./components/ (one file
 * each), the Entity type in ./entity.ts. The returned context is the single game
 * state object passed to every system; its p1/p2/projectiles getters keep the shape
 * engine.render() expects.
 */
export interface Match extends MatchView {
  world: World<Entity>;
  queries: {
    fighters: Query<FighterEntity>;
    player: Query<With<Entity, 'fighter' | 'input' | 'playerControlled'>>;
    ai: Query<With<Entity, 'fighter' | 'input' | 'ai' | 'opponent'>>;
    projectiles: Query<ProjectileEntity>;
    armed: Query<With<Entity, 'fighter' | 'weapon'>>;
  };
  /** false until the round starts (FIGHT!): no fighter, player or AI, can act. */
  active: boolean;
  over: boolean;
  winner: FighterId | null;
  time: number;
  accumulator: number;
  nextProjectileId: number;
}

export function createGameWorld(opts: { difficulty?: Difficulty } = {}): Match {
  const world = new World<Entity>();
  const queries = {
    fighters: world.with('fighter', 'input', 'opponent'),
    player: world.with('fighter', 'input', 'playerControlled'),
    ai: world.with('fighter', 'input', 'ai', 'opponent'),
    projectiles: world.with('projectile'),
    armed: world.with('fighter', 'weapon'),
  };

  const hero = world.add({
    fighter: fighterComponent('superneus', WORLD.startP1X, 1),
    input: inputComponent(),
    playerControlled: playerControlledComponent,
  });
  const villain = world.add({
    fighter: fighterComponent('potterpim', WORLD.startP2X, -1),
    input: inputComponent(),
    ai: aiComponent(opts.difficulty || 'normal'),
  });
  world.addComponent(hero, 'opponent', villain);
  world.addComponent(villain, 'opponent', hero);

  const projectileView: Projectile[] = [];
  return {
    world,
    queries,
    active: false,
    over: false,
    winner: null,
    time: 0,
    accumulator: 0,
    nextProjectileId: 0,
    get p1() { return hero.fighter; },
    get p2() { return villain.fighter; },
    weaponOf(id) {
      for (const e of queries.armed) if (e.fighter.id === id) return e.weapon.kind;
      return null;
    },
    get projectiles() {
      const list = queries.projectiles.entities;
      projectileView.length = list.length;
      for (let i = 0; i < list.length; i++) projectileView[i] = list[i].projectile;
      return projectileView;
    },
  };
}
