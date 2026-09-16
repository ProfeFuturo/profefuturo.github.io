import { Icons } from './Icons.js';
import { Challenges } from './Challenge.js';

const HINT_DELAY_MS = 20000;

// Un desafío corriendo en el editor: muestra la meta, mira si se logró después de cada paso,
// da una pista si pasa un rato sin progreso, y celebra. Registra todo en el UsageLog.
export class ChallengeSession {
  constructor(environment, project, { usage = null, hintDelayMs = HINT_DELAY_MS, clock = () => Date.now() } = {}) {
    this.environment = environment;
    this.project = project;
    this.challenge = project.challenge;
    this.usage = usage;
    this.hintDelayMs = hintDelayMs;
    this.clock = clock;
    this.completed = false;
    this.hintsShown = 0;
    this.startedAt = clock();
    this.buildBanner();
    environment.boardView.showSlots(this.challenge.slots);
    this.log('challenge.start');
    this.armHint();
  }

  log(name, data = {}) { if (this.usage !== null) this.usage.record(name, { challenge: this.challenge.id, ...data }); }

  // --- la meta, siempre a la vista ---

  buildBanner() {
    this.banner = document.createElement('div');
    this.banner.className = 'challenge-banner';
    this.banner.setAttribute('role', 'status');
    this.banner.innerHTML = '<span class="challenge-emoji">' + this.challenge.emoji + '</span><span class="challenge-goal">' + this.challenge.goalIn(this.project) + '</span>';
    const restart = document.createElement('button');
    restart.type = 'button';
    restart.className = 'icon-button ghost challenge-restart';
    restart.title = 'Volver a empezar';
    restart.setAttribute('aria-label', restart.title);
    restart.appendChild(Icons.element('reset'));
    restart.addEventListener('click', () => this.restart());
    this.banner.appendChild(restart);
    this.environment.layout.insertBefore(this.banner, this.environment.boardArea);
  }

  restart() {
    this.environment.sounds.whoosh();
    this.project.boardModel.resetBoard();
    this.clearHint();
    this.armHint();
    this.log('challenge.restart');
  }

  // --- progreso ---

  userActed() {
    this.clearHint();
    this.armHint();
    this.check();
  }

  // La consigna cambia con lo que el chico ya hizo (un paso por vez).
  refreshGoal() {
    const goal = this.banner.querySelector('.challenge-goal');
    const text = this.challenge.goalIn(this.project);
    if (goal !== null && goal.textContent !== text) { goal.textContent = text; goal.classList.remove('changed'); void goal.offsetWidth; goal.classList.add('changed'); }
  }

  check() {
    if (this.completed || this.environment.currentProject !== this.project) return false;
    this.refreshGoal();
    if (!this.challenge.completedIn(this.project)) return false;
    this.completed = true;
    this.clearHint();
    this.log('challenge.complete', { seconds: Math.round((this.clock() - this.startedAt) / 1000), hints: this.hintsShown });
    this.environment.challengeCompleted(this);
    return true;
  }

  // Los símbolos del tablero: las reglas que hicieron que pase lo que pasó.
  ruleItems() { return this.project.boardModel.items().filter(item => item.consideredSymbol); }

  // --- pistas ---

  armHint() {
    clearTimeout(this.hintTimer);
    if (this.completed) return;
    this.hintTimer = setTimeout(() => this.showHint(), this.hintDelayMs);
  }

  showHint() {
    if (this.completed) return;
    const hint = this.challenge.hintIn(this.project);
    if (hint === null) return;
    this.currentHint = hint;
    this.hintsShown++;
    const environment = this.environment;
    if (hint.selector) environment.tray.highlight(hint.selector);
    else if (hint.drawing) environment.tray.highlight(hint.drawing);
    else if (hint.pencil) environment.tray.highlightPencil();
    if (hint.cell) environment.boardView.showHintCell(hint.cell);
    if (hint.joystick) environment.joysticks.arrows.element.classList.add('hint');
    if (hint.space) { const key = environment.joysticks.arrows.element.querySelector('.joystick-key.space'); if (key !== null) key.classList.add('hint'); }
    this.log('challenge.hint', { kind: hint.selector ? 'symbol' : hint.drawing ? 'drawing' : hint.pencil ? 'pencil' : hint.joystick ? 'joystick' : hint.space ? 'space' : 'cell' });
    environment.sounds.tap();
  }

  clearHint() {
    clearTimeout(this.hintTimer);
    if (!this.currentHint) return;
    this.currentHint = null;
    this.environment.tray.clearHighlights();
    this.environment.boardView.showHintCell(null);
    this.environment.joysticks.arrows.element.classList.remove('hint');
    for (const key of this.environment.joysticks.arrows.element.querySelectorAll('.joystick-key.hint')) key.classList.remove('hint');
  }

  // --- cierre ---

  next() { return Challenges.after(this.challenge); }

  abandon() {
    if (!this.completed) this.log('challenge.abandon', { seconds: Math.round((this.clock() - this.startedAt) / 1000), hints: this.hintsShown });
    this.dispose();
  }

  dispose() {
    clearTimeout(this.hintTimer);
    this.clearHint();
    this.banner.remove();
    if (this.environment.boardView !== null) this.environment.boardView.showSlots([]);
  }
}
