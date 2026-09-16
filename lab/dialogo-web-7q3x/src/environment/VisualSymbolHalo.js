import { Halo, HaloSpec } from './Halo.js';
import { dictionaryAt } from '../io/LanguageProvider.js';

// El halo de un símbolo de la paleta (dibujos y comodines), como en Cuis:
// modificar, editar una copia, eliminar / ocultar los de su clase, compartir al reusar.
export class VisualSymbolHalo extends Halo {
  constructor(symbol, environment, bounds) {
    super(symbol, {
      name: 'symbol-halo',
      bounds,
      specifications: () => VisualSymbolHalo.specificationsFor(symbol, environment),
    });
  }

  static specificationsFor(symbol, environment) {
    const project = environment.currentProject;
    const board = project.boardModel;
    if (symbol.isPluralJoker()) {
      return [new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'center', color: board.isEverythingVisible() ? 'green' : 'red', iconSymbol: 'eyeIcon',
        hoverHelp: dictionaryAt('MakeEverythingVisible'), action: () => board.showAllItems() })];
    }
    if (symbol.isSingularJoker()) {
      return [board.isEverySymbolVisible()
        ? new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'center', color: 'green', iconSymbol: 'eyeIcon', hoverHelp: dictionaryAt('HideAllSymbols'), action: () => board.hideAllSymbols() })
        : new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'center', color: 'red', iconSymbol: 'eyeIcon', hoverHelp: dictionaryAt('ShowAllSymbols'), action: () => board.showAllSymbols() })];
    }
    if (!symbol.isUserDrawing()) return [];
    const specs = [
      new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'topCenter', color: 'lightblue', iconSymbol: 'drawIcon', hoverHelp: dictionaryAt('Modify'), closesHalo: true,
        action: () => environment.modifyDrawing(symbol) }),
      new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'bottomCenter', color: '#ffd9a0', iconSymbol: 'haloDuplicateIcon', hoverHelp: dictionaryAt('EditACopy'), closesHalo: true,
        action: () => environment.paintNewSymbol(symbol.drawing) }),
    ];
    if (board.includesOnBoard(symbol)) {
      const hidden = board.isHiddenAnyElementRepresentedBy(symbol);
      specs.push(new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'topCenter', color: hidden ? 'red' : 'green', iconSymbol: 'eyeIcon',
        hoverHelp: dictionaryAt(hidden ? 'ShowAllElementsOfThisKind' : 'HideAllElementsOfThisKind'),
        action: () => hidden ? board.showRepresentedBy(symbol) : board.hideRepresentedBy(symbol) }));
    } else {
      specs.push(new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'topCenter', color: 'red', iconSymbol: 'haloDismissIcon', hoverHelp: dictionaryAt('Remove'), closesHalo: true,
        action: () => { project.ifNotOnBoardRemovePaintedSymbol(symbol); environment.tray.rebuild(); environment.markDirty(); } }));
    }
    specs.push(new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'bottomCenter', color: project.isPublic(symbol) ? 'green' : 'red', iconSymbol: 'reuseIcon',
      hoverHelp: dictionaryAt(project.isPublic(symbol) ? 'PublicWhenShareing' : 'PrivateWhenShareing'),
      action: () => { project.invertSharingOfSymbol(symbol); environment.tray.rebuild(); environment.markDirty(); } }));
    return specs;
  }
}
