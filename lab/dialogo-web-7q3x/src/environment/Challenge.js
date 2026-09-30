import { Point } from '../board/Point.js';
import { VisualProject } from './VisualProject.js';
import { ChallengeDrawings } from './ChallengeDrawings.js';
import { Texts } from './Texts.js';

export const COLUMNS = 7;
const ROWS = 8;

// Un desafío de la escalera (ver docs/desafios.md): arma un tablero chico con la regla casi
// hecha, dice qué símbolos van en la bandeja, sabe cuándo se logró la meta y qué pista dar.
export class Challenge {
  constructor({ id, number, world = 'primeros', title, mission = '', goal, steps = null, praise = '', emoji, symbols, pencil = false, slots = [], build, isCompleted, hint = () => null, solution = null, columns = COLUMNS, rows = ROWS, kind = 'challenge' }) {
    this.kind = kind;                   // 'challenge' (la escalera) o 'build' (armar un juego del curso, con toda la bandeja)
    this.columns = columns;
    this.rows = rows;
    this.id = id;
    this.number = number;
    // Los textos viven en texts/<idioma>.js, por id de desafío.
    this.emoji = emoji;
    this.symbols = symbols;             // selectores de predefinidos disponibles en la bandeja
    this.pencil = pencil;               // si la bandeja muestra el lápiz
    this.slots = slots;                 // celdas vacías de la regla que hay que completar
    // La consigna, de a un paso; el último es lograr el desafío. El texto se busca en texts/ cada
    // vez que se lee (con `stepText`): así cambiar de idioma cambia también las consignas.
    this.steps = (steps || [{ text: goal, done: null }]).map(step => ({ done: step.done }));
    this.world = world;                 // el mundo (capítulo) al que pertenece
    this.solution = solution;           // cómo se resuelve, para los tests: (play) → void
    this.build = build;                 // (project, drawings, predefined, userDrawings) → void
    this.isCompleted = isCompleted;     // (project, drawings) → boolean
    this.hintFor = hint;                // (project, drawings) → { cell, selector, drawing } | null
  }

  // Un proyecto nuevo con este desafío armado. Los dibujos se crean para cada proyecto.
  projectFor({ gridSize = 52, random = Math.random, userDrawings = [] } = {}) {
    const project = new VisualProject({ name: this.title, gridSize, columns: this.columns, rows: this.rows, random }).connect();
    const drawings = ChallengeDrawings.all();
    project.challenge = this;
    project.challengeDrawings = drawings;
    project.availableSymbols = this.symbols;
    this.build(project, drawings, Challenge.predefinedOf(project), userDrawings);
    if (this.kind === 'challenge') for (const item of project.boardModel.items()) item.locked = true;   // lo que viene armado no se toca
    project.boardModel.lockArea();
    project.boardModel.evaluateAllExpressionsAndReprintREPLSInformingUsers();
    project.boardModel.recordCurrentBoard();
    project.boardModel.setCurrentAsResetBoard();
    project.boardModel.forgetUndoHistory();      // deshacer nunca vuelve más atrás que el inicio del desafío
    return project;
  }

  static predefinedOf(project) {
    const predefined = {};
    for (const symbol of project.predefinedSymbols) predefined[symbol.buildingSelector] = symbol;
    return predefined;
  }

  get title() { return Texts.challenge(this.id, 'title'); }
  // Lo primero que se lee: qué queremos lograr. El paso (cómo) va debajo, secundario.
  get mission() { return Texts.challenge(this.id, 'mission') || this.goal; }
  get praise() { return Texts.challenge(this.id, 'praise'); }
  get goal() { return this.stepText(0); }

  stepText(index) { return Texts.challenge(this.id, 'steps', index); }

  completedIn(project) { return this.isCompleted(project, project.challengeDrawings); }

