// DragonBones 5.5 skeleton JSON for each fighter, generated in code.
//
// Poses use the angle convention of the old procedural renderer (radians,
// 0 = limb hanging straight down, positive = swung forward). `boneLocals` turns a
// pose into each bone's local transform; the setup pose is BASE, and every
// animation keyframe is stored as the offset from that setup pose (that is what
// DragonBones bone timelines contain). The hips are lifted per keyframe so the
// lowest foot touches the floor (feet at the armature origin).
import { CHARACTER_SPECS } from '../characters';
import type { CharacterProportions } from '../characters';
import type { FighterId, MoveKey } from '../../types';
import { CAPE_SEG } from './parts';
import type { PartInfo } from './parts';

export interface Pose {
  lean: number; head: number;
  fAU: number; fAE: number; bAU: number; bAE: number;
  fLU: number; fLK: number; bLU: number; bLK: number;
  rot: number; lift: number; nose: number;
  /** cape swing (radians, world space, + = trailing backward) and horizontal flare */
  cape: number; capeS: number;
  /** extra bend of the lower cape segments (cloth lag/flow) */
  capeB: number;
  /** if > 0, hip height used instead of "lowest foot on the floor" (air attacks) */
  hipFix: number;
}

export const FPS = 60;
/** Attack animations share one normalised timeline (seconds); see fighterRenderer. */
export const ATTACK_MARKS = { startupEnd: 0.2, activeEnd: 0.4, end: 1.0 } as const;
/** Walk cycle length (s); the renderer scrubs it forward or backward by walkDir. */
export const WALK_PERIOD = (2 * Math.PI) / 10;

const PI = Math.PI;
const DEG = 180 / PI;
const lerp = (a: number, b: number, k: number): number => a + (b - a) * k;

/** Fighting stances: Superneus = squared-up boxer guard; Potterpim = weight back,
 *  chin up, one hand raised as if lecturing, the other limp at his side. */
const BASES: Record<FighterId, Readonly<Pose>> = {
  superneus: {
    lean: 0.07, head: 0.05, fAU: 0.7, fAE: 2.05, bAU: 0.4, bAE: 2.25,
    fLU: 0.34, fLK: -0.36, bLU: -0.3, bLK: -0.22, rot: 0, lift: 0, nose: 1,
    cape: 0.06, capeS: 1, capeB: 0.04, hipFix: 0,
  },
  potterpim: {
    lean: -0.07, head: -0.16, fAU: 0.25, fAE: 1.55, bAU: -0.12, bAE: 0.35,
    fLU: 0.24, fLK: -0.1, bLU: -0.2, bLK: -0.06, rot: 0, lift: 0, nose: 1,
    cape: 0, capeS: 1, capeB: 0, hipFix: 0,
  },
};
// The skeleton is built for one fighter at a time; `pose()` fills in that fighter's stance.
let BASE: Readonly<Pose> = BASES.superneus;
const pose = (o: Partial<Pose>): Pose => ({ ...BASE, ...o });

// ------------------------------------------------------------------ bones
const BONES = [
  ['root', ''], ['hips', 'root'], ['chest', 'hips'], ['cape', 'chest'], ['cape2', 'cape'], ['cape3', 'cape2'],
  ['thighB', 'hips'], ['shinB', 'thighB'], ['footB', 'shinB'],
  ['upperArmB', 'chest'], ['foreArmB', 'upperArmB'], ['handB', 'foreArmB'],
  ['thighF', 'hips'], ['shinF', 'thighF'], ['footF', 'shinF'],
  ['head', 'chest'], ['nose', 'head'], ['mouth', 'head'],
  ['upperArmF', 'chest'], ['foreArmF', 'upperArmF'], ['handF', 'foreArmF'],
] as const;
type BoneName = typeof BONES[number][0];

