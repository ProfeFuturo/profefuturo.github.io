import { Sentence } from './Sentence.js';

// Un paso de una evaluación, registrado por el monitor para el inspector:
// qué subsentencia se evaluó, dentro de qué oración completa, con qué relación
// y qué resultado dio.
export class Substitution {
  constructor({ subsentenceEvaluated, completeSentence, result, relationApplied, nonAppliedMatchingRelations, subsentenceEvaluationLevel }) {
    this.subsentenceEvaluated = Sentence.from(subsentenceEvaluated);
    this.completeSentenceEvaluated = Sentence.from(completeSentence);
    this.result = Sentence.from(result);
    this.relationApplied = relationApplied;
    this.nonAppliedMatchingRelations = nonAppliedMatchingRelations;
    this.subsentenceEvaluationLevel = subsentenceEvaluationLevel;
    this.beginOfEvaluatedPart = 0;
  }

  sentenceEvaluated() { return this.completeSentenceEvaluated; }

  // Cuando una subsentencia se evaluó dentro de una oración mayor, se recompone la
  // oración completa agregando lo que quedó a izquierda y derecha.
  recompose(leftSide, rightSide) {
    const complete = new Sentence();
    complete.push(...leftSide, ...this.completeSentenceEvaluated, ...rightSide);
    const result = new Sentence();
    result.push(...leftSide, ...this.result, ...rightSide);
    this.completeSentenceEvaluated = complete;
    this.result = result;
    this.beginOfEvaluatedPart += leftSide.length;
  }

  startPositionOfSubsentence() { return this.beginOfEvaluatedPart; }
  endPositionOfSubsentence() { return this.beginOfEvaluatedPart + this.subsentenceEvaluated.length - 1; }

  equals(other) {
    return other instanceof Substitution
      && this.relationApplied.equals(other.relationApplied)
      && this.completeSentenceEvaluated.equals(other.completeSentenceEvaluated);
  }

  hasSameSentenceAndRelationsAppliedThan(other) {
    return this.equals(other) && this.subsentenceEvaluated.equals(other.subsentenceEvaluated);
  }

  isNullSubstitution() { return this.relationApplied.isNullRelation(); }

  toString() {
    return this.completeSentenceEvaluated.toString() + '\n' + this.subsentenceEvaluated.toString()
      + '\n' + this.relationApplied.toString() + '\n' + this.result.toString();
  }
}
