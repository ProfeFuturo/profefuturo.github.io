import { Point } from '../board/Point.js';
import { VisualProject } from './VisualProject.js';
import { ChallengeDrawings } from './ChallengeDrawings.js';

const COLUMNS = 7;
const ROWS = 8;

// Un desafío de la escalera (ver docs/desafios.md): arma un tablero chico con la regla casi
// hecha, dice qué símbolos van en la bandeja, sabe cuándo se logró la meta y qué pista dar.
export class Challenge {
  constructor({ id, number, title, goal, emoji, symbols, pencil = false, build, isCompleted, hint = () => null }) {
    this.id = id;
    this.number = number;
    this.title = title;
    this.goal = goal;
    this.emoji = emoji;
    this.symbols = symbols;             // selectores de predefinidos disponibles en la bandeja
    this.pencil = pencil;               // si la bandeja muestra el lápiz
    this.build = build;                 // (project, drawings, predefined) → void
    this.isCompleted = isCompleted;     // (project, drawings) → boolean
    this.hintFor = hint;                // (project, drawings) → { cell, selector, drawing } | null
  }

  // Un proyecto nuevo con este desafío armado. Los dibujos se crean para cada proyecto.
  projectFor({ gridSize = 52, random = Math.random } = {}) {
    const project = new VisualProject({ name: this.title, gridSize, columns: COLUMNS, rows: ROWS, random }).connect();
    const drawings = ChallengeDrawings.all();
    project.challenge = this;
    project.challengeDrawings = drawings;
    project.availableSymbols = this.symbols;
    this.build(project, drawings, Challenge.predefinedOf(project));
    project.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
    project.boardModel.recordCurrentBoard();
    project.boardModel.setCurrentAsResetBoard();
    return project;
  }

  static predefinedOf(project) {
    const predefined = {};
    for (const symbol of project.predefinedSymbols) predefined[symbol.buildingSelector] = symbol;
    return predefined;
  }

  completedIn(project) { return this.isCompleted(project, project.challengeDrawings); }
  hintIn(project) { return this.hintFor(project, project.challengeDrawings); }

  // --- ayudas para armar tableros ---

  static symbol(project, symbol, column, row) {
    const item = project.boardModel.addItemFromSymbol(symbol, Point.at(column, row));
    if (item.consideredElement()) item.invertSymbolicStateIfCanBeElement();
    return item;
  }

  static element(project, symbol, column, row) {
    return project.boardModel.addItemFromSymbol(symbol, Point.at(column, row));
  }

  static rule(project, symbols, row, column = 0) {
    return symbols.map((symbol, index) => symbol === null ? null : Challenge.symbol(project, symbol, column + index, row));
  }

  // --- consultas para las metas ---

  static elementsOf(project, drawing) { return project.boardModel.elementsRepresentedBy(drawing); }

  static positionsOf(project, drawing) {
    const board = project.boardModel;
    return Challenge.elementsOf(project, drawing).map(item => board.positionOfIfAbsent(item, () => null)).filter(position => position !== null);
  }

  static anyOnTopOf(project, drawing, otherDrawing) {
    const targets = Challenge.positionsOf(project, otherDrawing).map(position => position.key());
    return Challenge.positionsOf(project, drawing).some(position => targets.includes(position.key()));
  }

  static ruleCellIsEmpty(project, column, row) {
    return project.boardModel.itemsInPosition(Point.at(column, row)).length === 0;
  }
}

// La escalera. Cada desafío entra en 7 × 8 celdas; la regla va arriba, el juego abajo.
export class Challenges {
  static all() { return LADDER; }
  static withId(id) { return LADDER.find(challenge => challenge.id === id) || null; }
  static first() { return LADDER[0]; }
  static after(challenge) { return LADDER[challenge.number] || null; }
}

