import { WORLD, PHYS, MOVES, SPECIALS, WORD_TEXTS, COMBAT } from './constants';
import { isAirborne } from './hitboxes';
import type { MoveSpec, HitSpec } from './constants';
import type { Match } from '../ecs/world';
import type { Fighter, FighterId, FighterState, GameEvent, Input, MoveAnim, MoveKey, ProjectileKind } from '../types';

export const EMPTY_INPUT: Readonly<Input> = Object.freeze({ left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false });

const NAMES: Record<FighterId, string> = { superneus: 'SUPERNEUS', potterpim: 'POTTERPIM' };

export function createFighter(id: FighterId, x: number, facing: 1 | -1): Fighter {
  return {
    id, name: NAMES[id], x, y: 0, vx: 0, vy: 0, facing,
    state: 'idle', stateTime: 0, attackPhase: null,
    health: COMBAT.maxHealth, maxHealth: COMBAT.maxHealth,
    specialMeter: 0, hitFlash: 0, walkDir: 0,
    // internal extras
    move: null, hasHit: false, crouching: false, holdBack: false,
    spawned: false, stun: 0, airAttackUsed: false, prevInput: { ...EMPTY_INPUT }, readyAnnounced: false,
  };
}

export function setState(f: Fighter, s: FighterState): void {
  if (f.state !== s) { f.state = s; f.stateTime = 0; }
}

function moveTotal(m: MoveSpec): number { return m.startup + m.active + m.recovery; }

function phaseOf(m: MoveSpec, t: number): 'startup' | 'active' | 'recovery' {
  if (t < m.startup) return 'startup';
  if (t < m.startup + m.active) return 'active';
  return 'recovery';
}

export function addMeter(f: Fighter, amt: number, events: GameEvent[]): void {
  if (f.state === 'ko') return;
  f.specialMeter = Math.min(COMBAT.maxMeter, f.specialMeter + amt);
  if (f.specialMeter >= COMBAT.maxMeter && !f.readyAnnounced) {
    f.readyAnnounced = true;
    events.push({ type: 'special-ready', who: f.id });
  }
}

const isAttackState = (s: FighterState): s is MoveAnim => s === 'punch' || s === 'kick' || s === 'special';

function startAttack(f: Fighter, moveKey: MoveKey, events: GameEvent[]): void {
  const m = MOVES[moveKey];
  f.move = moveKey; f.hasHit = false; f.spawned = false;
  f.state = m.anim; f.stateTime = 0; f.attackPhase = 'startup';
  if (!m.air) f.vx = 0;
  if (moveKey === 'special') { f.specialMeter = 0; f.readyAnnounced = false; }
  events.push({ type: 'attack', who: f.id, move: m.anim });
}

function spawnSpecial(f: Fighter, match: Match): void {
  const kind: ProjectileKind = f.id === 'superneus' ? 'sniff' : 'word';
  const s = SPECIALS[kind];
  match.world.add({ projectile: {
    id: ++match.nextProjectileId, owner: f.id, kind,
    x: f.x + f.facing * s.offset, y: s.y, vx: f.facing * s.vx, life: s.life,
    text: kind === 'word' ? WORD_TEXTS[Math.floor(Math.random() * WORD_TEXTS.length)] : '',
    hit: false,
  } });
}

// Is the fighter currently threatened (so holding back shows a block stance)?
function threatened(f: Fighter, opp: Fighter, match: Match): boolean {
  const d = Math.abs(opp.x - f.x);
  if (isAttackState(opp.state) && opp.attackPhase !== 'recovery' && d < 320) return true;
  return match.queries.projectiles.entities.some(({ projectile: p }) => p.owner !== f.id && Math.abs(p.x - f.x) < 280 && Math.sign(p.vx || 1) === Math.sign(f.x - p.x));
}

