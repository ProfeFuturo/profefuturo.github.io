import { Drawing } from '../metamodel/Drawing.js';
import { VisualSymbol } from '../metamodel/VisualSymbol.js';
import { Icons } from './Icons.js';

const CANVAS_SIDE = 425;
// Pocos colores, vivos, con nombre (para el título del botón): lo que un chico busca primero.
const COLORS = [['#101318', 'Negro'], ['#FFFFFF', 'Blanco'], ['#E53935', 'Rojo'], ['#FB8C00', 'Naranja'], ['#FDD835', 'Amarillo'], ['#43A047', 'Verde'],
  ['#1E88E5', 'Azul'], ['#8E24AA', 'Violeta'], ['#F48FB1', 'Rosa'], ['#8D6E63', 'Marrón'], ['#00ACC1', 'Celeste'], ['#9E9E9E', 'Gris']];
const BRUSH_SIZES = [6, 14, 30];
const MAX_UNDO = 30;

// La herramienta de dibujo, pensada para el dedo: el lienzo ocupa la pantalla, una fila de
// colores grandes, tres grosores, goma, balde, deshacer, y un botón "Listo" que no se pierde.
// Al terminar entrega un VisualSymbol nuevo.
export class PaintingTool {
  static open({ template = null, onFinish }) {
    return new PaintingTool(template, onFinish);
  }

  constructor(template, onFinish) {
    this.onFinish = onFinish;
    this.color = COLORS[0][0];
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
    this.overlay.setAttribute('role', 'dialog');
    this.overlay.setAttribute('aria-label', 'Dibujar');

    const top = document.createElement('div');
    top.className = 'painting-top';
    this.overlay.appendChild(top);
    this.iconButton(top, 'x', 'Cerrar sin guardar', () => this.cancel(), 'cancel');
    const tools = document.createElement('div');
    tools.className = 'painting-tools';
    top.appendChild(tools);
    this.brushButton = this.iconButton(tools, 'brush', 'Pincel', () => { this.mode = 'brush'; this.updateToolbar(); }, 'tool brush');
    this.eraserButton = this.iconButton(tools, 'eraser', 'Goma', () => { this.mode = 'eraser'; this.updateToolbar(); }, 'tool eraser');
    this.bucketButton = this.iconButton(tools, 'bucket', 'Balde', () => { this.mode = 'bucket'; this.updateToolbar(); }, 'tool bucket');
    this.iconButton(tools, 'undo', 'Deshacer', () => this.undo(), 'tool undo');
    const finish = document.createElement('button');
    finish.type = 'button';
    finish.className = 'painting-finish finish';
    finish.innerHTML = Icons.svg('check') + '<span>Listo</span>';
    finish.addEventListener('click', () => this.finish());
    top.appendChild(finish);

    const frame = document.createElement('div');
    frame.className = 'painting-frame';
    this.canvas = document.createElement('canvas');
    this.canvas.width = CANVAS_SIDE;
    this.canvas.height = CANVAS_SIDE;
    this.canvas.className = 'painting-canvas';
    this.canvas.setAttribute('aria-label', 'Lienzo');
    frame.appendChild(this.canvas);
    this.overlay.appendChild(frame);

    const bottom = document.createElement('div');
    bottom.className = 'painting-bottom';
    this.overlay.appendChild(bottom);
    const sizes = document.createElement('div');
    sizes.className = 'painting-sizes';
    bottom.appendChild(sizes);
    this.sizeButtons = BRUSH_SIZES.map(size => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'size';
      button.title = 'Grosor ' + size;
      button.setAttribute('aria-label', button.title);
      const dot = document.createElement('span');
      dot.style.width = dot.style.height = Math.max(8, size * 0.8) + 'px';
      button.appendChild(dot);
      button.addEventListener('click', () => { this.brushSize = size; this.updateToolbar(); });
      sizes.appendChild(button);
      return button;
    });
    const colors = document.createElement('div');
    colors.className = 'painting-colors';
    bottom.appendChild(colors);
    this.colorButtons = COLORS.map(([color, name]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'color';
      button.style.background = color;
      button.title = name;
      button.setAttribute('aria-label', name);
      button.addEventListener('click', () => { this.color = color; if (this.mode === 'eraser') this.mode = 'brush'; this.updateToolbar(); });
      colors.appendChild(button);
      return button;
    });

    this.context = this.canvas.getContext('2d', { willReadFrequently: true });
    this.bindPointerEvents();
    document.body.appendChild(this.overlay);
    this.updateToolbar();
  }

  iconButton(parent, iconName, title, action, className = '') {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'icon-button ' + className;
    button.title = title;
    button.setAttribute('aria-label', title);
    button.innerHTML = Icons.svg(iconName);
    button.addEventListener('click', action);
    parent.appendChild(button);
    return button;
  }

  updateToolbar() {
    this.colorButtons.forEach((button, index) => button.classList.toggle('selected', COLORS[index][0] === this.color && this.mode !== 'eraser'));
    this.sizeButtons.forEach((button, index) => button.classList.toggle('selected', BRUSH_SIZES[index] === this.brushSize));
    this.brushButton.classList.toggle('selected', this.mode === 'brush');
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
