// Las etiquetas del formato de los archivos .dialog.ar (compartidas por importer y exporter).
export const RepresentarIO = {
  currentVersion: 'Format: visual Version: 8',
  predefinedLabel: 'predefined',
  drawingLabel: 'drawing',
  symbolLabel: 'symbol',
  elementLabel: 'element',
  buttonLabel: 'button',
  dataFileName: 'data',
  reusingDataFileName: 'reusing',
  previewImageFileName: 'preview.png',
  fullBoardImageFileName: 'fullBoard.png',
  columnSeparator: ' ',
  lineSeparator: '\n',
  projectNameHeader: 'Project name: ',
  gridSizeHeader: 'Grid size when saved: ',
  listOfItemsHeader: 'List of items on board: ',
  drawingByUserHeader: 'Total drawings: ',
  privateDrawingsHeader: 'Hidden drawings for other projects that reuse this one: ',
  bulletForList: '- ',
  atSeparator: 'at',
  asSeparator: 'as',
  visibleProperty: 'visible',
  notValue: 'not',
  slowDownProperty: 'slowedDownBy',
  globalScopeProperty: 'globalScope',
  biggerSizeProperty: 'biggerSizeBy',
  movingDirectionProperty: 'movingDirection',
  pointingProperty: 'pointingTowards',
  allAround: 'all-arround',
  nowhere: 'nowhere',
};

// 1 → '1st', 2 → '2nd', 11 → '11th' (igual que en Smalltalk, incluso para 111).
export function ordinalOf(index) {
  const text = String(index);
  if (index >= 11 && index <= 13) return text + 'th';
  const last = text[text.length - 1];
  if (last === '1') return text + 'st';
  if (last === '2') return text + 'nd';
  if (last === '3') return text + 'rd';
  return text + 'th';
}

// '(152/5)' → 30.4 ; '68' → 68
export function numberFromSmalltalk(text) {
  const fraction = text.match(/^\(?\s*(-?\d+)\s*\/\s*(-?\d+)\s*\)?$/);
  if (fraction) return Number(fraction[1]) / Number(fraction[2]);
  return Number(text);
}