/** Advance one fighter by dt using a held input snapshot. */
export function updateFighter(f: Fighter, opp: Fighter, input: Readonly<Input>, dt: number, match: Match, events: GameEvent[]): void {
  const prev = f.prevInput;
  const pressed = (k: keyof Input): boolean => input[k] && !prev[k];
  f.prevInput = { ...input };
  f.stateTime += dt;
  if (f.hitFlash > 0) f.hitFlash = Math.max(0, f.hitFlash - dt);

  const air = isAirborne(f);
  const toward = (Math.sign(opp.x - f.x) || f.facing) as 1 | -1;
  const backKey: keyof Input = toward > 0 ? 'left' : 'right';
  const fwdKey: keyof Input = toward > 0 ? 'right' : 'left';
  f.holdBack = (!!input[backKey] && !input[fwdKey]) || input.block;

  // --- state logic ---
  if (f.state === 'ko') {
    f.attackPhase = null;
  } else if (f.state === 'victory') {
    f.vx = 0;
  } else if (f.state === 'hit') {
    f.stun -= dt;
    if (f.stun <= 0 && !air) { setState(f, 'idle'); }
  } else if (f.state === 'block') {
    f.stun -= dt;
    f.crouching = !!input.down;
    if (f.stun <= 0 && !input.block && !(f.holdBack && threatened(f, opp, match))) setState(f, 'idle');
  } else if (isAttackState(f.state)) {
    const m = MOVES[f.move!];
    f.attackPhase = phaseOf(m, f.stateTime);
    if (f.move === 'special' && !f.spawned && f.attackPhase !== 'startup') { f.spawned = true; spawnSpecial(f, match); }
    if (m.air) {
      // air attack ends at its total or on landing
      if (!air && f.stateTime > 0.02) { f.attackPhase = null; f.move = null; setState(f, 'idle'); }
      else if (f.stateTime >= moveTotal(m)) { f.attackPhase = null; f.move = null; setState(f, 'jump'); }
    } else if (f.stateTime >= moveTotal(m)) {
      f.attackPhase = null; f.move = null; setState(f, f.crouching ? 'crouch' : 'idle');
    }
  }

  if (f.state === 'jump' || (air && !isAttackState(f.state) && f.state !== 'hit' && f.state !== 'ko')) {
    if (f.state !== 'jump') setState(f, 'jump');
    if (!f.airAttackUsed && (pressed('kick') || pressed('punch'))) {
      f.airAttackUsed = true;
      startAttack(f, pressed('kick') ? 'jumpKick' : 'jumpPunch', events);
    } else if (!air && f.stateTime > 0.02) {
      setState(f, 'idle');
    }
  }

  // grounded neutral states: idle / walk / crouch / block-entry
  if (!air && (f.state === 'idle' || f.state === 'walk' || f.state === 'crouch' || (f.state === 'block' && f.stun <= 0))) {
    f.facing = toward;
    f.crouching = !!input.down;
    const canSpecial = f.specialMeter >= COMBAT.maxMeter;
    if (pressed('special') && canSpecial) {
      startAttack(f, 'special', events);
    } else if (pressed('kick')) {
      startAttack(f, f.crouching ? 'crouchKick' : 'kick', events);
    } else if (pressed('punch')) {
      startAttack(f, f.crouching ? 'crouchPunch' : 'punch', events);
    } else if (input.up && !f.crouching) {
      const h = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      f.vy = PHYS.jumpVy; f.vx = h * PHYS.jumpVx; f.y = 0.02;
      f.airAttackUsed = false; f.crouching = false;
      setState(f, 'jump'); f.attackPhase = null;
      events.push({ type: 'jump', who: f.id });
    } else if (input.block || (f.holdBack && threatened(f, opp, match))) {
      setState(f, 'block'); f.vx = 0; f.walkDir = 0;
    } else if (f.crouching) {
      setState(f, 'crouch'); f.vx = 0; f.walkDir = 0;
    } else {
      const h = (input.right ? 1 : 0) - (input.left ? 1 : 0);
      if (h !== 0) {
        const fwd = h === f.facing;
        f.vx = h * (fwd ? PHYS.walkForward : PHYS.walkBack);
        f.walkDir = fwd ? 1 : -1;
        setState(f, 'walk');
      } else {
        f.vx = 0; f.walkDir = 0; setState(f, 'idle');
      }
    }
  }
  if (f.state !== 'walk') f.walkDir = 0;
  if (f.state === 'jump' || f.state === 'hit' || f.state === 'ko' || f.state === 'victory') {
    f.crouching = f.state === 'ko' ? false : f.crouching && !air;
  }

  // --- physics ---
  if (isAirborne(f)) {
    f.vy -= WORLD.gravity * dt;
    f.y += f.vy * dt;
    if (f.y <= 0) { f.y = 0; f.vy = 0; if (f.state === 'jump') f.vx = 0; }
  } else if (f.state === 'hit' || f.state === 'block' || f.state === 'ko' || isAttackState(f.state)) {
    // slide friction for knockback
    const dec = PHYS.groundFriction * dt;
    f.vx = Math.abs(f.vx) <= dec ? 0 : f.vx - Math.sign(f.vx) * dec;
  }
  f.x += f.vx * dt;
}

/** Apply a hit from attacker to target; handles block, damage, meter, KO. */
export function applyHit(match: Match, attacker: Fighter, target: Fighter, moveKey: MoveAnim, spec: HitSpec, x: number, y: number, events: GameEvent[]): void {
  const air = isAirborne(target);
  const canBlock = !air && target.holdBack && (target.state === 'idle' || target.state === 'walk' || target.state === 'crouch' || target.state === 'block');
  const dir = Math.sign(target.x - attacker.x) || attacker.facing;
  let damage = spec.damage;
  if (canBlock) {
    damage = Math.max(1, Math.round(spec.damage * COMBAT.chipFactor));
    setState(target, 'block'); target.stateTime = 0;
    target.stun = spec.blockstun; target.vx = dir * spec.knockback * 0.35; target.attackPhase = null; target.move = null;
    addMeter(attacker, (spec.meter || 10) * COMBAT.blockMeterFactor, events);
  } else {
    target.state = 'hit'; target.stateTime = 0; target.attackPhase = null; target.move = null;
    target.stun = spec.hitstun; target.vx = dir * spec.knockback;
    target.crouching = false;
    if (air) target.vy = Math.max(target.vy, 300);
    target.hitFlash = COMBAT.hitFlash;
    addMeter(attacker, spec.meter || 10, events);
  }
  target.health = Math.max(0, target.health - damage);
  addMeter(target, damage * COMBAT.takeMeterFactor, events);
  events.push({ type: 'hit', attacker: attacker.id, target: target.id, move: moveKey, damage, x, y, blocked: canBlock });

  if (target.health <= 0 && !match.over) {
    target.state = 'ko'; target.stateTime = 0; target.attackPhase = null; target.move = null;
    target.vx = dir * PHYS.koVx; target.vy = PHYS.koVy; target.y = Math.max(target.y, 0.02);
    target.hitFlash = COMBAT.hitFlash; target.crouching = false;
    match.over = true; match.winner = attacker.id;
    events.push({ type: 'ko', winner: attacker.id, loser: target.id });
  }
}
