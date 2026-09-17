import { T } from './Texts.js';
import { BoardView } from './BoardView.js';
import { SymbolTray } from './SymbolTray.js';
import { DragController } from './DragController.js';
import { Joystick } from './Joystick.js';
import { VisualInspector } from './VisualInspector.js';
import { PaintingTool } from './PaintingTool.js';
import { Sheet } from './Sheet.js';
import { Icons } from './Icons.js';
import { Sounds } from './Sounds.js';
import { Achievements } from './Achievements.js';
import { ChallengeSession } from './ChallengeSession.js';
import { COLUMNS as CHALLENGE_COLUMNS } from './Challenge.js';
import { RepresentarVisualExporter } from '../io/RepresentarVisualExporter.js';
import { dictionaryAt } from '../io/LanguageProvider.js';

const STEP_INTERVAL_MS = 100;
const AUTOSAVE_MS = 1500;

// El editor de un proyecto (lo que en Cuis era la ventana RepresentarVisualEnvironment):
// barra superior mínima (volver, título, logros, menú), el tablero ocupando la pantalla,
// los joysticks flotando sobre él y la bandeja de símbolos abajo (al costado en pantallas
// anchas). Corre el "stepping" cada 100 ms mientras está a la vista.
export class RepresentarVisualEnvironment {
  constructor(root, { mainSpace = null } = {}) {
    this.root = root;
    this.mainSpace = mainSpace;
    this.sounds = mainSpace !== null && mainSpace.sounds ? mainSpace.sounds : new Sounds();
    this.achievements = mainSpace !== null && mainSpace.achievements ? mainSpace.achievements : new Achievements();
    this.currentProject = null;
    this.boardView = null;
    this.paused = false;
    this.pausedBySlots = false;          // un desafío con cuadraditos vacíos: el tiempo espera
    this.dirty = false;
    this.session = null;                 // el desafío en curso, si el proyecto es un desafío
    this.usage = mainSpace !== null && mainSpace.usage ? mainSpace.usage : null;
    this.hintDelayMs = undefined;
    this.dragController = new DragController();
    this.build();
    this.stepping = setInterval(() => this.simulatorStep(), STEP_INTERVAL_MS);
  }

  dictionaryAt(key) { return dictionaryAt(key); }

  dispose() {
    clearInterval(this.stepping);
    clearTimeout(this.autosaveTimer);
    this.endSession();
    this.closeSuccess();
    if (this.boardView !== null) this.boardView.dispose();
    this.tray.closeHalo();
    this.closeSheet();
  }

  // Como en Cuis (StateOfArtBuilderForVisualEnvironment>>sideOfSymbolsOnEnvironmentPalet): la grilla
  // de un proyecto nuevo es 1/20 del ancho de la pantalla, nunca menos de 44 px (un dedo).
  static sideOfSymbolsOnEnvironmentPalet() {
    const width = typeof window === 'undefined' ? 1440 : window.innerWidth;
    return Math.max(44, Math.min(72, Math.round(width / 20)));
  }

  // --- construcción ---

  build() {
    this.root.innerHTML = '';
    this.root.classList.add('editor');
    this.layout = this.element('div', 'editor-layout', this.root);
    this.topBar = this.element('div', 'topbar', this.layout);
    this.buildTopBar();
    this.boardArea = this.element('div', 'board-area', this.layout);
    this.boardContainer = this.element('div', 'board-container', this.boardArea);
    this.joystickLayer = this.element('div', 'joystick-layer', this.boardArea);
    this.joysticks = { arrows: new Joystick(this.joystickLayer, this, { keys: 'arrows' }), wasd: new Joystick(this.joystickLayer, this, { keys: 'wasd' }) };
    this.joysticks.arrows.show(false);
    this.joysticks.wasd.show(false);
    this.trayContainer = this.element('div', 'tray-container', this.layout);
    this.tray = new SymbolTray(this, this.trayContainer, this.dragController);
    this.inspector = new VisualInspector(document.createElement('div'), this);
    this.sheet = null;
  }

  element(tag, className, parent, html) {
    const created = document.createElement(tag);
    created.className = className;
    if (html !== undefined) created.innerHTML = html;
    parent.appendChild(created);
    return created;
  }

  iconButton(parent, iconName, title, action, className = '') {
    const button = this.element('button', 'icon-button ' + className, parent, Icons.svg(iconName));
    button.type = 'button';
    button.title = title;
    button.setAttribute('aria-label', title);
    button.addEventListener('click', event => { event.stopPropagation(); this.sounds.tap(); action(button); });
    return button;
  }

