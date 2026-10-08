import { forwardRef, useEffect, useImperativeHandle, useRef, useState, type PointerEvent as ReactPointerEvent, type Ref } from 'react';
import type { InputController } from '../../game/input';
import type { Button } from '../../types';

type Dir = 'left' | 'right' | 'up' | 'down';
type DirState = Record<Dir, boolean>;
type Action = 'block' | 'special' | 'punch' | 'kick';

const NO_DIRS: DirState = { left: false, right: false, up: false, down: false };
const ARROWS: Record<Dir, string> = { up: '▲', down: '▼', left: '◀', right: '▶' };
const ACTIONS: { name: Action; label: string }[] = [
  { name: 'block', label: 'BLOK' }, { name: 'special', label: 'SNUIF' },
  { name: 'punch', label: 'PUNCH' }, { name: 'kick', label: 'KICK' },
];

export interface TouchControlsHandle {
  /** SNUIF button charge 0..1: purple fills from the bottom, disabled until full. */
  setSpecialCharge(frac: number): void;
}

/** 8-way direction from a point relative to the d-pad's centre, with a small dead zone. */
export function dirFromPoint(dx: number, dy: number, size: number): DirState {
  const d = { ...NO_DIRS };
  if (Math.hypot(dx, dy) < size * 0.14) return d;
  const a = Math.atan2(-dy, dx) * 180 / Math.PI; // 0 = right, 90 = up
  if (a > -67.5 && a < 67.5) d.right = true;
  if (a > 112.5 || a < -112.5) d.left = true;
  if (a > 22.5 && a < 157.5) d.up = true;
  if (a < -22.5 && a > -157.5) d.down = true;
  return d;
}

const capture = (e: ReactPointerEvent<HTMLElement>): void => {
  try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* not supported */ }
};
const blockGestures = (e: { preventDefault(): void }): void => e.preventDefault();

/** On-screen d-pad + action buttons (multi-touch: one finger per button). */
export const TouchControls = forwardRef<TouchControlsHandle, { input: InputController }>(function TouchControls({ input }, ref) {
  const special = useRef<HTMLDivElement>(null);
  useImperativeHandle(ref, () => ({
    setSpecialCharge(frac) {
      const el = special.current;
      if (!el) return;
      const f = Math.max(0, Math.min(1, frac));
      el.style.setProperty('--charge', String(f));
      el.classList.toggle('ready', f >= 1);
      el.setAttribute('aria-disabled', String(f < 1));
    },
  }), []);

  // touch layout switched off (or page left): release everything this component holds
  useEffect(() => () => input.clear(), [input]);

  return (
    <div className="sn-touch" onContextMenu={blockGestures} onDoubleClick={blockGestures}>
      <DPad input={input} />
      <div className="sn-actions">
        {ACTIONS.map(({ name, label }) => (
          <ActionButton key={name} name={name} label={label} input={input} elRef={name === 'special' ? special : undefined} />
        ))}
      </div>
    </div>
  );
});

function DPad({ input }: { input: InputController }) {
  const pointers = useRef(new Map<number, DirState>());
  const [held, setHeld] = useState<DirState>(NO_DIRS);

  const refresh = () => {
    const next = { ...NO_DIRS };
    for (const d of pointers.current.values()) for (const k of Object.keys(next) as Dir[]) if (d[k]) next[k] = true;
    for (const k of Object.keys(next) as Dir[]) input.setTouch(k as Button, next[k]);
    setHeld(next);
  };
  const track = (e: ReactPointerEvent<HTMLDivElement>) => {
    const r = e.currentTarget.getBoundingClientRect();
    pointers.current.set(e.pointerId, dirFromPoint(e.clientX - (r.left + r.width / 2), e.clientY - (r.top + r.height / 2), r.width));
    refresh();
  };
  const end = (e: ReactPointerEvent<HTMLDivElement>) => {
    if (pointers.current.delete(e.pointerId)) refresh();
  };

  return (
    <div
      className="sn-dpad"
      onPointerDown={(e) => { e.preventDefault(); capture(e); track(e); }}
      onPointerMove={(e) => { if (pointers.current.has(e.pointerId)) { e.preventDefault(); track(e); } }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      {(Object.keys(ARROWS) as Dir[]).map((d) => (
        <div key={d} className={`d ${d}${held[d] ? ' on' : ''}`}>{ARROWS[d]}</div>
      ))}
    </div>
  );
}

function ActionButton({ name, label, input, elRef }: { name: Action; label: string; input: InputController; elRef?: Ref<HTMLDivElement> }) {
  const ids = useRef(new Set<number>());
  const [on, setOn] = useState(false);
  const sync = () => {
    const down = ids.current.size > 0;
    input.setTouch(name, down);
    setOn(down);
  };
  const end = (e: ReactPointerEvent<HTMLDivElement>) => { if (ids.current.delete(e.pointerId)) sync(); };
  return (
    <div
      ref={elRef}
      className={`sn-act ${name}${on ? ' on' : ''}`}
      aria-disabled={name === 'special' ? true : undefined}
      onPointerDown={(e) => { e.preventDefault(); capture(e); ids.current.add(e.pointerId); sync(); }}
      onPointerUp={end}
      onPointerCancel={end}
      onLostPointerCapture={end}
    >
      {label}
    </div>
  );
}
