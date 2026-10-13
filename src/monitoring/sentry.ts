// Error/crash reporting with Sentry (see README "Privacy"); environments 'prod'
// (GitHub Pages) and 'localhost' (dev server / local preview), never in tests.
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
  mode: string; // Vite mode: 'development' (npm run dev), 'production' (build), 'test' (vitest)
  dsn: string | undefined;
  hostname: string;
}

/** localhost, loopback and LAN addresses (phones testing `npm run dev --host`). */
const LOCAL_HOST = /^(localhost|127\.|\[?::1\]?$|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)|\.local$/;

/** Sentry environment: 'prod' for the deployed build (GitHub Pages), 'localhost' for the
 *  dev server and local `npm run preview`. */
export function sentryEnvironment(mode: string, hostname: string): 'prod' | 'localhost' {
  return mode === 'production' && !LOCAL_HOST.test(hostname) ? 'prod' : 'localhost';
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
        frame.filename = BUNDLE_URL; // the inlined production bundle
        ours = true;
      } else if (new URL(file, href).origin === new URL(href).origin) {
        ours = true; // dev server modules (/src/…)
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
  env: Env = { mode: import.meta.env.MODE, dsn: import.meta.env.VITE_SENTRY_DSN as string | undefined, hostname: location.hostname },
): boolean {
  const dsn = env.dsn || PUBLIC_DSN;
  if (env.mode === 'test' || !dsn) return false;
  Sentry.init({
    dsn,
    release: __GIT_SHA__, // the commit shown bottom right on the start page
    environment: sentryEnvironment(env.mode, env.hostname),
    sampleRate: 1,
    dataCollection: { userInfo: false, cookies: false, httpHeaders: false, urlQueryParams: false },
    beforeSend: (event) => filterEvent(event, location.href),
    // User feedback form; no floating button (it would cover the fight), opened from
    // the start page via openFeedback().
    integrations: [Sentry.feedbackIntegration({
      colorScheme: 'system',
      autoInject: false,
      showBranding: false,
      // general feedback, not only bug reports (Sentry's default wording)
      formTitle: 'Give feedback',
      messageLabel: 'Feedback',
      messagePlaceholder: 'What do you like, what bugs you, what would you change?',
      submitButtonLabel: 'Send feedback',
      successMessageText: 'Thanks for your feedback!',
    })],
  });
  Sentry.setTag('build', __APP_VERSION__); // content hash used by the update check
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

/** True when a key event comes from a text field (also inside the feedback form's
 *  shadow DOM), so game/page shortcuts leave it alone. */
export function isTyping(e: Event): boolean {
  const el = e.composedPath()[0];
  return el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName));
}

/** Opens Sentry's user feedback form. Returns false when Sentry isn't initialised. */
export async function openFeedback(): Promise<boolean> {
  const feedback = Sentry.getFeedback();
  if (!feedback) return false;
  const form = await feedback.createForm();
  form.appendToDom();
  form.open();
  return true;
}
