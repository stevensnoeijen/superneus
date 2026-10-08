// Opt-in performance overlay: open the game with `?perf` (e.g. on a phone via the
// LAN URL from `npm run dev`). Shows startup timings and live frame stats.
// Zero cost when disabled: every function returns immediately.

export const perfEnabled = typeof location !== 'undefined' && new URLSearchParams(location.search).has('perf');

interface PerfReport {
  marks: [string, number][];        // label, ms since navigation start
  durations: [string, number][];    // label, ms spent
  fps: number;
  avgMs: number;
  p95Ms: number;
  worstMs: number;
  info: Record<string, string>;
}

const report: PerfReport = { marks: [], durations: [], fps: 0, avgMs: 0, p95Ms: 0, worstMs: 0, info: {} };
const frames = new Float32Array(240); // ring buffer of frame times (ms)
let frameCount = 0;
let panel: HTMLElement | null = null;
let lastPaint = 0;

/** Records a point in time (ms since navigation start). */
export function perfMark(label: string): void {
  if (perfEnabled) report.marks.push([label, performance.now()]);
}

/** Times a synchronous block. */
export function perfMeasure<T>(label: string, fn: () => T): T {
  if (!perfEnabled) return fn();
  const t0 = performance.now();
  const out = fn();
  report.durations.push([label, performance.now() - t0]);
  return out;
}

export function perfInfo(key: string, value: string): void {
  if (perfEnabled) report.info[key] = value;
}

/** Call once per rendered frame with the real frame time in ms. */
export function perfFrame(ms: number): void {
  if (!perfEnabled) return;
  if (frameCount === 0) perfMark('first frame');
  frames[frameCount++ % frames.length] = ms;
  const now = performance.now();
  if (now - lastPaint < 500) return;
  lastPaint = now;
  const n = Math.min(frameCount, frames.length);
  // slice() copies; typed-array sort() is numeric
  // oxlint-disable-next-line unicorn/no-array-sort -- sorts a fresh copy
  const sorted = frames.slice(0, n).sort();
  const sum = sorted.reduce((a, b) => a + b, 0);
  report.avgMs = sum / n;
  report.fps = 1000 / report.avgMs;
  report.p95Ms = sorted[Math.floor(n * 0.95)] ?? 0;
  report.worstMs = sorted[n - 1] ?? 0;
  paint();
}

const f = (v: number): string => v.toFixed(1).padStart(6);

function paint(): void {
  if (!panel) {
    panel = document.createElement('pre');
    panel.style.cssText = 'position:fixed;left:4px;bottom:4px;z-index:99999;margin:0;padding:6px 8px;'
      + 'font:11px/1.35 ui-monospace,monospace;color:#0f0;background:rgba(0,0,0,.72);pointer-events:none;'
      + 'white-space:pre;max-width:calc(100vw - 8px);overflow:hidden';
    document.body.appendChild(panel);
  }
  const lines = [
    `FPS ${report.fps.toFixed(0)}  frame avg${f(report.avgMs)}  p95${f(report.p95Ms)}  worst${f(report.worstMs)} ms`,
    ...Object.entries(report.info).map(([k, v]) => `${k}: ${v}`),
    '-- startup (ms since page start)',
    ...report.marks.map(([l, t]) => `${f(t)}  ${l}`),
    ...report.durations.map(([l, t]) => `${f(t)}  (took) ${l}`),
  ];
  panel.textContent = lines.join('\n');
}

// Exposed for automated measurement (headless runs read this).
if (perfEnabled) (window as unknown as { perfReport: PerfReport }).perfReport = report;