/** Slots in draw order (back to front) with the bone each sits on. */
function slotsFor(id: FighterId): [string, BoneName][] {
  const back: [string, BoneName][] = [
    ['thighB', 'thighB'], ['shinB', 'shinB'], ['footB', 'footB'],
    ['upperArmB', 'upperArmB'], ['foreArmB', 'foreArmB'], ['handB', 'handB'],
  ];
  const front: [string, BoneName][] = [
    ['head', 'head'], ['nose', 'nose'], ['mouth', 'mouth'],
    ['upperArmF', 'upperArmF'], ['foreArmF', 'foreArmF'], ['handF', 'handF'],
  ];
  if (id === 'superneus') {
    // knife (hidden unless armed) sits just behind the fist so the fingers wrap its handle
    const armed = front.flatMap((sl): [string, BoneName][] => (sl[0] === 'handF' ? [['knife', 'handF'], sl] : [sl]));
    return [['cape', 'cape'], ['cape2', 'cape2'], ['cape3', 'cape3'], ...back, ['torso', 'chest'],
      ['thighF', 'thighF'], ['shinF', 'shinF'], ['footF', 'footF'], ...armed];
  }
  // Potterpim's jacket hangs over the top of his front thigh
  return [...back, ['thighF', 'thighF'], ['torso', 'chest'], ['shinF', 'shinF'], ['footF', 'footF'],
    ...front.filter(([s]) => s !== 'nose' && s !== 'mouth')];
}

interface Local { x: number; y: number; r: number; sx: number }

function lowestFoot(p: Pose, P: CharacterProportions): number {
  if (p.hipFix > 0) return p.hipFix;
  const f = P.thigh * Math.cos(p.fLU) + P.shin * Math.cos(p.fLU + p.fLK);
  const b = P.thigh * Math.cos(p.bLU) + P.shin * Math.cos(p.bLU + p.bLK);
  // a kneeling knee must not sink into the floor either (~7 units of knee radius)
  const knees = P.thigh * Math.max(Math.cos(p.fLU), Math.cos(p.bLU)) + 7 - 4;
  return Math.max(f, b, knees) + 4;
}

const T = (x: number, y: number, r = 0, sx = 1): Local => ({ x, y, r, sx });

function boneLocals(p: Pose, P: CharacterProportions): Record<BoneName, Local> {
  const R = P.headRadius;
  const L = p.lean * DEG;
  const arm = (a: number) => 90 - a * DEG - L;
  const thighF = 90 - p.fLU * DEG, shinF = -p.fLK * DEG;
  const thighB = 90 - p.bLU * DEG, shinB = -p.bLK * DEG;
  return {
    root: T(0, -p.lift, p.rot * DEG),
    hips: T(0, -lowestFoot(p, P)),
    chest: T(0, 0, L),
    cape: T(P.shoulderBX * 0.4, -(P.torso + 1), p.cape * DEG - L, p.capeS),
    cape2: T(0, CAPE_SEG, p.capeB * DEG),
    cape3: T(0, CAPE_SEG, p.capeB * 1.4 * DEG),
    head: T(P.neckX, -(P.torso + 2), p.head * DEG),
    nose: T(0.36 * R, -(R + 2) - 0.12 * R, 0, p.nose),
    mouth: T(0.4 * R, -(R + 2) + 0.68 * R),
    upperArmF: T(P.shoulderFX, -(P.torso - P.shoulderDrop), arm(p.fAU)),
    foreArmF: T(P.upperArm, 0, -p.fAE * DEG),
    handF: T(P.foreArm, 0),
    upperArmB: T(P.shoulderBX, -(P.torso - P.shoulderDrop), arm(p.bAU)),
    foreArmB: T(P.upperArm, 0, -p.bAE * DEG),
    handB: T(P.foreArm, 0),
    thighF: T(P.hipFX, 0, thighF), shinF: T(P.thigh, 0, shinF), footF: T(P.shin, 0, -(thighF + shinF)),
    thighB: T(P.hipBX, 0, thighB), shinB: T(P.thigh, 0, shinB), footB: T(P.shin, 0, -(thighB + shinB)),
  };
}

