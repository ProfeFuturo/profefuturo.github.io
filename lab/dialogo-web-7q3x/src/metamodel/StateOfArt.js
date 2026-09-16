import { Sentence } from './Sentence.js';
import { TermMap, TermSet, termKey, entityKey, isSentence, isVisualSymbol } from './Terms.js';
import { CategoryByExtension } from './categories/CategoryByExtension.js';
import { CategoryByConstruction } from './categories/CategoryByConstruction.js';
import { SubstitutionBetweenSymbols } from './SubstitutionBetweenSymbols.js';

// El "estado del arte": todo lo que se sabe en un momento dado.
//   substitutions:   relaciones de sustitución (una por denominación)
//   categorizations: categorías por nombre (el nombre es un término: palabra o símbolo)
// Cada relación y categoría pertenece a un topic. Los topics bloqueados no se pueden
// modificar (protegen las definiciones básicas y las de proyectos reusados).
export class StateOfArt {
  constructor(interpreter = null) {
    this.interpreter = interpreter;
    this.substitutions = new Map();               // denominación → relación
    this.substitutionsByFirstTerm = new TermMap(); // término → Set de relaciones
    this.substitutionsByLastTerm = new TermMap();
    this.substitutionsWithCategoryOnEdges = new Set();
    this.categorizations = new TermMap();          // nombre → categoría
    this.lockedTopics = new Set();
    this.actualTopicInConstruction = 'Undefined';
    this.actualSectionInConstruction = 'Undefined';
    this.defaultPriority = 'Low';
    this.categorizeSymbol = '@';
    this.pointSymbol = '->';
    this.belongsToMemo = new Map();
    this.singleTermMemo = new Map();
  }

  // --- topics ---

  lockTopic(topic) { this.lockedTopics.add(topic); }
  unlockTopic(topic) { this.lockedTopics.delete(topic); }
  isLocked(topic) { return this.lockedTopics.has(topic); }
  changeLockingStateOfTopic(topic) { this.isLocked(topic) ? this.unlockTopic(topic) : this.lockTopic(topic); }

  topicOfSubstitutionRelation(relation) { return relation.topic; }
  topicOfCategory(name) { const category = this.categorizations.get(name); return category ? category.topic : 'Unknown Topic'; }

  relationsAtTopic(topic) {
    return [...this.substitutions.values()].filter(relation => relation.topic === topic);
  }

  namesOfSubstitutionsAtTopic(topic) {
    return this.relationsAtTopic(topic).map(relation => relation.matchingDenomination());
  }

  categoryListAtTopic(topic) {
    return this.categorizations.values().filter(category => category.topic === topic).map(category => category.name);
  }

  assertCanNotAdd(relation) {
    if (this.isLocked(this.actualTopicInConstruction)) {
      throw new Error('Can not add ' + relation + ' in locked topic ' + this.actualTopicInConstruction);
    }
  }

  assertCanNotAddCategory(name) {
    if (this.isLocked(this.actualTopicInConstruction)) {
      throw new Error('Can not add category ' + name + ' in locked topic ' + this.actualTopicInConstruction);
    }
  }

  assertCanNotChangeCategory(name) {
    const topic = this.topicOfCategory(name);
    if (this.isLocked(topic)) throw new Error('Can not change category ' + name + ' in locked topic ' + topic);
  }

  assertCanNotModify(relation) {
    if (this.isLocked(relation.topic)) throw new Error('Can not modify ' + relation + ' in locked topic ' + relation.topic);
  }

  assertCanNotRemove(relation) {
    if (this.isLocked(relation.topic)) throw new Error('Can not remove ' + relation + ' in locked topic ' + relation.topic);
  }

  // --- sustituciones ---

  setDefaultPriorityToMedium() { this.defaultPriority = 'Medium'; }

  addRelationFor(matcher, roleNames, processingMethod) {
    const relation = new SubstitutionBetweenSymbols(matcher, roleNames, processingMethod);
    relation.priority = this.defaultPriority;
    this.addSubstitutionRelationAsIs(relation);
    this.clearAllCache();
    return relation;
  }

  addSubstitutionRelationAsIs(relation) {
    this.assertCanNotAdd(relation);
    const previous = this.substitutions.get(relation.matchingDenomination());
    if (previous !== undefined) {
      this.assertCanNotModify(previous);
      this.basicRemoveRelation(previous);
    }
    relation.topic = this.actualTopicInConstruction;
    this.basicAddSubstitution(relation);
    return relation;
  }

  basicAddSubstitution(relation) {
    this.substitutions.set(relation.matchingDenomination(), relation);
    this.addToIndex(this.substitutionsByFirstTerm, relation.firstTerm(), relation);
    this.addToIndex(this.substitutionsByLastTerm, relation.lastTerm(), relation);
    if (this.includesCategory(relation.firstTerm()) && this.includesCategory(relation.lastTerm())) {
      this.substitutionsWithCategoryOnEdges.add(relation);
    }
  }