  buildTopBar() {
    this.backButton = this.iconButton(this.topBar, 'back', dictionaryAt('Back'), () => this.backAction(), 'back-button');
    this.backButton.hidden = this.mainSpace === null;
    this.titleText = this.element('input', 'title-text', this.topBar);
    this.titleText.type = 'text';
    this.titleText.placeholder = dictionaryAt('projectWithoutProperName');
    this.titleText.setAttribute('aria-label', dictionaryAt('TopicName'));
    this.titleText.addEventListener('change', () => this.withProject(project => { project.setProjectName(this.titleText.value.trim() || dictionaryAt('projectWithoutProperName')); this.markDirty(); }));
    this.titleText.addEventListener('keydown', event => { if (event.key === 'Enter') this.titleText.blur(); });
    this.undoButton = this.iconButton(this.topBar, 'undo', dictionaryAt('Undo'), () => this.withProject(project => { project.boardModel.backToPreviousBoardState(); if (this.session !== null) this.session.userActed(); }), 'undo-button');
    this.badgeChip = this.element('button', 'chip badge-chip', this.topBar, '<span class="star">' + Icons.svg('medal', { size: 18 }) + '</span><span class="count">0</span>');
    this.badgeChip.type = 'button';
    this.badgeChip.title = 'Logros';
    this.badgeChip.addEventListener('click', () => this.openAchievements());
    this.moreButton = this.iconButton(this.topBar, 'more', T('more'), () => this.openMenu(), 'more-button');
    this.refreshBadgeChip();
  }

  // El contador de logros aparece recién con el primero: en cero parecería un marcador vacío.
  refreshBadgeChip() {
    this.badgeChip.querySelector('.count').textContent = String(this.achievements.count());
    this.badgeChip.hidden = this.achievements.count() === 0;
  }

  achievementUnlocked() { this.refreshBadgeChip(); }

  withProject(action) {
    if (this.currentProject !== null) action(this.currentProject);
  }

  // --- el menú (⋯): lo que en Cuis eran los botones de la barra ---

  openMenu() {
    this.closeSheet();
    const sheet = new Sheet(this.root, { className: 'menu-sheet', onClosed: () => { this.sheet = null; } });
    this.sheet = sheet;
    const item = (iconName, label, action, className = '') => {
      const button = this.element('button', 'menu-item ' + className, sheet.body, Icons.svg(iconName) + '<span>' + label + '</span>');
      button.type = 'button';
      button.addEventListener('click', () => { sheet.close(); this.sounds.tap(); action(); });
      return button;
    };
    const group = label => { const heading = this.element('div', 'menu-group', sheet.body); heading.textContent = label; };
    item('undo', dictionaryAt('Undo'), () => this.withProject(project => project.boardModel.backToPreviousBoardState()), 'menu-undo');
    item('reset', T('menu.backToStart'), () => this.withProject(project => project.boardModel.resetBoard()), 'menu-reset');
    item(this.sounds.enabled ? 'sound' : 'soundOff', this.sounds.enabled ? T('sound.on') : T('sound.off'), () => this.sounds.setEnabled(!this.sounds.enabled), 'menu-sound');
    group(T('menu.forBuilding'));
    item('zoomIn', dictionaryAt('ZoomIn'), () => this.withProject(project => project.boardModel.zoomIn()), 'menu-zoom-in');
    item('zoomOut', dictionaryAt('ZoomOut'), () => this.withProject(project => project.boardModel.zoomOut()), 'menu-zoom-out');
    item('flag', T('menu.setStart'), () => this.withProject(project => { project.boardModel.setCurrentAsResetBoard(); this.flash(); }), 'menu-set');
    item('share', T('menu.reuse'), () => this.openMenuToChooseProjectsToReuse(), 'menu-reuse');
    item('save', dictionaryAt('FileOut') + ' (.dialog.ar)', () => this.fileOut(), 'menu-file-out');
  }

