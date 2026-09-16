import { EvaluationMonitor } from '../metamodel/EvaluationMonitor.js';

// Monitor de la evaluación de una colisión: sabe quién llegó, con quién chocó y dónde,
// y le pide al tablero los teleports que el resultado indique.
export class CollisionMonitor extends EvaluationMonitor {
  constructor(boardModel, positionOfCollision, elementArriving, elementInPosition = null) {
    super({ inspecting: true, allowsChanges: true, boardModel });
    this.positionOfCollisionValue = positionOfCollision;
    this.elementArrivingValue = elementArriving;
    this.elementInPositionValue = elementInPosition;
    this.teleportMade = false;
  }

  static collisionOf(elementArriving, withElement, onPosition, onBoard) {
    return new CollisionMonitor(onBoard, onPosition, elementArriving, withElement);
  }

  elementArriving() { return this.elementArrivingValue; }
  elementInPosition() { return this.elementInPositionValue; }
  positionOfCollision() { return this.positionOfCollisionValue; }
  noticeThatTeleportWasMade() { this.teleportMade = true; }
  wasTeleportMade() { return this.teleportMade; }

  teleportee(referenceToTeleportee, teleportSymbol, destinyReference, collisioner, collisionPosition) {
    const teleportItem = teleportSymbol.itemOnBoardReferenced;
    if (teleportItem !== null && teleportItem.hasGlobalScope()) {
      return this.boardModel.teleportAll(referenceToTeleportee, destinyReference, collisioner, collisionPosition, this);
    }
    return this.boardModel.teleporteeToDestiny(referenceToTeleportee, teleportSymbol, destinyReference, collisioner, collisionPosition, this);
  }

  adjacentElementsReferencedBy(adjacentCellSequence, collisioner, position) {
    return this.boardModel.adjacentElementsReferencedBy(adjacentCellSequence, collisioner, position, this);
  }
}
