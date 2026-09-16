import { Sentence } from '../metamodel/Sentence.js';
import { TermSet } from '../metamodel/Terms.js';
import { InterpreterBuilder } from '../metamodel/InterpreterBuilder.js';
import { StateOfArtBuilderForVisualEnvironment } from '../metamodel/StateOfArtBuilderForVisualEnvironment.js';
import { BoardModel } from '../board/BoardModel.js';
import { ConnectorWithInterpreter } from '../board/ConnectorWithInterpreter.js';
import { TeleportMonitor } from '../board/TeleportMonitor.js';

let scenarioNumber = 0;

// Un proyecto visual: el modelo de lo que en Smalltalk es RepresentarVisualEnvironment
// sin la parte de ventana (intérprete, tablero, dibujos del usuario, símbolos privados,
// proyectos reusados, modos de arrastre). Es lo que se guarda en un .dialog.ar.
export class VisualProject {
  constructor({ name = 'Proyecto sin nombre', gridSize = 50, columns = 40, rows = 24, random = Math.random } = {}) {
    scenarioNumber++;
    this.projectName = name;
    this.topicName = name + ' ' + scenarioNumber;
    this.symbolProvider = new StateOfArtBuilderForVisualEnvironment();
    this.interpreter = InterpreterBuilder.interpreterWithAsciiAndVisualStateOfArt();
    this.boardModel = new BoardModel(this.interpreter, gridSize, { columns, rows, random });
    this.boardModel.topicName = this.topicName;
    this.predefinedSymbols = this.symbolProvider.predefinedSymbolsForPalette();
    this.drawingsMadeByUserList = [];
    this.privateSymbols = new TermSet();
    this.reusingProjects = [];
    this.namesOfProjectsToReuse = [];
    this.shouldDropWhenDragging = true;
    this.shouldTreatDrawingsAsElements = true;
    this.screenshot = null;
    this.connected = false;
  }

  connect() {
    if (!this.connected) { ConnectorWithInterpreter.connect(this.boardModel, this.interpreter); this.connected = true; }
    return this;
  }

  get boardView() { return this.boardModel.boardView; }
  set boardView(view) { this.boardModel.boardView = view; }

  isVisual() { return true; }

  setProjectName(name) {
    this.projectName = name;
    const previousTopic = this.topicName;
    this.topicName = name + ' ' + scenarioNumber;
    if (this.boardModel.topicName === previousTopic) this.boardModel.topicName = this.topicName;
  }

  // --- dibujos del usuario (el más reciente primero, como en la paleta) ---

  drawingsMadeByUser() { return this.drawingsMadeByUserList.slice(); }

  receiveDrawnSymbol(symbol) { this.addPaintedSymbolAtFirst(symbol); }

  addPaintedSymbolAtFirst(symbol) {
    if (!this.includesPaintedSymbol(symbol)) this.drawingsMadeByUserList.unshift(symbol);
  }

  addPaintedSymbolAtLast(symbol) { this.drawingsMadeByUserList.push(symbol); }

  includesPaintedSymbol(symbol) { return this.drawingsMadeByUserList.some(each => each.equals(symbol)); }
  includesProvidedSymbol(symbol) { return this.predefinedSymbols.some(each => each.equals(symbol)); }
  includesVisualSymbol(symbol) { return this.includesPaintedSymbol(symbol) || this.includesProvidedSymbol(symbol); }

  ifNotOnBoardRemovePaintedSymbol(symbol) {
    if (this.boardModel.includesOnBoard(symbol)) return false;
    const index = this.drawingsMadeByUserList.findIndex(each => each.equals(symbol));
    if (index >= 0) this.drawingsMadeByUserList.splice(index, 1);
    return index >= 0;
  }

  // --- símbolos privados / públicos (para el reuso entre proyectos) ---

  isPrivate(symbol) { return this.privateSymbols.has(symbol); }
  isPublic(symbol) { return !this.isPrivate(symbol); }
  makePrivate(symbol) { this.privateSymbols.add(symbol); }
  makePublic(symbol) { this.privateSymbols.delete(symbol); }
  invertSharingOfSymbol(symbol) { this.isPublic(symbol) ? this.makePrivate(symbol) : this.makePublic(symbol); }
  publicSymbols() { return this.drawingsMadeByUserList.filter(each => !this.isPrivate(each)).map(each => each.copy()); }

  // --- modos de arrastre ---