  openAchievements() {
    this.closeSheet();
    const sheet = new Sheet(this.root, { title: 'Logros', className: 'menu-sheet', onClosed: () => { this.sheet = null; } });
    this.sheet = sheet;
    const grid = this.element('div', 'badges', sheet.body);
    for (const achievement of Achievements.all()) {
      const unlocked = this.achievements.has(achievement.id);
      this.element('div', 'badge-card' + (unlocked ? '' : ' locked'), grid, '<span class="emoji">' + achievement.emoji + '</span><span class="badge-name">' + achievement.name + '</span><span class="badge-hint">' + achievement.hint + '</span>');
    }
  }

  closeSheet() { if (this.sheet !== null) { const sheet = this.sheet; this.sheet = null; sheet.close(); } }

  // --- proyectos ---

  openProject(project) {
    if (this.boardView !== null) this.boardView.dispose();
    this.closeSheet();
    this.endSession({ abandon: true });
    this.currentProject = project;
    this.opening = true;                 // lo que pasa al abrir no cuenta como cambio del usuario
    this.dirty = false;
    project.connect();
    // En un celular, celdas más chicas para que entre más tablero.
    const side = RepresentarVisualEnvironment.sideOfSymbolsOnEnvironmentPalet();
    if (project.boardModel.gridSize > side + 8 && project.boardModel.items().length > 0) project.boardModel.changeGridSizeTo(side);
    this.boardView = new BoardView(this, project, this.boardContainer, this.dragController);
    this.tray.bind(project);
    this.paused = false;
    this.pausedBySlots = false;
    this.titleText.value = project.projectName;
    this.refreshJoysticks();
    try {
      project.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
    } catch (error) {
      console.error(error);
    }
    this.root.hidden = false;
    this.fitBoardToScreen();
    if (project.challenge) this.session = new ChallengeSession(this, project, { usage: this.usage, hintDelayMs: this.hintDelayMs });
    this.boardView.canvas.focus({ preventScroll: true });
    this.opening = false;
    this.dirty = false;
  }

  // Al abrir, lo usado del tablero entra en la pantalla (los proyectos grandes se salían).
  fitBoardToScreen() {
    if (this.boardView === null) return;
    const board = this.currentProject.boardModel;
    if (board.items().length === 0) return;
    const fitted = this.boardView.gridSizeToFit();
    if (fitted !== board.gridSize) board.changeGridSizeTo(fitted);
  }

  // --- desafíos ---

  openChallenge(challenge) {
    const userDrawings = this.mainSpace !== null && this.mainSpace.progress ? this.mainSpace.progress.userDrawings() : [];
    this.openProject(challenge.projectFor({ gridSize: RepresentarVisualEnvironment.sideOfSymbolsOnEnvironmentPalet(), userDrawings }));
    const fit = this.challengeGridSize(challenge.columns, challenge.rows);
    if (fit !== this.currentProject.boardModel.gridSize) this.currentProject.boardModel.changeGridSizeTo(fit);
    return this.session;
  }

  // En un desafío el área de juego entra entera en la pantalla (ancho y alto): nada queda afuera.
  challengeGridSize(columns = CHALLENGE_COLUMNS, rows = 8) {
    const width = this.boardContainer.clientWidth || (typeof window === 'undefined' ? 1440 : window.innerWidth - 24);
    const height = this.boardContainer.clientHeight || (typeof window === 'undefined' ? 900 : window.innerHeight - 300);
    return Math.max(36, Math.min(96, Math.floor((width - 6) / columns), Math.floor((height - 6) / rows)));
  }

  isInChallenge() { return this.session !== null; }

  endSession({ abandon = false } = {}) {
    if (this.session === null) return;
    const session = this.session;
    this.session = null;
    if (abandon) session.abandon(); else session.dispose();
  }

  // El desafío se logró: celebrar y ofrecer seguir o quedarse jugando.
  // Primero se ilumina la regla que lo hizo posible (la causa), después la celebración.
  challengeCompleted(session) {
    const challenge = session.challenge;
    if (this.mainSpace !== null && this.mainSpace.progress) this.mainSpace.progress.complete(challenge);
    this.celebrating = true;
    if (this.mainSpace !== null && this.mainSpace.hideToast) this.mainSpace.hideToast();     // una sola celebración a la vez
    this.boardView.glow(session.ruleItems(), 1100);
    this.sounds.pop();
    clearTimeout(this.successTimer);
    this.successTimer = setTimeout(() => {
      this.sounds.tada();
      if (this.mainSpace !== null && this.mainSpace.confetti) this.mainSpace.confetti(this.root);
      this.showSuccess(session);
    }, this.successDelayMs === undefined ? 1000 : this.successDelayMs);
  }

