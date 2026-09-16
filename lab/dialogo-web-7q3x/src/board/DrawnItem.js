import { ItemThatCanBeElement } from './ItemThatCanBeElement.js';
import { registerItemClass } from './ItemOnBoard.js';
import { Sentence } from '../metamodel/Sentence.js';
import { TeleportMonitor } from './TeleportMonitor.js';

// Un dibujo del usuario en el tablero: símbolo, elemento o botón.
export class DrawnItem extends ItemThatCanBeElement {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.consideredSymbol = false;
    this.resizeFactor = 1;
    this.button = false;
  }

  static isFor(symbol) { return symbol.isDrawing(); }

  becameSymbolByPredefinedDroppedNextToMe() {
    if (!this.boardModel.replElements().includes(this)) this.setConsideredSymbol(true);
  }

  gridResizeFactor() { return this.resizeFactor; }
  setGridResizeFactor(factor) { if (factor >= 1) this.resizeFactor = Math.floor(factor); }
  isResized() { return this.resizeFactor > 1; }

  // --- botón ---

  isButton() { return this.button; }

  invertBecameButton() {
    this.invertBecameButtonWithoutEvaluating();
    this.refreshSymbolicCondition();
  }

  invertBecameButtonWithoutEvaluating() {
    this.button = !this.button;
    this.consideredSymbol = !this.button;
  }

  buttonPressed() {
    this.boardModel.evaluateSentence(Sentence.of(this.visualSymbolAssociated), new TeleportMonitor(this.boardModel));
    this.boardModel.restartNotRunningREPLs();
  }

  balloonText() { return this.errorMessageOfFail; }
}

registerItemClass(DrawnItem);