  shouldStampWhenDragging() { return !this.shouldDropWhenDragging; }
  shouldTreatDrawingsAsSymbols() { return !this.shouldTreatDrawingsAsElements; }
  switchToDropWhenDragging() { this.shouldDropWhenDragging = true; }
  switchToStampWhenDragging() { this.shouldDropWhenDragging = false; }
  switchToTreatDrawingsAsElements() { this.shouldTreatDrawingsAsElements = true; }
  switchToTreatDrawingsAsSymbols() { this.shouldTreatDrawingsAsElements = false; }

  dropOnBoard(symbolOrItem, position) {
    return this.boardModel.acceptDropping(symbolOrItem, position, {
      treatDrawingsAsSymbols: this.shouldTreatDrawingsAsSymbols(),
      stampMode: this.shouldStampWhenDragging(),
    });
  }

  // --- teclas que evalúan una palabra ---

  pressedKeyName(keyName) {
    const sentence = Sentence.of(keyName);
    if (!this.boardModel.existsASubstitutionThatAppliesTo(sentence)) return;
    const monitor = new TeleportMonitor(this.boardModel);
    this.boardModel.evaluateSentenceForOneSecond(sentence, monitor);
    monitor.ifShouldOpenInspectorAtEndOfEval(() => this.boardModel.addInspectorFrom(monitor));
  }

  enterKeyPressed() { this.pressedKeyName('enterKey'); }
  spaceBarPressed() { this.pressedKeyName('spaceBar'); }

  // --- consultas ---

  sentencesOnBoard() { return this.boardModel.sentencesOnBoardExcludingTeleportsWithoutCollisionAndREPLExpressions(); }
  currentPositionsOfEachElement() { return this.boardModel.positionsCopy(); }
  namesOfProjectsReusing() { return this.reusingProjects.map(each => each.projectName); }

  actionsAfterLoading() {
    this.boardModel.refreshItems();
    this.boardModel.setCurrentAsResetBoard();
    this.boardModel.initializeUndoHistory();
    this.connect();
  }

  // --- reuso de proyectos ---

  defineCurrentTopicAs(topic) { this.interpreter.currentStateOfArt.actualTopicInConstruction = topic; }
  lockTopic(topic) { this.interpreter.currentStateOfArt.lockTopic(topic); }
  unlockTopic(topic) { this.interpreter.currentStateOfArt.unlockTopic(topic); }

  isReusingProjectNamed(name) { return this.reusingProjects.some(each => each.projectName === name); }

  startReusingProject(project) {
    if (project === this) throw new Error('Can not reuse a project by itself');
    if (this.isReusingProjectNamed(project.projectName)) return;
    this.reusingProjects.push(project);
    this.receiveSymbolsToReuse(project.publicSymbols());
    project.reusedByProject(this);
    this.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }

  stopReusingProject(project) {
    const index = this.reusingProjects.indexOf(project);
    if (index < 0) return;
    this.reusingProjects.splice(index, 1);
    this.removeReusedSymbols(project.publicSymbols());
    project.removeMySentencesFromProject(this);
    this.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
  }

  stopReusingProjectNamed(name) {
    const project = this.reusingProjects.find(each => each.projectName === name);
    if (project !== undefined) this.stopReusingProject(project);
  }

  invertReuseOfProject(project) {
    this.isReusingProjectNamed(project.projectName) ? this.stopReusingProject(project) : this.startReusingProject(project);
  }

  reusedByProject(user) {
    for (const reused of this.reusingProjects) reused.reusedByProject(user);
    user.evaluateReusedSentences(this.sentencesOnBoard(), this.topicName);
  }

  evaluateReusedSentences(sentences, lockedTopic) {
    this.defineCurrentTopicAs(lockedTopic);
    this.boardModel.evaluateTwiceAll(sentences);
    this.lockTopic(lockedTopic);
  }

  removeMySentencesFromProject(user) {
    for (const reused of this.reusingProjects) reused.removeMySentencesFromProject(user);
    user.removeAllFromBlockedTopic(this.topicName);
  }

  removeAllFromBlockedTopic(topic) {
    this.unlockTopic(topic);
    this.boardModel.removePreviousRelationsOn(topic);
  }

  receiveSymbolsToReuse(symbols) {
    for (const symbol of symbols) {
      if (!this.includesPaintedSymbol(symbol)) {
        this.addPaintedSymbolAtLast(symbol);
        this.makePrivate(symbol);
      }
    }
  }

  removeReusedSymbols(symbols) {
    for (const symbol of symbols) this.ifNotOnBoardRemovePaintedSymbol(symbol);
  }

  // Un proyecto que reusa a otro tiene que reevaluarse cuando el otro cambia.
  changeOfPotentialUsedProject(project) {
    if (this.reusingProjects.includes(project)) {
      this.stopReusingProject(project);
      this.startReusingProject(project);
    }
  }
}
