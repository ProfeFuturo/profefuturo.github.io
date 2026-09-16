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
    this.key('go', 'play', 'Enter', () => environment.currentProject.enterKeyPressed());
    this.key('space', 'space', 'Espacio', () => environment.currentProject.spaceBarPressed());
    container.appendChild(this.element);
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
      action(this.environment.currentProject.boardModel);
      this.environment.achievements.unlock('first-move');
    });
    button.addEventListener('contextmenu', event => event.preventDefault());
    this.element.appendChild(button);
    return button;
  }

  show(visible) { this.element.hidden = !visible; }

  remove() { this.element.remove(); }
}
