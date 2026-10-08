/** Shown (outside the fight) when a newer version has been deployed. Reloading gets it:
 *  the service worker always fetches the newest page when online. */
export function UpdateBanner({ onReload = () => location.reload() }: { onReload?: () => void }) {
  return (
    <div className="sn-update" role="status">
      <b>NIEUWE VERSIE!</b>
      <button type="button" className="sn-btn small" onClick={onReload}>Opnieuw laden</button>
    </div>
  );
}
