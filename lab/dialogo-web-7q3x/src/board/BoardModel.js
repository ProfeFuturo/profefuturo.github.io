import { Sentence } from '../metamodel/Sentence.js';
import { isVisualSymbol, termEquals } from '../metamodel/Terms.js';
import { EvaluationMonitor, INFINITE_LOOP_ERROR_MESSAGE } from '../metamodel/EvaluationMonitor.js';
import { TIMEOUT_ERROR_MESSAGE } from '../metamodel/Interpreter.js';
import { StateOfArtBuilderForVisualEnvironment } from '../metamodel/StateOfArtBuilderForVisualEnvironment.js';
import { Point } from './Point.js';
import { ItemOnBoard } from './items.js';
import { SequenceOfElements } from './SequenceOfElements.js';
import { QueuedAdd, QueuedMoveBy, QueuedMoveTo, QueuedRemove, QueuedTeleport, QueuedUserCommand } from './QueuedAction.js';
import { UndoRecord, BaseUndoRecord } from './UndoRecord.js';
import { CollisionMonitor } from './CollisionMonitor.js';
import { NullBoardView } from './NullBoardView.js';

const ALL_EIGHT_ORIENTATIONS = [[0, -1], [1, 0], [0, 1], [-1, 0], [-1, -1], [1, -1], [-1, 1], [1, 1]].map(([x, y]) => Point.at(x, y));

// El tablero: ítems en celdas de una grilla, oraciones (filas de símbolos), y la
// simulación (movimientos, empujar/jalar/pared, colisiones, teleports, corridas).
// Todas las posiciones están en celdas; gridSize (píxeles) sólo lo usa la vista y el archivo.
export class BoardModel {
  constructor(interpreter, gridSize, { columns = 40, rows = 24, random = Math.random } = {}) {
    this.interpreter = interpreter;
    this.gridSize = gridSize;
    this.columns = columns;
    this.rows = rows;
    this.areaLocked = false;             // un desafío: el área de juego no crece con la pantalla (nadie se escapa por afuera)
    this.random = random;
    this.boardView = new NullBoardView();
    this.topicName = 'Board';
    this.itemPositions = new Map();      // item → Point
    this.zOrder = [];                    // ítems del frente al fondo
    this.highlightedItems = new Set();
    this.selfDriveSlowFactors = new Map();
    this.currentResizeFactors = new Map();
    this.evaluateOnNextStep = false;
    this.lastPositions = new Map();      // item → [Point] (más reciente primero)
    this.movableByArrowsMemo = null;
    this.movableByWASDMemo = null;
    this.setedRecord = null;
    this.symbolProvider = new StateOfArtBuilderForVisualEnvironment();
    this.initializeUndoHistory();
    this.clearDisplacementQueue();
    this.clearElementsViewedAtFront();
  }

  static withInterpreterAndGridSize(interpreter, gridSize, options) {
    return new BoardModel(interpreter, gridSize, options);
  }

  changed() { this.boardView.changed(); }

  // --- ítems ---

  items() { return this.zOrder.slice(); }
  itemsFrontFirst() { return this.zOrder.slice(); }
  positionsCopy() { return new Map(this.itemPositions); }

  bringToFront(item) {
    const index = this.zOrder.indexOf(item);
    if (index > 0) { this.zOrder.splice(index, 1); this.zOrder.unshift(item); this.changed(); }
  }

  sendToBack(item) {
    const index = this.zOrder.indexOf(item);
    if (index >= 0) { this.zOrder.splice(index, 1); this.zOrder.push(item); this.changed(); }
  }

  zIndexOf(item) { return this.zOrder.indexOf(item); }

  // Del fondo al frente (el orden en que se evalúan las colisiones).
  sortInverseAsShown(items) {
    return [...items].sort((first, second) => this.zOrder.indexOf(second) - this.zOrder.indexOf(first));
  }

  itemFrom(visualSymbolOrItem) {
    return visualSymbolOrItem instanceof ItemOnBoard ? visualSymbolOrItem : ItemOnBoard.forSymbol(visualSymbolOrItem, this);
  }

  addItemFrom(visualSymbolOrItem, position = this.bottomRightPosition()) {
    const item = this.itemFrom(visualSymbolOrItem);
    item.boardModel = this;
    this.changePositionWithoutEvaluationsOf(item, position);
    this.clearMemoizedMovableItems();
    return item;
  }

  addItemFromSymbol(symbol, position) {
    if (!isVisualSymbol(symbol)) throw new Error('Symbol should be visual');
    return this.addItemOnViewFrom(symbol, position);
  }

  addItemOnViewFrom(symbolOrItem, position) {
    const item = this.addItemFrom(symbolOrItem, position);
    item.updateExtent();
    this.bringToFront(item);
    return item;
  }

  performAddOf(item, position) { this.addItemOnViewFrom(item, position); }

  removeItem(item) {
    this.itemPositions.delete(item);
    const index = this.zOrder.indexOf(item);
    if (index >= 0) this.zOrder.splice(index, 1);
    this.highlightedItems.delete(item);
    this.clearMemoizedMovableItems();
    this.changed();
  }

  removeItemReevaluatingIfNeeded(item) {
    if (item === null || item === undefined) return;
    const wasSymbol = item.consideredSymbol;
    this.removeItem(item);
    this.refreshItems();
    if (wasSymbol) this.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }

  refreshItems() { this.boardView.refreshItems(); }
  refreshItemPosition() { this.changed(); }

  detectItemReferencedBy(visualSymbol) {
    return this.zOrder.find(item => item.visualSymbolAssociated.equals(visualSymbol)) || null;
  }

  includesOnBoard(visualSymbol) {
    return this.zOrder.some(item => item.visualSymbolAssociated.equals(visualSymbol));
  }

  // --- posiciones ---

  positionOf(item) {
    const position = this.itemPositions.get(item);
    if (position === undefined) throw new Error(this.itemNotFoundErrorMessage());
    return position;
  }

  positionOfIfAbsent(item, whenAbsent) {
    const position = this.itemPositions.get(item);
    return position === undefined ? whenAbsent() : position;
  }

  positionOfAlmostEquals(item, point) {
    const position = this.itemPositions.get(item);
    return position !== undefined && position.equals(point);
  }

  stillIsThePositionOf(originalPosition, item) {
    const position = this.itemPositions.get(item);
    return position !== undefined && position.equals(originalPosition);
  }

  itemNotFoundErrorMessage() { return 'item not found on board'; }

  normalizePositionToGrid(position) { return position.rounded(); }

  lockArea() { this.areaLocked = true; }

  changePositionWithoutEvaluationsOf(item, position) {
    let adapted = this.normalizePositionToGrid(position).max(Point.ZERO);
    if (this.areaLocked) adapted = Point.at(Math.min(adapted.x, this.columns - 1), Math.min(adapted.y, this.rows - 1));
    this.itemPositions.set(item, adapted);
    if (!this.zOrder.includes(item)) this.zOrder.unshift(item);
    this.ensureExtentUpTo(adapted);
    this.changed();
  }

  changePositionAndIfSymbolEvaluateAll(item, position) {
    this.changePositionWithoutEvaluationsOf(item, position);
    if (item.consideredSymbol) this.evaluateOnNextStep = true;
  }

  ensureExtentUpTo(position) {
    if (this.areaLocked) return;
    const factor = 1;
    if (position.x + factor > this.columns) this.columns = position.x + factor;
    if (position.y + factor > this.rows) this.rows = position.y + factor;
  }

  bottomRightPosition() { return Point.at(this.columns - 1, this.rows - 1); }
  areaRight() { return this.columns; }
  areaBottom() { return this.rows; }
  areaLeft() { return 0; }
  isInSimulatorArea(position) {
    return position.x >= 0 && position.y >= 0 && position.x < this.columns && position.y < this.rows;
  }
  areAllInSimulationArea(positions) { return positions.every(position => this.isInSimulatorArea(position)); }

  willBeInSimulationAreaIfPosition(item, futurePosition) {
    return this.areAllInSimulationArea(this.allPositionsOfIn(item, futurePosition));
  }

  // Todas las celdas que ocupa un ítem si su origen estuviera en `origin`.
  allPositionsOfIn(item, origin) {
    const factor = item.gridResizeFactor();
    const positions = [];
    for (let x = 0; x < factor; x++) for (let y = 0; y < factor; y++) positions.push(origin.plus(Point.at(x, y)));
    return positions;
  }

  allPositionsOf(item) {
    const position = this.itemPositions.get(item);
    return position === undefined ? [] : this.allPositionsOfIn(item, position);
  }

  areaContains(item, origin, point) {
    const factor = item.gridResizeFactor();
    return point.x >= origin.x && point.x < origin.x + factor && point.y >= origin.y && point.y < origin.y + factor;
  }

  positionToTheLeftOf(item) { return this.positionOf(item).plus(Point.at(1, 0)); }
  positionToTheRightOf(item) { return this.positionOf(item).minus(Point.at(1, 0)); }
  itemsToTheLeftOf(item) { return this.itemsInPosition(this.positionToTheLeftOf(item)); }
  itemsToTheRightOf(item) { return this.itemsInPosition(this.positionToTheRightOf(item)); }

