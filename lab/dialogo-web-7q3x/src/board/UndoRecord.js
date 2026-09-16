// Foto del tablero (posiciones, tamaño de grilla, factores de tamaño) encadenada a la anterior.
export class UndoRecord {
  constructor(positions, gridSize, resizeFactors, previous) {
    this.positions = positions;
    this.gridSize = gridSize;
    this.resizeFactors = resizeFactors;
    this.previous = previous;
  }
  hasPrevious() { return true; }
  recordedPositions() { return this.positions; }
  recordedGridSize() { return this.gridSize; }
  recordedResizeFactors() { return this.resizeFactors; }
}

export class BaseUndoRecord extends UndoRecord {
  constructor(positions, gridSize, resizeFactors) {
    super(positions, gridSize, resizeFactors, null);
    this.previous = this;
  }
  hasPrevious() { return false; }
}
