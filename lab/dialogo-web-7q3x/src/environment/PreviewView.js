import { NullBoardView } from '../board/NullBoardView.js';
import { Point } from '../board/Point.js';
import { SymbolPainter } from './SymbolPainter.js';

// Una vista del tablero en un canvas cualquiera (el feed, la miniatura de un proyecto):
// encuadra el juego (los elementos) y, si queda muy chico, se acerca a su centro.
// El modelo puede seguir dando pasos (step) y esta vista lo redibuja.
export class PreviewView extends NullBoardView {
  constructor(project, canvas, { maxCellFactor = 1, minCell = 0 } = {}) {
    super();
    this.project = project;
    this.canvas = canvas;
    this.context = canvas.getContext('2d');
    this.maxCellFactor = maxCellFactor;
    this.minCell = minCell;
    this.needsRedraw = true;
  }

  changed() { this.needsRedraw = true; }
  refreshItems() { this.needsRedraw = true; }
  gridSizeChanged() { this.needsRedraw = true; }
  boardRecorded() {}

  // El encuadre: los elementos si hay, si no todo lo que hay en el tablero.
  framing() {
    const board = this.project.boardModel;
    const elements = [...board.itemPositions.keys()].filter(item => item.consideredElement() && item.isVisible());
    const framed = elements.length > 0 ? elements : [...board.itemPositions.keys()];
    if (framed.length === 0) return null;
    let min = null, max = null, sumX = 0, sumY = 0;
    for (const item of framed) {
      const position = board.itemPositions.get(item);
      const factor = item.gridResizeFactor();
      min = min === null ? position : min.min(position);
      const corner = position.plus(Point.at(factor, factor));
      max = max === null ? corner : max.max(corner);
      sumX += position.x + factor / 2;
      sumY += position.y + factor / 2;
    }
    return { min, max, centroid: { x: sumX / framed.length, y: sumY / framed.length } };
  }

  draw() {
    const board = this.project.boardModel;
    const context = this.context;
    const { width, height } = this.canvas;
    context.fillStyle = 'white';
    context.fillRect(0, 0, width, height);
    this.needsRedraw = false;
    const framing = this.framing();
    if (framing === null) return;
    const { min, max, centroid } = framing;
    const columns = max.x - min.x, rows = max.y - min.y;
    let cell = Math.min(width / (columns + 1), height / (rows + 1), board.gridSize * this.maxCellFactor);
    let centerX = (min.x + max.x) / 2, centerY = (min.y + max.y) / 2;
    if (cell < this.minCell) {
      cell = Math.min(this.minCell, board.gridSize * this.maxCellFactor);
      centerX = centroid.x;
      centerY = centroid.y;
    }
    const originX = width / 2 - centerX * cell, originY = height / 2 - centerY * cell;
    this.cell = cell; this.originX = originX; this.originY = originY;
    for (const item of board.itemsFrontFirst().reverse()) {
      const position = board.positionOfIfAbsent(item, () => null);
      if (position === null) continue;
      const x = originX + position.x * cell, y = originY + position.y * cell;
      const size = cell * item.gridResizeFactor();
      if (x > width || y > height || x + size < 0 || y + size < 0) continue;
      SymbolPainter.paintItem(context, item, x, y, cell);
    }
  }

  // Un canvas chico con la imagen del proyecto (para guardar como vista previa).
  static thumbnail(project, width = 602, height = 458) {
    const canvas = document.createElement('canvas');
    canvas.width = width;
    canvas.height = height;
    new PreviewView(project, canvas).draw();
    return canvas;
  }
}
