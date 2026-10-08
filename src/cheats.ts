// Hidden cheat input. Not mentioned anywhere in the game UI, on purpose.
// ↑ ↑ ↓ ↓ ← → ← → B A START, where B = KICK, A = PUNCH, START = the pause button.
// Fed from button-down events (keyboard and touch), so it works on phones too and
// never misses a quick tap on a slow frame.

import type { Button } from './types';

type Token = 'up' | 'down' | 'left' | 'right' | 'b' | 'a' | 'start';

const CODE: readonly Token[] = ['up', 'up', 'down', 'down', 'left', 'right', 'left', 'right', 'b', 'a', 'start'];
// pause between presses longer than this resets the code; generous because on a phone the
// thumb travels from the A (PUNCH) button at the bottom to the pause button at the top
const MAX_GAP_MS = 2500;

const TOKENS: Partial<Record<Button, Token>> = {
  up: 'up', down: 'down', left: 'left', right: 'right', kick: 'b', punch: 'a',
};

export function createCheatCode(onUnlock: () => void) {
  let pos = 0;
  let last = 0;

  function push(t: Token, now: number): boolean {
    if (now - last > MAX_GAP_MS) pos = 0;
    last = now;
    if (t === CODE[pos]) pos++;
    else pos = t === CODE[0] ? 1 : 0;
    if (pos === CODE.length) { pos = 0; onUnlock(); return true; }
    return false;
  }

  return {
    /** Call when a game button goes down. Other buttons (block, special) break the code. */
    press(b: Button, now = performance.now()): void {
      const tok = TOKENS[b];
      if (tok) push(tok, now);
      else pos = 0;
    },
    /** Call when START (pause) is pressed. Returns true if it completed the code. */
    start(now = performance.now()): boolean {
      return push('start', now);
    },
  };
}
