// Dibuja símbolos e ítems en un contexto 2D: la imagen, el marco de los símbolos,
// los resaltados (error, lento, inspeccionado, selección) y los estados especiales.
export class SymbolPainter {
  // Cuánto se achica la imagen dentro de la ficha de símbolo (12% por lado).
  static symbolInset = 0.12;

  // Los colores de las categorías de símbolos (amarillo: fundamentales, celeste: conectores,
  // gris: parámetros y dibujos) y sus tintes de fondo.
  static frameColors = { yellow: '#F2C300', cyan: '#12B5CB', gray: '#8A8A8A', red: '#E0443E' };
  static frameTints = { yellow: '#FFF1BF', cyan: '#D3F3F7', gray: '#E9E9E9', red: '#FFD9D7' };

  static roundedRect(context, x, y, width, height, radius) {
    context.beginPath();
    context.moveTo(x + radius, y);
    context.arcTo(x + width, y, x + width, y + height, radius);
    context.arcTo(x + width, y + height, x, y + height, radius);
    context.arcTo(x, y + height, x, y, radius);
    context.arcTo(x, y, x + width, y, radius);
    context.closePath();
  }

  // Borra sólo las esquinas del cuadrado del símbolo (lo que queda fuera de la ficha).
  static clearCorners(context, x, y, size, radius) {
    context.save();
    context.globalCompositeOperation = 'destination-out';
    const rounded = new Path2D();
    rounded.moveTo(x + radius, y);
    rounded.arcTo(x + size, y, x + size, y + size, radius);
    rounded.arcTo(x + size, y + size, x, y + size, radius);
    rounded.arcTo(x, y + size, x, y, radius);
    rounded.arcTo(x, y, x + size, y, radius);
    rounded.closePath();
    const combined = new Path2D();
    combined.rect(x, y, size, size);
    combined.addPath(rounded);
    context.fillStyle = 'black';
    context.fill(combined, 'evenodd');
    context.restore();
  }

  // El marco de símbolo es una "ficha": redondeada, teñida con el color de la categoría y con
  // un borde del mismo color. Reemplaza al marco negro/color/negro de Cuis, que se confundía
  // con el dibujo cuando compartían color.
  static paintFrame(context, x, y, size, color) {
    const border = SymbolPainter.frameColors[color] || color;
    const radius = size * 0.2;
    context.save();
    context.globalCompositeOperation = 'multiply';
    context.fillStyle = SymbolPainter.frameTints[color] || '#EEEEEE';
    SymbolPainter.roundedRect(context, x, y, size, size, radius);
    context.fill();
    SymbolPainter.clearCorners(context, x, y, size, radius);
    context.globalCompositeOperation = 'source-over';
    context.lineWidth = Math.max(2, size * 0.05);
    context.strokeStyle = border;
    SymbolPainter.roundedRect(context, x + context.lineWidth / 2, y + context.lineWidth / 2, size - context.lineWidth, size - context.lineWidth, radius);
    context.stroke();
    context.restore();
  }

  static imageOf(symbol) {
    return symbol.drawing === null ? null : symbol.drawing.image;
  }

  // La imagen del símbolo dentro de un cuadrado; si no hay imagen, una marca de "?".
  static paintImage(context, symbol, x, y, size, alpha = 1) {
    const image = SymbolPainter.imageOf(symbol);
    context.save();
    context.globalAlpha = alpha;
    if (image !== null) {
      const scale = Math.min(size / image.width, size / image.height);
      const width = image.width * scale;
      const height = image.height * scale;
      context.drawImage(image, x + (size - width) / 2, y + (size - height) / 2, width, height);
    } else {
      context.fillStyle = symbol.drawing !== null && symbol.drawing.fillColor ? symbol.drawing.fillColor : '#ddd';
      context.fillRect(x + 2, y + 2, size - 4, size - 4);
      context.fillStyle = '#666';
      context.font = Math.floor(size / 2) + 'px sans-serif';
      context.textAlign = 'center';
      context.textBaseline = 'middle';
      context.fillText('?', x + size / 2, y + size / 2);
    }
    context.restore();
  }

