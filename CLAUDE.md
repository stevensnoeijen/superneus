# Superneus vs Potterpim

Comic-book 2D fighting game. Superneus (player) vs Potterpim (CPU). PixiJS v8 + Vite,
plain JavaScript ES modules. `npm run build` produces ONE self-contained
`dist/index.html` (via `vite-plugin-singlefile`).

## Commands
- `npm run dev` — dev server (exposed on LAN with `--host`, so phones can test touch). Any
  code change triggers a full page reload, CSS hot-swaps; on WSL the watcher polls.
- `npm run build` — single-file build to `dist/index.html`
- `npm run preview` — serve the build
- `npm test` — unit tests (Vitest, `src/**/*.test.ts`); `npm run coverage` for a coverage report.
  Pure logic (`src/combat/`, `src/ecs/`, `src/cheats.ts`) must stay covered; add tests with changes there.

## Architecture
An ECS core plus four modules with strict ownership; their APIs are defined in `CONTRACTS.md`.
Change the contract first, then the modules on both sides.

| Folder | Owns | Must not |
|---|---|---|
| `src/engine/` | PixiJS stage, game loop, arena, character (DragonBones armatures) + projectile drawing, shake/flash | contain game rules |
| `src/ecs/` | miniplex `World`, entities, systems, fixed-step `updateMatch` | contain rule math (call `src/combat/`) |
| `src/combat/` | pure rules: fighter state machine, hitboxes, damage, AI | own state, touch DOM, PIXI or audio |
| `src/ui/` | React UI: `pages/` (StartPage `#/`, GamePage `#/fight`) and `components/` (Title, ControlsHelp, Hud, TouchControls, FxLayer, PauseOverlay, GameOverModal, Icons) + `styles.css` | draw on the canvas, hold game rules, build HTML in strings |
| `src/app/` | `App` (routes + page transition), hash router with View Transitions, `useIsTouch`, services context | hold game logic |
| `src/game/` | `GameController` (match flow, pause, cheat, events → sound/effects) and `InputController` (keyboard + touch) — plain TS, no React | re-render React per frame |
| `src/audio/` | Web Audio synthesized SFX/music | load files |
| `src/main.tsx` | boot: loading steps, create engine/audio/controllers, render `<App/>` | hold game logic |

## Rules
- **React UI:** all markup is JSX components in `src/ui/` (no HTML template strings, no
  `innerHTML`). The game loop must not trigger React renders per frame: per-frame values
  (health/meter bars, SNUIF charge, popups) go through imperative handles (`HudBridge` in
  `src/game/controller.ts`); React state only for rare changes (pause, result, route, touch).
  The PixiJS stage (`#game`) lives outside React; React renders into `#app` above it.
- **React API, Preact runtime:** write normal React code (`import … from 'react'`), but the
  build/dev/tests alias `react`/`react-dom` to `preact/compat` (`preactAliases` in
  `vite.config.js`) — ~10 KB instead of ~200 KB for react-dom, for mobile connections.
  Component tests use `@testing-library/preact`. Don't add libraries that need real React
  internals; check the bundle size (`npm run build` prints it) when adding dependencies.
- **Pages:** hash routes (`#/` start, `#/fight` game) so GitHub Pages / the single file need
  no server; page swaps animate with the View Transitions API (CSS fallback). The engine is
  created once while loading and only paused (`ticker.stop()`) on the start page.
- **ECS (miniplex):** all game state is entities + components in the miniplex `World`.
  Each component is its own file in `src/ecs/components/` (type + constructor), composed
  into `Entity` in `src/ecs/entity.ts`.
  New behaviour = a new component and/or a new system in `src/ecs/systems/`, added to the
  step order in `src/ecs/index.js`. Spawn/despawn via `world.add` / `world.remove`, never
  by mutating arrays. Systems iterate queries (`world.with(...)`), not hard-coded fighters.
- **No external assets.** No runtime image/audio/font requests, no CDN links. Bundled npm
  fonts (`@fontsource/*`) are fine because Vite inlines them into the build. Draw with PIXI
  Graphics/CSS/SVG; synthesize sound with Web Audio. The build must stay one file.
