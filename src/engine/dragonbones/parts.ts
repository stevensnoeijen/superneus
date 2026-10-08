// Body-part sprites for the DragonBones fighters, drawn in code with PIXI Graphics
// (thin even ink outlines, flat colours, matching references/model-sheet.png) and packed into ONE RenderTexture atlas at
// runtime. Returns the texture plus a DragonBones texture-atlas JSON object.
//
// Every part is drawn in its bone's local space (y-down), origin = the joint the
// bone pivots on:
//   limbs   bone points along +x, origin at the proximal joint
//   torso   3/4 view (chest turned to the viewer), x = forward, y = -(height up the
//           spine), origin = hip
//   head    3/4 view, origin = neck, head centre at (0, -(R + 2))
//   cape    3 segments hanging along +y, origin = top of each segment
//   foot    origin = ankle, x = forward
import { Container, Graphics, Rectangle } from 'pixi.js';
import type { ColorSource, Renderer, Texture } from 'pixi.js';
import { CHARACTER_SPECS, DETAIL_LINE, OUTLINE, OUTLINE_WIDTH } from '../characters';

export type Pt = [number, number];

const OW = OUTLINE_WIDTH;
const D = DETAIL_LINE;
const PAD = 3;
const ATLAS_RES = 3; // texels per world unit: fighters get scaled up a lot on big screens

export interface AtlasJson {
  name: string;
  imagePath: string;
  width: number;
  height: number;
  SubTexture: { name: string; x: number; y: number; width: number; height: number }[];
}

export interface PartInfo {
  /** pivot (joint) position, normalised 0..1 inside the sub-texture */
  pivotX: number;
  pivotY: number;
}

export interface FighterAtlas {
  texture: Texture;
  json: AtlasJson;
  parts: Map<string, PartInfo>;
}

const flat = (pts: Pt[]): number[] => pts.flat();
/** torso space: x = forward, v = height above the hip joint */
const tp = (x: number, v: number): Pt => [x, -v];
const tpts = (pts: Pt[]): Pt[] => pts.map(([x, v]) => tp(x, v));
const tpoly = (pts: Pt[]): number[] => flat(tpts(pts));
const PI = Math.PI;
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Cape segment length (the cape hangs on 3 chained bones so it can bend like cloth). */
export const CAPE_SEG = 42;

// ------------------------------------------------------------------ helpers
type WFn = (t: number) => number;
/** Width profile: linear a→b plus a sine bulge (muscle/calf) peaking near t = 0.5^(1/skew). */
const wp = (a: number, b: number, bulge = 0, skew = 1): WFn => (t) =>
  lerp(a, b, t) + bulge * Math.sin(PI * Math.pow(Math.min(1, Math.max(0, t)), skew));

function limbPoly(len: number, w: WFn, t0 = 0, t1 = 1, n = 12): Pt[] {
  const top: Pt[] = [], bot: Pt[] = [];
  for (let i = 0; i <= n; i++) {
    const t = lerp(t0, t1, i / n);
    top.push([len * t, -w(t) / 2]);
    bot.push([len * t, w(t) / 2]);
  }
  bot.reverse();
  return [...top, ...bot];
}

/** x-ranges where the line y = c (or x = c) crosses a simple polygon. */
function scan(poly: Pt[], c: number, vertical: boolean): number[] {
  const out: number[] = [];
  const ax = vertical ? 1 : 0, ay = vertical ? 0 : 1;
  for (let i = 0; i < poly.length; i++) {
    const a = poly[i], b = poly[(i + 1) % poly.length];
    if ((a[ay] - c) * (b[ay] - c) < 0) out.push(a[ax] + ((c - a[ay]) / (b[ay] - a[ay])) * (b[ax] - a[ax]));
  }
  // oxlint-disable-next-line unicorn/no-array-sort -- local array
  return out.sort((p, q) => p - q);
}

/** Windowpane check clipped to a polygon. */
function check(g: Graphics, poly: Pt[], step: number, color: ColorSource, width: number, alpha: number, off = 0): void {
  const xs = poly.map((p) => p[0]), ys = poly.map((p) => p[1]);
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
  for (let y = Math.ceil((y0 - off) / step) * step + off; y < y1; y += step) {
    const r = scan(poly, y, false);
    for (let i = 0; i + 1 < r.length; i += 2) g.moveTo(r[i], y).lineTo(r[i + 1], y);
  }
  for (let x = Math.ceil((x0 - off) / step) * step + off; x < x1; x += step) {
    const r = scan(poly, x, true);
    for (let i = 0; i + 1 < r.length; i += 2) g.moveTo(x, r[i]).lineTo(x, r[i + 1]);
  }
  g.stroke({ width, color, alpha });
}

interface LimbOpts {
  len: number; w: WFn; fill: ColorSource; shade: ColorSource;
  bands?: [number, number, ColorSource][];
  tweed?: [ColorSource, ColorSource];
  crease?: ColorSource;
  /** t where the side outlines start (hide them where the limb root sits inside the torso) */
  from?: number;
  light?: ColorSource;
}

/**
 * Tapered limb along +x. The proximal end is a fill-only cap (no ink), so a child
 * limb drawn over its parent hides the parent's end cap instead of adding a round
 * "seam"; the parent's distal ink ring still forms the outer contour of the joint.
 */
