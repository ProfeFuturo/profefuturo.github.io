import { Point } from '../board/Point.js';
import { VisualProject } from './VisualProject.js';
import { ChallengeDrawings } from './ChallengeDrawings.js';

export const COLUMNS = 7;
const ROWS = 8;

// Un desafío de la escalera (ver docs/desafios.md): arma un tablero chico con la regla casi
// hecha, dice qué símbolos van en la bandeja, sabe cuándo se logró la meta y qué pista dar.
export class Challenge {
  constructor({ id, number, world = 'primeros', title, goal, steps = null, praise = '', emoji, symbols, pencil = false, slots = [], build, isCompleted, hint = () => null, solution = null }) {
    this.id = id;
    this.number = number;
    this.title = title;
    this.goal = goal;
    this.emoji = emoji;
    this.symbols = symbols;             // selectores de predefinidos disponibles en la bandeja
    this.pencil = pencil;               // si la bandeja muestra el lápiz
    this.slots = slots;                 // celdas vacías de la regla que hay que completar
    this.steps = steps || [{ text: goal, done: null }];   // la consigna, de a un paso: [{ text, done(project) }]
    this.praise = praise;               // al lograrlo: la idea, en una línea
    this.world = world;                 // el mundo (capítulo) al que pertenece
    this.solution = solution;           // cómo se resuelve, para los tests: (play) → void
    this.build = build;                 // (project, drawings, predefined, userDrawings) → void
    this.isCompleted = isCompleted;     // (project, drawings) → boolean
    this.hintFor = hint;                // (project, drawings) → { cell, selector, drawing } | null
  }

