// Dónde están las imágenes, los diccionarios y los proyectos incluidos, resuelto desde este
// módulo para que funcione igual desde index.html y desde test/index.html.
const ASSETS = new URL('../../assets/', import.meta.url);

export function imageUrl(file) { return new URL('img/' + file, ASSETS).href; }
export function dictionaryUrl(file) { return new URL('dictionaries/' + file, ASSETS).href; }
export function projectUrl(file) { return new URL('projects/' + file, ASSETS).href; }