  // --- ítems por posición ---

  itemsInPosition(position) {
    return this.zOrder.filter(item => this.positionOfAlmostEquals(item, position));
  }

  symbolsInPosition(position) {
    return this.zOrder.filter(item => item.consideredSymbol && this.positionOfAlmostEquals(item, position));
  }

  symbolicItemsOn(position) { return this.symbolsInPosition(position); }

  symbolAt(position) {
    for (const [item, itemPosition] of this.itemPositions) {
      if (itemPosition.equals(position) && item.consideredSymbol) return item;
    }
    return null;
  }

  symbolOrREPLAt(position) {
    for (const [item, itemPosition] of this.itemPositions) {
      if (itemPosition.equals(position) && (item.consideredSymbol || item.isREPL())) return item;
    }
    return null;
  }

  // Elementos (no símbolos) cuya área cubre la posición.
  elementsOn(position) {
    const elements = new Set();
    for (const [item, itemPosition] of this.itemPositions) {
      if (item.consideredElement() && this.areaContains(item, itemPosition, position)) elements.add(item);
    }
    return elements;
  }

  elementsInPositionExcept(position, excluded) {
    return this.zOrder.filter(item => item !== excluded && item.consideredElement()
      && this.allPositionsOf(item).some(each => each.equals(position)));
  }

  allElementsInAllPositions(positions) {
    const elements = [];
    for (const position of positions) {
      for (const item of this.zOrder) {
        if (item.consideredElement() && this.allPositionsOf(item).some(each => each.equals(position))) elements.push(item);
      }
    }
    return elements;
  }

  allElementsInSamePlaceOf(element, futureOrigin) {
    const elementsThere = new Set();
    for (const position of this.allPositionsOfIn(element, futureOrigin)) {
      for (const each of this.elementsInPositionExcept(position, element)) elementsThere.add(each);
    }
    return this.sortInverseAsShown(elementsThere);
  }

  elementsInTheSamePositionOf(element) {
    const origin = this.itemPositions.get(element);
    return origin === undefined ? [] : this.allElementsInSamePlaceOf(element, origin);
  }

  elementInPositionRepresentedBy(position, symbol) {
    return this.zOrder.find(item => item.representedBy(symbol) && this.positionOfAlmostEquals(item, position)) || null;
  }

  elementInAllPositionsRepresentedBy(positions, symbol) {
    return this.zOrder.find(item => item.representedBy(symbol)
      && positions.some(position => this.positionOfAlmostEquals(item, position))) || null;
  }

  // --- ítems por categoría ---

  elementsCategorizedBy(category) {
    return this.zOrder.filter(item =>
      (item.consideredElement() && this.interpreter.symbolIsCategorizedBy(item.visualSymbolAssociated, category))
      || (item.consideredSymbol && this.interpreter.symbolIsCategorizedBy('visualSymbol', category)));
  }

  replElements() { return this.elementsCategorizedBy('PrintIt'); }

  elementsRepresentedBy(symbol) {
    if (!isVisualSymbol(symbol)) return [];
    const referenced = symbol.itemOnBoardReferenced;
    if (referenced !== null && this.zOrder.includes(referenced) && referenced.consideredElement()) return [referenced];
    let elements = this.zOrder.filter(item => item.representedBy(symbol));
    if (elements.length === 0) elements = this.elementsCategorizedBy(symbol);
    return elements;
  }

  elementsLikeOrCategorizedBy(symbol) {
    if (!isVisualSymbol(symbol)) return [];
    const elements = new Set(this.zOrder.filter(item => item.representedBy(symbol)));
    for (const each of this.elementsCategorizedBy(symbol)) elements.add(each);
    return [...elements];
  }

  anyElementRepresentedBy(symbol) {
    const elements = this.elementsRepresentedBy(symbol);
    if (elements.length === 0) return null;
    return elements[Math.floor(this.random() * elements.length)];
  }

  closestElementToPositionRepresentedBy(position, symbol) {
    const elements = this.elementsRepresentedBy(symbol);
    if (elements.length === 0) return null;
    let closest = null;
    let closestDistance = Infinity;
    for (const element of elements) {
      const distance = position.dist(this.positionOfIfAbsent(element, () => Point.at(-100000000, 0)));
      if (distance < closestDistance) { closest = element; closestDistance = distance; }
    }
    return closest;
  }

  // --- oraciones (filas de símbolos consecutivos) ---

  consecutiveSymbolicSequencesInRows(includingREPLs = false) {
    const symbolAt = new Map();
    for (const [item, position] of this.itemPositions) {
      if (item.consideredSymbol || (includingREPLs && item.isREPL())) {
        if (!symbolAt.has(position.key())) symbolAt.set(position.key(), item);
      }
    }
    const sequences = [];
    let current = new SequenceOfElements();
    for (let row = 0; row < this.rows; row++) {
      for (let column = 0; column < this.columns; column++) {
        const found = symbolAt.get(column + '@' + row);
        if (found === undefined) {
          if (!current.isEmpty()) { sequences.push(current); current = new SequenceOfElements(); }
        } else {
          current.addLast(found);
        }
      }
      if (!current.isEmpty()) { sequences.push(current); current = new SequenceOfElements(); }
    }
    return sequences;
  }

  consecutiveSymbolicSequences() { return this.consecutiveSymbolicSequencesInRows(false); }
  consecutiveSymbolicOrREPLSequencesInRows() { return this.consecutiveSymbolicSequencesInRows(true); }

  sentencesOnBoardExcludingTeleportsWithoutCollisionAndREPLExpressions() {
    return this.consecutiveSymbolicOrREPLSequencesInRows().filter(sequence => {
      if (!this.assertHasNotREPL(sequence)) return false;
      if (!this.assertHasNotTeleportsWithoutCollision(sequence)) { sequence.evaluatedWithTeleportError(); return false; }
      return true;
    });
  }

  assertHasNotREPL(sequence) {
    return !sequence.anySatisfy(item => item.isREPL() && item.consideredElement());
  }

  assertHasNotTeleportsWithoutCollision(sequence) {
    const symbols = Sentence.from(sequence.symbolSequence());
    const teleportIndex = symbols.indexOf(this.symbolProvider.teleportSymbol());
    if (teleportIndex < 0) return true;
    const pointsIndex = symbols.indexOf(this.symbolProvider.pointsSymbol());
    if (pointsIndex < 0) return false;
    return pointsIndex < teleportIndex;
  }

  symbolicItemsToTheLeftOf(item) {
    const items = [];
    const position = this.itemPositions.get(item);
    if (position === undefined) return items;
    for (let column = position.x - 1; column >= 0; column--) {
      const found = this.symbolAt(Point.at(column, position.y));
      if (found === null) return items;
      items.push(found);
    }
    return items;
  }

  symbolicItemsToTheRightOf(item) {
    const items = [];
    const position = this.itemPositions.get(item);
    if (position === undefined) return items;
    for (let column = position.x + 1; column < this.columns; column++) {
      const found = this.symbolAt(Point.at(column, position.y));
      if (found === null) return items;
      items.push(found);
    }
    return items;
  }

  symbolicSequenceToTheLeftOf(item) {
    return this.symbolicItemsToTheLeftOf(item).reverse().map(each => each.visualSymbolAssociated);
  }

  symbolicSequenceAbove(item) {
    const items = [];
    const position = this.itemPositions.get(item);
    if (position === undefined) return items;
    for (let row = position.y - 1; row >= 0; row--) {
      const found = this.symbolAt(Point.at(position.x, row));
      if (found === null) break;
      items.push(found.visualSymbolAssociated);
    }
    return items.reverse();
  }

  sentenceToTheLeftOf(item) { return Sentence.from(this.symbolicSequenceToTheLeftOf(item)); }

  // --- evaluación de todo el tablero ---

  evaluateAllExpressionsAndReprintREPLS() {
    this.refreshItems();
    this.removeErrorPaintOnItems();
    this.evaluateAllSymbolicExpressionsOnBoard();
    this.markErrorWhenTwoSymbolsInTheSamePlace();
    this.restartREPLS();
    this.clearMemoizedMovableItems();
  }

  evaluateAllExpressionsAndReprintREPLSInformingUsers() {
    this.evaluateAllExpressionsAndReprintREPLS();
    this.boardView.informUsersOfMeThatIChanged();
  }

  evaluateAllSymbolicExpressionsOnBoard() {
    this.removePreviousRelations();
    this.resetActualTopicAsMyTopicName();
    this.evaluateTwiceAll(this.sentencesOnBoardExcludingTeleportsWithoutCollisionAndREPLExpressions());
    this.ensureActivatedInspectPoints();
  }

  defineCurrentTopicAs(topic) { this.interpreter.currentStateOfArt.actualTopicInConstruction = topic; }
  resetActualTopicAsMyTopicName() { this.defineCurrentTopicAs(this.topicName); }

  removePreviousRelations() { this.removePreviousRelationsOn(this.topicName); }