  // La consigna de este momento: el primer paso que falta (el último es lograr el desafío).
  goalIn(project) {
    for (let index = 0; index < this.steps.length; index++) {
      const step = this.steps[index];
      if (step.done !== null && !step.done(project)) return this.stepText(index);
    }
    return this.stepText(this.steps.length - 1);
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

  // Las reglas del tablero como listas de símbolos (para ver si el chico armó la que se pide).
  static rulesOf(project) {
    return project.boardModel.consecutiveSymbolicSequences().map(sequence => sequence.symbolSequence());
  }

  static hasRule(project, matches) { return Challenge.rulesOf(project).some(rule => matches(rule)); }

  static userDrawing(project, index) { return project.drawingsMadeByUser()[index] || null; }
}

// Los mundos: capítulos de la escalera, cada uno alrededor de una idea del lenguaje.
class World {
  constructor(id, emoji) { this.id = id; this.emoji = emoji; }
  get title() { return Texts.at('world.' + this.id); }
}

export const WORLDS = [
  new World('primeros', '🚀'),
  new World('choques', '💥'),
  new World('categorias', '🏷️'),
  new World('sustitucion', '🔁'),
  new World('metaprogramacion', '🧠'),
  new World('naves', '🚀'),
  new World('numeros', '🔢'),
  new World('puntos', '🏆'),
];


// La escalera. Cada desafío entra en 7 × 8 celdas; la regla va abajo, el juego arriba.
export class Challenges {
  static all() { return LADDER; }
  static worlds() { return WORLDS; }
  static isBuild(challenge) { return challenge.kind === 'build'; }
  static inWorld(worldId) { return LADDER.filter(challenge => challenge.world === worldId); }
  static worldOf(challenge) { return WORLDS.find(world => world.id === challenge.world) || WORLDS[0]; }
  static withId(id) { return LADDER.find(challenge => challenge.id === id) || null; }
  static first() { return LADDER[0]; }
  static after(challenge) { return challenge.kind === 'build' ? Builds.after(challenge) : (LADDER[challenge.number] || null); }
}

// Armar los juegos del curso, guiado paso a paso, en el editor completo (toda la bandeja y el
// lápiz). Se destraban al terminar la escalera; al terminarlos todos se destraba crear libre.
export class Builds {
  static all() { return BUILDS; }
  static withId(id) { return BUILDS.find(build => build.id === id) || null; }
  static after(build) { return BUILDS[build.number] || null; }
}

// Las reglas van abajo (filas 6 y 7), pegadas a la bandeja de donde salen las fichas; el juego
// arriba. Los "slots" son las celdas vacías de la regla que hay que completar: se ven desde el
// principio, tenues, para que la pieza tenga adónde ir.
const LADDER = [
  new Challenge({
    id: 'reach-star', number: 1, title: 'Llegá a la estrella', goal: 'Llevá al personaje hasta la estrella con las flechas', emoji: '⭐',
    mission: 'Llevá al personaje hasta la estrella.',
    praise: 'El personaje está al lado de las flechas: por eso se mueve.',
    symbols: [],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 7);
      Challenge.element(project, drawings.kid, 1, 3);
      Challenge.element(project, drawings.star, 5, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: (project, drawings) => ({ cell: Challenge.positionsOf(project, drawings.star)[0] || null, joystick: true }),
    solution: play => play.right(4),
  }),
  new Challenge({
    id: 'make-rule', number: 2, title: 'Armá la regla', goal: 'Arrastrá las flechas hasta el cuadradito, al lado del personaje', emoji: '🧩',
    mission: 'Hacé que el personaje se mueva y llegue a la estrella.',
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
    solution: play => { play.drop('arrowKeysSymbol', 1, 7); play.right(4); },
  }),
  new Challenge({
    id: 'eat-star', number: 3, title: 'Comé las estrellas', goal: 'Arrastrá el agujero negro hasta el cuadradito del final de la regla', emoji: '🕳️',
    mission: 'Que el personaje saque del tablero todas las estrellas.',
    steps: [
      { text: 'Arrastrá el agujero negro hasta el cuadradito del final de la regla', done: project => !Challenge.ruleCellIsEmpty(project, 6, 7) },
      { text: 'Ahora chocá las dos estrellas', done: null },
    ],
    praise: 'Cuando el personaje choca una estrella, la estrella se va al agujero negro: desaparece para siempre.',
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
    solution: play => { play.drop('blackHoleSymbol', 6, 7); play.right(4); play.down(1); },
  }),
  new Challenge({
    id: 'draw', number: 4, title: 'Dibujá', goal: 'Tocá el lápiz. Dibujá tu personaje', emoji: '🎨',
    mission: 'Dibujá tu propio personaje.',
    praise: 'Tu dibujo ya es un personaje. Ahora vamos a hacer que se mueva.',
    symbols: [], pencil: true,
    build() {},
    isCompleted: project => project.drawingsMadeByUser().length > 0,
    hint: () => ({ pencil: true }),
    solution: play => play.draw('heart'),
  }),
  new Challenge({
    id: 'bring-to-life', number: 5, title: 'Dale vida', goal: 'Arrastrá tu dibujo hasta el cuadradito, al lado de las flechas', emoji: '✨',
    mission: 'Dale vida a tu dibujo y llevalo hasta la estrella.',
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
    solution: play => { play.dropUserDrawing(0, 0, 7); play.right(4); },
  }),
  new Challenge({
    id: 'run', number: 6, title: 'El monstruo corre', goal: 'Arrastrá «corre hacia» hasta el cuadradito, entre el monstruo y la estrella', emoji: '🏃',
    mission: 'Que el monstruo llegue solo hasta la estrella.',
    steps: [
      { text: 'Arrastrá «corre hacia» hasta el cuadradito, entre el monstruo y la estrella', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Mirá: el monstruo corre solo', done: null },
    ],
    praise: 'Monstruo + corre hacia + estrella: el monstruo va solo hasta la estrella, sin que toques nada.',
    symbols: ['runSymbol'], slots: [Point.at(1, 7)],
    build(project, drawings) {
      Challenge.rule(project, [drawings.monster, null, drawings.star], 7);
      Challenge.element(project, drawings.monster, 0, 4);
      Challenge.element(project, drawings.star, 6, 1);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.monster, drawings.star),
    hint: () => ({ cell: Point.at(1, 7), selector: 'runSymbol' }),
    solution: play => { play.drop('runSymbol', 1, 7); play.steps(14); },
  }),
  new Challenge({
    id: 'push', number: 7, title: 'Empujá la caja', goal: 'Arrastrá «empuja» hasta el cuadradito, entre el personaje y la caja', emoji: '📦',
    mission: 'Llevá la caja hasta la estrella.',
    steps: [
      { text: 'Arrastrá «empuja» hasta el cuadradito, entre el personaje y la caja', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Ahora empujá la caja hasta la estrella', done: null },
    ],
    praise: 'Personaje + empuja + caja: cuando el personaje choca la caja, la caja se mueve.',
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
    solution: play => { play.drop('pushSymbol', 1, 7); play.right(3); },
  }),
  new Challenge({
    id: 'walls', number: 8, title: 'La pared', goal: 'Arrastrá «no puede pasar» hasta el cuadradito, entre el monstruo y la pared', emoji: '🧱',
    mission: 'Frená al monstruo con la pared para que no te alcance.',
    steps: [
      { text: 'Arrastrá «no puede pasar» hasta el cuadradito, entre el monstruo y la pared', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Mirá qué hace el monstruo', done: null },
    ],
    praise: 'Monstruo + no puede pasar + pared: el monstruo corre, pero la pared lo frena.',
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
    solution: play => { play.drop('canNotTranspassSymbol', 1, 7); play.steps(12); },
  }),
  new Challenge({
    id: 'eyes', number: 9, title: 'Los ojos', goal: 'Arrastrá los ojitos hasta el cuadradito, al lado de la estrella', emoji: '👀',
    mission: 'Mirá lo que dice una regla, sin jugar.',
    praise: 'Los ojitos muestran lo que dice la regla: acá, la estrella se hace corazón.',
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
    id: 'sun', number: 10, world: 'choques', title: 'Sale el sol', emoji: '☀️',
    mission: 'Hacé que el sol salga sobre las nubes.',
    goal: 'Arrastrá «teletransportar» hasta el cuadradito, entre el sol y la nube',
    steps: [
      { text: 'Arrastrá «teletransportar» hasta el cuadradito, entre el sol y la nube', done: project => !Challenge.ruleCellIsEmpty(project, 5, 7) },
      { text: 'Llevá la oveja hasta el pasto', done: null },
    ],
    praise: 'Cuando la oveja choca el pasto, el sol aparece en la nube. Un choque puede hacer aparecer cosas.',
    symbols: ['teleportSymbol'], slots: [Point.at(5, 7)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.sheep, predefined.arrowKeysSymbol], 6);
      Challenge.rule(project, [drawings.sheep, predefined.collisionSymbol, drawings.grass, predefined.pointsSymbol, drawings.sun, null, drawings.cloud], 7);
      Challenge.element(project, drawings.cloud, 3, 0);
      Challenge.element(project, drawings.sheep, 1, 3);
      Challenge.element(project, drawings.grass, 5, 3);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.sun, drawings.cloud),
    hint: project => Challenge.ruleCellIsEmpty(project, 5, 7) ? { cell: Point.at(5, 7), selector: 'teleportSymbol' } : { joystick: true },
    solution: play => { play.drop('teleportSymbol', 5, 7); play.right(4); },
  }),
  new Challenge({
    id: 'eat-all', number: 11, world: 'choques', title: 'Comé todo', emoji: '🍎',
    mission: 'Que el personaje saque del tablero todas las manzanas y estrellas.',
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
    id: 'portal', number: 12, world: 'choques', title: 'El portal', emoji: '🌀',
    mission: 'Cruzá la pared y llegá a la estrella.',
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
      for (let row = 0; row < 5; row++) Challenge.element(project, drawings.wall, 3, row);   // la pared que divide
      for (let column = 0; column < 3; column++) Challenge.element(project, drawings.wall, column, 4);   // y el piso: el personaje queda encerrado arriba a la izquierda
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
    id: 'pull', number: 13, world: 'choques', title: 'Tirá de la caja', emoji: '🧲',
    mission: 'Llevate la caja con vos hasta la estrella.',
    goal: 'Arrastrá «tira de» hasta el cuadradito, entre el personaje y la caja',
    steps: [
      { text: 'Arrastrá «tira de» hasta el cuadradito, entre el personaje y la caja', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Llevá al personaje hasta la estrella. La caja lo sigue', done: null },
    ],
    praise: 'Personaje + tira de + caja: la caja va detrás del personaje.',
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
    id: 'nobody-passes', number: 14, world: 'choques', title: 'Nadie pasa', emoji: '🚧',
    mission: 'Dejá al fantasma encerrado y llegá a la estrella.',
    goal: 'Arrastrá el comodín hasta el cuadradito, antes de «no puede pasar»',
    steps: [
      { text: 'Arrastrá el comodín hasta el cuadradito, antes de «no puede pasar»', done: project => !Challenge.ruleCellIsEmpty(project, 0, 7) },
      { text: 'Ahora llevá al personaje hasta la estrella', done: null },
    ],
    praise: 'El comodín vale por cualquier cosa: ni el fantasma pasa la pared. Si te toca, volvés a la puerta.',
    symbols: ['jokerWithBalls'], slots: [Point.at(0, 7)],
    // La pared cruza todo el tablero: el fantasma vive en las dos filas de arriba. Sin la regla
    // baja, se come la estrella y ya no se puede ganar: hay que poner el comodín antes de moverse.
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 4);
      Challenge.rule(project, [drawings.ghost, predefined.runSymbol, drawings.star], 5);
      Challenge.rule(project, [drawings.ghost, predefined.collisionSymbol, drawings.star, predefined.pointsSymbol, drawings.star, predefined.teleportSymbol, predefined.blackHoleSymbol], 6);
      Challenge.rule(project, [null, predefined.canNotTranspassSymbol, drawings.wall], 7);
      for (let column = 0; column < COLUMNS; column++) Challenge.element(project, drawings.wall, column, 2);
      Challenge.element(project, drawings.ghost, 3, 0);
      Challenge.element(project, drawings.kid, 0, 3);
      Challenge.element(project, drawings.star, 5, 3);
    },
    isCompleted: (project, drawings) => !Challenge.ruleCellIsEmpty(project, 0, 7) && Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 0, 7) ? { cell: Point.at(0, 7), selector: 'jokerWithBalls' } : { joystick: true },
    solution: play => { play.drop('jokerWithBalls', 0, 7); play.right(5); },
  }),

