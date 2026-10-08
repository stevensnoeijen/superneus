import { useEffect, useState } from 'react';
import { flushSync } from 'react-dom';

/** Hash routes: they work on GitHub Pages and in the single-file build without a server. */
export type Route = 'start' | 'fight';

const ROUTE_HASH: Record<Route, string> = { start: '#/', fight: '#/fight' };

export function parseRoute(hash: string): Route {
  return hash.replace(/^#\/?/, '') === 'fight' ? 'fight' : 'start';
}

export function navigate(route: Route): void {
  if (parseRoute(location.hash) !== route) location.hash = ROUTE_HASH[route];
}

type ViewTransitionDoc = Document & { startViewTransition?: (cb: () => void) => unknown };

/**
 * Current route, updated on hash changes (links, navigate(), browser back/forward).
 * Page swaps run inside a View Transition when the browser supports it (animated in
 * CSS: ::view-transition-old/new), else the pages' own CSS enter animation plays.
 */
export function useRoute(): Route {
  const [route, setRoute] = useState<Route>(() => parseRoute(location.hash));
  useEffect(() => {
    const onHash = () => {
      const next = parseRoute(location.hash);
      const doc = document as ViewTransitionDoc;
      const reduce = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
      if (doc.startViewTransition && !reduce) doc.startViewTransition(() => flushSync(() => setRoute(next)));
      else setRoute(next);
    };
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);
  return route;
}
