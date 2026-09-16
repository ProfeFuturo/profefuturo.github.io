import { isSentence, isVisualSymbol, termEquals } from '../Terms.js';

// Categorías universales: no tienen elementos enumerables, deciden la pertenencia
// por la forma de la entidad. Son las que usan los comodines:
//   'word'         → cualquier término individual (palabra o símbolo)
//   'visualSymbol' → cualquier símbolo visual genérico (no referencia un elemento del tablero)
//   'phrase'       → cualquier secuencia no vacía de términos (jokerWithBalls)
//   'pairOfTheSame'→ dos términos iguales (jokerDouble)
class UniversalCategory {
  constructor(name) {
    this.name = name;
    this.topic = null;
  }
  subcategories() { return []; }
  isSingular() { return false; }
  isUniversalUnlimited() { return false; }
  isUniversalLimited() { return true; }
  isByDefinition() { return false; }
  allParticularTermsSatisfy() { return true; }
  add() { throw new Error('Can Not Add Elements To A Universal Category'); }
  removeElement() { throw new Error('Can Not Remove Elements From A Universal Category'); }
  unionCategoryByExtension() { return this; }
  equals(other) { return other !== null && other.constructor === this.constructor; }
  clearCategoryCache() {}
  toString() { return 'universal category "' + String(this.name) + '"'; }
}

export class CategoryOfAllIndividualSymbols extends UniversalCategory {
  includes(entity) { return !isSentence(entity) || entity.length === 1; }
  isSingular() { return true; }
}

export class CategoryOfAllIndividualVisualSymbols extends UniversalCategory {
  includes(entity) { return isVisualSymbol(entity) && !entity.doesReferenceAParticularElementOnBoard(); }
  isSingular() { return true; }
}

export class CategoryOfAllPhrases extends UniversalCategory {
  includes(entity) { return isSentence(entity) ? entity.length > 0 : true; }
  isUniversalUnlimited() { return true; }
  isUniversalLimited() { return false; }
}

export class CategoryOfEveryPairOfTheSameSymbol extends UniversalCategory {
  includes(entity) { return isSentence(entity) && entity.length === 2 && termEquals(entity[0], entity[1]); }
}
