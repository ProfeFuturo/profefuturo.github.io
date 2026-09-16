import { termKey, termEquals, termToString, isVisualSymbol } from './Terms.js';

// Una oración: secuencia ordenada de términos (palabras o VisualSymbol).
// Equivale a Sentence < OrderedCollection en el paquete Smalltalk.
// No define constructor propio para que map/filter/slice sigan devolviendo Sentence.
export class Sentence extends Array {

  static fromWords(string) {
    return Sentence.from(string.split(/\s+/).filter(word => word.length > 0));
  }

  static withAll(terms) {
    return Sentence.from(terms);
  }

  // Acepta string (palabras separadas por espacios), VisualSymbol, array o Sentence.
  static from(source) {
    if (source instanceof Sentence) return source;
    if (typeof source === 'string') return Sentence.fromWords(source);
    if (isVisualSymbol(source)) return Sentence.of(source);
    return super.from(source);
  }

  key() {
    return this.map(termKey).join(' ');
  }

  equals(other) {
    if (!Array.isArray(other) || other.length !== this.length) return false;
    for (let index = 0; index < this.length; index++) {
      if (!termEquals(this[index], other[index])) return false;
    }
    return true;
  }

  isWord(word) {
    return this.length === 1 && this[0] === word;
  }

  includes(term) {
    return this.indexOf(term) >= 0;
  }

  indexOf(term, startingAt = 0) {
    for (let index = startingAt; index < this.length; index++) {
      if (termEquals(this[index], term)) return index;
    }
    return -1;
  }

  lastIndexOf(term) {
    for (let index = this.length - 1; index >= 0; index--) {
      if (termEquals(this[index], term)) return index;
    }
    return -1;
  }

  first() { return this[0]; }
  last() { return this[this.length - 1]; }

  isEmpty() { return this.length === 0; }

  allBefore(term) {
    const index = this.indexOf(term);
    return index < 0 ? this : this.slice(0, index);
  }

  toString() {
    return this.map(termToString).join(' ');
  }
}