  // Un proyecto nuevo con este desafío armado. Los dibujos se crean para cada proyecto.
  projectFor({ gridSize = 52, random = Math.random, userDrawings = [] } = {}) {
    const project = new VisualProject({ name: this.title, gridSize, columns: COLUMNS, rows: ROWS, random }).connect();
    const drawings = ChallengeDrawings.all();
    project.challenge = this;
    project.challengeDrawings = drawings;
    project.availableSymbols = this.symbols;
    this.build(project, drawings, Challenge.predefinedOf(project), userDrawings);
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

  // La consigna de este momento: el primer paso que falta (el último es lograr el desafío).
  goalIn(project) {
    for (const step of this.steps) if (step.done !== null && !step.done(project)) return step.text;
    return this.steps[this.steps.length - 1].text;
  }
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

// Los mundos: capítulos de la escalera, cada uno alrededor de una idea del lenguaje.
export const WORLDS = [
  { id: 'primeros', title: 'Primeros pasos', emoji: '🚀' },
  { id: 'choques', title: 'Choques', emoji: '💥' },
  { id: 'categorias', title: 'Categorías', emoji: '🏷️' },
  { id: 'sustitucion', title: 'Sustitución', emoji: '🔁' },
];

// La escalera. Cada desafío entra en 7 × 8 celdas; la regla va abajo, el juego arriba.
export class Challenges {
  static all() { return LADDER; }
  static worlds() { return WORLDS; }
  static inWorld(worldId) { return LADDER.filter(challenge => challenge.world === worldId); }
  static worldOf(challenge) { return WORLDS.find(world => world.id === challenge.world) || WORLDS[0]; }
  static withId(id) { return LADDER.find(challenge => challenge.id === id) || null; }
  static first() { return LADDER[0]; }
  static after(challenge) { return LADDER[challenge.number] || null; }
}

// Las reglas van abajo (filas 6 y 7), pegadas a la bandeja de donde salen las fichas; el juego
// arriba. Los "slots" son las celdas vacías de la regla que hay que completar: se ven desde el
// principio, tenues, para que la pieza tenga adónde ir.
const LADDER = [
  new Challenge({
    id: 'reach-star', number: 1, title: 'Llegá a la estrella', goal: 'Llevá al personaje hasta la estrella con las flechas', emoji: '⭐',
    praise: 'El personaje está al lado de las flechas: por eso se mueve.',
    symbols: [],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 7);
      Challenge.element(project, drawings.kid, 1, 3);
      Challenge.element(project, drawings.star, 5, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: (project, drawings) => ({ cell: Challenge.positionsOf(project, drawings.star)[0] || null, joystick: true }),
  }),
  new Challenge({
    id: 'make-rule', number: 2, title: 'Armá la regla', goal: 'Arrastrá las flechas hasta el cuadradito, al lado del personaje', emoji: '🧩',
    steps: [
      { text: 'Arrastrá las flechas hasta el cuadradito, al lado del personaje', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: '¡Ahora se mueve! Llevalo hasta la estrella', done: null },
    ],
    praise: 'Personaje + flechas = se mueve. Eso es una regla.',
    symbols: ['arrowKeysSymbol'], slots: [Point.at(1, 7)],
    build(project, drawings) {
      Challenge.rule(project, [drawings.kid], 7);
      Challenge.element(project, drawings.kid, 1, 3);
      Challenge.element(project, drawings.star, 5, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 7) ? { cell: Point.at(1, 7), selector: 'arrowKeysSymbol' } : { joystick: true },
  }),
  new Challenge({
    id: 'eat-star', number: 3, title: 'Comé las estrellas', goal: 'Arrastrá el agujero negro hasta el cuadradito del final de la regla', emoji: '🕳️',
    steps: [
      { text: 'Arrastrá el agujero negro hasta el cuadradito del final de la regla', done: project => !Challenge.ruleCellIsEmpty(project, 6, 7) },
      { text: 'Ahora chocá las dos estrellas', done: null },
    ],
    praise: 'Cuando el personaje choca una estrella, la estrella se va al agujero negro.',
    symbols: ['blackHoleSymbol'], slots: [Point.at(6, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 6);
      Challenge.rule(project, [drawings.kid, predefined.collisionSymbol, drawings.star, predefined.pointsSymbol, drawings.star, predefined.teleportSymbol], 7);
      Challenge.element(project, drawings.kid, 1, 3);
      Challenge.element(project, drawings.star, 3, 3);
      Challenge.element(project, drawings.star, 5, 4);
    },
    isCompleted: (project, drawings) => Challenge.elementsOf(project, drawings.star).length === 0 && Challenge.elementsOf(project, drawings.kid).length > 0,
    hint: project => Challenge.ruleCellIsEmpty(project, 6, 7) ? { cell: Point.at(6, 7), selector: 'blackHoleSymbol' } : { joystick: true },
  }),
  new Challenge({
    id: 'draw', number: 4, title: 'Dibujá', goal: 'Tocá el lápiz. Dibujá tu personaje', emoji: '🎨',
    praise: 'Tu dibujo ya es un personaje. Ahora vamos a hacer que se mueva.',
    symbols: [], pencil: true,
    build() {},
    isCompleted: project => project.drawingsMadeByUser().length > 0,
    hint: () => ({ pencil: true }),
  }),
  new Challenge({
    id: 'bring-to-life', number: 5, title: 'Dale vida', goal: 'Arrastrá tu dibujo hasta el cuadradito, al lado de las flechas', emoji: '✨',
    steps: [
      { text: 'Arrastrá tu dibujo hasta el cuadradito, al lado de las flechas', done: project => !Challenge.ruleCellIsEmpty(project, 0, 7) },
      { text: '¡Tu dibujo se mueve! Llevalo hasta la estrella', done: null },
    ],
    praise: 'Tu dibujo + flechas = tu dibujo se mueve. Vos armaste esa regla.',
    symbols: [], slots: [Point.at(0, 7)],
    // Usa el dibujo que el chico hizo en el desafío anterior; si no hay, el monstruo.
    build(project, drawings, predefined, userDrawings) {
      const mine = userDrawings[0] || drawings.monster;
      Challenge.symbol(project, predefined.arrowKeysSymbol, 1, 7);
      Challenge.element(project, drawings.star, 5, 3);
      project.receiveDrawnSymbol(mine);
      Challenge.element(project, mine, 1, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, project.drawingsMadeByUser()[0], drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 0, 7) ? { cell: Point.at(0, 7), drawing: project.drawingsMadeByUser()[0] } : { joystick: true },
  }),
  new Challenge({
    id: 'run', number: 6, title: 'El monstruo corre', goal: 'Arrastrá «correr» hasta el cuadradito, entre el monstruo y la estrella', emoji: '🏃',
    steps: [
      { text: 'Arrastrá «correr» hasta el cuadradito, entre el monstruo y la estrella', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Mirá: el monstruo corre solo', done: null },
    ],
    praise: 'Monstruo + correr + estrella: el monstruo va solo hasta la estrella, sin que toques nada.',
    symbols: ['runSymbol'], slots: [Point.at(1, 7)],
    build(project, drawings) {
      Challenge.rule(project, [drawings.monster, null, drawings.star], 7);
      Challenge.element(project, drawings.monster, 0, 4);
      Challenge.element(project, drawings.star, 6, 1);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.monster, drawings.star),
    hint: () => ({ cell: Point.at(1, 7), selector: 'runSymbol' }),
  }),
  new Challenge({
    id: 'push', number: 7, title: 'Empujá la caja', goal: 'Arrastrá «empujar» hasta el cuadradito, entre el personaje y la caja', emoji: '📦',
    steps: [
      { text: 'Arrastrá «empujar» hasta el cuadradito, entre el personaje y la caja', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Ahora empujá la caja hasta la estrella', done: null },
    ],
    praise: 'Personaje + empujar + caja: cuando el personaje choca la caja, la caja se mueve.',
    symbols: ['pushSymbol'], slots: [Point.at(1, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 6);
      Challenge.rule(project, [drawings.kid, null, drawings.box], 7);
      Challenge.element(project, drawings.kid, 1, 3);
      Challenge.element(project, drawings.box, 2, 3);
      Challenge.element(project, drawings.star, 5, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.box, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 7) ? { cell: Point.at(1, 7), selector: 'pushSymbol' } : { joystick: true },
  }),
  new Challenge({
    id: 'walls', number: 8, title: 'La pared', goal: 'Arrastrá «no pasa» hasta el cuadradito, entre el monstruo y la pared', emoji: '🧱',
    steps: [
      { text: 'Arrastrá «no pasa» hasta el cuadradito, entre el monstruo y la pared', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Mirá qué hace el monstruo', done: null },
    ],
    praise: 'Monstruo + no pasa + pared: el monstruo corre, pero la pared lo frena.',
    symbols: ['canNotTranspassSymbol'], slots: [Point.at(1, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.monster, predefined.runSymbol, drawings.kid], 6);
      Challenge.rule(project, [drawings.monster, null, drawings.wall], 7);
      for (let row = 0; row < 8; row++) Challenge.element(project, drawings.wall, 3, row);
      Challenge.element(project, drawings.monster, 0, 3);
      Challenge.element(project, drawings.kid, 6, 3);
    },
    // Con la regla puesta, el monstruo corre hasta la pared y se queda pegado a ella.
    isCompleted: (project, drawings) => {
      const monsters = Challenge.positionsOf(project, drawings.monster);
      return !Challenge.ruleCellIsEmpty(project, 1, 7) && monsters.length > 0 && monsters.every(position => position.x <= 2) && monsters.some(position => position.x === 2);
    },
    hint: () => ({ cell: Point.at(1, 7), selector: 'canNotTranspassSymbol' }),
  }),
  new Challenge({
    id: 'button', number: 9, title: 'La campana', goal: 'Tocá la campana. Mirá qué pasa', emoji: '🔔',
    praise: 'La campana es un botón: cuando la tocás, el personaje aparece en la estrella.',
    symbols: [],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.bell, predefined.pointsSymbol, drawings.kid, predefined.teleportSymbol, drawings.star], 7);
      Challenge.element(project, drawings.kid, 0, 4);
      Challenge.element(project, drawings.star, 5, 1);
      const bell = Challenge.element(project, drawings.bell, 3, 4);
      bell.invertBecameButtonWithoutEvaluating();
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: (project, drawings) => ({ cell: Challenge.positionsOf(project, drawings.bell)[0] || null, tap: true }),
  }),
  new Challenge({
    id: 'eyes', number: 10, title: 'Los ojos', goal: 'Arrastrá los ojos hasta el cuadradito, al lado de la estrella', emoji: '👀',
    praise: 'Los ojos muestran lo que dice la regla: acá, la estrella se hace corazón.',
    symbols: ['replSymbol'], slots: [Point.at(1, 3)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.star, predefined.pointsSymbol, drawings.heart], 7);
      Challenge.symbol(project, drawings.star, 0, 3);
    },
    isCompleted: (project, drawings) => project.boardModel.symbolsInPosition(Point.at(2, 3)).some(item => item.visualSymbolAssociated.equals(drawings.heart)),
    hint: () => ({ cell: Point.at(1, 3), selector: 'replSymbol' }),
    solution: play => play.drop('replSymbol', 1, 3),
  }),

  // ---------- Mundo 2: Choques ----------
  new Challenge({
    id: 'sun', number: 11, world: 'choques', title: 'Sale el sol', emoji: '☀️',
    goal: 'Arrastrá «teletransportar» hasta el cuadradito, entre el sol y el pasto',
    steps: [
      { text: 'Arrastrá «teletransportar» hasta el cuadradito, entre el sol y el pasto', done: project => !Challenge.ruleCellIsEmpty(project, 5, 7) },
      { text: 'Llevá la oveja hasta el pasto', done: null },
    ],
    praise: 'Cuando la oveja choca el pasto, el sol aparece ahí. Un choque puede hacer aparecer cosas.',
    symbols: ['teleportSymbol'], slots: [Point.at(5, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.sheep, predefined.arrowKeysSymbol], 6);
      Challenge.rule(project, [drawings.sheep, predefined.collisionSymbol, drawings.grass, predefined.pointsSymbol, drawings.sun, null, drawings.grass], 7);
      Challenge.element(project, drawings.sheep, 1, 3);
      Challenge.element(project, drawings.grass, 5, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.sun, drawings.grass),
    hint: project => Challenge.ruleCellIsEmpty(project, 5, 7) ? { cell: Point.at(5, 7), selector: 'teleportSymbol' } : { joystick: true },
    solution: play => { play.drop('teleportSymbol', 5, 7); play.right(4); },
  }),
  new Challenge({
    id: 'eat-all', number: 12, world: 'choques', title: 'Comé todo', emoji: '🍎',
    goal: 'Arrastrá el agujero negro hasta el cuadradito',
    steps: [
      { text: 'Arrastrá el agujero negro hasta el cuadradito', done: project => !Challenge.ruleCellIsEmpty(project, 6, 7) },
      { text: 'Ahora comé las manzanas y las estrellas', done: null },
    ],
    praise: 'Una regla por cada cosa que se come. Con dos reglas, el personaje come dos cosas.',
    symbols: ['blackHoleSymbol'], slots: [Point.at(6, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 5);
      Challenge.rule(project, [drawings.kid, predefined.collisionSymbol, drawings.star, predefined.pointsSymbol, drawings.star, predefined.teleportSymbol, predefined.blackHoleSymbol], 6);
      Challenge.rule(project, [drawings.kid, predefined.collisionSymbol, drawings.apple, predefined.pointsSymbol, drawings.apple, predefined.teleportSymbol, null], 7);
      Challenge.element(project, drawings.kid, 0, 2);
      Challenge.element(project, drawings.apple, 2, 2);
      Challenge.element(project, drawings.star, 4, 2);
      Challenge.element(project, drawings.apple, 4, 3);
      Challenge.element(project, drawings.star, 1, 3);
    },
    isCompleted: (project, drawings) => Challenge.elementsOf(project, drawings.apple).length === 0 && Challenge.elementsOf(project, drawings.star).length === 0,
    hint: project => Challenge.ruleCellIsEmpty(project, 6, 7) ? { cell: Point.at(6, 7), selector: 'blackHoleSymbol' } : { joystick: true },
    solution: play => { play.drop('blackHoleSymbol', 6, 7); play.right(4); play.down(1); play.left(3); },
  }),
  new Challenge({
    id: 'portal', number: 13, world: 'choques', title: 'El portal', emoji: '🌀',
    goal: 'Arrastrá «teletransportar» hasta el cuadradito, entre el personaje y la puerta',
    steps: [
      { text: 'Arrastrá «teletransportar» hasta el cuadradito, entre el personaje y la puerta', done: project => !Challenge.ruleCellIsEmpty(project, 5, 7) },
      { text: 'Entrá al portal y llegá a la estrella', done: null },
    ],
    praise: 'Personaje choca portal → el personaje aparece en la puerta. Así se cruza una pared.',
    symbols: ['teleportSymbol'], slots: [Point.at(5, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.canNotTranspassSymbol, drawings.wall], 5);
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 6);
      Challenge.rule(project, [drawings.kid, predefined.collisionSymbol, drawings.portal, predefined.pointsSymbol, drawings.kid, null, drawings.door], 7);
      for (let row = 0; row < 5; row++) Challenge.element(project, drawings.wall, 3, row);
      Challenge.element(project, drawings.kid, 0, 3);
      Challenge.element(project, drawings.portal, 2, 3);
      Challenge.element(project, drawings.door, 4, 1);
      Challenge.element(project, drawings.star, 6, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 5, 7) ? { cell: Point.at(5, 7), selector: 'teleportSymbol' } : { joystick: true },
    solution: play => { play.drop('teleportSymbol', 5, 7); play.right(2); play.down(2); play.right(2); },
  }),
  new Challenge({
    id: 'pull', number: 14, world: 'choques', title: 'Tirar', emoji: '🧲',
    goal: 'Arrastrá «tirar» hasta el cuadradito, entre el personaje y la caja',
    steps: [
      { text: 'Arrastrá «tirar» hasta el cuadradito, entre el personaje y la caja', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Llevá al personaje hasta la estrella. La caja lo sigue', done: null },
    ],
    praise: 'Personaje + tirar + caja: la caja va detrás del personaje.',
    symbols: ['pullSymbol'], slots: [Point.at(1, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 6);
      Challenge.rule(project, [drawings.kid, null, drawings.box], 7);
      Challenge.element(project, drawings.box, 0, 3);
      Challenge.element(project, drawings.kid, 1, 3);
      Challenge.element(project, drawings.star, 5, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star) && Challenge.positionsOf(project, drawings.box).some(position => position.x === 4),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 7) ? { cell: Point.at(1, 7), selector: 'pullSymbol' } : { joystick: true },
    solution: play => { play.drop('pullSymbol', 1, 7); play.right(4); },
  }),
  new Challenge({
    id: 'nobody-passes', number: 15, world: 'choques', title: 'Nadie pasa', emoji: '🚧',
    goal: 'Arrastrá «todos» hasta el cuadradito, antes de «no pasa»',
    steps: [
      { text: 'Arrastrá «todos» hasta el cuadradito, antes de «no pasa»', done: project => !Challenge.ruleCellIsEmpty(project, 0, 7) },
      { text: 'Llevá al personaje hasta la estrella. El fantasma no pasa', done: null },
    ],
    praise: '«Todos» vale por cualquier ficha: nadie pasa la pared, ni el fantasma ni vos.',
    symbols: ['jokerWithBalls'], slots: [Point.at(0, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.ghost, predefined.runSymbol, drawings.kid], 5);
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 6);
      Challenge.rule(project, [null, predefined.canNotTranspassSymbol, drawings.wall], 7);
      for (let row = 0; row < 5; row++) Challenge.element(project, drawings.wall, 3, row);
      Challenge.element(project, drawings.ghost, 0, 2);
      Challenge.element(project, drawings.kid, 5, 4);
      Challenge.element(project, drawings.star, 5, 0);
    },
    isCompleted: (project, drawings) => !Challenge.ruleCellIsEmpty(project, 0, 7) && Challenge.anyOnTopOf(project, drawings.kid, drawings.star) && Challenge.positionsOf(project, drawings.ghost).every(position => position.x <= 2),
    hint: project => Challenge.ruleCellIsEmpty(project, 0, 7) ? { cell: Point.at(0, 7), selector: 'jokerWithBalls' } : { joystick: true },
    solution: play => { play.drop('jokerWithBalls', 0, 7); play.up(4); play.steps(6); },
  }),

  // ---------- Mundo 3: Categorías ----------
  new Challenge({
    id: 'food', number: 16, world: 'categorias', title: 'Todo es comida', emoji: '🍽️',
    goal: 'Arrastrá «es un» hasta el cuadradito, entre el pescado y la comida',
    steps: [
      { text: 'Arrastrá «es un» hasta el cuadradito, entre el pescado y la comida', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Ahora comé todo', done: null },
    ],
    praise: 'Manzana es comida, pescado es comida: una sola regla come las dos. Eso es una categoría.',
    symbols: ['categorizeSymbol'], slots: [Point.at(1, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 4);
      Challenge.rule(project, [drawings.kid, predefined.collisionSymbol, drawings.food, predefined.pointsSymbol, drawings.food, predefined.teleportSymbol, predefined.blackHoleSymbol], 5);
      Challenge.rule(project, [drawings.apple, predefined.categorizeSymbol, drawings.food], 6);
      Challenge.rule(project, [drawings.fish, null, drawings.food], 7);
      Challenge.element(project, drawings.kid, 0, 1);
      Challenge.element(project, drawings.apple, 2, 1);
      Challenge.element(project, drawings.fish, 4, 1);
      Challenge.element(project, drawings.fish, 4, 3);
    },
    isCompleted: (project, drawings) => Challenge.elementsOf(project, drawings.apple).length === 0 && Challenge.elementsOf(project, drawings.fish).length === 0,
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 7) ? { cell: Point.at(1, 7), selector: 'categorizeSymbol' } : { joystick: true },
    solution: play => { play.drop('categorizeSymbol', 1, 7); play.right(4); play.down(2); },
  }),
  new Challenge({
    id: 'one-rule', number: 17, world: 'categorias', title: 'Una regla para todo', emoji: '🥚',
    goal: 'Arrastrá «comida» hasta los dos cuadraditos de la regla',
    steps: [
      { text: 'Arrastrá «comida» hasta los dos cuadraditos de la regla', done: project => !Challenge.ruleCellIsEmpty(project, 2, 7) && !Challenge.ruleCellIsEmpty(project, 4, 7) },
      { text: 'Ahora comé todo', done: null },
    ],
    praise: 'Tres cosas distintas, una sola regla: la regla habla de la categoría, no de cada cosa.',
    symbols: [], slots: [Point.at(2, 7), Point.at(4, 7)],
    build(project, drawings, predefined) {
      project.receiveDrawnSymbol(drawings.food);
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 3);
      Challenge.rule(project, [drawings.apple, predefined.categorizeSymbol, drawings.food], 4);
      Challenge.rule(project, [drawings.fish, predefined.categorizeSymbol, drawings.food], 5);
      Challenge.rule(project, [drawings.egg, predefined.categorizeSymbol, drawings.food], 6);
      Challenge.rule(project, [drawings.kid, predefined.collisionSymbol, null, predefined.pointsSymbol, null, predefined.teleportSymbol, predefined.blackHoleSymbol], 7);
      Challenge.element(project, drawings.kid, 0, 1);
      Challenge.element(project, drawings.apple, 2, 1);
      Challenge.element(project, drawings.fish, 4, 1);
      Challenge.element(project, drawings.egg, 6, 1);
    },
    isCompleted: (project, drawings) => ['apple', 'fish', 'egg'].every(name => Challenge.elementsOf(project, drawings[name]).length === 0),
    hint: (project, drawings) => Challenge.ruleCellIsEmpty(project, 2, 7) ? { cell: Point.at(2, 7), drawing: drawings.food } : Challenge.ruleCellIsEmpty(project, 4, 7) ? { cell: Point.at(4, 7), drawing: drawings.food } : { joystick: true },
    solution: play => { play.dropDrawing('food', 2, 7); play.dropDrawing('food', 4, 7); play.right(6); },
  }),

