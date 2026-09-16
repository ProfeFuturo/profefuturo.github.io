import { Sentence } from './Sentence.js';
import { VisualSymbol } from './VisualSymbol.js';
import { StateOfArt } from './StateOfArt.js';
import { CategoryMatcher } from './CategoryMatcher.js';
import { SubstitutionBetweenSymbols } from './SubstitutionBetweenSymbols.js';
import { SubstitutionBeyondSymbols } from './SubstitutionBeyondSymbols.js';
import {
  CategoryOfAllIndividualSymbols, CategoryOfAllIndividualVisualSymbols,
  CategoryOfAllPhrases, CategoryOfEveryPairOfTheSameSymbol,
} from './categories/UniversalCategories.js';

const HIGHLIGHT_FOR_FUNDAMENTAL_SYMBOLS = 'yellow';
const HIGHLIGHT_FOR_CONNECTORS_OF_TWO_SYMBOLS = 'cyan';
const HIGHLIGHT_FOR_PARAMETERS = 'gray';

// Los símbolos predefinidos: selector → archivo de imagen, color de borde y significado.
export const PREDEFINED_SYMBOLS = {
  adjacentCellSymbol:        { file: 'adjacent.cell.png',              highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'adjacentCellSymbol' },
  arrowKeysSymbol:           { file: 'Movable.by.Arrows.png',          highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'arrowKeys' },
  blackHoleSymbol:           { file: 'black.hole.png',                 highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'Nowhere' },
  canNotTranspassSymbol:     { file: 'Stoped.png',                     highlightColor: HIGHLIGHT_FOR_CONNECTORS_OF_TWO_SYMBOLS, meaningSelector: 'canNotTraspass' },
  categorizeSymbol:          { file: 'inside.no.frame.png',            highlightColor: HIGHLIGHT_FOR_FUNDAMENTAL_SYMBOLS,       meaningSelector: 'categorize' },
  collisionSymbol:           { file: 'Collision.png',                  highlightColor: HIGHLIGHT_FOR_CONNECTORS_OF_TWO_SYMBOLS, meaningSelector: 'collision' },
  enterKeySymbol:            { file: 'Enter.key.png',                  highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'enterKey' },
  evaluationInProcessSymbol: { file: 'evaluationInProcess.png',        highlightColor: 'black',                                meaningSelector: 'evaluationInProcessSymbol' },
  jokerDouble:               { file: 'joker.double.png',               highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'jokerDouble' },
  jokerHead:                 { file: 'jocker.kid.head.png',            highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'anySingleSymbol' },
  jokerWithBalls:            { file: 'jocker.kid.with.balls.png',      highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'everySequence' },
  pointsSymbol:              { file: 'points.to.right.no.frame.png',   highlightColor: HIGHLIGHT_FOR_FUNDAMENTAL_SYMBOLS,       meaningSelector: 'pointsTo' },
  pullSymbol:                { file: 'Pull.png',                       highlightColor: HIGHLIGHT_FOR_CONNECTORS_OF_TWO_SYMBOLS, meaningSelector: 'pull' },
  pushSymbol:                { file: 'Push.png',                       highlightColor: HIGHLIGHT_FOR_CONNECTORS_OF_TWO_SYMBOLS, meaningSelector: 'push' },
  replSymbol:                { file: 'print.it.png',                   highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'evalAndSee' },
  runSymbol:                 { file: 'Selfmove.png',                   highlightColor: HIGHLIGHT_FOR_CONNECTORS_OF_TWO_SYMBOLS, meaningSelector: 'runTowards' },
  spaceBarSymbol:            { file: 'Space.bar.png',                  highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'spaceBar' },
  teleportSymbol:            { file: 'Teleport.png',                   highlightColor: HIGHLIGHT_FOR_CONNECTORS_OF_TWO_SYMBOLS, meaningSelector: 'teleport' },
  wasdSymbol:                { file: 'Movable.by.WASD.png',            highlightColor: HIGHLIGHT_FOR_PARAMETERS,               meaningSelector: 'wasdKeys' },
};

