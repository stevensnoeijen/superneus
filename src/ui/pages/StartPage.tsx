import { useEffect } from 'react';
import { Title } from '../components/Title';
import { ControlsHelp } from '../components/ControlsHelp';
import { UpdateBanner } from '../components/UpdateBanner';
import { GIT_SHA } from '../../app/useUpdateCheck';

// TEMP (issue #8): verifies Sentry error reporting + source maps. Revert this commit after.
function throwSentryTest(): never {
  throw new Error(`Sentry test error (${GIT_SHA})`);
}

/** Start page (#/): title, controls help and the FIGHT! button. */
export function StartPage({ touch, onFight, updateAvailable = false }: { touch: boolean; onFight(): void; updateAvailable?: boolean }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.code !== 'Enter' && e.code !== 'NumpadEnter' && e.code !== 'Space') return;
      e.preventDefault();
      if (!e.repeat) onFight();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onFight]);

  return (
    <div className="sn-modal sn-page">
      <div className="sn-card">
        <Title />
        <div className="sn-tagline">De Neus voor Onzin! Snuif de jargon-wolk weg!</div>
        <ControlsHelp touch={touch} />
        <button type="button" className="sn-btn" onClick={onFight}>FIGHT!</button>
        <div className="sn-hint stroke">of druk op ENTER / SPATIE</div>
      </div>
      {updateAvailable && <UpdateBanner />}
      <button type="button" className="sn-sentry-test" onClick={throwSentryTest}>TEST ERROR</button>
      <div className="sn-version">v·{GIT_SHA}</div>
    </div>
  );
}
