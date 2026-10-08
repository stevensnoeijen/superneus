// @vitest-environment jsdom
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { App } from './App';
import { ServicesContext, type Services } from './services';
import { parseRoute } from './router';
import { GameController } from '../game/controller';
import { InputController } from '../game/input';
import type { Engine } from '../engine/index';
import type { Audio } from '../audio/index';

const noop = (): void => {};

function services(): Services & { tick: (dt: number) => void } {
  let tickFn: (dt: number) => void = noop;
  const engine = {
    app: { ticker: { start: vi.fn(), stop: vi.fn(), deltaMS: 16 } },
    onTick: (fn: (dt: number) => void) => { tickFn = fn; },
    render: vi.fn(), worldToScreen: (x: number, y: number) => ({ x, y }), shake: vi.fn(), flash: vi.fn(), preloadFighters: vi.fn(),
  } as unknown as Engine;
  let muted = false;
  const audio = new Proxy({
    music: { start: vi.fn(), stop: vi.fn(), playing: false },
    get muted() { return muted; },
    setMuted: (m: boolean) => { muted = m; },
  } as Record<string, unknown>, { get: (t, p: string) => (p in t ? t[p] : (t[p] = vi.fn())) }) as unknown as Audio;
  const input = new InputController();
  const game = new GameController(engine, audio, input);
  return { audio, input, game, tick: (dt) => tickFn(dt) };
}

const hashChange = (hash: string) => act(() => {
  location.hash = hash;
  window.dispatchEvent(new HashChangeEvent('hashchange'));
});

beforeEach(() => { location.hash = ''; });
afterEach(cleanup);

describe('router', () => {
  it('parses hash routes', () => {
    expect(parseRoute('')).toBe('start');
    expect(parseRoute('#/')).toBe('start');
    expect(parseRoute('#/fight')).toBe('fight');
    expect(parseRoute('#/nonsense')).toBe('start');
  });
});

describe('App', () => {
  it('start page → FIGHT! → game page → pause → menu', () => {
    const s = services();
    render(<ServicesContext.Provider value={s}><App /></ServicesContext.Provider>);
    expect(screen.getByText('SUPER NEUS')).toBeTruthy();

    fireEvent.click(screen.getByText('FIGHT!'));
    expect(location.hash).toBe('#/fight');
    expect(s.audio.unlock).toHaveBeenCalled();
    hashChange('#/fight');
    expect(screen.getByLabelText('Pauze')).toBeTruthy();
    expect(s.game.phase).toBe('intro');

    // play into the fight, then pause with P
    act(() => { for (let i = 0; i < 120; i++) s.tick(1 / 60); });
    fireEvent.keyDown(window, { code: 'KeyP' });
    expect(screen.getByText('PAUZE')).toBeTruthy();
    // game keys reach the input while playing
    fireEvent.keyDown(window, { code: 'KeyP' });
    fireEvent.keyDown(window, { code: 'KeyJ' });
    expect(s.input.getInput().punch).toBe(true);
    fireEvent.keyUp(window, { code: 'KeyJ' });

    // mute toggles audio
    fireEvent.click(screen.getByLabelText('Geluid aan/uit'));
    expect(s.audio.muted).toBe(true);

    // back to the menu stops the game
    fireEvent.keyDown(window, { code: 'Escape' });
    fireEvent.click(screen.getByText('MENU'));
    hashChange('#/');
    expect(screen.getByText('SUPER NEUS')).toBeTruthy();
    expect(s.game.phase).toBe('menu');
  });

  it('K.O. screen: Enter starts a rematch', () => {
    const s = services();
    location.hash = '#/fight';
    render(<ServicesContext.Provider value={s}><App /></ServicesContext.Provider>);
    act(() => { for (let i = 0; i < 60 * 60; i++) s.tick(1 / 60); }); // idle player loses
    expect(screen.getByText(/POTTERPIM WINT/)).toBeTruthy();
    fireEvent.keyDown(window, { code: 'Enter' });
    expect(screen.queryByText(/POTTERPIM WINT/)).toBeNull();
    expect(s.game.phase).toBe('intro');
  });
});

describe('update banner during a fight', () => {
  it('is hidden while playing and paused, shown on the K.O. screen', async () => {
    const s = services();
    location.hash = '#/fight';
    const { GamePage } = await import('../ui/pages/GamePage');
    render(<ServicesContext.Provider value={s}><GamePage touch={false} muted={false} onToggleMute={noop} onMenu={noop} updateAvailable /></ServicesContext.Provider>);
    expect(screen.queryByText('NIEUWE VERSIE!')).toBeNull();
    act(() => s.game.pressStart()); // intro: START pauses
    expect(screen.getByText('PAUZE')).toBeTruthy();
    expect(screen.queryByText('NIEUWE VERSIE!')).toBeNull();
    act(() => s.game.setPaused(false));
    act(() => { for (let i = 0; i < 60 * 60; i++) s.tick(1 / 60); }); // idle player loses
    expect(screen.getByText(/POTTERPIM WINT/)).toBeTruthy();
    expect(screen.getByText('NIEUWE VERSIE!')).toBeTruthy();
  });
});