  // ---------- Mundo 3: Categorías ----------
  new Challenge({
    id: 'food', number: 15, world: 'categorias', title: 'Todo es comida', emoji: '🍽️',
    mission: 'Que el personaje coma manzanas y pescado: una dieta balanceada.',
    goal: 'Arrastrá «está dentro de» hasta el cuadradito, entre el pescado y la comida',
    steps: [
      { text: 'Arrastrá «está dentro de» hasta el cuadradito, entre el pescado y la comida', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Ahora comé todo', done: null },
    ],
    praise: 'La manzana está dentro de comida, el pescado también: una sola regla come las dos. Eso es una categoría.',
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
    id: 'one-rule', number: 16, world: 'categorias', title: 'Una regla para todo', emoji: '🥚',
    mission: 'Comé tres cosas distintas con una sola regla.',
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
    id: 'day-night', number: 17, world: 'sustitucion', title: 'Día y noche', emoji: '🌙',
    mission: 'Convertí el sol en luna.',
    goal: 'Arrastrá «se transforma en» hasta el cuadradito, entre el sol y la luna',
    steps: [
      { text: 'Arrastrá «se transforma en» hasta el cuadradito, entre el sol y la luna', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Ahora poné los ojitos al lado del sol de arriba', done: null },
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
    id: 'chain', number: 18, world: 'sustitucion', title: 'En cadena', emoji: '⛓️',
    mission: 'Convertí el sol en estrella, paso a paso.',
    goal: 'Arrastrá «se transforma en» hasta el cuadradito, entre la luna y la estrella',
    steps: [
      { text: 'Arrastrá «se transforma en» hasta el cuadradito, entre la luna y la estrella', done: project => !Challenge.ruleCellIsEmpty(project, 1, 7) },
      { text: 'Ahora poné los ojitos al lado del sol de arriba', done: null },
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

  // ---------- Mundo 5: Reglas que cambian (metaprogramación) ----------
  new Challenge({
    id: 'break-rule', number: 19, world: 'metaprogramacion', title: 'Rompé la regla', emoji: '🔨',
    mission: 'Rompé tu propia regla para cruzar la pared.',
    goal: 'Empujá «no puede pasar» para afuera de la regla',
    steps: [
      { text: 'Empujá «no puede pasar» para afuera de la regla', done: project => Challenge.ruleCellIsEmpty(project, 1, 1) },
      { text: 'Ahora atravesá la pared hasta la estrella', done: null },
    ],
    praise: 'Empujaste un pedazo de tu programa. El juego cambia sus propias reglas mientras jugás.',
    symbols: [],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.kid, predefined.canNotTranspassSymbol, drawings.wall], 1);
      Challenge.rule(project, [drawings.kid, predefined.pushSymbol, predefined.jokerHead], 6);
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 7);
      for (let row = 0; row < 5; row++) Challenge.element(project, drawings.wall, 5, row);            // la pared a cruzar
      for (let column = 0; column < 7; column++) Challenge.element(project, drawings.wall, column, 5);   // el piso: el personaje no la rodea
      Challenge.element(project, drawings.kid, 1, 2);
      Challenge.element(project, drawings.star, 6, 2);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 1) ? { joystick: true } : { cell: Point.at(1, 1), joystick: true },
    solution: play => { play.up(1); play.down(1); play.right(5); },
  }),
  new Challenge({
    id: 'rule-by-playing', number: 20, world: 'metaprogramacion', title: 'Armá la regla jugando', emoji: '🧩',
    mission: 'Armá una regla empujando sus piezas y llegá a la estrella.',
    goal: 'Empujá «tira de» hasta el cuadradito de la regla',
    steps: [
      { text: 'Empujá «tira de» hasta el cuadradito de la regla', done: project => !Challenge.ruleCellIsEmpty(project, 2, 3) },
      { text: 'Ahora llevá al personaje hasta la estrella. La caja lo sigue', done: null },
    ],
    praise: 'Armaste una regla sin la bandeja: empujando sus piezas por el tablero.',
    symbols: [], slots: [Point.at(2, 3)],
    build(project, drawings, predefined) {
      Challenge.symbol(project, predefined.pullSymbol, 2, 1);
      Challenge.rule(project, [drawings.kid, null, drawings.box], 3, 1);
      Challenge.rule(project, [drawings.kid, predefined.pushSymbol, predefined.jokerHead], 6);
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 7);
      Challenge.element(project, drawings.kid, 2, 0);
      Challenge.element(project, drawings.box, 6, 2);
      Challenge.element(project, drawings.star, 5, 2);
    },
    isCompleted: (project, drawings) => !Challenge.ruleCellIsEmpty(project, 2, 3) && Challenge.anyOnTopOf(project, drawings.kid, drawings.star),
    hint: project => Challenge.ruleCellIsEmpty(project, 2, 3) ? { cell: Point.at(2, 3), joystick: true } : { joystick: true },
    solution: play => { play.down(2); play.right(3); },
  }),

  // ---------- Mundo 6: Naves y tiempo ----------
  new Challenge({
    id: 'fire', number: 21, world: 'naves', title: 'Flechazo', emoji: '🏹',
    mission: 'Clavale un flechazo al fantasma.',
    goal: 'Arrastrá «corre hacia» hasta el cuadradito, entre la flecha y el fantasma',
    steps: [
      { text: 'Arrastrá «corre hacia» hasta el cuadradito, entre la flecha y el fantasma', done: project => !Challenge.ruleCellIsEmpty(project, 1, 6) },
      { text: 'Tocá la barra de espacio', done: null },
    ],
    praise: 'La barra hace aparecer la flecha en la nave, y la flecha corre hacia el fantasma. Dos reglas, un flechazo.',
    symbols: ['runSymbol'], slots: [Point.at(1, 6)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.ship, predefined.arrowKeysSymbol], 5);
      Challenge.rule(project, [drawings.arrow, null, drawings.ghost], 6);
      Challenge.rule(project, [predefined.spaceBarSymbol, predefined.pointsSymbol, drawings.arrow, predefined.teleportSymbol, drawings.ship], 7);
      Challenge.element(project, drawings.ship, 1, 3);
      Challenge.element(project, drawings.ghost, 5, 0);
    },
    isCompleted: (project, drawings) => Challenge.anyOnTopOf(project, drawings.arrow, drawings.ghost),
    hint: project => Challenge.ruleCellIsEmpty(project, 1, 6) ? { cell: Point.at(1, 6), selector: 'runSymbol' } : { space: true },
    solution: play => { play.drop('runSymbol', 1, 6); play.space(); play.steps(8); },
  }),
  new Challenge({
    id: 'missile', number: 22, world: 'naves', title: 'Que desaparezca', emoji: '💥',
    mission: 'Derribá al fantasma para que desaparezca.',
    goal: 'Arrastrá el agujero negro hasta el cuadradito del final de la regla de arriba',
    steps: [
      { text: 'Arrastrá el agujero negro hasta el cuadradito del final de la regla de arriba', done: project => !Challenge.ruleCellIsEmpty(project, 6, 4) },
      { text: 'Tocá la barra de espacio', done: null },
    ],
    praise: 'Una regla más: cuando la flecha choca al fantasma, el fantasma se va al agujero negro. Desaparece para siempre.',
    symbols: ['blackHoleSymbol'], slots: [Point.at(6, 4)],
    build(project, drawings, predefined) {
      Challenge.rule(project, [drawings.arrow, predefined.collisionSymbol, drawings.ghost, predefined.pointsSymbol, drawings.ghost, predefined.teleportSymbol, null], 4);
      Challenge.rule(project, [drawings.ship, predefined.arrowKeysSymbol], 5);
      Challenge.rule(project, [drawings.arrow, predefined.runSymbol, drawings.ghost], 6);
      Challenge.rule(project, [predefined.spaceBarSymbol, predefined.pointsSymbol, drawings.arrow, predefined.teleportSymbol, drawings.ship], 7);
      Challenge.element(project, drawings.ship, 1, 3);
      Challenge.element(project, drawings.ghost, 5, 0);
    },
    isCompleted: (project, drawings) => Challenge.elementsOf(project, drawings.ghost).length === 0,
    hint: project => Challenge.ruleCellIsEmpty(project, 6, 4) ? { cell: Point.at(6, 4), selector: 'blackHoleSymbol' } : { space: true },
    solution: play => { play.drop('blackHoleSymbol', 6, 4); play.space(); play.steps(10); },
  }),

  // ---------- Mundo 7: Números ----------
  new Challenge({
    id: 'next', number: 23, world: 'numeros', title: 'El siguiente', emoji: '⬆️',
    mission: 'Inventá el número 3.',
    goal: 'Poné los ojitos al lado del 2 de arriba',
    steps: [
      { text: 'Poné los ojitos al lado del 2 de arriba', done: project => !Challenge.ruleCellIsEmpty(project, 2, 3) },
      { text: 'Ahora arrastrá el 3 hasta el cuadradito: el siguiente de 2 es 3', done: null },
    ],
    praise: 'No hay números en Diálogo: los inventás vos. «Siguiente de 2 → 3» es una regla como cualquier otra.',
    symbols: ['replSymbol'], slots: [Point.at(3, 6), Point.at(2, 3)],
    build(project, drawings, predefined) {
      project.receiveDrawnSymbol(drawings.three);
      Challenge.rule(project, [drawings.next, drawings.two], 3);
      Challenge.rule(project, [drawings.next, drawings.one, predefined.pointsSymbol, drawings.two], 5);
      Challenge.rule(project, [drawings.next, drawings.two, predefined.pointsSymbol, null], 6);
    },
    isCompleted: (project, drawings) => project.boardModel.symbolsInPosition(Point.at(3, 3)).some(item => item.visualSymbolAssociated.equals(drawings.three)),
    hint: (project, drawings) => Challenge.ruleCellIsEmpty(project, 2, 3) ? { cell: Point.at(2, 3), selector: 'replSymbol' } : { cell: Point.at(3, 6), drawing: drawings.three },
    solution: play => { play.drop('replSymbol', 2, 3); play.dropDrawing('three', 3, 6); },
  }),

  // ---------- Mundo 8: Puntos ----------
  new Challenge({
    id: 'score', number: 24, world: 'puntos', title: 'Puntos', emoji: '🏆',
    mission: 'Hacé que los puntos suban cuando comés una estrella.',
    goal: 'Arrastrá «apunta a» hasta el cuadradito del final de la regla',
    steps: [
      { text: 'Arrastrá «apunta a» hasta el cuadradito del final de la regla', done: project => !Challenge.ruleCellIsEmpty(project, 6, 7) },
      { text: 'Poné los ojitos al lado de los puntos', done: project => project.boardModel.itemsInPosition(Point.at(5, 1)).length > 0 },
      { text: 'Chocá las dos estrellas y mirá los puntos', done: null },
    ],
    praise: 'Chocar no pone un número: cambia la regla «puntos → 0» por «puntos → el siguiente». Suma uno cada vez. Sin variables.',
    symbols: ['replSymbol'], slots: [Point.at(6, 7), Point.at(5, 1)],
    // «apunta a» va después del número para que el número se calcule antes de guardarse:
    // «siguiente · puntos · apunta a» → «siguiente · 0 · apunta a» → «1 · apunta a» → «puntos → 1».
    build(project, drawings, predefined) {
      project.receiveDrawnSymbol(drawings.pin);
      Challenge.element(project, drawings.kid, 0, 0);
      Challenge.element(project, drawings.star, 2, 0);
      Challenge.element(project, drawings.star, 4, 0);
      Challenge.symbol(project, drawings.cup, 4, 1);
      Challenge.rule(project, [drawings.kid, predefined.arrowKeysSymbol], 2);
      Challenge.rule(project, [drawings.cup, predefined.pointsSymbol, drawings.zero], 2, 3);
      Challenge.rule(project, [drawings.next, drawings.zero, predefined.pointsSymbol, drawings.one], 3);
      Challenge.rule(project, [drawings.next, drawings.one, predefined.pointsSymbol, drawings.two], 4);
      Challenge.rule(project, [drawings.one, drawings.pin, predefined.pointsSymbol, drawings.cup, predefined.pointsSymbol, drawings.one], 5);
      Challenge.rule(project, [drawings.two, drawings.pin, predefined.pointsSymbol, drawings.cup, predefined.pointsSymbol, drawings.two], 6);
      Challenge.rule(project, [drawings.kid, predefined.collisionSymbol, drawings.star, predefined.pointsSymbol, drawings.next, drawings.cup, null], 7);
    },
    isCompleted: (project, drawings) => project.boardModel.symbolsInPosition(Point.at(6, 1)).some(item => item.visualSymbolAssociated.equals(drawings.two)),
    hint: (project, drawings) => Challenge.ruleCellIsEmpty(project, 6, 7) ? { cell: Point.at(6, 7), drawing: drawings.pin } : Challenge.ruleCellIsEmpty(project, 5, 1) ? { cell: Point.at(5, 1), selector: 'replSymbol' } : { joystick: true },
    solution: play => { play.dropDrawing('pin', 6, 7); play.drop('replSymbol', 5, 1); play.right(4); play.steps(1); },
  }),
  new Challenge({
    id: 'add-zero', number: 25, world: 'numeros', title: 'Sumar cero', emoji: '➕',
    mission: 'Enseñale a Diálogo a sumar cero.',
    goal: 'Poné los ojitos al lado del 2 de arriba',
    steps: [
      { text: 'Poné los ojitos al lado del 2 de arriba', done: project => !Challenge.ruleCellIsEmpty(project, 3, 2) },
      { text: 'Ahora arrastrá «número» hasta el cuadradito del final de la regla', done: null },
    ],
    praise: 'Cero más un número es ese número. Con esa regla empieza la suma: es el caso base.',
    symbols: ['replSymbol'], slots: [Point.at(4, 7), Point.at(3, 2)],
    build(project, drawings, predefined) {
      project.receiveDrawnSymbol(drawings.number);
      Challenge.rule(project, [drawings.zero, drawings.plus, drawings.two], 2);
      Challenge.rule(project, [drawings.one, predefined.categorizeSymbol, drawings.number], 5);
      Challenge.rule(project, [drawings.two, predefined.categorizeSymbol, drawings.number], 6);
      Challenge.rule(project, [drawings.zero, drawings.plus, drawings.number, predefined.pointsSymbol, null], 7);
    },
    isCompleted: (project, drawings) => project.boardModel.symbolsInPosition(Point.at(4, 2)).some(item => item.visualSymbolAssociated.equals(drawings.two)),
    hint: (project, drawings) => Challenge.ruleCellIsEmpty(project, 3, 2) ? { cell: Point.at(3, 2), selector: 'replSymbol' } : { cell: Point.at(4, 7), drawing: drawings.number },
    solution: play => { play.drop('replSymbol', 3, 2); play.dropDrawing('number', 4, 7); },
  }),
];