// ------------------------------------------------------------------ poses
// Superneus fights like a boxer (tight, straight blows); Potterpim flails: an
// overhead open-hand slap, a prissy kick with arms thrown up, stiff hops.
function phasePose(id: FighterId, move: MoveKey, k: number, wind = false): Pose {
  const sn = id === 'superneus';
  const crouchLegs = { fLU: 1.45, fLK: -2.5, bLU: 0.55, bLK: -2.3 };
  const jumpLegs = sn ? { fLU: 1.3, fLK: -2.2, bLU: 0.7, bLK: -1.9, cape: 0.32, capeB: 0.25 }
    : { fLU: 0.9, fLK: -1.6, bLU: 0.2, bLK: -1.3 };
  const JUMP_HIP = 58;
  switch (move) {
    case 'punch':
      return sn
        ? pose({ fAU: lerp(0.2, 1.57, k), fAE: lerp(2.3, 0, k), lean: lerp(-0.05, 0.28, k), bAU: 0.45, bAE: 2.3,
          fLU: 0.45, bLU: -0.45, bLK: -0.1, cape: lerp(0.06, 0.2, k), capeB: lerp(0.04, 0.2, k) })
        : pose({ fAU: lerp(2.5, 1.45, k), fAE: lerp(1.3, 0.05, k), lean: lerp(-0.2, 0.25, k), bAU: lerp(-0.3, -0.7, k), bAE: 0.5,
          head: lerp(-0.25, 0.05, k), fLU: 0.4, fLK: -0.15, bLU: -0.35, bLK: -0.05 });
    case 'crouchPunch':
      return pose({ ...crouchLegs, fAU: lerp(sn ? 0.5 : 1.6, 1.6, k), fAE: lerp(sn ? 2.2 : 1.2, sn ? 0 : 0.1, k),
        lean: lerp(0.35, 0.55, k), bAU: sn ? 0.6 : -0.2, bAE: sn ? 2.1 : 0.6, cape: lerp(1.0, 1.1, k), capeB: -0.3 });
    case 'jumpPunch':
      return pose({ ...jumpLegs, hipFix: JUMP_HIP, fAU: lerp(sn ? 0.6 : 2.4, sn ? 1.9 : 1.5, k), fAE: lerp(sn ? 2.2 : 1.0, 0, k),
        lean: lerp(0.1, 0.35, k), bAU: sn ? -0.4 : 2.2, bAE: sn ? 1.5 : 0.5 });
    case 'kick':
      return sn
        ? pose({ fLU: lerp(0.9, 1.7, k), fLK: lerp(-1.9, 0, k), bLU: -0.15, bLK: 0, lean: lerp(0, -0.38, k),
          fAU: -0.5, fAE: 1.2, bAU: 0.9, bAE: 1.4, cape: lerp(0.06, -0.1, k), capeB: lerp(0.05, -0.15, k) })
        : pose({ fLU: lerp(0.5, 1.5, k), fLK: lerp(-1.3, -0.05, k), bLU: -0.2, bLK: 0, lean: lerp(0.05, -0.5, k),
          head: lerp(0, -0.35, k), fAU: lerp(0.4, 2.3, k), fAE: 0.7, bAU: lerp(0.2, 2.0, k), bAE: 0.4 });
    case 'crouchKick':
      return pose({ fLU: lerp(1.0, 1.5, k), fLK: lerp(-2.0, 0, k), bLU: 0.55, bLK: -2.3, lean: lerp(0.4, 0.15, k),
        fAU: sn ? 0.9 : 1.4, fAE: sn ? 1.8 : 0.6, bAU: sn ? 0.1 : -0.8, bAE: sn ? 1.2 : 0.4, cape: lerp(1.0, 1.15, k), capeB: -0.3 });
    case 'jumpKick':
      return pose({ ...jumpLegs, hipFix: JUMP_HIP, fLU: lerp(0.9, 1.25, k), fLK: lerp(-1.9, 0, k), lean: lerp(0.1, -0.25, k),
        fAU: sn ? -0.5 : 2.2, fAE: sn ? 1.4 : 0.5, bAU: sn ? 1.0 : 2.6, bAE: sn ? 1.4 : 0.4, cape: 0.4, capeB: 0.3 });
    case 'special':
      if (sn) {
        return pose({ lean: -0.28 * k, head: -0.35 * k, fAU: lerp(0.5, 0.95, k), fAE: lerp(2, 0.9, k),
          bAU: lerp(0.2, -1.5, k), bAE: lerp(2.2, -0.6, k), nose: 1 + 1.1 * k, fLU: 0.4, bLU: -0.4,
          cape: lerp(0.06, -0.12, k), capeB: lerp(0.04, -0.2, k) });
      }
      return wind
        ? pose({ fAU: lerp(0.55, 3.0, k), fAE: lerp(2.0, 0.5, k), lean: lerp(0.05, -0.25, k), bAU: -0.3, bAE: 1.2, fLU: 0.5, bLU: -0.45 })
        : pose({ fAU: lerp(3.0, 1.4, k), fAE: lerp(0.5, 0.05, k), lean: lerp(-0.25, 0.3, k), bAU: -0.3, bAE: 1.2, fLU: 0.5, bLU: -0.45 });
  }
}

