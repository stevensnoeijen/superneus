import { describe, expect, it, vi } from 'vitest';
import { GameController, type HudBridge } from './controller';
import { InputController } from './input';
import type { Engine } from '../engine/index';
import type { Audio } from '../audio/index';

const noop = (): void => {};

function setup() {
  let tickFn: (dt: number) => void = noop;
  const engine = {
    app: { ticker: { start: vi.fn(), stop: vi.fn(), deltaMS: 16 } },
    onTick: (fn: (dt: number) => void) => { tickFn = fn; },
    render: vi.fn(),
    worldToScreen: (x: number, y: number) => ({ x, y }),
    shake: vi.fn(),
    flash: vi.fn(),
    preloadFighters: vi.fn(),
  } as unknown as Engine;
  // every audio method is a spy; music has start/stop
  const audio = new Proxy({ music: { start: vi.fn(), stop: vi.fn(), playing: false }, muted: false } as Record<string, unknown>, {
    get: (t, p: string) => (p in t ? t[p] : (t[p] = vi.fn())),
  }) as unknown as Audio;
  const hud: HudBridge = { setHealth: vi.fn(), setSpecial: vi.fn(), popup: vi.fn(), announce: vi.fn() };
  const input = new InputController();
  const game = new GameController(engine, audio, input);
  game.attachHud(hud);
  const run = (seconds: number) => { for (let i = 0; i < seconds * 60; i++) tickFn(1 / 60); };
  return { game, engine, audio, hud, input, run };
}

describe('GameController', () => {
  it('enter starts the ticker, a match and announces ROUND 1 then FIGHT!', () => {
    const { game, engine, hud, run } = setup();
    game.enter();
    expect(engine.app.ticker.start).toHaveBeenCalled();
    expect(game.phase).toBe('intro');
    expect(hud.announce).toHaveBeenCalledWith('ROUND 1');
    run(2);
    expect(game.phase).toBe('fight');
    expect(game.match.active).toBe(true);
    expect(hud.announce).toHaveBeenCalledWith('FIGHT!');
    expect(engine.render).toHaveBeenCalled();
  });

  it('does nothing on the menu', () => {
    const { engine, run } = setup();
    run(1);
    expect(engine.render).not.toHaveBeenCalled();
  });

  it('START toggles pause, which freezes the fight', () => {
    const { game, engine, run } = setup();
    game.enter();
    run(2);
    const listener = vi.fn();
    game.subscribe(listener);
    game.pressStart();
    expect(game.getState().paused).toBe(true);
    expect(listener).toHaveBeenCalled();
    const renders = vi.mocked(engine.render).mock.calls.length;
    run(1);
    expect(vi.mocked(engine.render).mock.calls.length).toBe(renders);
    game.pressStart();
    expect(game.getState().paused).toBe(false);
  });

  it('an idle player loses: K.O. then the result screen', () => {
    const { game, audio, hud, run } = setup();
    game.enter();
    run(60);
    expect(hud.announce).toHaveBeenCalledWith('K.O.!');
    expect(game.getState().result).toEqual({ winner: 'potterpim', playerWon: false });
    expect(audio.defeat).toHaveBeenCalled();
  });

  it('the cheat code arms Superneus with a knife (and START does not pause)', () => {
    const { game, input, hud, audio, run } = setup();
    game.enter();
    run(2);
    for (const k of ['ArrowUp', 'ArrowUp', 'ArrowDown', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ArrowLeft', 'ArrowRight', 'KeyK', 'KeyJ']) {
      input.keyDown(k);
      input.keyUp(k);
    }
    game.pressStart();
    expect(game.getState().paused).toBe(false);
    expect(game.match.weaponOf('superneus')).toBe('knife');
    expect(audio.knife).toHaveBeenCalled();
    expect(hud.popup).toHaveBeenCalledWith('SCHHING!', expect.any(Number), expect.any(Number), expect.any(String));
    // the knife survives a rematch
    game.startMatch();
    expect(game.match.weaponOf('superneus')).toBe('knife');
  });

  it('leave stops music and the ticker and resets the screen state', () => {
    const { game, engine, audio } = setup();
    game.enter();
    game.pressStart();
    game.leave();
    expect(game.phase).toBe('menu');
    expect(game.getState()).toEqual({ paused: false, result: null });
    expect(audio.music.stop).toHaveBeenCalled();
    expect(engine.app.ticker.stop).toHaveBeenCalled();
  });
});
