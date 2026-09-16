import { ItemThatCanBeElement } from './ItemThatCanBeElement.js';
import { registerItemClass } from './ItemOnBoard.js';

// El REPL (los ojos): como elemento, evalúa lo que tiene a la izquierda y muestra el
// resultado a la derecha. Puede fijar un resultado esperado (ojos verdes/rojos).
export class EvalAndSeeItem extends ItemThatCanBeElement {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.expectedSentenceAndResult = null;
  }

  static isFor(symbol) { return symbol.isREPL(); }

  inspectSubstitutions() {
    if (this.sentenceToTheLeft !== null && this.sentenceToTheLeft.length > 0 && this.evaluationMonitor !== null) {
      this.boardModel.addInspectorFrom(this.evaluationMonitor);
    }
  }

  currentSentenceResultAssociation() {
    return { sentence: this.sentenceToTheLeft === null ? null : this.sentenceToTheLeft.slice(), result: this.resultToTheRight };
  }

  hasExpectedResult() { return this.expectedSentenceAndResult !== null; }
  resetHavingExpectedResult() { this.expectedSentenceAndResult = null; this.changed(); }
  setResultAsExpected() { this.expectedSentenceAndResult = this.currentSentenceResultAssociation(); this.changed(); }

  currentResultIsTheExpected() {
    const expected = this.expectedSentenceAndResult;
    const current = this.currentSentenceResultAssociation();
    if (expected === null || expected.sentence === null || current.sentence === null) return false;
    return expected.sentence.equals(current.sentence)
      && expected.result !== null && current.result !== null && expected.result.equals(current.result);
  }

  // Estado que la vista usa para colorear los ojos: null | 'green' | 'red'.
  eyesColor() {
    if (!this.consideredElement() || !this.hasExpectedResult()) return null;
    return this.currentResultIsTheExpected() ? 'green' : 'red';
  }

  balloonText() {
    if (this.eyesColor() === 'red') return 'expected: ' + String(this.expectedSentenceAndResult.result);
    return super.balloonText();
  }
}

registerItemClass(EvalAndSeeItem);
