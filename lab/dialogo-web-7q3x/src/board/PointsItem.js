import { ItemOnBoard, registerItemClass } from './ItemOnBoard.js';

// La flecha "se sustituye por". Puede tener un punto de inspección activado.
export class PointsItem extends ItemOnBoard {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.consideredSymbol = true;
    this.inspectPointIsOn = false;
  }

  static isFor(symbol) { return symbol.isPoints(); }

  isPoints() { return true; }

  invertInspectPointState() {
    this.inspectPointIsOn = !this.inspectPointIsOn;
    this.boardModel.invertBreakPointStateOfSubstitutionOf(this);
    this.changed();
  }
}

registerItemClass(PointsItem);
