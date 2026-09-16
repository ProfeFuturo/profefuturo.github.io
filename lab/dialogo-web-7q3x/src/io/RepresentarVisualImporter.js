import { VisualSymbol } from '../metamodel/VisualSymbol.js';
import { Drawing } from '../metamodel/Drawing.js';
import { StateOfArtBuilderForVisualEnvironment } from '../metamodel/StateOfArtBuilderForVisualEnvironment.js';
import { Point } from '../board/Point.js';
import { VisualProject } from '../environment/VisualProject.js';
import { ZipArchive } from './ZipArchive.js';
import { RepresentarIO, numberFromSmalltalk } from './RepresentarIO.js';

// Lee un .dialog.ar (formato visual versión 8, también 7) y arma un VisualProject.
// La decodificación de las imágenes es inyectable (en Node no hay canvas).
export class RepresentarVisualImporter {
  constructor({ imageDecoder = RepresentarVisualImporter.defaultImageDecoder, random = Math.random } = {}) {
    this.imageDecoder = imageDecoder;
    this.random = random;
    this.symbolProvider = new StateOfArtBuilderForVisualEnvironment();
  }

  static async defaultImageDecoder(bytes) {
    if (typeof createImageBitmap !== 'function' || typeof document === 'undefined') return null;
    const bitmap = await createImageBitmap(new Blob([bytes], { type: 'image/png' }));
    return Drawing.canvasWithWhiteAsTransparent(bitmap);
  }

  static canImport(dataText) {
    const version = dataText.split(/\r?\n/)[0].trim();
    return version === RepresentarIO.currentVersion;
  }

  async importFromBytes(bytes, options) {
    return this.importFromArchive(ZipArchive.fromBytes(bytes), options);
  }

  async importFromArchive(archive, { name = 'Proyecto', random = this.random } = {}) {
    const dataText = await archive.text(RepresentarIO.dataFileName);
    if (!RepresentarVisualImporter.canImport(dataText)) throw new Error('Version not supported: ' + dataText.split('\n')[0]);
    const project = new VisualProject({ name, random });
    this.environment = project;
    await this.loadUserDrawingsFrom(archive);
    await this.loadScreenshotFrom(archive);
    this.loadDataFromText(dataText);
    await this.loadReusedProjectsFrom(archive);
    project.actionsAfterLoading();
    return project;
  }

  // --- dibujos: N.png, cargados de mayor a menor para que el 1 quede primero ---

  async loadUserDrawingsFrom(archive) {
    const drawingFiles = archive.names()
      .filter(name => /^\d+\.png$/.test(name))
      .map(name => ({ name, index: Number(name.split('.')[0]) }))
      .sort((a, b) => b.index - a.index);
    let lastIndex = 0;
    for (const file of drawingFiles) {
      if (lastIndex > 0 && file.index !== lastIndex - 1) {
        for (let missing = lastIndex - 1; missing > file.index; missing--) this.loadMissingDrawing();
      }
      await this.loadAUserDrawingFrom(archive, file.name);
      lastIndex = file.index;
    }
    if (lastIndex > 1) for (let missing = lastIndex - 1; missing >= 1; missing--) this.loadMissingDrawing();
  }

  async loadAUserDrawingFrom(archive, fileName) {
    const bytes = await archive.bytes(fileName);
    const image = await this.imageDecoder(bytes);
    const drawing = new Drawing({ hash: Drawing.hashOfBytes(bytes), image, pngBytes: bytes,
      width: image ? image.width : 0, height: image ? image.height : 0 });
    this.addDrawnSymbolToEnvironment(VisualSymbol.fromDrawing(drawing));
  }

  loadMissingDrawing() {
    const drawing = Drawing.missing(this.random);
    this.addDrawnSymbolToEnvironment(VisualSymbol.fromDrawing(drawing));
  }

  addDrawnSymbolToEnvironment(symbol) {
    this.environment.receiveDrawnSymbol(symbol);
  }

  drawnSymbolAtIndex(index) {
    const drawings = this.environment.drawingsMadeByUser();
    while (index > this.environment.drawingsMadeByUser().length) this.loadMissingDrawing();
    const all = this.environment.drawingsMadeByUser();
    return (all[index - 1] || all[all.length - 1]).copy();
  }

  async loadScreenshotFrom(archive) {
    const fileName = archive.has(RepresentarIO.previewImageFileName) ? RepresentarIO.previewImageFileName
      : (archive.has('screenshot') ? 'screenshot' : null);
    if (fileName === null) return;
    const bytes = await archive.bytes(fileName);
    this.environment.screenshot = { pngBytes: bytes, image: await this.imageDecoder(bytes) };
  }

  async loadReusedProjectsFrom(archive) {
    if (!archive.has(RepresentarIO.reusingDataFileName)) return;
    const text = await archive.text(RepresentarIO.reusingDataFileName);
    this.environment.namesOfProjectsToReuse = text.split(/\r?\n/).map(line => line.trim()).filter(line => line.length > 0);
  }

  // --- data ---

