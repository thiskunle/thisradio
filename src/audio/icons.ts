/** Small line icons for the player. They take the text colour and are hidden from screen readers. */
const svg = (body: string) =>
  `<svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true" focusable="false" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${body}</svg>`;

export const icons = {
  play: svg('<path d="M7 4.5v15l12-7.5z" fill="currentColor" stroke="none"/>'),
  pause: svg('<rect x="6" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/><rect x="14" y="4.5" width="4" height="15" rx="1" fill="currentColor" stroke="none"/>'),
  stop: svg('<rect x="6" y="6" width="12" height="12" rx="1.5" fill="currentColor" stroke="none"/>'),
  prev: svg('<path d="M18 5v14L8 12z" fill="currentColor" stroke="none"/><path d="M6 5v14"/>'),
  next: svg('<path d="M6 5v14l10-7z" fill="currentColor" stroke="none"/><path d="M18 5v14"/>'),
  shuffle: svg('<path d="M16 4h4v4"/><path d="M4 20 20 4"/><path d="M20 16v4h-4"/><path d="m15 15 5 5"/><path d="m4 4 5 5"/>'),
  repeat: svg('<path d="m17 2 4 4-4 4"/><path d="M3 11V9a3 3 0 0 1 3-3h15"/><path d="m7 22-4-4 4-4"/><path d="M21 13v2a3 3 0 0 1-3 3H3"/>'),
  volume: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/><path d="M16.5 8.5a5 5 0 0 1 0 7"/><path d="M19 6a8.5 8.5 0 0 1 0 12"/>'),
  muted: svg('<path d="M4 9h4l5-4v14l-5-4H4z" fill="currentColor" stroke="none"/><path d="m17 9 5 6"/><path d="m22 9-5 6"/>'),
  minimize: svg('<path d="m6 9 6 6 6-6"/>'),
  external: svg('<path d="M14 4h6v6"/><path d="M10 14 20 4"/><path d="M19 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5"/>'),
  mic: svg('<rect x="9" y="3" width="6" height="11" rx="3"/><path d="M5 11a7 7 0 0 0 14 0"/><path d="M12 18v3"/>'),
};

/** Four bars that move while something plays (CSS animates them). */
export const waves = '<span class="waves" aria-hidden="true"><i></i><i></i><i></i><i></i></span>';
