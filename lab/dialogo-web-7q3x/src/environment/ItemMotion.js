// El movimiento suave de los ítems en pantalla: el modelo salta de celda en celda, pero la
// vista desliza cada ítem hasta su nueva celda (un saltito corto) y hace aparecer los nuevos
// con un "pop". Los teleports (más de dos celdas) no se deslizan: aparecen en destino.
export class ItemMotion {
  constructor({ clock = () => (typeof performance !== 'undefined' ? performance.now() : Date.now()), slideMs = 90, popMs = 160 } = {}) {
    this.clock = clock;
    this.slideMs = slideMs;
    this.popMs = popMs;
    this.states = new Map();       // item → { x, y, fromX, fromY, toX, toY, slideStart, bornAt }
  }

  static ease(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

  // Actualiza con las posiciones del modelo y responde dónde dibujar cada ítem (en celdas) y a
  // qué escala. `animating` dice si hay que seguir redibujando.
  update(itemPositions) {
    const now = this.clock();
    let animating = false;
    for (const item of [...this.states.keys()]) if (!itemPositions.has(item)) this.states.delete(item);
    const placed = new Map();
    for (const [item, target] of itemPositions) {
      let state = this.states.get(item);
      if (state === undefined) {
        state = { x: target.x, y: target.y, fromX: target.x, fromY: target.y, toX: target.x, toY: target.y, slideStart: -Infinity, bornAt: now };
        this.states.set(item, state);
      } else if (state.toX !== target.x || state.toY !== target.y) {
        const distance = Math.abs(target.x - state.toX) + Math.abs(target.y - state.toY);
        if (distance > 2) {                                    // un teleport: sin deslizar
          state.x = state.fromX = target.x; state.y = state.fromY = target.y; state.slideStart = -Infinity;
        } else {
          state.fromX = state.x; state.fromY = state.y; state.slideStart = now;
        }
        state.toX = target.x; state.toY = target.y;
      }
      const slide = Math.min(1, (now - state.slideStart) / this.slideMs);
      if (slide < 1) {
        const eased = ItemMotion.ease(Math.max(0, slide));
        state.x = state.fromX + (state.toX - state.fromX) * eased;
        state.y = state.fromY + (state.toY - state.fromY) * eased;
        animating = true;
      } else { state.x = state.toX; state.y = state.toY; }
      const pop = Math.min(1, (now - state.bornAt) / this.popMs);
      const scale = pop < 1 ? 0.6 + 0.4 * ItemMotion.ease(pop) : 1;
      if (pop < 1) animating = true;
      placed.set(item, { x: state.x, y: state.y, scale });
    }
    return { placed, animating };
  }

  // Cuando el tablero cambia de golpe (abrir, deshacer, reset): todo en su lugar, sin animar.
  reset() { this.states.clear(); }
}
