// Un término de una oración es una palabra (string sin espacios) o un VisualSymbol.
// Una frase (secuencia de términos) se representa con Sentence.
// Estas funciones definen la identidad de los términos: dos VisualSymbol son
// el mismo término si tienen el mismo hash (misma imagen o mismo predefinido).

export function isVisualSymbol(term) {
  return term !== null && typeof term === 'object' && term.isVisualSymbol === true;
}

export function isSentence(entity) {
  return Array.isArray(entity);
}

export function termKey(term) {
  return isVisualSymbol(term) ? 's:' + term.hash : 'w:' + term;
}

export function entityKey(entity) {
  return isSentence(entity) ? entity.map(termKey).join(' ') : termKey(entity);
}

export function termEquals(a, b) {
  if (a === b) return true;
  if (isVisualSymbol(a) && isVisualSymbol(b)) return a.hash === b.hash;
  return false;
}

export function termToString(term) {
  return isVisualSymbol(term) ? term.toString() : String(term);
}

// Set de términos con identidad por termKey.
export class TermSet {
  constructor(terms = []) {
    this.entries = new Map();
    for (const term of terms) this.add(term);
  }
  add(term) { this.entries.set(termKey(term), term); return this; }
  has(term) { return this.entries.has(termKey(term)); }
  delete(term) { return this.entries.delete(termKey(term)); }
  get size() { return this.entries.size; }
  [Symbol.iterator]() { return this.entries.values(); }
  toArray() { return [...this.entries.values()]; }
  equals(other) {
    if (this.size !== other.size) return false;
    for (const term of this) if (!other.has(term)) return false;
    return true;
  }
}

// Map con claves que son términos (identidad por termKey).
export class TermMap {
  constructor() { this.entries = new Map(); }
  get(term) { const entry = this.entries.get(termKey(term)); return entry === undefined ? undefined : entry.value; }
  set(term, value) { this.entries.set(termKey(term), { term, value }); return this; }
  has(term) { return this.entries.has(termKey(term)); }
  delete(term) { return this.entries.delete(termKey(term)); }
  get size() { return this.entries.size; }
  keys() { return [...this.entries.values()].map(e => e.term); }
  values() { return [...this.entries.values()].map(e => e.value); }
  clear() { this.entries.clear(); }
}