  removePreviousRelationsOn(topic) {
    const stateOfArt = this.interpreter.currentStateOfArt;
    for (const name of stateOfArt.categoryListAtTopic(topic)) stateOfArt.removeCategory(name);
    for (const denomination of stateOfArt.namesOfSubstitutionsAtTopic(topic)) stateOfArt.removeSubstitutionRelationForCategories(denomination);
  }

  evaluateTwiceAll(sequences) {
    this.evaluateOnceAll(sequences, () => {});
    this.evaluateOnceAll(sequences, (error, sequence, monitor) => sequence.evaluatedWithError(error, monitor));
  }

  evaluateOnceAll(sequences, onError) {
    for (const sequence of sequences) {
      const monitor = EvaluationMonitor.fast({ boardModel: this });
      try {
        this.interpreter.evaluateSentenceForTwoSecondsIfTimeoutRiseError(sequence.asSentence(), monitor);
      } catch (error) {
        onError(error, sequence, monitor);
      }
    }
  }

  markErrorWhenTwoSymbolsInTheSamePlace() {
    const seen = new Set();
    const duplicated = new Set();
    for (const [item, position] of this.itemPositions) {
      if (!item.consideredSymbol) continue;
      if (seen.has(position.key())) duplicated.add(position.key());
      seen.add(position.key());
    }
    if (duplicated.size === 0) return;
    for (const [item, position] of this.itemPositions) {
      if (item.consideredSymbol && duplicated.has(position.key())) {
        item.highlightErrorOnEvaluation();
        item.repaintBorderHighlightIfErrorSymbol();
      }
    }
  }

  removeErrorPaintOnItems() { for (const item of this.zOrder) item.removeErrorHighlight(); }

  clearMemoizedMovableItems() { this.movableByArrowsMemo = null; this.movableByWASDMemo = null; }

  // --- evaluación de oraciones ---

  evaluateSentence(sentence, monitor) { return this.interpreter.evaluateSentence(sentence, monitor); }

  existsASubstitutionThatAppliesTo(sentence) { return this.interpreter.existsASubstitutionThatAppliesTo(sentence); }

  evaluateSentenceForOneSecond(sentence, monitor) {
    return this.interpreter.evaluateSentenceWithin(sentence, monitor, 1000, () => sentence);
  }

  evaluateSentenceForTenSecondsIfTimeoutOpenSubstitutionBrowser(sentence, monitor) {
    const result = this.interpreter.evaluateSentenceWithin(sentence, monitor, 10000, () => { this.addInspectorFrom(monitor); return sentence; });
    monitor.ifShouldOpenInspectorAtEndOfEval(() => this.addInspectorFrom(monitor));
    return result;
  }

  evaluateCollisionSentence(sentence, monitor) {
    this.evaluateSentenceForTenSecondsIfTimeoutOpenSubstitutionBrowser(sentence, monitor);
    this.restartNotRunningREPLs();
  }

  evaluateForTwoSecondsIfTimeoutOrInfiniteLoopOpenSubstitutionBrowserSentence(sentence) {
    const monitor = new EvaluationMonitor({ inspecting: true, allowsChanges: true, detectsInfiniteLoops: true, boardModel: this });
    try {
      this.interpreter.evaluateSentenceWithin(sentence, monitor, 2000, () => sentence);
    } catch (error) {
      if (error.message !== INFINITE_LOOP_ERROR_MESSAGE) throw error;
    }
    this.addInspectorFrom(monitor);
  }

  addInspectorFrom(monitor) { this.boardView.addInspectorFrom(monitor); }
  timeoutErrorMessage() { return TIMEOUT_ERROR_MESSAGE; }

  // --- REPL ---

  restartREPLS() { for (const each of this.replElements()) each.restartOn(this); }
  restartNotRunningREPLs() { for (const each of this.replElements()) each.ifNotRunningRestartOn(this); }
  ifREPLEvaluateItsSentence(item) { if (this.replElements().includes(item)) item.restartOn(this); }
  terminateAllREPLEvaluations() {}
  terminateRunningProcess() {}

  addSymbolsNextTo(sentence, item, direction) {
    let position = this.positionOfIfAbsent(item, () => null);
    if (position === null) return;
    for (const symbol of sentence) {
      position = position.plus(direction);
      if (!isVisualSymbol(symbol)) continue;
      if (!this.isSymbolicItemReferencedByAlreadyAt(symbol, position)) {
        const added = this.addItemFromSymbol(symbol, position);
        added.setConsideredSymbol(true);
      }
    }
    this.refreshItems();
  }

  isSymbolicItemReferencedByAlreadyAt(symbol, position) {
    const there = this.symbolAt(position);
    return there !== null && there.visualSymbolAssociated.equals(symbol);
  }

  addSymbolsToTheRightOf(sentence, item) { this.addSymbolsNextTo(sentence, item, Point.at(1, 0)); }
  addSymbolsBelow(sentence, item) { this.addSymbolsNextTo(sentence, item, Point.at(0, 1)); }

  removeSymbolsNextTo(sentence, item, direction) {
    let position = this.positionOfIfAbsent(item, () => null);
    if (position === null) return;
    for (const symbol of sentence) {
      position = position.plus(direction);
      const toRemove = this.symbolsInPosition(position).filter(each => each.representsSymbol(symbol));
      if (toRemove.length === 0) { this.refreshItems(); return; }
      for (const each of toRemove) this.removeItem(each);
    }
    this.refreshItems();
  }

  removeSymbolsToTheRightOf(sentence, item) { this.removeSymbolsNextTo(sentence, item, Point.at(1, 0)); }
  removeSymbolsBelow(sentence, item) { this.removeSymbolsNextTo(sentence, item, Point.at(0, 1)); }

  // --- elementos movibles por el usuario ---

  itemsMovablesBy(keyboardSubsetName) {
    return this.zOrder.filter(item => {
      const sentence = Sentence.of(this.symbolRepresenting(item), 'movable', 'by', keyboardSubsetName);
      return this.existsASubstitutionThatAppliesTo(sentence)
        && this.evaluateSentenceForOneSecond(sentence, EvaluationMonitor.fast()).isWord('true');
    });
  }

  itemsMovableByArrows() {
    if (this.movableByArrowsMemo === null) this.movableByArrowsMemo = this.itemsMovablesBy('Arrows');
    return this.movableByArrowsMemo;
  }

  itemsMovableByWASD() {
    if (this.movableByWASDMemo === null) this.movableByWASDMemo = this.itemsMovablesBy('WASD');
    return this.movableByWASDMemo;
  }

  isControlledByUser(item) {
    return this.itemsMovableByArrows().includes(item) || this.itemsMovableByWASD().includes(item);
  }

  // --- orientaciones ---

  allEightOrientations() { return ALL_EIGHT_ORIENTATIONS.slice(); }
  upOrientation() { return Point.at(0, -1); }
  downOrientation() { return Point.at(0, 1); }
  leftOrientation() { return Point.at(-1, 0); }
  rightOrientation() { return Point.at(1, 0); }
  upLeftOrientation() { return Point.at(-1, -1); }
  upRightOrientation() { return Point.at(1, -1); }
  downLeftOrientation() { return Point.at(-1, 1); }
  downRightOrientation() { return Point.at(1, 1); }

  // --- movimiento por teclado ---

  orderFromLeftToRight(items) { return [...items].sort((a, b) => this.positionOf(a).x - this.positionOf(b).x); }
  orderFromRightToLeft(items) { return this.orderFromLeftToRight(items).reverse(); }
  orderFromUpToDown(items) { return [...items].sort((a, b) => this.positionOf(a).y - this.positionOf(b).y); }
  orderFromDownToUp(items) { return this.orderFromUpToDown(items).reverse(); }

  moveAll(items, orientation, ordering) {
    for (const item of ordering(items)) {
      this.whenPossibleMoveBy(item, orientation);
      item.comeToFront();
    }
  }

  navigateUp() { this.moveAll(this.itemsMovableByArrows(), this.upOrientation(), items => this.orderFromUpToDown(items)); }
  navigateDown() { this.moveAll(this.itemsMovableByArrows(), this.downOrientation(), items => this.orderFromDownToUp(items)); }
  navigateLeft() { this.moveAll(this.itemsMovableByArrows(), this.leftOrientation(), items => this.orderFromLeftToRight(items)); }
  navigateRight() { this.moveAll(this.itemsMovableByArrows(), this.rightOrientation(), items => this.orderFromRightToLeft(items)); }
  navigateUpLeft() { this.moveAll(this.itemsMovableByArrows(), this.upLeftOrientation(), items => this.orderFromUpToDown(items)); }
  navigateUpRight() { this.moveAll(this.itemsMovableByArrows(), this.upRightOrientation(), items => this.orderFromUpToDown(items)); }
  navigateDownLeft() { this.moveAll(this.itemsMovableByArrows(), this.downLeftOrientation(), items => this.orderFromDownToUp(items)); }
  navigateDownRight() { this.moveAll(this.itemsMovableByArrows(), this.downRightOrientation(), items => this.orderFromDownToUp(items)); }

