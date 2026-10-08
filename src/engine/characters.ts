// Character design specs, transcribed from the canonical model sheet
// references/model-sheet.png. The in-game renderer (fighterRenderer.js) takes all
// colours and proportions from here. When the sheet changes, update this first.

export const OUTLINE = 0x111111;
// Thin, even ink like references/model-sheet.png (~1% of figure height).
export const OUTLINE_WIDTH = 2.2; // world units (fighter is ~200 units tall)
/** Multiplier for interior detail strokes (creases, trims, facial lines). */
export const DETAIL_LINE = 0.5;

export const CHARACTER_SPECS = {
  superneus: {
    name: 'SUPERNEUS',
    role: 'Player hero',
    palette: {
      skin: 0xf1c7a3,
      skinShade: 0xc98f6b,
      stubble: 0x8a6a58,     // barely-there shadow, he's near clean-shaven
      suit: 0x7b30a8,
      suitShade: 0x5a1d80,
      suitLine: 0x3b0f57,    // muscle lines
      suitLight: 0x9a4cc4,
      stripe: 0xec3c96,      // magenta trim: emblem rim, forearm bands, hip panels
      gold: 0xf5b81c,
      goldShade: 0xc98a00,
      belt: 0xf5b81c,        // gold belt
      beltShade: 0xc98a00,
      cape: 0x7b30a8,
      capeInner: 0x4a136b,
      boots: 0x7b30a8,
      bootShade: 0x5a1d80,
      bootTrim: 0xf5b81c,    // gold band at the top of the boots
      eye: 0x1a1a1a,
    },
    proportions: {
      // Heroic V-taper: broad shoulders, narrow waist, thick limbs, small (~7-head) head.
      // Torso/head are drawn in 3/4 view; *X = attach points (forward +), shoulderDrop
      // = shoulder joint below the torso top.
      height: 200, headRadius: 19, headScale: 0.8, torso: 60, shoulderHalf: 31, hipHalf: 15,
      shoulderFX: 21, shoulderBX: -21, shoulderDrop: 11, hipFX: 6, hipBX: -5, neckX: 1,
      upperArm: 37, foreArm: 35, thigh: 53, shin: 52, limbWidth: 19,
    },
    traits: [
      'Bald head, light skin, near clean-shaven, large prominent nose, determined look',
      'Skin-tight PURPLE suit',
      'Chest: inverted GOLD triangle/V emblem with MAGENTA rim and a golden nose in the centre',
      'Magenta bands on the forearms and magenta hip panels',
      'GOLD belt with square gold buckle',
      'Purple boots with a GOLD top band',
      'Long purple cape (to the calves) with high collar, darker inside',
      'Special "SNUIF!": huge inhale, nose swells, wind vortex pulls in',
    ],
  },
  potterpim: {
    name: 'POTTERPIM',
    role: 'CPU opponent',
    palette: {
      skin: 0xeab890,
      skinShade: 0xc8946a,
      hair: 0x1f1a17,         // black, big and curly
      hairShade: 0x0f0c0a,
      hairLight: 0x4a413a,
      glasses: 0x0d0d0d,
      lens: 0xe4f2ff,
      jacket: 0x7a6a35,       // olive-brown tweed
      jacketShade: 0x5a4d24,
      jacketLight: 0x8f7d45,
      plaid: 0x3e3418,
      plaidLight: 0xb19a5a,
      shirt: 0xffffff,
      tie: 0xc8161d,
      trousers: 0x4a3020,
      trousersShade: 0x35221a,
      shoes: 0x5a3a22,
      shoesShade: 0x3a2414,
      shirtShade: 0xd9dde3,
      tieShade: 0x8e0f14,
      eye: 0x1a1a1a,
    },
    proportions: {
      // Slim, lanky academic: narrow sloping shoulders, thin limbs, jacket to below the hips.
      height: 200, headRadius: 18, headScale: 0.84, torso: 60, shoulderHalf: 21, hipHalf: 13,
      shoulderFX: 13, shoulderBX: -13, shoulderDrop: 8, hipFX: 5, hipBX: -5, neckX: 3,
      upperArm: 38, foreArm: 36, thigh: 52, shin: 52, limbWidth: 12,
    },
    traits: [
      'Big black curly hair, short full beard',
      'Round black-rimmed glasses, smug professorial look',
      'Olive-brown TWEED check jacket (windowpane plaid)',
      'White shirt, RED tie, dark brown trousers, brown shoes',
      'Special: throws a jargon word ("OBJECTIVERING!") in a speech burst',
    ],
  },
} as const;

export type CharacterSpecs = typeof CHARACTER_SPECS;
export type CharacterProportions = CharacterSpecs[keyof CharacterSpecs]['proportions'];

export const hex = (n: number): string => '#' + n.toString(16).padStart(6, '0');