// Los juegos del curso, en versión chica y guiada. Cada uno enseña la idea de su clase con el
// menor tablero posible; el chico dibuja sus piezas y arma las reglas con toda la bandeja.
const BUILDS = [
  new Challenge({
    id: 'build-chess', number: 17, world: 'builds', kind: 'build', columns: 8, rows: 12, emoji: '♟️',
    title: 'Ajedrez',
    goal: 'Tocá el lápiz y dibujá una pieza negra',
    steps: [
      { text: 'Tocá el lápiz y dibujá una pieza negra', done: project => project.drawingsMadeByUser().length >= 1 },
      { text: 'Ahora dibujá una pieza blanca', done: project => project.drawingsMadeByUser().length >= 2 },
      { text: 'Poné una pieza negra y una blanca en el tablero', done: project => { const [black, white] = project.drawingsMadeByUser(); return black && white && Challenge.elementsOf(project, black).length > 0 && (Challenge.elementsOf(project, white).length > 0 || Challenge.hasRule(project, rule => rule.some(symbol => symbol.buildingSelector === 'collisionSymbol'))); } },
      { text: 'Armá la regla: pieza negra · flechas', done: project => project.boardModel.itemsMovableByArrows().length > 0 },
      { text: 'Armá la regla de comer: negra · choca · blanca · se transforma en · blanca · teletransportar · agujero negro', done: project => Challenge.hasRule(project, rule => rule.length >= 7 && rule.some(symbol => symbol.buildingSelector === 'collisionSymbol') && rule.some(symbol => symbol.buildingSelector === 'blackHoleSymbol')) },
      { text: 'Comé la pieza blanca', done: null },
    ],
    praise: 'Armaste un ajedrez chiquito: tus piezas, tus reglas. El de verdad agrega categorías: «pieza negra» para todas las negras.',
    symbols: 'all', pencil: true,
    build() {},
    isCompleted: project => {
      const drawings = project.drawingsMadeByUser();
      return drawings.length >= 2 && Challenge.hasRule(project, rule => rule.some(symbol => symbol.buildingSelector === 'collisionSymbol'))
        && Challenge.elementsOf(project, drawings[0]).length > 0 && Challenge.elementsOf(project, drawings[1]).length === 0 && project.boardModel.itemsMovableByArrows().length > 0;
    },
    hint: project => project.drawingsMadeByUser().length < 2 ? { pencil: true } : project.boardModel.itemsMovableByArrows().length === 0 ? { selector: 'arrowKeysSymbol' } : { joystick: true },
    solution: play => {
      play.draw('pawn'); play.draw('rook');
      play.dropUserDrawing(0, 1, 1); play.dropUserDrawing(1, 3, 1);
      play.dropUserDrawing(0, 0, 9); play.drop('arrowKeysSymbol', 1, 9);
      play.dropUserDrawing(0, 0, 10); play.drop('collisionSymbol', 1, 10); play.dropUserDrawing(1, 2, 10); play.drop('pointsSymbol', 3, 10); play.dropUserDrawing(1, 4, 10); play.drop('teleportSymbol', 5, 10); play.drop('blackHoleSymbol', 6, 10);
      play.right(2);
    },
  }),
];

