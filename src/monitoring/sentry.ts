// Error/crash reporting with Sentry, production builds only (see README "Privacy").
// The SDK is bundled (no CDN loader). Tracing and Session Replay are off: bundle size,
// quota and privacy. Everything here is a safe no-op when Sentry isn't initialised.
import * as Sentry from '@sentry/browser';
import type { ErrorEvent } from '@sentry/browser';

/** Public by design (it only allows sending events); override with VITE_SENTRY_DSN. */
const PUBLIC_DSN = 'https://28ede788dac70a40eaeae025449ed9a6@o4508281401901056.ingest.de.sentry.io/4512245168341072';

/** The single-file build inlines all JS into the page, so stack frames point at the page
 *  URL (`…/`, `…/index.html`, with query/hash). Uploaded source maps are named
 *  `app:///index.html` (see `inlineSourceMap()` in vite.config.js). */
export const BUNDLE_URL = 'app:///index.html';

const NOISE = [/ResizeObserver loop/i, /^Script error\.?$/i, /Non-Error promise rejection captured/i];
const EXTENSION = /^(chrome|moz|safari(-web)?|ms-browser)-extension:\/\//;

interface Env {
  prod: boolean;
  dsn: string | undefined;
}

/** Page URL without query/hash/`index.html`: frames from it are our inlined bundle. */
function pageBase(href: string): string {
  return href.replace(/[?#].*$/, '').replace(/index\.html$/, '');
}

/** Drops noise (extensions, ResizeObserver, foreign scripts) and maps our frames onto the
 *  uploaded source map. Returns null to drop the event. */
export function filterEvent(event: ErrorEvent, href: string): ErrorEvent | null {
  const base = pageBase(href);
  const message = event.exception?.values?.[0]?.value ?? event.message ?? '';
  if (NOISE.some((re) => re.test(message))) return null;
  let ours = false;
  let foreign = false;
  for (const ex of event.exception?.values ?? []) {
    for (const frame of ex.stacktrace?.frames ?? []) {
      const file = frame.filename ?? '';
      if (!file || file === '<anonymous>' || file === '[native code]') continue;
      if (pageBase(file) === base) {
        frame.filename = BUNDLE_URL;
        ours = true;
      } else {
        foreign = true;
        if (EXTENSION.test(file)) return null;
      }
    }
  }
  // Only foreign frames (other origins, injected scripts): not our bug.
  if (foreign && !ours) return null;
  return event;
}

export function initSentry(
  env: Env = { prod: import.meta.env.PROD, dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined },
): boolean {
  const dsn = env.dsn || PUBLIC_DSN;
  if (!env.prod || !dsn) return false;
  Sentry.init({
    dsn,
    release: __APP_VERSION__,
    environment: 'production',
    sampleRate: 1,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, urlQueryParams: false },
    beforeSend: (event) => filterEvent(event, location.href),
  });
  Sentry.setTag('git', __GIT_SHA__);
  return true;
}

export function setTags(tags: Record<string, string>): void {
  Sentry.setTags(tags);
}

/** Game-flow breadcrumb (route, match start, K.O., pause, …) to help reproduce bugs. */
export function breadcrumb(category: string, message: string): void {
  Sentry.addBreadcrumb({ category, message, level: 'info' });
}

/** Reports a caught error with extra context (e.g. a failed load/engine init). */
export function reportError(err: unknown, context: Record<string, unknown>): void {
  Sentry.captureException(err, { contexts: { game: context } });
}