  isCelebrating() { return this.celebrating === true; }

  showSuccess(session) {
    this.closeSuccess();
    const challenge = session.challenge;
    const next = session.next();
    const overlay = this.element('div', 'challenge-success', this.root);
    overlay.setAttribute('role', 'dialog');
    overlay.innerHTML = '<div class="success-card"><div class="success-medal">' + challenge.emoji + '</div><div class="success-title">' + T('success.title') + '</div><div class="success-subtitle">' + (challenge.praise || challenge.title) + '</div><div class="success-actions"></div></div>';
    const actions = overlay.querySelector('.success-actions');
    const button = (label, iconName, action, className) => {
      const created = this.element('button', 'success-button ' + className, actions, Icons.svg(iconName) + '<span>' + label + '</span>');
      created.type = 'button';
      created.addEventListener('click', () => { this.sounds.tap(); action(); });
      return created;
    };
    if (next !== null) button(T('success.next'), 'arrowRight', () => { this.closeSuccess(); this.openChallenge(next); }, 'primary next-challenge');
    else button(T('success.home'), 'home', () => { this.closeSuccess(); this.backAction(); }, 'primary next-challenge');
    if (this.mainSpace === null || !this.mainSpace.progress || this.mainSpace.progress.freeUnlocked()) button(T('success.stay'), 'pencil', () => { this.closeSuccess(); this.makeItMine(); }, 'secondary make-it-mine');
    this.success = overlay;
  }

  closeSuccess() {
    clearTimeout(this.successTimer);
    if (this.success) { this.success.remove(); this.success = null; }
    this.celebrating = false;
    if (this.mainSpace !== null && this.mainSpace.flushToasts) this.mainSpace.flushToasts();
  }

  // El desafío se vuelve un proyecto libre del chico: toda la bandeja, se guarda en Míos.
  makeItMine() {
    const project = this.currentProject;
    this.endSession();
    project.challenge = null;
    project.availableSymbols = null;
    project.setProjectName(project.projectName + T('mineSuffix'));
    this.titleText.value = project.projectName;
    this.tray.rebuild();
    this.markDirty();
    if (this.usage !== null) this.usage.record('challenge.remix', {});
    if (this.mainSpace !== null && this.mainSpace.toast) this.mainSpace.toast('🧪', T('success.yours'));
  }

  show() { this.root.hidden = false; }
  hide() { this.root.hidden = true; }
  isVisible() { return !this.root.hidden; }

  // Los joysticks aparecen sólo si hay algo que manejar con flechas o con WASD.
  refreshJoysticks() {
    if (this.currentProject === null) return;
    const board = this.currentProject.boardModel;
    const arrows = board.itemsMovableByArrows().length > 0;
    const wasd = board.itemsMovableByWASD().length > 0;
    if (this.joysticks.arrows.element.hidden === !arrows && this.joysticks.wasd.element.hidden === !wasd) return;
    this.joysticks.arrows.show(arrows);
    this.joysticks.wasd.show(wasd);
  }

  // Volver: guarda si es un proyecto propio o si se lo cambió, y vuelve al feed.
  async backAction() {
    if (this.mainSpace === null) return;
    clearTimeout(this.autosaveTimer);
    const project = this.currentProject;
    this.closeSheet();
    this.tray.closeHalo();
    if (this.boardView !== null) this.boardView.closeHalo();
    this.closeSuccess();
    if (project !== null && this.shouldSaveOnBack()) await this.mainSpace.saveProject(project, this);
    this.endSession({ abandon: true });
    this.hide();
    this.mainSpace.returnedFromEditor(project);
  }

  shouldSaveOnBack() {
    const project = this.currentProject;
    if (project.challenge) return false;                                         // un desafío no se guarda (salvo "hacelo tuyo")
    if (project.entryId === undefined) return this.dirty;                       // nuevo o de archivo
    return this.dirty || !String(project.entryId).startsWith('bundled:');        // los propios siempre
  }

  async fullBoardImageBytes() {
    return this.boardView === null ? null : this.boardView.fullBoardImageBytes();
  }

  async projectBytes() {
    const project = this.currentProject;
    const fullBoardImage = await this.fullBoardImageBytes();
    const preview = await this.previewBytes();
    const exporter = RepresentarVisualExporter.forProject(project, { previewImage: preview, fullBoardImage });
    return exporter.bytes();
  }

