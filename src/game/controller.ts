import { createMatch, giveKnife, updateMatch, type Match } from '../ecs/index';
import { createCheatCode } from '../cheats';
import type { Engine } from '../engine/index';
import type { Audio } from '../audio/index';
import type { FighterId, GameEvent, MoveAnim } from '../types';
import { emptyInput, type InputController } from './input';
import { perfFrame } from '../perf';

export type Phase = 'menu' | 'intro' | 'fight' | 'over';

/** The bits of the game screen the loop updates imperatively (no React re-render per frame). */
export interface HudBridge {
  setHealth(p1: number, p2: number): void;
  setSpecial(p1: number, p2: number): void;
  popup(text: string, x: number, y: number, color?: string): void;
  announce(text: string): void;
}

/** Rarely-changing state the React screens render from. */
export interface GameUiState {
  paused: boolean;
  result: { winner: FighterId | null; playerWon: boolean } | null;
}

const HIT_WORDS: Record<MoveAnim, string[]> = {
  punch: ['BAM!', 'POW!', 'WHAM!', 'BOK!'],
  kick: ['KRAK!', 'THWACK!', 'BOEM!', 'KAPOW!'],
  special: ['ZZZNIFF!', 'SNUIF!!', 'WHOOSH!'],
};
const WORD_COLORS = ['#ffc72c', '#ff3d9a', '#3de0ff', '#ffffff'];
const pick = <T>(arr: readonly T[]): T => arr[(Math.random() * arr.length) | 0];
const NO_INPUT = emptyInput();
const INTRO_SECONDS = 1.4;
const KO_PAUSE_SECONDS = 2.4;

/**
 * Runs a fight: match lifecycle (intro → fight → KO → result), pause, the hidden cheat,
 * and turning game events into sound + screen effects. Used by the game page.
 */
export class GameController {
  match: Match = createMatch();
  phase: Phase = 'menu';
  private introTimer = 0;
  private overTimer = 0;
  private knifeUnlocked = false; // hidden cheat: stays unlocked until the page reloads
  private hud: HudBridge | null = null;
  private state: GameUiState = { paused: false, result: null };
  private subscribers = new Set<() => void>();
  private cheat = createCheatCode(() => this.unlockKnife());

  constructor(private engine: Engine, private audio: Audio, private input: InputController) {
    engine.onTick((dt) => this.tick(dt));
    input.onButtonDown((b) => {
      if (this.phase === 'fight' || this.phase === 'intro') this.cheat.press(b);
    });
  }

  // ---- React integration (useSyncExternalStore) ----
  subscribe = (fn: () => void): (() => void) => {
    this.subscribers.add(fn);
    return () => { this.subscribers.delete(fn); };
  };
  getState = (): GameUiState => this.state;
  private setState(patch: Partial<GameUiState>): void {
    this.state = { ...this.state, ...patch };
    for (const fn of this.subscribers) fn();
  }

  attachHud(hud: HudBridge | null): void {
    this.hud = hud;
  }

  /** Game page shown: start rendering and begin a match. */
  enter(): void {
    this.engine.app.ticker.start();
    this.startMatch();
  }

  /** Game page left: stop everything so the start page costs no CPU/battery. */
  leave(): void {
    this.phase = 'menu';
    this.audio.music.stop();
    this.input.clear();
    this.setState({ paused: false, result: null });
    this.engine.app.ticker.stop();
  }

  startMatch(): void {
    this.match = createMatch();
    if (this.knifeUnlocked) giveKnife(this.match);
    this.phase = 'intro';
    this.introTimer = INTRO_SECONDS;
    this.input.clear();
    this.setState({ paused: false, result: null });
    this.hud?.setHealth(1, 1);
    this.hud?.setSpecial(0, 0);
    this.hud?.announce('ROUND 1');
    this.audio.fightStart();
    this.audio.music.start();
  }

  /** The START button (pause badge, P / Esc / Enter). Completing the cheat code consumes it. */
  pressStart(): void {
    if (this.phase !== 'fight' && this.phase !== 'intro') return;
    if (this.cheat.start()) return;
    this.setPaused(!this.state.paused);
  }

  setPaused(paused: boolean): void {
    if (paused === this.state.paused) return;
    if (paused) this.audio.music.stop();
    else this.audio.music.start();
    this.setState({ paused });
  }

  private unlockKnife(): void {
    if (!giveKnife(this.match)) return;
    this.knifeUnlocked = true;
    this.audio.knife();
    this.engine.flash();
    this.engine.shake(6);
    const p = this.engine.worldToScreen(this.match.p1.x + 60 * this.match.p1.facing, 150);
    this.hud?.popup('SCHHING!', p.x, p.y, '#e4e9f0');
  }

  /** One frame. Public for tests. */
  tick(dt: number): void {
    perfFrame(this.engine.app.ticker.deltaMS);
    if (this.phase === 'menu' || this.state.paused) return; // paused: last frame stays on screen
    if (this.phase === 'intro') {
      this.introTimer -= dt;
      if (this.introTimer <= 0) {
        this.phase = 'fight';
        this.match.active = true;
        this.hud?.announce('FIGHT!');
      }
    }
    const input = this.phase === 'fight' ? this.input.getInput() : NO_INPUT;
    this.handleEvents(updateMatch(this.match, dt, input));
    const { p1, p2 } = this.match;
    this.hud?.setHealth(p1.health / p1.maxHealth, p2.health / p2.maxHealth);
    this.hud?.setSpecial(p1.specialMeter / 100, p2.specialMeter / 100);
    if (this.phase === 'over' && this.overTimer > 0) {
      this.overTimer -= dt;
      if (this.overTimer <= 0) {
        const playerWon = this.match.winner === 'superneus';
        if (playerWon) this.audio.victory();
        else this.audio.defeat();
        this.input.clear();
        this.setState({ result: { winner: this.match.winner, playerWon } });
      }
    }
    this.engine.render(this.match);
  }

  private handleEvents(events: GameEvent[]): void {
    const { engine, audio } = this;
    for (const ev of events) {
      switch (ev.type) {
        case 'attack':
          audio.whoosh();
          if (ev.move === 'special') {
            if (ev.who === 'superneus') audio.sniff();
            else audio.wordThrow();
          }
          break;
        case 'jump':
          audio.jump();
          break;
        case 'hit': {
          const p = engine.worldToScreen(ev.x, ev.y);
          if (ev.blocked) {
            audio.block();
            this.hud?.popup('BLOK!', p.x, p.y, '#cccccc');
          } else {
            const heavy = ev.move !== 'punch';
            if (ev.move === 'punch') audio.punch();
            else audio.kick();
            audio.hit(heavy);
            this.hud?.popup(pick(HIT_WORDS[ev.move]), p.x, p.y, pick(WORD_COLORS));
            engine.shake(heavy ? 10 : 5);
            if (ev.move === 'special') engine.flash();
          }
          break;
        }
        case 'special-ready':
          if (ev.who === 'superneus') {
            const p = engine.worldToScreen(this.match.p1.x, 230);
            this.hud?.popup('SNUIF READY!', p.x, p.y, '#ffc72c');
          }
          break;
        case 'ko':
          this.phase = 'over';
          this.overTimer = KO_PAUSE_SECONDS;
          engine.flash();
          engine.shake(18);
          this.hud?.announce('K.O.!');
          audio.ko();
          audio.music.stop();
          break;
      }
    }
  }
}