interface AnimDef { name: string; keys: [number, Pose][]; playTimes: number }

function sampleLoop(name: string, period: number, n: number, fn: (t: number) => Pose): AnimDef {
  const keys: [number, Pose][] = [];
  for (let i = 0; i <= n; i++) keys.push([(period * i) / n, fn((period * i) / n)]);
  return { name, keys, playTimes: 0 };
}

function animations(id: FighterId): AnimDef[] {
  const sn = id === 'superneus';
  const { startupEnd: S, activeEnd: A, end: E } = ATTACK_MARKS;
  const attack = (move: MoveKey): AnimDef => ({
    name: move, playTimes: 1,
    keys: [[0, phasePose(id, move, 0)], [S * 0.6, phasePose(id, move, 0.15)], [S, phasePose(id, move, 1)],
      [A, phasePose(id, move, 1)], [A + 0.2, phasePose(id, move, 0.55)], [E, phasePose(id, move, 0.2)]],
  });
  const special: AnimDef = sn
    ? { name: 'special', playTimes: 1, keys: [
      [0, phasePose(id, 'special', 0)], [S, phasePose(id, 'special', 0.65)], [S + 0.06, phasePose(id, 'special', 1)],
      [A + 0.25, phasePose(id, 'special', 1)], [E, phasePose(id, 'special', 0.3)]] }
    : { name: 'special', playTimes: 1, keys: [
      [0, phasePose(id, 'special', 0, true)], [S, phasePose(id, 'special', 1, true)], [S + 0.06, phasePose(id, 'special', 0.7)],
      [A, phasePose(id, 'special', 1)], [A + 0.25, phasePose(id, 'special', 1)], [E, phasePose(id, 'special', 0.4, true)]] };

  const hitPose = (s: number): Pose => pose({ lean: -0.45 * s, head: -0.4 * s, fAU: sn ? -0.5 : 1.2, fAE: sn ? 0.8 : 0.3,
    bAU: sn ? -0.9 : -1.4, bAE: 0.6, fLU: 0.4, fLK: -0.6, bLU: -0.35, bLK: -0.2, cape: 0.25, capeB: 0.3 });
  const jumpPose = (c: number): Pose => sn
    ? pose({ fLU: 1.3, fLK: -2.2, bLU: 0.7, bLK: -1.9, fAU: 1.0, fAE: 1.6, bAU: -0.4, bAE: 1.5,
      lean: 0.15, cape: c, capeS: 1.1, capeB: 0.2 + c * 0.4 })
    : pose({ fLU: 0.9, fLK: -1.6, bLU: 0.2, bLK: -1.3, fAU: 1.9 + c, fAE: 0.4, bAU: 1.6 + c, bAE: 0.5, lean: -0.05, head: -0.25 });
  const crouchPose = (b: number): Pose => pose({ fLU: 1.45, fLK: -2.5, bLU: 0.55, bLK: -2.3, lean: 0.4 + 0.02 * b,
    fAU: sn ? 0.9 : 0.7, fAE: (sn ? 1.8 : 1.6) + 0.06 * b, bAU: sn ? 0.6 : 0.3, bAE: sn ? 2.1 : 1.0,
    head: sn ? 0 : -0.25, cape: 1.0 + 0.05 * b, capeB: -0.3 - 0.04 * b });
  const blockPose = (b: number): Pose => sn
    ? pose({ fAU: 1.15, fAE: 2.4, bAU: 1.0, bAE: 2.55, lean: -0.08 + 0.015 * b, head: 0.15,
      fLU: 0.4, bLU: -0.4, bLK: -0.3, cape: 0.06 + 0.03 * b, capeB: 0.06 })
    // Potterpim cowers behind both palms, leaning away
    : pose({ fAU: 1.5, fAE: 1.9, bAU: 1.3, bAE: 2.1, lean: -0.22 + 0.015 * b, head: -0.3, fLU: 0.35, bLU: -0.4, bLK: -0.25 });

  const idlePeriod = (2 * PI) / 3.2;
  const victoryPeriod = PI / 4;
  const koPose = (k: number, lift = 0): Pose => pose({ rot: -PI / 2 * k, lift: 13 * k + lift, lean: 0, head: -0.2, fAU: 2.6, fAE: 0.2,
    bAU: 2.2, bAE: 0.4, fLU: 0.15, fLK: -0.2, bLU: -0.1, bLK: 0, cape: 0.5 * k, capeB: -0.3 * k });
  return [
    sampleLoop('idle', idlePeriod, 12, (t) => {
      const b = Math.sin(t * 3.2), c = Math.sin(t * 6.4), w = Math.sin(t * 3.2 + 1.2);
      return sn
        ? pose({ lean: BASE.lean + b * 0.02, fAE: BASE.fAE + b * 0.08, bAE: BASE.bAE + b * 0.06,
          fLK: BASE.fLK - 0.08 * (b + 1), bLK: BASE.bLK - 0.08 * (b + 1), fLU: BASE.fLU + 0.04 * (b + 1),
          cape: 0.06 + 0.03 * c, capeB: 0.05 + 0.06 * w, capeS: 1 + 0.04 * Math.sin(t * 6.4 + 1.3) })
        // smug: rocks on his heels, chin bobbing, lecturing hand wagging
        : pose({ lean: BASE.lean - 0.03 * (b + 1), head: BASE.head - 0.05 * c, fAE: BASE.fAE + 0.18 * c, fAU: BASE.fAU + 0.05 * b,
          bAE: BASE.bAE + 0.05 * b });
    }),
    sampleLoop('walk', WALK_PERIOD, 12, (t) => {
      const ph = t * 10;
      return sn
        ? pose({ fLU: 0.05 + 0.5 * Math.sin(ph), bLU: 0.05 - 0.5 * Math.sin(ph),
          fLK: -0.25 - 0.7 * Math.max(0, Math.sin(ph + 1.6)), bLK: -0.25 - 0.7 * Math.max(0, Math.sin(ph + 1.6 + PI)),
          lean: 0.12, fAE: BASE.fAE + 0.15 * Math.sin(ph), bAU: BASE.bAU - 0.25 * Math.sin(ph), fAU: BASE.fAU + 0.2 * Math.sin(ph),
          cape: 0.22 + 0.06 * Math.sin(ph * 2), capeB: 0.15 + 0.1 * Math.sin(ph * 2 - 1), capeS: 1.05 + 0.05 * Math.sin(ph * 2 + 1) })
        // stiff, upright stroll with swinging arms
        : pose({ fLU: 0.02 + 0.38 * Math.sin(ph), bLU: 0.02 - 0.38 * Math.sin(ph),
          fLK: -0.1 - 0.45 * Math.max(0, Math.sin(ph + 1.6)), bLK: -0.1 - 0.45 * Math.max(0, Math.sin(ph + 1.6 + PI)),
          lean: -0.04, head: BASE.head + 0.04 * Math.sin(ph * 2), fAU: 0.1 - 0.35 * Math.sin(ph), fAE: 0.5,
          bAU: 0.05 + 0.35 * Math.sin(ph), bAE: 0.4 });
    }),
    { name: 'jump', playTimes: 0, keys: [[0, jumpPose(0.3)], [0.15, jumpPose(0.42)], [0.3, jumpPose(0.3)]] },
    { name: 'crouch', playTimes: 0, keys: [[0, crouchPose(0)], [0.6, crouchPose(1)], [1.2, crouchPose(0)]] },
    { name: 'block', playTimes: 0, keys: [[0, blockPose(0)], [0.3, blockPose(1)], [0.6, blockPose(0)]] },
    { name: 'hit', playTimes: 1, keys: [[0, hitPose(0.7)], [0.08, hitPose(1.15)], [0.25, hitPose(1)]] },
    { name: 'ko', playTimes: 1, keys: [[0, koPose(0)], [0.2, koPose(0.6)], [0.35, koPose(1)], [0.43, koPose(1, 5)], [0.5, koPose(1)]] },
    sampleLoop('victory', victoryPeriod, 8, (t) => {
      const bounce = Math.abs(Math.sin(t * 4));
      return sn
        ? pose({ fAU: 2.75, fAE: 0.35 + 0.15 * bounce, bAU: -0.6, bAE: 2.5, lean: -0.08, head: -0.15, fLU: 0.25, bLU: -0.25,
          lift: 4 * bounce, cape: 0.15 + 0.08 * bounce, capeB: 0.2 + 0.1 * bounce, capeS: 1.05 })
        // smug: one finger-wag hand up, the other on the hip, chin high
        : pose({ fAU: 2.2 + 0.2 * bounce, fAE: 1.0, bAU: -0.5, bAE: 2.4, lean: -0.15, head: -0.35 + 0.05 * bounce,
          fLU: 0.2, bLU: -0.2, lift: 2 * bounce });
    }),
    attack('punch'), attack('crouchPunch'), attack('jumpPunch'),
    attack('kick'), attack('crouchKick'), attack('jumpKick'),
    special,
  ];
}

