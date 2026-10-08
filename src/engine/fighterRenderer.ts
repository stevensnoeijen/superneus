import { ColorMatrixFilter, Container, Graphics } from 'pixi.js';
import type { Renderer } from 'pixi.js';
import { PixiFactory } from 'pixi-dragonbones-runtime';
import type { AnimationState, PixiArmatureDisplay, Slot } from 'pixi-dragonbones-runtime';
import type { Fighter, FighterId, MoveKey, WeaponKind } from '../types';
import { MOVES } from '../combat/constants';
import { buildFighterAtlas } from './dragonbones/parts';
import { perfMeasure } from '../perf';
import { ATTACK_MARKS, WALK_PERIOD, buildSkeletonJson } from './dragonbones/skeleton';

export interface FighterView {
  root: Container;
  shadow: Graphics;
  update(f: Fighter, dt: number, time: number, weapon?: WeaponKind | null): void;
  destroy(): void;
}

// Fighters are DragonBones armatures. Body-part textures (dragonbones/parts.ts)
// and the skeleton + animations (dragonbones/skeleton.ts) are generated in code
// on first use; nothing is loaded from files. Armature-local space: y-down,
// x+ = forward, feet at the origin, ~200 units tall (same as world units).

let factory: PixiFactory | null = null;

function getFactory(renderer: Renderer): PixiFactory {
  if (factory) return factory;
  // false = don't hook PIXI's shared ticker: each view advances its own armature
  // from the engine's dt, so the clock is never advanced twice.
  const fac = new PixiFactory(null, false);
  const atlas = perfMeasure('fighter atlas (draw + render parts)', () => buildFighterAtlas(renderer));
  perfMeasure('dragonbones parse (atlas + skeletons)', () => {
    fac.parseTextureAtlasData(atlas.json, atlas.texture, 'fighters');
    for (const id of ['superneus', 'potterpim'] as const) fac.parseDragonBonesData(buildSkeletonJson(id, atlas.parts), id);
  });
  factory = fac;
  return fac;
}

const clamp = (v: number, a: number, b: number): number => Math.max(a, Math.min(b, v));

/** Maps the move's real startup/active/recovery timing onto the normalised attack timeline. */
function attackTime(f: Fighter, move: MoveKey): number {
  const m = MOVES[move];
  const t = f.stateTime || 0;
  const { startupEnd: S, activeEnd: A, end: E } = ATTACK_MARKS;
  let a: number;
  if (t < m.startup) a = S * (t / m.startup);
  else if (t < m.startup + m.active) a = S + (A - S) * ((t - m.startup) / m.active);
  else a = A + (E - A) * ((t - m.startup - m.active) / m.recovery);
  return clamp(a, 0, E - 0.001);
}

function animName(f: Fighter): string {
  switch (f.state) {
    case 'punch': case 'kick': case 'special': return f.move ?? f.state;
    default: return f.state;
  }
}

const FADE: Record<string, number> = { hit: 0.04, ko: 0.08, walk: 0.1, idle: 0.14, victory: 0.2 };

// white silhouette for the hit flash
const flashFilter = new ColorMatrixFilter();
flashFilter.matrix = [0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 0, 1, 0, 0, 0, 1, 0];

/** Builds the fighter atlas + DragonBones data now instead of on the first frame. */
export function preloadFighters(renderer: Renderer): void {
  getFactory(renderer);
}

export function createFighterView(renderer: Renderer, id: FighterId): FighterView {
  const fac = getFactory(renderer);
  const display = fac.buildArmatureDisplay(id, id, '', 'fighters') as PixiArmatureDisplay;
  const armature = display.armature;
  fac.clock.remove(armature); // driven manually in update()
  const mouth: Slot | null = armature.getSlot('mouth');
  const knifeSlot: Slot | null = armature.getSlot('knife');
  if (knifeSlot) knifeSlot.displayIndex = -1;

  const root = new Container();
  root.addChild(display);
  const shadow = new Graphics();
  shadow.ellipse(0, 0, 42, 9).fill({ color: 0x000000, alpha: 0.28 });

  let current = '';
  let lastStateTime = 0;
  let anim: AnimationState | null = null;
  let walkT = 0;

  function update(f: Fighter, dt: number, time: number, weapon: WeaponKind | null = null): void {
    const name = animName(f);
    const restarted = f.stateTime < lastStateTime - 1e-4 && (name === 'hit' || name in MOVES);
    lastStateTime = f.stateTime;
    const scrubbed = name in MOVES || name === 'walk';
    if (name !== current || restarted || !anim) {
      const fade = name in MOVES ? 0.05 : FADE[name] ?? 0.1;
      anim = display.animation.fadeIn(name, fade);
      current = name;
      if (anim && scrubbed) anim.timeScale = 0;
      armature.advanceTime(0); // initialise timelines before scrubbing
    }
    if (anim && scrubbed) {
      if (name === 'walk') {
        walkT = (walkT + dt * (f.walkDir < 0 ? -1 : 1) + WALK_PERIOD) % WALK_PERIOD;
        anim.currentTime = walkT;
      } else {
        anim.currentTime = attackTime(f, name as MoveKey);
      }
    }
    if (mouth) mouth.displayIndex = f.state === 'special' ? 1 : 0;
    if (knifeSlot) knifeSlot.displayIndex = weapon === 'knife' ? 0 : -1;
    armature.advanceTime(dt);

    display.filters = f.hitFlash > 0 && Math.floor(time * 30) % 2 === 0 ? [flashFilter] : [];
    root.position.set(f.x, -(f.y || 0));
    root.scale.x = f.facing < 0 ? -1 : 1;
    const air = clamp((f.y || 0) / 250, 0, 0.7);
    shadow.position.set(f.x + (f.state === 'ko' ? -50 * (f.facing || 1) : 0), 2);
    shadow.scale.set((f.state === 'ko' ? 2.3 : 1) * (1 - air), 1 - air);
  }

  return {
    root, shadow, update,
    destroy() {
      root.removeChild(display);
      display.dispose();
      root.destroy({ children: true });
      shadow.destroy();
    },
  };
}
