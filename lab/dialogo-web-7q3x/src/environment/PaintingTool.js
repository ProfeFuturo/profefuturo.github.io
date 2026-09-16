import { Drawing } from '../metamodel/Drawing.js';
import { VisualSymbol } from '../metamodel/VisualSymbol.js';
import { dictionaryAt } from '../io/LanguageProvider.js';

const CANVAS_SIDE = 425;
const COLORS = ['#000000', '#7f7f7f', '#ffffff', '#c0392b', '#e74c3c', '#e67e22', '#f1c40f', '#f9e79f', '#2ecc71', '#1e8449',
  '#3498db', '#1a5276', '#9b59b6', '#f5b7b1', '#a0522d', '#00bcd4'];
const BRUSH_SIZES = [4, 10, 22, 44];
const MAX_UNDO = 30;

// La herramienta de dibujo: un canvas cuadrado con pincel redondo, paleta de colores,
// tamaños, goma, balde (relleno) y deshacer. Al terminar entrega un VisualSymbol nuevo.
export class PaintingTool {
  static open({ template = null, onFinish }) {
    return new PaintingTool(template, onFinish);
  }

  constructor(template, onFinish) {
    this.onFinish = onFinish;
    this.color = COLORS[0];
    this.brushSize = BRUSH_SIZES[1];
    this.mode = 'brush';                // 'brush' | 'eraser' | 'bucket'
    this.undoHistory = [];
    this.drawing = false;
    this.somethingDrawn = false;
    this.build();
    if (template !== null && template.image !== null) {
      this.context.drawImage(template.image, 0, 0, CANVAS_SIDE, CANVAS_SIDE);
      this.somethingDrawn = true;
    }
  }

