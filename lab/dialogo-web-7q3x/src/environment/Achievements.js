// Los logros: cosas que se hacen por primera vez (soltar un símbolo, mover un personaje,
// dibujar, remixar...). Se recuerdan en el navegador; al desbloquear uno se avisa a quien escuche.
export const ACHIEVEMENTS = [
  { id: 'first-drop', emoji: '🧩', name: 'Primer símbolo', hint: 'Poné un símbolo en el tablero' },
  { id: 'rule', emoji: '✨', name: 'Primera regla', hint: 'Armá una regla con símbolos' },
  { id: 'first-move', emoji: '🕹️', name: 'En movimiento', hint: 'Movete con el joystick' },
  { id: 'artist', emoji: '🎨', name: 'Dibujante', hint: 'Dibujá un símbolo nuevo' },
  { id: 'detective', emoji: '🔍', name: 'Detective', hint: 'Mirá cómo se evaluó una regla' },
  { id: 'explorer', emoji: '🧭', name: 'Explorador', hint: 'Abrí tres proyectos' },
  { id: 'remix', emoji: '🔁', name: 'Remixer', hint: 'Hacé un remix de un proyecto' },
  { id: 'saver', emoji: '💾', name: 'Coleccionista', hint: 'Guardá un proyecto tuyo' },
];

export class Achievements {
  constructor({ storage = null } = {}) {
    this.storage = storage;
    this.unlocked = new Set();
    this.listeners = [];
    this.counters = { projectsOpened: 0 };
    try {
      const saved = storage === null ? null : storage.getItem('representar.achievements');
      if (saved) JSON.parse(saved).forEach(id => this.unlocked.add(id));
    } catch (error) { /* sin storage */ }
  }

  static all() { return ACHIEVEMENTS.slice(); }
  static named(id) { return ACHIEVEMENTS.find(each => each.id === id) || null; }

  onUnlock(listener) { this.listeners.push(listener); }

  has(id) { return this.unlocked.has(id); }
  count() { return this.unlocked.size; }

  unlock(id) {
    const achievement = Achievements.named(id);
    if (achievement === null || this.unlocked.has(id)) return false;
    this.unlocked.add(id);
    this.save();
    for (const listener of this.listeners) listener(achievement);
    return true;
  }

  projectOpened() {
    this.counters.projectsOpened++;
    if (this.counters.projectsOpened >= 3) this.unlock('explorer');
  }

  save() {
    try { if (this.storage !== null) this.storage.setItem('representar.achievements', JSON.stringify([...this.unlocked])); } catch (error) { /* sin storage */ }
  }

  reset() { this.unlocked.clear(); this.save(); }
}
