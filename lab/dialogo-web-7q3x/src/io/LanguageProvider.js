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

export class LanguageProvider {
  constructor(name, entries = new Map()) {
    this.name = name;
    this.entries = entries;
  }

  static fromText(text) {
    const lines = text.split(/\r?\n/);
    const entries = new Map();
    DICTIONARY_KEYS.forEach((key, index) => entries.set(key, index < lines.length ? lines[index] : '?'));
    return new LanguageProvider(entries.get('Language'), entries);
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
