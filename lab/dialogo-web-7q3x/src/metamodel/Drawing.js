// La imagen de un símbolo dibujado por el usuario.
// `image` es un canvas (o ImageBitmap) en el navegador; en los tests puede ser null.
// El hash identifica el dibujo: dos símbolos con el mismo hash son el mismo término.
export class Drawing {
  constructor({ hash, width = 0, height = 0, image = null, pngBytes = null, fillColor = null }) {
    this.hash = hash;
    this.width = width;
    this.height = height;
    this.image = image;
    this.pngBytes = pngBytes;
    this.fillColor = fillColor;
  }

  static withHash(hash) {
    return new Drawing({ hash });
  }

  // Un dibujo que faltaba en el archivo: un cuadrado de color al azar (como en Cuis).
  static missing(random = Math.random) {
    const color = '#' + Math.floor(random() * 0xFFFFFF).toString(16).padStart(6, '0');
    const drawing = new Drawing({ hash: 'missing-' + color + '-' + Math.floor(random() * 1e9), width: 425, height: 425, fillColor: color });
    if (typeof document !== 'undefined') {
      const canvas = document.createElement('canvas');
      canvas.width = 425; canvas.height = 425;
      const context = canvas.getContext('2d');
      context.fillStyle = color;
      context.fillRect(0, 0, 425, 425);
      drawing.image = canvas;
    }
    return drawing;
  }

  // Un canvas nuevo a partir de un dibujo hecho en el navegador (pincel). Hash por píxeles.
  static fromCanvas(canvas) {
    const context = canvas.getContext('2d');
    const data = context.getImageData(0, 0, canvas.width, canvas.height).data;
    return new Drawing({ hash: Drawing.hashOfBytes(data), width: canvas.width, height: canvas.height, image: canvas });
  }

  // FNV-1a de 32 bits sobre bytes (PNG o píxeles), en hexadecimal.
  static hashOfBytes(bytes) {
    let hash = 0x811c9dc5;
    for (let index = 0; index < bytes.length; index++) {
      hash ^= bytes[index];
      hash = Math.imul(hash, 0x01000193) >>> 0;
    }
    return hash.toString(16).padStart(8, '0');
  }

  // Como en Cuis: al cargar un PNG, el blanco puro pasa a ser transparente.
  static canvasWithWhiteAsTransparent(bitmap) {
    const canvas = document.createElement('canvas');
    canvas.width = bitmap.width;
    canvas.height = bitmap.height;
    const context = canvas.getContext('2d', { willReadFrequently: true });
    context.drawImage(bitmap, 0, 0);
    const imageData = context.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    for (let index = 0; index < data.length; index += 4) {
      if (data[index] === 255 && data[index + 1] === 255 && data[index + 2] === 255) data[index + 3] = 0;
    }
    context.putImageData(imageData, 0, 0);
    return canvas;
  }

  // Bytes PNG para guardar (transparente → blanco, como en Cuis). null si no hay imagen ni bytes.
  async pngBytesFor() {
    if (this.pngBytes !== null) return this.pngBytes;
    if (this.image === null || typeof document === 'undefined') return null;
    const canvas = document.createElement('canvas');
    canvas.width = this.image.width;
    canvas.height = this.image.height;
    const context = canvas.getContext('2d');
    context.fillStyle = 'white';
    context.fillRect(0, 0, canvas.width, canvas.height);
    context.drawImage(this.image, 0, 0);
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    this.pngBytes = new Uint8Array(await blob.arrayBuffer());
    return this.pngBytes;
  }
}
