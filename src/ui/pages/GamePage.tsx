import { useEffect, useRef, useSyncExternalStore } from 'react';
import { useServices } from '../../app/services';
import { Hud, type HudHandle } from '../components/Hud';
import { TouchControls, type TouchControlsHandle } from '../components/TouchControls';
import { FxLayer, type FxHandle } from '../components/FxLayer';
import { PauseOverlay } from '../components/PauseOverlay';
import { GameOverModal } from '../components/GameOverModal';
import { UpdateBanner } from '../components/UpdateBanner';

const PAUSE_KEYS = new Set(['Enter', 'NumpadEnter', 'KeyP', 'Escape']);
const CONFIRM_KEYS = new Set(['Enter', 'NumpadEnter', 'Space', 'KeyR']);

/**
 * Game page (#/fight). The PixiJS stage lives outside React (#game); this page draws the
 * HUD, touch controls, effects, pause and K.O. screens over it and drives the controller.
 */
export function GamePage({ touch, muted, onToggleMute, onMenu, updateAvailable = false }: { touch: boolean; muted: boolean; onToggleMute(): void; onMenu(): void; updateAvailable?: boolean }) {
  const { game, input, audio } = useServices();
  const { paused, result } = useSyncExternalStore(game.subscribe, game.getState);
  const hud = useRef<HudHandle>(null);
  const fx = useRef<FxHandle>(null);
  const pads = useRef<TouchControlsHandle>(null);

  // hand the controller imperative access to the bars/effects, then start the fight
  useEffect(() => {
    game.attachHud({
      setHealth: (a, b) => hud.current?.setHealth(a, b),
      setSpecial: (a, b) => { hud.current?.setSpecial(a, b); pads.current?.setSpecialCharge(a); },
      popup: (t, x, y, c) => fx.current?.popup(t, x, y, c),
      announce: (t) => fx.current?.announce(t),
    });
    game.enter();
    return () => { game.leave(); game.attachHud(null); };
  }, [game]);

  // keyboard: K.O. screen confirm, START/pause, then the game buttons
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      audio.unlock(); // in case the page was opened directly on #/fight
      if (game.getState().result) {
        if (CONFIRM_KEYS.has(e.code)) { e.preventDefault(); if (!e.repeat) game.startMatch(); }
        return;
      }
      if (PAUSE_KEYS.has(e.code)) { e.preventDefault(); if (!e.repeat) game.pressStart(); return; }
      if (input.keyDown(e.code, e.repeat) || e.code === 'Space') e.preventDefault();
    };
    const up = (e: KeyboardEvent) => { if (input.keyUp(e.code)) e.preventDefault(); };
    const release = () => input.clear();
    const onVisibility = () => { if (document.hidden) release(); };
    const unlock = () => audio.unlock();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', release);
    window.addEventListener('pointerdown', unlock);
    document.addEventListener('visibilitychange', onVisibility);
    return () => {
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', release);
      window.removeEventListener('pointerdown', unlock);
      document.removeEventListener('visibilitychange', onVisibility);
    };
  }, [game, input, audio]);

  return (
    <div className="sn-page sn-game">
      <Hud ref={hud} paused={paused} muted={muted} onPause={() => game.pressStart()} onToggleMute={onToggleMute} />
      <FxLayer ref={fx} />
      {touch && !result && <TouchControls ref={pads} input={input} />}
      {paused && <PauseOverlay onResume={() => game.setPaused(false)} onMenu={onMenu} />}
      {result && <GameOverModal playerWon={result.playerWon} onRestart={() => game.startMatch()} onMenu={onMenu} />}
      {/* never during play (not even paused): only on the K.O. screen */}
      {updateAvailable && result && <UpdateBanner />}
    </div>
  );
}
