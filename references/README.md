# Character reference

`model-sheet.png` is the **canonical design reference** for both fighters:
Superneus (left half) and Potterpim (right half), each with front, 3/4, side and
back views plus a colour palette.

It is a reference only. It is not bundled into the game and must not be loaded at
runtime. The fighters are DragonBones armatures generated in code (`src/engine/dragonbones/`)
from the colours, proportions and traits in `src/engine/characters.ts`
(`CHARACTER_SPECS`), which are transcribed from this sheet.

When the design changes: replace the sheet, update `CHARACTER_SPECS` to match,
then adjust the renderer for any shape changes (emblem, belt, cape, hair, ...).

## Title / lettering style

`title-style.png` (a comic cover) is the reference for the **title lettering**: a
small "DE AVONTUREN VAN" line above a big, slightly slanted "SUPER NEUS" in a heavy,
rounded comic face with a yellow→orange gradient fill, thin navy outline and a blue
3D extrusion. Only the lettering is the reference here, not the cover's scene.

In code this is the `Luckiest Guy` font (Apache-2.0, bundled via
`@fontsource/luckiest-guy` and inlined into the build, no CDN) plus the
`--font-title` / `--title-*` CSS variables and `.sn-logo` class in
`src/ui/styles.css`. Use it for titles, announcements (ROUND 1, FIGHT!, K.O.!) and
hit popups; body text stays in the regular UI font.

## Fight background (arena)

The arena in `src/engine/arena.ts` is a **Dutch back garden on an overcast evening**,
based on a scene photo the owner shared. The photo itself is not stored here because it
shows real people (see the rule in `CLAUDE.md`), so this is the description to work from:

- **Sky:** overcast, blue-grey getting paler towards the horizon, soft grey-white cloud banks.
- **Behind the hedge:** neighbour houses with dark grey tiled roofs, a flat-roofed dormer
  with a window band, brick chimneys.
- **Hedge:** a tall, clipped, dark-green hedge running the full width, with a few trees above it.
- **Middle:** a low brick garden wall on the left, then ONE red-brick garage with a single dark
  green-grey up-and-over door, a white flat-roof fascia and an orange hose reel; next to it a
  **tall wooden fence, only partly painted brown** (painted planks on the left, a ragged paint
  edge with drips, bare wood on the right, a paint pot with a brush).
- **Ground:** dry, patchy lawn (straw-coloured patches, greener patches), a gravel strip along
  the back. It's **messy with building equipment piled against the wall and fence** (background,
  never under the fighters' feet): a brick pallet, a wheelbarrow with sand,
  cement bags, loose planks with a shovel, a bucket and a traffic cone.
- **Yellow puddle** in the background at the foot of the garden wall (left), with a grey **pipe sticking out of the ground**,
  dripping into it.
- **Props:** rattan garden furniture: a lounge chair with a grey cushion, and a rattan table
  with a glass top holding a beer bottle and a can.
