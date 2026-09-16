import { Halo, HaloSpec } from './Halo.js';
import { dictionaryAt } from '../io/LanguageProvider.js';

// El halo de un ítem del tablero: las mismas acciones que en Cuis, según la clase del ítem
// y su estado (símbolo/elemento, visible, botón, redimensionado, sentido de la celda...).
// El orden de las acciones es el orden en la barra.
export class ItemHalo extends Halo {
  constructor(item, boardView) {
    super(item, {
      name: 'item-halo',
      bounds: () => boardView.pageBoundsOf(item),
      specifications: () => ItemHalo.specificationsFor(item, boardView),
      onClosed: () => { if (boardView.halo === this) boardView.halo = null; },
    });
    this.boardView = boardView;
  }

  static specificationsFor(item, boardView) {
    const board = item.boardModel;
    const specs = [];
    const removeSpec = new HaloSpec({ horizontalPlacement: 'leftCenter', verticalPlacement: 'topCenter', color: 'red', iconSymbol: 'haloDismissIcon',
      hoverHelp: dictionaryAt('Remove'), closesHalo: true, action: () => { board.removeItemReevaluatingIfNeeded(item); board.recordCurrentBoard(); } });
    const visibilitySpec = new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'topCenter', color: item.isVisible() ? 'green' : 'red',
      iconSymbol: 'eyeIcon', hoverHelp: dictionaryAt(item.isVisible() ? 'Hide' : 'Show'), action: () => item.invertVisibility() });
    const switchSpec = new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'center', color: item.consideredElement() ? 'black' : 'white',
      iconSymbol: 'haloDragIcon', hoverHelp: dictionaryAt(item.consideredElement() ? 'becameSymbol' : 'becameElement'),
      action: () => item.invertSymbolicStateIfCanBeElement() });
    const inspectSpec = new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'bottomCenter', color: 'green', iconSymbol: 'haloDebugIcon',
      hoverHelp: dictionaryAt('inspectExecution'), closesHalo: true,
      action: () => item.isREPL() ? item.inspectSubstitutions() : item.browseErrorOnSentenceThatFailed() });

    if (item.isDrawing()) {
      const elementNotButton = item.consideredElement() && !item.isButton();
      if (elementNotButton) {
        if (!item.isResized()) specs.push(switchSpec);
        specs.push(removeSpec, visibilitySpec, ItemHalo.resizeSpec(item, boardView),
          new HaloSpec({ horizontalPlacement: 'leftCenter', verticalPlacement: 'bottomCenter', color: 'blue', iconSymbol: 'haloArrowDown',
            hoverHelp: dictionaryAt('Abajo'), action: () => board.sendToBack(item) }));
      } else {
        specs.push(switchSpec, removeSpec, visibilitySpec,
          new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'bottomCenter', color: item.isButton() ? 'red' : 'green', iconSymbol: 'haloBecameButton',
            hoverHelp: dictionaryAt('BecameButton'), action: () => item.invertBecameButton() }));
      }
      if (item.hasErrorHighlight()) specs.push(new HaloSpec({ ...inspectSpec, horizontalPlacement: 'center', verticalPlacement: 'bottomCenter' }));
      return specs;
    }
    if (item.isREPL()) {
      specs.push(removeSpec, visibilitySpec, switchSpec, inspectSpec);
      if (item.consideredElement()) {
        specs.push(item.hasExpectedResult()
          ? new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'bottomCenter', color: 'yellow', iconSymbol: 'haloUnlockIcon',
            hoverHelp: dictionaryAt('resetHavingExpectedResult'), action: () => item.resetHavingExpectedResult() })
          : new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'bottomCenter', color: 'yellow', iconSymbol: 'haloLockIcon',
            hoverHelp: dictionaryAt('setThisResultAsExpected'), action: () => item.setResultAsExpected() }));
      }
      return specs;
    }
    specs.push(removeSpec, visibilitySpec);
    if (item.isRun()) {
      specs.push(new HaloSpec({ horizontalPlacement: 'leftCenter', verticalPlacement: 'bottomCenter', color: 'green', iconSymbol: 'haloSlowDown', hoverHelp: dictionaryAt('slowDown2'), action: () => item.slowDownMore() }),
        new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'bottomCenter', color: 'green', iconSymbol: 'haloSpeedUp', hoverHelp: dictionaryAt('speedUp2'), action: () => item.speedUp() }));
    }
    if (item.isTeleport()) {
      specs.push(new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'bottomCenter', color: item.hasGlobalScope() ? 'green' : 'gray', iconSymbol: 'haloAllDirections', hoverHelp: dictionaryAt('Alcance'), action: () => item.changeScope() }));
    }
    if (item.isAdjacentCell()) {
      if (item.isPointingOneDirection()) {
        specs.push(new HaloSpec({ horizontalPlacement: 'leftCenter', verticalPlacement: 'center', color: 'green', iconSymbol: 'haloCounterClockwise', hoverHelp: dictionaryAt('changeDirection'), action: () => item.counterClockWiseDirection() }),
          new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'center', color: 'green', iconSymbol: 'haloClockwise', hoverHelp: dictionaryAt('changeDirection'), action: () => item.clockWiseDirection() }));
      }
      specs.push(new HaloSpec({ horizontalPlacement: 'leftCenter', verticalPlacement: 'bottomCenter', color: 'rgba(255, 255, 0, 0.6)', iconSymbol: 'haloAllDirections', hoverHelp: dictionaryAt('AllDirections'), action: () => item.referenceAllDirectionsHaloClick() }),
        new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'bottomCenter', color: 'yellow', iconSymbol: item.isPointingNoDirection() ? 'haloArrowUp' : 'haloNoDirection',
          hoverHelp: dictionaryAt(item.isPointingNoDirection() ? 'PointToADirection' : 'Nowhere'), action: () => item.referenceNoDirectionHaloClick() }));
    }
    if (typeof item.becameDoubleJoker === 'function') {
      specs.push(item.isSingleJoker()
        ? new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'bottomCenter', color: 'green', iconSymbol: 'haloTwoHeads', hoverHelp: dictionaryAt('becameCategoryOfPairsOfTheSame'), action: () => item.becameDoubleJoker() })
        : new HaloSpec({ horizontalPlacement: 'center', verticalPlacement: 'bottomCenter', color: 'green', iconSymbol: 'haloOneHead', hoverHelp: dictionaryAt('becameCategoryOfEverySymbol'), action: () => item.becameSimpleJoker() }));
    }
    if (item.isPoints()) {
      specs.push(new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'bottomCenter', color: item.inspectPointIsOn ? 'red' : 'green', iconSymbol: 'haloDebugIcon',
        hoverHelp: dictionaryAt(item.inspectPointIsOn ? 'InspectingWhenApplied' : 'inspectExecutionWhenApplied'), action: () => item.invertInspectPointState() }));
    }
    if (item.hasErrorHighlight()) specs.push(new HaloSpec({ ...inspectSpec, horizontalPlacement: 'center', verticalPlacement: 'bottomCenter' }));
    return specs;
  }

  // Agrandar: tocar pasa por 1, 2 y 3 celdas; arrastrar (con mouse) elige el tamaño.
  static resizeSpec(item, boardView) {
    return new HaloSpec({ horizontalPlacement: 'rightCenter', verticalPlacement: 'bottomCenter', color: 'yellow', iconSymbol: 'haloResizeIcon', hoverHelp: dictionaryAt('Resize'),
      tap: () => item.boardModel.resizeTo(item, item.gridResizeFactor() >= 3 ? 1 : item.gridResizeFactor() + 1),
      drag: {
        moved: (clientX, clientY) => {
          const bounds = boardView.pageBoundsOf(item);
          if (bounds === null) return;
          const gridSize = item.boardModel.gridSize;
          const factor = Math.max(1, Math.round(Math.max(clientX - bounds.left, clientY - bounds.top) / gridSize));
          if (factor !== item.gridResizeFactor()) item.boardModel.resizeWithoutRecordingTo(item, factor);
        },
        finished: () => { if (!item.boardModel.lastRecordedStateEqualsCurrentState()) item.boardModel.recordCurrentBoard(); },
      } });
  }
}
