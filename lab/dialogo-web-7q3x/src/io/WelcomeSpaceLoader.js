// Guarda y recupera los proyectos del usuario en el navegador (IndexedDB), como
// archivos .dialog.ar completos más una imagen de vista previa. No hay servidor:
// los datos viven en este navegador.
const DATABASE_NAME = 'representar';
const STORE_NAME = 'projects';
const VERSION = 2;

export class WelcomeSpaceLoader {
  static open() {
    return new Promise((resolve, reject) => {
      if (typeof indexedDB === 'undefined') return resolve(new WelcomeSpaceLoader(null));
      const request = indexedDB.open(DATABASE_NAME, VERSION);
      request.onupgradeneeded = () => {
        const database = request.result;
        if (database.objectStoreNames.contains(STORE_NAME)) database.deleteObjectStore(STORE_NAME);
        database.createObjectStore(STORE_NAME, { keyPath: 'id' });
      };
      request.onsuccess = () => resolve(new WelcomeSpaceLoader(request.result));
      request.onerror = () => reject(request.error);
    });
  }

  constructor(database) {
    this.database = database;
    this.memory = new Map();          // reemplazo en memoria cuando no hay IndexedDB (tests)
  }

  isAvailable() { return this.database !== null; }

  transaction(mode, action) {
    return new Promise((resolve, reject) => {
      const transaction = this.database.transaction(STORE_NAME, mode);
      const request = action(transaction.objectStore(STORE_NAME));
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => reject(request.error);
    });
  }

  newId() { return Date.now().toString(36) + '-' + Math.floor(Math.random() * 1e6).toString(36); }

  // record: { id, name, bytes, preview (bytes PNG o null) }
  async saveProject(record) {
    const stored = { ...record, savedAt: Date.now() };
    if (this.database === null) { this.memory.set(stored.id, stored); return stored; }
    await this.transaction('readwrite', store => store.put(stored));
    return stored;
  }

  async allProjects() {
    const all = this.database === null ? [...this.memory.values()] : (await this.transaction('readonly', store => store.getAll())) || [];
    return all.sort((a, b) => b.savedAt - a.savedAt);
  }

  async loadProject(id) {
    const record = this.database === null ? this.memory.get(id) : await this.transaction('readonly', store => store.get(id));
    return record === undefined ? null : record;
  }

  async removeProject(id) {
    if (this.database === null) { this.memory.delete(id); return; }
    await this.transaction('readwrite', store => store.delete(id));
  }
}