// Instancia única de cada símbolo predefinido (como las variables de clase en Smalltalk).
// Las imágenes se asocian después, cuando el entorno las carga (setDrawingOfPredefined).
const providedSymbols = new Map();
for (const [selector, spec] of Object.entries(PREDEFINED_SYMBOLS)) {
  providedSymbols.set(selector, VisualSymbol.predefined(selector, spec));
}

export const BASIC_TEXTUAL_TOPIC_NAME = 'Basic Textual';
export const BASIC_VISUAL_TOPIC_NAME = 'Basic Visual';
export const PROTECTED_CATEGORY_MARK = 'ProtectedFromBeingDefinedAsCategoryFromSimulator';

// Construye el StateOfArt inicial del entorno visual: categorías universales,
// relaciones fundamentales (definir sustituciones y categorías) y las relaciones
// que dan significado a los símbolos predefinidos.
export class StateOfArtBuilderForVisualEnvironment {

  // --- símbolos predefinidos (siempre copias, como en Smalltalk) ---

  static providedSymbol(selector) {
    const symbol = providedSymbols.get(selector);
    if (symbol === undefined) throw new Error('Unknown predefined symbol: ' + selector);
    return symbol;
  }

  static setDrawingOfPredefined(selector, drawing) {
    StateOfArtBuilderForVisualEnvironment.providedSymbol(selector).drawing = drawing;
  }

  static providedSelectors() { return Object.keys(PREDEFINED_SYMBOLS); }

  symbolBySelector(selector) { return StateOfArtBuilderForVisualEnvironment.providedSymbol(selector).copy(); }

  adjacentCellSymbol() { return this.symbolBySelector('adjacentCellSymbol'); }
  arrowKeysSymbol() { return this.symbolBySelector('arrowKeysSymbol'); }
  blackHoleSymbol() { return this.symbolBySelector('blackHoleSymbol'); }
  canNotTranspassSymbol() { return this.symbolBySelector('canNotTranspassSymbol'); }
  categorizeSymbol() { return this.symbolBySelector('categorizeSymbol'); }
  collisionSymbol() { return this.symbolBySelector('collisionSymbol'); }
  enterKeySymbol() { return this.symbolBySelector('enterKeySymbol'); }
  evaluationInProcessSymbol() { return this.symbolBySelector('evaluationInProcessSymbol'); }
  jokerDouble() { return this.symbolBySelector('jokerDouble'); }
  jokerHead() { return this.symbolBySelector('jokerHead'); }
  jokerWithBalls() { return this.symbolBySelector('jokerWithBalls'); }
  pointsSymbol() { return this.symbolBySelector('pointsSymbol'); }
  pullSymbol() { return this.symbolBySelector('pullSymbol'); }
  pushSymbol() { return this.symbolBySelector('pushSymbol'); }
  replSymbol() { return this.symbolBySelector('replSymbol'); }
  runSymbol() { return this.symbolBySelector('runSymbol'); }
  spaceBarSymbol() { return this.symbolBySelector('spaceBarSymbol'); }
  teleportSymbol() { return this.symbolBySelector('teleportSymbol'); }
  wasdSymbol() { return this.symbolBySelector('wasdSymbol'); }

  // Los que se muestran en la paleta, en este orden.
  predefinedSymbolsForPalette() {
    return ['pointsSymbol', 'categorizeSymbol', 'replSymbol', 'jokerWithBalls', 'jokerHead',
      'pushSymbol', 'pullSymbol', 'canNotTranspassSymbol', 'runSymbol',
      'collisionSymbol', 'teleportSymbol', 'blackHoleSymbol',
      'arrowKeysSymbol', 'wasdSymbol', 'spaceBarSymbol', 'enterKeySymbol'].map(selector => this.symbolBySelector(selector));
  }

  basicTextualTopicName() { return BASIC_TEXTUAL_TOPIC_NAME; }
  basicVisualTopicName() { return BASIC_VISUAL_TOPIC_NAME; }

  // --- construcción ---

