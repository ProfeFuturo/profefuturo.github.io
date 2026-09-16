import { EvaluationMonitor } from '../metamodel/EvaluationMonitor.js';

// Monitor para evaluaciones que no vienen de una colisión (botones, Enter, Espacio):
// los teleports se resuelven buscando cualquier elemento que corresponda.
export class TeleportMonitor extends EvaluationMonitor {
  constructor(boardModel) {
    super({ inspecting: true, allowsChanges: true, boardModel });
  }

  teleportee(referenceToTeleportee, teleportSymbol, destinyReference, collisioner, collisionPosition) {
    const teleportItem = teleportSymbol.itemOnBoardReferenced;
    if (teleportItem !== null && teleportItem.hasGlobalScope()) {
      return this.boardModel.teleportAll(referenceToTeleportee, destinyReference, collisioner, collisionPosition, this);
    }
    return this.boardModel.teleport(referenceToTeleportee, destinyReference, this);
  }

  noticeThatTeleportWasMade() {}
}
