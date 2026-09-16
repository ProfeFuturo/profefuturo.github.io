import { Point } from '../board/Point.js';
import { SymbolPainter } from './SymbolPainter.js';
import { ItemHalo } from './ItemHalo.js';
import { ItemsClipboard } from '../board/ItemsClipboard.js';
import { ItemMotion } from './ItemMotion.js';

const LONG_PRESS_MS = 500;
const DRAG_THRESHOLD_PX = 6;

// La vista del tablero: un canvas que dibuja los ítems del BoardModel, recibe los
// arrastres (desde la bandeja o dentro del tablero), la selección rectangular con el botón
// derecho (o toque largo en un lugar vacío), el teclado, y abre las acciones de un ítem
// al tocarlo.
export class BoardView {
  constructor(environment, project, container, dragController, { clipboard = ItemsClipboard.shared } = {}) {
    this.environment = environment;
    this.project = project;
    this.boardModel = project.boardModel;
    this.container = container;
    this.dragController = dragController;
    this.clipboard = clipboard;
    this.canvas = document.createElement('canvas');
    this.canvas.className = 'board-canvas';
    this.canvas.tabIndex = 0;
    container.innerHTML = '';
    container.appendChild(this.canvas);
    this.context = this.canvas.getContext('2d');
    this.needsRedraw = true;
    this.pressed = null;
    this.selecting = null;
    this.halo = null;
    this.hintCell = null;
    this.slots = [];                 // celdas vacías por completar (desafíos), siempre visibles
    this.glowing = null;             // { items, until }: la regla que hizo funcionar algo, iluminada
    this.motion = new ItemMotion();
    this.lastPointerCell = Point.at(0, 0);
    this.boardModel.boardView = this;
    this.bindPointerEvents();
    dragController.addDropTarget({ element: this.canvas, dropAt: (x, y, payload) => this.dropAt(x, y, payload) });
    this.resize();
    this.animationLoop = () => { if (this.needsRedraw) { this.needsRedraw = false; this.draw(); } this.frame = requestAnimationFrame(this.animationLoop); };
    this.frame = requestAnimationFrame(this.animationLoop);
  }

  dispose() {
    cancelAnimationFrame(this.frame);
    this.closeHalo();
  }

  // --- protocolo que usa el modelo ---

  changed() { this.needsRedraw = true; if (this.halo !== null) this.halo.refresh(); }
  refreshItems() { this.resize(); this.needsRedraw = true; }
  gridSizeChanged() { this.resize(); this.needsRedraw = true; }
  boardRestored() { this.motion.reset(); this.needsRedraw = true; }
  informUsersOfMeThatIChanged() { this.environment.projectChanged(this.project); }
  boardRecorded() { if (typeof this.environment.boardRecorded === 'function') this.environment.boardRecorded(this.project); }
  addInspectorFrom(monitor) { this.environment.showInspector(monitor, this.project); }

  // --- geometría ---

  get gridSize() { return this.boardModel.gridSize; }

  resize() {
    const gridSize = this.gridSize;
    const columns = Math.ceil(Math.max(this.boardModel.columns * gridSize, this.container.clientWidth) / gridSize);
    const rows = Math.ceil(Math.max(this.boardModel.rows * gridSize, this.container.clientHeight) / gridSize);
    if (columns > this.boardModel.columns) this.boardModel.columns = columns;
    if (rows > this.boardModel.rows) this.boardModel.rows = rows;
    const pixelWidth = this.boardModel.columns * gridSize;
    const pixelHeight = this.boardModel.rows * gridSize;
    if (this.canvas.width !== pixelWidth || this.canvas.height !== pixelHeight) {
      this.canvas.width = pixelWidth;
      this.canvas.height = pixelHeight;
    }
    this.needsRedraw = true;
  }