  wasdUp() { this.moveAll(this.itemsMovableByWASD(), this.upOrientation(), items => this.orderFromUpToDown(items)); }
  wasdDown() { this.moveAll(this.itemsMovableByWASD(), this.downOrientation(), items => this.orderFromDownToUp(items)); }
  wasdLeft() { this.moveAll(this.itemsMovableByWASD(), this.leftOrientation(), items => this.orderFromLeftToRight(items)); }
  wasdRight() { this.moveAll(this.itemsMovableByWASD(), this.rightOrientation(), items => this.orderFromRightToLeft(items)); }
  wasdUpLeft() { this.moveAll(this.itemsMovableByWASD(), this.upLeftOrientation(), items => this.orderFromUpToDown(items)); }
  wasdUpRight() { this.moveAll(this.itemsMovableByWASD(), this.upRightOrientation(), items => this.orderFromUpToDown(items)); }
  wasdDownLeft() { this.moveAll(this.itemsMovableByWASD(), this.downLeftOrientation(), items => this.orderFromDownToUp(items)); }
  wasdDownRight() { this.moveAll(this.itemsMovableByWASD(), this.downRightOrientation(), items => this.orderFromDownToUp(items)); }

  whenPossibleMoveBy(item, orientation) {
    item.direction = orientation;
    this.enqueueManualMoveOf(item, orientation);
  }

  // --- colas y step ---

  clearDisplacementQueue() {
    this.movementsQueue = [];
    this.consequencesOfMovementsQueue = [];
    this.userCommandsQueue = [];
  }

  clearElementsViewedAtFront() { this.elementsMovedViewedAtFront = new Set(); }

  enqueueManualMoveOf(item, orientation) { this.movementsQueue.unshift(new QueuedMoveBy(item, orientation, this)); }
  enqueueAutoMoveOf(item, orientation) { this.movementsQueue.push(new QueuedMoveBy(item, orientation, this)); }
  enqueueMoveOf(item, position) { this.movementsQueue.push(new QueuedMoveTo(item, position, this)); }
  enqueueAddOf(item, position) { this.consequencesOfMovementsQueue.push(new QueuedAdd(item, position, this)); }
  enqueueRemoveOf(item, firstCandidate) { this.consequencesOfMovementsQueue.push(new QueuedRemove(item, firstCandidate, this)); }
  enqueueTeleportOf(item, position) { this.consequencesOfMovementsQueue.push(new QueuedTeleport(item, position, this)); }
  enqueueCommand(command) { this.userCommandsQueue.push(new QueuedUserCommand(command)); }

  makeAllActionsOn(queue) {
    const alreadyMovedOnce = new Set();
    for (const action of queue) {
      if (alreadyMovedOnce.has(action.element)) continue;
      if (action.perform() && !isVisualSymbol(action.element)) alreadyMovedOnce.add(action.element);
    }
    return alreadyMovedOnce;
  }

  makeAllEnqueuedActions() {
    this.clearElementsViewedAtFront();
    this.makeAllActionsOn(this.movementsQueue.slice());
    const movedByConsequence = this.makeAllActionsOn(this.consequencesOfMovementsQueue.slice());
    for (const each of movedByConsequence) this.viewAtFrontElementMovedByConsequence(each);
    this.makeAllActionsOn(this.userCommandsQueue.slice());
    this.clearDisplacementQueue();
  }

  step() {
    this.refreshRunningElementsOnBoard();
    this.makeAllEnqueuedActions();
    if (this.evaluateOnNextStep) {
      this.evaluateOnNextStep = false;
      this.evaluateAllExpressionsAndReprintREPLSInformingUsers();
    }
  }

  viewAtFrontElementMoved(item) {
    if (this.itemPositions.has(item)) { item.comeToFront(); this.elementsMovedViewedAtFront.add(item); }
  }

  viewAtFrontElementMovedByConsequence(item) {
    if (this.itemPositions.has(item)) {
      item.comeToFront();
      for (const each of this.elementsMovedViewedAtFront) this.viewAtFrontElementMoved(each);
    }
  }

  performTeleportOf(item, position) {
    if (!this.isInSimulatorArea(position)) return;
    this.changePositionWithoutEvaluationsOf(item, position);
    this.evaluateCollisionsWithElementsBeforeMovingOf(item, position);
    this.refreshItemPosition(item);
  }

  performRemoveOf(reference, firstCandidate) {
    this.removeElementDirectOrEvaluating(reference, firstCandidate);
  }

  // --- movimiento ---

  ifPossibleMoveBy(item, orientation) {
    if (orientation.isZero()) return false;
    const position = this.itemPositions.get(item);
    if (position === undefined) return false;
    return this.ifPossibleMoveTo(item, position.plus(orientation));
  }

  ifPossibleMoveTo(item, position) {
    const wasPossible = this.ifPossibleMoveToIgnoringPositionsToPull(item, position, new Set());
    if (wasPossible) this.recordLastPositionOf(item, position);
    return wasPossible;
  }

  ifPossibleMoveToIgnoringPositionsToPull(item, futurePosition, positionsToAvoidPulling) {
    const originalPosition = this.itemPositions.get(item);
    if (originalPosition === undefined) return false;
    const movingDirection = futurePosition.minus(originalPosition);
    const currentPositions = this.allPositionsOfIn(item, originalPosition);
    const allNewPositionsToTake = this.allPositionsOfIn(item, futurePosition)
      .filter(position => !currentPositions.some(each => each.equals(position)));
    if (!this.areAllInSimulationArea(allNewPositionsToTake)) return false;

    const nobodyInFuturePlace = this.allElementsInSamePlaceOf(item, futurePosition).length === 0;

    let teleported = false;
    this.evaluateCollisionsOf(item, originalPosition, futurePosition, () => { teleported = true; });
    if (teleported) return true;

    if (!this.areTransitable(allNewPositionsToTake, item)) return false;
    if (!this.canMoveIfNecessaryPushingOnAll(item, allNewPositionsToTake, movingDirection)) return false;

    if (!this.positionOfAlmostEquals(item, originalPosition)) return true;

    this.changePositionWithoutEvaluationsOf(item, originalPosition);
    this.changePositionAndIfSymbolEvaluateAll(item, futurePosition);

    if (nobodyInFuturePlace) this.evaluateCollisionsWithNoOneAfterHavingMoved(item);

    positionsToAvoidPulling.add(futurePosition.key());
    this.pullElementsBy(item, movingDirection, originalPosition, positionsToAvoidPulling);

    this.refreshItemPosition(item);
    this.viewAtFrontElementMoved(item);
    return true;
  }

  recordLastPositionOf(item, position) {
    if (!this.lastPositions.has(item)) this.lastPositions.set(item, []);
    this.lastPositions.get(item).unshift(position);
  }

  // --- colisiones ---

  collisionSymbol() { return this.symbolProvider.collisionSymbol(); }
  runSymbol() { return this.symbolProvider.runSymbol(); }

  evaluateCollisionsOf(item, originalPosition, futurePosition, whenTeleported) {
    if (this.evaluateCollisionsWithElementsBeforeMovingOf(item, futurePosition)) {
      if (!this.stillIsThePositionOf(originalPosition, item)) whenTeleported();
    }
  }

  evaluateCollisionsWithElementsBeforeMovingOf(item, positionOfCollision) {
    const allElementsThere = this.allElementsInSamePlaceOf(item, positionOfCollision);
    return this.evalCollisionOfWithAll(item, allElementsThere, positionOfCollision);
  }

  evalCollisionOfWithAll(elementArriving, allElementsInPosition, positionOfCollision) {
    let wasTeleportMade = false;
    for (const elementInPosition of allElementsInPosition) {
      let oneTeleportMade = this.evalCollisionOf(elementArriving, elementInPosition, positionOfCollision);
      wasTeleportMade = wasTeleportMade || oneTeleportMade;
      if (!oneTeleportMade) {
        oneTeleportMade = this.evalCollisionOf(elementInPosition, elementArriving, positionOfCollision);
        wasTeleportMade = wasTeleportMade || oneTeleportMade;
      }
    }
    return wasTeleportMade;
  }

  evalCollisionOf(elementArriving, elementInPosition, positionOfCollision) {
    const sentence = Sentence.of(elementArriving.symbolRepresentingInParticular(), this.collisionSymbol(), elementInPosition.symbolRepresentingInParticular());
    const monitor = CollisionMonitor.collisionOf(elementArriving, elementInPosition, positionOfCollision, this);
    if (this.existsASubstitutionThatAppliesTo(sentence)) this.evaluateCollisionSentence(sentence, monitor);
    return monitor.wasTeleportMade();
  }

  evalCollisionWithNoOneOf(elementArrived, positionOfCollision) {
    const sentence = Sentence.of(elementArrived.symbolRepresentingInParticular(), this.collisionSymbol());
    const monitor = CollisionMonitor.collisionOf(elementArrived, null, positionOfCollision, this);
    if (this.existsASubstitutionThatAppliesTo(sentence)) this.evaluateCollisionSentence(sentence, monitor);
    return monitor.wasTeleportMade();
  }