function limb(g: Graphics, o: LimbOpts): void {
  const { len, w } = o;
  const poly = limbPoly(len, w);
  g.circle(0, 0, w(0) / 2).fill(o.fill);
  g.poly(flat(poly)).fill(o.fill);
  g.circle(len, 0, w(1) / 2).fill(o.fill);
  for (const [t0, t1, c] of o.bands ?? []) {
    g.poly(flat(limbPoly(len, w, t0, Math.min(1, t1), 4))).fill(c);
    if (t1 >= 1) g.circle(len, 0, w(1) / 2).fill(c);
  }
  // cel shade along the back (+y) side, small highlight along the front
  const sh: Pt[] = [];
  for (let i = 0; i <= 10; i++) { const t = i / 10; sh.push([len * t, w(t) / 2]); }
  for (let i = 10; i >= 0; i--) { const t = i / 10; sh.push([len * t, w(t) / 2 - w(t) * 0.32]); }
  g.poly(flat(sh)).fill({ color: o.shade, alpha: 0.85 });
  if (o.light) {
    g.moveTo(len * 0.15, -w(0.15) * 0.28).lineTo(len * 0.75, -w(0.75) * 0.28)
      .stroke({ width: 2.2 * D, color: o.light, alpha: 0.7, cap: 'round' });
  }
  if (o.tweed) {
    check(g, poly, 6.5, o.tweed[0], 1.6 * D, 0.75, 1);
    check(g, poly, 6.5, o.tweed[1], 1.1 * D, 0.55, 4);
  }
  if (o.crease) g.moveTo(len * 0.04, -w(0.04) * 0.1).lineTo(len * 0.96, -w(0.96) * 0.1).stroke({ width: 1.6 * D, color: o.crease, alpha: 0.8 });
  // ink: both sides + rounded distal end, open at the proximal end
  const n = 12, f = o.from ?? 0;
  g.moveTo(len * f, -w(f) / 2);
  for (let i = 1; i <= n; i++) { const t = lerp(f, 1, i / n); g.lineTo(len * t, -w(t) / 2); }
  g.arc(len, 0, w(1) / 2, -PI / 2, PI / 2);
  for (let i = n - 1; i >= 0; i--) { const t = lerp(f, 1, i / n); g.lineTo(len * t, w(t) / 2); }
  g.stroke({ width: OW, color: OUTLINE, join: 'round', cap: 'round' });
}

const ink = (w = 1): { width: number; color: number; join: 'round'; cap: 'round' } =>
  ({ width: OW * w, color: OUTLINE, join: 'round', cap: 'round' });
const detail = (w: number, color: ColorSource = OUTLINE, alpha = 1) =>
  ({ width: w * D, color, alpha, join: 'round' as const, cap: 'round' as const });

function fist(g: Graphics, skin: ColorSource, shade: ColorSource, s: number): void {
  g.roundRect(-3 * s, -7.5 * s, 15 * s, 15 * s, 5.5 * s).fill(skin);
  g.roundRect(-3 * s, 2 * s, 15 * s, 5.5 * s, 3 * s).fill({ color: shade, alpha: 0.8 });
  g.roundRect(-3 * s, -7.5 * s, 15 * s, 15 * s, 5.5 * s).stroke(ink(0.8));
  for (const y of [-3.8, 0, 3.8]) g.moveTo(8 * s, y * s).lineTo(11.5 * s, y * s);
  g.stroke(detail(1.5));
  g.ellipse(4 * s, -5.5 * s, 5 * s, 2.6 * s).fill(skin).stroke(detail(1.6)); // thumb over the fingers
}

/** Knife gripped in the fist, blade out past the thumb (hand-bone local space). */
function knife(g: Graphics): void {
  // handle: pokes out below the fist
  g.roundRect(1.5, -6, 6, 17, 2).fill(0x3a2412).stroke(ink(0.7));
  g.moveTo(3, 4).lineTo(6, 4).moveTo(3, 8).lineTo(6, 8).stroke(detail(1.2, 0xc8a070));
  // guard
  g.roundRect(-0.5, -10, 10, 4, 1.5).fill(0xb8bec8).stroke(ink(0.7));
  // blade: straight spine, curved edge to the tip
  const blade = (): Graphics => g.moveTo(1.5, -10).lineTo(1.5, -36).quadraticCurveTo(5, -32, 8.5, -21).lineTo(8.5, -10).closePath();
  blade().fill(0xe4e9f0);
  g.moveTo(5.5, -11).lineTo(5.5, -30).stroke({ width: 1.2 * D, color: 0x9aa4b2 }); // fuller
  g.moveTo(7.5, -12).quadraticCurveTo(7.5, -24, 4, -33).stroke({ width: 1.4 * D, color: 0xffffff, alpha: 0.9 }); // edge shine
  blade().stroke(ink(0.8));
}

function openHand(g: Graphics, skin: ColorSource, shade: ColorSource): void {
  // flat, slightly limp academic hand: palm + fingers block + thumb
  g.roundRect(6, -4.8, 10, 9.6, 4).fill(skin).stroke(ink(0.7));
  g.ellipse(4, 0, 6, 5.6).fill(skin).stroke(ink(0.7));
  g.roundRect(6, -4.4, 4, 8.8, 2).fill(skin);
  g.ellipse(4, 2.5, 5, 2.6).fill({ color: shade, alpha: 0.7 });
  for (const y of [-1.6, 1.6]) g.moveTo(10.5, y).lineTo(15, y);
  g.stroke(detail(1.3));
  g.ellipse(6, -5.5, 4, 2).fill(skin).stroke(detail(1.6));
}

type Draw = (g: Graphics) => void;

// ---------------------------------------------------------------- SUPERNEUS
const mouthLine: Draw = (g) => {
  // determined half-smile
  g.moveTo(-4, 0).quadraticCurveTo(0, 1.4, 4, -1).stroke(detail(2.4));
  g.moveTo(4, -1).lineTo(5, -2.2).stroke(detail(1.8));
};
const mouthO: Draw = (g) => {
  g.ellipse(0.5, 1, 2.6, 3.2).fill(OUTLINE);
};

