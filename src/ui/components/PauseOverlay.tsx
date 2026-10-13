import { ControlsHelp } from './ControlsHelp';
import { openFeedback } from '../../monitoring/sentry';

/** Pause banner with the controls help. The backdrop lets touches through, so the touch controls keep working. */
export function PauseOverlay({ touch = false, onResume, onMenu }: { touch?: boolean; onResume(): void; onMenu(): void }) {
  return (
    <div className="sn-paused">
      <div className="sn-paused-card">
        <b>PAUZE</b>
        <button type="button" className="sn-btn small" onClick={onResume}>VERDER</button>
        <button type="button" className="sn-btn small ghost" onClick={onMenu}>MENU</button>
        <div className="sn-paused-help"><ControlsHelp touch={touch} /></div>
      </div>
      <button type="button" className="sn-feedback" onClick={() => void openFeedback()}>FEEDBACK</button>
    </div>
  );
}