  buildWithInterpreter(interpreter) {
    this.initializeColaborators(interpreter);
    this.buildUniversalCategories();
    this.buildBasicRelationsOfSubstitution();
    this.addBasicRelationsForVisualProgramming();
    interpreter.initializeWithStateOfArt(this.stateOfArtToBuild);
    this.addVisualRelations();
    this.lockBasicTopics();
    this.stateOfArtToBuild.setDefaultPriorityToMedium();
    this.stateOfArtToBuild.actualTopicInConstruction = 'Undefined';
    this.stateOfArtToBuild.actualSectionInConstruction = 'Undefined';
    this.stateOfArtToBuild.clearAllCache();
    return this.stateOfArtToBuild;
  }

  initializeColaborators(interpreter) {
    this.stateOfArtToBuild = new StateOfArt(interpreter);
    this.stateOfArtToBuild.categorizeSymbol = this.categorizeSymbol();
    this.stateOfArtToBuild.pointSymbol = this.pointsSymbol();
  }

  lockBasicTopics() {
    this.stateOfArtToBuild.lockTopic(BASIC_TEXTUAL_TOPIC_NAME);
    this.stateOfArtToBuild.lockTopic(BASIC_VISUAL_TOPIC_NAME);
  }

  buildUniversalCategories() {
    const stateOfArt = this.stateOfArtToBuild;
    stateOfArt.actualTopicInConstruction = BASIC_TEXTUAL_TOPIC_NAME;
    stateOfArt.atCategoryPutDefiningSetOfElementsAsIs('word', new CategoryOfAllIndividualSymbols('word'));
    stateOfArt.atCategoryPutDefiningSetOfElementsAsIs('visualSymbol', new CategoryOfAllIndividualVisualSymbols('visualSymbol'));
    stateOfArt.atCategoryPutDefiningSetOfElementsAsIs('phrase', new CategoryOfAllPhrases('phrase'));
    stateOfArt.atCategoryPutDefiningSetOfElementsAsIs('pairOfTheSame', new CategoryOfEveryPairOfTheSameSymbol('pairOfTheSame'));
  }

  // Relaciones fundamentales con sintaxis de palabras ('->' y '@'). En el tablero no se
  // pueden escribir, pero permiten definir en tests y desde código con oraciones de palabras.
  buildBasicRelationsOfSubstitution() {
    const stateOfArt = this.stateOfArtToBuild;
    stateOfArt.actualSectionInConstruction = 'Substitution';
    this.fundamentalRelationOfRepresentation('->');
    stateOfArt.actualSectionInConstruction = 'Categorization';
    this.fundamentalRelationOfCategorization('@');
    this.categorizationByRecursion('@');
    this.belongsToACategoryAnswerRelation('@');
    this.removeElementFromCategoryRelation('@');
  }

  // Las mismas relaciones fundamentales con los símbolos visuales (flecha y "está dentro").
  addBasicRelationsForVisualProgramming() {
    const stateOfArt = this.stateOfArtToBuild;
    stateOfArt.actualTopicInConstruction = BASIC_VISUAL_TOPIC_NAME;
    this.addCategoriesNecesaryForVisualPrograms();
    stateOfArt.actualSectionInConstruction = 'Categorization';
    this.fundamentalRelationOfCategorization(this.categorizeSymbol()).setPriorityHigh();
    this.categorizationByRecursion(this.categorizeSymbol()).setPriorityHigh();
    stateOfArt.actualSectionInConstruction = 'Substitution';
    this.fundamentalRelationOfRepresentation(this.pointsSymbol()).setPriorityHigh();
  }

  addCategoriesNecesaryForVisualPrograms() {
    const stateOfArt = this.stateOfArtToBuild;
    stateOfArt.addCategoryByExtension(this.jokerHead(), 'visualSymbol');
    stateOfArt.addCategoryByExtension(this.jokerWithBalls(), 'phrase');
    stateOfArt.addCategoryByExtension('element', 'word');
    stateOfArt.addCategoryByExtension('otherElement', 'word');
  }

