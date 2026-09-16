import { ZipArchive, encodeText } from './ZipArchive.js';
import { RepresentarIO, ordinalOf } from './RepresentarIO.js';

// Escribe un VisualProject como .dialog.ar (versión 8): data, N.png, preview.png,
// fullBoard.png y reusing. Las imágenes se piden a `imageEncoder` (canvas → PNG).
export class RepresentarVisualExporter {
  constructor(project, { previewImage = null, fullBoardImage = null } = {}) {
    this.environment = project;
    this.drawingsMadeByUser = project.drawingsMadeByUser();
    this.projectName = project.projectName;
    this.gridSize = project.boardModel.gridSize;
    this.previewImage = previewImage;
    this.fullBoardImage = fullBoardImage;
    this.replResultsRemoved = false;
  }

  static forProject(project, options) { return new RepresentarVisualExporter(project, options); }

  // --- data ---

  // Los resultados estampados por los REPL no se guardan (como en Cuis).
  withoutREPLResults(action) {
    if (this.replResultsRemoved) return action();
    const board = this.environment.boardModel;
    const replElements = board.replElements();
    for (const repl of replElements) repl.removePreviousResultsOnBoard(board);
    this.replResultsRemoved = true;
    try {
      return action();
    } finally {
      this.replResultsRemoved = false;
      for (const repl of replElements) repl.addPreviousResultsOnBoard(board);
    }
  }

  dataText() {
    return this.withoutREPLResults(() => this.dataTextWithCurrentItems());
  }

  dataTextWithCurrentItems() {
    const io = RepresentarIO;
    let text = io.currentVersion + io.lineSeparator;
    text += io.projectNameHeader + this.projectName + io.lineSeparator;
    text += io.gridSizeHeader + this.gridSizeText() + io.lineSeparator;
    text += io.drawingByUserHeader + this.drawingsMadeByUser.map((each, index) => ordinalOf(index + 1) + io.columnSeparator).join('') + io.lineSeparator;
    text += io.privateDrawingsHeader + this.privateVisualSymbolsIndexes().map(index => ordinalOf(index) + io.columnSeparator).join('') + io.lineSeparator;
    text += io.listOfItemsHeader + io.lineSeparator;
    for (const item of this.itemsFromBackToFront()) text += this.itemData(item);
    return text;
  }

  gridSizeText() {
    if (Number.isInteger(this.gridSize)) return String(this.gridSize);
    const fraction = RepresentarVisualExporter.asFraction(this.gridSize);
    return fraction === null ? String(this.gridSize) : '(' + fraction[0] + '/' + fraction[1] + ')';
  }

  static asFraction(value) {
    for (let denominator = 1; denominator <= 1000; denominator++) {
      const numerator = value * denominator;
      if (Math.abs(numerator - Math.round(numerator)) < 1e-9) return [Math.round(numerator), denominator];
    }
    return null;
  }

  privateVisualSymbolsIndexes() {
    return this.drawingsMadeByUser.map((symbol, index) => this.environment.isPrivate(symbol) ? index + 1 : 0).filter(index => index > 0);
  }

  itemsFromBackToFront() {
    return this.environment.boardModel.itemsFrontFirst().reverse();
  }

  ordinalOfSymbol(symbol) {
    return ordinalOf(this.drawingsMadeByUser.findIndex(each => each.equals(symbol)) + 1);
  }

  itemData(item) {
    const io = RepresentarIO;
    const position = this.environment.boardModel.positionOf(item);
    return io.bulletForList
      + this.textualIdentifier(item)
      + this.roleIfRelevant(item)
      + io.atSeparator + io.columnSeparator + position.x + '@' + position.y + io.columnSeparator
      + this.slowedDownByIfRelevant(item)
      + this.movingDirectionIfRelevant(item)
      + this.visibilityIfRelevant(item)
      + this.biggerSizeByIfRelevant(item)
      + this.pointingDirectionIfRelevant(item)
      + this.scopeIfRelevant(item)
      + io.lineSeparator;
  }

  textualIdentifier(item) {
    const io = RepresentarIO;
    if (item.isPredefined()) return item.visualSymbolAssociated.buildingSelector + io.columnSeparator;
    return this.ordinalOfSymbol(item.visualSymbolAssociated) + io.columnSeparator + io.drawingLabel + io.columnSeparator;
  }

  roleIfRelevant(item) {
    const io = RepresentarIO;
    if (!item.isREPL() && item.isPredefined()) return '';
    const role = item.consideredSymbol ? io.symbolLabel : (item.isButton() ? io.buttonLabel : io.elementLabel);
    return io.asSeparator + io.columnSeparator + role + io.columnSeparator;
  }

  slowedDownByIfRelevant(item) {
    return item.isRun() ? RepresentarIO.slowDownProperty + ' ' + item.slowDownFactor() + ' ' : '';
  }

  movingDirectionIfRelevant(item) {
    return item.direction.isZero() ? '' : RepresentarIO.movingDirectionProperty + ' ' + item.direction.x + '@' + item.direction.y + ' ';
  }

  visibilityIfRelevant(item) {
    return item.isVisible() ? '' : RepresentarIO.visibleProperty + ' ' + RepresentarIO.notValue + ' ';
  }

  biggerSizeByIfRelevant(item) {
    return item.gridResizeFactor() > 1 ? RepresentarIO.biggerSizeProperty + ' ' + item.gridResizeFactor() + ' ' : '';
  }

  pointingDirectionIfRelevant(item) {
    if (!item.isAdjacentCell()) return '';
    let value;
    if (item.isPointingAllDirections()) value = RepresentarIO.allAround;
    else if (item.isPointingNoDirection()) value = RepresentarIO.nowhere;
    else value = item.adjacentDirection().x + '@' + item.adjacentDirection().y;
    return RepresentarIO.pointingProperty + ' ' + value + ' ';
  }

  scopeIfRelevant(item) {
    return item.isTeleport() && item.hasGlobalScope() ? RepresentarIO.globalScopeProperty + ' ' : '';
  }

  // --- archivo completo ---

  async files() {
    const files = [];
    for (let index = 0; index < this.drawingsMadeByUser.length; index++) {
      const bytes = await this.drawingsMadeByUser[index].drawing.pngBytesFor(this.drawingsMadeByUser[index]);
      if (bytes !== null) files.push({ name: (index + 1) + '.png', bytes });
    }
    files.push({ name: RepresentarIO.dataFileName, bytes: encodeText(this.dataText()) });
    if (this.previewImage !== null) files.push({ name: RepresentarIO.previewImageFileName, bytes: this.previewImage });
    if (this.fullBoardImage !== null) files.push({ name: RepresentarIO.fullBoardImageFileName, bytes: this.fullBoardImage });
    const reusing = this.environment.namesOfProjectsReusing();
    if (reusing.length > 0) files.push({ name: RepresentarIO.reusingDataFileName, bytes: encodeText(reusing.join('\n') + '\n') });
    return files;
  }

  async bytes() {
    return ZipArchive.write(await this.files());
  }
}
