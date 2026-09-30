import { LanguageProvider } from '../io/LanguageProvider.js';
import { en } from './texts/en.js';
import { es } from './texts/es.js';
import { fr } from './texts/fr.js';
import { de } from './texts/de.js';
import { pt } from './texts/pt.js';
import { it } from './texts/it.js';
import { zh } from './texts/zh.js';
import { hi } from './texts/hi.js';
import { ja } from './texts/ja.js';
import { ar } from './texts/ar.js';

// Los textos del tutorial, un archivo por idioma en texts/. El idioma sale del diccionario
// elegido (LanguageProvider); lo que falte en un idioma cae en inglés. Criterio de escritura:
// docs/textos.md (un verbo por frase, nombrar lo que se ve, «regla» se enseña).
const LANGUAGES = { en, es, fr, de, pt, it, zh, hi, ja, ar };

export class Texts {
  static language() {
    const code = LanguageProvider.codeOf(LanguageProvider.current());
    return LANGUAGES[code] === undefined ? 'en' : code;
  }

  static of(code) { return LANGUAGES[code] || LANGUAGES.en; }

  // El sitio de Diálogo en el idioma que el chico está usando (dialog.ar/es/, /fr/, /ja/…;
  // el inglés vive en la raíz).
  static siteUrl() {
    const code = Texts.language();
    return code === 'en' ? 'https://dialog.ar/' : 'https://dialog.ar/' + code + '/';
  }

  static languageCodes() { return Object.keys(LANGUAGES); }

  static at(key) {
    const language = Texts.of(Texts.language());
    const value = language.ui[key];
    return value === undefined ? (LANGUAGES.en.ui[key] === undefined ? key : LANGUAGES.en.ui[key]) : value;
  }

  // Los textos de un desafío: title, mission, praise y steps (por índice).
  static challenge(id, field, index = 0) {
    const pick = code => {
      const texts = Texts.of(code).challenges[id];
      if (texts === undefined) return undefined;
      const value = field === 'steps' ? (texts.steps || [])[index] : texts[field];
      return value === undefined || value === '' ? undefined : value;
    };
    const value = pick(Texts.language());
    return value === undefined ? (pick('en') || '') : value;
  }
}

export const T = key => Texts.at(key);
