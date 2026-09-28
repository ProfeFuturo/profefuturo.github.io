// Dónde están las imágenes, los diccionarios y los proyectos incluidos, resuelto desde este
// módulo para que funcione igual desde index.html y desde test/index.html.
// En el navegador, `import.meta.url` no existe cuando el código viene empaquetado en un solo
// archivo: ahí las imágenes cuelgan de la página (assets/ al lado de index.html).
const BASE = typeof import.meta !== 'undefined' && import.meta.url ? import.meta.url : (typeof document !== 'undefined' ? document.baseURI : 'file:///');
const ASSETS = new URL(typeof import.meta !== 'undefined' && import.meta.url ? '../../assets/' : 'assets/', BASE);

export function imageUrl(file) { return new URL('img/' + file, ASSETS).href; }
export function dictionaryUrl(file) { return new URL('dictionaries/' + file, ASSETS).href; }
export function projectUrl(file) { return new URL('projects/' + file, ASSETS).href; }
