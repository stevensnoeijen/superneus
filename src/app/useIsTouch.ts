import { useSyncExternalStore } from 'react';

// Touch layout = the primary pointer is a finger. Media queries (not 'ontouchstart')
// because they update live: toggling a phone in browser devtools fires their change event.
const QUERIES = ['(pointer: coarse)', '(hover: none) and (any-pointer: coarse)'];

function lists(): MediaQueryList[] {
  return typeof matchMedia === 'function' ? QUERIES.map((q) => matchMedia(q)) : [];
}

function subscribe(onChange: () => void): () => void {
  const ls = lists();
  for (const m of ls) m.addEventListener('change', onChange);
  window.addEventListener('resize', onChange); // fallback for browsers that miss the media change
  return () => {
    for (const m of ls) m.removeEventListener('change', onChange);
    window.removeEventListener('resize', onChange);
  };
}

export const detectTouch = (): boolean => lists().some((m) => m.matches);

/** true on phones/tablets; switches live (devtools device mode, attaching a mouse, ...). */
export function useIsTouch(): boolean {
  return useSyncExternalStore(subscribe, detectTouch, () => false);
}