// ------------------------------------------------------------------ JSON
const round = (v: number): number => Math.round(v * 1000) / 1000;
const normDeg = (d: number): number => { d %= 360; if (d > 180) d -= 360; if (d <= -180) d += 360; return d; };

type Json = Record<string, unknown>;

/** Builds the DragonBones (5.5 JSON) data object for one fighter. */
export function buildSkeletonJson(id: FighterId, parts: Map<string, PartInfo>): Json {
  const P = CHARACTER_SPECS[id].proportions;
  BASE = BASES[id];
  const setup = boneLocals(BASE, P);

  const bone = BONES.map(([name, parent]) => {
    const t = setup[name];
    const sc = name === 'head' ? P.headScale : 1; // nose + mouth are children, so they scale along
    const b: Json = { name, transform: { x: round(t.x), y: round(t.y), skX: round(t.r), skY: round(t.r), scX: t.sx * sc, scY: sc } };
    if (parent) b.parent = parent;
    return b;
  });

  const slots = slotsFor(id);
  const display = (tex: string): Json => {
    const name = `${id}/${tex}`;
    const info = parts.get(name);
    return { name, type: 'image', pivot: { x: round(info?.pivotX ?? 0.5), y: round(info?.pivotY ?? 0.5) } };
  };
  const skin = [{
    name: 'default',
    slot: slots.map(([s]) => ({ name: s, display: s === 'mouth' ? [display('mouth'), display('mouthO')] : [display(s)] })),
  }];

  const animation = animations(id).map((def) => {
    const frames = def.keys.map(([t]) => Math.round(t * FPS));
    const dur = (i: number): number => (i < frames.length - 1 ? frames[i + 1] - frames[i] : 0);
    const locals = def.keys.map(([, p]) => boneLocals(p, P));
    const bones = BONES.map(([name]) => {
      const tl: Json = { name };
      tl.rotateFrame = locals.map((l, i) => ({ duration: dur(i), tweenEasing: 0, rotate: round(normDeg(l[name].r - setup[name].r)) }));
      if (name === 'root' || name === 'hips') {
        tl.translateFrame = locals.map((l, i) => ({ duration: dur(i), tweenEasing: 0,
          x: round(l[name].x - setup[name].x), y: round(l[name].y - setup[name].y) }));
      }
      if (name === 'nose' || name === 'cape') {
        tl.scaleFrame = locals.map((l, i) => ({ duration: dur(i), tweenEasing: 0,
          x: round(l[name].sx / setup[name].sx), y: name === 'nose' ? round(l[name].sx) : 1 }));
      }
      return tl;
    });
    return { name: def.name, duration: frames[frames.length - 1], playTimes: def.playTimes, fadeInTime: 0, bone: bones };
  });

  return {
    frameRate: FPS, name: id, version: '5.5', compatibleVersion: '5.5',
    armature: [{
      type: 'Armature', frameRate: FPS, name: id,
      aabb: { x: -110, y: -230, width: 220, height: 240 },
      bone,
      slot: slots.map(([name, parent]) => ({ name, parent })),
      skin,
      animation,
      defaultActions: [{ gotoAndPlay: 'idle' }],
    }],
  };
}