  async previewBytes() {
    const blob = await new Promise(resolve => this.boardView.previewCanvas().toBlob(resolve, 'image/png'));
    return blob === null ? null : new Uint8Array(await blob.arrayBuffer());
  }

  markDirty() {
    if (this.opening) return;
    this.dirty = true;
    this.scheduleAutosave();
  }

  // Un símbolo soltado en el tablero (desde la bandeja o movido).
  symbolDropped(item) {
    this.sounds.pop();
    this.achievements.unlock('first-drop');
    if (item !== null && item !== undefined && item.consideredSymbol) this.achievements.unlock('rule');
  }

  scheduleAutosave() {
    if (this.currentProject === null || this.mainSpace === null) return;
    clearTimeout(this.autosaveTimer);
    this.autosaveTimer = setTimeout(() => {
      if (this.currentProject !== null && this.shouldSaveOnBack()) this.mainSpace.saveProject(this.currentProject, this).catch(error => console.error(error));
    }, AUTOSAVE_MS);
  }

  // Descargar el proyecto como archivo .dialog.ar.
  async fileOut() {
    if (this.currentProject === null) return;
    const bytes = await this.projectBytes();
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }));
    link.download = this.fileOutName();
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  fileOutName() {
    return this.currentProject.projectName.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').replace(/\s+/g, '') + '.dialog.ar';
  }

  // --- simulación ---

  simulatorStep() {
    if (this.currentProject === null || this.paused || this.pausedBySlots || this.root.hidden) return;
    try {
      this.currentProject.boardModel.step();
    } catch (error) {
      console.error(error);
      this.paused = true;
    }
    if (this.session !== null) this.session.check();
  }

  // --- avisos de la vista ---

  projectChanged(project) {
    if (project !== this.currentProject) return;
    this.tray.rebuild();
    this.refreshJoysticks();
    this.markDirty();
    if (this.session !== null && !this.opening) this.session.userActed();
  }

  // El usuario cambió algo en el tablero (se registró para deshacer).
  boardRecorded(project) {
    if (project !== this.currentProject) return;
    this.refreshJoysticks();
    this.markDirty();
    if (this.session !== null && !this.opening) this.session.userActed();
    if (this.usage !== null && !this.opening) this.usage.record('board.change', { challenge: project.challenge ? project.challenge.id : '' });
  }

  showInspector(monitor, project) {
    if (!monitor.hasRecordedAnySubstitution()) return;
    this.closeSheet();
    const sheet = new Sheet(this.root, { title: dictionaryAt('InspectExecution'), className: 'inspector-sheet', onClosed: () => { this.sheet = null; this.inspector.hide(project); } });
    this.sheet = sheet;
    this.inspector.container = sheet.body;
    this.inspector.show(monitor, project);
    this.achievements.unlock('detective');
  }

  isShowingInspector() { return this.sheet !== null && this.sheet.element.classList.contains('inspector-sheet'); }

  flash() {
    this.root.classList.add('flash');
    setTimeout(() => this.root.classList.remove('flash'), 200);
  }

  // --- dibujar ---

  paintNewSymbol(template = null) {
    if (this.currentProject === null) return;
    const project = this.currentProject;
    this.sounds.pop();
    PaintingTool.open({ template, onFinish: symbol => {
      project.receiveDrawnSymbol(symbol);
      this.tray.rebuild();
      this.achievements.unlock('artist');
      if (this.mainSpace !== null && this.mainSpace.progress) this.mainSpace.progress.rememberDrawing(symbol);
      this.markDirty();
      if (this.session !== null) this.session.userActed();
    } });
  }

  // Modificar un dibujo existente: cambia la imagen de todas sus copias (mismo hash).
  modifyDrawing(symbol) {
    PaintingTool.open({ template: symbol.drawing, onFinish: newSymbol => {
      const drawing = symbol.drawing;
      drawing.image = newSymbol.drawing.image;
      drawing.width = newSymbol.drawing.width;
      drawing.height = newSymbol.drawing.height;
      drawing.pngBytes = null;
      this.tray.rebuild();
      if (this.boardView !== null) this.boardView.changed();
      this.markDirty();
    } });
  }

  // --- reuso de proyectos ---

  openMenuToChooseProjectsToReuse() {
    if (this.mainSpace === null || this.currentProject === null) return;
    this.mainSpace.openMenuToChooseProjectsToReuse(this.currentProject, this.moreButton);
  }
}