function superneusParts(): [string, Draw][] {
  const S = CHARACTER_SPECS.superneus, C = S.palette, P = S.proportions;
  const T = P.torso;
  const R = P.headRadius, hx = 0, hy = -(R + 2);

  // 3/4 view torso (chest turned to the viewer, x = forward): V-taper, emblem, belt
  const torso: Draw = (g) => {
    // neck
    g.poly(tpoly([[-6, T - 6], [9, T - 6], [8, T + 8], [-5, T + 8]])).fill(C.skin).stroke(ink());
    g.poly(tpoly([[-6, T - 6], [-1, T - 6], [-1, T + 8], [-5, T + 8]])).fill(C.skinShade);
    const body: Pt[] = [
      [-7, T + 1], [-19, T - 1], [-28, T - 6], [-31.5, T - 14], [-30, T - 24], [-25, T - 32],
      [-17, 25], [-13.5, 15], [-15, 4], [-13, -7], [-2, -11], [10, -7], [16, 4],
      [14.5, 15], [18, 25], [26, T - 30], [31, T - 20], [30.5, T - 10], [26, T - 3], [14, T], [9, T + 1],
    ];
    g.poly(tpoly(body)).fill(C.suit);
    // cel shade on the far (back) side
    g.poly(tpoly([[-19, T - 1], [-28, T - 6], [-31.5, T - 14], [-30, T - 24], [-25, T - 32], [-17, 25], [-13.5, 15],
      [-15, 4], [-13, -7], [-6, -9], [-8, 4], [-8, 15], [-11, 26], [-18, T - 30], [-21, T - 16], [-15, T - 5]])).fill(C.suitShade);
    // highlight on the near pec / delt
    g.ellipse(...tp(20, T - 15), 6, 3.5).fill({ color: C.suitLight, alpha: 0.55 });
    // magenta side panels (obliques)
    g.poly(tpoly([[-25, T - 32], [-17, 25], [-13.5, 14], [-10.5, 14], [-12.5, 25], [-19, T - 31]])).fill(C.stripe).stroke(detail(1.6));
    g.poly(tpoly([[26, T - 30], [18, 25], [14.5, 14], [11.5, 14], [14, 25], [21, T - 30]])).fill(C.stripe).stroke(detail(1.6));
    // muscle lines: pecs, sternum, abs
    g.moveTo(...tp(-16, T - 31)).quadraticCurveTo(...tp(-8, T - 38), ...tp(-1, T - 34)).stroke(detail(1.8, C.suitLine));
    g.moveTo(...tp(11, T - 34)).quadraticCurveTo(...tp(18, T - 38), ...tp(25, T - 30)).stroke(detail(1.8, C.suitLine));
    g.moveTo(...tp(5, T - 41)).lineTo(...tp(4, 16)).stroke(detail(1.6, C.suitLine));
    for (const v of [33, 24]) {
      g.moveTo(...tp(-6, v + 1)).quadraticCurveTo(...tp(-1, v - 1), ...tp(3, v)).stroke(detail(1.4, C.suitLine));
      g.moveTo(...tp(6, v)).quadraticCurveTo(...tp(10, v - 1), ...tp(14, v + 1)).stroke(detail(1.4, C.suitLine));
    }
    // chest emblem: magenta V rim, purple inside, gold wings, golden nose
    g.poly(tpoly([[-17, T - 4], [27, T - 4], [5, T - 42]])).fill(C.stripe).stroke(ink(0.9));
    g.poly(tpoly([[-9.5, T - 8], [19.5, T - 8], [5, T - 33]])).fill(C.suit).stroke(detail(1.6));
    g.poly(tpoly([[-9.5, T - 8], [3, T - 8], [1, T - 19], [-3, T - 18]])).fill(C.gold).stroke(detail(1.4));
    g.poly(tpoly([[7, T - 8], [19.5, T - 8], [13, T - 18], [9, T - 19]])).fill(C.gold).stroke(detail(1.4));
    g.poly(tpoly([[3.5, T - 6], [6.5, T - 6], [11, T - 23], [8.5, T - 26.5], [4.5, T - 27], [0.5, T - 25], [0.5, T - 22]]))
      .fill(C.gold).stroke(detail(1.6));
    g.poly(tpoly([[0.5, T - 22], [0.5, T - 25], [4.5, T - 27], [6, T - 24]])).fill(C.goldShade);
    g.ellipse(...tp(4, T - 24.5), 1.4, 0.9).fill(OUTLINE);
    g.ellipse(...tp(8, T - 24.5), 1.4, 0.9).fill(OUTLINE);
    // trunks line
    g.moveTo(...tp(-13, 2)).quadraticCurveTo(...tp(-3, -2), ...tp(0, -10)).stroke(detail(1.6, C.suitLine));
    g.moveTo(...tp(15, 2)).quadraticCurveTo(...tp(6, -2), ...tp(3, -9)).stroke(detail(1.6, C.suitLine));
    // gold belt in blocks + buckle
    g.poly(tpoly([[-15, 5], [16, 5], [15, 13.5], [-14, 13.5]])).fill(C.belt).stroke(detail(2));
    g.poly(tpoly([[-15, 5], [-8, 5], [-8, 13.5], [-14, 13.5]])).fill(C.beltShade);
    for (const x of [-8, -2.5, 9, 13]) g.rect(x - 0.9, -13.5, 1.8, 8.5).fill(C.suitShade);
    g.rect(-0.5, -14.8, 8.5, 11).fill(C.gold).stroke(detail(1.8));
    g.rect(1.6, -12.4, 4.3, 6.2).fill(C.goldShade);
    // ink outline last
    g.poly(tpoly(body)).stroke(ink());
    g.moveTo(...tp(-7, T + 1)).quadraticCurveTo(...tp(1, T - 3), ...tp(9, T + 1)).stroke(detail(2));
  };

  // 3/4 egg-shaped bald head, turned toward the opponent (+x)
  const head: Draw = (g) => {
    const cx = hx, cy = hy;
    const shape = (): Graphics => g.moveTo(cx - 0.78 * R, cy + 0.25 * R)
      .bezierCurveTo(cx - 1.02 * R, cy - 0.9 * R, cx - 0.2 * R, cy - 1.12 * R, cx + 0.25 * R, cy - 1.05 * R)
      .bezierCurveTo(cx + 0.72 * R, cy - 0.95 * R, cx + 0.88 * R, cy - 0.5 * R, cx + 0.82 * R, cy - 0.12 * R)
      .lineTo(cx + 0.8 * R, cy + 0.45 * R)
      .bezierCurveTo(cx + 0.8 * R, cy + 0.9 * R, cx + 0.62 * R, cy + 1.12 * R, cx + 0.32 * R, cy + 1.12 * R)
      .bezierCurveTo(cx - 0.05 * R, cy + 1.1 * R, cx - 0.4 * R, cy + 0.85 * R, cx - 0.55 * R, cy + 0.68 * R)
      .closePath();
    shape().fill(C.skin);
    // back-of-skull cel shade
    g.moveTo(cx - 0.78 * R, cy + 0.25 * R).bezierCurveTo(cx - 1.02 * R, cy - 0.9 * R, cx - 0.2 * R, cy - 1.12 * R, cx + 0.05 * R, cy - 1.08 * R)
      .bezierCurveTo(cx - 0.6 * R, cy - 0.85 * R, cx - 0.55 * R, cy + 0.1 * R, cx - 0.3 * R, cy + 0.85 * R)
      .lineTo(cx - 0.55 * R, cy + 0.68 * R).closePath().fill(C.skinShade);
    // jaw shadow / near clean-shaven stubble
    g.moveTo(cx - 0.2 * R, cy + 0.55 * R).bezierCurveTo(cx + 0.1 * R, cy + 0.85 * R, cx + 0.5 * R, cy + 0.85 * R, cx + 0.8 * R, cy + 0.6 * R)
      .lineTo(cx + 0.62 * R, cy + 1.1 * R).lineTo(cx + 0.1 * R, cy + 1.05 * R).closePath().fill({ color: C.stubble, alpha: 0.16 });
    // scalp shine
    g.moveTo(cx - 0.35 * R, cy - 0.78 * R).quadraticCurveTo(cx + 0.05 * R, cy - 1.0 * R, cx + 0.45 * R, cy - 0.85 * R)
      .stroke({ width: 3 * D, color: 0xffffff, alpha: 0.75, cap: 'round' });
    shape().stroke(ink());
    // ear
    g.ellipse(cx - 0.5 * R, cy + 0.12 * R, 0.17 * R, 0.3 * R).fill(C.skin).stroke(detail(2.4));
    g.moveTo(cx - 0.5 * R, cy - 0.02 * R).quadraticCurveTo(cx - 0.6 * R, cy + 0.15 * R, cx - 0.48 * R, cy + 0.3 * R).stroke(detail(1.4));
    // eyes (both visible in 3/4), near one bigger
    g.ellipse(cx + 0.08 * R, cy - 0.1 * R, 0.17 * R, 0.12 * R).fill(0xffffff).stroke(detail(1.6));
    g.circle(cx + 0.14 * R, cy - 0.09 * R, 0.08 * R).fill(C.eye);
    g.ellipse(cx + 0.66 * R, cy - 0.12 * R, 0.11 * R, 0.11 * R).fill(0xffffff).stroke(detail(1.5));
    g.circle(cx + 0.7 * R, cy - 0.11 * R, 0.07 * R).fill(C.eye);
    // determined brows, angled down toward the nose
    g.moveTo(cx - 0.16 * R, cy - 0.4 * R).lineTo(cx + 0.3 * R, cy - 0.24 * R).stroke(detail(3.4));
    g.moveTo(cx + 0.54 * R, cy - 0.27 * R).lineTo(cx + 0.82 * R, cy - 0.38 * R).stroke(detail(3));
    // cheekbone + chin crease
    g.moveTo(cx - 0.05 * R, cy + 0.25 * R).quadraticCurveTo(cx + 0.05 * R, cy + 0.5 * R, cx + 0.12 * R, cy + 0.62 * R).stroke(detail(1.4, C.skinShade));
    g.moveTo(cx + 0.28 * R, cy + 0.98 * R).lineTo(cx + 0.45 * R, cy + 0.96 * R).stroke(detail(1.4));
  };

  // nose: origin at the bridge; a prominent but straight nose, as on the sheet. Scaled up during SNUIF!
  const nose: Draw = (g) => {
    const pts = [0, -1, 4.5, 4, 9, 10, 11, 13, 10, 15, 7, 15.5, 4.8, 14.6, 3, 15, 1, 13, 1.5, 8];
    g.poly(pts).fill(C.skin);
    g.poly([0, -1, 1.5, 8, 1, 13, 3, 15, 2.2, 9, 1, 3]).fill(C.skinShade);
    g.poly(pts).stroke(detail(2.2));
    g.ellipse(6.5, 14, 1.6, 0.9).fill(OUTLINE); // nostril
    g.moveTo(2.6, 11).quadraticCurveTo(1.2, 13, 3, 14.6).stroke(detail(1.3)); // wing
    g.circle(8.5, 10, 1.1).fill({ color: 0xffffff, alpha: 0.7 });
  };

  // cape: 3 chained segments hanging along +y; we mostly see the darker lining
  // because the cape hangs behind a 3/4-turned body. Each lower segment's fill
  // extends upward over its parent's bottom so the joints never show.
  const capeW = [42, 52, 62, 72];
  const cape = (i: number): Draw => (g) => {
    const a = capeW[i], b = capeW[i + 1], L = CAPE_SEG, ext = i === 0 ? 0 : 14;
    const xl = (y: number): number => -lerp(a, b, y / L) * 0.66;
    const xr = (y: number): number => lerp(a, b, y / L) * 0.34;
    const hem: Pt[] = [];
    if (i === 2) {
      for (let k = 0; k <= 6; k++) {
        const x = lerp(xr(L), xl(L), k / 6);
        hem.push([x, L + (k % 2 === 1 ? -4 : 3)]);
      }
    } else hem.push([xr(L), L], [xl(L), L]);
    const poly: Pt[] = [[xl(-ext), -ext], [xr(-ext), -ext], ...hem];
    g.poly(flat(poly)).fill(C.capeInner);
    // outer face folding round at the trailing edge
    g.poly(flat([[xl(-ext), -ext], [xl(-ext) + 9, -ext], [xl(L) + 12, L - (i === 2 ? 2 : 0)], [xl(L), L + (i === 2 ? 3 : 0)]])).fill(C.cape);
    g.poly(flat([[xr(-ext), -ext], [xr(-ext) - 4, -ext], [xr(L) - 5, L], [xr(L), L]])).fill(C.cape);
    // folds
    for (const k of [0.3, 0.55]) {
      g.moveTo(lerp(xl(-ext), xr(-ext), k), -ext + (i === 0 ? 8 : 0)).lineTo(lerp(xl(L), xr(L), k - 0.05), L - (i === 2 ? 4 : 0));
    }
    g.stroke(detail(1.5, OUTLINE, 0.45));
    // ink: sides (+ hem on the last segment)
    g.moveTo(xl(-ext), -ext).lineTo(...(i === 2 ? hem[hem.length - 1] : [xl(L), L] as Pt));
    g.moveTo(xr(-ext), -ext).lineTo(xr(L), L);
    if (i === 2) { g.moveTo(...hem[0]); for (const p of hem) g.lineTo(...p); }
    g.stroke(ink());
    if (i === 0) {
      // drape over the shoulders + high collar standing up behind the neck
      g.poly(flat([[xl(0) - 1, 4], [-30, -6], [-20, -22], [-6, -12], [6, -19], [14, -6], [xr(0) + 1, 4]]))
        .fill(C.capeInner).stroke(ink());
      g.poly(flat([[-27, -5], [-20, -20], [-8, -10], [-12, -2]])).fill(C.cape);
      g.poly(flat([[xl(0) - 1, 4], [xl(0) + 18, 2], [xr(0) - 6, 4], [xr(0) + 1, 4], [xr(0), 10], [xl(0), 10]])).fill(C.cape);
    }
  };

  const upperArm = (b: boolean): Draw => (g) => limb(g, {
    len: P.upperArm, w: wp(20, 14, 2.5, 0.8), fill: b ? C.suitShade : C.suit, shade: b ? C.suitLine : C.suitShade,
    light: b ? undefined : C.suitLight,
  });
  const foreArm = (b: boolean): Draw => (g) => limb(g, {
    len: P.foreArm, w: wp(14, 12, 3, 0.6), fill: b ? C.suitShade : C.suit, shade: b ? C.suitLine : C.suitShade,
    bands: [[0.42, 0.52, C.stripe], [0.52, 0.9, b ? C.suitLine : C.suitShade], [0.9, 1, C.stripe]],
  });
  const thigh = (b: boolean): Draw => (g) => limb(g, {
    len: P.thigh, w: wp(24, 15, 2, 0.7), fill: b ? C.suitShade : C.suit, shade: b ? C.suitLine : C.suitShade, from: 0.18,
    light: b ? undefined : C.suitLight,
  });
  const shin = (b: boolean): Draw => (g) => limb(g, {
    len: P.shin, w: wp(15, 12, 3.5, 0.55), fill: b ? C.suitShade : C.suit, shade: b ? C.suitLine : C.suitShade,
    bands: [[0.3, 0.4, b ? C.goldShade : C.bootTrim], [0.4, 1, b ? C.bootShade : C.boots]],
  });
  const bootFoot = (b: boolean): Draw => (g) => {
    const shape = (): Graphics => g.moveTo(-7, -10).lineTo(-8, 5).lineTo(19, 5).quadraticCurveTo(26, 4.5, 23, -1)
      .quadraticCurveTo(17, -5, 7, -6).lineTo(6, -10).closePath();
    shape().fill(b ? C.bootShade : C.boots);
    g.rect(-8, 2, 28, 3).fill(C.suitLine);
    shape().stroke(ink(0.9));
  };

  return [
    ['superneus/torso', torso],
    ['superneus/head', head],
    ['superneus/nose', nose],
    ['superneus/mouth', mouthLine],
    ['superneus/mouthO', mouthO],
    ['superneus/cape', cape(0)],
    ['superneus/cape2', cape(1)],
    ['superneus/cape3', cape(2)],
    ['superneus/upperArmF', upperArm(false)],
    ['superneus/upperArmB', upperArm(true)],
    ['superneus/foreArmF', foreArm(false)],
    ['superneus/foreArmB', foreArm(true)],
    ['superneus/handF', (g) => fist(g, C.skin, C.skinShade, 1.05)],
    ['superneus/knife', knife],
    ['superneus/handB', (g) => fist(g, C.skinShade, C.skinShade, 1)],
    ['superneus/thighF', thigh(false)],
    ['superneus/thighB', thigh(true)],
    ['superneus/shinF', shin(false)],
    ['superneus/shinB', shin(true)],
    ['superneus/footF', bootFoot(false)],
    ['superneus/footB', bootFoot(true)],
  ];
}

