import { Point } from './Point.js';

// El portapapeles de ítems (en Cuis eran variables de clase de BoardView: ClipboardOfElements,
// CopyCutClipboardOfElements, ...). La selección rectangular resalta ítems de un tablero;
// copiar los guarda; pegar los copia en otro lugar (o en otro tablero) manteniendo la forma
// del grupo respecto de su esquina superior izquierda.
export class ItemsClipboard {
  constructor() {
    this.selectionBoard = null;
    this.selection = null;        // Map ítem → posición (la selección resaltada)
    this.selectionTopLeft = null;
    this.copied = null;           // Map ítem → posición (lo copiado o cortado)
    this.copiedTopLeft = null;
  }

  // --- selección ---

  selectFromTo(boardModel, start, end) {
    const from = start.min(end);
    const to = start.max(end);
    this.selectionBoard = boardModel;
    this.selection = boardModel.selectItemsFromTo(from, to);
    this.selectionTopLeft = ItemsClipboard.topLeftOf(this.selection);
    return this.selectedItems();
  }

  selectAllOf(boardModel) {
    return this.selectFromTo(boardModel, Point.at(0, 0), Point.at(boardModel.columns, boardModel.rows));
  }

  static topLeftOf(positions) {
    let topLeft = null;
    for (const position of positions.values()) topLeft = topLeft === null ? position : topLeft.min(position);
    return topLeft;
  }

  hasSelection() { return this.selection !== null && this.selection.size > 0; }

  selectedItems() { return this.selection === null ? [] : [...this.selection.keys()]; }

  clearSelection() {
    this.selectionBoard = null;
    this.selection = null;
    this.selectionTopLeft = null;
  }

  // --- copiar, cortar, borrar ---

  copy() {
    if (!this.hasSelection()) return false;
    this.copied = new Map(this.selection);
    this.copiedTopLeft = this.selectionTopLeft;
    return true;
  }

  cut() {
    if (!this.copy()) return false;
    this.removeSelection();
    return true;
  }

  removeSelection() {
    if (this.selectionBoard === null) return;
    this.selectionBoard.removeHighlightedItems();
    this.selectionBoard.recordCurrentBoard();
    this.clearSelection();
  }

  hasSomethingToPaste() { return this.copied !== null && this.copied.size > 0; }

  // Pega copias de los ítems copiados con la esquina superior izquierda del grupo en la celda dada.
  pasteOn(boardModel, cell) {
    if (!this.hasSomethingToPaste()) return [];
    boardModel.deselectItems();
    const delta = cell.minus(this.copiedTopLeft);
    const pasted = [];
    let anySymbol = false;
    for (const [item, position] of this.copied) {
      const copy = item.copyForBoard(boardModel);
      boardModel.changePositionWithoutEvaluationsOf(copy, position.plus(delta));
      copy.updateExtent();
      boardModel.bringToFront(copy);
      anySymbol = anySymbol || copy.consideredSymbol;
      pasted.push(copy);
    }
    boardModel.refreshItems();
    if (anySymbol) boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
    boardModel.recordCurrentBoard();
    return pasted;
  }

  clear() {
    this.clearSelection();
    this.copied = null;
    this.copiedTopLeft = null;
  }
}

// El portapapeles compartido por todos los tableros de la aplicación.
ItemsClipboard.shared = new ItemsClipboard();
