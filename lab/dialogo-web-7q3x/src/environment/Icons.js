// El set de íconos de la interfaz (no del lenguaje): un solo trazo, 24x24, sin texto.
// También traduce los nombres de los íconos de halo de Cuis a íconos de este set.
const PATHS = {
  back: '<path d="M15 5l-7 7 7 7"/>',
  more: '<circle cx="5" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/><circle cx="19" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  plus: '<path d="M12 5v14M5 12h14"/>',
  x: '<path d="M6 6l12 12M18 6L6 18"/>',
  zoomIn: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M11 8v6M8 11h6"/>',
  zoomOut: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4M8 11h6"/>',
  undo: '<path d="M9 14l-4-4 4-4"/><path d="M5 10h9a5 5 0 0 1 0 10h-2"/>',
  save: '<path d="M12 4v11M7 10l5 5 5-5M4 19h16"/>',
  upload: '<path d="M12 15V4M7 9l5-5 5 5M4 19h16"/>',
  folder: '<path d="M3 7a2 2 0 0 1 2-2h4l2 2h8a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>',
  eye: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><circle cx="12" cy="12" r="3"/>',
  eyeOff: '<path d="M2 12s4-7 10-7 10 7 10 7-4 7-10 7S2 12 2 12z"/><path d="M4 4l16 16"/>',
  trash: '<path d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3"/>',
  swap: '<path d="M4 8h13l-3-3M20 16H7l3 3"/>',
  button: '<rect x="3" y="7" width="18" height="10" rx="5"/><circle cx="9" cy="12" r="2" fill="currentColor" stroke="none"/>',
  inspect: '<circle cx="11" cy="11" r="7"/><path d="M20 20l-4-4"/><circle cx="11" cy="11" r="2" fill="currentColor" stroke="none"/>',
  resize: '<path d="M4 20L20 4M14 4h6v6M10 20H4v-6"/>',
  sendBack: '<rect x="8" y="8" width="12" height="12" rx="2"/><path d="M4 16V6a2 2 0 0 1 2-2h10"/>',
  slow: '<path d="M4 15c2-4 5-5 8-5s5 1 8 4"/><circle cx="7" cy="16" r="2"/><circle cx="17" cy="16" r="2"/><path d="M12 10V7"/>',
  fast: '<path d="M3 12h10M3 8h6M3 16h6"/><path d="M13 12l5-5v10z" fill="currentColor" stroke="none"/>',
  allDirections: '<path d="M12 3v18M3 12h18M12 3l-3 3M12 3l3 3M12 21l-3-3M12 21l3-3M3 12l3-3M3 12l3 3M21 12l-3-3M21 12l-3 3"/>',
  rotateCw: '<path d="M20 12a8 8 0 1 1-3-6.2"/><path d="M20 4v5h-5"/>',
  rotateCcw: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/>',
  arrowUp: '<path d="M12 19V5M5 12l7-7 7 7"/>',
  arrowDown: '<path d="M12 5v14M5 12l7 7 7-7"/>',
  arrowLeft: '<path d="M19 12H5M12 5l-7 7 7 7"/>',
  arrowRight: '<path d="M5 12h14M12 5l7 7-7 7"/>',
  nowhere: '<circle cx="12" cy="12" r="8"/><path d="M6 6l12 12"/>',
  twoHeads: '<circle cx="8" cy="9" r="3"/><circle cx="16" cy="9" r="3"/><path d="M3 20a5 5 0 0 1 10 0M11 20a5 5 0 0 1 10 0"/>',
  oneHead: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/>',
  unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/>',
  play: '<path d="M7 5l12 7-12 7z" fill="currentColor" stroke="none"/>',
  pause: '<path d="M8 5v14M16 5v14"/>',
  space: '<path d="M4 12v4h16v-4"/>',
  drop: '<path d="M12 3v11M7 9l5 5 5-5"/><path d="M5 20h14"/>',
  stamp: '<path d="M9 13h6v-3a3 3 0 1 0-6 0z"/><path d="M5 17h14v3H5z"/>',
  symbol: '<rect x="4" y="4" width="16" height="16" rx="3"/><rect x="8.5" y="8.5" width="7" height="7" rx="1"/>',
  element: '<circle cx="12" cy="12" r="6"/>',
  pencil: '<path d="M4 20l4-1 11-11-3-3L5 16z"/><path d="M13 7l3 3"/>',
  copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
  share: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.3 10.8l7.4-4.6M8.3 13.2l7.4 4.6"/>',
  shareOff: '<circle cx="18" cy="5" r="2.5"/><circle cx="6" cy="12" r="2.5"/><circle cx="18" cy="19" r="2.5"/><path d="M8.3 10.8l7.4-4.6M8.3 13.2l7.4 4.6M3 3l18 18"/>',
  heart: '<path d="M12 20s-7-4.5-7-10a4 4 0 0 1 7-2.5A4 4 0 0 1 19 10c0 5.5-7 10-7 10z"/>',
  remix: '<path d="M4 12a8 8 0 0 1 14-5l2 2M20 4v5h-5M20 12a8 8 0 0 1-14 5l-2-2M4 20v-5h5"/>',
  home: '<path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6h-6v6H4a1 1 0 0 1-1-1z"/>',
  user: '<circle cx="12" cy="8" r="4"/><path d="M4 20a8 8 0 0 1 16 0"/>',
  medal: '<circle cx="12" cy="14" r="5"/><path d="M9 3l3 6 3-6M8 3h8"/>',
  trophy: '<path d="M8 4h8v5a4 4 0 0 1-8 0z"/><path d="M8 6H5a3 3 0 0 0 3 3M16 6h3a3 3 0 0 1-3 3M12 13v4M8 21h8M9 17h6"/>',
  book: '<path d="M4 5a2 2 0 0 1 2-2h12v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h6"/>',
  globe: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3a14 14 0 0 1 0 18M12 3a14 14 0 0 0 0 18"/>',
  sound: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M16 9a4 4 0 0 1 0 6M18.5 6.5a8 8 0 0 1 0 11"/>',
  soundOff: '<path d="M4 10v4h4l5 4V6L8 10z"/><path d="M17 9l4 6M21 9l-4 6"/>',
  chevronDown: '<path d="M6 9l6 6 6-6"/>',
  chevronUp: '<path d="M6 15l6-6 6 6"/>',
  check: '<path d="M5 12l5 5 9-10"/>',
  flag: '<path d="M5 21V4h11l-2 4 2 4H5"/>',
  reset: '<path d="M4 12a8 8 0 1 0 3-6.2"/><path d="M4 4v5h5"/><circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none"/>',
  eraser: '<path d="M4 15l9-9 6 6-6 6H8z"/><path d="M8 18h12"/>',
  bucket: '<path d="M5 11l7-7 7 7-7 7z"/><path d="M19 15c0 2-1.5 4-2 4s-2-2-2-4 2-3 2-3 2 1 2 3z" fill="currentColor" stroke="none"/>',
  brush: '<path d="M14 4l6 6-8 8-6-6z"/><path d="M6 12l-2 2a3 3 0 0 0 4 4l2-2"/>',
  sun: '<circle cx="12" cy="12" r="4"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/>',
  moon: '<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>',
};

