/** Small inline SVG icons used by the HUD. */

export function SuperneusBadge() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      <circle cx="32" cy="34" r="20" fill="#f2c9a0" stroke="#111" strokeWidth="3" />
      <path d="M12 30 Q32 20 52 30 L52 36 Q32 28 12 36Z" fill="#7b2fa8" stroke="#111" strokeWidth="2" />
      <circle cx="25" cy="35" r="2.5" fill="#111" />
      <circle cx="39" cy="35" r="2.5" fill="#111" />
      <path d="M32 36 Q42 44 34 47 Q30 46 31 44" fill="#f7b28a" stroke="#111" strokeWidth="2.5" />
      <path d="M25 51 Q32 55 39 51" fill="none" stroke="#111" strokeWidth="2.5" />
      <path d="M18 18 L46 18 L40 10 L24 10Z" fill="#ffc72c" stroke="#111" strokeWidth="2" />
    </svg>
  );
}

export function PotterpimBadge() {
  return (
    <svg viewBox="0 0 64 64" aria-hidden="true">
      {/* medium-long wavy black hair */}
      <path d="M12 40 Q8 14 32 11 Q56 14 52 40 L46 38 Q48 22 32 21 Q16 22 18 38Z" fill="#1f1a17" stroke="#111" strokeWidth="2" />
      <circle cx="32" cy="34" r="18" fill="#f2c9a0" stroke="#111" strokeWidth="3" />
      <path d="M15 38 Q16 58 32 60 Q48 58 49 38 Q44 46 32 46 Q20 46 15 38Z" fill="#1f1a17" stroke="#111" strokeWidth="2.5" />
      <g fill="#fff" stroke="#111" strokeWidth="2.5">
        <circle cx="25" cy="32" r="5.5" />
        <circle cx="39" cy="32" r="5.5" />
      </g>
      <path d="M30.5 32 L33.5 32" stroke="#111" strokeWidth="2.5" />
      <circle cx="25" cy="32" r="1.8" fill="#111" />
      <circle cx="39" cy="32" r="1.8" fill="#111" />
      <path d="M27 50 Q32 47 37 50" fill="none" stroke="#f2c9a0" strokeWidth="2.5" />
    </svg>
  );
}

/** Two ink bars in the starburst badge. */
export function PauseIcon() {
  return (
    <span className="sn-mute-burst">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <rect x="8" y="7" width="6" height="18" rx="1.5" fill="#fff" stroke="#111" strokeWidth="2.4" />
        <rect x="18" y="7" width="6" height="18" rx="1.5" fill="#fff" stroke="#111" strokeWidth="2.4" />
      </svg>
    </span>
  );
}

/** Comic speaker in a starburst: the waves swap for a pink X when muted (via .is-muted). */
export function MuteIcon() {
  return (
    <span className="sn-mute-burst">
      <svg viewBox="0 0 32 32" aria-hidden="true">
        <path d="M5 12h5l7-6v20l-7-6H5z" fill="#fff" stroke="#111" strokeWidth="2.4" strokeLinejoin="round" />
        <g className="waves" fill="none" stroke="#111" strokeWidth="2.4" strokeLinecap="round">
          <path d="M21 12.5q2.5 3.5 0 7" />
          <path d="M24.5 9.5q5 6.5 0 13" />
        </g>
        <g className="cross" stroke="#ff3d9a" strokeWidth="3.2" strokeLinecap="round">
          <path d="M21 12l7 8M28 12l-7 8" />
        </g>
      </svg>
    </span>
  );
}
