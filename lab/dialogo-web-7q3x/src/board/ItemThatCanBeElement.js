import { ItemOnBoard } from './ItemOnBoard.js';
import { Sentence } from '../metamodel/Sentence.js';
import { Point } from './Point.js';
import { EvaluationMonitor } from '../metamodel/EvaluationMonitor.js';
import { TIMEOUT_ERROR_MESSAGE } from '../metamodel/Interpreter.js';

// Ítems que pueden ser elementos del mundo (dibujos y el REPL). Como elementos con
// categoría PrintIt evalúan la oración a su izquierda y estampan el resultado a la derecha.
export class ItemThatCanBeElement extends ItemOnBoard {
  constructor(visualSymbol, boardModel) {
    super(visualSymbol, boardModel);
    this.consideredSymbol = false;
    this.sentenceToTheLeft = null;
    this.resultToTheRight = null;
    this.evaluationMonitor = null;
    this.destiny = null;
  }

  static isFor() { return false; }

  invertSymbolicStateIfCanBeElement() {
    this.consideredSymbol = !this.consideredSymbol;
    this.refreshSymbolicCondition();
  }

  setDestinyIfChanged(currentDestiny, whenChanged) {
    if (this.destiny !== currentDestiny) {
      this.destiny = currentDestiny;
      this.direction = Point.ZERO;
      whenChanged();
    }
  }

  // --- REPL ---

  restartOn(board) {
    this.removePreviousResultsOnBoard(board);
    this.resultToTheRight = new Sentence();
    this.printResultsOnBoard(board);
    this.changed();
  }

  ifNotRunningRestartOn(board) { this.restartOn(board); }

  printResultsOnBoard(board) {
    if (this.consideredSymbol) return;
    this.boardModel = board;
    this.sentenceToTheLeft = board.sentenceToTheLeftOf(this);
    this.clearHighlightsOnSentenceToEval();
    this.evaluationMonitor = new EvaluationMonitor({ inspecting: true, allowsChanges: true, boardModel: board });
    try {
      this.resultToTheRight = board.interpreter.evaluateSentenceWithin(this.sentenceToTheLeft, this.evaluationMonitor, 2000,
        () => { throw new Error(TIMEOUT_ERROR_MESSAGE); });
      board.addSymbolsToTheRightOf(this.resultToTheRight, this);
    } catch (error) {
      this.highlightErrorOnSentenceToEvalWithMessage(error.message);
    }
    this.evaluationMonitor.ifShouldOpenInspectorAtEndOfEval(() => board.addInspectorFrom(this.evaluationMonitor));
  }

  addPreviousResultsOnBoard(board) {
    if (this.resultToTheRight !== null) board.addSymbolsToTheRightOf(this.resultToTheRight, this);
    return this.resultToTheRight;
  }

  removePreviousResultsOnBoard(board) {
    if (this.resultToTheRight !== null) board.removeSymbolsToTheRightOf(this.resultToTheRight, this);
    return this.resultToTheRight;
  }

  clearHighlightsOnSentenceToEval() {
    for (const each of this.boardModel.symbolicItemsToTheLeftOf(this)) each.removeErrorHighlight();
  }

  highlightErrorOnSentenceToEvalWithMessage(message) {
    for (const each of this.boardModel.symbolicItemsToTheLeftOf(this)) each.highlightErrorOnEvaluationWithMessage(message);
  }
}
