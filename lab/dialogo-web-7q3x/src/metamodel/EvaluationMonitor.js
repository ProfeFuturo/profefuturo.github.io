import { Sentence } from './Sentence.js';
import { Substitution } from './Substitution.js';
import { NullSubstitutionRelation } from './SubstitutionRelation.js';

export const INFINITE_LOOP_ERROR_MESSAGE = 'Looks like infinite recursion';

// Acompaña una evaluación del intérprete. Reemplaza a la jerarquía de 13 monitores
// del paquete Smalltalk con opciones:
//   inspecting:          registra la cadena de sustituciones (para el inspector) y no usa cachés
//   allowsChanges:       permite que las relaciones fundamentales modifiquen el StateOfArt
//   maxSubstitutions:    corta la evaluación al llegar a ese número de pasos
//   timeoutMs:           corta la evaluación pasado ese tiempo (todo es sincrónico)
//   detectsInfiniteLoops: lanza un error si detecta que se repite la misma sustitución
// CollisionMonitor y TeleportMonitor (en board/) agregan el contexto del tablero.
export class EvaluationMonitor {
  constructor({ inspecting = false, allowsChanges = true, maxSubstitutions = 20000, timeoutMs = null, detectsInfiniteLoops = false, boardModel = null, clock = Date.now } = {}) {
    this.clock = clock;
    this.inspecting = inspecting;
    this.allowsChanges = allowsChanges;
    this.maxSubstitutions = maxSubstitutions;
    this.timeoutMs = timeoutMs;
    this.detectsInfiniteLoops = detectsInfiniteLoops;
    this.boardModel = boardModel;
    this.substitutionChain = [];
    this.substitutionsCount = 0;
    this.onlySymbolicSubstitutionsSoFar = true;
    this.openInspectorAtEndOfEvalRequested = false;
    this.subsentenceEvaluationLevel = 0;
    this.substitutionsWithoutAnalizingForLoops = 0;
    this.initialSentence = null;
    this.evaluationResult = null;
    this.evaluationEnded = false;
    this.timedOut = false;
    this.stopped = false;
    this.deadline = null;
  }

  static inspector(options = {}) {
    return new EvaluationMonitor({ inspecting: true, allowsChanges: false, ...options });
  }

  static protective(options = {}) {
    return new EvaluationMonitor({ detectsInfiniteLoops: true, timeoutMs: 2000, ...options });
  }

  static fast(options = {}) {
    return new EvaluationMonitor({ inspecting: false, allowsChanges: true, ...options });
  }

  // --- protocolo usado por el intérprete ---

  startEvaluationOf(sentence) {
    this.initialSentence = sentence;
    if (this.timeoutMs !== null) this.deadline = this.clock() + this.timeoutMs;
  }

  finalResult(result) {
    this.evaluationResult = result;
    this.evaluationEnded = true;
    if (this.inspecting) {
      this.addSubstitution(new Substitution({
        subsentenceEvaluated: result, completeSentence: result, result,
        relationApplied: new NullSubstitutionRelation(), nonAppliedMatchingRelations: [],
        subsentenceEvaluationLevel: 0,
      }));
    }
  }

  shouldStop() {
    if (this.stopped) return true;
    if (this.deadline !== null && this.clock() > this.deadline) { this.timedOut = true; return true; }
    return this.substitutionsCount >= this.maxSubstitutions;
  }

  stopEvaluating() { this.stopped = true; }

  notInspecting() { return !this.inspecting; }

  addSubstitutionForSentence(sentence, result, relationApplied, matchingRelations) {
    this.substitutionsCount++;
    if (!this.inspecting && !this.detectsInfiniteLoops) return;
    const nonApplied = [...matchingRelations].filter(relation => relation !== relationApplied);
    this.addSubstitution(new Substitution({
      subsentenceEvaluated: sentence, completeSentence: sentence, result, relationApplied,
      nonAppliedMatchingRelations: nonApplied, subsentenceEvaluationLevel: this.subsentenceEvaluationLevel,
    }));
  }

  addSubstitution(substitution) {
    this.substitutionChain.push(substitution);
    if (this.detectsInfiniteLoops) this.analizeForInfiniteLoops();
  }

  analizeForInfiniteLoops() {
    this.substitutionsWithoutAnalizingForLoops++;
    if (this.substitutionsWithoutAnalizingForLoops <= this.substitutionChain.length / 2 + 1) return;
    this.substitutionsWithoutAnalizingForLoops = 0;
    const chain = this.substitutionChain;
    const numberToCompare = Math.floor(chain.length / 30);
    const last = chain[chain.length - 1];
    for (let index = chain.length - 1 - numberToCompare; index < chain.length - 1; index++) {
      if (index >= 0 && chain[index].equals(last)) throw new Error(INFINITE_LOOP_ERROR_MESSAGE);
    }
  }

  removeLastSubstitutionAddedIfResultIs(result) {
    if (!this.inspecting || this.substitutionChain.length === 0) return;
    const last = this.substitutionChain[this.substitutionChain.length - 1];
    if (last.completeSentenceEvaluated.equals(result)) this.substitutionChain.pop();
  }

  incrementSubsentenceEvaluationLevel() { this.subsentenceEvaluationLevel++; }
  decrementSubsentenceEvaluationLevel() { this.subsentenceEvaluationLevel--; }

  // Una subsentencia fue evaluada dentro de una oración mayor: recompone los pasos
  // registrados en ese nivel con lo que quedó a izquierda y derecha.
  subsentenceEvaluated(leftSide, rightSide) {
    if (!this.inspecting) return;
    for (const substitution of this.substitutionChain) {
      if (substitution.subsentenceEvaluationLevel >= this.subsentenceEvaluationLevel) {
        substitution.recompose(leftSide, rightSide);
        substitution.subsentenceEvaluationLevel = this.subsentenceEvaluationLevel - 1;
      }
    }
  }

  ifOnlySymbolicSubstitutionsTookPlace(action) {
    if (this.onlySymbolicSubstitutionsSoFar) action();
  }

  relationBeyondSymbolsEvaluated() {
    this.onlySymbolicSubstitutionsSoFar = false;
  }

  // Las relaciones fundamentales piden permiso para modificar el StateOfArt o el tablero.
  allow(change) {
    return this.allowsChanges ? change() : undefined;
  }

  // --- inspección ---

  hasRecordedAnySubstitution() { return this.substitutionChain.length > 0; }

  substitutionsToBrowse() {
    if (this.substitutionChain.length === 0) return [];
    const toBrowse = [this.substitutionChain[0]];
    let lastAdded = this.substitutionChain[0];
    for (const substitution of this.substitutionChain) {
      if (!lastAdded.hasSameSentenceAndRelationsAppliedThan(substitution)) {
        toBrowse.push(substitution);
        lastAdded = substitution;
      }
    }
    return toBrowse;
  }

  openInspectorAtEndOfEval() { this.openInspectorAtEndOfEvalRequested = true; }

  ifShouldOpenInspectorAtEndOfEval(action) {
    if (this.openInspectorAtEndOfEvalRequested) action();
  }

  // --- contexto del tablero (redefinido por CollisionMonitor / TeleportMonitor) ---

  elementArriving() { return null; }
  elementInPosition() { return null; }
  positionOfCollision() { return null; }
  noticeThatTeleportWasMade() {}
  wasTeleportMade() { return false; }

  teleportee() {}

  adjacentElementsReferencedBy(adjacentCellSequence) {
    return Sentence.from(adjacentCellSequence);
  }
}