- **Character design source of truth:** `references/model-sheet.png`, transcribed into
  `src/engine/characters.ts` (`CHARACTER_SPECS`). The sheet is reference only: never
  bundle or load it, and never use real photos of people. Fighters are drawn in code:
  DragonBones armatures (`pixi-dragonbones-runtime`) whose part atlas
  (`engine/dragonbones/parts.ts`) and skeleton/animations (`engine/dragonbones/skeleton.ts`)
  are generated at runtime; no `.json`/`.png` DragonBones exports.
  - Superneus: bald, near clean-shaven, big nose, purple suit, magenta-rimmed gold V
    chest emblem with golden nose, magenta forearm bands + hip panels, gold belt, gold
    boot bands, long purple cape with high collar. Special: SNUIF (sniff vortex).
  - Potterpim: big black curly hair, short beard, round black glasses, olive-brown
    tweed check jacket, white shirt, red tie, dark brown trousers.
    Special: throws jargon words ("OBJECTIVERING!").
- **Title lettering:** follow `references/title-style.png`: Luckiest Guy (bundled via
  `@fontsource`, inlined, never loaded from a CDN), yellow→orange fill, navy outline, blue
  3D extrusion. Use the `--font-title` / `--title-*` variables and `.sn-logo` in
  `src/ui/styles.css` for titles, announcements and hit popups.
- Comic style everywhere: thick black outlines, flat pop-art colors, halftone, bold
  uppercase onomatopoeia. In-game text is Dutch-flavored where it's flavor text.
- World coordinates: 1000 units wide, y up, floor at 0. Combat works only in world
  units; only the engine converts to pixels.
- Performance: build static layers once (redraw on resize only), pool display objects,
  no per-frame allocations in hot loops, cap concurrent popups and audio voices.
- **Loading:** anything the game needs before play (fonts, generated textures, skeletons)
  is prepared as a step of the loading screen in `src/main.tsx` (`loader.step(...)`), never
  lazily on the first frame. The loader markup/styles are inline in `index.html`.
- Every audio call must be a safe no-op before `unlock()` (user gesture).
- Mobile: touch controls must support multi-touch; layout works portrait + landscape.
- Keep code in plain JS (no TypeScript, no frameworks). Match the existing style.

## Git workflow
- **Always work on a new branch** when implementing changes (branch off `main`, e.g.
  `feat/<topic>`, `fix/<topic>`); never commit implementation work directly to `main`.
- When all implementation is done (build + tests green), push the branch and **open a pull
  request** to `main` (`gh pr create`) with a summary of the changes.
- Work in small, atomic commits: one logical change per commit, each leaving the
  build working. Don't bundle unrelated changes.
- `main` is protected: direct commits/pushes to it are blocked on GitHub. Every change
  reaches `main` through a pull request; merge only with the user's explicit approval,
  every time (an earlier approval doesn't carry over).

## Verifying changes
Run `npm run build` (must succeed) and `npm run dev`, then play a full match:
start modal → fight → KO → restart. Check keyboard (WASD/arrows + J/K/L) and touch
(browser devtools device mode).

## Deployment
**Updates / offline:** the build writes a content-hash version into the game
(`__APP_VERSION__`) and into `dist/version.json` (see `sourceVersion()` in `vite.config.js`).
`public/sw.js` (service worker, production only) serves the page *network-first*: a reload
always gets the newest deploy when online, the cached copy when offline / after 4 s. While the
page is open, `src/app/useUpdateCheck.ts` polls `version.json` (every minute, on tab focus, on
reconnect); a newer version shows the "NIEUWE VERSIE!" banner — on the start page and the K.O.
screen only, **never during play**. `dist/` = `index.html` + `sw.js` + `version.json`.
`.github/workflows/pr.yml` runs typecheck, lint, unit tests and a build on every pull
request; keep it green before asking to merge.
`.github/workflows/deploy.yml` builds and publishes `dist/` to GitHub Pages on every
push to `main` (Settings → Pages → Source: "GitHub Actions"). Keep `base: './'` in
`vite.config.js` so the build works under the `/<repo>/` sub-path.

## Hidden cheat (developer note — never surface in the game UI)
`src/cheats.ts`: ↑ ↑ ↓ ↓ ← → ← → B A START (B = KICK, A = PUNCH, START = pause button /
P / Esc / Enter) during a fight gives Superneus a knife (`weapon` component, punches ×2),
with a "shiiing" sound and SCHHING! popup. Lasts until page reload. Keep it out of the
controls help, legends and any player-facing text.
