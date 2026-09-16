// El registro de uso, anónimo: qué se hizo y cuándo (desafío empezado, completado, pista,
// símbolo soltado, deshacer...). Nunca guarda nombres, dibujos, textos ni identificadores de
// la persona. Vive en el dispositivo; a futuro se manda agregado a un servidor.
const LIMIT = 2000;
const KEY = 'representar.usage';

export class UsageLog {
  constructor({ storage = null, clock = () => Date.now() } = {}) {
    this.storage = storage;
    this.clock = clock;
    this.events = [];
    try {
      const saved = storage === null ? null : storage.getItem(KEY);
      if (saved) this.events = JSON.parse(saved);
    } catch (error) { /* sin storage */ }
    this.sessionStart = this.clock();
    this.record('session.start');
  }

  record(name, data = {}) {
    const event = { name, at: this.clock(), ...UsageLog.safe(data) };
    this.events.push(event);
    if (this.events.length > LIMIT) this.events.splice(0, this.events.length - LIMIT);
    this.save();
    return event;
  }

  // Sólo números, booleanos y cadenas cortas de un vocabulario (ids, selectores); nada libre.
  static safe(data) {
    const safe = {};
    for (const [key, value] of Object.entries(data)) {
      if (typeof value === 'number' || typeof value === 'boolean') safe[key] = value;
      else if (typeof value === 'string' && value.length <= 40 && /^[\w:.-]*$/.test(value)) safe[key] = value;
    }
    return safe;
  }

  save() {
    try { if (this.storage !== null) this.storage.setItem(KEY, JSON.stringify(this.events)); } catch (error) { /* sin storage */ }
  }

  all() { return this.events.slice(); }
  named(name) { return this.events.filter(event => event.name === name); }

  // El embudo del primer minuto por desafío: empezados, completados, tiempo mediano, pistas.
  funnel() {
    const byChallenge = new Map();
    const started = new Map();
    for (const event of this.events) {
      if (!event.challenge) continue;
      if (!byChallenge.has(event.challenge)) byChallenge.set(event.challenge, { started: 0, completed: 0, hints: 0, abandoned: 0, times: [] });
      const row = byChallenge.get(event.challenge);
      if (event.name === 'challenge.start') { row.started++; started.set(event.challenge, event.at); }
      if (event.name === 'challenge.hint') row.hints++;
      if (event.name === 'challenge.abandon') row.abandoned++;
      if (event.name === 'challenge.complete') {
        row.completed++;
        if (started.has(event.challenge)) row.times.push(event.at - started.get(event.challenge));
      }
    }
    const result = {};
    for (const [challenge, row] of byChallenge) {
      const sorted = row.times.slice().sort((a, b) => a - b);
      result[challenge] = { started: row.started, completed: row.completed, hints: row.hints, abandoned: row.abandoned, medianMs: sorted.length === 0 ? null : sorted[Math.floor(sorted.length / 2)] };
    }
    return result;
  }

  clear() { this.events = []; this.save(); }
}
