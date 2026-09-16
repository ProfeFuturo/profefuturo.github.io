import { Sentence } from './Sentence.js';
import { dictionaryAt } from '../io/LanguageProvider.js';

// Un símbolo visual: predefinido (identificado por su buildingSelector) o dibujo del usuario
// (identificado por el hash de su Drawing). Es un término de las oraciones.
// Una copia "en particular" (symbolRepresentingInParticular) referencia a un ItemOnBoard
// concreto; sigue siendo igual (=) al símbolo genérico porque comparten el hash.
export class VisualSymbol {
  constructor({ hash, buildingSelector = null, meaningSelector = null, highlightColor = 'gray', drawing = null }) {
    this.hash = hash;
    this.buildingSelector = buildingSelector;
    this.meaningSelector = meaningSelector;
    this.highlightColor = highlightColor;
    this.drawing = drawing;
    this.itemOnBoardReferenced = null;
  }

  static predefined(selector, { meaningSelector = selector, highlightColor = 'gray', drawing = null } = {}) {
    return new VisualSymbol({ hash: selector, buildingSelector: selector, meaningSelector, highlightColor, drawing });
  }

  static fromDrawing(drawing) {
    return new VisualSymbol({ hash: drawing.hash, drawing });
  }

  get isVisualSymbol() { return true; }

  equals(other) {
    return other !== null && typeof other === 'object' && other.isVisualSymbol === true && other.hash === this.hash;
  }

  copy() {
    const copy = new VisualSymbol({
      hash: this.hash,
      buildingSelector: this.buildingSelector,
      meaningSelector: this.meaningSelector,
      highlightColor: this.highlightColor,
      drawing: this.drawing,
    });
    copy.itemOnBoardReferenced = this.itemOnBoardReferenced;
    return copy;
  }

  isPredefined() { return this.buildingSelector !== null; }
  isDrawing() { return this.buildingSelector === null; }
  isUserDrawing() { return this.isDrawing(); }

  isREPL() { return this.buildingSelector === 'replSymbol'; }
  isRun() { return this.buildingSelector === 'runSymbol'; }
  isTeleport() { return this.buildingSelector === 'teleportSymbol'; }
  isPoints() { return this.buildingSelector === 'pointsSymbol'; }
  isCategorize() { return this.buildingSelector === 'categorizeSymbol'; }
  isAdjacentCell() { return this.buildingSelector === 'adjacentCellSymbol'; }
  isBlackHole() { return this.buildingSelector === 'blackHoleSymbol'; }
  isSingularJoker() { return this.buildingSelector === 'jokerHead'; }
  isDoubleJoker() { return this.buildingSelector === 'jokerDouble'; }
  isPluralJoker() { return this.buildingSelector === 'jokerWithBalls'; }
  isJoker() { return this.isSingularJoker() || this.isPluralJoker(); }
  isEvaluationInProcess() { return this.buildingSelector === 'evaluationInProcessSymbol'; }

  doesReferenceAParticularElementOnBoard() {
    return this.itemOnBoardReferenced !== null && this.itemOnBoardReferenced.consideredElement();
  }

  meaning() {
    return this.meaningSelector === null ? '' : dictionaryAt(this.meaningSelector);
  }

  asSentence() {
    return Sentence.of(this);
  }

  toString() {
    if (this.isPredefined()) return '«' + this.buildingSelector + '»';
    return '«dibujo ' + String(this.hash).slice(0, 8) + '»';
  }
}
