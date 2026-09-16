import { T } from './Texts.js';
import { Icons } from './Icons.js';
import { Feed } from './Feed.js';
import { Sheet } from './Sheet.js';
import { Joystick } from './Joystick.js';
import { Sounds } from './Sounds.js';
import { Achievements } from './Achievements.js';
import { Progress } from './Progress.js';
import { UsageLog } from './UsageLog.js';
import { UsageSync } from './UsageSync.js';
import { Challenges, Builds } from './Challenge.js';
import { ProjectLibrary } from './ProjectLibrary.js';
import { RepresentarVisualEnvironment } from './RepresentarVisualEnvironment.js';
import { LanguageProvider, dictionaryAt } from '../io/LanguageProvider.js';

// La aplicación: el feed de proyectos, "Míos", los logros, la barra de navegación, la
// pestaña para crear y el editor (RepresentarVisualEnvironment). Es la dueña de la
// biblioteca de proyectos, los sonidos y los logros. Reemplaza al WelcomeSpace de Cuis.
export class RepresentarApp {
  constructor(root, { library = new ProjectLibrary(), languages = [], storage = null, confirmRemoval = null } = {}) {
    this.root = root;
    this.library = library;
    this.languages = languages;
    this.storage = storage;
    this.sounds = new Sounds({ storage });
    this.achievements = new Achievements({ storage });
    this.progress = new Progress({ storage });
    this.usage = new UsageLog({ storage });
    this.usageSync = new UsageSync(this.usage).start();
    const record = this.usage.record.bind(this.usage);
    this.usage.record = (name, data) => { const event = record(name, data); this.usageSync.eventRecorded(); return event; };
    this.progress.onChange(challenge => {
      this.feed.rebuild();
      if (challenge !== null && Challenges.worldOf(challenge) && this.progress.worldDone(Challenges.worldOf(challenge))) this.achievements.unlock('world');
      if (this.progress.ladderDone()) this.achievements.unlock('ladder');
      this.refreshPhase();
      if (challenge === null && this.progress.freeUnlocked() && this.currentScreen === 'play') this.showScreen('feed');   // destrabado a mano: al inicio
      if (this.currentScreen === 'badges') this.renderBadges();
      if (this.currentScreen === 'play') this.renderPlay();
    });
    this.progress.loadDrawings().catch(() => {});
    this.confirmRemoval = confirmRemoval || (entry => confirm(dictionaryAt('AreYouSureYouWantToDeleteProject') + ' (' + entry.name + ')'));
    this.achievements.onUnlock(achievement => this.celebrate(achievement));
    this.build();
    this.environment = new RepresentarVisualEnvironment(this.editorRoot, { mainSpace: this });
    this.environment.hide();
    this.bindFileDrop();
  }

  dispose() {
    this.feed.dispose();
    this.environment.dispose();
    this.usageSync.stop();
  }

  dictionaryAt(key) { return dictionaryAt(key); }

  // --- construcción ---

