import { Icons } from './Icons.js';
import { PreviewView } from './PreviewView.js';
import { NullBoardView } from '../board/NullBoardView.js';

const STEP_INTERVAL_MS = 100;
const CATEGORY_NAMES = { games: 'Desafío', didactic: 'Didáctico', mine: 'Mío' };

// El feed: un proyecto por pantalla, corriendo en vivo; se pasa al siguiente deslizando.
// Cada uno se puede jugar ahí mismo (aparece el joystick), abrir en el editor o remixar.
// Sólo corre el proyecto que está a la vista.
export class Feed {
  constructor(container, app) {
    this.app = app;
    this.library = app.library;
    this.element = document.createElement('div');
    this.element.className = 'feed';
    container.appendChild(this.element);
    this.posts = [];
    this.currentIndex = 0;
    this.element.addEventListener('scroll', () => this.scrolled(), { passive: true });
    this.library.onChange(() => this.rebuild());
    this.stepping = setInterval(() => this.step(), STEP_INTERVAL_MS);
    this.animationLoop = () => {                       // los deslizamientos entre pasos
      const state = this.currentPost();
      if (state !== null && state.view !== null && state.view.needsRedraw && this.isVisible()) state.view.draw();
      this.frame = requestAnimationFrame(this.animationLoop);
    };
    this.frame = requestAnimationFrame(this.animationLoop);
  }

  dispose() { clearInterval(this.stepping); cancelAnimationFrame(this.frame); }

  rebuild() {
    const currentId = this.currentPost() === null ? null : this.currentPost().entry.id;
    this.element.innerHTML = '';
    this.posts = [];
    const entries = this.library.feedEntries();
    const nextChallenge = this.app.progress ? this.app.progress.next() : null;
    if (nextChallenge !== null) this.element.appendChild(this.challengePostFor(nextChallenge));
    else if (entries.length === 0) this.element.appendChild(this.emptyPost());
    for (const entry of entries) this.element.appendChild(this.postFor(entry));
    const index = Math.max(0, this.posts.findIndex(post => post.entry.id === currentId));
    this.currentIndex = index;
    if (index > 0) this.element.scrollTop = index * this.element.clientHeight;
    this.layout();
  }

  emptyPost() {
    const post = document.createElement('div');
    post.className = 'post empty';
    post.innerHTML = '<div class="post-board empty-board"><div class="empty-message">' + Icons.svg('pencil', { size: 48 }) + '<span>Creá tu primer proyecto</span></div></div>';
    post.querySelector('.empty-board').addEventListener('click', () => this.app.createProject());
    return post;
  }

  // El próximo desafío, como primer post: se ve en vivo y se juega con un toque.
  challengePostFor(challenge) {
    const project = challenge.projectFor();
    const entry = { id: 'challenge:' + challenge.id, name: challenge.title, source: 'challenge', category: 'challenge', project, title: challenge.title, goal: challenge.goal, challenge };
    const post = document.createElement('div');
    post.className = 'post challenge-post';
    const board = document.createElement('div');
    board.className = 'post-board';
    post.appendChild(board);
    const canvas = document.createElement('canvas');
    canvas.className = 'post-canvas';
    board.appendChild(canvas);
    const top = document.createElement('div');
    top.className = 'post-top';
    top.innerHTML = '<div class="pill challenge-pill">' + Icons.svg('flag', { size: 14 }) + 'Desafío ' + challenge.number + '</div>';
    board.appendChild(top);
    const state = { entry, post, board, canvas, view: new PreviewView(project, canvas, { maxCellFactor: 1.4, minCell: 34 * (window.devicePixelRatio || 1) }), playing: false, joystick: null, playButton: null };
    const caption = document.createElement('div');
    caption.className = 'post-caption';
    caption.style.right = '12px';
    caption.innerHTML = '<div class="who"><span class="avatar">' + challenge.emoji + '</span><span>Tu próximo desafío</span></div>';
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = challenge.title;
    caption.appendChild(title);
    const goal = document.createElement('div');
    goal.className = 'goal';
    goal.textContent = challenge.goal;
    caption.appendChild(goal);
    board.appendChild(caption);
    const go = document.createElement('button');
    go.type = 'button';
    go.className = 'challenge-go';
    go.innerHTML = Icons.svg('play') + '<span>Jugar</span>';
    go.addEventListener('click', () => this.app.openChallenge(challenge));
    board.appendChild(go);
    this.posts.push(state);
    this.layoutPost(state);
    return post;
  }

