import { SubstitutionBeyondSymbols } from '../metamodel/SubstitutionBeyondSymbols.js';

export const GRIDDED_CONNECTION_TOPIC = 'Gridded Connection';

// Conecta el intérprete con el tablero: las relaciones "más allá de los símbolos" que
// producen efectos en la grilla (teleport y referencia a celdas adyacentes).
export class ConnectorWithInterpreter {
  static connect(boardModel, interpreter) {
    return new ConnectorWithInterpreter().connect(boardModel, interpreter);
  }

  connect(boardModel, interpreter) {
    this.boardModel = boardModel;
    this.stateOfArt = interpreter.currentStateOfArt;
    this.stateOfArt.clearAllCache();
    const previousTopic = this.stateOfArt.actualTopicInConstruction;
    this.stateOfArt.actualTopicInConstruction = GRIDDED_CONNECTION_TOPIC;
    this.stateOfArt.actualSectionInConstruction = 'Teleport & AdjacentCell';
    this.addRelationTeleportAnElementToOtherElementsPosition();
    this.addSubstitutionElementsPointedByAdjacentCellSequence();
    this.stateOfArt.actualTopicInConstruction = previousTopic;
    this.stateOfArt.clearAllCache();
    return this;
  }

  // element teleport element
  addRelationTeleportAnElementToOtherElementsPosition() {
    this.addSubstitutionRelationForCategories(['element', 'teleport', 'element'],
      ['elementMoving', 'teleport', 'elementWithDestinationPosition'],
      (collisionMonitor, teleportee, teleportSymbol, destiny) => {
        collisionMonitor.allow(() => collisionMonitor.teleportee(
          teleportee, teleportSymbol, destiny, collisionMonitor.elementArriving(), collisionMonitor.positionOfCollision()));
        collisionMonitor.relationBeyondSymbolsEvaluated();
        return [];
      });
  }

  // adjacentCellSequence → los símbolos de los elementos en esas celdas
  addSubstitutionElementsPointedByAdjacentCellSequence() {
    this.addSubstitutionRelationForCategories(['adjacentCellSequence'], ['adjacentCellSequence'],
      (collisionMonitor, adjacentCellSequence) => {
        let answer = [];
        collisionMonitor.allow(() => {
          answer = collisionMonitor.adjacentElementsReferencedBy(
            adjacentCellSequence, collisionMonitor.elementArriving(), collisionMonitor.positionOfCollision());
        });
        collisionMonitor.relationBeyondSymbolsEvaluated();
        return answer;
      });
  }

  addSubstitutionRelationForCategories(categories, roles, processingMethod) {
    return this.stateOfArt.addSubstitutionRelationAsIs(
      SubstitutionBeyondSymbols.forCategories(categories, roles, processingMethod));
  }
}