  static paintSymbol(context, symbol, x, y, size, { framed = true } = {}) {
    if (framed) {
      context.fillStyle = 'white';
      context.fillRect(x, y, size, size);
      const inset = size * SymbolPainter.symbolInset;
      SymbolPainter.paintImage(context, symbol, x + inset, y + inset, size - 2 * inset);
      SymbolPainter.paintFrame(context, x, y, size, symbol.highlightColor);
    } else {
      SymbolPainter.paintImage(context, symbol, x, y, size);
    }
  }

  static backgroundOf(item) {
    if (item.selectedByUser) return 'rgba(173, 216, 230, 0.8)';
    if (item.highlightKind === 'error') return 'rgba(255, 120, 120, 0.35)';
    if (item.highlightKind === 'slow') return 'rgba(255, 255, 150, 0.6)';
    if (item.highlightKind === 'inspected') return 'rgba(150, 255, 150, 0.6)';
    if (item.isButton()) return item.buttonHover ? 'rgba(200, 200, 200, 0.9)' : 'rgba(235, 235, 235, 0.9)';
    return null;
  }

  static paintItem(context, item, x, y, gridSize) {
    if (!item.isVisible()) return;
    const size = gridSize * item.gridResizeFactor();
    const symbol = item.visualSymbolAssociated;
    const background = SymbolPainter.backgroundOf(item);
    if (background !== null) { context.fillStyle = background; context.fillRect(x, y, size, size); }
    if (item.consideredSymbol) {
      const inset = size * SymbolPainter.symbolInset;
      if (background === null) { context.fillStyle = 'white'; context.fillRect(x, y, size, size); }
      SymbolPainter.paintItemImage(context, item, x + inset, y + inset, size - 2 * inset);
      SymbolPainter.paintFrame(context, x, y, size, item.errorBorder ? 'red' : symbol.highlightColor);
    } else {
      SymbolPainter.paintItemImage(context, item, x, y, size);
    }
    const eyes = typeof item.eyesColor === 'function' ? item.eyesColor() : null;
    if (eyes !== null) {
      context.fillStyle = eyes === 'green' ? 'rgba(0, 200, 0, 0.35)' : 'rgba(255, 0, 0, 0.35)';
      context.fillRect(x, y, size, size);
    }
  }

  static paintItemImage(context, item, x, y, size) {
    const symbol = item.visualSymbolAssociated;
    if (item.isAdjacentCell() && !item.isPointingNoDirection()) {
      const angles = item.isPointingAllDirections() ? [0, 45, 90, 135, 180, 225, 270, 315] : [item.referencingAngle];
      for (const angle of angles) {
        context.save();
        context.translate(x + size / 2, y + size / 2);
        context.rotate(angle * Math.PI / 180);
        SymbolPainter.paintImage(context, symbol, -size / 2, -size / 2, size, angles.length > 1 ? 0.5 : 1);
        context.restore();
      }
      return;
    }
    if (item.isRun() && item.isSlowedDown()) {
      const factor = Math.pow(2, -item.slowDownFactor() / 8);
      const reduced = size * factor;
      SymbolPainter.paintImage(context, symbol, x + (size - reduced) / 2, y + (size - reduced) / 2, reduced);
      return;
    }
    SymbolPainter.paintImage(context, symbol, x, y, size);
  }

  // Un canvas chico con el símbolo (para la paleta y el fantasma al arrastrar).
  static thumbnail(symbol, size, { framed = true } = {}) {
    const canvas = document.createElement('canvas');
    canvas.width = size;
    canvas.height = size;
    SymbolPainter.paintSymbol(canvas.getContext('2d'), symbol, 0, 0, size, { framed });
    return canvas;
  }
}
