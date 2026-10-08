// Pure game rules (no state ownership). The ECS in src/ecs/ owns entities and
// runs these rules from its systems.
export { WORLD, MOVES, SPECIALS, WORD_TEXTS, COMBAT } from './constants';
export { createFighter, updateFighter, applyHit, EMPTY_INPUT } from './fighter';
export { hurtbox, attackHitbox, overlaps, circleHitsBox, isAirborne } from './hitboxes';
export { createAI, updateAI } from './ai';
