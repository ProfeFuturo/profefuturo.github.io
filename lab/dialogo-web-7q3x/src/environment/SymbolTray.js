import { SymbolPainter } from './SymbolPainter.js';
import { VisualSymbolHalo } from './VisualSymbolHalo.js';
import { Icons } from './Icons.js';

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD_PX = 6;

// La bandeja de símbolos (lo que en Cuis era la columna de dibujos más la fila de
// predefinidos): abajo en el celular, al costado en pantallas anchas. Primera fila: el
// lápiz para dibujar, los dibujos del usuario y los dos modos; segunda fila: los predefinidos.
// Cada símbolo se arrastra al tablero; un toque abre su halo.
export class SymbolTray {
  constructor(environment, container, dragController, { tileSize = 48 } = {}) {
    this.environment = environment;
    this.container = container;
    this.dragController = dragController;
    this.tileSize = tileSize;
    this.project = null;
    this.halo = null;
    this.build();
  }

  build() {
    this.element = document.createElement('div');
    this.element.className = 'tray';
    this.handle = document.createElement('button');
    this.handle.type = 'button';
    this.handle.className = 'tray-handle';
    this.handle.setAttribute('aria-label', 'Mostrar u ocultar la bandeja');
    this.handle.addEventListener('click', () => this.toggle());
    this.element.appendChild(this.handle);
    this.userRow = document.createElement('div');
    this.userRow.className = 'tray-row user-row';
    this.predefinedRow = document.createElement('div');
    this.predefinedRow.className = 'tray-row predefined-row';
    this.element.appendChild(this.userRow);
    this.element.appendChild(this.predefinedRow);
    this.container.appendChild(this.element);
  }

  toggle() { this.element.classList.toggle('collapsed'); }
  isCollapsed() { return this.element.classList.contains('collapsed'); }

  bind(project) {
    this.project = project;
    this.rebuild();
  }

  rebuild() {
    this.closeHalo();
    this.userRow.innerHTML = '';
    this.predefinedRow.innerHTML = '';
    if (this.project === null) return;
    const challenge = this.project.challenge || null;
    if (challenge === null || challenge.pencil) this.userRow.appendChild(this.drawButton());
    for (const symbol of this.project.drawingsMadeByUser()) this.userRow.appendChild(this.tileFor(symbol, 'user'));
    const spacer = document.createElement('div');
    spacer.className = 'tray-spacer';
    this.userRow.appendChild(spacer);
    if (challenge === null) this.userRow.appendChild(this.modeToggles());     // en un desafío los modos no se muestran
    for (const symbol of this.availableSymbols()) this.predefinedRow.appendChild(this.tileFor(symbol, 'predefined'));
    this.predefinedRow.hidden = this.predefinedRow.childElementCount === 0;
    this.userRow.hidden = this.userRow.childElementCount <= 1 && challenge !== null && !challenge.pencil && this.project.drawingsMadeByUser().length === 0;
    this.element.hidden = this.userRow.hidden && this.predefinedRow.hidden;      // sin nada que ofrecer, la bandeja no está
  }

  // En un desafío sólo los símbolos de ese desafío (revelación progresiva); si no, todos.
  availableSymbols() {
    const available = this.project.availableSymbols;
    if (!Array.isArray(available)) return this.project.predefinedSymbols;
    return this.project.predefinedSymbols.filter(symbol => available.includes(symbol.buildingSelector));
  }

  // Resalta la ficha de un símbolo (pista).
  highlight(symbolOrSelector) {
    this.clearHighlights();
    const tile = this.entries().find(tile => tile.symbolSelector === symbolOrSelector || (symbolOrSelector && symbolOrSelector.hash && tile.symbolHash === symbolOrSelector.hash));
    if (tile) tile.classList.add('hint');
    return tile || null;
  }

  highlightPencil() {
    this.clearHighlights();
    const pencil = this.element.querySelector('.symbol-tile.draw');
    if (pencil) pencil.classList.add('hint');
    return pencil || null;
  }

  clearHighlights() { for (const tile of this.element.querySelectorAll('.hint')) tile.classList.remove('hint'); }

  // El lápiz: dibujar un símbolo nuevo (la cruz de Cuis).
  drawButton() {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'symbol-tile draw new-symbol';
    button.title = this.environment.dictionaryAt('DrawNewSymbol');
    button.setAttribute('aria-label', button.title);
    button.appendChild(Icons.element('pencil', { size: 26 }));
    button.addEventListener('click', () => this.environment.paintNewSymbol());
    return button;
  }

