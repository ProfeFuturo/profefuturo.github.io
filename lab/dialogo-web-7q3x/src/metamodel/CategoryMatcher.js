import { Sentence } from './Sentence.js';
import { termEquals, termKey, isSentence } from './Terms.js';

// Detecta si una relación de sustitución aplica a una oración.
// El patrón es una secuencia de categorías (o términos exactos). Cada posición del
// patrón consume una parte consecutiva de la oración:
//   - un término exacto o una categoría "singular" ('word', 'visualSymbol', por extensión
//     de términos individuales) consume exactamente un término;
//   - las demás categorías ('phrase', 'pairOfTheSame', por construcción, o por extensión
//     que incluya frases) consumen uno o más términos.
// La búsqueda es por backtracking, probando primero las partes más cortas
// (equivale a preferir la primera ocurrencia de los términos exactos).
export class CategoryMatcher {
  constructor(sequenceOfCategories, sequenceOfRoles = sequenceOfCategories) {
    this.sequenceOfCategories = Sentence.from(sequenceOfCategories);
    this.sequenceOfRoles = Sentence.from(sequenceOfRoles);
    this.clearRelationCache();
  }

  static fromCategoriesAndRoles(categories, roles) {
    return new CategoryMatcher(categories, roles);
  }

  static fromCategories(categories) {
    return new CategoryMatcher(categories, categories);
  }

  get size() { return this.sequenceOfCategories.length; }
  at(index) { return this.sequenceOfCategories[index]; }
  firstTerm() { return this.sequenceOfCategories.first(); }
  lastTerm() { return this.sequenceOfCategories.last(); }
  doOnCategories(action) { this.sequenceOfCategories.forEach(action); }
  includesClass(categoryName) { return this.sequenceOfCategories.includes(categoryName); }

  // Denominación única de la relación: la secuencia de categorías.
  matchingDenomination() {
    return this.sequenceOfCategories.key();
  }

  matchingDenominationEquals(sequence) {
    return this.matchingDenomination() === Sentence.from(sequence).key();
  }

  asDefined() {
    return this.sequenceOfCategories.toString();
  }

  equals(other) {
    return other instanceof CategoryMatcher && this.matchingDenomination() === other.matchingDenomination();
  }

  hasConditions() { return false; }
  numberOfConditions() { return 0; }

  clearRelationCache() {
    this.cacheOfAcceptedSentenceCombinations = new Map();
    this.cacheOfRejectedSentences = new Set();
  }

  answerIfAppliesTo(sentence, stateOfArt) {
    return this.combinationThatApplyForSentence(sentence, stateOfArt) !== null;
  }

  // Devuelve un array con una entrada por posición del patrón (el término o la frase
  // consumida), o null si la relación no aplica.
  // La caché guarda sólo cuántos términos consume cada posición: dos oraciones iguales
  // (mismos hashes) pueden tener símbolos "en particular" distintos, y los términos
  // devueltos tienen que ser los de la oración que se está evaluando.
  combinationThatApplyForSentence(sentence, stateOfArt) {
    const key = sentence.key();
    const accepted = this.cacheOfAcceptedSentenceCombinations.get(key);
    if (accepted !== undefined) return CategoryMatcher.bindingsFrom(sentence, accepted);
    if (this.cacheOfRejectedSentences.has(key)) return null;
    const bindings = this.match(sentence, stateOfArt);
    if (bindings === null) this.cacheOfRejectedSentences.add(key);
    else this.cacheOfAcceptedSentenceCombinations.set(key, bindings.map(binding => isSentence(binding) ? binding.length : 1));
    return bindings;
  }

  static bindingsFrom(sentence, lengths) {
    const bindings = [];
    let position = 0;
    for (const length of lengths) {
      bindings.push(length === 1 ? sentence[position] : sentence.slice(position, position + length));
      position += length;
    }
    return bindings;
  }

  match(sentence, stateOfArt) {
    const categories = this.sequenceOfCategories;
    if (sentence.length < categories.length) return null;
    const singles = categories.map(category =>
      !stateOfArt.includesCategory(category) || stateOfArt.canOnlyMatchWithOneTerm(category));
    if (singles.every(single => single) && sentence.length !== categories.length) return null;
    for (let index = 0; index < categories.length; index++) {
      if (!stateOfArt.includesCategory(categories[index]) && !sentence.includes(categories[index])) return null;
    }
    const bindings = new Array(categories.length);
    return this.matchFrom(0, sentence, 0, singles, bindings, stateOfArt) ? bindings : null;
  }

  matchFrom(index, sentence, position, singles, bindings, stateOfArt) {
    const categories = this.sequenceOfCategories;
    if (index === categories.length) return position === sentence.length;
    const remaining = sentence.length - position;
    const positionsLeft = categories.length - index;
    if (remaining < positionsLeft) return false;
    const category = categories[index];
    const maxLength = singles[index] ? 1 : remaining - (positionsLeft - 1);
    for (let length = 1; length <= maxLength; length++) {
      const part = length === 1 ? sentence[position] : sentence.slice(position, position + length);
      if (this.entityIsMemberOf(part, category, stateOfArt)) {
        bindings[index] = part;
        if (this.matchFrom(index + 1, sentence, position + length, singles, bindings, stateOfArt)) return true;
      }
    }
    return false;
  }

  entityIsMemberOf(entity, category, stateOfArt) {
    if (!isSentence(entity) && termEquals(entity, category)) return true;
    return stateOfArt.symbolBelongsTo(entity, category);
  }

  toString() {
    return 'CategoryMatcher(' + this.asDefined() + ')';
  }
}

export { termKey };
