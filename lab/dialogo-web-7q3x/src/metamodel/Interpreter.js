import { Sentence } from './Sentence.js';
import { EvaluationMonitor } from './EvaluationMonitor.js';

export const TIMEOUT_ERROR_MESSAGE = 'Time out';

// Evalúa oraciones aplicando sustituciones hasta que ninguna aplica:
//   1. si alguna relación aplica a la oración entera, se aplica (eligiendo la prioritaria)
//      y se vuelve a evaluar el resultado;
//   2. si no, se buscan subsentencias (las más largas primero, de izquierda a derecha)
//      a las que aplique alguna relación "tal cual"; se reemplaza la primera que cambia
//      y se vuelve a evaluar la oración completa.
export class Interpreter {
  constructor(stateOfArt = null) {
    this.currentStateOfArt = stateOfArt;
    this.clearInterpreterCache();
  }

  initializeWithStateOfArt(stateOfArt) {
    this.currentStateOfArt = stateOfArt;
    stateOfArt.interpreter = this;
    this.clearInterpreterCache();
    return this;
  }

  clearInterpreterCache() {
    this.cacheOfEvaluations = new Map();
    this.cacheOfEvaluationsAsIs = new Map();
  }

  clearAllCache() { this.currentStateOfArt.clearAllCache(); }

  // --- evaluación ---

  // Sin monitor explícito la evaluación se protege sola: detecta recursión infinita y
  // corta a los 2 segundos (devuelve lo evaluado hasta ese momento).
  evaluateSentence(sentenceSource, monitor = EvaluationMonitor.protective()) {
    const sentence = Sentence.from(sentenceSource);
    monitor.startEvaluationOf(sentence);
    const result = this.evaluateCleanParsedSentence(sentence, monitor);
    monitor.finalResult(result);
    return result;
  }

  // Evalúa con límite de tiempo. Si se agota, ejecuta onTimeout y devuelve su valor.
  evaluateSentenceWithin(sentenceSource, monitor, timeoutMs, onTimeout) {
    monitor.timeoutMs = timeoutMs;
    const result = this.evaluateSentence(sentenceSource, monitor);
    if (monitor.timedOut) return onTimeout(monitor);
    return result;
  }

  evaluateSentenceForTwoSecondsIfTimeoutRiseError(sentenceSource, monitor) {
    return this.evaluateSentenceWithin(sentenceSource, monitor, 2000, () => { throw new Error(TIMEOUT_ERROR_MESSAGE); });
  }

  evaluateParagraph(sentences) {
    let last = new Sentence();
    for (const sentence of sentences) last = this.evaluateSentence(sentence);
    return last;
  }

  timeoutErrorMessage() { return TIMEOUT_ERROR_MESSAGE; }

  // Evaluación completa: primero la oración entera, después subsentencias.
  // Es un bucle (y no recursión) para que evaluaciones largas no desborden la pila.
  evaluateCleanParsedSentence(sentence, monitor) {
    const useCache = monitor.notInspecting();
    const visited = [];
    let current = sentence;
    while (true) {
      if (useCache) {
        const cached = this.cacheOfEvaluations.get(current.key());
        if (cached !== undefined) { current = cached; break; }
      }
      visited.push(current);
      if (monitor.shouldStop()) break;
      const relations = this.currentStateOfArt.selectSubstitutionsThatCanBeAppliedForSentence(current, monitor);
      if (relations.size === 0) {
        const partiallyEvaluated = this.evaluateAnySubsentenceFromSentence(current, monitor);
        if (partiallyEvaluated.equals(current)) break;
        current = partiallyEvaluated;
        continue;
      }
      const result = this.evaluateCleanParsedSentenceAsIsSelectingThePriorityRelationBetween(current, relations, monitor);
      if (result.equals(current)) break;
      current = this.evaluateCleanParsedSentenceAsIs(result, monitor);
    }
    const evaluation = current;
    monitor.ifOnlySymbolicSubstitutionsTookPlace(() => {
      for (const each of visited) this.cacheOfEvaluations.set(each.key(), evaluation);
    });
    return evaluation;
  }

  // "Tal cual": si ninguna relación aplica a la oración entera, la devuelve sin tocar
  // (no busca subsentencias). Si alguna aplica, el resultado sí se evalúa por completo.
  evaluateCleanParsedSentenceAsIs(sentence, monitor) {
    const useCache = monitor.notInspecting();
    const visited = [];
    let current = sentence;
    let anyApplied = false;
    let cached = false;
    while (true) {
      if (useCache) {
        const cachedEvaluation = this.cacheOfEvaluationsAsIs.get(current.key());
        if (cachedEvaluation !== undefined) { current = cachedEvaluation; cached = true; break; }
      }
      visited.push(current);
      if (monitor.shouldStop()) break;
      const relations = this.currentStateOfArt.selectSubstitutionsThatCanBeAppliedForSentence(current, monitor);
      if (relations.size === 0) break;
      const result = this.evaluateCleanParsedSentenceAsIsSelectingThePriorityRelationBetween(current, relations, monitor);
      if (result.equals(current)) break;
      current = result;
      anyApplied = true;
    }
    if (anyApplied && !cached) current = this.evaluateCleanParsedSentence(current, monitor);
    const evaluation = current;
    monitor.ifOnlySymbolicSubstitutionsTookPlace(() => {
      for (const each of visited) this.cacheOfEvaluationsAsIs.set(each.key(), evaluation);
    });
    return evaluation;
  }

