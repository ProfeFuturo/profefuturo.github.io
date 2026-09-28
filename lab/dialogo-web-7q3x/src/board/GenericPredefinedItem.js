import { ItemOnBoard, registerItemClass } from './ItemOnBoard.js';

// Cualquier otro símbolo predefinido (flechas del teclado, colisión, empujar, jalar, ...).
export class GenericPredefinedItem extends ItemOnBoard {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.consideredSymbol = true;
  }

  static isFor(symbol) {
    return !(symbol.isRun() || symbol.isREPL() || symbol.isAdjacentCell() || symbol.isBlackHole() || symbol.isDrawing()
      || symbol.isPoints() || symbol.isSingularJoker() || symbol.isDoubleJoker() || symbol.isTeleport());
  }
}

registerItemClass(GenericPredefinedItem);
