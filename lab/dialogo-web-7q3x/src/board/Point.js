// Punto entero en unidades de celda del tablero (columna @ fila).
// El modelo trabaja en celdas; el tamaño de la grilla en píxeles es cosa de la vista.
export class Point {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  static at(x, y) { return new Point(x, y); }

  // '3@-1' → Point(3, -1)
  static fromString(string) {
    const [x, y] = string.split('@');
    return new Point(Number(x), Number(y));
  }

  plus(other) { return new Point(this.x + other.x, this.y + other.y); }
  minus(other) { return new Point(this.x - other.x, this.y - other.y); }
  times(factor) { return new Point(this.x * factor, this.y * factor); }
  negated() { return new Point(-this.x, -this.y); }
  max(other) { return new Point(Math.max(this.x, other.x), Math.max(this.y, other.y)); }
  min(other) { return new Point(Math.min(this.x, other.x), Math.min(this.y, other.y)); }
  rounded() { return new Point(Math.round(this.x), Math.round(this.y)); }
  isZero() { return this.x === 0 && this.y === 0; }
  equals(other) { return other !== null && other !== undefined && this.x === other.x && this.y === other.y; }
  isLessOrEqualThan(other) { return this.x <= other.x && this.y <= other.y; }
  dist(other) { return Math.hypot(this.x - other.x, this.y - other.y); }
  key() { return this.x + '@' + this.y; }
  toString() { return this.x + '@' + this.y; }
}

Point.ZERO = new Point(0, 0);