  // phrase -> phrase : define una sustitución entre símbolos
  fundamentalRelationOfRepresentation(pointSymbol) {
    return this.addSubstitutionRelationForCategories(['phrase', pointSymbol, 'phrase'], ['referents', pointSymbol, 'becomes'],
      (monitor, referents, arrow, becomes) => {
        const what = Sentence.from(referents);
        monitor.allow(() => this.stateOfArtToBuild.interpreter.currentStateOfArt
          .addRelationFor(CategoryMatcher.fromCategories(what), what, Sentence.from(becomes)));
        monitor.relationBeyondSymbolsEvaluated();
        return [];
      });
  }

  // word @ word : el primero pertenece a la categoría nombrada por el segundo
  fundamentalRelationOfCategorization(categorizeSymbol) {
    return this.addSubstitutionRelationForCategories(['word', categorizeSymbol, 'word'], ['concrete', categorizeSymbol, 'abstract'],
      (monitor, concrete, at, abstract) => {
        monitor.allow(() => this.stateOfArtToBuild.interpreter.currentStateOfArt.addCategoryByExtension(abstract, concrete));
        monitor.relationBeyondSymbolsEvaluated();
        return [];
      });
  }

  // word phrase @ phrase : categoría por construcción (secuencias)
  categorizationByRecursion(categorizeSymbol) {
    return this.addSubstitutionRelationForCategories(['word', 'phrase', categorizeSymbol, 'phrase'], ['word', 'structure', categorizeSymbol, 'category'],
      (monitor, word, structure, at, category) => {
        const structureSentence = new Sentence();
        structureSentence.push(word, ...Sentence.from(structure));
        const categoryName = Sentence.from(category);
        if (categoryName.length !== 1) throw new Error('A category name must be a single symbol');
        monitor.allow(() => this.stateOfArtToBuild.interpreter.currentStateOfArt
          .addCategoryByConstruction(categoryName[0], structureSentence));
        monitor.relationBeyondSymbolsEvaluated();
        return [];
      });
  }

  // word @ word ? : responde true/false
  belongsToACategoryAnswerRelation(categorizeSymbol) {
    return this.addSubstitutionRelationForCategories(['word', categorizeSymbol, 'word', '?'], ['concreteNotion', categorizeSymbol, 'abstractNotion', '?'],
      (monitor, concrete, at, abstract) =>
        [String(this.stateOfArtToBuild.interpreter.currentStateOfArt.symbolBelongsTo(concrete, abstract))]);
  }

  // no more word @ word
  removeElementFromCategoryRelation(categorizeSymbol) {
    return this.addSubstitutionRelationForCategories(['no', 'more', 'word', categorizeSymbol, 'word'], ['no', 'more', 'element', categorizeSymbol, 'category'],
      (monitor, no, more, element, at, category) => {
        monitor.allow(() => this.stateOfArtToBuild.interpreter.currentStateOfArt.removeElementFromCategory(element, category));
        monitor.relationBeyondSymbolsEvaluated();
        return [];
      });
  }

  addSubstitutionRelationForCategories(categories, roles, processingMethod) {
    return this.stateOfArtToBuild.addSubstitutionRelationAsIs(
      SubstitutionBeyondSymbols.forCategories(categories, roles, processingMethod));
  }

  // Sustitución entre símbolos definida desde código (equivale a evaluar "what -> how").
  addSubstitution(what, how) {
    what = Sentence.from(what);
    return this.stateOfArtToBuild.addSubstitutionRelationAsIs(
      new SubstitutionBetweenSymbols(CategoryMatcher.fromCategories(what), what, Sentence.from(how)));
  }

  // --- relaciones que dan significado a los símbolos predefinidos ---

  addVisualRelations() {
    const stateOfArt = this.stateOfArtToBuild;
    stateOfArt.actualTopicInConstruction = BASIC_VISUAL_TOPIC_NAME;
    this.addChaseingSubstitutions();
    this.addMoveByKeyboardSubstitutions();
    this.addPullSubstitutions();
    this.addPushSubstitutions();
    this.addImpassableSubstitutions();
    this.addPredefinedVisualSymbolCategories();
  }

