import { Point } from './Point.js';

let nextItemId = 1;

// Un ítem puesto en el tablero: un VisualSymbol en una posición, considerado símbolo
// (parte de una oración, se dibuja enmarcado) o elemento (un "personaje" del mundo).
// Es modelo puro: la vista lo dibuja según su estado.
export class ItemOnBoard {
  constructor(visualSymbol, boardModel) {
    this.id = nextItemId++;
    this.visualSymbolAssociated = visualSymbol.copy();
    this.boardModel = boardModel;
    this.consideredSymbol = true;
    this.visible = true;
    this.direction = Point.ZERO;
    this.lastPulled = null;
    this.representingSymbol = null;
    this.sequenceOfElementsThatFailed = null;
    this.monitorOfSequenceThatFailed = null;
    this.errorMessageOfFail = null;
    this.highlightKind = null;       // null | 'error' | 'slow' | 'inspected'
    this.selectedByUser = false;
    this.errorBorder = false;        // dos símbolos en la misma celda
  }

  // Elige la subclase que corresponde al símbolo.
  static forSymbol(symbol, board) {
    const itemClass = itemClasses.find(each => each.isFor(symbol));
    return itemClass.withSymbol(symbol, board);
  }

  static withSymbol(symbol, board) {
    return new this(symbol, board);
  }

  static isFor() { throw new Error('subclassResponsibility'); }

  // --- estado símbolo / elemento ---

  consideredElement() { return !this.consideredSymbol; }
  isConsideredSymbol() { return this.consideredSymbol; }

  setConsideredSymbol(boolean) {
    this.consideredSymbol = boolean;
    this.changed();
  }

  becameSymbolByPredefinedDroppedNextToMe() {}
  invertSymbolicStateIfCanBeElement() {}
  invertBecameButtonWithoutEvaluating() {}

  refreshSymbolicCondition() {
    this.changed();
    this.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }

  // --- flags ---

  isAdjacentCell() { return false; }
  isButton() { return false; }
  isPoints() { return false; }
  isREPL() { return this.visualSymbolAssociated.isREPL(); }
  isRun() { return this.visualSymbolAssociated.isRun(); }
  isTeleport() { return this.visualSymbolAssociated.isTeleport(); }
  isPredefined() { return this.visualSymbolAssociated.isPredefined(); }
  isDrawing() { return this.visualSymbolAssociated.isDrawing(); }
  hasGlobalScope() { return false; }
  isMoving() { return !this.direction.isZero(); }

  // --- referencia ---

  representedBy(visualSymbol) { return this.visualSymbolAssociated.equals(visualSymbol) && this.consideredElement(); }
  representsSymbol(visualSymbol) { return this.visualSymbolAssociated.equals(visualSymbol) && this.consideredSymbol; }

  // Copia del símbolo que referencia a este ítem en particular.
  symbolRepresentingInParticular() {
    if (this.representingSymbol === null) {
      this.representingSymbol = this.visualSymbolAssociated.copy();
      this.representingSymbol.itemOnBoardReferenced = this;
    }
    return this.representingSymbol;
  }

  // --- tamaño y velocidad (redefinidos por DrawnItem y RunItem) ---

  gridResizeFactor() { return 1; }
  setGridResizeFactor() {}
  slowDownFactor() { return 1; }
  setSlowDownFactor() {}
  updateExtent() {}

  // --- movimiento ---

  bounceWith(movingElement) {
    const selfDirection = this.direction;
    this.direction = movingElement.direction;
    movingElement.direction = selfDirection;
  }

  randomBounceWithStaticObstacle() {
    const random = this.boardModel.random;
    const sign = () => [1, 0, -1][Math.floor(random() * 3)];
    if (this.direction.y === 0) { this.direction = Point.at(-this.direction.x, this.direction.x * sign()); return; }
    if (this.direction.x === 0) { this.direction = Point.at(this.direction.y * sign(), -this.direction.y); return; }
    this.direction = random() < 0.5
      ? Point.at(this.direction.x, -this.direction.y)
      : Point.at(-this.direction.x, this.direction.y);
  }

  comeToFront() { this.boardModel.bringToFront(this); }

  // --- copia ---

  copy() { return this.copyForBoard(this.boardModel); }

  copyForBoard(board) {
    const copy = this.constructor.withSymbol(this.visualSymbolAssociated.copy(), board);
    copy.consideredSymbol = this.consideredSymbol;
    return copy;
  }

  // --- resaltados ---

  highlightingByUserSelection() { this.selectedByUser = true; this.changed(); }
  stopHighlightingByUserSelection() { this.selectedByUser = false; this.changed(); }

  evaluatedWithError(error, sequence, monitor) {
    this.sequenceOfElementsThatFailed = sequence;
    this.monitorOfSequenceThatFailed = monitor;
    this.errorMessageOfFail = error.message;
    this.highlightKind = error.message === this.boardModel.timeoutErrorMessage() ? 'slow' : 'error';
    this.changed();
  }

  evaluatedWithTeleportErrorInSequence(sequence) {
    this.sequenceOfElementsThatFailed = sequence;
    this.errorMessageOfFail = 'Can Not Use Teleport Outside The Body Of A Substitution';
    this.highlightKind = 'error';
    this.changed();
  }

  hasErrorHighlight() { return this.sequenceOfElementsThatFailed !== null; }

  highlightErrorOnEvaluation() { this.highlightKind = 'error'; this.changed(); }

  highlightErrorOnEvaluationWithMessage(message) {
    this.errorMessageOfFail = message;
    this.highlightErrorOnEvaluation();
  }

  highlightSlowEvaluation() { this.highlightKind = 'slow'; this.changed(); }
  highlightInspected() { this.highlightKind = 'inspected'; this.changed(); }
  markInspected() { this.highlightInspected(); }

  removeErrorHighlight() {
    this.sequenceOfElementsThatFailed = null;
    this.monitorOfSequenceThatFailed = null;
    this.errorMessageOfFail = null;
    this.highlightKind = null;
    this.errorBorder = false;
    this.changed();
  }

  repaintBorderHighlightIfErrorSymbol() { this.errorBorder = true; this.changed(); }

  browseErrorOnSentenceThatFailed() {
    if (this.sequenceOfElementsThatFailed !== null) {
      this.boardModel.evaluateForTwoSecondsIfTimeoutOrInfiniteLoopOpenSubstitutionBrowserSentence(this.sequenceOfElementsThatFailed.asSentence());
    }
  }

  // --- visibilidad ---

  isVisible() { return this.visible; }
  makeInvisible() { this.visible = false; this.changed(); }
  makeVisible() { this.visible = true; this.changed(); }
  invertVisibility() { this.visible ? this.makeInvisible() : this.makeVisible(); }

  // --- REPL (redefinido por ItemThatCanBeElement) ---

  terminateProcessOfEvaluationOfREPL() {}

  // --- ayuda ---

  balloonText() {
    if (this.errorMessageOfFail !== null) return this.errorMessageOfFail;
    return this.visualSymbolAssociated.meaning();
  }

  asItemOnBoard() { return this; }

  changed() { this.boardModel.changed(); }

  toString() {
    return (this.consideredSymbol ? 'symbol ' : 'element ') + this.visualSymbolAssociated.toString() + '#' + this.id;
  }
}

// Subclases registradas en orden de prioridad (la genérica al final).
const itemClasses = [];
export function registerItemClass(itemClass) { itemClasses.push(itemClass); }
