// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import type { Renderer } from 'pixi.js';
import { buildSkeletonJson, ATTACK_MARKS, FPS } from './dragonbones/skeleton';
import { buildFighterAtlas } from './dragonbones/parts';
import { createArena } from './arena';
import { CHARACTER_SPECS, hex } from './characters';

type Json = Record<string, unknown>;
const slotsOf = (id: 'superneus' | 'potterpim', parts: Map<string, { pivotX: number; pivotY: number }>): string[] =>
  ((buildSkeletonJson(id, parts).armature as Json[])[0].slot as { name: string }[]).map((s) => s.name);
const stubRenderer = { generateTexture: () => ({ label: 'stub' }) } as unknown as Renderer;

describe('character specs', () => {
  it('formats colours as hex', () => {
    expect(hex(0x7d2fa6)).toBe('#7d2fa6');
    expect(hex(0x00ff00)).toBe('#00ff00');
  });

  it('both fighters have proportions that add up to ~200 units', () => {
    for (const s of Object.values(CHARACTER_SPECS)) expect(s.proportions.height).toBe(200);
  });
});

describe('fighter atlas (parts drawn with Pixi Graphics)', () => {
  const atlas = buildFighterAtlas(stubRenderer);

  it('packs every part of both fighters into one atlas', () => {
    const names = atlas.json.SubTexture.map((t) => t.name);
    expect(names).toContain('superneus/torso');
    expect(names).toContain('superneus/knife');
    expect(names).toContain('potterpim/head');
    expect(new Set(names).size).toBe(names.length);
  });

  it('keeps every part inside the atlas without overlaps', () => {
    const subs = atlas.json.SubTexture;
    for (const t of subs) {
      expect(t.x + t.width).toBeLessThanOrEqual(atlas.json.width);
      expect(t.y + t.height).toBeLessThanOrEqual(atlas.json.height);
    }
    for (let i = 0; i < subs.length; i++) for (let j = i + 1; j < subs.length; j++) {
      const a = subs[i], b = subs[j];
      const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
      expect(overlap, `${a.name} / ${b.name}`).toBe(false);
    }
  });

  it('records a pivot for every part', () => {
    for (const t of atlas.json.SubTexture) expect(atlas.parts.get(t.name)).toBeDefined();
  });
});

describe('DragonBones skeleton JSON', () => {
  const atlas = buildFighterAtlas(stubRenderer);

  for (const id of ['superneus', 'potterpim'] as const) {
    const ske = buildSkeletonJson(id, atlas.parts);
    const arm = (ske.armature as Json[])[0];
    const anims = arm.animation as { name: string; duration: number; bone: Json[] }[];
    const slots = (arm.slot as { name: string }[]).map((s) => s.name);

    it(`${id}: has every animation the renderer plays`, () => {
      const names = anims.map((a) => a.name);
      for (const n of ['idle', 'walk', 'jump', 'crouch', 'punch', 'kick', 'crouchPunch', 'crouchKick', 'jumpPunch', 'jumpKick', 'special', 'block', 'hit', 'ko', 'victory']) {
        expect(names, n).toContain(n);
      }
    });

    it(`${id}: attack animations end at the shared attack timeline`, () => {
      const punch = anims.find((a) => a.name === 'punch')!;
      expect(punch.duration).toBe(Math.round(ATTACK_MARKS.end * FPS));
    });

    it(`${id}: every slot has a display in the skin`, () => {
      const skin = (arm.skin as { slot: { name: string; display: unknown[] }[] }[])[0];
      expect(skin.slot.map((s) => s.name)).toEqual(slots);
      for (const s of skin.slot) expect(s.display.length).toBeGreaterThan(0);
    });
  }

  it('only Superneus has a cape, nose and knife', () => {
    expect(slotsOf('superneus', atlas.parts)).toEqual(expect.arrayContaining(['cape', 'nose', 'knife']));
    expect(slotsOf('potterpim', atlas.parts)).not.toContain('cape');
    expect(slotsOf('potterpim', atlas.parts)).not.toContain('knife');
  });
});

describe('arena', () => {
  it('builds all layers and handles resize + camera updates', () => {
    const arena = createArena();
    expect(arena.worldBack.children.length).toBe(4);
    arena.resize(1280, 720, 576);
    arena.resize(390, 844, 530);
    arena.update(1.5, 500, 0.8);
    for (const layer of arena.worldBack.children) expect(layer.scale.x).toBeCloseTo(0.8);
    // nearer layers move more than far ones when the camera pans
    arena.update(1.5, 700, 0.8);
    const [far, , , near] = arena.worldBack.children;
    arena.update(1.5, 300, 0.8);
    expect(Math.abs(near.position.x)).not.toBe(Math.abs(far.position.x));
  });
});
