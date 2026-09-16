import { Sentence } from '../metamodel/Sentence.js';

// Una fila de ítems simbólicos consecutivos del tablero: una oración a evaluar.
export class SequenceOfElements {
  constructor() {
    this.simulationElements = [];
  }
  addLast(element) { this.simulationElements.push(element); }
  isEmpty() { return this.simulationElements.length === 0; }
  includes(item) { return this.simulationElements.includes(item); }
  anySatisfy(condition) { return this.simulationElements.some(condition); }
  symbolSequence() { return this.simulationElements.map(element => element.visualSymbolAssociated); }
  asSentence() { return Sentence.from(this.symbolSequence()); }
  evaluatedWithError(error, monitor) {
    for (const element of this.simulationElements) element.evaluatedWithError(error, this, monitor);
  }
  evaluatedWithTeleportError() {
    for (const element of this.simulationElements) element.evaluatedWithTeleportErrorInSequence(this);
  }
  toString() { return this.asSentence().toString(); }
}
