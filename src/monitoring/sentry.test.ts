import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/browser';

vi.mock('@sentry/browser', () => ({
  init: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
  feedbackIntegration: vi.fn(() => ({ name: 'Feedback' })),
  getFeedback: vi.fn(),
}));

const Sentry = await import('@sentry/browser');
const { initSentry, filterEvent, sentryEnvironment, BUNDLE_URL } = await import('./sentry');

const PAGE = 'https://stevensnoeijen.github.io/superneus/#/fight';

function event(value: string, files: string[]): ErrorEvent {
  return {
    type: undefined,
    exception: { values: [{ value, stacktrace: { frames: files.map((filename) => ({ filename })) } }] },
  };
}

describe('initSentry', () => {
  beforeEach(() => vi.mocked(Sentry.init).mockClear());

  it('does nothing in tests', () => {
    expect(initSentry({ mode: 'test', dsn: 'https://k@example.ingest.sentry.io/1', hostname: 'localhost' })).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initialises the deployed build as prod with the git commit as release and no PII', () => {
    expect(initSentry({ mode: 'production', dsn: 'https://k@example.ingest.sentry.io/1', hostname: 'stevensnoeijen.github.io' })).toBe(true);
    const opts = vi.mocked(Sentry.init).mock.calls[0]![0]!;
    expect(opts).toMatchObject({
      dsn: 'https://k@example.ingest.sentry.io/1',
      release: 'test-sha',
      environment: 'prod',
      sampleRate: 1,
      dataCollection: { userInfo: false },
    });
    expect(opts.tracesSampleRate).toBeUndefined();
  });

  it('falls back to the committed public DSN', () => {
    initSentry({ mode: 'development', dsn: undefined, hostname: 'localhost' });
    expect(vi.mocked(Sentry.init).mock.calls[0]![0]!.dsn).toMatch(/ingest\.de\.sentry\.io/);
  });
});

describe('sentryEnvironment', () => {
  it('is prod only for a production build on a public host', () => {
    expect(sentryEnvironment('production', 'stevensnoeijen.github.io')).toBe('prod');
    expect(sentryEnvironment('production', 'localhost')).toBe('localhost'); // npm run preview
    expect(sentryEnvironment('development', 'localhost')).toBe('localhost');
    expect(sentryEnvironment('development', '192.168.1.20')).toBe('localhost'); // phone on LAN
  });
});

describe('filterEvent', () => {
  it('keeps dev server module frames', () => {
    expect(filterEvent(event('boom', ['http://localhost:5173/src/main.tsx']), 'http://localhost:5173/#/')).not.toBeNull();
  });

  it('drops ResizeObserver noise', () => {
    expect(filterEvent(event('ResizeObserver loop limit exceeded', []), PAGE)).toBeNull();
  });

  it('drops errors from browser extensions', () => {
    expect(filterEvent(event('boom', ['chrome-extension://abc/content.js']), PAGE)).toBeNull();
  });

  it('drops errors only from foreign scripts', () => {
    expect(filterEvent(event('boom', ['https://evil.example/x.js']), PAGE)).toBeNull();
  });

  it('keeps game errors and points frames at the uploaded source map', () => {
    const out = filterEvent(event('boom', ['https://stevensnoeijen.github.io/superneus/index.html?perf']), PAGE);
    expect(out?.exception?.values?.[0]?.stacktrace?.frames?.[0]?.filename).toBe(BUNDLE_URL);
  });
});

describe('openFeedback', () => {
  it('is a no-op without Sentry', async () => {
    const { openFeedback } = await import('./sentry');
    vi.mocked(Sentry.getFeedback).mockReturnValue(undefined);
    expect(await openFeedback()).toBe(false);
  });
});
