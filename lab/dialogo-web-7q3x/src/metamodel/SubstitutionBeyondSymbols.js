import { Sentence } from './Sentence.js';
import { SubstitutionRelation } from './SubstitutionRelation.js';
import { CategoryMatcher } from './CategoryMatcher.js';
import { isVisualSymbol } from './Terms.js';

// Sustitución "más allá de los símbolos": el resultado lo produce una función JS que
// recibe el monitor y una entrada por posición del patrón. Son las relaciones
// fundamentales (definir categorías, definir sustituciones, teleport, ...).
export class SubstitutionBeyondSymbols extends SubstitutionRelation {
  static forCategories(categories, roles, processingMethod) {
    return new SubstitutionBeyondSymbols(CategoryMatcher.fromCategoriesAndRoles(categories, roles), roles, processingMethod);
  }

  applyOnPreparedSentence(bindings, stateOfArt, monitor) {
    const result = this.how(monitor, ...bindings);
    return Sentence.from(result === undefined || result === null ? [] : result);
  }

  // Una relación fundamental se muestra por los símbolos predefinidos de la parte evaluada.
  visualDefinition(stateOfArt, partEvaluated = []) {
    return Sentence.from([...partEvaluated].filter(term => isVisualSymbol(term) && term.isPredefined()));
  }

  toString() {
    return this.for.asDefined() + ': fundamental substitution';
  }
}
