import { Drawing } from './metamodel/Drawing.js';
import { StateOfArtBuilderForVisualEnvironment, PREDEFINED_SYMBOLS } from './metamodel/StateOfArtBuilderForVisualEnvironment.js';
import { LanguageProvider } from './io/LanguageProvider.js';
import { WelcomeSpaceLoader } from './io/WelcomeSpaceLoader.js';
import { RepresentarApp } from './environment/RepresentarApp.js';
import { ProjectLibrary } from './environment/ProjectLibrary.js';
import { imageUrl, dictionaryUrl, projectUrl } from './io/Assets.js';

const DICTIONARY_FILES = ['1.espanol.txt', '2.english.txt', '3.francais.txt', '4.deutsch.txt', '5.portugues.txt', '6.italiano.txt',
  '7.Mandarin.Pinyin.txt', '8.Hindi.Romanized.txt', '9.Japan.Romanji.txt', '10.arab.txt'];

function loadImage(url) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('Could not load ' + url));
    image.src = url;
  });
}

export async function loadPredefinedImages() {
  await Promise.all(Object.entries(PREDEFINED_SYMBOLS).map(async ([selector, spec]) => {
    const image = await loadImage(imageUrl(spec.file));
    StateOfArtBuilderForVisualEnvironment.setDrawingOfPredefined(selector,
      new Drawing({ hash: selector, image, width: image.width, height: image.height }));
  }));
}

async function loadDictionary(file) {
  const response = await fetch(dictionaryUrl(file));
  const bytes = new Uint8Array(await response.arrayBuffer());
  let text;
  try { text = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (error) { text = new TextDecoder('latin1').decode(bytes); }
  return LanguageProvider.fromText(text);
}

async function loadDictionaries() {
  const dictionaries = [];
  for (const file of DICTIONARY_FILES) {
    try { dictionaries.push(await loadDictionary(file)); } catch (error) { /* diccionario ausente */ }
  }
  return dictionaries;
}

async function loadBundledProjectsIndex() {
  try {
    const response = await fetch(projectUrl('index.json'));
    return await response.json();
  } catch (error) {
    return [];
  }
}

export async function start(root) {
  const [dictionaries, bundledProjects] = await Promise.all([loadDictionaries(), loadBundledProjectsIndex(), loadPredefinedImages()]);
  let storage = null;
  try { storage = window.localStorage; } catch (error) { /* sin storage */ }
  // ?reset=1: empezar de cero con el mismo link (sin incógnito ni borrar caché); el parámetro se saca de la URL.
  if (new URLSearchParams(window.location.search).has('reset')) {
    try { for (const key of Object.keys(storage || {})) if (key.startsWith('representar.')) storage.removeItem(key); } catch (error) { /* sin storage */ }
    try { window.history.replaceState(null, '', window.location.pathname); } catch (error) { /* sin history */ }
  }
  let preferred = null;
  try { preferred = storage === null ? null : storage.getItem('representar.language'); } catch (error) { /* sin storage */ }
  // Inglés por defecto; el chico (o el docente) puede cambiarlo y queda guardado.
  const current = dictionaries.find(each => each.name === preferred) || dictionaries.find(each => /english/i.test(each.name)) || dictionaries[0];
  if (current) LanguageProvider.setCurrent(current);
  const loader = await WelcomeSpaceLoader.open().catch(() => new WelcomeSpaceLoader(null));
  const library = new ProjectLibrary({ loader, bundledProjects });
  const app = new RepresentarApp(root, { library, languages: dictionaries, storage });
  window.app = app;
  window.representar = app.environment;
  await library.loadFromFiles();
  const requested = new URLSearchParams(window.location.search).get('project');
  if (requested) {
    const entry = library.entryWithId('bundled:' + requested) || library.entryNamed(requested);
    if (entry) await app.openEntry(entry);
  } else {
    app.start();                       // la primera vez, directo al primer desafío
  }
  return app;
}