  // Los dos modos de Cuis (arrojar/estampar, elementos/símbolos) como conmutadores de íconos.
  modeToggles() {
    const group = document.createElement('div');
    group.className = 'tray-modes';
    const project = this.project;
    group.appendChild(this.toggle2(
      ['drop', this.environment.dictionaryAt('putDropping'), () => project.switchToDropWhenDragging()],
      ['stamp', this.environment.dictionaryAt('putStamping'), () => project.switchToStampWhenDragging()],
      () => project.shouldStampWhenDragging() ? 1 : 0, 'stamp-switch'));
    group.appendChild(this.toggle2(
      ['element', this.environment.dictionaryAt('dropDrawingsAsElements'), () => project.switchToTreatDrawingsAsElements()],
      ['symbol', this.environment.dictionaryAt('dropDrawingsAsSymbols'), () => project.switchToTreatDrawingsAsSymbols()],
      () => project.shouldTreatDrawingsAsSymbols() ? 1 : 0, 'symbols-switch'));
    return group;
  }

  toggle2(first, second, selectedIndex, className) {
    const group = document.createElement('div');
    group.className = 'mode ' + className;
    group.setAttribute('role', 'radiogroup');
    const buttons = [first, second].map(([iconName, title, action], index) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.title = title;
      button.setAttribute('aria-label', title);
      button.setAttribute('role', 'radio');
      button.dataset.mode = iconName;
      button.appendChild(Icons.element(iconName, { size: 20 }));
      button.addEventListener('click', () => {
        this.environment.sounds.tap();
        action();
        buttons.forEach((each, i) => each.setAttribute('aria-checked', String(i === index)));
        this.rebuild();
        this.environment.projectChanged(this.project);
      });
      group.appendChild(button);
      return button;
    });
    buttons.forEach((each, i) => each.setAttribute('aria-checked', String(i === selectedIndex())));
    return group;
  }

  tileFor(symbol, kind) {
    const tile = document.createElement('div');
    tile.className = 'symbol-tile ' + kind + ' palette-entry' + (this.project.isPrivate(symbol) ? ' private' : '');
    tile.title = symbol.meaning() || (kind === 'user' ? 'Dibujo' : 'Símbolo');
    tile.setAttribute('aria-label', tile.title);
    tile.setAttribute('role', 'button');
    tile.tabIndex = 0;
    tile.symbolSelector = symbol.buildingSelector || null;
    tile.symbolHash = symbol.hash;
    const framed = symbol.isPredefined() || this.project.shouldTreatDrawingsAsSymbols();
    tile.appendChild(SymbolPainter.thumbnail(symbol, this.tileSize, { framed }));
    let pressTimer = null;
    tile.addEventListener('pointerdown', event => {
      if (event.pointerType === 'mouse' && event.button !== 0 && event.button !== 2) return;
      event.preventDefault();
      this.closeHalo();
      if (event.button === 2) { this.openHaloFor(symbol, tile); return; }
      const start = { x: event.clientX, y: event.clientY };
      let started = false;
      const move = moveEvent => {
        if (started || Math.hypot(moveEvent.clientX - start.x, moveEvent.clientY - start.y) < DRAG_THRESHOLD_PX) return;
        started = true;
        clearTimeout(pressTimer);
        cleanup();
        const board = this.project.boardModel;
        this.dragController.start(moveEvent, { symbol: symbol.copy(), framed, sizeInCells: 1 },
          { size: board.gridSize, keepAfterDrop: this.project.shouldStampWhenDragging() });
      };
      const cleanup = () => { window.removeEventListener('pointermove', move); window.removeEventListener('pointerup', up); window.removeEventListener('pointercancel', up); };
      const up = () => {
        clearTimeout(pressTimer);
        cleanup();
        if (!started) this.openHaloFor(symbol, tile);     // un toque: las acciones del símbolo
      };
      pressTimer = setTimeout(() => { cleanup(); this.openHaloFor(symbol, tile); }, LONG_PRESS_MS);
      window.addEventListener('pointermove', move);
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', up);
    });
    tile.addEventListener('contextmenu', event => event.preventDefault());
    return tile;
  }

  openHaloFor(symbol, tile) {
    this.closeHalo();
    const rect = tile.getBoundingClientRect();
    this.halo = new VisualSymbolHalo(symbol, this.environment, { left: rect.left, top: rect.top, width: rect.width, height: rect.height });
    if (this.halo.handles().length === 0) this.closeHalo();
  }

  closeHalo() {
    if (this.halo !== null) { const halo = this.halo; this.halo = null; halo.close(); }
  }

  entries() { return [...this.element.querySelectorAll('.symbol-tile.palette-entry')]; }
}
