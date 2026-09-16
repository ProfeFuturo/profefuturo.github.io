// Manda al servidor, de a tandas, los eventos de uso que todavía no se mandaron. Si la app
// está servida sin servidor (GitHub Pages, un archivo), la primera respuesta lo dice y no se
// insiste. Nunca bloquea nada: si falla, se reintenta en la próxima tanda.
const FLUSH_EVERY_MS = 30000;
const FLUSH_AFTER_EVENTS = 20;

export class UsageSync {
  constructor(log, { endpoint = 'api/usage', fetchImpl = (typeof fetch === 'function' ? fetch.bind(globalThis) : null), baseUrl = null } = {}) {
    this.log = log;
    this.fetchImpl = fetchImpl;
    this.endpoint = baseUrl === null ? endpoint : new URL(endpoint, baseUrl).href;
    this.available = fetchImpl !== null;       // hasta que el servidor diga que no
    this.sending = false;
    this.sentBatches = 0;
  }

  start() {
    if (typeof window === 'undefined') return this;
    this.timer = setInterval(() => this.flush(), FLUSH_EVERY_MS);
    document.addEventListener('visibilitychange', () => { if (document.hidden) this.flush(); });
    return this;
  }

  stop() { clearInterval(this.timer); }

  // Se llama después de cada evento registrado: manda cuando se juntan varios.
  eventRecorded() {
    if (this.log.unsent().length >= FLUSH_AFTER_EVENTS) this.flush();
  }

  async flush() {
    if (!this.available || this.sending) return false;
    const events = this.log.unsent();
    if (events.length === 0) return false;
    this.sending = true;
    try {
      const response = await this.fetchImpl(this.endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ events: events.map(({ sent, ...event }) => event) }), keepalive: true });
      if (response.status === 404) { this.available = false; return false; }      // no hay servidor acá
      if (!response.ok) return false;
      this.log.markSent(events);
      this.sentBatches++;
      return true;
    } catch (error) {
      return false;                                                             // sin red: la próxima
    } finally {
      this.sending = false;
    }
  }
}
