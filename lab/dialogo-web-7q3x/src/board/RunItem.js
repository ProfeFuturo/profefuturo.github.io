import { ItemOnBoard, registerItemClass } from './ItemOnBoard.js';

// El símbolo "corre hacia": guarda cuánto se lo frena (1 = velocidad máxima, 20 = mínima).
export class RunItem extends ItemOnBoard {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.consideredSymbol = true;
    this.slowDown = 1;
    this.visualSymbolAssociated.itemOnBoardReferenced = this;
  }

  static isFor(symbol) { return symbol.isRun(); }

  slowDownFactor() { return this.slowDown; }
  setSlowDownFactor(factor) { if (factor >= 1 && factor <= 20) { this.slowDown = factor; this.changed(); } }
  atMaxSpeed() { return this.slowDown === 1; }
  atMinSpeed() { return this.slowDown === 20; }
  isSlowedDown() { return this.slowDown > 1; }
  slowDownMore() { if (!this.atMinSpeed()) this.setSlowDownFactor(this.slowDown + 1); }
  speedUp() { if (!this.atMaxSpeed()) this.setSlowDownFactor(this.slowDown - 1); }
}

registerItemClass(RunItem);
