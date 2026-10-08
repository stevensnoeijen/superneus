// @vitest-environment jsdom
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act, cleanup, fireEvent, render, renderHook, screen } from '@testing-library/preact';
import { APP_VERSION, fetchDeployedVersion, useUpdateCheck } from './useUpdateCheck';
import { UpdateBanner } from '../ui/components/UpdateBanner';
import { StartPage } from '../ui/pages/StartPage';

const reply = (body: unknown, ok = true) => vi.fn(async () => ({ ok, json: async () => body }) as Response) as unknown as typeof fetch;

afterEach(() => { cleanup(); vi.useRealTimers(); });

describe('fetchDeployedVersion', () => {
  it('reads version.json without any cache', async () => {
    const f = reply({ version: 'abc' });
    expect(await fetchDeployedVersion(f)).toBe('abc');
    const [url, init] = vi.mocked(f).mock.calls[0];
    expect(String(url)).toMatch(/^version\.json\?t=\d+$/);
    expect(init).toEqual({ cache: 'no-store' });
  });

  it('returns null when offline, on errors or bad data', async () => {
    expect(await fetchDeployedVersion(vi.fn(async () => { throw new Error('offline'); }) as unknown as typeof fetch)).toBeNull();
    expect(await fetchDeployedVersion(reply({}, false))).toBeNull();
    expect(await fetchDeployedVersion(reply({ version: 42 }))).toBeNull();
  });
});

describe('useUpdateCheck', () => {
  it('stays false while the deployed version is the running one', async () => {
    const { result } = renderHook(() => useUpdateCheck(true, reply({ version: APP_VERSION })));
    await act(async () => {});
    expect(result.current).toBe(false);
  });

  it('turns true when a newer version is deployed, found by polling', async () => {
    vi.useFakeTimers();
    let deployed = APP_VERSION;
    const f = vi.fn(async () => ({ ok: true, json: async () => ({ version: deployed }) }) as Response) as unknown as typeof fetch;
    const { result } = renderHook(() => useUpdateCheck(true, f));
    await act(async () => { await vi.advanceTimersByTimeAsync(10); });
    expect(result.current).toBe(false);
    deployed = 'newer';
    await act(async () => { await vi.advanceTimersByTimeAsync(60_000); });
    expect(result.current).toBe(true);
  });

  it('checks again when the tab becomes visible', async () => {
    const f = reply({ version: 'newer' });
    renderHook(() => useUpdateCheck(true, f));
    await act(async () => {});
    const calls = vi.mocked(f).mock.calls.length;
    await act(async () => { document.dispatchEvent(new Event('visibilitychange')); });
    expect(vi.mocked(f).mock.calls.length).toBe(calls + 1);
  });

  it('does nothing when disabled (dev)', () => {
    const f = reply({ version: 'newer' });
    const { result } = renderHook(() => useUpdateCheck(false, f));
    expect(result.current).toBe(false);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('UpdateBanner', () => {
  it('reloads on click', () => {
    const onReload = vi.fn();
    render(<UpdateBanner onReload={onReload} />);
    fireEvent.click(screen.getByText('Opnieuw laden'));
    expect(onReload).toHaveBeenCalledOnce();
  });

  it('start page shows the banner only when an update is available, and the version', () => {
    const { rerender } = render(<StartPage touch={false} onFight={() => {}} />);
    expect(screen.queryByText('NIEUWE VERSIE!')).toBeNull();
    expect(screen.getByText(`v·${APP_VERSION}`)).toBeTruthy();
    rerender(<StartPage touch={false} onFight={() => {}} updateAvailable />);
    expect(screen.getByText('NIEUWE VERSIE!')).toBeTruthy();
  });
});
