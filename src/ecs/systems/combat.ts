import { WORLD, MOVES, SPECIALS } from '../../combat/constants';
import { applyHit } from '../../combat/fighter';
import { hurtbox, attackHitbox, overlaps, circleHitsBox } from '../../combat/hitboxes';
import type { FighterEntity, Match } from '../world';
import type { FighterId, GameEvent } from '../../types';

/** Resolves melee hitboxes vs hurtboxes for every fighter that is mid-swing. */
export function meleeSystem(ctx: Match, events: GameEvent[]): void {
  for (const { fighter: att, opponent, weapon } of ctx.queries.fighters) {
    if (ctx.over) return;
    const tgt = opponent.fighter!;
    // recomputed here: an attacker hit earlier this step has lost its swing
    const hb = attackHitbox(att);
    if (!hb || tgt.state === 'ko') continue;
    const hu = hurtbox(tgt);
    if (!overlaps(hb, hu)) continue;
    att.hasHit = true;
    const m = MOVES[att.move!];
    const x = att.facing > 0 ? Math.max(hb.x0, hu.x0) : Math.min(hb.x1, hu.x1);
    const y = (Math.max(hb.y0, hu.y0) + Math.min(hb.y1, hu.y1)) / 2;
    // a held weapon multiplies the damage of the moves it's used in (knife: punches x2)
    const spec = weapon?.moves.includes(m.anim) ? { ...m, damage: m.damage * weapon.damageMultiplier } : m;
    applyHit(ctx, att, tgt, m.anim, spec, x, y, events);
  }
}

/** Moves specials (sniff vortex, jargon words), applies pull + hits, despawns them. */
export function projectileSystem(ctx: Match, dt: number, events: GameEvent[]): void {
  const owners = {} as Record<FighterId, FighterEntity>;
  for (const e of ctx.queries.fighters) owners[e.fighter.id] = e;

  // miniplex queries iterate in reverse, so removing during the loop is safe
  for (const e of ctx.queries.projectiles) {
    const p = e.projectile;
    const s = SPECIALS[p.kind];
    const ownerEnt = owners[p.owner];
    const owner = ownerEnt.fighter, tgt = ownerEnt.opponent.fighter!;
    p.life -= dt;
    if (p.kind === 'sniff') {
      // the vortex drifts forward from the nose and pulls the opponent in
      p.x = owner.x + owner.facing * s.offset + p.vx * (s.life - p.life);
      const dx = p.x - tgt.x;
      if (!p.hit && Math.abs(dx) < (s.range ?? 0) && tgt.state !== 'ko' && tgt.state !== 'block') {
        tgt.x += Math.sign(dx) * Math.min(Math.abs(dx), (s.pull ?? 0) * dt);
      }
    } else {
      p.x += p.vx * dt;
    }
    if (!p.hit && tgt.state !== 'ko' && !ctx.over && circleHitsBox(p.x, p.y, s.radius, hurtbox(tgt))) {
      p.hit = true;
      applyHit(ctx, owner, tgt, 'special', { ...s, meter: 0 }, p.x, p.y, events);
      p.life = Math.min(p.life, 0.08);
    }
    if (p.life <= 0 || p.x < -100 || p.x > WORLD.width + 100) ctx.world.remove(e);
  }
}