// ---------------------------------------------------------------- POTTERPIM
function potterpimParts(): [string, Draw][] {
  const S = CHARACTER_SPECS.potterpim, C = S.palette, P = S.proportions;
  const T = P.torso;
  const R = P.headRadius, hx = 0, hy = -(R + 2);

  // 3/4 view: narrow sloping shoulders, open tweed jacket hanging below the hips
  const torso: Draw = (g) => {
    g.poly(flat(tpts([[-5, T - 6], [8, T - 6], [8, T + 8], [-4, T + 8]]))).fill(C.skin).stroke(ink());
    const jacket = tpts([
      [-6, T + 2], [-14, T - 1], [-20, T - 7], [-21.5, T - 18], [-20, 18], [-21, -8], [-20, -22],
      [3, -25], [13, -22], [18, -14], [19, 8], [18, 26], [20, T - 22], [21.5, T - 9], [16, T - 1], [9, T + 2],
    ]);
    g.poly(flat(jacket)).fill(C.jacket);
    g.poly(flat(tpts([[-14, T - 1], [-20, T - 7], [-21.5, T - 18], [-20, 18], [-21, -8], [-20, -22], [-12, -23],
      [-12, -4], [-12, 20], [-14, T - 20], [-15, T - 8]]))).fill(C.jacketShade);
    check(g, jacket, 7, C.plaid, 1.7 * D, 0.8, 2);
    check(g, jacket, 7, C.plaidLight, 1.1 * D, 0.6, 5.5);
    // shirt V, collar points, tie
    g.poly(flat(tpts([[-3, T + 2], [12, T + 2], [9, T - 30], [4, T - 30]]))).fill(C.shirt).stroke(detail(1.6));
    g.poly(flat(tpts([[8, T + 2], [12, T + 2], [9.5, T - 30]]))).fill(C.shirtShade);
    g.poly(flat(tpts([[3, T - 1], [8.5, T - 1], [8, T - 5], [10, T - 29], [6.5, T - 34], [3.5, T - 29], [4, T - 5]])))
      .fill(C.tie).stroke(detail(1.6));
    g.poly(flat(tpts([[7.5, T - 6], [10, T - 29], [8, T - 31.5]]))).fill(C.tieShade);
    g.poly(flat(tpts([[2.5, T + 2.5], [9, T + 2.5], [8.5, T - 2], [3, T - 2]]))).fill(C.tie).stroke(detail(1.6));
    g.poly(flat(tpts([[-3, T + 3], [3, T - 4], [5.5, T + 3]]))).fill(C.shirt).stroke(detail(1.6));
    g.poly(flat(tpts([[6.5, T + 3], [9.5, T - 4], [13, T + 2.5]]))).fill(C.shirt).stroke(detail(1.6));
    // lapels (notched) on both sides of the opening
    g.poly(flat(tpts([[-4, T + 2], [-8, T - 3], [-5, T - 7], [-7, T - 10], [3.5, T - 31], [-2, T - 8]]))).fill(C.jacketLight).stroke(detail(1.8));
    g.poly(flat(tpts([[13, T + 2], [17, T - 4], [15, T - 7], [17, T - 10], [10, T - 31], [11.5, T - 10]]))).fill(C.jacketShade).stroke(detail(1.8));
    // front edge of the jacket (curving away at the hem), buttons, pockets
    g.moveTo(...tp(4, T - 31)).lineTo(...tp(6, 0)).quadraticCurveTo(...tp(7, -18), ...tp(13, -22)).stroke(detail(2));
    g.circle(...tp(7.5, 15), 1.5).fill(OUTLINE);
    g.circle(...tp(7.8, 3), 1.5).fill(OUTLINE);
    g.poly(flat(tpts([[-17, 4], [-6, 4], [-6, 0], [-17, 0]]))).fill(C.jacketShade).stroke(detail(1.6));
    g.poly(flat(tpts([[10, 4], [17.5, 4], [17.5, 0], [10, 0]]))).fill(C.jacket).stroke(detail(1.6));
    g.moveTo(...tp(12, T - 22)).lineTo(...tp(19, T - 21)).stroke(detail(1.6));
    g.poly(flat(jacket)).stroke(ink());
  };

  const head: Draw = (g) => {
    const cx = hx, cy = hy;
    // medium-long wavy black hair: back mass falls past the ear to the jaw/neck,
    // ending in loose wavy tips (drawn behind the face)
    const P2 = (pts: [number, number][]): number[] => pts.flatMap(([x, y]) => [cx + x * R, cy + y * R]);
    const backHair = (): Graphics => g.moveTo(cx + 0.78 * R, cy - 0.5 * R)
      .bezierCurveTo(cx + 0.5 * R, cy - 1.2 * R, cx - 0.65 * R, cy - 1.22 * R, cx - 0.98 * R, cy - 0.55 * R)
      .bezierCurveTo(cx - 1.18 * R, cy - 0.1 * R, cx - 1.02 * R, cy + 0.4 * R, cx - 1.12 * R, cy + 0.95 * R)
      .quadraticCurveTo(cx - 0.98 * R, cy + 1.12 * R, cx - 0.86 * R, cy + 0.92 * R)
      .quadraticCurveTo(cx - 0.74 * R, cy + 1.16 * R, cx - 0.58 * R, cy + 0.98 * R)
      .quadraticCurveTo(cx - 0.44 * R, cy + 1.08 * R, cx - 0.36 * R, cy + 0.8 * R)
      .bezierCurveTo(cx - 0.4 * R, cy + 0.3 * R, cx - 0.2 * R, cy - 0.3 * R, cx + 0.78 * R, cy - 0.5 * R)
      .closePath();
    backHair().fill(C.hair);
    backHair().stroke(ink());
    // wave strands
    g.moveTo(cx - 0.5 * R, cy - 0.85 * R).bezierCurveTo(cx - 0.9 * R, cy - 0.4 * R, cx - 0.7 * R, cy + 0.2 * R, cx - 0.9 * R, cy + 0.75 * R);
    g.moveTo(cx - 0.15 * R, cy - 0.95 * R).bezierCurveTo(cx - 0.6 * R, cy - 0.5 * R, cx - 0.5 * R, cy + 0.2 * R, cx - 0.6 * R, cy + 0.85 * R);
    g.stroke(detail(1.4, C.hairLight, 0.9));
    // face
    const face = (): Graphics => g.moveTo(cx - 0.62 * R, cy - 0.3 * R)
      .bezierCurveTo(cx - 0.5 * R, cy - 0.95 * R, cx + 0.6 * R, cy - 0.95 * R, cx + 0.82 * R, cy - 0.25 * R)
      .lineTo(cx + 0.86 * R, cy + 0.35 * R)
      .bezierCurveTo(cx + 0.82 * R, cy + 0.85 * R, cx + 0.5 * R, cy + 1.0 * R, cx + 0.2 * R, cy + 1.0 * R)
      .bezierCurveTo(cx - 0.2 * R, cy + 0.98 * R, cx - 0.55 * R, cy + 0.6 * R, cx - 0.62 * R, cy + 0.2 * R)
      .closePath();
    face().fill(C.skin);
    g.moveTo(cx - 0.62 * R, cy - 0.3 * R).bezierCurveTo(cx - 0.4 * R, cy - 0.5 * R, cx - 0.3 * R, cy + 0.2 * R, cx - 0.2 * R, cy + 0.6 * R)
      .lineTo(cx - 0.62 * R, cy + 0.2 * R).closePath().fill(C.skinShade);
    face().stroke(ink());
    // ear
    g.ellipse(cx - 0.52 * R, cy + 0.05 * R, 0.16 * R, 0.27 * R).fill(C.skin).stroke(detail(2.2));
    // short full beard + moustache along the jaw
    const beard = (): Graphics => g.moveTo(cx - 0.5 * R, cy + 0.15 * R)
      .lineTo(cx - 0.3 * R, cy + 0.35 * R)
      .bezierCurveTo(cx - 0.1 * R, cy + 0.72 * R, cx + 0.15 * R, cy + 0.5 * R, cx + 0.45 * R, cy + 0.52 * R)
      .lineTo(cx + 0.88 * R, cy + 0.5 * R)
      .bezierCurveTo(cx + 0.92 * R, cy + 0.95 * R, cx + 0.6 * R, cy + 1.25 * R, cx + 0.22 * R, cy + 1.22 * R)
      .bezierCurveTo(cx - 0.2 * R, cy + 1.2 * R, cx - 0.55 * R, cy + 0.75 * R, cx - 0.5 * R, cy + 0.15 * R)
      .closePath();
    beard().fill(C.hair);
    beard().stroke(ink(0.8));
    for (const [x, y] of [[-0.2, 0.75], [0.15, 0.95], [0.5, 0.85], [0.3, 1.1], [-0.3, 0.45]]) {
      g.moveTo(cx + x * R, cy + y * R).quadraticCurveTo(cx + (x + 0.08) * R, cy + (y - 0.1) * R, cx + (x + 0.15) * R, cy + y * R);
    }
    g.stroke(detail(1.4, C.hairLight));
    // smug smirk (lip showing through the beard)
    g.moveTo(cx + 0.3 * R, cy + 0.74 * R).quadraticCurveTo(cx + 0.55 * R, cy + 0.8 * R, cx + 0.8 * R, cy + 0.64 * R)
      .stroke({ width: 2.6 * D, color: 0xb05a50, cap: 'round' });
    g.moveTo(cx + 0.3 * R, cy + 0.74 * R).quadraticCurveTo(cx + 0.55 * R, cy + 0.8 * R, cx + 0.8 * R, cy + 0.64 * R)
      .stroke(detail(1.2));
    // nose
    g.moveTo(cx + 0.6 * R, cy - 0.05 * R).lineTo(cx + 1.0 * R, cy + 0.3 * R).quadraticCurveTo(cx + 0.95 * R, cy + 0.42 * R, cx + 0.72 * R, cy + 0.38 * R)
      .fill(C.skin).stroke(detail(2));
    // eyes behind ROUND black glasses (both lenses visible in 3/4)
    g.circle(cx + 0.18 * R, cy - 0.05 * R, 0.3 * R).fill({ color: C.lens, alpha: 0.85 });
    g.ellipse(cx + 0.74 * R, cy - 0.06 * R, 0.2 * R, 0.27 * R).fill({ color: C.lens, alpha: 0.85 });
    g.circle(cx + 0.22 * R, cy - 0.04 * R, 0.08 * R).fill(C.eye);
    g.circle(cx + 0.78 * R, cy - 0.05 * R, 0.07 * R).fill(C.eye);
    // half-lidded smug eyes
    g.moveTo(cx + 0.06 * R, cy - 0.11 * R).lineTo(cx + 0.34 * R, cy - 0.1 * R).stroke(detail(1.8));
    g.circle(cx + 0.18 * R, cy - 0.05 * R, 0.3 * R).stroke(ink(1));
    g.ellipse(cx + 0.74 * R, cy - 0.06 * R, 0.2 * R, 0.27 * R).stroke(ink(1));
    g.moveTo(cx + 0.48 * R, cy - 0.1 * R).quadraticCurveTo(cx + 0.51 * R, cy - 0.16 * R, cx + 0.55 * R, cy - 0.1 * R).stroke(detail(2.2));
    g.moveTo(cx - 0.12 * R, cy - 0.12 * R).lineTo(cx - 0.5 * R, cy - 0.05 * R).stroke(detail(2.2));
    g.moveTo(cx + 0.02 * R, cy - 0.24 * R).quadraticCurveTo(cx + 0.06 * R, cy - 0.18 * R, cx + 0.16 * R, cy - 0.22 * R)
      .stroke({ width: 1.6 * D, color: 0xffffff, alpha: 0.9, cap: 'round' });
    // brows: near one RAISED high (smug), far one flat
    g.moveTo(cx - 0.05 * R, cy - 0.5 * R).quadraticCurveTo(cx + 0.2 * R, cy - 0.78 * R, cx + 0.42 * R, cy - 0.56 * R).stroke(detail(3.2, C.hair));
    g.moveTo(cx + 0.6 * R, cy - 0.42 * R).lineTo(cx + 0.88 * R, cy - 0.44 * R).stroke(detail(2.8, C.hair));
    // side-parted fringe swept over the forehead (stays above the glasses)
    const fringe = P2([[-0.72, -0.62], [-0.45, -1.02], [0.15, -1.08], [0.62, -0.9], [0.9, -0.5], [0.72, -0.56],
      [0.55, -0.44], [0.4, -0.58], [0.2, -0.46], [0.02, -0.62], [-0.22, -0.48], [-0.48, -0.6]]);
    g.poly(fringe).fill(C.hair).stroke(detail(2));
    g.moveTo(cx - 0.35 * R, cy - 0.9 * R).quadraticCurveTo(cx + 0.1 * R, cy - 0.78 * R, cx + 0.62 * R, cy - 0.66 * R);
    g.moveTo(cx - 0.55 * R, cy - 0.72 * R).quadraticCurveTo(cx - 0.1 * R, cy - 0.62 * R, cx + 0.3 * R, cy - 0.54 * R);
    g.stroke(detail(1.3, C.hairLight, 0.9));
    // sideburn joining hair and beard over the ear's front
    g.poly([cx - 0.42 * R, cy - 0.4 * R, cx - 0.25 * R, cy - 0.35 * R, cx - 0.3 * R, cy + 0.35 * R, cx - 0.45 * R, cy + 0.25 * R]).fill(C.hair);
    g.moveTo(cx - 0.33 * R, cy - 0.06 * R).lineTo(cx - 0.12 * R, cy - 0.08 * R).stroke(detail(1.8, C.glasses));
  };

  const upperArm = (b: boolean): Draw => (g) => limb(g, {
    len: P.upperArm, w: wp(15, 12, 0.5), fill: b ? C.jacketShade : C.jacket, shade: C.jacketShade,
    tweed: [C.plaid, C.plaidLight],
  });
  const foreArm = (b: boolean): Draw => (g) => limb(g, {
    len: P.foreArm, w: wp(12.5, 11.5), fill: b ? C.jacketShade : C.jacket, shade: C.jacketShade,
    tweed: [C.plaid, C.plaidLight], bands: [[0.93, 1, C.shirt]],
  });
  const thigh = (b: boolean): Draw => (g) => limb(g, {
    len: P.thigh, w: wp(18, 14), fill: b ? C.trousersShade : C.trousers, shade: C.trousersShade, from: 0.2,
    crease: b ? undefined : C.trousersShade,
  });
  const shin = (b: boolean): Draw => (g) => limb(g, {
    len: P.shin, w: wp(14, 15), fill: b ? C.trousersShade : C.trousers, shade: C.trousersShade,
    crease: b ? undefined : C.trousersShade,
  });
  const shoe = (b: boolean): Draw => (g) => {
    const shape = (): Graphics => g.moveTo(-6, -5).lineTo(-7, 5).lineTo(19, 5).quadraticCurveTo(26, 4.5, 23, -0.5)
      .quadraticCurveTo(16, -4.5, 6, -5).closePath();
    shape().fill(b ? C.shoesShade : C.shoes);
    g.rect(-7, 2.5, 28, 2.5).fill(C.shoesShade);
    g.ellipse(17, -1.5, 3.5, 1.3).fill({ color: 0xffffff, alpha: 0.35 });
    shape().stroke(ink(0.9));
    g.moveTo(6, -4.5).lineTo(10, -2.5).stroke(detail(1.4));
  };

  return [
    ['potterpim/torso', torso],
    ['potterpim/head', head],
    ['potterpim/upperArmF', upperArm(false)],
    ['potterpim/upperArmB', upperArm(true)],
    ['potterpim/foreArmF', foreArm(false)],
    ['potterpim/foreArmB', foreArm(true)],
    ['potterpim/handF', (g) => openHand(g, C.skin, C.skinShade)],
    ['potterpim/handB', (g) => openHand(g, C.skinShade, C.skinShade)],
    ['potterpim/thighF', thigh(false)],
    ['potterpim/thighB', thigh(true)],
    ['potterpim/shinF', shin(false)],
    ['potterpim/shinB', shin(true)],
    ['potterpim/footF', shoe(false)],
    ['potterpim/footB', shoe(true)],
  ];
}

