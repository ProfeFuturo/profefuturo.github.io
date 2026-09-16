import { SymbolPainter } from './SymbolPainter.js';

// Arrastre con pointer events (mouse, dedo o lápiz): un fantasma sigue al puntero y al
// soltar se avisa a quien corresponda (el tablero o "afuera").
export class DragController {
  constructor() {
    this.current = null;
    this.dropTargets = [];
    this.onPointerMove = event => this.pointerMoved(event);
    this.onPointerUp = event => this.pointerReleased(event);
    this.onPointerCancel = event => this.cancel();
  }

  // target: { element, dropAt(clientX, clientY, payload, controller) → boolean }
  addDropTarget(target) { this.dropTargets.push(target); }

  isDragging() { return this.current !== null; }

  start(event, payload, { size = 50, thumbnail = null, onDropOutside = null, keepAfterDrop = false } = {}) {
    if (this.current !== null) this.cancel();
    const ghost = thumbnail || SymbolPainter.thumbnail(payload.symbol, size, { framed: payload.framed });
    ghost.className = 'drag-ghost';
    ghost.style.width = size + 'px';
    ghost.style.height = size + 'px';
    document.body.appendChild(ghost);
    this.current = { payload, ghost, size, onDropOutside, keepAfterDrop, pointerId: event.pointerId };
    this.moveGhost(event.clientX, event.clientY);
    window.addEventListener('pointermove', this.onPointerMove);
    window.addEventListener('pointerup', this.onPointerUp);
    window.addEventListener('pointercancel', this.onPointerCancel);
  }

  moveGhost(clientX, clientY) {
    const { ghost, size } = this.current;
    ghost.style.left = (clientX - size / 2) + 'px';
    ghost.style.top = (clientY - size / 2) + 'px';
  }

  pointerMoved(event) {
    if (this.current === null) return;
    this.moveGhost(event.clientX, event.clientY);
    event.preventDefault();
  }

  pointerReleased(event) {
    if (this.current === null) return;
    const { payload, onDropOutside, keepAfterDrop } = this.current;
    const target = this.dropTargets.find(each => DragController.isOver(each.element, event.clientX, event.clientY));
    let dropped = false;
    if (target !== undefined) dropped = target.dropAt(event.clientX, event.clientY, payload, this);
    else if (onDropOutside !== null) onDropOutside(payload);
    if (dropped && keepAfterDrop) return;
    this.cancel();
  }

  static isOver(element, clientX, clientY) {
    const rect = element.getBoundingClientRect();
    return clientX >= rect.left && clientX <= rect.right && clientY >= rect.top && clientY <= rect.bottom;
  }

  cancel() {
    if (this.current === null) return;
    this.current.ghost.remove();
    this.current = null;
    window.removeEventListener('pointermove', this.onPointerMove);
    window.removeEventListener('pointerup', this.onPointerUp);
    window.removeEventListener('pointercancel', this.onPointerCancel);
  }
}
