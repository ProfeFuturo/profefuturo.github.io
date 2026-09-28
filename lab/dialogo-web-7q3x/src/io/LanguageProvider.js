// Diccionario de textos de la interfaz (los archivos de assets/dictionaries).
// Cada archivo tiene una línea por clave, en el orden de DICTIONARY_KEYS.
export const DICTIONARY_KEYS = ['Language', 'unknown', 'NewProject', 'GalleryOfProjects', 'ChallengesAndGames', 'Back',
  'FileOut', 'projectWithoutProperName', 'substitutionApplied', 'UnappliedSubstitutionsThatMatch',
  'arrowKeys', 'canNotTraspass', 'categorize', 'collision', 'enterKey', 'anySingleSymbol', 'everySequence',
  'pointsTo', 'pull', 'push', 'evalAndSee', 'runTowards', 'spaceBar', 'teleport', 'wasdKeys', 'dropDrawingsAsSymbols',
  'dropDrawingsAsElements', 'putDropping', 'putStamping', 'DrawNewSymbol', 'becameSymbol', 'becameElement',
  'Remove', 'inspectExecution', 'Close', 'Modify', 'EditACopy', 'EnterNewNameOfTopic',
  'TopicName', 'EnterNewNameOfSection', 'SectionName', 'Undo', 'Redo', 'Topic', 'Create', 'Rename', 'Delete',
  'Unlock', 'Lock', 'Substitution', 'Priority', 'Change', 'Low', 'Medium', 'High', 'Section', 'Category', 'New', 'Result',
  'InspectExecution', 'StopEvaluation', 'Fundamental', 'word', 'phrase', 'Substitute', 'Categorize', 'ManipulateWords',
  'EditOrganization', 'TestingSpace', 'character', 'first', 'last', 'without', 'join', 'ResultSpace', 'TryASenteceHere',
  'SeeTheResultHere', 'itIsAFundamentalSubstitution', 'FundamentalCategoryThatIncludesAllWordsIndividually',
  'FundamentalCategoryThatIncludesAllPhrasesThatIsNonEmptySequencesOfWords', 'slowDown2', 'speedUp2',
  'Yes', 'No', 'AreYouSureYouWantToExit', 'AreYouSureYouWantToDeleteProject', 'ChooseOtherProjectsToReuse',
  'MakeEverythingVisible', 'ShowAllSymbols', 'HideAllSymbols', 'ShowAllElementsOfThisKind',
  'HideAllElementsOfThisKind', 'Show', 'Hide',
  'Nowhere', 'changeDirection', 'AllDirections', 'BecameButton', 'Resize',
  'InspectingWhenApplied', 'inspectExecutionWhenApplied',
  'PublicWhenShareing', 'PrivateWhenShareing', 'PointToADirection'];

// Los diccionarios latinizados se muestran con la escritura del propio idioma (el archivo sigue
// siendo el romanizado: es lo que el entorno sabe leer).
const NATIVE_NAMES = {
  'Zhongwén': '中文',
  'Hindi': 'हिन्दी',
  'Nihongo': '日本語',
  'Al-‘arabiyah': 'العربية',
  "Al-'arabiyah": 'العربية',
};

export class LanguageProvider {
  constructor(name, entries = new Map()) {
    this.name = name;
    this.entries = entries;
  }

  // Cómo se llama el idioma en su propia escritura (para el menú de idiomas).
  get displayName() { return NATIVE_NAMES[this.name] || this.name; }

  static fromText(text) {
    const lines = text.split(/\r?\n/);
    const entries = new Map();
    DICTIONARY_KEYS.forEach((key, index) => entries.set(key, index < lines.length ? lines[index] : '?'));
    return new LanguageProvider(entries.get('Language'), entries);
  }

  // Elige diccionario: ?lang=xx, después lo guardado, después el idioma del navegador, si no inglés.
  static choose(dictionaries, { requested = null, preferred = null, browser = '' } = {}) {
    const byCode = code => {
      if (!code) return null;
      const short = String(code).toLowerCase().slice(0, 2);
      const names = { es: /espa/i, en: /english/i, fr: /fran/i, de: /deutsch/i, pt: /portug/i, it: /italian/i, ar: /arab/i, zh: /mandarin/i, hi: /hindi/i, ja: /japan/i };
      const pattern = names[short];
      return pattern ? dictionaries.find(each => pattern.test(each.name)) || null : null;
    };
    return byCode(requested)
      || dictionaries.find(each => each.name === preferred)
      || byCode(browser)
      || dictionaries.find(each => /english/i.test(each.name))
      || dictionaries[0];
  }

  // El código del idioma (para el atributo lang: la escritura se ve con la tipografía correcta).
  static codeOf(provider) {
    const name = provider === null || provider === undefined ? '' : String(provider.name);
    const codes = [[/espa/i, 'es'], [/english/i, 'en'], [/fran/i, 'fr'], [/deutsch/i, 'de'], [/portug/i, 'pt'],
      [/italian/i, 'it'], [/zhong|mandarin/i, 'zh'], [/hindi/i, 'hi'], [/nihongo|japan/i, 'ja'], [/arab/i, 'ar']];
    const found = codes.find(([pattern]) => pattern.test(name));
    return found ? found[1] : '';
  }

  static current() { return LanguageProvider.currentProvider; }
  static setCurrent(provider) { LanguageProvider.currentProvider = provider; }

  static dictionaries() { return LanguageProvider.loadedDictionaries; }
  static addDictionary(provider) { LanguageProvider.loadedDictionaries.push(provider); }

  at(key) {
    const value = this.entries.get(key);
    return value === undefined ? String(key) : value;
  }
}

LanguageProvider.currentProvider = new LanguageProvider('keys');
LanguageProvider.loadedDictionaries = [];

export function dictionaryAt(key) { return LanguageProvider.current().at(key); }
