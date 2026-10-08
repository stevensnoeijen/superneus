import { forwardRef, useImperativeHandle, useRef, type ReactNode } from 'react';
import { MuteIcon, PauseIcon, PotterpimBadge, SuperneusBadge } from './Icons';

export interface HudHandle {
  setHealth(p1: number, p2: number): void;
  setSpecial(p1: number, p2: number): void;
}

interface HudProps {
  paused: boolean;
  muted: boolean;
  onPause(): void;
  onToggleMute(): void;
}

const clamp01 = (v: number): number => Math.max(0, Math.min(1, v || 0));

/**
 * Health + special bars for both fighters, with the pause and mute badges in the middle.
 * Bars are updated imperatively through the handle (every frame, no React re-render).
 */
export const Hud = forwardRef<HudHandle, HudProps>(function Hud({ paused, muted, onPause, onToggleMute }, ref) {
  const left = useRef<SideHandle>(null);
  const right = useRef<SideHandle>(null);
  useImperativeHandle(ref, () => ({
    setHealth(a, b) { left.current?.setHealth(a); right.current?.setHealth(b); },
    setSpecial(a, b) { left.current?.setSpecial(a); right.current?.setSpecial(b); },
  }), []);

  return (
    <div className="sn-hud">
      <Side ref={left} side="left" name="SUPERNEUS" ready="SNUIF READY!" badge={<SuperneusBadge />} />
      <div className="sn-hud-mid">
        <button
          type="button"
          className={`sn-mute sn-pause${paused ? ' is-paused' : ''}`}
          aria-label="Pauze"
          // pointerdown: responds instantly on touch, and works while other fingers hold the d-pad
          onPointerDown={(e) => { e.preventDefault(); e.stopPropagation(); onPause(); }}
          onClick={(e) => { e.stopPropagation(); if (e.detail === 0) onPause(); }} // keyboard activation
        >
          <PauseIcon />
        </button>
        <button
          type="button"
          className={`sn-mute${muted ? ' is-muted' : ''}`}
          aria-label="Geluid aan/uit"
          aria-pressed={muted}
          onClick={(e) => { e.stopPropagation(); onToggleMute(); e.currentTarget.blur(); }}
        >
          <MuteIcon />
        </button>
      </div>
      <Side ref={right} side="right" name="POTTERPIM" ready="WOORDEN READY!" badge={<PotterpimBadge />} />
    </div>
  );
});

interface SideHandle {
  setHealth(v: number): void;
  setSpecial(v: number): void;
}

const Side = forwardRef<SideHandle, { side: 'left' | 'right'; name: string; ready: string; badge: ReactNode }>(
  function Side({ side, name, ready, badge }, ref) {
    const fill = useRef<HTMLDivElement>(null);
    const trail = useRef<HTMLDivElement>(null);
    const meter = useRef<HTMLDivElement>(null);
    const meterFill = useRef<HTMLDivElement>(null);
    useImperativeHandle(ref, () => ({
      setHealth(v) {
        const f = clamp01(v);
        if (fill.current) {
          fill.current.style.transform = `scaleX(${f})`;
          fill.current.classList.toggle('low', f < 0.3);
        }
        if (trail.current) trail.current.style.transform = `scaleX(${f})`;
      },
      setSpecial(v) {
        const f = clamp01(v);
        if (meterFill.current) meterFill.current.style.transform = `scaleX(${f})`;
        meter.current?.classList.toggle('full', f >= 1);
      },
    }), []);
    return (
      <div className={`sn-side ${side}`}>
        <div className="sn-badge">{badge}</div>
        <div className="sn-bars">
          <div className="sn-name stroke">{name}</div>
          <div className="sn-health"><div ref={trail} className="sn-trail" /><div ref={fill} className="sn-fill" /></div>
          <div ref={meter} className="sn-meter"><div ref={meterFill} /></div>
          <div className="sn-ready stroke">{ready}</div>
        </div>
      </div>
    );
  },
);
