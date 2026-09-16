import { Sentence } from './Sentence.js';
import { SubstitutionRelation } from './SubstitutionRelation.js';
import { CategoryMatcher } from './CategoryMatcher.js';
import { termKey, isSentence } from './Terms.js';

// Sustitución definida por el usuario: `what` (categorías/términos) → `how` (oración).
// Es la que se crea con "phrase -> phrase". Cada término de `how` que nombra una
// posición de `what` se reemplaza por lo que esa posición consumió en la oración.
export class SubstitutionBetweenSymbols extends SubstitutionRelation {
  constructor(matcher, what, how) {
    super(matcher, what, Sentence.from(how));
  }

  static forWhat(what, how) {
    what = Sentence.from(what);
    return new SubstitutionBetweenSymbols(CategoryMatcher.fromCategories(what), what, how);
  }

  isBetweenWords() { return true; }

  applyOnPreparedSentence(bindings) {
    const result = new Sentence();
    const indexOfTerms = new Map();
    for (const term of this.how) {
      const translated = this.translateEntity(term, bindings, indexOfTerms);
      if (isSentence(translated)) result.push(...translated);
      else result.push(translated);
    }
    return result;
  }

  // Si la misma categoría aparece varias veces en `what`, cada aparición en `how`
  // toma la posición siguiente (permite "word union word -> word word").
  translateEntity(term, bindings, indexOfTerms) {
    const firstIndex = this.what.indexOf(term);
    if (firstIndex < 0) return term;
    const key = termKey(term);
    let index = firstIndex;
    if (indexOfTerms.has(key)) {
      index = this.what.indexOf(term, indexOfTerms.get(key) + 1);
      if (index < 0) index = firstIndex;
    }
    indexOfTerms.set(key, index);
    return bindings[index];
  }

  // La definición como oración de símbolos: what ➜ how (para el inspector).
  visualDefinition(stateOfArt) {
    const definition = new Sentence();
    definition.push(...this.what, stateOfArt.pointSymbol, ...this.how);
    return definition;
  }

  toString() {
    return this.what.toString() + ' -> ' + this.how.toString();
  }
}
