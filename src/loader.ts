// Drives the loading screen that index.html renders inline (so it shows before JS).
// main.ts runs each startup step through `step()`; the menu only appears after all
// assets (font, engine, fighter textures + skeletons) are ready.

const root = document.getElementById('loader');
const fill = root?.querySelector<HTMLElement>('.fill');
const label = root?.querySelector<HTMLElement>('.label');

/** Wait for the browser to paint, so progress updates are visible between heavy steps. */
const nextPaint = (): Promise<void> =>
  new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(() => resolve())));

export function createLoader(totalSteps: number) {
  let done = 0;
  return {
    /** Shows `text`, runs `work`, then advances the bar. */
    async step<T>(text: string, work: () => T | Promise<T>): Promise<T> {
      if (label) label.textContent = text;
      await nextPaint();
      const out = await work();
      done++;
      if (fill) fill.style.width = `${Math.round((done / totalSteps) * 100)}%`;
      return out;
    },
    finish(): void {
      if (!root) return;
      root.classList.add('done');
      root.addEventListener('transitionend', () => root.remove(), { once: true });
      setTimeout(() => root.remove(), 600); // in case transitions are disabled
    },
    fail(err: unknown): void {
      if (label) label.textContent = `Oeps! Laden mislukt: ${err instanceof Error ? err.message : String(err)}`;
    },
  };
}
