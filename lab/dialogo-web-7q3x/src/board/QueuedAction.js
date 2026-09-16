// Acciones encoladas por el tablero para realizarse en el próximo step.
// Cada una responde perform() con true si efectivamente se hizo.
export class QueuedAction {
  constructor(element, board) {
    this.element = element;
    this.board = board;
  }
  perform() { throw new Error('subclassResponsibility'); }
}

export class QueuedAdd extends QueuedAction {
  constructor(element, position, board) { super(element, board); this.position = position; }
  perform() { this.board.performAddOf(this.element, this.position); return true; }
}

export class QueuedMoveBy extends QueuedAction {
  constructor(element, direction, board) { super(element, board); this.direction = direction; }
  perform() {
    if (this.board.ifPossibleMoveBy(this.element, this.direction)) {
      this.element.direction = this.direction;
      return true;
    }
    return false;
  }
}

export class QueuedMoveTo extends QueuedAction {
  constructor(element, position, board) { super(element, board); this.position = position; }
  perform() { return this.board.ifPossibleMoveTo(this.element, this.position); }
}

export class QueuedRemove extends QueuedAction {
  constructor(element, firstCandidate, board) { super(element, board); this.firstCandidate = firstCandidate; }
  perform() { this.board.performRemoveOf(this.element, this.firstCandidate); return true; }
}

export class QueuedTeleport extends QueuedAction {
  constructor(element, position, board) { super(element, board); this.position = position; }
  perform() { this.board.performTeleportOf(this.element, this.position); return true; }
}

export class QueuedUserCommand extends QueuedAction {
  constructor(command) { super(command, null); this.command = command; }
  perform() { this.command(); return true; }
}
