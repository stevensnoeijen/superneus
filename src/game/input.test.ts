import { describe, expect, it, vi } from 'vitest';
import { InputController } from './input';

describe('InputController', () => {
  it('merges keyboard and touch into one snapshot', () => {
    const input = new InputController();
    input.keyDown('KeyA');
    input.setTouch('punch', true);
    expect(input.getInput()).toMatchObject({ left: true, punch: true, right: false });
    input.keyUp('KeyA');
    input.setTouch('punch', false);
    expect(input.getInput()).toMatchObject({ left: false, punch: false });
  });

  it('ignores non-game keys', () => {
    const input = new InputController();
    expect(input.keyDown('KeyQ')).toBe(false);
    expect(input.keyUp('KeyQ')).toBe(false);
  });

  it('fires button-down once per press, not on repeat or while already held', () => {
    const input = new InputController();
    const fn = vi.fn();
    const off = input.onButtonDown(fn);
    input.keyDown('KeyJ');
    input.keyDown('KeyJ', true);   // key repeat
    input.keyDown('KeyZ');         // second punch key while held
    input.setTouch('punch', true); // touch while key held
    expect(fn).toHaveBeenCalledTimes(1);
    off();
    input.clear();
    input.keyDown('KeyJ');
    expect(fn).toHaveBeenCalledTimes(1);
  });

  it('clear releases everything', () => {
    const input = new InputController();
    input.keyDown('ArrowUp');
    input.setTouch('kick', true);
    input.clear();
    expect(Object.values(input.getInput()).some(Boolean)).toBe(false);
  });
});
