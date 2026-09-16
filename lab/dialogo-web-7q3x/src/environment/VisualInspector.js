import { SymbolPainter } from './SymbolPainter.js';
import { isVisualSymbol } from '../metamodel/Terms.js';

const SYMBOL_SIZE = 40;
const LIMIT_OF_SUBSTITUTIONS = 30;

// El inspector de la ejecución, todo con dibujos (como VisualInspector + VisualHighlighter
// en Cuis): por cada paso, la oración evaluada (sólo símbolos) con la parte sustituida
// resaltada en naranja y, a la derecha, la definición visual de la relación aplicada.
// A diferencia de Cuis, no pausa la simulación.
export class VisualInspector {
  constructor(container, environment) {
    this.container = container;
    this.environment = environment;
  }

  show(monitor, project) {
    this.container.innerHTML = '';
    this.container.hidden = false;
    const steps = monitor.substitutionsToBrowse().slice(0, LIMIT_OF_SUBSTITUTIONS);
    if (steps.length > 0) this.markInspectedElements(steps[0].sentenceEvaluated(), project);
    for (const step of steps) this.container.appendChild(this.lineFor(step, project));
  }

  hide(project) {
    this.container.hidden = true;
    this.container.innerHTML = '';
    if (project) project.boardModel.removeErrorPaintOnItems();
  }

  isShowing() { return !this.container.hidden; }

  lineFor(step, project) {
    const line = document.createElement('div');
    line.className = 'inspector-step';
    const sentence = document.createElement('div');
    sentence.className = 'inspector-sentence';
    const start = step.startPositionOfSubsentence();
    const end = step.endPositionOfSubsentence();
    step.sentenceEvaluated().forEach((term, index) => {
      if (!isVisualSymbol(term)) return;
      const thumbnail = SymbolPainter.thumbnail(term, SYMBOL_SIZE, { framed: true });
      if (!step.isNullSubstitution() && index >= start && index <= end) thumbnail.classList.add('substituted');
      sentence.appendChild(thumbnail);
    });
    line.appendChild(sentence);
    const definition = document.createElement('div');
    definition.className = 'inspector-definition';
    const relation = step.relationApplied;
    for (const term of relation.visualDefinition(project.interpreter.currentStateOfArt, step.subsentenceEvaluated)) {
      const thumbnail = SymbolPainter.thumbnail(term, SYMBOL_SIZE, { framed: true });
      if (relation.inspectPointOn()) thumbnail.classList.add('inspect-point');
      definition.appendChild(thumbnail);
    }
    line.appendChild(definition);
    return line;
  }

  markInspectedElements(sentence, project) {
    for (const term of sentence) {
      if (isVisualSymbol(term) && term.itemOnBoardReferenced !== null && project.boardModel.itemPositions.has(term.itemOnBoardReferenced)) {
        term.itemOnBoardReferenced.markInspected();
      }
    }
  }
}
