/** Pause banner. The backdrop lets touches through, so the touch controls keep working. */
export function PauseOverlay({ onResume, onMenu }: { onResume(): void; onMenu(): void }) {
  return (
    <div className="sn-paused">
      <div className="sn-paused-card">
        <b>PAUZE</b>
        <button type="button" className="sn-btn small" onClick={onResume}>VERDER</button>
        <button type="button" className="sn-btn small ghost" onClick={onMenu}>MENU</button>
      </div>
    </div>
  );
}