  addToIndex(index, term, relation) {
    let relations = index.get(term);
    if (relations === undefined) { relations = new Set(); index.set(term, relations); }
    relations.add(relation);
  }

  basicRemoveRelation(relation) {
    this.substitutions.delete(relation.matchingDenomination());
    const byFirst = this.substitutionsByFirstTerm.get(relation.firstTerm());
    if (byFirst) byFirst.delete(relation);
    const byLast = this.substitutionsByLastTerm.get(relation.lastTerm());
    if (byLast) byLast.delete(relation);
    this.substitutionsWithCategoryOnEdges.delete(relation);
  }

  removeSubstitutionRelation(relation) {
    this.assertCanNotRemove(relation);
    this.basicRemoveRelation(relation);
    this.clearAllCache();
  }

  removeSubstitutionRelationForCategories(denomination) {
    const relation = this.substitutions.get(denomination);
    if (relation === undefined) throw new Error('No relation named ' + denomination);
    this.removeSubstitutionRelation(relation);
  }

  detectRelationBySequenceOfCategories(sequence) {
    const relation = this.substitutions.get(Sentence.from(sequence).key());
    return relation === undefined ? null : relation;
  }

  detectSubstitutionByName(sequence) { return this.detectRelationBySequenceOfCategories(sequence); }

  priorityOfRelationByMatchingRuleName(sequence) {
    const relation = this.detectRelationBySequenceOfCategories(sequence);
    return relation === null ? null : relation.priority;
  }

  setHighPriorityOfRelationByMatchingRuleName(sequence) {
    const relation = this.detectRelationBySequenceOfCategories(sequence);
    if (relation !== null) { relation.setPriorityHigh(); this.clearAllCache(); }
    return relation;
  }

  listOfRelationsMatchingRules() {
    return [...this.substitutions.keys()];
  }

  substitutionRelationsStartingWithTheWord(word) {
    return [...this.substitutions.values()].filter(relation => relation.firstTerm() === word);
  }

  // Candidatas a aplicar: las indexadas por el primer o último término de la oración,
  // más las que tienen categorías en ambos extremos. Se filtran preguntando al matcher.
  selectSubstitutionsThatCanBeAppliedForSentence(sentence, monitor) {
    const result = new Set();
    if (sentence.length === 0) return result;
    const candidates = new Set(this.substitutionsWithCategoryOnEdges);
    for (const relation of this.substitutionsByFirstTerm.get(sentence.first()) || []) candidates.add(relation);
    for (const relation of this.substitutionsByLastTerm.get(sentence.last()) || []) candidates.add(relation);
    for (const relation of candidates) {
      if (relation.answerIfAppliesTo(sentence, this, monitor)) result.add(relation);
    }
    return result;
  }

  // --- categorías ---

  includesCategory(name) { return this.categorizations.has(name); }

  categoryNamed(name) { const category = this.categorizations.get(name); return category === undefined ? null : category; }

  atCategoryPutDefiningSetOfElementsAsIs(name, category) {
    category.name = name;
    this.basicAtCategory(name, category);
  }

  basicAtCategory(name, category) {
    const previous = this.categorizations.get(name);
    category.topic = previous !== undefined && previous.topic !== null ? previous.topic : this.actualTopicInConstruction;
    this.categorizations.set(name, category);
    this.substitutionsWithCategoryOnEdges = new Set(
      [...this.substitutions.values()].filter(relation =>
        this.includesCategory(relation.firstTerm()) && this.includesCategory(relation.lastTerm())));
  }

  addCategoryByExtension(name, element) {
    const previous = this.categorizations.get(name) || CategoryByExtension.named(name, []);
    const toAdd = previous.unionCategoryByExtension(CategoryByExtension.named(name, [element]));
    this.addCategoryWithDefinition(toAdd, name);
    return toAdd;
  }

  addCategoryByConstruction(name, structure) {
    const previous = this.categorizations.get(name);
    const category = new CategoryByConstruction(name, structure, this, previous ? previous.subcategories() : []);
    this.addCategoryWithDefinition(category, name);
    return category;
  }

  addCategoryWithDefinition(category, name) {
    const previous = this.categorizations.get(name);
    if (previous !== undefined) {
      if (previous.equals(category)) return;
      this.assertCanNotChangeCategory(name);
    }
    this.assertCanNotAddCategory(name);
    this.basicAtCategory(name, category);
    this.clearAllCache();
  }

  removeCategory(name) {
    this.assertCanNotChangeCategory(name);
    this.categorizations.delete(name);
    for (const relation of [...this.substitutionsWithCategoryOnEdges]) {
      if (!this.includesCategory(relation.firstTerm()) || !this.includesCategory(relation.lastTerm())) {
        this.substitutionsWithCategoryOnEdges.delete(relation);
      }
    }
    this.clearAllCache();
  }

  removeElementFromCategory(element, name) {
    this.assertCanNotChangeCategory(name);
    const category = this.categorizations.get(name);
    if (category === undefined) return;
    category.removeElement(element);
    this.clearAllCache();
  }