const LADDER = [
  new Challenge({
    id: 'reach-star', number: 1, title: 'Llegá a la estrella', goal: 'Llevá al personaje hasta la estrella', emoji: '⭐',
    symbols: [],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 0);
      Challenge.element(project, drawings.kid, 1, 5);
      Challenge.element(project, drawings.star, 5, 5);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: (project, drawings) => ({ cell: Challenge.positionsOf(project, drawings.star)[0] || null, joystick: true }),
  }),
  new Challenge({
    id: 'make-rule', number: 2, title: 'Armá la regla', goal: 'Poné las flechas al lado del personaje y llegá a la estrella', emoji: '🧩',
    symbols: ['arrowKeysSymbol'],
    build(project, drawings) {
      Challenge.rule(project, [drawings.kid], 0);
      Challenge.element(project, drawings.kid, 1, 5);
      Challenge.element(project, drawings.star, 5, 5);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 0) ? { cell: Point.at(1, 0), selector: 'arrowKeysSymbol' } : { joystick: true },
  }),
  new Challenge({
    id: 'eat-star', number: 3, title: 'Comé la estrella', goal: 'Completá la regla con el agujero negro y chocá la estrella', emoji: '🕳️',
    symbols: ['blackHoleSymbol'],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 0);
      Challenge.rule(project, [drawings.kid, predefined.collisionSymbol, drawings.star, predefined.pointsSymbol, drawings.star, predefined.teleportSymbol], 1);
      Challenge.element(project, drawings.kid, 1, 5);
      Challenge.element(project, drawings.star, 3, 5);
      Challenge.element(project, drawings.star, 5, 6);
    },
    isCompleted: (project, drawings) => Challenge.elementsOf(project, drawings.star).length === 0 && Challenge.elementsOf(project, drawings.kid).length > 0,
    hint: project => Challenge.ruleCellIsEmpty(project, 6, 1) ? { cell: Point.at(6, 1), selector: 'blackHoleSymbol' } : { joystick: true },
  }),
  new Challenge({
    id: 'draw', number: 4, title: 'Dibujá', goal: 'Dibujá algo con el lápiz y ponelo en el tablero', emoji: '🎨',
    symbols: [], pencil: true,
    build(project, drawings) {
      Challenge.element(project, drawings.star, 5, 5);
    },
    isCompleted: project => project.drawingsMadeByUser().some(symbol => Challenge.elementsOf(project, symbol).length > 0),
    hint: project => project.drawingsMadeByUser().length === 0 ? { pencil: true } : { cell: Point.at(1, 5), drawing: project.drawingsMadeByUser()[0] },
  }),
  new Challenge({
    id: 'bring-to-life', number: 5, title: 'Dale vida', goal: 'Poné tu dibujo en la regla y movelo hasta la estrella', emoji: '✨',
    symbols: ['arrowKeysSymbol'], pencil: true,
    build(project, drawings, predefined) {
      Challenge.symbol(project, predefined.arrowKeysSymbol, 1, 0);
      Challenge.element(project, drawings.star, 5, 5);
      project.receiveDrawnSymbol(drawings.monster);
      Challenge.element(project, drawings.monster, 1, 5);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.monster, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 0, 0) ? { cell: Point.at(0, 0), drawing: project.drawingsMadeByUser()[0] } : { joystick: true },
  }),
  new Challenge({
    id: 'run', number: 6, title: 'El monstruo corre', goal: 'Completá la regla para que el monstruo corra solo a la estrella', emoji: '🏃',
    symbols: ['runSymbol'],
    build(project, drawings) {
      Challenge.rule(project, [drawings.monster, null, drawings.star], 0);
      Challenge.element(project, drawings.monster, 0, 6);
      Challenge.element(project, drawings.star, 6, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.monster, drawings.star),
    hint: () => ({ cell: Point.at(1, 0), selector: 'runSymbol' }),
  }),
  new Challenge({
    id: 'push', number: 7, title: 'Empujá la caja', goal: 'Completá la regla y empujá la caja hasta la estrella', emoji: '📦',
    symbols: ['pushSymbol'],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 0);
      Challenge.rule(project, [drawings.kid, null, drawings.box], 1);
      Challenge.element(project, drawings.kid, 1, 5);
      Challenge.element(project, drawings.box, 2, 5);
      Challenge.element(project, drawings.star, 5, 5);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.box, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 1) ? { cell: Point.at(1, 1), selector: 'pushSymbol' } : { joystick: true },
  }),
  new Challenge({
    id: 'walls', number: 8, title: 'Paredes', goal: 'Completá la regla: el monstruo no pasa la pared y no te alcanza', emoji: '🧱',
    symbols: ['canNotTranspassSymbol'],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.monster, predefined.runSymbol, drawings.kid], 0);
      Challenge.rule(project, [drawings.monster, null, drawings.wall], 1);
      for (let row = 0; row < 8; row++) Challenge.element(project, drawings.wall, 3, row);
      Challenge.element(project, drawings.monster, 0, 5);
      Challenge.element(project, drawings.kid, 6, 5);
    },
    // Con la regla puesta, el monstruo corre hasta la pared y se queda pegado a ella.
    isCompleted: (project, drawings) => {
      const monsters = Challenge.positionsOf(project, drawings.monster);
      return !Challenge.ruleCellIsEmpty(project, 1, 1) && monsters.length > 0 && monsters.every(position => position.x <= 2) && monsters.some(position => position.x === 2);
    },
    hint: () => ({ cell: Point.at(1, 1), selector: 'canNotTranspassSymbol' }),
  }),
  new Challenge({
    id: 'button', number: 9, title: 'El botón', goal: 'Tocá la campana: el personaje aparece en la estrella', emoji: '🔔',
    symbols: [],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.bell, predefined.pointsSymbol, drawings.kid, predefined.teleportSymbol, drawings.star], 0);
      Challenge.element(project, drawings.kid, 0, 6);
      Challenge.element(project, drawings.star, 5, 3);
      const bell = Challenge.element(project, drawings.bell, 3, 6);
      bell.invertBecameButtonWithoutEvaluating();
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: (project, drawings) => ({ cell: Challenge.positionsOf(project, drawings.bell)[0] || null, tap: true }),
  }),
  new Challenge({
    id: 'eyes', number: 10, title: 'Los ojos', goal: 'Poné los ojos después de la estrella y mirá qué aparece', emoji: '👀',
    symbols: ['replSymbol'],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.star, predefined.pointsSymbol, drawings.heart], 0);
      Challenge.symbol(project, drawings.star, 0, 3);
    },
    isCompleted: (project, drawings) => project.boardModel.symbolsInPosition(Point.at(2, 3)).some(item => item.visualSymbolAssociated.equals(drawings.heart)),
    hint: () => ({ cell: Point.at(1, 3), selector: 'replSymbol' }),
  }),
];
