import { Icons } from './Icons.js';

// Una hoja que sube desde abajo (el inspector, los menús largos): manija, botón de cerrar,
// cuerpo con scroll. Se cierra tocando afuera, con el botón o con Escape.
export class Sheet {
  constructor(container, { title = '', onClosed = null, className = '' } = {}) {
    this.container = container;
    this.onClosed = onClosed;
    this.scrim = document.createElement('div');
    this.scrim.className = 'sheet-scrim';
    this.scrim.addEventListener('pointerdown', () => this.close());
    this.element = document.createElement('div');
    this.element.className = 'sheet ' + className;
    this.element.setAttribute('role', 'dialog');
    const top = document.createElement('div');
    top.className = 'sheet-top';
    const handle = document.createElement('div');
    handle.className = 'sheet-handle';
    top.appendChild(handle);
    if (title) {
      const heading = document.createElement('div');
      heading.className = 'sheet-title';
      heading.textContent = title;
      top.appendChild(heading);
    }
    const close = document.createElement('button');
    close.type = 'button';
    close.className = 'icon-button sheet-close';
    close.title = 'Cerrar';
    close.setAttribute('aria-label', 'Cerrar');
    close.appendChild(Icons.element('chevronDown'));
    close.addEventListener('click', () => this.close());
    top.appendChild(close);
    this.element.appendChild(top);
    this.body = document.createElement('div');
    this.body.className = 'sheet-body';
    this.element.appendChild(this.body);
    container.appendChild(this.scrim);
    container.appendChild(this.element);
    this.onKey = event => { if (event.key === 'Escape') this.close(); };
    window.addEventListener('keydown', this.onKey);
  }

  isOpen() { return this.element.parentNode !== null; }

  close() {
    if (!this.isOpen()) return;
    this.element.remove();
    this.scrim.remove();
    window.removeEventListener('keydown', this.onKey);
    if (this.onClosed !== null) { const callback = this.onClosed; this.onClosed = null; callback(this); }
  }
}
