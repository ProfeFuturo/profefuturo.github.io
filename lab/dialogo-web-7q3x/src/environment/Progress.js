import { Challenges, Builds } from './Challenge.js';
import { Drawing } from '../metamodel/Drawing.js';
import { VisualSymbol } from '../metamodel/VisualSymbol.js';

const DRAWINGS_TO_KEEP = 3;

// El progreso del chico en la escalera: qué desafíos completó. Se recuerda en el navegador.
export class Progress {
  constructor({ storage = null } = {}) {
    this.storage = storage;
    this.completed = new Set();
    this.listeners = [];
    this.forcedFree = false;
    try { this.forcedFree = storage !== null && storage.getItem('representar.free') === '1'; } catch (error) { /* sin storage */ }
    this.drawings = [];              // los últimos dibujos del chico (VisualSymbol), para los desafíos que los usan
    try {
      const saved = storage === null ? null : storage.getItem('representar.progress');
      if (saved) JSON.parse(saved).forEach(id => this.completed.add(id));
    } catch (error) { /* sin storage */ }
  }

  onChange(listener) { this.listeners.push(listener); }

  isCompleted(challenge) { return this.completed.has(challenge.id); }
  completedCount() { return this.completed.size; }
  hasStarted() { return this.completed.size > 0; }

  complete(challenge) {
    if (this.completed.has(challenge.id)) return false;
    this.completed.add(challenge.id);
    this.save();
    for (const listener of this.listeners) listener(challenge);
    return true;
  }

  // El próximo desafío sin completar (el primero de la escalera al principio); null si terminó.
  next() { return Challenges.all().find(challenge => !this.completed.has(challenge.id)) || null; }
  nextBuild() { return Builds.all().find(build => !this.completed.has(build.id)) || null; }

  // --- las etapas: primero jugar y ganar medallas, después armar los juegos del curso, al final crear libre ---

  ladderDone() { return Challenges.all().every(challenge => this.completed.has(challenge.id)); }
  worldDone(world) { const inWorld = Challenges.inWorld(world.id); return inWorld.length > 0 && inWorld.every(challenge => this.completed.has(challenge.id)); }
  buildsUnlocked() { return this.ladderDone(); }
  buildsDone() { return Builds.all().every(build => this.completed.has(build.id)); }
  freeUnlocked() { return this.forcedFree || (this.ladderDone() && this.buildsDone()); }
  phase() { return !this.ladderDone() ? 'ladder' : !this.buildsDone() && !this.forcedFree ? 'builds' : 'free'; }

  // Para docentes y pruebas: destrabar la creación libre sin pasar por todo (?free=1).
  unlockFree() { this.forcedFree = true; try { if (this.storage !== null) this.storage.setItem('representar.free', '1'); } catch (error) { /* sin storage */ } for (const listener of this.listeners) listener(null); }

  save() {
    try { if (this.storage !== null) this.storage.setItem('representar.progress', JSON.stringify([...this.completed])); } catch (error) { /* sin storage */ }
  }

  // --- los dibujos del chico viajan de un desafío al siguiente ---

  rememberDrawing(symbol) {
    this.drawings = [symbol, ...this.drawings.filter(each => !each.equals(symbol))].slice(0, DRAWINGS_TO_KEEP);
    try {
      if (this.storage !== null) {
        const urls = this.drawings.map(each => each.drawing.image && each.drawing.image.toDataURL ? each.drawing.image.toDataURL('image/png') : null).filter(url => url !== null);
        this.storage.setItem('representar.drawings', JSON.stringify(urls));
      }
    } catch (error) { /* sin storage o sin canvas */ }
  }

  userDrawings() { return this.drawings.slice(); }

  // Recupera los dibujos guardados (sólo en el navegador; las imágenes se cargan de a poco).
  async loadDrawings() {
    if (this.storage === null || typeof Image === 'undefined') return this.drawings;
    let urls = [];
    try { urls = JSON.parse(this.storage.getItem('representar.drawings') || '[]'); } catch (error) { return this.drawings; }
    const loaded = await Promise.all(urls.map(url => new Promise(resolve => {
      const image = new Image();
      image.onload = () => resolve(VisualSymbol.fromDrawing(new Drawing({ hash: 'mine:' + url.length + ':' + url.slice(-24), image, width: image.width, height: image.height })));
      image.onerror = () => resolve(null);
      image.src = url;
    })));
    this.drawings = loaded.filter(symbol => symbol !== null).concat(this.drawings).slice(0, DRAWINGS_TO_KEEP);
    return this.drawings;
  }

  reset() { this.completed.clear(); this.drawings = []; this.forcedFree = false; try { if (this.storage !== null) this.storage.removeItem('representar.free'); } catch (error) { /* sin storage */ } this.save(); }
}