  postFor(entry) {
    const post = document.createElement('div');
    post.className = 'post';
    const board = document.createElement('div');
    board.className = 'post-board';
    post.appendChild(board);
    const canvas = document.createElement('canvas');
    canvas.className = 'post-canvas';
    board.appendChild(canvas);
    const top = document.createElement('div');
    top.className = 'post-top';
    top.innerHTML = '<div class="pill live"><i></i>en vivo</div><div class="pill">' + Icons.svg(entry.category === 'games' ? 'trophy' : (entry.category === 'didactic' ? 'book' : 'user'), { size: 14 }) + CATEGORY_NAMES[entry.category] + '</div>';
    board.appendChild(top);

    const state = { entry, post, board, canvas, view: null, playing: false, joystick: null, playButton: null };
    const rail = document.createElement('div');
    rail.className = 'post-rail';
    board.appendChild(rail);
    state.playButton = this.railButton(rail, 'play', 'Jugar', () => this.togglePlay(state));
    this.railButton(rail, 'pencil', 'Abrir', () => this.app.openEntry(entry));
    this.railButton(rail, 'remix', 'Remix', () => this.app.remix(entry));
    if (entry.source === 'stored') this.railButton(rail, 'more', 'Más', button => this.app.openEntryMenu(entry, button));

    const caption = document.createElement('div');
    caption.className = 'post-caption';
    const who = document.createElement('div');
    who.className = 'who';
    who.innerHTML = '<span class="avatar">' + (entry.source === 'stored' ? 'V' : 'R') + '</span><span>' + (entry.source === 'stored' ? 'Vos' : 'Representar') + '</span>';
    caption.appendChild(who);
    const title = document.createElement('div');
    title.className = 'title';
    title.textContent = this.library.titleOf(entry);
    caption.appendChild(title);
    if (entry.goal) { const goal = document.createElement('div'); goal.className = 'goal'; goal.textContent = entry.goal; caption.appendChild(goal); }
    board.appendChild(caption);

    this.posts.push(state);
    this.library.projectOf(entry).then(project => {
      state.view = new PreviewView(project, canvas, { maxCellFactor: 1.4, minCell: 34 * (window.devicePixelRatio || 1) });
      this.layoutPost(state);
    }).catch(error => { console.error(error); title.textContent = 'No se pudo abrir: ' + this.library.titleOf(entry); });
    return post;
  }

  railButton(rail, iconName, label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'rail-button';
    button.title = label;
    button.innerHTML = '<span class="bubble">' + Icons.svg(iconName, { size: 22 }) + '</span><span class="label">' + label + '</span>';
    button.addEventListener('click', event => { event.stopPropagation(); this.app.sounds.tap(); action(button); });
    rail.appendChild(button);
    return button;
  }

  // Jugar en el feed: el joystick sobre el proyecto, sin abrirlo.
  togglePlay(state) {
    if (state.entry.project === null) return;
    state.playing = !state.playing;
    state.playButton.classList.toggle('on', state.playing);
    state.playButton.querySelector('.bubble').innerHTML = Icons.svg(state.playing ? 'pause' : 'play', { size: 22 });
    if (state.playing) {
      const board = state.entry.project.boardModel;
      const movable = board.itemsMovableByArrows().length > 0 || board.itemsMovableByWASD().length > 0;
      if (!movable) { this.app.toast('👀', 'Este proyecto se mira, no se maneja'); }
      else if (state.joystick === null) state.joystick = this.app.joystickFor(state.board, state.entry.project);
      if (state.joystick !== null) state.joystick.show(true);
    } else if (state.joystick !== null) {
      state.joystick.show(false);
    }
  }

  stopPlaying(state) {
    if (!state.playing) return;
    this.togglePlay(state);
  }

  layoutPost(state) {
    const ratio = window.devicePixelRatio || 1;
    const width = Math.max(1, Math.round(state.board.clientWidth * ratio));
    const height = Math.max(1, Math.round(state.board.clientHeight * ratio));
    if (state.canvas.width !== width || state.canvas.height !== height) { state.canvas.width = width; state.canvas.height = height; }
    if (state.view !== null) state.view.draw();
  }

  layout() { for (const state of this.posts) this.layoutPost(state); }

  scrolled() {
    const index = Math.round(this.element.scrollTop / Math.max(1, this.element.clientHeight));
    if (index === this.currentIndex) return;
    for (const state of this.posts) this.stopPlaying(state);
    this.currentIndex = index;
  }

  currentPost() { return this.posts[this.currentIndex] || null; }

  isVisible() { return this.element.offsetParent !== null; }

  step() {
    if (!this.isVisible()) return;
    const state = this.currentPost();
    if (state === null || state.view === null) return;
    const project = state.entry.project;
    if (project.boardModel.boardView !== state.view) project.boardModel.boardView = state.view;
    if (state.entry.source !== 'challenge') { try { project.boardModel.step(); } catch (error) { /* un proyecto roto no frena el feed */ } }
    state.view.draw();
  }

  // Cuando el editor devuelve un proyecto, el tablero vuelve a mostrarse en su post.
  detach(project) {
    for (const state of this.posts) if (state.entry.project === project) { project.boardModel.boardView = new NullBoardView(); state.view = new PreviewView(project, state.canvas, { maxCellFactor: 1.4, minCell: 34 * (window.devicePixelRatio || 1) }); this.layoutPost(state); }
  }

  scrollToEntry(entry) {
    const index = this.posts.findIndex(post => post.entry === entry);
    if (index < 0) return;
    this.currentIndex = index;
    this.element.scrollTo({ top: index * this.element.clientHeight, behavior: 'instant' });
  }
}
