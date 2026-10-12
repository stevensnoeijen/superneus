import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ErrorEvent } from '@sentry/browser';

vi.mock('@sentry/browser', () => ({
  init: vi.fn(),
  setTag: vi.fn(),
  setTags: vi.fn(),
  addBreadcrumb: vi.fn(),
  captureException: vi.fn(),
}));

const Sentry = await import('@sentry/browser');
const { initSentry, filterEvent, BUNDLE_URL } = await import('./sentry');

const PAGE = 'https://stevensnoeijen.github.io/superneus/#/fight';

function event(value: string, files: string[]): ErrorEvent {
  return {
    type: undefined,
    exception: { values: [{ value, stacktrace: { frames: files.map((filename) => ({ filename })) } }] },
  };
}

describe('initSentry', () => {
  beforeEach(() => vi.mocked(Sentry.init).mockClear());

  it('does nothing in dev/test', () => {
    expect(initSentry({ prod: false, dsn: 'https://k@example.ingest.sentry.io/1' })).toBe(false);
    expect(Sentry.init).not.toHaveBeenCalled();
  });

  it('initialises in production with the app version as release and no PII', () => {
    expect(initSentry({ prod: true, dsn: 'https://k@example.ingest.sentry.io/1' })).toBe(true);
    const opts = vi.mocked(Sentry.init).mock.calls[0]![0]!;
    expect(opts).toMatchObject({
      dsn: 'https://k@example.ingest.sentry.io/1',
      release: 'test-version',
      environment: 'production',
      sampleRate: 1,
      dataCollection: { userInfo: false },
    });
    expect(opts.tracesSampleRate).toBeUndefined();
  });

  it('falls back to the committed public DSN', () => {
    initSentry({ prod: true, dsn: undefined });
    expect(vi.mocked(Sentry.init).mock.calls[0]![0]!.dsn).toMatch(/ingest\.de\.sentry\.io/);
  });
});

describe('filterEvent', () => {
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
