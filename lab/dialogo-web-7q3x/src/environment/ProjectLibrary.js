import { T } from './Texts.js';
import { RepresentarVisualImporter } from '../io/RepresentarVisualImporter.js';
import { RepresentarVisualExporter } from '../io/RepresentarVisualExporter.js';
import { ZipArchive } from '../io/ZipArchive.js';
import { WelcomeSpaceLoader } from '../io/WelcomeSpaceLoader.js';
import { projectUrl } from '../io/Assets.js';
import { VisualProject } from './VisualProject.js';
import { PreviewView } from './PreviewView.js';

// Los proyectos que tiene el usuario a mano: los incluidos (didácticos y desafíos, que
// vienen con la app) y los propios (guardados en el navegador). Cada entrada sabe de dónde
// viene, tiene sus bytes (.dialog.ar) y su proyecto ya importado cuando se lo usó.
// Cuando haya servidor, de acá salen los proyectos publicados y para acá llegan los de otros.
export class ProjectLibrary {
  constructor({ loader = new WelcomeSpaceLoader(null), bundledProjects = [], random = Math.random } = {}) {
    this.loader = loader;
    this.bundledProjects = bundledProjects;
    this.random = random;
    this.entries = new Map();
    this.listeners = [];
  }

  onChange(listener) { this.listeners.push(listener); }
  changed() { for (const listener of this.listeners) listener(this); }

  all() { return [...this.entries.values()]; }
  mine() { return this.all().filter(entry => entry.source === 'stored'); }
  bundled(category = null) { return this.all().filter(entry => entry.source === 'bundled' && (category === null || entry.category === category)); }
  entryWithId(id) { return this.entries.get(id) || null; }
  entryNamed(name) { return this.all().find(entry => entry.name === name) || null; }

  // El orden del feed: lo mío primero, después los desafíos y los didácticos.
  feedEntries() { return [...this.mine(), ...this.bundled('games'), ...this.bundled('didactic')]; }

  async loadFromFiles() {
    for (const stored of await this.loader.allProjects()) {
      this.entries.set(stored.id, { id: stored.id, name: stored.name, source: 'stored', bytes: stored.bytes, previewUrl: ProjectLibrary.urlOf(stored.preview), category: 'mine', project: null });
    }
    for (const bundled of this.bundledProjects) {
      const id = 'bundled:' + bundled.file;
      this.entries.set(id, { id, name: bundled.name, source: 'bundled', file: bundled.file, bytes: null, previewUrl: null, category: bundled.category, title: bundled.title || null, goal: bundled.goal || null, project: null });
    }
    this.changed();
  }

  static urlOf(pngBytes) {
    if (!pngBytes) return null;
    return URL.createObjectURL(new Blob([pngBytes], { type: 'image/png' }));
  }

  async ensureBytesOf(entry) {
    if (entry.bytes === null && entry.source === 'bundled') {
      const response = await fetch(projectUrl(entry.file));
      entry.bytes = new Uint8Array(await response.arrayBuffer());
    }
    return entry.bytes;
  }

  async previewUrlOf(entry) {
    if (entry.previewUrl) return entry.previewUrl;
    await this.ensureBytesOf(entry);
    const archive = ZipArchive.fromBytes(entry.bytes);
    if (archive.has('preview.png')) entry.previewUrl = ProjectLibrary.urlOf(await archive.bytes('preview.png'));
    return entry.previewUrl;
  }

  // El proyecto importado de una entrada (una sola vez; el feed lo hace correr en vivo).
  async projectOf(entry) {
    if (entry.project !== null) return entry.project;
    await this.ensureBytesOf(entry);
    const project = await new RepresentarVisualImporter({ random: this.random }).importFromBytes(entry.bytes);
    project.entryId = entry.id;
    entry.project = project;
    await this.wakeUp(project);
    return project;
  }

  async projectFromBytes(bytes) {
    const project = await new RepresentarVisualImporter({ random: this.random }).importFromBytes(bytes);
    await this.wakeUp(project);
    return project;
  }

  // Un proyecto recién importado: conectado al intérprete, con sus reusos y sus reglas evaluadas.
  async wakeUp(project) {
    project.connect();
    await this.startReusingProjectsOf(project);
    try { project.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers(); } catch (error) { console.error(error); }
    return project;
  }

  newProject({ name, gridSize }) {
    const project = new VisualProject({ name, gridSize, random: this.random }).connect();
    return project;
  }

  // Una copia propia de un proyecto (como en Scratch): mismo contenido, nuevo dueño.
  async remix(entry) {
    await this.ensureBytesOf(entry);
    const project = await this.projectFromBytes(entry.bytes);
    project.setProjectName(T('myVersionOf') + this.titleOf(entry));
    return project;
  }

  titleOf(entry) { return entry.title || entry.name.replace(/\(.*\)/, '').trim(); }

  // --- guardar ---

  // Guarda un proyecto propio (o crea la entrada si venía de uno incluido o de un archivo).
  async save(project, { bytes, preview }) {
    let entry = project.entryId === undefined ? null : this.entryWithId(project.entryId);
    if (entry === null || entry.source !== 'stored') {
      entry = { id: this.loader.newId(), name: project.projectName, source: 'stored', bytes, previewUrl: null, category: 'mine', project };
      this.entries.set(entry.id, entry);
      project.entryId = entry.id;
    }
    entry.name = project.projectName;
    entry.bytes = bytes;
    entry.project = project;
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    entry.previewUrl = ProjectLibrary.urlOf(preview);
    await this.loader.saveProject({ id: entry.id, name: entry.name, bytes, preview });
    this.changed();
    return entry;
  }

  // Los bytes y la vista previa de un proyecto, listos para guardar o descargar.
  static async bytesOf(project, { fullBoardImage = null } = {}) {
    const preview = await ProjectLibrary.pngOf(PreviewView.thumbnail(project));
    const exporter = RepresentarVisualExporter.forProject(project, { previewImage: preview, fullBoardImage: fullBoardImage || preview });
    return { bytes: await exporter.bytes(), preview };
  }

  static async pngOf(canvas) {
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    return blob === null ? null : new Uint8Array(await blob.arrayBuffer());
  }

  async remove(entry) {
    if (entry.source !== 'stored') return;
    await this.loader.removeProject(entry.id);
    this.entries.delete(entry.id);
    if (entry.previewUrl) URL.revokeObjectURL(entry.previewUrl);
    this.changed();
  }

  // --- reuso entre proyectos ---

  async startReusingProjectsOf(project) {
    for (const name of project.namesOfProjectsToReuse) {
      const entry = this.entryNamed(name);
      if (entry === null || (project.entryId !== undefined && entry.id === project.entryId)) continue;
      try {
        const other = await this.projectOf(entry);
        if (other !== project) project.startReusingProject(other);
      } catch (error) {
        console.error(error);
      }
    }
    project.namesOfProjectsToReuse = [];
  }
}
