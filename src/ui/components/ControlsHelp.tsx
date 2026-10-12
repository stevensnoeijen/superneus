/** Controls help: the keyboard list on desktop, a preview of the on-screen buttons on touch. */
export function ControlsHelp({ touch }: { touch: boolean }) {
  return touch ? <TouchHelp /> : <KeyboardHelp />;
}

function KeyboardHelp() {
  return (
    <div className="sn-panel">
      <h3>Besturing</h3>
      <ul>
        <li><kbd>A</kbd><kbd>D</kbd> / <kbd>←</kbd><kbd>→</kbd> Lopen</li>
        <li><kbd>W</kbd> / <kbd>↑</kbd> Springen</li>
        <li><kbd>S</kbd> / <kbd>↓</kbd> Bukken</li>
        <li><kbd>J</kbd> Punch &nbsp;<kbd>K</kbd> Kick</li>
        <li><kbd>L</kbd> Special: SNUIF! (meter vol)</li>
        <li><kbd>I</kbd> Blokken</li>
      </ul>
    </div>
  );
}

function TouchHelp() {
  return (
    <div className="sn-panel">
      <h3>Besturing</h3>
      <div className="sn-preview" aria-label="Voorbeeld van de knoppen op je scherm">
        <div className="pv-screen">
          <div className="pv-dpad"><i className="u">▲</i><i className="l">◀</i><i className="r">▶</i><i className="d">▼</i></div>
          <div className="pv-acts"><i className="block">BLOK</i><i className="special">SNUIF</i><i className="punch">PUNCH</i><i className="kick">KICK</i></div>
        </div>
      </div>
      <ul className="pv-legend">
        <li><b>◀ ▶</b> lopen &nbsp;<b>▲</b> springen &nbsp;<b>▼</b> bukken</li>
        <li><b>BLOK</b> blokt aanvallen</li>
        <li><b>SNUIF</b> gloeit als je meter vol is</li>
      </ul>
    </div>
  );
}

/** Compact key legend shown in the corner during a desktop fight. */
export function KeysMini() {
  return (
    <ul className="sn-keys-mini" aria-label="Besturing">
      <li><kbd>WASD</kbd> / <kbd>←↑↓→</kbd> bewegen</li>
      <li><kbd>J</kbd> punch <kbd>K</kbd> kick</li>
      <li><kbd>L</kbd> SNUIF <kbd>I</kbd> blok</li>
      <li><kbd>P</kbd> pauze</li>
    </ul>
  );
}