/** Draws every part, shelf-packs them and renders one RenderTexture atlas. */
export function buildFighterAtlas(renderer: Renderer): FighterAtlas {
  const items = [...superneusParts(), ...potterpimParts()].map(([name, draw]) => {
    const g = new Graphics();
    draw(g);
    const b = g.getLocalBounds();
    const x0 = Math.floor(b.minX) - PAD, y0 = Math.floor(b.minY) - PAD;
    const w = Math.ceil(b.maxX) + PAD - x0, h = Math.ceil(b.maxY) + PAD - y0;
    return { name, g, x0, y0, w, h };
  });

  // shelf packing, tallest first
  const ATLAS_W = 640;
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy
  const sorted = [...items].sort((a, b) => b.h - a.h);
  let cx = 0, cy = 0, shelf = 0;
  const placed = sorted.map((it) => {
    if (cx + it.w > ATLAS_W) { cx = 0; cy += shelf; shelf = 0; }
    const at = { it, x: cx, y: cy };
    cx += it.w; shelf = Math.max(shelf, it.h);
    return at;
  });
  const ATLAS_H = Math.ceil(cy + shelf);

  const stage = new Container();
  const json: AtlasJson = { name: 'fighters', imagePath: 'fighters', width: ATLAS_W, height: ATLAS_H, SubTexture: [] };
  const parts = new Map<string, PartInfo>();
  for (const { it, x, y } of placed) {
    it.g.position.set(x - it.x0, y - it.y0);
    stage.addChild(it.g);
    json.SubTexture.push({ name: it.name, x, y, width: it.w, height: it.h });
    parts.set(it.name, { pivotX: -it.x0 / it.w, pivotY: -it.y0 / it.h });
  }
  const texture = renderer.generateTexture({
    target: stage,
    frame: new Rectangle(0, 0, ATLAS_W, ATLAS_H),
    resolution: ATLAS_RES,
    antialias: true,
  });
  stage.destroy({ children: true });
  return { texture, json, parts };
}
