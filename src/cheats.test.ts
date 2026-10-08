import { describe, expect, it, vi } from 'vitest';
import { createCheatCode } from './cheats';
import type { Button } from './types';

const SEQ: Button[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'kick', 'punch'];

function enter(cheat: ReturnType<typeof createCheatCode>, buttons: Button[], start = 0, step = 100): number {
  let t = start;
  for (const b of buttons) { cheat.press(b, t); t += step; }
  return t;
}

describe('cheat code', () => {
  it('unlocks on ↑↑↓↓←→←→ B A START', () => {
    const onUnlock = vi.fn();
    const cheat = createCheatCode(onUnlock);
    const t = enter(cheat, SEQ);
    expect(cheat.start(t)).toBe(true);
    expect(onUnlock).toHaveBeenCalledOnce();
  });

  it('START alone does nothing', () => {
    const onUnlock = vi.fn();
    expect(createCheatCode(onUnlock).start(0)).toBe(false);
    expect(onUnlock).not.toHaveBeenCalled();
  });

  it('a wrong button resets the code', () => {
    const onUnlock = vi.fn();
    const cheat = createCheatCode(onUnlock);
    const t = enter(cheat, [...SEQ.slice(0, 5), 'block', ...SEQ.slice(5)]);
    expect(cheat.start(t)).toBe(false);
  });

  it('a long gap between presses resets the code', () => {
    const onUnlock = vi.fn();
    const cheat = createCheatCode(onUnlock);
    let t = enter(cheat, SEQ.slice(0, 4));
    t = enter(cheat, SEQ.slice(4), t + 5000);
    expect(cheat.start(t)).toBe(false);
  });

  it('restarts cleanly when the first button is repeated', () => {
    const onUnlock = vi.fn();
    const cheat = createCheatCode(onUnlock);
    const t = enter(cheat, ['up', 'up', 'up', ...SEQ.slice(1)]);
    expect(cheat.start(t)).toBe(true);
  });
});
