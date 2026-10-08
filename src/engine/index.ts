import { Application, Container, Graphics } from 'pixi.js';
import type { Fighter, FighterId, MatchView } from '../types';
import type { FighterView } from './fighterRenderer';
import { createArena } from './arena';
import { createFighterView, preloadFighters } from './fighterRenderer';
import { createProjectileLayer } from './projectiles';

export { CHARACTER_SPECS } from './characters';

export interface Engine {
  app: Application;
  /** Generates the fighter textures + skeletons up front (the slow part of startup). */
  preloadFighters(): void;
  onTick(fn: (dt: number) => void): void;
  render(match: MatchView): void;
  worldToScreen(x: number, y: number): { x: number; y: number };
  shake(intensity?: number): void;
  flash(): void;
}

const WORLD_W = 1000;
const FIGHTER_H = 200;

export async function createEngine(parentEl: HTMLElement): Promise<Engine> {
  const app = new Application();
  await app.init({
    resizeTo: parentEl,
    antialias: true,
    autoDensity: true,
    resolution: Math.min(window.devicePixelRatio || 1, 2),
    background: 0x3fa9f5,
  });
  app.canvas.style.display = 'block';
  app.canvas.style.width = '100%';
  app.canvas.style.height = '100%';
  parentEl.appendChild(app.canvas);

  const shakeRoot = new Container();
  app.stage.addChild(shakeRoot);

  const arena = createArena();
  const actors = new Container();      // world units, y-down, floor at 0
  const shadows = new Container();
  const fighters = new Container();
  const projectiles = createProjectileLayer();
  actors.addChild(shadows, fighters, projectiles.layer);
  shakeRoot.addChild(arena.screenBack, arena.worldBack, actors);

  const flashG = new Graphics();
  flashG.alpha = 0;
  app.stage.addChild(arena.border, flashG);

  // ---- layout / camera
  let W = 1, H = 1, floorY = 1, maxScale = 1;
  const cam = { x: 500, scale: 1, init: false };

  function layout() {
    W = app.screen.width; H = app.screen.height;
    const portrait = H > W;
    floorY = portrait ? H * 0.63 : H * 0.8;   // portrait leaves ~35% for touch buttons
    maxScale = (floorY * 0.52) / FIGHTER_H;   // fighter never taller than ~half the space above floor
    arena.resize(W, H, floorY);
    flashG.clear().rect(0, 0, W, H).fill(0xffffff);
  }
  layout();
  app.renderer.on('resize', layout);

  function cameraTarget(match: MatchView | undefined): { x: number; scale: number } {
    const a = match?.p1, b = match?.p2;
    if (!a || !b) return { x: 500, scale: Math.min(W / WORLD_W, maxScale) };
    const dist = Math.abs(a.x - b.x);
    const minVis = H > W ? 400 : 640;
    const visW = Math.min(Math.max(dist + 280, minVis), WORLD_W + 200);
    const scale = Math.min(W / visW, maxScale);
    const half = W / scale / 2;
    let x = (a.x + b.x) / 2;
    const lo = -100 + half, hi = 1100 - half;
    x = lo > hi ? 500 : Math.max(lo, Math.min(hi, x));
    return { x, scale };
  }

  // ---- effects
  let shakeAmp = 0, flashT = 0, time = 0;
  app.ticker.add((t) => {
    const dt = Math.min(t.deltaMS / 1000, 0.1);
    time += dt;
    shakeAmp *= Math.exp(-dt * 9);
    if (shakeAmp < 0.3) shakeAmp = 0;
    shakeRoot.position.set((Math.random() * 2 - 1) * shakeAmp, (Math.random() * 2 - 1) * shakeAmp);
    flashT = Math.max(0, flashT - dt);
    flashG.alpha = flashT > 0 ? 0.85 * (flashT / 0.12) : 0;
  });

  // ---- render
  const views = new Map<FighterId, FighterView>();
  let lastRender = performance.now();

  function render(match: MatchView): void {
    const now = performance.now();
    const dt = Math.min((now - lastRender) / 1000, 0.1);
    lastRender = now;

    const tgt = cameraTarget(match);
    if (!cam.init) { cam.x = tgt.x; cam.scale = tgt.scale; cam.init = true; }
    const k = 1 - Math.exp(-dt * 4);
    cam.x += (tgt.x - cam.x) * k;
    cam.scale += (tgt.scale - cam.scale) * k;

    arena.update(time, cam.x, cam.scale);
    actors.scale.set(cam.scale);
    actors.position.set(W / 2 - cam.x * cam.scale, floorY);

    const list = [match?.p1, match?.p2].filter((f): f is Fighter => Boolean(f));
    const seen = new Set<FighterId>();
    for (const f of list) {
      seen.add(f.id);
      let v = views.get(f.id);
      if (!v) {
        v = createFighterView(app.renderer, f.id);
        views.set(f.id, v);
        fighters.addChild(v.root);
        shadows.addChild(v.shadow);
      }
      v.update(f, dt, time, match?.weaponOf(f.id) ?? null);
    }
    for (const [id, v] of views) if (!seen.has(id)) { v.destroy(); views.delete(id); }
    // the attacking fighter is drawn on top
    const atk = list.find((f) => ['punch', 'kick', 'special'].includes(f.state));
    const atkView = atk ? views.get(atk.id) : undefined;
    if (atkView) fighters.setChildIndex(atkView.root, fighters.children.length - 1);

    projectiles.update(match?.projectiles, match, time);
  }

  return {
    app,
    preloadFighters() { preloadFighters(app.renderer); },
    onTick(fn: (dt: number) => void) { app.ticker.add((t) => fn(Math.min(t.deltaMS / 1000, 0.1))); },
    render,
    worldToScreen(x: number, y: number) {
      return { x: W / 2 + (x - cam.x) * cam.scale, y: floorY - y * cam.scale };
    },
    shake(intensity = 1) {
      const px = intensity <= 3 ? intensity * 14 : intensity;
      shakeAmp = Math.max(shakeAmp, px);
    },
    flash() { flashT = 0.12; },
  };
}
