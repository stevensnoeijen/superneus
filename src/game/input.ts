import type { Button, Input } from '../types';

/** Keyboard layout: WASD / arrows to move, J K L I (or Z X C V) for the actions. */
export const KEYMAP: Partial<Record<string, Button>> = {
  KeyA: 'left', ArrowLeft: 'left',
  KeyD: 'right', ArrowRight: 'right',
  KeyW: 'up', ArrowUp: 'up',
  KeyS: 'down', ArrowDown: 'down',
  KeyJ: 'punch', KeyZ: 'punch',
  KeyK: 'kick', KeyX: 'kick',
  KeyL: 'special', KeyC: 'special',
  KeyI: 'block', KeyV: 'block',
};

export const emptyInput = (): Input =>
  ({ left: false, right: false, up: false, down: false, punch: false, kick: false, special: false, block: false });

/**
 * Merges keyboard + touch into the held-button snapshot the game reads every frame,
 * and fires button-down events the moment a button goes down (frame-rate independent,
 * used by the cheat code). Plain class: the game loop never touches React state.
 */
export class InputController {
  private keys = new Set<string>();
  private touch = emptyInput();
  private listeners = new Set<(b: Button) => void>();

  /** Subscribe to button-down events. Returns an unsubscribe function. */
  onButtonDown(fn: (b: Button) => void): () => void {
    this.listeners.add(fn);
    return () => { this.listeners.delete(fn); };
  }

  /** Returns true when the key is a game key (caller should preventDefault). */
  keyDown(code: string, repeat = false): boolean {
    const b = KEYMAP[code];
    if (!b) return false;
    if (!repeat && !this.held(b)) this.emit(b);
    this.keys.add(code);
    return true;
  }

  keyUp(code: string): boolean {
    if (!KEYMAP[code]) return false;
    this.keys.delete(code);
    return true;
  }

  /** Touch controls report presses/releases per button. */
  setTouch(b: Button, down: boolean): void {
    if (down && !this.touch[b] && !this.held(b)) this.emit(b);
    this.touch[b] = down;
  }

  /** Releases everything (window blur, tab hidden, game over, touch layout switched off). */
  clear(): void {
    this.keys.clear();
    this.touch = emptyInput();
  }

  getInput(): Input {
    const out: Input = { ...this.touch };
    for (const code of this.keys) {
      const b = KEYMAP[code];
      if (b) out[b] = true;
    }
    return out;
  }

  private held(b: Button): boolean {
    return this.getInput()[b];
  }

  private emit(b: Button): void {
    for (const fn of this.listeners) fn(b);
  }
}