  evaluateCleanParsedSentenceAsIsSelectingThePriorityRelationBetween(sentence, relations, monitor) {
    const relationToApply = this.selectPrioritySubstitutionFrom(relations, sentence);
    const result = relationToApply.applyOnParsedSentence(sentence, this.currentStateOfArt, monitor);
    monitor.addSubstitutionForSentence(sentence, result, relationToApply, relations);
    return result;
  }

  // Busca la subsentencia más larga (de izquierda a derecha) a la que aplique alguna
  // relación tal cual, y la reemplaza por su evaluación.
  evaluateAnySubsentenceFromSentence(sentence, monitor) {
    monitor.incrementSubsentenceEvaluationLevel();
    for (let termsTaken = sentence.length - 1; termsTaken > 0; termsTaken--) {
      for (let position = 0; position + termsTaken <= sentence.length; position++) {
        const subsentence = sentence.slice(position, position + termsTaken);
        const subsentenceResult = this.evaluateCleanParsedSentenceAsIs(subsentence, monitor);
        if (!subsentenceResult.equals(subsentence)) {
          const leftSide = sentence.slice(0, position);
          const rightSide = sentence.slice(position + termsTaken);
          const result = new Sentence();
          result.push(...leftSide, ...subsentenceResult, ...rightSide);
          monitor.subsentenceEvaluated(leftSide, rightSide);
          monitor.decrementSubsentenceEvaluationLevel();
          return result;
        }
        monitor.removeLastSubstitutionAddedIfResultIs(subsentenceResult);
      }
    }
    monitor.decrementSubsentenceEvaluationLevel();
    return sentence;
  }

  // --- inspección ---

  existsASubstitutionThatAppliesTo(sentenceSource) {
    const sentence = Sentence.from(sentenceSource);
    return this.currentStateOfArt.selectSubstitutionsThatCanBeAppliedForSentence(sentence, EvaluationMonitor.fast()).size > 0;
  }

  substitutionsBlockingChangeInModelInTheEvaluationOfSentence(sentenceSource, timeoutMs = 2000) {
    const monitor = EvaluationMonitor.inspector();
    this.evaluateSentenceWithin(sentenceSource, monitor, timeoutMs, () => null);
    return monitor.substitutionsToBrowse();
  }

  symbolIsCategorizedBy(symbol, category) { return this.currentStateOfArt.symbolBelongsTo(symbol, category); }
  symbolsCategorizedBy(category) { return this.currentStateOfArt.symbolsCategorizedBy(category); }
  detectRelationBySequenceOfCategories(sequence) { return this.currentStateOfArt.detectRelationBySequenceOfCategories(sequence); }
  changeLockingStateOfTopic(topic) { this.currentStateOfArt.changeLockingStateOfTopic(topic); }
  isLocked(topic) { return this.currentStateOfArt.isLocked(topic); }
  setHighPriorityOfRelationByMatchingRuleName(sequence) { return this.currentStateOfArt.setHighPriorityOfRelationByMatchingRuleName(sequence); }

  // --- prioridad entre relaciones que aplican a la misma oración ---

  selectPrioritySubstitutionFrom(matchingSubstitutions, sentence) {
    let candidates = [...matchingSubstitutions];
    if (candidates.length === 1) return candidates[0];
    candidates = this.selectWithHigherPriority(candidates);
    if (candidates.length === 1) return candidates[0];
    candidates = this.selectWithMoreTerms(candidates);
    candidates = this.selectWithMoreExactTermsIn(candidates, sentence);
    if (candidates.length === 1) return candidates[0];
    candidates = this.selectWithLessAbstractCategories(candidates);
    if (candidates.length === 1) return candidates[0];
    candidates = this.selectWithMoreConditionals(candidates);
    if (candidates.length === 1) return candidates[0];
    return this.selectFirstInAlphabeticalOrderFrom(candidates);
  }

  selectWithHigherPriority(relations) {
    let selected = relations.filter(relation => relation.hasHighPriority());
    if (selected.length === 0) selected = relations.filter(relation => relation.hasMediumPriority());
    if (selected.length === 0) selected = relations;
    return selected;
  }

  selectWithMoreTerms(relations) {
    return this.selectMaximizing(relations, relation => relation.matchingDetector().size);
  }

  selectWithMoreExactTermsIn(relations, sentence) {
    return this.selectMaximizing(relations, relation => relation.exactTermsOnSentence(sentence));
  }

  selectWithLessAbstractCategories(relations) {
    return this.selectMaximizing(relations, relation => -this.currentStateOfArt.degreeOfAbstractionOfSubstitution(relation));
  }

  selectWithMoreConditionals(relations) {
    return this.selectMaximizing(relations, relation => relation.numberOfConditions());
  }

  selectMaximizing(relations, measure) {
    let best = -Infinity;
    let selected = [];
    for (const relation of relations) {
      const value = measure(relation);
      if (value > best) { best = value; selected = [relation]; }
      else if (value === best) selected.push(relation);
    }
    return selected;
  }

  selectFirstInAlphabeticalOrderFrom(relations) {
    return [...relations].sort((a, b) => a.matchingDenomination() < b.matchingDenomination() ? -1 : 1)[0];
  }
}
