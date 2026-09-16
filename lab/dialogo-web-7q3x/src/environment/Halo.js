import { Icons } from './Icons.js';

const BAR_MARGIN = 10;

// La especificación de una acción del halo (como HaloSpec en Cuis): ícono, ayuda, color
// (verde/rojo dicen el estado), qué hace al tocar (action o tap) o al arrastrar (drag).
export class HaloSpec {
  constructor({ horizontalPlacement = 'center', verticalPlacement = 'topCenter', color = 'transparent', iconSymbol, hoverHelp, action = null, drag = null, tap = null, closesHalo = false }) {
    this.horizontalPlacement = horizontalPlacement;
    this.verticalPlacement = verticalPlacement;
    this.color = color;
    this.iconSymbol = iconSymbol;
    this.hoverHelp = hoverHelp;
    this.action = action;
    this.drag = drag;
    this.tap = tap;
    this.closesHalo = closesHalo;
  }
}

// Un halo: la barra de acciones que aparece junto a un ítem, un dibujo de la paleta o un
// proyecto. Se abre con un toque (o botón derecho / toque largo) y se cierra tocando afuera.
// Es lo que en Cuis eran las manijas de colores alrededor del morph.
export class Halo {
  constructor(target, { bounds, specifications, onClosed = null, name = 'halo' }) {
    this.target = target;
    this.boundsProvider = typeof bounds === 'function' ? bounds : () => bounds;
    this.specificationsProvider = typeof specifications === 'function' ? specifications : () => specifications;
    this.onClosed = onClosed;
    this.dragging = false;
    this.element = document.createElement('div');
    this.element.className = 'halo-bar ' + name;
    this.element.setAttribute('role', 'toolbar');
    document.body.appendChild(this.element);
    this.onOutsidePointerDown = event => { if (!this.element.contains(event.target)) this.close(); };
    setTimeout(() => window.addEventListener('pointerdown', this.onOutsidePointerDown, true), 0);
    this.refresh();
  }

  // Redibuja las acciones según el estado actual del objeto (ojo abierto/cerrado, etc.)
  // y reubica la barra. Mientras se arrastra una acción sólo se reubica.
  refresh() {
    const bounds = this.boundsProvider();
    if (bounds === null) return this.close();
    if (!this.dragging) {
      this.element.innerHTML = '';
      for (const spec of this.specificationsProvider()) this.element.appendChild(this.handleFor(spec));
    }
    this.place(bounds);
  }

  place(bounds) {
    const width = this.element.offsetWidth || 0;
    const height = this.element.offsetHeight || 0;
    const viewportWidth = window.innerWidth, viewportHeight = window.innerHeight;
    let left = bounds.left + bounds.width / 2 - width / 2;
    left = Math.max(BAR_MARGIN, Math.min(viewportWidth - width - BAR_MARGIN, left));
    let top = bounds.top - height - BAR_MARGIN;
    let below = false;
    if (top < BAR_MARGIN) { top = bounds.top + bounds.height + BAR_MARGIN; below = true; }
    if (top + height > viewportHeight - BAR_MARGIN) top = Math.max(BAR_MARGIN, viewportHeight - height - BAR_MARGIN);
    this.element.style.left = left + 'px';
    this.element.style.top = top + 'px';
    this.element.classList.toggle('below', below);
    const arrowX = bounds.left + bounds.width / 2 - left;
    this.element.style.setProperty('--arrow-x', Math.max(14, Math.min(width - 14, arrowX)) + 'px');
  }

  handleFor(spec) {
    const handle = document.createElement('button');
    handle.type = 'button';
    handle.className = 'halo-handle';
    handle.dataset.icon = spec.iconSymbol;
    handle.dataset.color = spec.color;
    handle.title = spec.hoverHelp;
    handle.setAttribute('aria-label', spec.hoverHelp);
    handle.appendChild(Icons.element(Halo.iconFor(spec), { size: 22 }));
    handle.addEventListener('pointerdown', event => {
      event.stopPropagation();
      if (spec.drag !== null && spec.tap === null) { event.preventDefault(); this.startDrag(event, spec, handle); }
    });
    if (spec.drag === null || spec.tap !== null) {
      handle.addEventListener('click', event => {
        event.stopPropagation();
        (spec.tap || spec.action)(this);
        if (spec.closesHalo || this.element.parentNode === null) this.close(); else this.refresh();
      });
    }
    return handle;
  }

  // El ojo verde (visible) se muestra como ojo abierto; el rojo (oculto), cerrado.
  static iconFor(spec) {
    if (spec.iconSymbol === 'eyeIcon') return spec.color === 'red' ? 'eyeOff' : 'eye';
    if (spec.iconSymbol === 'reuseIcon') return spec.color === 'red' ? 'shareOff' : 'share';
    return Icons.forHalo(spec.iconSymbol);
  }

  startDrag(event, spec, handle) {
    try { handle.setPointerCapture(event.pointerId); } catch (error) { /* puntero sintético (tests) */ }
    this.dragging = true;
    const move = moveEvent => { spec.drag.moved(moveEvent.clientX, moveEvent.clientY, this); this.refresh(); };
    const up = () => {
      handle.removeEventListener('pointermove', move);
      handle.removeEventListener('pointerup', up);
      handle.removeEventListener('pointercancel', up);
      this.dragging = false;
      if (spec.drag.finished) spec.drag.finished(this);
      this.refresh();
    };
    handle.addEventListener('pointermove', move);
    handle.addEventListener('pointerup', up);
    handle.addEventListener('pointercancel', up);
  }

  handles() { return [...this.element.querySelectorAll('.halo-handle')]; }

  handleWithIcon(iconSymbol) { return this.handles().find(handle => handle.dataset.icon === iconSymbol) || null; }

  isOpen() { return this.element.parentNode !== null; }

  close() {
    if (this.element.parentNode !== null) this.element.remove();
    window.removeEventListener('pointerdown', this.onOutsidePointerDown, true);
    if (this.onClosed !== null) { const callback = this.onClosed; this.onClosed = null; callback(this); }
  }
}
