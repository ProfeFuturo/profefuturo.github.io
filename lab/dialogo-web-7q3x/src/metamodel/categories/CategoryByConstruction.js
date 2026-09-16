import { Sentence } from '../Sentence.js';
import { TermSet, isSentence, entityKey, termEquals } from '../Terms.js';

// Categoría definida por construcción: una frase pertenece si se puede partir en
// partes consecutivas (no vacías) que pertenezcan, en orden, a cada categoría de la
// estructura. Ejemplo: adjacentCellSequence ::= adjacentCell adjacentCellSequence.
// Además conserva un conjunto por extensión (los elementos agregados con @).
export class CategoryByConstruction {
  constructor(name, structure, stateOfArt, previousElements = []) {
    this.name = name;
    this.structure = Sentence.from(structure);
    this.stateOfArt = stateOfArt;
    this.elements = new TermSet(previousElements);
    this.topic = null;
    this.inProgress = new Set();
  }

  includes(entity) {
    if (!isSentence(entity) && this.elements.has(entity)) return true;
    return this.includesByDefinition(entity);
  }

  includesByDefinition(entity) {
    const sequence = isSentence(entity) ? entity : Sentence.of(entity);
    const key = entityKey(sequence);
    if (this.inProgress.has(key)) return false;
    this.inProgress.add(key);
    try {
      return this.matchStructureFrom(0, sequence, 0);
    } finally {
      this.inProgress.delete(key);
    }
  }

  matchStructureFrom(structureIndex, sequence, position) {
    if (structureIndex === this.structure.length) return position === sequence.length;
    const remaining = sequence.length - position;
    const partsLeft = this.structure.length - structureIndex;
    if (remaining < partsLeft) return false;
    const category = this.structure[structureIndex];
    const maxLength = remaining - (partsLeft - 1);
    for (let length = 1; length <= maxLength; length++) {
      const part = length === 1 ? sequence[position] : sequence.slice(position, position + length);
      if (this.partBelongs(part, category) && this.matchStructureFrom(structureIndex + 1, sequence, position + length)) {
        return true;
      }
    }
    return false;
  }

  partBelongs(part, category) {
    if (!isSentence(part) && termEquals(part, category)) return true;
    return this.stateOfArt.symbolBelongsTo(part, category);
  }

  subcategories() {
    return this.elements.toArray();
  }

  isSingular() { return false; }
  isUniversalUnlimited() { return false; }
  isUniversalLimited() { return false; }
  isByDefinition() { return true; }

  allParticularTermsSatisfy(condition) {
    return this.elements.toArray().every(condition);
  }

  add(term) { this.elements.add(term); }
  removeElement(term) { this.elements.delete(term); }

  unionCategoryByExtension(other) {
    const copy = new CategoryByConstruction(this.name, this.structure, this.stateOfArt, this.elements);
    for (const term of other.elements) copy.add(term);
    copy.topic = this.topic;
    return copy;
  }

  equals(other) {
    return other instanceof CategoryByConstruction
      && this.elements.equals(other.elements)
      && this.structure.equals(other.structure);
  }

  clearCategoryCache() {}

  toString() {
    return 'category "' + String(this.name) + '" by construction: ' + this.structure.toString();
  }
}