  evaluateCollisionsWithNoOneAfterHavingMoved(elementArrived) {
    const position = this.itemPositions.get(elementArrived);
    if (position === undefined) return;
    if (this.elementsInTheSamePositionOf(elementArrived).length === 0) this.evalCollisionWithNoOneOf(elementArrived, position);
  }

  evaluateCollisionsIfNotSymbol(item) {
    if (!item.consideredSymbol) this.evaluateCollisionsWithElementsBeforeMovingOf(item, this.positionOf(item));
  }

  // --- pared / empujar / jalar: preguntas al intérprete ---

  symbolRepresenting(item) {
    return item.consideredElement() ? item.symbolRepresentingInParticular() : 'visualSymbol';
  }

  elementsOnEachOfWhichRelativeTo(position, physicalRelation, item) {
    const result = [];
    for (const each of this.elementsOn(position)) {
      if (each === item) continue;
      const sentence = Sentence.of(each.symbolRepresentingInParticular(), physicalRelation, item.symbolRepresentingInParticular());
      if (!this.existsASubstitutionThatAppliesTo(sentence)) continue;
      const answer = this.evaluateSentenceForOneSecond(sentence, EvaluationMonitor.fast({ boardModel: this }));
      if (answer.isWord('true')) result.push(each);
    }
    return result;
  }

  symbolsOnEachOfWhichRelativeTo(position, physicalRelation, item) {
    const symbolicItems = this.symbolicItemsOn(position);
    if (symbolicItems.length === 0) return [];
    const sentence = Sentence.of('visualSymbol', physicalRelation, this.symbolRepresenting(item));
    const answer = this.evaluateSentenceForOneSecond(sentence, EvaluationMonitor.fast());
    return answer.isWord('true') ? symbolicItems : [];
  }

  itemsOnEachOfWhichRelativeTo(position, physicalRelation, item) {
    const items = new Set(this.elementsOnEachOfWhichRelativeTo(position, physicalRelation, item));
    for (const each of this.symbolsOnEachOfWhichRelativeTo(position, physicalRelation, item)) items.add(each);
    return [...items];
  }

  itemsOnAllEachOfWhichRelativeTo(positions, physicalRelation, item) {
    const items = new Set();
    for (const position of positions) {
      for (const each of this.itemsOnEachOfWhichRelativeTo(position, physicalRelation, item)) items.add(each);
    }
    return [...items];
  }

  impassableElementsOnFor(position, item) { return this.itemsOnEachOfWhichRelativeTo(position, 'isWallFor', item); }
  pushableElementsOnFor(position, item) { return this.itemsOnEachOfWhichRelativeTo(position, 'isPushableFor', item); }
  pushableElementsOnAllFor(positions, item) { return this.itemsOnAllEachOfWhichRelativeTo(positions, 'isPushableFor', item); }
  pullableElementsOnAllFor(positions, item) { return this.itemsOnAllEachOfWhichRelativeTo(positions, 'isPullableFor', item); }

  isTransitableFor(position, item) {
    const pushables = this.pushableElementsOnFor(position, item);
    return this.impassableElementsOnFor(position, item).every(each => pushables.includes(each));
  }

  areTransitable(positions, item) { return positions.every(position => this.isTransitableFor(position, item)); }

  canMoveIfNecessaryPushingOnAll(item, positions, movingDirection) {
    let canMove = true;
    for (const toPush of this.pushableElementsOnAllFor(positions, item)) {
      canMove = this.ifPossibleMoveBy(toPush, movingDirection) && canMove;
    }
    return canMove;
  }

  canMoveIfNecessaryPushingOnComingFrom(item, positionToPush, positionOfThePusher) {
    const pushables = this.pushableElementsOnFor(positionToPush, item);
    if (pushables.length === 0) return true;
    return this.ifPossibleMoveBy(pushables[0], positionToPush.minus(positionOfThePusher));
  }

  // --- jalar ---

  allPositionsLeftBehindBy(puller, originalPosition) {
    const current = this.allPositionsOf(puller);
    return this.allPositionsOfIn(puller, originalPosition).filter(position => !current.some(each => each.equals(position)));
  }

  pullElementsBy(puller, pullingDirection, originalPositionOfPuller, positionsAlreadyPulledOrMoved) {
    const allVacantPositions = this.allPositionsLeftBehindBy(puller, originalPositionOfPuller);
    const lastPulledPosition = puller.lastPulled === null ? undefined : this.itemPositions.get(puller.lastPulled);
    const lastPulledOrientation = originalPositionOfPuller.minus(lastPulledPosition === undefined ? originalPositionOfPuller : lastPulledPosition);
    const isAnOrientation = ALL_EIGHT_ORIENTATIONS.some(each => each.equals(lastPulledOrientation));
    const orientationsToTry = isAnOrientation
      ? [lastPulledOrientation, pullingDirection, ...ALL_EIGHT_ORIENTATIONS]
      : [pullingDirection, ...ALL_EIGHT_ORIENTATIONS];
    for (const orientation of orientationsToTry) {
      const positionsToPull = allVacantPositions
        .map(position => position.minus(orientation))
        .filter(position => !positionsAlreadyPulledOrMoved.has(position.key()));
      const pullables = this.pullableElementsOnAllFor(positionsToPull, puller);
      if (pullables.length > 0) {
        const vacantPositionToTake = this.detectVacantFrom(allVacantPositions, pullingDirection, originalPositionOfPuller);
        const toPull = this.detectLastPulledOrBestSizeMatchWith(pullables, puller);
        this.pullBy(toPull, puller, pullingDirection, vacantPositionToTake, positionsAlreadyPulledOrMoved);
        return;
      }
    }
  }

  detectVacantFrom(vacantPositions, pullingDirection, originalPositionOfPuller) {
    const pullingBackwards = pullingDirection.x < 0 || pullingDirection.y < 0;
    let best = vacantPositions[0];
    for (const each of vacantPositions) {
      const better = pullingBackwards
        ? each.dist(originalPositionOfPuller) > best.dist(originalPositionOfPuller)
        : each.dist(originalPositionOfPuller) < best.dist(originalPositionOfPuller);
      if (better) best = each;
    }
    return best;
  }

  detectLastPulledOrBestSizeMatchWith(pullables, puller) {
    const last = pullables.find(each => each === puller.lastPulled);
    if (last !== undefined) return last;
    let best = pullables[0];
    for (const each of pullables) {
      if (Math.abs(each.gridResizeFactor() - puller.gridResizeFactor()) < Math.abs(best.gridResizeFactor() - puller.gridResizeFactor())) best = each;
    }
    return best;
  }

  pullBy(pulled, puller, pullingDirection, vacantPositionToTake, positionsAlreadyPulledOrMoved) {
    positionsAlreadyPulledOrMoved.add(this.positionOf(pulled).key());
    const destiny = this.destinyPositionForNotOverlappingWith(pulled, puller, vacantPositionToTake, pullingDirection);
    const wasPulled = this.ifPossibleMoveToIgnoringPositionsToPull(pulled, destiny, positionsAlreadyPulledOrMoved);
    if (wasPulled) puller.lastPulled = pulled;
  }

  destinyPositionForNotOverlappingWith(pulled, puller, vacantPositionToTake, pullingDirection) {
    const pullerPositions = this.allPositionsOf(puller);
    let destiny = vacantPositionToTake;
    let futurePulledPositions = this.allPositionsOfIn(pulled, destiny);
    while (pullerPositions.some(each => futurePulledPositions.some(other => other.equals(each)))
      && this.isInSimulatorArea(destiny.minus(pullingDirection))) {
      destiny = destiny.minus(pullingDirection);
      futurePulledPositions = this.allPositionsOfIn(pulled, destiny);
    }
    return destiny;
  }

  // --- correr ---

  refreshRunningElementsOnBoard() {
    for (const element of this.zOrder.slice()) {
      if (!element.consideredElement()) continue;
      const sentence = Sentence.of(this.symbolRepresenting(element), 'self', 'drive', 'action');
      if (!this.existsASubstitutionThatAppliesTo(sentence)) continue;
      const result = this.evaluateSentenceForOneSecond(sentence, EvaluationMonitor.inspector());
      this.runWithIndications(element, result);
    }
  }

  runWithIndications(element, indications) {
    if (indications.length < 2) return;
    const runSymbol = indications[0];
    if (!isVisualSymbol(runSymbol) || !runSymbol.isRun()) return;
    const position = this.itemPositions.get(element);
    if (position === undefined) return;
    const destinySymbol = indications[1];
    const runItem = runSymbol.itemOnBoardReferenced;
    const slowFactor = runItem === null ? 1 : runItem.slowDownFactor();
    if (this.doesElementHaveToWaitToDrive(element, slowFactor)) return;
    if (destinySymbol === 'freely') return this.runWithoutDestiny(element);
    if (isVisualSymbol(destinySymbol) && destinySymbol.isAdjacentCell() && destinySymbol.itemOnBoardReferenced !== null) {
      return this.enqueueAutoMoveOf(element, destinySymbol.itemOnBoardReferenced.adjacentDirection());
    }
    const destinyElement = this.closestElementToPositionRepresentedBy(position, destinySymbol);
    if (destinyElement === null) return;
    this.runTowards(element, destinyElement);
  }