// Los íconos de los halos de Cuis (HaloSpec.iconSymbol) en este set.
const FROM_HALO = {
  haloDismissIcon: 'trash', eyeIcon: 'eye', haloDragIcon: 'swap', haloBecameButton: 'button', haloDebugIcon: 'inspect',
  haloResizeIcon: 'resize', haloArrowDown: 'sendBack', haloSlowDown: 'slow', haloSpeedUp: 'fast', haloAllDirections: 'allDirections',
  haloClockwise: 'rotateCw', haloCounterClockwise: 'rotateCcw', haloArrowUp: 'arrowUp', haloNoDirection: 'nowhere',
  haloTwoHeads: 'twoHeads', haloOneHead: 'oneHead', haloLockIcon: 'lock', haloUnlockIcon: 'unlock',
  drawIcon: 'pencil', haloDuplicateIcon: 'copy', reuseIcon: 'share',
};

export class Icons {
  static has(name) { return PATHS[name] !== undefined; }

  static svg(name, { size = 24, className = '' } = {}) {
    const paths = PATHS[name] || PATHS.x;
    return '<svg class="icon ' + className + '" viewBox="0 0 24 24" width="' + size + '" height="' + size + '" aria-hidden="true">' + paths + '</svg>';
  }

  static element(name, options) {
    const template = document.createElement('template');
    template.innerHTML = Icons.svg(name, options);
    return template.content.firstElementChild;
  }

  static forHalo(iconSymbol) { return FROM_HALO[iconSymbol] || 'more'; }

  static names() { return Object.keys(PATHS); }
}