  // "element run visualSymbol" define "element self drive action -> run visualSymbol"
  addChaseingSubstitutions() {
    const stateOfArt = this.stateOfArtToBuild;
    stateOfArt.actualSectionInConstruction = 'Chaseing';
    const run = this.runSymbol();
    const arrow = this.pointsSymbol();
    this.addSubstitution(['element', run, 'visualSymbol'],
      ['element', 'self', 'drive', 'action', arrow, run, 'visualSymbol']);
    this.addSubstitution(['element', run],
      ['element', 'self', 'drive', 'action', arrow, run, 'freely']);
    this.addSubstitution([run, 'adjacentCell'], [run, 'adjacentCell']);
  }

  addMoveByKeyboardSubstitutions() {
    const stateOfArt = this.stateOfArtToBuild;
    stateOfArt.actualSectionInConstruction = 'Move By Keyboard';
    const arrow = this.pointsSymbol();
    this.addSubstitution(['element', this.arrowKeysSymbol()], ['element', 'movable', 'by', 'Arrows', arrow, 'true']);
    this.addSubstitution(['element', this.wasdSymbol()], ['element', 'movable', 'by', 'WASD', arrow, 'true']);
  }

  addPullSubstitutions() {
    this.stateOfArtToBuild.actualSectionInConstruction = 'Pullable';
    this.addPhysicalRelation('Pullable', 'isPullableFor');
  }

  addPushSubstitutions() {
    this.stateOfArtToBuild.actualSectionInConstruction = 'Pushable';
    this.addPhysicalRelation('Pushable', 'isPushableFor');
  }

  addImpassableSubstitutions() {
    this.stateOfArtToBuild.actualSectionInConstruction = 'Impassable';
    this.addPhysicalRelation('Wall', 'isWallFor');
  }

  // "element Wall otherElement" define "otherElement isWallFor element -> true";
  // por defecto "otherElement isWallFor element -> false".
  addPhysicalRelation(categoryOfConnector, question) {
    const arrow = this.pointsSymbol();
    this.addSubstitution(['element', categoryOfConnector, 'otherElement'],
      ['otherElement', question, 'element', arrow, 'true']);
    this.addSubstitution(['otherElement', question, 'element'], ['false']);
  }

  addPredefinedVisualSymbolCategories() {
    const stateOfArt = this.stateOfArtToBuild;
    stateOfArt.actualSectionInConstruction = 'Predefined Symbols';
    // Protegidos: nadie puede volver a definir estos símbolos como categorías desde el tablero.
    for (const symbol of [this.pullSymbol(), this.pushSymbol(), this.canNotTranspassSymbol(), this.arrowKeysSymbol(),
      this.wasdSymbol(), this.teleportSymbol(), this.categorizeSymbol(), this.pointsSymbol()]) {
      stateOfArt.addCategoryByExtension(symbol, PROTECTED_CATEGORY_MARK);
    }
    // Las palabras que el tablero evalúa al apretar teclas pertenecen al símbolo correspondiente.
    stateOfArt.addCategoryByExtension(this.spaceBarSymbol(), 'spaceBar');
    stateOfArt.addCategoryByExtension(this.enterKeySymbol(), 'enterKey');
    stateOfArt.addCategoryByExtension(this.collisionSymbol(), 'collide');
    stateOfArt.addCategoryByExtension(this.runSymbol(), 'selfDrive');
    stateOfArt.addCategoryByExtension(this.jokerDouble(), 'pairOfTheSame');
    // Los símbolos pertenecen a las palabras que usan las relaciones básicas.
    stateOfArt.addCategoryByExtension('PrintIt', this.replSymbol());
    stateOfArt.addCategoryByExtension('Wall', this.canNotTranspassSymbol());
    stateOfArt.addCategoryByExtension('Pullable', this.pullSymbol());
    stateOfArt.addCategoryByExtension('Pushable', this.pushSymbol());
    stateOfArt.addCategoryByExtension('teleport', this.teleportSymbol());
    stateOfArt.addCategoryByExtension('adjacentCell', this.adjacentCellSymbol());
    stateOfArt.addCategoryByExtension('adjacentCellSequence', 'adjacentCell');
    stateOfArt.addCategoryByConstruction('adjacentCellSequence', ['adjacentCell', 'adjacentCellSequence']);
  }
}