  // ---------- Mundo 4: Sustitución ----------
  new Challenge({
    id: 'day-night', number: 18, world: 'sustitucion', title: 'Día y noche', emoji: '🌙',
    goal: 'Arrastrá la flecha hasta el cuadradito, entre el sol y la luna',
    steps: [
      { text: 'Arrastrá la flecha hasta el cuadradito, entre el sol y la luna', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Ahora poné los ojos al lado del sol de arriba', done: null },
    ],
    praise: 'Sol → luna: el sol se convierte en luna. Eso es una sustitución.',
    symbols: ['pointsSymbol', 'replSymbol'], slots: [Point.at(1, 7), Point.at(1, 3)],
    build(project, drawings) {
      Challenge.symbol(project, drawings.sun, 0, 3);
      Challenge.rule(project, [drawings.sun, null, drawings.moon], 7);
    },
    isCompleted: (project, drawings) => project.boardModel.symbolsInPosition(Point.at(2, 3)).some(item => item.visualSymbolAssociated.equals(drawings.moon)),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 7) ? { cell: Point.at(1, 7), selector: 'pointsSymbol' } : { cell: Point.at(1, 3), selector: 'replSymbol' },
    solution: play => { play.drop('pointsSymbol', 1, 7); play.drop('replSymbol', 1, 3); },
  }),
  new Challenge({
    id: 'chain', number: 19, world: 'sustitucion', title: 'En cadena', emoji: '⛓️',
    goal: 'Arrastrá la flecha hasta el cuadradito, entre la luna y la estrella',
    steps: [
      { text: 'Arrastrá la flecha hasta el cuadradito, entre la luna y la estrella', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Ahora poné los ojos al lado del sol de arriba', done: null },
    ],
    praise: 'Sol → luna → estrella: las sustituciones se encadenan hasta el final.',
    symbols: ['pointsSymbol', 'replSymbol'], slots: [Point.at(1, 7), Point.at(1, 3)],
    build(project, drawings, predefined) {
      Challenge.symbol(project, drawings.sun, 0, 3);
      Challenge.rule(project, [drawings.sun, predefined.pointsSymbol, drawings.moon], 6);
      Challenge.rule(project, [drawings.moon, null, drawings.star], 7);
    },
    isCompleted: (project, drawings) => project.boardModel.symbolsInPosition(Point.at(2, 3)).some(item => item.visualSymbolAssociated.equals(drawings.star)),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 7) ? { cell: Point.at(1, 7), selector: 'pointsSymbol' } : { cell: Point.at(1, 3), selector: 'replSymbol' },
    solution: play => { play.drop('pointsSymbol', 1, 7); play.drop('replSymbol', 1, 3); },
  }),
  new Challenge({
    id: 'fire', number: 20, world: 'sustitucion', title: 'Disparar', emoji: '🚀',
    goal: 'Arrastrá «teletransportar» hasta el cuadradito, entre el fuego y la nave',
    steps: [
      { text: 'Arrastrá «teletransportar» hasta el cuadradito, entre el fuego y la nave', done: project => !Challenge.ruleCellIsEmpty(project, 3, 7) },
      { text: 'Tocá la barra de espacio', done: null },
    ],
    praise: 'Barra de espacio → el fuego aparece en la nave. Una regla que se dispara con una tecla.',
    symbols: ['teleportSymbol'], slots: [Point.at(3, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.ship, predefined.arrowKeysSymbol], 6);
      Challenge.rule(project, [predefined.spaceBarSymbol, predefined.pointsSymbol, drawings.bullet, null, drawings.ship], 7);
      Challenge.element(project, drawings.ship, 1, 4);
      Challenge.element(project, drawings.ghost, 5, 1);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.bullet, drawings.ship),
    hint: project => Challenge.ruleCellIsEmpty(project, 3, 7) ? { cell: Point.at(3, 7), selector: 'teleportSymbol' } : { space: true },
    solution: play => { play.drop('teleportSymbol', 3, 7); play.space(); },
  }),
];
