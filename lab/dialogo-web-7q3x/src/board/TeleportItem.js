import { ItemOnBoard, registerItemClass } from './ItemOnBoard.js';

// El símbolo teleport: con alcance global teletransporta a todos los elementos iguales.
export class TeleportItem extends ItemOnBoard {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.consideredSymbol = true;
    this.global = false;
    this.visualSymbolAssociated.itemOnBoardReferenced = this;
  }

  static isFor(symbol) { return symbol.isTeleport(); }

  hasGlobalScope() { return this.global; }
  changeScope() { this.global = !this.global; this.changed(); }
}

registerItemClass(TeleportItem);
