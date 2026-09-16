import { Sentence } from './Sentence.js';

// Relación de sustitución: cuando `for` (un CategoryMatcher) detecta que aplica a una
// oración, `how` produce el resultado. `what` son los roles (nombres) de cada posición.
export class SubstitutionRelation {
  constructor(matcher, what, how) {
    this.for = matcher;
    this.what = Sentence.from(what);
    this.how = how;
    this.priority = 'Low';
    this.breakPointActive = false;
    this.topic = null;
  }

  matchingDetector() { return this.for; }
  matchingDetectorDo(action) { this.for.doOnCategories(action); }
  matchingDenomination() { return this.for.matchingDenomination(); }
  matchingDenominationEquals(sequence) { return this.for.matchingDenominationEquals(sequence); }
  firstTerm() { return this.for.firstTerm(); }
  lastTerm() { return this.for.lastTerm(); }
  includesClass(categoryName) { return this.for.includesClass(categoryName); }
  isForTypes(sequence) { return this.for.matchingDenominationEquals(sequence); }

  equals(other) {
    return other instanceof SubstitutionRelation && this.matchingDenomination() === other.matchingDenomination();
  }

  isNullRelation() { return false; }
  isBetweenWords() { return false; }
  hasConditions() { return false; }
  numberOfConditions() { return 0; }

  answerIfAppliesTo(sentence, stateOfArt, monitor) {
    return this.for.answerIfAppliesTo(sentence, stateOfArt, monitor);
  }

  applyOnParsedSentence(sentence, stateOfArt, monitor) {
    if (this.inspectPointOn()) monitor.openInspectorAtEndOfEval();
    const bindings = this.for.combinationThatApplyForSentence(sentence, stateOfArt);
    return this.applyOnPreparedSentence(bindings, stateOfArt, monitor);
  }

  applyOnPreparedSentence() {
    throw new Error('subclassResponsibility');
  }

  // Cuántas categorías del patrón aparecen literalmente en la oración.
  exactTermsOnSentence(sentence) {
    let count = 0;
    this.for.doOnCategories(category => { if (sentence.includes(category)) count++; });
    return count;
  }

  setPriorityHigh() { this.priority = 'High'; return this; }
  setPriorityMedium() { this.priority = 'Medium'; return this; }
  setPriorityLow() { this.priority = 'Low'; return this; }
  hasHighPriority() { return this.priority === 'High'; }
  hasMediumPriority() { return this.priority === 'Medium'; }
  hasLowPriority() { return this.priority === 'Low'; }

  inspectPointOn() { return this.breakPointActive; }
  invertInspectPointState() { this.breakPointActive = !this.breakPointActive; }

  clearRelationCache() { this.for.clearRelationCache(); }

  textualDefinition() { return this.toString(); }
}

export class NullSubstitutionRelation {
  matchingDenomination() { return 'No relation to apply'; }
  visualDefinition() { return new Sentence(); }
  isNullRelation() { return true; }
  inspectPointOn() { return false; }
  textualDefinition() { return ''; }
  equals(other) { return other instanceof NullSubstitutionRelation; }
  toString() { return 'No relation definition'; }
}