  // Celda donde cae el centro del puntero, descontando medio ítem (el ítem se agarra por el centro).
  cellAt(clientX, clientY, itemSizeInCells = 1) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) / this.gridSize - itemSizeInCells / 2;
    const y = (clientY - rect.top) / this.gridSize - itemSizeInCells / 2;
    return Point.at(Math.round(x), Math.round(y));
  }

  cellUnder(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    return Point.at(Math.floor((clientX - rect.left) / this.gridSize), Math.floor((clientY - rect.top) / this.gridSize));
  }

  itemAt(clientX, clientY) {
    const point = this.cellUnder(clientX, clientY);
    for (const item of this.boardModel.itemsFrontFirst()) {
      if (!item.isVisible()) continue;
      const position = this.boardModel.positionOfIfAbsent(item, () => null);
      if (position !== null && this.boardModel.areaContains(item, position, point)) return item;
    }
    return null;
  }

  // Rectángulo del ítem en coordenadas de la página (para los halos).
  pageBoundsOf(item) {
    const position = this.boardModel.positionOfIfAbsent(item, () => null);
    if (position === null) return null;
    const rect = this.canvas.getBoundingClientRect();
    const size = this.gridSize * item.gridResizeFactor();
    return { left: rect.left + position.x * this.gridSize, top: rect.top + position.y * this.gridSize, width: size, height: size };
  }

  // --- dibujo ---

  draw() {
    const context = this.context;
    const gridSize = this.gridSize;
    context.fillStyle = 'white';                 // el tablero de Cuis es blanco liso, sin grilla
    context.fillRect(0, 0, this.canvas.width, this.canvas.height);
    for (const slot of this.slots) {
      if (this.boardModel.itemsInPosition(slot).length > 0) continue;
      context.save();
      context.lineWidth = 3;
      context.setLineDash([7, 6]);
      context.strokeStyle = 'rgba(16, 19, 24, 0.28)';
      SymbolPainter.roundedRect(context, slot.x * gridSize + 4, slot.y * gridSize + 4, gridSize - 8, gridSize - 8, gridSize * 0.2);
      context.stroke();
      context.restore();
    }
    const { placed, animating } = this.motion.update(this.boardModel.itemPositions);
    const items = this.boardModel.itemsFrontFirst().reverse();
    const glowing = this.glowing !== null && performance.now() < this.glowing.until ? this.glowing.items : null;
    if (this.glowing !== null && glowing === null) this.glowing = null;
    for (const item of items) {
      const where = placed.get(item);
      if (where === undefined) continue;
      if (this.pressed !== null && this.pressed.dragging && this.pressed.item === item) continue;
      if (glowing !== null && glowing.includes(item)) {
        const size = gridSize * item.gridResizeFactor();
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 120);
        context.save();
        context.shadowColor = 'rgba(255, 106, 0, ' + (0.6 + 0.4 * pulse).toFixed(2) + ')';
        context.shadowBlur = 18 + 10 * pulse;
        context.fillStyle = 'rgba(255, 106, 0, 0.001)';
        context.fillRect(where.x * gridSize, where.y * gridSize, size, size);
        context.restore();
      }
      SymbolPainter.paintItemScaled(context, item, where.x * gridSize, where.y * gridSize, gridSize, where.scale);
    }
    if (animating || glowing !== null) this.needsRedraw = true;
    if (this.hintCell !== null) {
      const pulse = 0.55 + 0.45 * Math.sin(performance.now() / 250);
      context.save();
      context.lineWidth = 4;
      context.setLineDash([8, 6]);
      context.strokeStyle = 'rgba(255, 106, 0, ' + pulse.toFixed(2) + ')';
      context.strokeRect(this.hintCell.x * gridSize + 3, this.hintCell.y * gridSize + 3, gridSize - 6, gridSize - 6);
      context.restore();
      this.needsRedraw = true;                  // sigue latiendo
    }
    if (this.selecting !== null && this.selecting.current !== null) {
      const from = this.selecting.start.min(this.selecting.current);
      const to = this.selecting.start.max(this.selecting.current);
      context.fillStyle = 'rgba(100, 160, 255, 0.2)';
      context.strokeStyle = 'rgba(60, 120, 255, 0.8)';
      context.fillRect(from.x * gridSize, from.y * gridSize, (to.x - from.x + 1) * gridSize, (to.y - from.y + 1) * gridSize);
      context.strokeRect(from.x * gridSize + 0.5, from.y * gridSize + 0.5, (to.x - from.x + 1) * gridSize, (to.y - from.y + 1) * gridSize);
    }
  }

  // La celda que señala una pista (null para sacarla).
  showHintCell(cell) { this.hintCell = cell; this.needsRedraw = true; }

  showSlots(cells) { this.slots = cells; this.needsRedraw = true; }

  // Ilumina unos ítems un rato (la regla que hizo funcionar algo).
  glow(items, ms = 1100) { this.glowing = { items, until: performance.now() + ms }; this.needsRedraw = true; }

  // El tamaño de celda con el que lo usado del tablero entra en el contenedor.
  gridSizeToFit({ minimum = 28, maximum = 72 } = {}) {
    const board = this.boardModel;
    let maxX = 0, maxY = 0;
    for (const [item, position] of board.itemPositions) {
      maxX = Math.max(maxX, position.x + item.gridResizeFactor());
      maxY = Math.max(maxY, position.y + item.gridResizeFactor());
    }
    if (maxX === 0 || this.container.clientWidth === 0) return board.gridSize;
    const fit = Math.floor(Math.min(this.container.clientWidth / (maxX + 0.5), this.container.clientHeight / (maxY + 0.5)));
    return Math.max(minimum, Math.min(maximum, fit));
  }

  // Imagen del tablero completo (para fullBoard.png).
  async fullBoardImageBytes() {
    const blob = await new Promise(resolve => this.canvas.toBlob(resolve, 'image/png'));
    return blob === null ? null : new Uint8Array(await blob.arrayBuffer());
  }

  // Miniatura del tablero (para la galería).
  previewCanvas(width = 602, height = 458) {
    const preview = document.createElement('canvas');
    preview.width = width;
    preview.height = height;
    const context = preview.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    const scale = Math.min(width / this.canvas.width, height / this.canvas.height, 1);
    context.drawImage(this.canvas, 0, 0, this.canvas.width * scale, this.canvas.height * scale);
    return preview;
  }

  // --- puntero ---

  bindPointerEvents() {
    this.canvas.addEventListener('pointerdown', event => this.pointerDown(event));
    this.canvas.addEventListener('pointermove', event => this.pointerMove(event));
    this.canvas.addEventListener('pointerup', event => this.pointerUp(event));
    this.canvas.addEventListener('pointercancel', () => { this.clearPressed(); this.selecting = null; });
    this.canvas.addEventListener('contextmenu', event => event.preventDefault());
    this.canvas.addEventListener('keydown', event => this.keyDown(event));
  }

  pointerDown(event) {
    this.canvas.focus({ preventScroll: true });
    this.closeHalo();
    const item = this.itemAt(event.clientX, event.clientY);
    if (event.button === 2) {
      if (item !== null) this.openHaloFor(item);
      else this.startSelection(this.cellUnder(event.clientX, event.clientY), event.pointerId);
      event.preventDefault();
      return;
    }
    if (item === null) {
      this.boardModel.deselectItems();
      this.pressed = { item: null, startX: event.clientX, startY: event.clientY, dragging: false, pointerId: event.pointerId };
      this.pressed.longPressTimer = setTimeout(() => {
        if (this.pressed !== null && this.pressed.item === null) { this.startSelection(this.cellUnder(event.clientX, event.clientY), event.pointerId); this.clearPressed(); }
      }, LONG_PRESS_MS);
      return;
    }
    if (item.isButton()) { item.buttonPressed(); return; }
    this.pressed = { item, startX: event.clientX, startY: event.clientY, dragging: false, pointerId: event.pointerId };
    this.pressed.longPressTimer = setTimeout(() => {
      if (this.pressed !== null && !this.pressed.dragging) { this.openHaloFor(item); this.clearPressed(); }
    }, LONG_PRESS_MS);
    event.preventDefault();
  }

  pointerMove(event) {
    this.lastPointerCell = this.cellUnder(event.clientX, event.clientY);
    if (this.selecting !== null) {
      this.selecting.current = this.lastPointerCell;
      this.needsRedraw = true;
      return;
    }
    if (this.pressed === null || this.pressed.dragging || this.pressed.item === null) return;
    const distance = Math.hypot(event.clientX - this.pressed.startX, event.clientY - this.pressed.startY);
    if (distance < DRAG_THRESHOLD_PX) return;
    clearTimeout(this.pressed.longPressTimer);
    const item = this.pressed.item;
    this.pressed.dragging = true;
    this.needsRedraw = true;
    const size = this.gridSize * item.gridResizeFactor();
    const thumbnail = document.createElement('canvas');
    thumbnail.width = size; thumbnail.height = size;
    SymbolPainter.paintItem(thumbnail.getContext('2d'), item, 0, 0, this.gridSize);
    this.dragController.start(event, { item, symbol: item.visualSymbolAssociated, framed: item.consideredSymbol, fromBoard: true, sizeInCells: item.gridResizeFactor() },
      { size, thumbnail, onDropOutside: () => this.droppedOutside(item) });
    this.pressed = null;
  }

  pointerUp(event) {
    if (this.selecting !== null) {
      this.finishSelection(this.cellUnder(event.clientX, event.clientY));
      return;
    }
    const pressed = this.pressed;
    this.clearPressed();
    // Un toque sobre un ítem (sin arrastrarlo) abre sus acciones.
    if (pressed !== null && pressed.item !== null && !pressed.dragging && !pressed.item.isButton()) this.openHaloFor(pressed.item);
  }

  clearPressed() {
    if (this.pressed !== null) clearTimeout(this.pressed.longPressTimer);
    this.pressed = null;
    this.needsRedraw = true;
  }

  // Un ítem del tablero o un símbolo de la paleta soltado sobre el tablero.
  dropAt(clientX, clientY, payload) {
    const cell = this.cellAt(clientX, clientY, payload.sizeInCells || 1);
    const source = payload.item || payload.symbol;
    const item = this.project.dropOnBoard(source, cell);
    this.needsRedraw = true;
    this.environment.projectChanged(this.project);
    if (typeof this.environment.symbolDropped === 'function') this.environment.symbolDropped(item);
    return true;
  }

  droppedOutside(item) {
    this.boardModel.removeItemReevaluatingIfNeeded(item);
    this.boardModel.recordCurrentBoard();
    this.needsRedraw = true;
  }

  // --- selección rectangular ---

  startSelection(cell, pointerId) {
    this.boardModel.deselectItems();
    this.selecting = { start: cell, current: null };
    if (pointerId !== undefined) { try { this.canvas.setPointerCapture(pointerId); } catch (error) { /* sin captura */ } }
    this.needsRedraw = true;
  }

  finishSelection(cell) {
    const start = this.selecting.start;
    this.selecting = null;
    this.needsRedraw = true;
    if (start.equals(cell)) return;
    this.selectItemsFromTo(start, cell);
  }

  selectItemsFromTo(start, end) {
    this.clipboard.selectFromTo(this.boardModel, start, end);
    this.needsRedraw = true;
  }

  selectAllItems() {
    this.clipboard.selectAllOf(this.boardModel);
    this.needsRedraw = true;
  }

  selectedItems() { return this.clipboard.selectedItems(); }

  copySelection() { return this.clipboard.copy(); }

  cutSelection() {
    const done = this.clipboard.cut();
    this.needsRedraw = true;
    return done;
  }

  removeSelection() {
    this.clipboard.removeSelection();
    this.needsRedraw = true;
  }

  // Pega las copias con la esquina superior izquierda del grupo en la celda dada.
  pasteAt(cell) {
    const pasted = this.clipboard.pasteOn(this.boardModel, cell);
    this.needsRedraw = true;
    return pasted;
  }

  // --- halo (manijas alrededor del ítem) ---

  openHaloFor(item) {
    this.closeHalo();
    this.halo = new ItemHalo(item, this);
  }

  closeHalo() {
    if (this.halo !== null) { const halo = this.halo; this.halo = null; halo.close(); }
  }

  // --- teclado ---

  keyDown(event) {
    const board = this.boardModel;
    const meta = event.metaKey || event.ctrlKey;
    if (meta) {
      const shortcuts = {
        z: () => board.backToPreviousBoardState(),
        s: () => { board.setCurrentAsResetBoard(); this.environment.flash(); },
        r: () => board.resetBoard(),
        a: () => this.selectAllItems(),
        c: () => this.copySelection(),
        x: () => this.cutSelection(),
        v: () => this.pasteAt(this.lastPointerCell),
        '+': () => board.zoomIn(), '=': () => board.zoomIn(), '-': () => board.zoomOut(),
      };
      const shortcut = shortcuts[event.key.toLowerCase()] || shortcuts[event.key];
      if (shortcut !== undefined) { shortcut(); event.preventDefault(); }
      return;
    }
    const actions = {
      ArrowUp: () => board.navigateUp(), ArrowDown: () => board.navigateDown(),
      ArrowLeft: () => board.navigateLeft(), ArrowRight: () => board.navigateRight(),
      w: () => board.wasdUp(), s: () => board.wasdDown(), a: () => board.wasdLeft(), d: () => board.wasdRight(),
      q: () => board.wasdUpLeft(), e: () => board.wasdUpRight(), z: () => board.wasdDownLeft(), c: () => board.wasdDownRight(),
      Enter: () => this.project.enterKeyPressed(), ' ': () => this.project.spaceBarPressed(),
      Delete: () => this.removeSelection(), Backspace: () => this.removeSelection(),
      '+': () => board.zoomIn(), '-': () => board.zoomOut(),
    };
    const action = actions[event.key] || actions[event.key.toLowerCase()];
    if (action === undefined) return;
    action();
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'w', 'a', 's', 'd', 'q', 'e', 'z', 'c'].includes(event.key)) board.recordCurrentBoard();
    event.preventDefault();
  }
}