  loadDataFromText(text) {
    const lines = text.split(/\r?\n/);
    lines.shift();                                            // versión, ya verificada
    this.loadProjectName(lines.shift());
    this.loadGridSize(lines.shift());
    this.ignoreTotalDrawingsByRedundance(lines.shift());
    this.loadPrivateSymbols(lines.shift());
    lines.shift();                                            // encabezado de la lista
    for (const line of lines) if (line.trim().length > 0) this.loadItemFromString(line);
  }

  loadProjectName(line) {
    const name = line.startsWith(RepresentarIO.projectNameHeader) ? line.slice(RepresentarIO.projectNameHeader.length) : line;
    this.environment.setProjectName(name.replace(/\s+$/, ''));
  }

  loadGridSize(line) {
    const value = line.startsWith(RepresentarIO.gridSizeHeader) ? line.slice(RepresentarIO.gridSizeHeader.length) : line;
    this.gridSize = numberFromSmalltalk(value.trim());
    this.environment.boardModel.gridSize = this.gridSize;
  }

  ignoreTotalDrawingsByRedundance(line) {
    const ordinals = line.slice(RepresentarIO.drawingByUserHeader.length).trim().split(/\s+/).filter(each => each.length > 0);
    if (ordinals.length === 0) return;
    const total = parseInt(ordinals[ordinals.length - 1], 10);
    while (!Number.isNaN(total) && this.environment.drawingsMadeByUser().length < total) this.loadMissingDrawing();
  }

  loadPrivateSymbols(line) {
    const ordinals = line.slice(RepresentarIO.privateDrawingsHeader.length).trim().split(/\s+/).filter(each => each.length > 0);
    for (const ordinal of ordinals) this.environment.makePrivate(this.drawnSymbolAtIndex(parseInt(ordinal, 10)));
  }

  loadItemFromString(line) {
    const tokens = line.trim().split(/\s+/);
    tokens.shift();                                           // viñeta
    const itemId = tokens.shift();
    if (/^\d/.test(itemId)) return this.loadDrawingByIndex(parseInt(itemId, 10), tokens);
    return this.loadPredefinedBySymbol(itemId, tokens);
  }

  loadDrawingByIndex(index, tokens) {
    const symbol = this.drawnSymbolAtIndex(index);
    tokens.shift();                                           // 'drawing'
    tokens.shift();                                           // 'as'
    const status = tokens.shift();
    tokens.shift();                                           // 'at'
    const item = this.itemOnBoardSymbolized(symbol, tokens.shift());
    this.setStatusOn(status, item);
    this.addOptionalProperties(tokens, item);
    return item;
  }

  loadPredefinedBySymbol(selector, tokens) {
    const symbol = this.symbolProvider.symbolBySelector(selector);
    let status = RepresentarIO.symbolLabel;
    if (symbol.isREPL()) { tokens.shift(); status = tokens.shift(); }
    tokens.shift();                                           // 'at'
    const item = this.itemOnBoardSymbolized(symbol, tokens.shift());
    this.setStatusOn(status, item);
    this.addOptionalProperties(tokens, item);
    return item;
  }

  itemOnBoardSymbolized(symbol, positionString) {
    return this.environment.boardModel.addItemFromSymbol(symbol, Point.fromString(positionString));
  }

  setStatusOn(status, item) {
    if (status === RepresentarIO.buttonLabel) item.invertBecameButtonWithoutEvaluating();
    if (status === RepresentarIO.symbolLabel) item.consideredSymbol = true;
    if (status === RepresentarIO.elementLabel) item.consideredSymbol = false;
  }

  addOptionalProperties(tokens, item) {
    while (tokens.length > 0) {
      const property = tokens.shift();
      const handler = this.optionalProperties[property];
      if (handler === undefined) throw new Error('Unknown item property: ' + property);
      if (handler.length > 1) handler.call(this, tokens.shift(), item);
      else handler.call(this, item);
    }
  }

  // Cuis guardaba direcciones fraccionarias (píxeles / grilla) tras hacer zoom; acá son celdas: -1, 0 o 1.
  static directionFromString(value) {
    const [x, y] = value.split('@').map(part => Math.max(-1, Math.min(1, Math.round(numberFromSmalltalk(part)))));
    return Point.at(x, y);
  }

  get optionalProperties() {
    return {
      [RepresentarIO.slowDownProperty]: (value, item) => item.setSlowDownFactor(Number(value)),
      [RepresentarIO.globalScopeProperty]: item => item.changeScope(),
      [RepresentarIO.movingDirectionProperty]: (value, item) => { item.direction = RepresentarVisualImporter.directionFromString(value); },
      [RepresentarIO.biggerSizeProperty]: (value, item) => {
        item.setGridResizeFactor(Number(value));
        this.environment.boardModel.currentResizeFactors.set(item, item.gridResizeFactor());
      },
      [RepresentarIO.visibleProperty]: (value, item) => { if (value === RepresentarIO.notValue) item.makeInvisible(); },
      [RepresentarIO.pointingProperty]: (value, item) => {
        if (value === RepresentarIO.nowhere) return;
        item.invertIfReferencingNoDirection();
        if (value === RepresentarIO.allAround) return item.invertIfReferencingAllDirections();
        item.setReferencingVector(Point.fromString(value));
        item.updateVisualSymbol();
      },
    };
  }
}
