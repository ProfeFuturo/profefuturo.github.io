import { Challenges } from './Challenge.js';

// El progreso del chico en la escalera: qué desafíos completó. Se recuerda en el navegador.
export class Progress {
  constructor({ storage = null } = {}) {
    this.storage = storage;
    this.completed = new Set();
    this.listeners = [];
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

  save() {
    try { if (this.storage !== null) this.storage.setItem('representar.progress', JSON.stringify([...this.completed])); } catch (error) { /* sin storage */ }
  }

  reset() { this.completed.clear(); this.save(); }
}
