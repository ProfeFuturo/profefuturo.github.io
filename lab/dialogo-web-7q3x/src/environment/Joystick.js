import { T } from './Texts.js';
import { Icons } from './Icons.js';

// El joystick en pantalla: una cruz de flechas con Enter en el centro y Espacio al lado.
// Reemplaza al teclado físico en celulares y tablets. Uno para las flechas y, si el
// proyecto lo usa, otro para WASD (el segundo jugador).
export class Joystick {
  constructor(container, environment, { keys = 'arrows' } = {}) {
    this.environment = environment;
    this.keys = keys;
    this.element = document.createElement('div');
    this.element.className = 'joystick ' + keys;
    this.element.setAttribute('aria-label', keys === 'arrows' ? 'Flechas' : 'WASD');
    const moves = keys === 'arrows'
      ? { up: b => b.navigateUp(), down: b => b.navigateDown(), left: b => b.navigateLeft(), right: b => b.navigateRight() }
      : { up: b => b.wasdUp(), down: b => b.wasdDown(), left: b => b.wasdLeft(), right: b => b.wasdRight() };
    for (const [name, icon] of [['up', 'arrowUp'], ['left', 'arrowLeft'], ['right', 'arrowRight'], ['down', 'arrowDown']]) {
      this.key(name, icon, name, board => { moves[name](board); board.recordCurrentBoard(); });
    }
    this.goKey = this.key('go', 'play', T('joystick.enter'), () => environment.currentProject.enterKeyPressed());
    this.spaceKey = this.key('space', 'space', T('joystick.space'), () => environment.currentProject.spaceBarPressed());
    this.spaceKey.appendChild(Object.assign(document.createElement('span'), { className: 'space-label', textContent: T('joystick.space') }));
    container.appendChild(this.element);
  }

  // Enter y Espacio sólo cuando alguna regla los usa: si no, son botones "al pedo".
  showExtraKeys({ enter, space }) {
    this.goKey.classList.toggle('unused', !enter);
    this.spaceKey.hidden = !space;
    // La barra va afuera de la cruz de flechas: abajo y al centro, como en un teclado.
    if (this.environment.trayContainer) this.environment.trayContainer.classList.toggle('with-space', space && this.keys === 'arrows');
  }

  key(name, icon, label, action) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'joystick-key ' + name;
    button.setAttribute('aria-label', label);
    button.title = label;
    button.appendChild(Icons.element(icon, { size: 22 }));
    button.addEventListener('pointerdown', event => {
      event.preventDefault();
      if (this.environment.currentProject === null) return;
      this.environment.sounds.step();
      const board = this.environment.currentProject.boardModel;
      action(board);
      if (this.environment.session) this.environment.session.userMoved();   // desde acá el tiempo corre
      if (this.environment.pausedBySlots) { board.makeAllEnqueuedActions(); if (this.environment.session) this.environment.session.check(); }
      this.environment.achievements.unlock('first-move');
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
    this.element.appendChild(button);
    return button;
  }

  show(visible) { this.element.hidden = !visible; }

  remove() { this.element.remove(); }
}
