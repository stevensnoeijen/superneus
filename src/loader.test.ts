// @vitest-environment jsdom
import { beforeEach, describe, expect, it, vi } from 'vitest';

beforeEach(() => {
  vi.resetModules();
  document.body.innerHTML = '<div id="loader"><div class="bar"><div class="fill"></div></div><div class="label"></div></div>';
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) => setTimeout(() => cb(0), 0));
});

describe('loading screen', () => {
  it('runs steps in order, shows labels and fills the bar', async () => {
    const { createLoader } = await import('./loader');
    const loader = createLoader(2);
    const order: string[] = [];
    expect(await loader.step('Eén', () => { order.push('a'); return 1; })).toBe(1);
    expect(document.querySelector<HTMLElement>('.fill')!.style.width).toBe('50%');
    await loader.step('Twee', async () => { order.push('b'); });
    expect(order).toEqual(['a', 'b']);
    expect(document.querySelector('.label')!.textContent).toBe('Twee');
    expect(document.querySelector<HTMLElement>('.fill')!.style.width).toBe('100%');
  });

  it('fades out and removes itself when finished', async () => {
    vi.useFakeTimers();
    const { createLoader } = await import('./loader');
    createLoader(1).finish();
    expect(document.getElementById('loader')!.classList.contains('done')).toBe(true);
    vi.advanceTimersByTime(700);
    expect(document.getElementById('loader')).toBeNull();
    vi.useRealTimers();
  });

  it('shows the error message when loading fails', async () => {
    const { createLoader } = await import('./loader');
    createLoader(1).fail(new Error('kapot'));
    expect(document.querySelector('.label')!.textContent).toContain('kapot');
  });
});
