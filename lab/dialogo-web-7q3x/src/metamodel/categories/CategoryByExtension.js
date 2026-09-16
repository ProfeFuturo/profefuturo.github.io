import { TermSet, isSentence } from '../Terms.js';

// Categoría definida por extensión: el conjunto de términos que la integran.
// Cada elemento puede ser a su vez el nombre de otra categoría (pertenencia recursiva,
// resuelta por StateOfArt.symbolBelongsTo).
export class CategoryByExtension {
  constructor(name, elements = []) {
    this.name = name;
    this.elements = new TermSet(elements);
    this.topic = null;
  }

  static named(name, elements) {
    return new CategoryByExtension(name, elements);
  }

  includes(entity) {
    return !isSentence(entity) && this.elements.has(entity);
  }

  // Términos por los que se sigue buscando pertenencia (do: en Smalltalk).
  subcategories() {
    return this.elements.toArray();
  }

  isSingular() { return true; }
  isUniversalUnlimited() { return false; }
  isUniversalLimited() { return false; }
  isByDefinition() { return false; }

  allParticularTermsSatisfy(condition) {
    return this.elements.toArray().every(condition);
  }

  add(term) { this.elements.add(term); }
  removeElement(term) { this.elements.delete(term); }

  unionCategoryByExtension(other) {
    for (const term of this.elements) other.add(term);
    return other;
  }

  equals(other) {
    return other instanceof CategoryByExtension && this.elements.equals(other.elements);
  }

  clearCategoryCache() {}

  toString() {
    return 'category "' + String(this.name) + '" with elements: ' + this.elements.toArray().map(String).join(' ');
  }
}