  doesElementHaveToWaitToDrive(element, slowFactor) {
    if (slowFactor === 1) return false;
    const waited = this.selfDriveSlowFactors.get(element);
    if (waited === undefined) { this.selfDriveSlowFactors.set(element, 1); return true; }
    if (waited >= slowFactor) { this.selfDriveSlowFactors.set(element, 1); return false; }
    this.selfDriveSlowFactors.set(element, waited + 1);
    return true;
  }

  runTowards(element, destinyElement) {
    element.setDestinyIfChanged(destinyElement, () => this.lastPositions.delete(element));
    const currentPosition = this.itemPositions.get(element);
    const destinyPosition = this.itemPositions.get(destinyElement);
    if (currentPosition === undefined || destinyPosition === undefined) return;
    if (currentPosition.equals(destinyPosition)) this.enqueueMoveOf(element, currentPosition);
    else this.runFromToContemplatingDirections(element, currentPosition, destinyPosition, this.allEightOrientations());
  }

  runFromToContemplatingDirections(element, currentPosition, destinyPosition, possibleDirections) {
    const sorted = this.sortByBestApproachTo(possibleDirections, destinyPosition, currentPosition);
    const notRepeated = this.directionsThatDoNotRepeatLastPositionsOf(sorted, element, currentPosition);
    const reverseDirection = element.direction.negated();
    const towardsDestiny = this.selectDirectionsThatApproach(notRepeated, destinyPosition, currentPosition, reverseDirection);
    const awayDestiny = notRepeated.filter(each => !towardsDestiny.includes(each));
    const restButReverse = sorted.filter(each => !each.equals(reverseDirection) && !notRepeated.includes(each));
    for (const direction of [...towardsDestiny, ...awayDestiny, ...restButReverse, reverseDirection]) {
      this.enqueueAutoMoveOf(element, direction);
    }
  }

  sortByBestApproachTo(directions, destinyPosition, currentPosition) {
    return [...directions].sort((a, b) => currentPosition.plus(a).dist(destinyPosition) - currentPosition.plus(b).dist(destinyPosition));
  }

  directionsThatDoNotRepeatLastPositionsOf(directions, element, currentPosition) {
    const last = this.lastPositions.get(element);
    if (last === undefined) return directions;
    const recent = last.slice(0, 20);
    return directions.filter(direction => !recent.some(each => each.equals(currentPosition.plus(direction))));
  }

  selectDirectionsThatApproach(directions, destinyPosition, currentPosition, reverseDirection) {
    return directions
      .filter(direction => currentPosition.dist(destinyPosition) > currentPosition.plus(direction).dist(destinyPosition))
      .filter(direction => !direction.equals(reverseDirection));
  }

  canMoveDirectlyIn(element, direction) {
    const currentPosition = this.itemPositions.get(element);
    if (currentPosition === undefined) return false;
    const futurePosition = currentPosition.plus(direction);
    return this.willBeInSimulationAreaIfPosition(element, futurePosition)
      && this.impassableElementsOnFor(futurePosition, element).length === 0;
  }

  runWithoutDestiny(element) {
    if (this.isControlledByUser(element)) return this.enqueueAutoMoveOf(element, element.direction);
    const currentDirection = element.direction;
    if (!currentDirection.isZero() && this.canMoveDirectlyIn(element, currentDirection)) {
      return this.enqueueAutoMoveOf(element, currentDirection);
    }
    const possibleDirections = this.shuffled(this.allEightOrientations());
    if (!currentDirection.isZero()) {
      this.ifObstacleChangeDirectionOf(element);
      if (this.canMoveDirectlyIn(element, currentDirection)) {
        const index = possibleDirections.findIndex(each => each.equals(currentDirection));
        if (index >= 0) possibleDirections.splice(index, 1);
        possibleDirections.unshift(currentDirection);
      }
    }
    for (const direction of possibleDirections) {
      if (this.canMoveDirectlyIn(element, direction)) return this.enqueueAutoMoveOf(element, direction);
    }
    for (const direction of possibleDirections) this.enqueueAutoMoveOf(element, direction);
  }

  shuffled(array) {
    const copy = array.slice();
    for (let index = copy.length - 1; index > 0; index--) {
      const other = Math.floor(this.random() * (index + 1));
      [copy[index], copy[other]] = [copy[other], copy[index]];
    }
    return copy;
  }

  ifObstacleChangeDirectionOf(element) {
    const actualPosition = this.itemPositions.get(element);
    if (actualPosition === undefined) return;
    const futurePosition = actualPosition.plus(element.direction);
    if (this.somethingStaticForToBounceInPosition(element, futurePosition)) {
      this.canMoveIfNecessaryPushingOnComingFrom(element, futurePosition, actualPosition);
      return element.randomBounceWithStaticObstacle();
    }
    const obstacles = this.impassableElementsOnFor(futurePosition, element);
    if (obstacles.length === 0) return;
    const withDirection = obstacles.filter(each => !each.direction.isZero());
    if (withDirection.length === 0) return element.randomBounceWithStaticObstacle();
    for (const moving of withDirection) moving.bounceWith(element);
  }

  somethingStaticForToBounceInPosition(element, futurePosition) {
    return !this.willBeInSimulationAreaIfPosition(element, futurePosition)
      || this.pushableElementsOnFor(futurePosition, element).length > 0;
  }

  // --- teleport ---

  isReferencedBy(element, symbol) {
    return symbol !== null && symbol !== undefined && element !== null && element !== undefined
      && isVisualSymbol(symbol) && symbol.equals(element.visualSymbolAssociated);
  }

  isAValidSymbolToTeleportee(reference) {
    return isVisualSymbol(reference) && (reference.isDrawing() || reference.isAdjacentCell() || reference.isREPL());
  }

  // Si la referencia no es un símbolo del tablero, se evalúa como oración: si da un solo
  // símbolo, ése es el referido.
  concreteSymbolOfElementIndirectlyReferencedBy(reference) {
    const result = this.evaluateSentenceForOneSecond(Sentence.from(reference), EvaluationMonitor.fast());
    return result.length === 1 ? result[0] : null;
  }

  elementDirectOrIndirectlyReferencedBy(reference) {
    const concrete = this.concreteSymbolOfElementIndirectlyReferencedBy(reference);
    return this.anyElementRepresentedBy(concrete === null ? reference : concrete);
  }

  newAbsentOrRandomItemCategorizedBy(category) {
    let possibleSymbols = this.interpreter.symbolsCategorizedBy(category).toArray().filter(isVisualSymbol);
    const absents = possibleSymbols.filter(symbol =>
      !this.zOrder.some(item => item.consideredElement() && item.visualSymbolAssociated.equals(symbol)));
    if (absents.length > 0) possibleSymbols = absents;
    if (possibleSymbols.length === 0) return null;
    const chosen = possibleSymbols[Math.floor(this.random() * possibleSymbols.length)];
    return ItemOnBoard.forSymbol(chosen, this);
  }

  asItemIfAdjacentCellSymbol(reference, whenAdjacentCell) {
    if (isVisualSymbol(reference) && reference.isAdjacentCell()) return whenAdjacentCell();
    return this.newAbsentOrRandomItemCategorizedBy(reference);
  }

  detectTeleporteeDirect(reference, elementArriving, collisionPosition) {
    if (this.isReferencedBy(elementArriving, reference)) return elementArriving;
    return this.elementInAllPositionsRepresentedBy(this.allPositionsOfIn(elementArriving, collisionPosition), reference);
  }

  detectAdjacentTeleportee(symbolOfDestiny, collisionPosition) {
    if (!isVisualSymbol(symbolOfDestiny) || !symbolOfDestiny.isAdjacentCell() || symbolOfDestiny.itemOnBoardReferenced === null) return null;
    const teleportees = this.elementsInPositionExcept(collisionPosition.plus(symbolOfDestiny.itemOnBoardReferenced.adjacentDirection()), null);
    return teleportees.length > 0 ? teleportees[0] : null;
  }

  detectTeleportee(reference, collisioner, collisionPosition) {
    const direct = this.detectTeleporteeDirect(reference, collisioner, collisionPosition);
    if (direct !== null) return direct;
    const concrete = this.concreteSymbolOfElementIndirectlyReferencedBy(reference);
    if (concrete !== null) {
      const indirect = this.detectTeleporteeDirect(concrete, collisioner, collisionPosition);
      if (indirect !== null) return indirect;
    }
    return this.detectAdjacentTeleportee(reference, collisionPosition);
  }

  detectTeleporteeMonitoredBy(reference, collisioner, collisionPosition, collisionMonitor) {
    const inPosition = collisionMonitor.elementInPosition();
    if (inPosition !== null && inPosition !== undefined && inPosition.visualSymbolAssociated.equals(reference)) return inPosition;
    return this.detectTeleportee(reference, collisioner, collisionPosition);
  }

