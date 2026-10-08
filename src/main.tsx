import '@fontsource/luckiest-guy/latin-400.css';
import './ui/styles.css';
import { createRoot } from 'react-dom/client';
import { createEngine } from './engine/index';
import { createAudio } from './audio/index';
import { GameController } from './game/controller';
import { InputController } from './game/input';
import { ServicesContext } from './app/services';
import { App } from './app/App';
import { perfInfo, perfMark } from './perf';
import { createLoader } from './loader';
import { registerServiceWorker } from './app/useUpdateCheck';

async function boot(): Promise<void> {
  const stage = document.getElementById('game');
  const appRoot = document.getElementById('app');
  if (!stage || !appRoot) throw new Error('#game / #app container missing');
  perfMark('boot start');
  const loader = createLoader(3);
  // The title font is used by the menu, popups and Potterpim's flying words: load it first.
  await loader.step('Letters inkten…', () => document.fonts.load('40px "Luckiest Guy"').catch(() => []));
  const engine = await loader.step('Arena opbouwen…', () => createEngine(stage));
  perfMark('engine ready');
  await loader.step('Superneus en Potterpim tekenen…', () => engine.preloadFighters());
  perfMark('fighters ready');
  perfInfo('renderer', `${engine.app.renderer.name} @ ${engine.app.renderer.resolution}x (dpr ${window.devicePixelRatio})`);
  perfInfo('canvas', `${engine.app.canvas.width}x${engine.app.canvas.height} px`);

  const audio = createAudio();
  const input = new InputController();
  const game = new GameController(engine, audio, input);
  engine.app.ticker.stop(); // the game page starts it; the start page costs nothing

  // No <StrictMode>: its dev-only double mount would start (and announce) the fight twice.
  createRoot(appRoot).render(
    <ServicesContext.Provider value={{ audio, input, game }}>
      <App />
    </ServicesContext.Provider>,
  );
  loader.finish();
  perfMark('menu shown');
  registerServiceWorker();
}

void boot().catch((err: unknown) => {
  createLoader(1).fail(err);
  throw err;
});