  build() {
    this.overlay = document.createElement('div');
    this.overlay.className = 'painting-tool';
    const toolbar = document.createElement('div');
    toolbar.className = 'painting-toolbar';
    this.overlay.appendChild(toolbar);

    this.colorButtons = COLORS.map(color => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color';
      button.style.background = color;
      button.title = color;
      button.addEventListener('click', () => { this.color = color; this.mode = this.mode === 'bucket' ? 'bucket' : 'brush'; this.updateToolbar(); });
      toolbar.appendChild(button);
      return button;
    });
    this.sizeButtons = BRUSH_SIZES.map(size => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'size';
      const dot = document.createElement('span');
      dot.style.width = dot.style.height = Math.max(6, size / 2) + 'px';
      button.appendChild(dot);
      button.addEventListener('click', () => { this.brushSize = size; this.updateToolbar(); });
      toolbar.appendChild(button);
      return button;
    });
    this.eraserButton = this.toolButton(toolbar, '◻', 'Goma', () => { this.mode = this.mode === 'eraser' ? 'brush' : 'eraser'; this.updateToolbar(); });
    this.bucketButton = this.toolButton(toolbar, '🪣', 'Balde', () => { this.mode = this.mode === 'bucket' ? 'brush' : 'bucket'; this.updateToolbar(); });
    this.toolButton(toolbar, '↶ ' + dictionaryAt('Undo'), dictionaryAt('Undo'), () => this.undo());
    this.toolButton(toolbar, '✕ ' + dictionaryAt('Close'), dictionaryAt('Close'), () => this.cancel(), 'cancel');
    this.toolButton(toolbar, '✓ ' + dictionaryAt('Yes'), 'Terminar', () => this.finish(), 'finish');

    const frame = document.createElement('div');
    frame.className = 'painting-frame';
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_SIDE;
    this.canvas.height = CANVAS_SIDE;
    this.canvas.className = 'painting-canvas';
    frame.appendChild(this.canvas);
    this.overlay.appendChild(frame);
    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    this.bindPointerEvents();
    document.body.appendChild(this.overlay);
    this.updateToolbar();
  }

  toolButton(toolbar, label, title, action, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = ('tool ' + className).trim();
    button.textContent = label;
    button.title = title;
    button.addEventListener('click', action);
    toolbar.appendChild(button);
    return button;
  }

  updateToolbar() {
    this.colorButtons.forEach((button, index) => button.classList.toggle('selected', COLORS[index] === this.color && this.mode !== 'eraser'));
    this.sizeButtons.forEach((button, index) => button.classList.toggle('selected', BRUSH_SIZES[index] === this.brushSize));
    this.eraserButton.classList.toggle('selected', this.mode === 'eraser');
    this.bucketButton.classList.toggle('selected', this.mode === 'bucket');
    this.canvas.style.cursor = this.mode === 'bucket' ? 'cell' : 'crosshair';
  }

  // --- pintar ---

  canvasPoint(event) {
    const rect = this.canvas.getBoundingClientRect();
    return { x: (event.clientX - rect.left) * CANVAS_SIDE / rect.width, y: (event.clientY - rect.top) * CANVAS_SIDE / rect.height };
  }

  bindPointerEvents() {
    this.canvas.addEventListener('pointerdown', event => {
      event.preventDefault();
      this.canvas.setPointerCapture(event.pointerId);
      this.recordState();
      const point = this.canvasPoint(event);
      if (this.mode === 'bucket') { this.bucketFillAt(point); return; }
      this.drawing = true;
      this.lastPoint = point;
      this.strokeTo(point);
    });
    this.canvas.addEventListener('pointermove', event => {
      if (!this.drawing) return;
      event.preventDefault();
      const events = typeof event.getCoalescedEvents === 'function' ? event.getCoalescedEvents() : [event];
      for (const each of events) this.strokeTo(this.canvasPoint(each));
    });
    const stop = () => { this.drawing = false; };
    this.canvas.addEventListener('pointerup', stop);
    this.canvas.addEventListener('pointercancel', stop);
  }

  strokeTo(point) {
    const context = this.context;
    context.save();
    context.globalCompositeOperation = this.mode === 'eraser' ? 'destination-out' : 'source-over';
    context.strokeStyle = this.color;
    context.fillStyle = this.color;
    context.lineWidth = this.brushSize;
    context.lineCap = 'round';
    context.lineJoin = 'round';
    context.beginPath();
    context.moveTo(this.lastPoint.x, this.lastPoint.y);
    context.lineTo(point.x, point.y);
    context.stroke();
    context.restore();
    this.lastPoint = point;
    this.somethingDrawn = true;
  }

  // Relleno por líneas (scanline) del área contigua del mismo color.
  bucketFillAt(point) {
    const width = CANVAS_SIDE;
    const height = CANVAS_SIDE;
    const imageData = this.context.getImageData(0, 0, width, height);
    const data = imageData.data;
    const startX = Math.floor(point.x);
    const startY = Math.floor(point.y);
    if (startX < 0 || startY < 0 || startX >= width || startY >= height) return;
    const index = (x, y) => (y * width + x) * 4;
    const start = index(startX, startY);
    const target = [data[start], data[start + 1], data[start + 2], data[start + 3]];
    const fill = PaintingTool.rgba(this.color);
    if (target.every((value, i) => value === fill[i])) return;
    const matches = i => data[i] === target[0] && data[i + 1] === target[1] && data[i + 2] === target[2] && data[i + 3] === target[3];
    const paint = i => { data[i] = fill[0]; data[i + 1] = fill[1]; data[i + 2] = fill[2]; data[i + 3] = fill[3]; };
    const stack = [[startX, startY]];
    while (stack.length > 0) {
      const [x, y] = stack.pop();
      let left = x;
      while (left >= 0 && matches(index(left, y))) left--;
      left++;
      let right = x;
      while (right < width && matches(index(right, y))) right++;
      right--;
      for (let column = left; column <= right; column++) {
        paint(index(column, y));
        if (y > 0 && matches(index(column, y - 1))) stack.push([column, y - 1]);
        if (y < height - 1 && matches(index(column, y + 1))) stack.push([column, y + 1]);
      }
    }
    this.context.putImageData(imageData, 0, 0);
    this.somethingDrawn = true;
  }

  static rgba(color) {
    const value = parseInt(color.slice(1), 16);
    return [(value >> 16) & 255, (value >> 8) & 255, value & 255, 255];
  }

  // --- deshacer ---

  recordState() {
    this.undoHistory.push(this.context.getImageData(0, 0, CANVAS_SIDE, CANVAS_SIDE));
    if (this.undoHistory.length > MAX_UNDO) this.undoHistory.shift();
  }

  undo() {
    const previous = this.undoHistory.pop();
    if (previous !== undefined) this.context.putImageData(previous, 0, 0);
  }

  // --- terminar ---

  close() { this.overlay.remove(); }

  cancel() { this.close(); }

  finish() {
    this.close();
    if (!this.somethingDrawn) return;
    const drawing = Drawing.fromCanvas(this.canvas);
    this.onFinish(VisualSymbol.fromDrawing(drawing));
  }
}
