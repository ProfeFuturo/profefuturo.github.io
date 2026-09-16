import { Drawing } from '../metamodel/Drawing.js';
import { VisualSymbol } from '../metamodel/VisualSymbol.js';

const SIDE = 96;

// Los dibujos de los desafíos (personaje, estrella, monstruo, caja, pared, campana, corazón),
// dibujados con código para no depender de archivos. En Node (tests del modelo) no hay canvas
// y el dibujo queda sin imagen, sólo con su hash.
const PAINTERS = {
  kid(context) {
    context.fillStyle = '#FFB74D'; circle(context, 48, 34, 20);
    context.fillStyle = '#3F51B5'; roundRect(context, 30, 54, 36, 34, 10);
    context.fillStyle = '#212121'; circle(context, 41, 31, 3); circle(context, 55, 31, 3);
    context.strokeStyle = '#212121'; context.lineWidth = 3; context.beginPath(); context.arc(48, 36, 9, 0.2 * Math.PI, 0.8 * Math.PI); context.stroke();
  },
  star(context) {
    context.fillStyle = '#FFC107'; context.strokeStyle = '#F57F17'; context.lineWidth = 4;
    context.beginPath();
    for (let i = 0; i < 10; i++) { const r = i % 2 ? 18 : 40; const a = i * Math.PI / 5 - Math.PI / 2; context.lineTo(48 + r * Math.cos(a), 50 + r * Math.sin(a)); }
    context.closePath(); context.fill(); context.stroke();
  },
  monster(context) {
    context.fillStyle = '#8E44AD'; roundRect(context, 18, 22, 60, 60, 24);
    context.fillStyle = 'white'; circle(context, 38, 46, 9); circle(context, 60, 46, 9);
    context.fillStyle = '#212121'; circle(context, 40, 47, 4); circle(context, 62, 47, 4);
    context.fillStyle = 'white'; context.beginPath(); context.moveTo(34, 66); context.lineTo(40, 76); context.lineTo(46, 66); context.lineTo(52, 76); context.lineTo(58, 66); context.closePath(); context.fill();
  },
  box(context) {
    context.fillStyle = '#A1887F'; roundRect(context, 16, 24, 64, 56, 6);
    context.strokeStyle = '#5D4037'; context.lineWidth = 4; context.strokeRect(18, 26, 60, 52); context.beginPath(); context.moveTo(48, 26); context.lineTo(48, 78); context.stroke();
  },
  wall(context) {
    context.fillStyle = '#B0BEC5'; context.fillRect(4, 4, 88, 88);
    context.strokeStyle = '#78909C'; context.lineWidth = 4;
    for (let y = 4; y < 96; y += 22) { context.beginPath(); context.moveTo(4, y); context.lineTo(92, y); context.stroke(); }
    for (let y = 4, offset = 0; y < 96; y += 22, offset = 22 - offset) for (let x = 4 + offset; x < 96; x += 44) { context.beginPath(); context.moveTo(x, y); context.lineTo(x, y + 22); context.stroke(); }
  },
  bell(context) {
    context.fillStyle = '#FFD54F'; context.beginPath(); context.moveTo(48, 16); context.bezierCurveTo(70, 16, 74, 40, 74, 62); context.lineTo(22, 62); context.bezierCurveTo(22, 40, 26, 16, 48, 16); context.closePath(); context.fill();
    context.fillStyle = '#F9A825'; context.fillRect(16, 62, 64, 8); circle(context, 48, 78, 7);
  },
  heart(context) {
    context.fillStyle = '#E53935'; context.beginPath(); context.moveTo(48, 84);
    context.bezierCurveTo(10, 56, 14, 22, 36, 24); context.bezierCurveTo(44, 24, 48, 32, 48, 34);
    context.bezierCurveTo(48, 32, 52, 24, 60, 24); context.bezierCurveTo(82, 22, 86, 56, 48, 84); context.fill();
  },
};

function circle(context, x, y, radius) { context.beginPath(); context.arc(x, y, radius, 0, Math.PI * 2); context.fill(); }
function roundRect(context, x, y, width, height, radius) {
  context.beginPath(); context.moveTo(x + radius, y); context.arcTo(x + width, y, x + width, y + height, radius); context.arcTo(x + width, y + height, x, y + height, radius);
  context.arcTo(x, y + height, x, y, radius); context.arcTo(x, y, x + width, y, radius); context.closePath(); context.fill();
}

export class ChallengeDrawings {
  static names() { return Object.keys(PAINTERS); }

  // Un símbolo de dibujo con hash fijo ('challenge:kid'), con imagen si hay canvas.
  static symbol(name) {
    const hash = 'challenge:' + name;
    if (typeof document === 'undefined') return VisualSymbol.fromDrawing(Drawing.withHash(hash));
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = SIDE;
    PAINTERS[name](canvas.getContext('2d'));
    return VisualSymbol.fromDrawing(new Drawing({ hash, image: canvas, width: SIDE, height: SIDE }));
  }

  static all() {
    const symbols = {};
    for (const name of ChallengeDrawings.names()) symbols[name] = ChallengeDrawings.symbol(name);
    return symbols;
  }
}
