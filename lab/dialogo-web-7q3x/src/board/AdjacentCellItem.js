import { ItemOnBoard, registerItemClass } from './ItemOnBoard.js';
import { Point } from './Point.js';
import { StateOfArtBuilderForVisualEnvironment } from '../metamodel/StateOfArtBuilderForVisualEnvironment.js';

const ANGLE_TO_VECTOR = { 0: [0, -1], 45: [1, -1], 90: [1, 0], 135: [1, 1], 180: [0, 1], 225: [-1, 1], 270: [-1, 0], 315: [-1, -1] };

// La celda adyacente: apunta a una dirección, a todas, o a ninguna (agujero negro).
// Cambia su símbolo entre adjacentCell y blackHole según el estado.
export class AdjacentCellItem extends ItemOnBoard {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.consideredSymbol = true;
    this.referencingAngle = 0;
    this.pointingAllDirections = false;
    this.pointingNoDirection = true;
    this.updateVisualSymbol();
  }

  static isFor(symbol) { return symbol.isAdjacentCell() || symbol.isBlackHole(); }

  isAdjacentCell() { return true; }
  isPointingAllDirections() { return this.pointingAllDirections; }
  isPointingNoDirection() { return this.pointingNoDirection; }
  isPointingOneDirection() { return !this.pointingAllDirections && !this.pointingNoDirection; }

  referencingVector() {
    const [x, y] = ANGLE_TO_VECTOR[this.referencingAngle] || [0, 0];
    return Point.at(x, y);
  }

  setReferencingVector(vector) {
    for (const [angle, [x, y]] of Object.entries(ANGLE_TO_VECTOR)) {
      if (vector.x === x && vector.y === y) { this.referencingAngle = Number(angle); return; }
    }
    throw new Error('Invalid vector ' + vector);
  }

  adjacentDirection() { return this.referencingVector(); }

  allEightAdjacentDirections() {
    return Object.values(ANGLE_TO_VECTOR).map(([x, y]) => Point.at(x, y));
  }

  allDirectionsReferenced() {
    if (this.pointingNoDirection) return [];
    return this.isPointingAllDirections() ? this.allEightAdjacentDirections() : [this.adjacentDirection()];
  }

  updateVisualSymbol() {
    const provider = new StateOfArtBuilderForVisualEnvironment();
    this.visualSymbolAssociated = this.pointingNoDirection ? provider.blackHoleSymbol() : provider.adjacentCellSymbol();
    this.visualSymbolAssociated.itemOnBoardReferenced = this;
    this.representingSymbol = null;
    this.changed();
  }

  clockWiseDirection() { this.pointingNoDirection = false; this.referencingAngle = (this.referencingAngle + 45) % 360; this.updateVisualSymbol(); }
  counterClockWiseDirection() { this.pointingNoDirection = false; this.referencingAngle = (this.referencingAngle + 315) % 360; this.updateVisualSymbol(); }

  invertIfReferencingAllDirections() {
    this.pointingNoDirection = false;
    this.pointingAllDirections = !this.pointingAllDirections;
    this.updateVisualSymbol();
  }

  invertIfReferencingNoDirection() {
    this.pointingAllDirections = false;
    this.pointingNoDirection = !this.pointingNoDirection;
    this.updateVisualSymbol();
  }

  referenceAllDirectionsHaloClick() {
    this.invertIfReferencingAllDirections();
    this.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }

  referenceNoDirectionHaloClick() {
    this.invertIfReferencingNoDirection();
    this.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }
}

registerItemClass(AdjacentCellItem);