  definitionOfCategory(name) {
    const category = this.categorizations.get(name);
    return category === undefined ? 'Looks like this notion does not categorize anything.' : category.toString();
  }

  // ¿La entidad (término o frase) pertenece a la categoría? Recorre recursivamente los
  // elementos de la categoría, que pueden ser a su vez categorías.
  // Un símbolo "en particular" (el que representa a un elemento del tablero) no es un símbolo
  // individual cualquiera: no pertenece a 'visualSymbol' ni al comodín. Comparte el hash con
  // el símbolo genérico, así que la memoria los distingue aparte.
  symbolBelongsTo(entity, categoryName) {
    const particular = !isSentence(entity) && isVisualSymbol(entity) && entity.doesReferenceAParticularElementOnBoard();
    const key = entityKey(entity) + (particular ? '#p' : '') + '|' + termKey(categoryName);
    const memo = this.belongsToMemo.get(key);
    if (memo !== undefined) return memo;
    const answer = this.belongsToIgnoring(entity, categoryName, new TermSet());
    this.belongsToMemo.set(key, answer);
    return answer;
  }

  belongsToIgnoring(entity, categoryName, ignoring) {
    const category = this.categorizations.get(categoryName);
    if (category === undefined) return false;
    if (category.includes(entity, this)) return true;
    ignoring.add(categoryName);
    for (const subcategory of category.subcategories()) {
      if (!ignoring.has(subcategory) && this.belongsToIgnoring(entity, subcategory, ignoring)) return true;
    }
    return false;
  }

  directCategoriesOfWord(term) {
    return this.categorizations.keys().filter(name => this.categorizations.get(name).includes(term, this));
  }

  // Todos los términos alcanzables desde una categoría (incluida ella misma).
  symbolsCategorizedBy(categoryName, alreadyChecked = new TermSet()) {
    const result = new TermSet([categoryName]);
    const category = this.categorizations.get(categoryName);
    if (category === undefined) return result;
    alreadyChecked.add(categoryName);
    for (const subcategory of category.subcategories()) {
      result.add(subcategory);
      if (!alreadyChecked.has(subcategory)) {
        for (const term of this.symbolsCategorizedBy(subcategory, alreadyChecked)) result.add(term);
      }
    }
    return result;
  }

  // ¿La categoría sólo puede consumir un término de la oración?
  canOnlyMatchWithOneTerm(categoryName) {
    const key = termKey(categoryName);
    const memo = this.singleTermMemo.get(key);
    if (memo !== undefined) return memo;
    const answer = this.canOnlyMatchWithOneTermIgnoring(categoryName, new TermSet());
    this.singleTermMemo.set(key, answer);
    return answer;
  }

  canOnlyMatchWithOneTermIgnoring(categoryName, alreadyChecked) {
    const category = this.categorizations.get(categoryName);
    if (category === undefined) return true;
    if (!category.isSingular()) return false;
    alreadyChecked.add(categoryName);
    return category.allParticularTermsSatisfy(term =>
      alreadyChecked.has(term) || this.canOnlyMatchWithOneTermIgnoring(term, alreadyChecked));
  }

  isAnUniversalType(name) {
    return this.symbolBelongsTo('entity', name);
  }

  // Cuanto más general es una categoría, mayor su grado de abstracción. Se usa para
  // preferir la relación más concreta cuando varias aplican.
  abstractionDegreeOfCategory(categoryName, visited = new TermSet()) {
    const category = this.categorizations.get(categoryName);
    if (category === undefined || visited.has(categoryName)) return 0;
    visited.add(categoryName);
    let degree = 1;
    if (category.isUniversalUnlimited()) degree += 50;
    if (category.isUniversalLimited()) degree += 30;
    if (category.isByDefinition()) degree += 10;
    for (const subcategory of category.subcategories()) {
      const sub = this.categorizations.get(subcategory);
      const isUniversal = sub !== undefined && (sub.isUniversalLimited() || sub.isUniversalUnlimited());
      if (isUniversal || !this.symbolBelongsTo(categoryName, subcategory)) {
        degree += this.abstractionDegreeOfCategory(subcategory, visited);
      }
    }
    return degree;
  }

  degreeOfAbstractionOfSubstitution(relation) {
    let degree = 0;
    relation.matchingDetectorDo(category => { degree += this.abstractionDegreeOfCategory(category); });
    return degree;
  }

  // --- cachés ---

  clearAllCache() {
    this.belongsToMemo.clear();
    this.singleTermMemo.clear();
    if (this.interpreter !== null) this.interpreter.clearInterpreterCache();
    for (const relation of this.substitutions.values()) relation.clearRelationCache();
    for (const category of this.categorizations.values()) category.clearCategoryCache();
  }

  // --- depuración ---

  printAll() {
    const lines = [];
    for (const category of this.categorizations.values()) lines.push('[' + category.topic + '] ' + category.toString());
    for (const relation of this.substitutions.values()) lines.push('[' + relation.topic + '] ' + relation.toString());
    return lines.join('\n');
  }
}

export { isSentence };
