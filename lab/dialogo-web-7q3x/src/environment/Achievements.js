import { T } from './Texts.js';
// Los logros: cosas que se hacen por primera vez (soltar un símbolo, mover un personaje,
// dibujar, remixar...). Se recuerdan en el navegador; al desbloquear uno se avisa a quien escuche.
// Nombre y pista salen de Texts ('badge.<id>' = «nombre|pista»), en el idioma actual.
class Achievement {
  constructor(id, emoji) { this.id = id; this.emoji = emoji; }
  get name() { return T('badge.' + this.id).split('|')[0]; }
  get hint() { return T('badge.' + this.id).split('|')[1] || ''; }
}

export const ACHIEVEMENTS = [
  new Achievement('first-drop', '🧩'),
  new Achievement('rule', '✨'),
  new Achievement('first-move', '🕹️'),
  new Achievement('artist', '🎨'),
  new Achievement('detective', '🔍'),
  new Achievement('explorer', '🧭'),
  new Achievement('remix', '🔁'),
  new Achievement('saver', '💾'),
  new Achievement('world', '🌍'),
  new Achievement('ladder', '👑'),
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
