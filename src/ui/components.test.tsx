// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';

// jsdom has no `onanimationend` on elements; Preact checks for it to pick the lowercase
// 'animationend' event name (real browsers have it). Must exist before rendering.
vi.hoisted(() => {
  const proto = HTMLElement.prototype as unknown as Record<string, unknown>;
  // oxlint-disable-next-line unicorn/prefer-add-event-listener -- declaring the property, not adding a handler
  if (!('onanimationend' in proto)) proto.onanimationend = null;
});
import { act, cleanup, fireEvent, render, screen } from '@testing-library/preact';
import { createRef } from 'react';
import { StartPage } from './pages/StartPage';
import { ControlsHelp } from './components/ControlsHelp';
import { GameOverModal } from './components/GameOverModal';
import { PauseOverlay } from './components/PauseOverlay';
import { Hud, type HudHandle } from './components/Hud';
import { TouchControls, dirFromPoint, type TouchControlsHandle } from './components/TouchControls';
import { FxLayer, type FxHandle } from './components/FxLayer';
import { InputController } from '../game/input';

afterEach(cleanup);

describe('StartPage', () => {
  it('shows the title and starts with FIGHT! or Enter', () => {
    const onFight = vi.fn();
    render(<StartPage touch={false} onFight={onFight} />);
    expect(screen.getByText('SUPER NEUS')).toBeTruthy();
    fireEvent.click(screen.getByText('FIGHT!'));
    fireEvent.keyDown(window, { code: 'Enter' });
    fireEvent.keyDown(window, { code: 'KeyQ' });
    expect(onFight).toHaveBeenCalledTimes(2);
  });
});

describe('ControlsHelp', () => {
  it('keyboard list on desktop, button preview on touch', () => {
    const { container, rerender } = render(<ControlsHelp touch={false} />);
    expect(container.querySelector('kbd')).not.toBeNull();
    expect(container.querySelector('.pv-screen')).toBeNull();
    rerender(<ControlsHelp touch />);
    expect(container.querySelector('kbd')).toBeNull();
    expect(container.querySelector('.pv-screen')).not.toBeNull();
  });
});

describe('modals', () => {
  it('game over shows the winner and offers a rematch and the menu', () => {
    const onRestart = vi.fn(), onMenu = vi.fn();
    const { rerender } = render(<GameOverModal playerWon onRestart={onRestart} onMenu={onMenu} />);
    expect(screen.getByText(/SUPERNEUS WINT/)).toBeTruthy();
    fireEvent.click(screen.getByText('NOG EEN KEER!'));
    fireEvent.click(screen.getByText('MENU'));
    expect(onRestart).toHaveBeenCalledOnce();
    expect(onMenu).toHaveBeenCalledOnce();
    rerender(<GameOverModal playerWon={false} onRestart={onRestart} onMenu={onMenu} />);
    expect(screen.getByText(/POTTERPIM WINT/)).toBeTruthy();
  });

  it('pause offers resume and menu', () => {
    const onResume = vi.fn(), onMenu = vi.fn();
    render(<PauseOverlay onResume={onResume} onMenu={onMenu} />);
    fireEvent.click(screen.getByText('VERDER'));
    fireEvent.click(screen.getByText('MENU'));
    expect(onResume).toHaveBeenCalledOnce();
    expect(onMenu).toHaveBeenCalledOnce();
  });
});

describe('Hud', () => {
  it('updates bars through the handle and wires pause + mute', () => {
    const ref = createRef<HudHandle>();
    const onPause = vi.fn(), onToggleMute = vi.fn();
    const { container } = render(<Hud ref={ref} paused={false} muted={false} onPause={onPause} onToggleMute={onToggleMute} />);
    ref.current!.setHealth(0.5, 0.2);
    ref.current!.setSpecial(1, 0.3);
    const fills = container.querySelectorAll<HTMLElement>('.sn-fill');
    expect(fills[0].style.transform).toBe('scaleX(0.5)');
    expect(fills[1].classList.contains('low')).toBe(true);
    expect(container.querySelector('.sn-meter')!.classList.contains('full')).toBe(true);
    fireEvent.pointerDown(screen.getByLabelText('Pauze'));
    fireEvent.click(screen.getByLabelText('Geluid aan/uit'));
    expect(onPause).toHaveBeenCalledOnce();
    expect(onToggleMute).toHaveBeenCalledOnce();
  });
});

describe('TouchControls', () => {
  it('8-way d-pad directions with a dead zone', () => {
    expect(dirFromPoint(0, 0, 100)).toEqual({ left: false, right: false, up: false, down: false });
    expect(dirFromPoint(40, 0, 100)).toMatchObject({ right: true, up: false });
    expect(dirFromPoint(-30, -30, 100)).toMatchObject({ left: true, up: true });
    expect(dirFromPoint(0, 40, 100)).toMatchObject({ down: true });
  });

  it('buttons press and release the input; SNUIF charges up', () => {
    Element.prototype.setPointerCapture = () => {};
    const input = new InputController();
    const ref = createRef<TouchControlsHandle>();
    render(<TouchControls ref={ref} input={input} />);
    const kick = screen.getByText('KICK');
    fireEvent.pointerDown(kick, { pointerId: 3 });
    expect(input.getInput().kick).toBe(true);
    fireEvent.pointerUp(kick, { pointerId: 3 });
    expect(input.getInput().kick).toBe(false);
    const snuif = screen.getByText('SNUIF');
    act(() => ref.current!.setSpecialCharge(0.5));
    expect(snuif.getAttribute('aria-disabled')).toBe('true');
    expect(snuif.style.getPropertyValue('--charge')).toBe('0.5');
    act(() => ref.current!.setSpecialCharge(1));
    expect(snuif.classList.contains('ready')).toBe(true);
  });
});

describe('FxLayer', () => {
  it('shows popups (capped) and banners, removing them when their animation ends', () => {
    const ref = createRef<FxHandle>();
    const { container } = render(<FxLayer ref={ref} />);
    act(() => { for (let i = 0; i < 20; i++) ref.current!.popup('BAM!', 1, 2, '#fff'); });
    expect(container.querySelectorAll('.sn-pop').length).toBe(8);
    fireEvent.animationEnd(container.querySelector('.sn-pop')!);
    expect(container.querySelectorAll('.sn-pop').length).toBe(7);
    act(() => ref.current!.announce('FIGHT!'));
    expect(screen.getByText('FIGHT!')).toBeTruthy();
    fireEvent.animationEnd(screen.getByText('FIGHT!'));
    expect(screen.queryByText('FIGHT!')).toBeNull();
  });
});
