/** K.O. screen with the winner and a rematch button. */
export function GameOverModal({ playerWon, onRestart, onMenu }: { playerWon: boolean; onRestart(): void; onMenu(): void }) {
  return (
    <div className="sn-modal over">
      <div className="sn-card">
        <div className="sn-ko">K.O.!</div>
        <div className={`sn-winner${playerWon ? '' : ' lose'}`}>
          {playerWon ? 'SUPERNEUS WINT!' : 'POTTERPIM WINT...'}
          <small>{playerWon ? 'De lucht is zuiver!' : 'Onzin regeert!'}</small>
        </div>
        <button type="button" className="sn-btn" onClick={onRestart}>NOG EEN KEER!</button>
        <button type="button" className="sn-btn small ghost" onClick={onMenu}>MENU</button>
        <div className="sn-hint stroke">ENTER / SPATIE / R</div>
      </div>
    </div>
  );
}
