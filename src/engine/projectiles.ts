import { Container, Graphics, Text } from 'pixi.js';
import type { MatchView, Projectile } from '../types';
import { OUTLINE } from './characters';

// Title face from references/title-style.png (font file is loaded by the UI's @fontsource import).
export const COMIC_FONT = '"Luckiest Guy","Bangers","Impact","Arial Black",sans-serif';

interface WordView { node: Container; kind: 'word'; text: Text }
interface SniffView { node: Graphics; kind: 'sniff'; g: Graphics }
type ProjectileView = WordView | SniffView;

export interface ProjectileLayer {
  layer: Container;
  update(projectiles: readonly Projectile[] | undefined, match: MatchView | undefined, time: number): void;
}

function makeWord(p: Projectile): WordView {
  const node = new Container();
  const burst = new Graphics();
  const text = new Text({
    text: p.text || 'WORD!',
    style: {
      fontFamily: COMIC_FONT, fontSize: 24, fontWeight: '900', fill: 0xd41a1a,
      stroke: { color: OUTLINE, width: 2.75, join: 'round' }, letterSpacing: 1,
    },
    resolution: 3,
  });
  text.anchor.set(0.5);
  const w = text.width / 2 + 22, h = text.height / 2 + 16;
  const pts: number[] = [];
  const n = 22;
  for (let i = 0; i < n; i++) {
    const a = (i / n) * Math.PI * 2;
    const r = i % 2 ? 0.78 : 1.12;
    pts.push(Math.cos(a) * w * r, Math.sin(a) * h * r);
  }
  burst.poly(pts).fill(0xfff04a).stroke({ width: 2.75, color: OUTLINE, join: 'miter' });
  node.addChild(burst, text);
  return { node, kind: 'word', text };
}

function makeSniff(): SniffView {
  const g = new Graphics();
  return { node: g, kind: 'sniff', g };
}

function drawSniff(g: Graphics, time: number): void {
  g.clear();
  // cone: tip at -70 (toward Superneus), wide mouth at +70
  for (let i = 5; i >= 0; i--) {
    const x = -60 + i * 25;
    const ry = 8 + i * 9;
    const wob = Math.sin(time * 18 + i) * 3;
    g.ellipse(x, wob, ry * 0.35, ry).fill({ color: i % 2 ? 0xffffff : 0xdfe6ec, alpha: 0.75 })
      .stroke({ width: 1.65, color: OUTLINE, alpha: 0.9 });
  }
  // spiral swirl lines
  g.moveTo(-70, 0);
  for (let s = 0; s <= 1; s += 0.04) {
    const x = -70 + s * 140, r = 4 + s * 52, a = s * 14 - time * 20;
    g.lineTo(x + Math.cos(a) * r * 0.25, Math.sin(a) * r);
  }
  g.stroke({ width: 1.65, color: 0x6b7680, cap: 'round' });
  // streaks rushing toward the tip
  for (let j = 0; j < 9; j++) {
    const x = 70 - ((time * 260 + j * 41) % 140);
    const spread = 6 + (x + 70) * 0.38;
    const y = ((j % 5) - 2) / 2 * spread;
    g.moveTo(x, y).lineTo(x + 20, y * 1.1).stroke({ width: 2.2, color: OUTLINE, cap: 'round' });
  }
}

// Pooled projectile views keyed by projectile id. Drawn in world units
// (inside the actors layer: y-down, floor at 0).
export function createProjectileLayer(): ProjectileLayer {
  const layer = new Container();
  const views = new Map<number, ProjectileView>();

  function update(projectiles: readonly Projectile[] | undefined, match: MatchView | undefined, time: number): void {
    const seen = new Set<number>();
    for (const p of projectiles || []) {
      seen.add(p.id);
      let v = views.get(p.id);
      if (v && p.kind === 'word' && v.kind === 'word' && v.text.text !== (p.text || 'WORD!')) {
        v.node.destroy({ children: true }); views.delete(p.id); v = undefined;
      }
      if (!v) {
        v = p.kind === 'word' ? makeWord(p) : makeSniff();
        views.set(p.id, v);
        layer.addChild(v.node);
      }
      v.node.position.set(p.x, -(p.y || 0));
      if (v.kind === 'sniff') {
        const sn = match?.p1?.id === 'superneus' ? match.p1 : match?.p2;
        let dir = sn ? Math.sign(p.x - sn.x) || sn.facing : Math.sign(p.vx) || 1;
        v.node.scale.x = dir;
        drawSniff(v.g, time);
      } else {
        v.node.rotation = Math.sin(time * 12 + (typeof p.id === "number" ? p.id : 0)) * 0.12;
        const s = 1 + 0.06 * Math.sin(time * 20);
        v.node.scale.set(s);
      }
      v.node.alpha = p.life !== undefined ? Math.min(1, Math.max(0, p.life) * 6) : 1;
    }
    for (const [id, v] of views) {
      if (!seen.has(id)) { v.node.destroy({ children: true }); views.delete(id); }
    }
  }

  return { layer, update };
}
