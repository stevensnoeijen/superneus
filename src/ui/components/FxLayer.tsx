import { forwardRef, useImperativeHandle, useRef, useState, type CSSProperties } from 'react';

export interface FxHandle {
  popup(text: string, x: number, y: number, color?: string): void;
  announce(text: string): void;
}

interface Popup { id: number; text: string; x: number; y: number; color?: string; rot: number }

const MAX_POPUPS = 8;

/** Floating comic words (BAM! POW!) and the big banners (ROUND 1, FIGHT!, K.O.!). */
export const FxLayer = forwardRef<FxHandle>(function FxLayer(_props, ref) {
  const [popups, setPopups] = useState<Popup[]>([]);
  const [banner, setBanner] = useState<{ id: number; text: string } | null>(null);
  const nextId = useRef(0);

  useImperativeHandle(ref, () => ({
    popup(text, x, y, color) {
      const p: Popup = { id: ++nextId.current, text, x, y, color, rot: Math.random() * 30 - 15 };
      setPopups((list) => [...list.slice(-(MAX_POPUPS - 1)), p]);
    },
    announce(text) {
      setBanner({ id: ++nextId.current, text });
    },
  }), []);

  const remove = (id: number) => setPopups((list) => list.filter((p) => p.id !== id));

  return (
    <div className="sn-fx">
      {popups.map((p) => (
        <div key={p.id} className="sn-pop" style={{ transform: `translate(${p.x}px, ${p.y}px)` }} onAnimationEnd={() => remove(p.id)}>
          <div className="shape" style={{ '--rot': `${p.rot.toFixed(1)}deg`, ...(p.color ? { '--c': p.color } : {}) } as CSSProperties}>
            <span className="word">{p.text}</span>
          </div>
        </div>
      ))}
      {banner && (
        <div key={banner.id} className="sn-announce" onAnimationEnd={() => setBanner(null)}>{banner.text}</div>
      )}
    </div>
  );
});