  detectDestinyDirect(symbolOfDestiny, elementArriving, collisionPosition) {
    if (this.isReferencedBy(elementArriving, symbolOfDestiny)) return collisionPosition;
    const destiny = this.anyElementRepresentedBy(symbolOfDestiny);
    if (destiny === null) return null;
    return this.positionOfIfAbsent(destiny, () => null);
  }

  detectDestiny(symbolOfDestiny, elementArriving, collisionPosition) {
    const direct = this.detectDestinyDirect(symbolOfDestiny, elementArriving, collisionPosition);
    if (direct !== null) return direct;
    const concrete = this.concreteSymbolOfElementIndirectlyReferencedBy(symbolOfDestiny);
    if (concrete === null) return null;
    return this.detectDestinyDirect(concrete, elementArriving, collisionPosition);
  }

  detectAdjacentDestinyFor(symbolOfDestiny, teleportee) {
    if (!isVisualSymbol(symbolOfDestiny) || !symbolOfDestiny.isAdjacentCell() || symbolOfDestiny.itemOnBoardReferenced === null) return null;
    const elementPosition = this.itemPositions.get(teleportee);
    if (elementPosition === undefined) return null;
    return symbolOfDestiny.itemOnBoardReferenced.adjacentDirection().plus(elementPosition).plus(teleportee.direction);
  }

  destinyIsMoving(destinyReference) {
    const destiny = this.anyElementRepresentedBy(destinyReference);
    return destiny !== null && destiny.isMoving();
  }

  // Teleport disparado por una colisión (alcance local).
  teleporteeToDestiny(referenceToTeleportee, teleportSymbol, destinyReference, collisioner, collisionPosition, collisionMonitor) {
    if (!this.isAValidSymbolToTeleportee(referenceToTeleportee)) return;
    if (isVisualSymbol(destinyReference) && destinyReference.isBlackHole()) {
      return this.teleportToNowhereWhenCollisioner(referenceToTeleportee, collisioner, collisionPosition, collisionMonitor);
    }
    let teleportee = this.detectTeleporteeMonitoredBy(referenceToTeleportee, collisioner, collisionPosition, collisionMonitor);
    if (teleportee === null) {
      if (referenceToTeleportee.isAdjacentCell()) return;
      teleportee = this.newAbsentOrRandomItemCategorizedBy(referenceToTeleportee);
      if (teleportee === null) return;
      const destinyPosition = this.detectDestiny(destinyReference, collisioner, collisionPosition);
      if (destinyPosition === null) return;
      this.enqueueAddOf(teleportee, destinyPosition);
    } else {
      let destinyPosition = this.detectAdjacentDestinyFor(destinyReference, teleportee);
      if (destinyPosition === null) destinyPosition = this.detectDestiny(destinyReference, collisioner, collisionPosition);
      if (destinyPosition === null) return;
      this.enqueueTeleportOf(teleportee, destinyPosition);
    }
    collisionMonitor.noticeThatTeleportWasMade();
  }

  teleportToNowhereWhenCollisioner(reference, collisioner, collisionPosition, collisionMonitor) {
    const referenced = reference.itemOnBoardReferenced;
    if (referenced === null || referenced === undefined) return;
    this.enqueueRemoveOf(referenced, collisioner);
    collisionMonitor.noticeThatTeleportWasMade();
  }

  // Teleport disparado sin colisión (botón, Enter, Espacio).
  teleport(teleporteeReference, destinyReference, teleportMonitor) {
    if (isVisualSymbol(destinyReference) && destinyReference.isBlackHole()) return this.teleportToNowhere(teleporteeReference, teleportMonitor);
    const destinyElement = this.anyElementRepresentedBy(destinyReference);
    if (destinyElement === null) return;
    const destinyPosition = this.itemPositions.get(destinyElement);
    if (destinyPosition === undefined) return;
    const teleportee = this.detectTeleportee(teleporteeReference, destinyElement, destinyPosition);
    if (teleportee === null) {
      const newItem = this.asItemIfAdjacentCellSymbol(teleporteeReference, () => null);
      if (newItem !== null) this.enqueueAddOf(newItem, destinyPosition);
      return;
    }
    this.enqueueTeleportOf(teleportee, destinyPosition);
  }

  teleportToNowhere(reference) {
    const toRemove = this.elementDirectOrIndirectlyReferencedBy(reference);
    if (toRemove === null) return;
    this.enqueueRemoveOf(toRemove, toRemove);
  }

  // Teleport con alcance global: todos los elementos referidos.
  teleportAll(referenceToTeleportee, destinyReference, collisioner, collisionPosition, collisionMonitor) {
    const elementsToTeleport = this.elementsLikeOrCategorizedBy(referenceToTeleportee);
    if (elementsToTeleport.length === 0) {
      return this.createOnAllDestinies(referenceToTeleportee, destinyReference, collisionMonitor);
    }
    if (isVisualSymbol(destinyReference) && destinyReference.isBlackHole()) {
      for (const each of elementsToTeleport) this.enqueueRemoveOf(each, each);
      return;
    }
    if (elementsToTeleport.some(each => each.isMoving()) && this.destinyIsMoving(destinyReference)) {
      return this.createOnAllDestinies(referenceToTeleportee, destinyReference, collisionMonitor);
    }
    const destinyPosition = this.detectDestiny(destinyReference, collisioner, collisionPosition);
    if (destinyPosition === null) return;
    for (const each of elementsToTeleport) this.enqueueTeleportOf(each, destinyPosition);
    collisionMonitor.noticeThatTeleportWasMade();
  }

  createOnAllDestinies(referenceToNew, destinyReference, collisionMonitor) {
    const destinies = this.elementsLikeOrCategorizedBy(destinyReference);
    if (destinies.length === 0) return;
    for (const destiny of destinies) {
      const position = this.itemPositions.get(destiny);
      if (position === undefined) return;
      const newItem = this.newAbsentOrRandomItemCategorizedBy(referenceToNew);
      if (newItem !== null) this.enqueueAddOf(newItem, position);
    }
    collisionMonitor.noticeThatTeleportWasMade();
  }

  removeElementDirect(symbolToRemove, elementArrived) {
    let toRemove;
    if (this.isReferencedBy(elementArrived, symbolToRemove)) toRemove = elementArrived;
    else if (symbolToRemove instanceof ItemOnBoard) toRemove = symbolToRemove;
    else toRemove = this.anyElementRepresentedBy(symbolToRemove);
    if (toRemove === null || toRemove === undefined) return false;
    this.removeItem(toRemove);
    return true;
  }

  removeElementDirectOrEvaluating(symbolToRemove, elementArrived) {
    if (this.removeElementDirect(symbolToRemove, elementArrived)) return;
    const concrete = this.concreteSymbolOfElementIndirectlyReferencedBy(symbolToRemove);
    if (concrete !== null) this.removeElementDirect(concrete, elementArrived);
  }

  // --- celdas adyacentes ---

  adjacentElementsReferencedBy(adjacentCellSequence, collisioner, collisionPosition) {
    const sequence = Sentence.from(adjacentCellSequence);
    const firstItem = sequence[0].itemOnBoardReferenced;
    if (firstItem === null || collisionPosition === null) return new Sentence();
    let positions = firstItem.allDirectionsReferenced().map(direction => collisionPosition.plus(direction));
    for (const otherSymbol of sequence.slice(1)) {
      const nextPositions = [];
      const otherItem = otherSymbol.itemOnBoardReferenced;
      for (const adjacentPosition of positions) {
        for (const direction of otherItem.allDirectionsReferenced()) nextPositions.push(adjacentPosition.plus(direction));
      }
      positions = nextPositions;
    }
    const elements = this.allElementsInAllPositions(positions).filter(element => element !== collisioner);
    return Sentence.from(elements.map(element => element.visualSymbolAssociated));
  }

  // --- puntos de inspección ---

  ensureActivatedInspectPoints() {
    for (const item of this.zOrder) {
      if (item.isPoints() && item.inspectPointIsOn) this.invertBreakPointStateOfSubstitutionOf(item);
    }
  }

  invertBreakPointStateOfSubstitutionOf(pointsItem) {
    const sequence = this.sentencesOnBoardExcludingTeleportsWithoutCollisionAndREPLExpressions().find(each => each.includes(pointsItem));
    if (sequence === undefined) return;
    const categories = sequence.asSentence().allBefore(pointsItem.visualSymbolAssociated);
    const relation = this.interpreter.detectRelationBySequenceOfCategories(categories);
    if (relation !== null) relation.invertInspectPointState();
  }

  // --- visibilidad ---

