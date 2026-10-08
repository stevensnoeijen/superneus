# Module contracts

All modules are plain ES modules (JavaScript, no TypeScript), bundled by Vite into
one self-contained `dist/index.html`. No external assets: no image, font or audio
files, no CDN links. Everything is drawn (PixiJS Graphics / CSS / SVG) or synthesized
(Web Audio).

`src/main.js` (the lead's integration file) wires the four modules together:

```
ui.input  ──► combat.update(dt, input) ──► events ──► audio + ui.popup + engine.shake
                     │
                     └──► match state ──► engine.render(match)
```

## World coordinates (shared by combat + engine)

- Arena is `WORLD.width = 1000` units wide. `x` runs 0..1000 left→right.
- `y` is height above the floor in units, **up is positive**, floor is `y = 0`.
- Fighters stand ~`WORLD.fighterHeight = 200` units tall (crouching ~130).
- Fighters are clamped to `x ∈ [60, 940]`.
- Exported from `src/combat/constants.js` as `WORLD`.

## Fighter state (owned by combat, read by engine)

```js
{
  id: 'superneus' | 'potterpim',
  name: 'SUPERNEUS' | 'POTTERPIM',
  x, y,                 // feet position, world units
  vx, vy,
  facing: 1 | -1,       // 1 = facing right
  state: 'idle'|'walk'|'jump'|'crouch'|'punch'|'kick'|'special'|'block'|'hit'|'ko'|'victory',
  stateTime,            // seconds spent in current state
  attackPhase: null | 'startup' | 'active' | 'recovery',
  health, maxHealth,    // maxHealth = 100
  specialMeter,         // 0..100, special usable at 100
  hitFlash,             // seconds remaining of white flash after being hit (0 = none)
  walkDir,              // -1, 0, 1 relative to facing (for walk-cycle direction)
}
```

## Projectiles (owned by combat, drawn by engine)

```js
{ id, owner: 'superneus'|'potterpim', kind: 'sniff'|'word', x, y, vx, life, text }
```
- Superneus special `sniff`: a short-range SNIFF vortex (wind cone) in front of him.
- Potterpim special `word`: throws a flying jargon word, `text` is one of
  `'OBJECTIVERING!'`, `'ESTHETIEK!'`, `'DISCOURS!'`, `'SEKSISME?'`.

## ECS — `src/ecs/` (miniplex)

Game state lives in a [miniplex](https://github.com/hmans/miniplex) `World`.
Entities: two fighters `{ fighter, input, opponent, playerControlled | ai }` and
projectiles `{ projectile }`. Systems run each fixed 1/120s step in this order:
`playerInput → ai → fighter → bodyCollision → melee → projectile → matchOutcome`.
Each component is a separate file in `src/ecs/components/`; `src/ecs/entity.ts` composes
them into `Entity`. `src/combat/` holds the pure rule functions the systems call; it owns no state.

## Match API — `src/ecs/index.js`

```js
export function createMatch(): Match
// Match = { world, queries, p1: Fighter (superneus), p2: Fighter (potterpim),
//           projectiles: Projectile[] (view over the projectile query),
//           active: false,  // set true at FIGHT!; until then neither fighter (player or AI) acts
//           over: false, winner: null | 'superneus' | 'potterpim', time }
export function updateMatch(match, dt, input): GameEvent[]   // dt in seconds (clamp ≤ 1/20 internally)
```
`input` = held-button snapshot for the player:
`{ left, right, up, down, punch, kick, special, block }` (booleans). Edge detection
(press vs hold) is combat's job. Potterpim is driven by the AI inside combat.

`GameEvent` objects:
```js
{ type: 'attack',  who, move: 'punch'|'kick'|'special' }          // swing started
{ type: 'jump',    who }
{ type: 'hit',     attacker, target, move, damage, x, y, blocked } // x,y world coords of impact
{ type: 'ko',      winner, loser }
{ type: 'special-ready', who }
```

## Engine API — `src/engine/index.js`

```js
export async function createEngine(parentEl): Engine
// Engine = {
//   app,                                  // PIXI.Application
//   onTick(fn(dtSeconds)),                // game loop hook
//   render(match),                        // draw arena-relative fighters + projectiles
//   worldToScreen(x, y) -> {x, y},        // CSS pixels relative to the canvas/page
//   shake(intensity),                     // screen shake on big hits
//   flash(),                              // brief white impact frame
// }
```
Fighters are DragonBones armatures built entirely in code (atlas + skeleton JSON
generated at startup, see `src/engine/dragonbones/`). Animations map 1:1 to
`fighter.state` (attacks to `fighter.move`) and are scrubbed from `stateTime` so the
active phase lines up with the hitbox.

## UI — `src/ui/` (React) + `src/game/`

The UI is React (`src/ui/pages`, `src/ui/components`), rendered into `#app` by
`src/app/App.tsx`. It talks to the game through two plain-TS controllers (`src/game/`):

```ts
class InputController {            // keyboard + touch merged
  keyDown(code, repeat?), keyUp(code), setTouch(button, down), clear()
  getInput(): Input                // { left, right, up, down, punch, kick, special, block }
  onButtonDown(fn): unsubscribe    // fired the moment a button goes down (cheat code)
}

class GameController {             // match flow; was main.ts
  enter(), leave()                 // game page mounted / left (starts/stops the ticker)
  startMatch(), pressStart(), setPaused(bool)
  attachHud(bridge: HudBridge | null)   // per-frame updates, no React re-render:
  //   HudBridge = { setHealth(p1, p2), setSpecial(p1, p2), popup(text, x, y, color?), announce(text) }
  subscribe(fn), getState(): { paused, result: { winner, playerWon } | null }  // for useSyncExternalStore
}
```

## Audio API — `src/audio/index.js`

```js
export function createAudio(): Audio
// Audio = { unlock(), punch(), kick(), whoosh(), hit(heavy?), block(), jump(),
//           sniff(), wordThrow(), ko(), victory(), defeat(), fightStart(),
//           setMuted(bool), muted }
```
`unlock()` is called from the Start button click (user gesture). Every method must
be a safe no-op before unlock or if Web Audio is unavailable.
