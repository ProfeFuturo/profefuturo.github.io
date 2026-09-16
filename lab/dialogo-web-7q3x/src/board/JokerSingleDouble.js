import { ItemOnBoard, registerItemClass } from './ItemOnBoard.js';
import { StateOfArtBuilderForVisualEnvironment } from '../metamodel/StateOfArtBuilderForVisualEnvironment.js';

// El comodín de un símbolo (cabeza) o de dos iguales (doble).
export class JokerSingleDouble extends ItemOnBoard {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.consideredSymbol = true;
    this.singleJoker = !visualSymbol.isDoubleJoker();
  }

  static isFor(symbol) { return symbol.isSingularJoker() || symbol.isDoubleJoker(); }

  isSingleJoker() { return this.singleJoker; }

  becameDoubleJoker() { this.singleJoker = false; this.updateVisualSymbol(); this.updateBoardViewAndModel(); }
  becameSimpleJoker() { this.singleJoker = true; this.updateVisualSymbol(); this.updateBoardViewAndModel(); }

  updateVisualSymbol() {
    const provider = new StateOfArtBuilderForVisualEnvironment();
    this.visualSymbolAssociated = this.singleJoker ? provider.jokerHead() : provider.jokerDouble();
    this.visualSymbolAssociated.itemOnBoardReferenced = this;
    this.representingSymbol = null;
  }

  updateBoardViewAndModel() {
    this.changed();
    this.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }
}

registerItemClass(JokerSingleDouble);