  hideAllSymbols() { for (const item of this.zOrder) if (item.consideredSymbol) item.makeInvisible(); }
  showAllSymbols() { for (const item of this.zOrder) if (item.consideredSymbol) item.makeVisible(); }
  showAllItems() { for (const item of this.zOrder) item.makeVisible(); }
  hideRepresentedBy(symbol) { for (const item of this.zOrder) if (item.representedBy(symbol)) item.makeInvisible(); }
  showRepresentedBy(symbol) { for (const item of this.zOrder) if (item.representedBy(symbol)) item.makeVisible(); }
  isEverySymbolVisible() { return this.zOrder.every(item => item.consideredElement() || item.isVisible()); }
  isEverythingVisible() { return this.zOrder.every(item => item.isVisible()); }
  isHiddenAnyElementRepresentedBy(symbol) { return this.zOrder.some(item => item.representedBy(symbol) && !item.isVisible()); }

  // --- selección ---

  itemsFromTo(from, to) {
    const lowerBound = from.minus(Point.at(1, 1));
    const items = new Set();
    for (const [item, position] of this.itemPositions) {
      if (lowerBound.isLessOrEqualThan(position) && position.isLessOrEqualThan(to)) items.add(item);
    }
    return items;
  }

  selectItemsFromTo(from, to) {
    const selected = this.itemsFromTo(from, to);
    this.highlightByUserSelectionElements(selected);
    const positions = new Map();
    for (const item of selected) positions.set(item, this.itemPositions.get(item));
    return positions;
  }

  highlightByUserSelectionElements(items) {
    this.highlightedItems = new Set(items);
    for (const each of this.highlightedItems) each.highlightingByUserSelection();
  }

  deselectItems() {
    for (const each of this.highlightedItems) each.stopHighlightingByUserSelection();
    this.highlightedItems = new Set();
  }

  removeHighlightedItems() {
    let anySymbol = false;
    for (const each of this.highlightedItems) {
      anySymbol = anySymbol || each.consideredSymbol;
      this.removeItem(each);
    }
    this.highlightedItems = new Set();
    if (anySymbol) this.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }

  // --- tamaño de elementos ---

  resizeTo(item, factor) {
    if (factor < 1) return;
    this.resizeWithoutRecordingTo(item, factor);
    this.recordCurrentBoard();
  }

  // Mientras se arrastra la manija del halo: el registro para deshacer se hace al soltar.
  resizeWithoutRecordingTo(item, factor) {
    if (factor < 1) return;
    item.setGridResizeFactor(factor);
    item.updateExtent();
    this.currentResizeFactors.set(item, factor);
    this.changed();
  }

  // --- undo, set y reset ---

  initializeUndoHistory() {
    this.undoRecord = new BaseUndoRecord(new Map(this.itemPositions), this.gridSize, new Map(this.currentResizeFactors));
    this.recordCurrentBoard();
  }

  currentRecord() {
    return new UndoRecord(new Map(this.itemPositions), this.gridSize, new Map(this.currentResizeFactors), this.undoRecord);
  }

  recordCurrentBoard() { this.undoRecord = this.currentRecord(); this.boardView.boardRecorded(); }

  lastRecordedStateEqualsCurrentState() {
    return BoardModel.samePositions(this.itemPositions, this.undoRecord.recordedPositions())
      && this.gridSize === this.undoRecord.recordedGridSize()
      && BoardModel.sameMaps(this.currentResizeFactors, this.undoRecord.recordedResizeFactors());
  }

  static samePositions(a, b) {
    if (a.size !== b.size) return false;
    for (const [item, position] of a) { const other = b.get(item); if (other === undefined || !other.equals(position)) return false; }
    return true;
  }

  static sameMaps(a, b) {
    if (a.size !== b.size) return false;
    for (const [key, value] of a) if (b.get(key) !== value) return false;
    return true;
  }

  backToPreviousBoardState() {
    if (!this.undoRecord.hasPrevious()) return this.backToBoardState(this.undoRecord);
    if (this.lastRecordedStateEqualsCurrentState()) {
      this.undoRecord = this.undoRecord.previous;
      return this.backToPreviousBoardState();
    }
    this.backToBoardState(this.undoRecord);
    this.undoRecord = this.undoRecord.previous;
    this.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }

  backToBoardState(record) {
    this.itemPositions = new Map(record.recordedPositions());
    this.updateResizeFactors(new Map(record.recordedResizeFactors()));
    if (this.gridSize !== record.recordedGridSize()) { this.gridSize = record.recordedGridSize(); this.boardView.gridSizeChanged(); }
    this.zOrder = this.zOrder.filter(item => this.itemPositions.has(item));
    for (const item of this.itemPositions.keys()) if (!this.zOrder.includes(item)) this.zOrder.unshift(item);
    for (const [item, wasSymbol] of record.recordedSymbolicStates()) {   // un elemento vuelto símbolo vuelve a ser elemento
      if (this.itemPositions.has(item) && item.consideredSymbol !== wasSymbol && item.invertSymbolicStateIfCanBeElement) item.invertSymbolicStateIfCanBeElement();
    }
    this.clearMemoizedMovableItems();
    this.refreshItems();
    this.boardView.boardRestored();
    this.changed();
  }

  // A diferencia de Cuis, un ítem sin factor registrado vuelve a ocupar una celda: así
  // deshacer también deshace el primer agrandado.
  updateResizeFactors(factors) {
    this.currentResizeFactors = factors;
    for (const item of this.itemPositions.keys()) {
      const factor = factors.has(item) ? factors.get(item) : 1;
      if (item.gridResizeFactor() !== factor) { item.setGridResizeFactor(factor); item.updateExtent(); }
    }
  }

  setCurrentAsResetBoard() { this.setedRecord = this.currentRecord(); }

  resetBoard() {
    if (this.setedRecord === null) return;
    this.recordCurrentBoard();
    this.backToBoardState(this.setedRecord);
    this.recordCurrentBoard();
    this.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }

  // --- zoom (sólo cambia el tamaño en píxeles; las posiciones son celdas) ---

  changeGridSizeTo(size) {
    if (size < 10 || size > 200) return;
    this.gridSize = size;
    this.boardView.gridSizeChanged();
    this.markErrorWhenTwoSymbolsInTheSamePlace();
  }

  performZoomIn() { if (this.zOrder.length > 0) { this.changeGridSizeTo(this.gridSize + 10); this.recordCurrentBoard(); } }
  performZoomOut() { if (this.zOrder.length > 0) { this.changeGridSizeTo(this.gridSize - 10); this.recordCurrentBoard(); } }
  zoomIn() { this.enqueueCommand(() => this.performZoomIn()); }
  zoomOut() { this.enqueueCommand(() => this.performZoomOut()); }
}

export { termEquals };

// --- soltar ítems en el tablero (lo que hacía BoardView>>acceptDroppingMorph:event:) ---

BoardModel.prototype.acceptDropping = function (symbolOrItem, position, { treatDrawingsAsSymbols = false, stampMode = false } = {}) {
  const droppedSymbol = isVisualSymbol(symbolOrItem) ? symbolOrItem : null;
  const normalized = this.normalizePositionToGrid(position).max(Point.ZERO);
  if (droppedSymbol !== null && stampMode && this.symbolIsRepeatedIn(droppedSymbol, treatDrawingsAsSymbols, normalized)) return null;
  const item = this.addItemFrom(symbolOrItem, normalized);
  if (droppedSymbol !== null && !droppedSymbol.isREPL() && treatDrawingsAsSymbols) item.becameSymbolByPredefinedDroppedNextToMe();
  this.addThenReevaluateAll(item, normalized);
  this.whenDroppedNextToSymbolEnsureIsItemSymbolToo(item);
  this.whenDroppedNextToElementMakeItSymbolIfPredefined(item);
  this.evaluateCollisionsIfNotSymbol(item);
  this.recordCurrentBoard();
  return item;
};

// En modo "estampar" no se vuelve a poner un ítem igual (mismo símbolo y mismo rol) en la misma celda.
BoardModel.prototype.symbolIsRepeatedIn = function (symbol, treatDrawingsAsSymbols, position) {
  const wouldBeSymbol = symbol.isREPL() ? false : (symbol.isDrawing() ? treatDrawingsAsSymbols : true);
  return this.itemsInPosition(position).some(each =>
    each.visualSymbolAssociated.equals(symbol) && each.consideredSymbol === wouldBeSymbol);
};

BoardModel.prototype.addThenReevaluateAll = function (item, position) {
  item.updateExtent();
  this.bringToFront(item);
  this.changePositionAndIfSymbolEvaluateAll(item, position);
  this.clearDisplacementQueue();
  this.ifREPLEvaluateItsSentence(item);
};

BoardModel.prototype.whenDroppedNextToSymbolEnsureIsItemSymbolToo = function (item) {
  if (this.symbolicItemsToTheLeftOf(item).length > 0 || this.symbolicItemsToTheRightOf(item).length > 0) {
    item.becameSymbolByPredefinedDroppedNextToMe();
    this.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }
};

BoardModel.prototype.whenDroppedNextToElementMakeItSymbolIfPredefined = function (item) {
  if (!item.isPredefined()) return;
  const nextItems = this.itemsToTheRightOf(item);
  if (nextItems.length === 1 && nextItems[0].gridResizeFactor() === 1 && nextItems[0].consideredElement()) {
    nextItems[0].becameSymbolByPredefinedDroppedNextToMe();
  }
};