  build() {
    this.root.innerHTML = '';
    this.root.classList.add('app');
    this.body = this.element('div', 'app-body', this.root);
    this.playScreen = this.element('div', 'screen screen-play list-screen', this.body);
    this.feedScreen = this.element('div', 'screen screen-feed', this.body);
    this.feed = new Feed(this.feedScreen, this);
    this.mineScreen = this.element('div', 'screen screen-mine list-screen', this.body);
    this.badgesScreen = this.element('div', 'screen screen-badges list-screen', this.body);
    this.buildPlay();
    this.buildMine();
    this.buildBadges();
    this.edgeTab = this.element('button', 'edge-tab', this.body, Icons.svg('pencil') + '<span>' + dictionaryAt('Create') + '</span>');
    this.edgeTab.type = 'button';
    this.edgeTab.title = dictionaryAt('NewProject');
    this.edgeTab.addEventListener('click', () => this.createProject());
    this.buildNav();
    this.editorRoot = this.element('div', 'editor', this.root);
    this.showScreen(this.progress.freeUnlocked() ? 'feed' : 'play');
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

  buildNav() {
    this.nav = this.element('nav', 'nav', this.root);
    this.navButtons = {};
    const add = (key, label, iconName) => {
      const button = this.element('button', 'nav-button', this.nav, Icons.svg(iconName) + '<span>' + label + '</span>');
      button.type = 'button';
      button.addEventListener('click', () => { this.sounds.tap(); this.showScreen(key); });
      this.navButtons[key] = button;
      return button;
    };
    add('play', T('nav.play'), 'flag');
    add('feed', T('nav.home'), 'home');
    add('mine', T('nav.mine'), 'user');
    const create = this.element('button', 'nav-button create', this.nav, '<span class="plus">' + Icons.svg('plus') + '</span>');
    create.type = 'button';
    create.title = dictionaryAt('NewProject');
    create.setAttribute('aria-label', dictionaryAt('NewProject'));
    create.addEventListener('click', () => this.createProject());
    this.createButton = create;
    const badges = add('badges', T('nav.badges'), 'medal');
    this.navBadge = this.element('span', 'nav-count', badges);
    this.refreshNavBadge();
    this.refreshPhase();
  }

  // Primero se juega y se ganan medallas; los juegos del curso y la creación libre se destraban después.
  refreshPhase() {
    const free = this.progress.freeUnlocked();
    this.navButtons.feed.hidden = !free;
    this.navButtons.mine.hidden = !free;
    this.createButton.hidden = !free;
    this.edgeTab.hidden = !free || this.currentScreen !== 'feed';
  }

  refreshNavBadge() {
    const count = this.achievements.count();
    this.navBadge.textContent = count > 0 ? String(count) : '';
    this.navBadge.hidden = count === 0;
  }

  showScreen(name) {
    if ((name === 'feed' || name === 'mine') && !this.progress.freeUnlocked()) name = 'play';
    this.currentScreen = name;
    this.playScreen.hidden = name !== 'play';
    this.feedScreen.hidden = name !== 'feed';
    this.mineScreen.hidden = name !== 'mine';
    this.badgesScreen.hidden = name !== 'badges';
    this.edgeTab.hidden = name !== 'feed' || !this.progress.freeUnlocked();
    for (const [key, button] of Object.entries(this.navButtons)) button.setAttribute('aria-selected', String(key === name));
    if (name === 'play') this.renderPlay();
    if (name === 'feed') this.feed.layout();
    if (name === 'mine') this.renderMine();
    if (name === 'badges') this.renderBadges();
  }

  show() {
    this.body.hidden = false;
    this.nav.hidden = false;
    this.refreshPhase();
    this.showScreen(this.currentScreen || (this.progress.freeUnlocked() ? 'feed' : 'play'));
  }

  hide() {
    this.body.hidden = true;
    this.nav.hidden = true;
  }

  isVisible() { return !this.body.hidden; }

  // --- míos ---

  buildMine() {
    const top = this.element('div', 'list-top', this.mineScreen);
    this.element('h2', '', top).textContent = T('mine.title');
    this.iconButton(top, 'globe', T('language'), button => this.openLanguageMenu(button), 'ghost');
    this.soundButton = this.iconButton(top, this.sounds.enabled ? 'sound' : 'soundOff', T('sound'), () => this.toggleSound(), 'ghost');
    this.iconButton(top, 'folder', T('openFile'), () => this.fileInput.click(), 'ghost');
    this.fileInput = this.element('input', 'file-input', top);
    this.fileInput.type = 'file';
    this.fileInput.accept = '.ar,.zip,application/zip';
    this.fileInput.hidden = true;
    this.fileInput.addEventListener('change', () => { if (this.fileInput.files[0]) this.openFile(this.fileInput.files[0]); this.fileInput.value = ''; });
    const profile = this.element('div', 'profile', this.mineScreen);
    this.element('div', 'avatar', profile).textContent = 'V';
    this.mineStats = this.element('div', 'stats', profile);
    this.mineGrid = this.element('div', 'grid', this.mineScreen);
  }

  renderMine() {
    const mine = this.library.mine();
    this.mineStats.innerHTML = '<span><b>' + mine.length + '</b>' + T('mine.projects') + '</span><span><b>' + this.achievements.count() + '</b>' + T('mine.badges') + '</span>';
    this.mineGrid.innerHTML = '';
    const add = this.element('button', 'mini new', this.mineGrid, '<span class="plus">' + Icons.svg('plus') + '</span><span>Nuevo</span>');
    add.type = 'button';
    add.addEventListener('click', () => this.createProject());
    for (const entry of mine) {
      const card = this.element('button', 'mini', this.mineGrid);
      card.type = 'button';
      card.dataset.entryId = entry.id;
      const image = this.element('img', 'mini-preview', card);
      image.alt = '';
      if (entry.previewUrl) image.src = entry.previewUrl;
      this.element('div', 'name', card).textContent = entry.name;
      card.addEventListener('click', () => this.openEntry(entry));
      card.addEventListener('contextmenu', event => { event.preventDefault(); this.openEntryMenu(entry, card); });
    }
  }

  // --- logros ---

  buildPlay() {
    const top = this.element('div', 'list-top', this.playScreen);
    this.element('h2', '', top).textContent = T('play.title');
    this.iconButton(top, 'globe', T('language'), button => this.openLanguageMenu(button), 'ghost');
    this.playSoundButton = this.iconButton(top, this.sounds.enabled ? 'sound' : 'soundOff', T('sound'), () => this.toggleSound(), 'ghost');
    this.playList = this.element('div', 'play-list', this.playScreen);
  }

  renderPlay() {
    this.playList.innerHTML = '';
    const next = this.progress.next();
    if (next !== null) {
      const button = this.element('button', 'next-card', this.playList, '<span class="next-emoji">' + next.emoji + '</span><span class="next-text"><b>' + T('play.next') + '</b><span>' + next.number + '. ' + next.title + '</span></span>' + Icons.svg('play'));
      button.type = 'button';
      button.addEventListener('click', () => this.openChallenge(next));
    }
    for (const world of Challenges.worlds()) this.renderWorld(world, this.playList);
    const builds = this.element('div', 'world-heading' + (this.progress.buildsUnlocked() ? '' : ' locked'), this.playList);
    builds.innerHTML = '<span class="world-emoji">🛠️</span><span class="world-title">' + T('play.builds') + '</span><span class="world-count">' + (this.progress.buildsUnlocked() ? Builds.all().filter(build => this.progress.isCompleted(build)).length + '/' + Builds.all().length : Icons.svg('lock')) + '</span>';
    if (this.progress.buildsUnlocked()) {
      const ladder = this.element('div', 'ladder', this.playList);
      for (const build of Builds.all()) this.renderStep(build, ladder);
    } else this.element('div', 'locked-hint', this.playList).textContent = T('play.locked');
    const free = this.element('div', 'world-heading' + (this.progress.freeUnlocked() ? '' : ' locked'), this.playList);
    free.innerHTML = '<span class="world-emoji">🎨</span><span class="world-title">' + T('play.free') + '</span><span class="world-count">' + (this.progress.freeUnlocked() ? Icons.svg('check') : Icons.svg('lock')) + '</span>';
    if (!this.progress.freeUnlocked()) this.element('div', 'locked-hint', this.playList).textContent = T('play.freeHint');
  }

  // Un mundo terminado se muestra cerrado (sólo su título y 10/10); tocarlo lo abre.
  renderWorld(world, container) {
    const challenges = Challenges.inWorld(world.id);
    const done = challenges.filter(challenge => this.progress.isCompleted(challenge)).length;
    this.expandedWorlds = this.expandedWorlds || new Set();
    const expanded = done < challenges.length || this.expandedWorlds.has(world.id);
    const heading = this.element('button', 'world-heading' + (expanded ? '' : ' collapsed'), container);
    heading.type = 'button';
    heading.innerHTML = '<span class="world-emoji">' + world.emoji + '</span><span class="world-title">' + world.title + '</span><span class="world-count">' + done + '/' + challenges.length + '</span>' + Icons.svg(expanded ? 'chevronDown' : 'chevronRight', { size: 18 });
    heading.addEventListener('click', () => { if (this.expandedWorlds.has(world.id)) this.expandedWorlds.delete(world.id); else this.expandedWorlds.add(world.id); this.renderPlay(); });
    if (!expanded) return;
    const ladder = this.element('div', 'ladder', container);
    for (const challenge of challenges) this.renderStep(challenge, ladder);
  }

  renderStep(challenge, ladder) {
    const completed = this.progress.isCompleted(challenge);
    const step = this.element('button', 'ladder-step' + (completed ? ' done' : ''), ladder, '<span class="ladder-emoji">' + challenge.emoji + '</span><span class="ladder-title">' + challenge.number + '. ' + challenge.title + '</span>' + (completed ? Icons.svg('check') : Icons.svg('play')));
    step.type = 'button';
    step.title = challenge.goal;
    step.addEventListener('click', () => this.openChallenge(challenge));
  }

  buildBadges() {
    const top = this.element('div', 'list-top', this.badgesScreen);
    this.element('h2', '', top).textContent = T('badges.title');
    this.badgesGrid = this.element('div', 'badges', this.badgesScreen);
  }

  renderBadges() {
    this.badgesGrid.innerHTML = '';
    for (const achievement of Achievements.all()) {
      const unlocked = this.achievements.has(achievement.id);
      const card = this.element('div', 'badge-card' + (unlocked ? '' : ' locked'), this.badgesGrid);
      card.innerHTML = '<span class="emoji">' + achievement.emoji + '</span><span class="badge-name">' + achievement.name + '</span><span class="badge-hint">' + achievement.hint + '</span>';
    }
  }

  celebrate(achievement) {
    this.sounds.tada();
    this.toast(achievement.emoji, achievement.name);
    this.confetti();
    this.refreshNavBadge();
    if (this.currentScreen === 'badges') this.renderBadges();
    this.environment.achievementUnlocked(achievement);
  }

  // --- desafíos ---

  // Al abrir la app por primera vez, directo al primer desafío.
  start() {
    const next = this.progress.next();
    if (!this.progress.hasStarted() && next !== null) this.openChallenge(next);
    else if (!this.progress.freeUnlocked()) { this.show(); this.showScreen('play'); }
    return this;
  }

  openChallenge(challenge) {
    this.sounds.whoosh();
    this.hide();
    this.environment.openChallenge(challenge);
  }

  // --- abrir, crear, remixar ---

  async openEntry(entry) {
    try {
      const project = await this.library.projectOf(entry);
      this.openProject(project);
    } catch (error) {
      console.error(error);
      this.toast('⚠️', T('error.open'));
    }
  }

  openProject(project) {
    this.sounds.whoosh();
    this.hide();
    this.environment.openProject(project);
    this.achievements.projectOpened();
  }

  createProject() {
    this.sounds.pop();
    const project = this.library.newProject({ name: dictionaryAt('projectWithoutProperName'), gridSize: RepresentarVisualEnvironment.sideOfSymbolsOnEnvironmentPalet() });
    this.openProject(project);
  }

  async remix(entry) {
    try {
      const project = await this.library.remix(entry);
      this.achievements.unlock('remix');
      this.openProject(project);
      this.environment.markDirty();        // un remix es tuyo desde el primer momento
    } catch (error) {
      console.error(error);
      this.toast('⚠️', T('error.copy'));
    }
  }

  async openFile(file) {
    await this.openBytes(new Uint8Array(await file.arrayBuffer()));
  }

  async openBytes(bytes) {
    try {
      const project = await this.library.projectFromBytes(bytes);
      this.openProject(project);
    } catch (error) {
      console.error(error);
      this.toast('⚠️', T('error.file'));
    }
  }

  bindFileDrop() {
    this.root.addEventListener('dragover', event => { event.preventDefault(); });
    this.root.addEventListener('drop', event => {
      event.preventDefault();
      const file = event.dataTransfer.files[0];
      if (file && (file.name.endsWith('.ar') || file.name.endsWith('.zip'))) this.openFile(file);
    });
  }

  // Al volver del editor: guardar (si es propio o cambió) y mostrar el feed en ese proyecto.
  async saveProject(project, environment) {
    if (project === null) return null;
    const { bytes, preview } = await ProjectLibrary.bytesOf(project, { fullBoardImage: await environment.fullBoardImageBytes() });
    const entry = await this.library.save(project, { bytes, preview });
    this.achievements.unlock('saver');
    return entry;
  }

  returnedFromEditor(project) {
    this.show();
    if (project !== null) {
      this.feed.detach(project);
      const entry = project.entryId === undefined ? null : this.library.entryWithId(project.entryId);
      if (entry !== null) this.feed.scrollToEntry(entry);
    }
  }

  // --- menús ---

  openEntryMenu(entry, anchor) {
    const sheet = new Sheet(this.root, { title: this.library.titleOf(entry), className: 'menu-sheet' });
    const item = (iconName, label, action) => {
      const button = this.element('button', 'menu-item', sheet.body, Icons.svg(iconName) + '<span>' + label + '</span>');
      button.type = 'button';
      button.addEventListener('click', async () => { sheet.close(); this.sounds.tap(); await action(); });
    };
    item('pencil', T('open'), () => this.openEntry(entry));
    item('remix', T('copyAndChange'), () => this.remix(entry));
    item('save', T('download'), () => this.download(entry));
    if (entry.source === 'stored') item('trash', dictionaryAt('Delete'), () => this.removeEntry(entry));
  }

  async download(entry) {
    await this.library.ensureBytesOf(entry);
    const link = document.createElement('a');
    link.href = URL.createObjectURL(new Blob([entry.bytes], { type: 'application/zip' }));
    link.download = entry.name.replace(/[^\w\-áéíóúñÁÉÍÓÚÑ ]+/g, '').replace(/\s+/g, '') + '.dialog.ar';
    link.click();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async removeEntry(entry) {
    if (!this.confirmRemoval(entry)) return;
    await this.library.remove(entry);
    if (this.currentScreen === 'mine') this.renderMine();
    this.sounds.whoosh();
  }

  openMenuToChooseProjectsToReuse(project, anchor) {
    const sheet = new Sheet(this.root, { title: dictionaryAt('ChooseOtherProjectsToReuse'), className: 'menu-sheet' });
    for (const entry of this.library.all()) {
      if (project.entryId !== undefined && entry.id === project.entryId) continue;
      const reusing = project.isReusingProjectNamed(entry.name);
      const button = this.element('button', 'menu-item' + (reusing ? ' checked' : ''), sheet.body, Icons.svg(reusing ? 'check' : 'book') + '<span>' + this.library.titleOf(entry) + '</span>');
      button.type = 'button';
      button.addEventListener('click', async () => {
        sheet.close();
        try {
          const other = await this.library.projectOf(entry);
          project.invertReuseOfProject(other);
          this.environment.tray.rebuild();
          this.environment.scheduleAutosave();
        } catch (error) { console.error(error); }
      });
    }
  }

  openLanguageMenu() {
    if (this.languages.length === 0) return this.toast('🌐', LanguageProvider.current().name);
    const sheet = new Sheet(this.root, { title: T('language'), className: 'menu-sheet' });
    for (const language of this.languages) {
      const current = LanguageProvider.current() === language;
      const button = this.element('button', 'menu-item' + (current ? ' checked' : ''), sheet.body, Icons.svg(current ? 'check' : 'globe') + '<span>' + language.name + '</span>');
      button.type = 'button';
      button.addEventListener('click', () => { sheet.close(); this.currentLanguageName(language); });
    }
  }

  currentLanguageName(language) {
    LanguageProvider.setCurrent(language);
    try { if (this.storage !== null) this.storage.setItem('representar.language', language.name); } catch (error) { /* sin storage */ }
    this.environment.build();
    this.environment.hide();
    this.edgeTab.querySelector('span').textContent = dictionaryAt('Create');
  }

  toggleSound() {
    this.sounds.setEnabled(!this.sounds.enabled);
    this.soundButton.innerHTML = Icons.svg(this.sounds.enabled ? 'sound' : 'soundOff');
    if (this.sounds.enabled) this.sounds.pop();
  }

  // Un joystick para jugar un proyecto sin abrirlo (en el feed).
  joystickFor(container, project) {
    const environment = { currentProject: project, sounds: this.sounds, achievements: this.achievements };
    return new Joystick(container, environment);
  }

  // --- avisos ---

  toast(emoji, text) {
    if (this.environment && this.environment.isCelebrating()) { this.pendingToasts = (this.pendingToasts || []).concat([[emoji, text]]); return; }
    if (this.toastElement) this.toastElement.remove();
    const toast = this.element('div', 'toast', this.root, '<span class="emoji">' + emoji + '</span><span>' + text + '</span>');
    toast.setAttribute('role', 'status');
    this.toastElement = toast;
    setTimeout(() => { toast.classList.add('leaving'); setTimeout(() => toast.remove(), 300); }, 2000);
  }

  hideToast() { if (this.toastElement) { this.toastElement.remove(); this.toastElement = null; } }

  // Los avisos que esperaron mientras se celebraba un desafío (uno solo a la vez).
  flushToasts() {
    const pending = this.pendingToasts || [];
    this.pendingToasts = [];
    pending.forEach(([emoji, text], index) => setTimeout(() => this.toast(emoji, text), index * 2300));
  }

  confetti(container = this.root) {
    const colors = ['#FF7A18', '#FF3D77', '#2EC4B6', '#F2C300', '#5B8DEF'];
    for (let i = 0; i < 18; i++) {
      const piece = this.element('div', 'confetti', container);
      piece.style.left = (35 + Math.random() * 30) + '%';
      piece.style.background = colors[i % colors.length];
      piece.style.animationDelay = (Math.random() * 120) + 'ms';
      piece.style.transform = 'rotate(' + Math.random() * 360 + 'deg)';
      setTimeout(() => piece.remove(), 1300);
    }
  }
}
