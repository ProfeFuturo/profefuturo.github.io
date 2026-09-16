import { LanguageProvider } from '../io/LanguageProvider.js';

// Los textos de la app para chicos, en inglés (por defecto) y en español rioplatense. Siguen
// docs/textos.md: un verbo por frase, nombrar lo que se ve, «regla» se enseña. El idioma sale del
// diccionario elegido (LanguageProvider): 'Español' → es, cualquier otro → en.
const TEXTS = {
  // navegación y pantallas
  'nav.play': { en: 'Play', es: 'Jugar' },
  'nav.home': { en: 'Home', es: 'Inicio' },
  'nav.mine': { en: 'Mine', es: 'Míos' },
  'nav.badges': { en: 'Badges', es: 'Logros' },
  'nav.create': { en: 'Create', es: 'Crear' },
  'mine.title': { en: 'Mine', es: 'Míos' },
  'mine.projects': { en: 'projects', es: 'proyectos' },
  'mine.badges': { en: 'badges', es: 'logros' },
  'badges.title': { en: 'Badges', es: 'Logros' },
  'play.title': { en: 'Play', es: 'Jugar' },
  'play.next': { en: 'Next challenge', es: 'Próximo desafío' },
  'play.locked': { en: 'Finish the challenges to unlock', es: 'Terminá los desafíos para destrabar' },
  'play.builds': { en: 'Build your own games', es: 'Armá tus propios juegos' },
  'play.free': { en: 'Free creation', es: 'Creación libre' },
  'play.freeHint': { en: 'Unlocks when you finish building the games', es: 'Se destraba cuando termines de armar los juegos' },
  'language': { en: 'Language', es: 'Idioma' },
  'sound': { en: 'Sound', es: 'Sonido' },
  'sound.on': { en: 'Sound: on', es: 'Sonido: sí' },
  'sound.off': { en: 'Sound: off', es: 'Sonido: no' },
  'openFile': { en: 'Open a .dialog.ar file', es: 'Abrir un archivo .dialog.ar' },
  'more': { en: 'More', es: 'Más' },
  'open': { en: 'Open', es: 'Abrir' },
  'copyAndChange': { en: 'Copy and change', es: 'Copiar y cambiar' },
  'download': { en: 'Download .dialog.ar', es: 'Descargar .dialog.ar' },
  'myVersionOf': { en: 'My version of ', es: 'Mi versión de ' },
  'mineSuffix': { en: ' (mine)', es: ' (mío)' },
  'error.open': { en: "Couldn't open the project", es: 'No se pudo abrir el proyecto' },
  'error.copy': { en: "Couldn't copy the project", es: 'No se pudo copiar el proyecto' },
  'error.file': { en: "Couldn't open the file", es: 'No se pudo abrir el archivo' },
  'error.openNamed': { en: "Couldn't open: ", es: 'No se pudo abrir: ' },
  // feed
  'feed.challenge': { en: 'Challenge', es: 'Desafío' },
  'feed.nextChallenge': { en: 'Your next challenge', es: 'Tu próximo desafío' },
  'feed.play': { en: 'Play', es: 'Jugar' },
  'feed.live': { en: 'live', es: 'en vivo' },
  'feed.you': { en: 'You', es: 'Vos' },
  'feed.empty': { en: 'Create your first project', es: 'Creá tu primer proyecto' },
  'feed.watchOnly': { en: 'This project is for watching, not steering', es: 'Este proyecto se mira, no se maneja' },
  'category.games': { en: 'Game', es: 'Juego' },
  'category.didactic': { en: 'Lesson', es: 'Didáctico' },
  'category.mine': { en: 'Mine', es: 'Mío' },
  // editor
  'success.title': { en: 'You did it!', es: '¡Lo lograste!' },
  'success.next': { en: 'Next', es: 'Siguiente' },
  'success.home': { en: 'Home', es: 'Al inicio' },
  'success.stay': { en: 'Stay and invent', es: 'Quedarme a inventar' },
  'success.yours': { en: "It's yours now. Change anything. You'll find it in Mine.", es: 'Ahora es tuyo. Cambiá lo que quieras. Lo vas a encontrar en Míos.' },
  'menu.backToStart': { en: 'Back to start', es: 'Volver al inicio' },
  'menu.forBuilding': { en: 'For building', es: 'Para armar' },
  'menu.setStart': { en: 'Set this as start', es: 'Fijar este inicio' },
  'menu.reuse': { en: 'Use tiles from other projects', es: 'Usar fichas de otros proyectos' },
  'challenge.restart': { en: 'Start over', es: 'Volver a empezar' },
  'tray.draw': { en: 'Draw', es: 'Dibujar' },
  'tray.drawing': { en: 'Drawing', es: 'Dibujo' },
  'tray.symbol': { en: 'Tile', es: 'Ficha' },
  'joystick.space': { en: 'Space', es: 'Espacio' },
  'joystick.enter': { en: 'Enter', es: 'Enter' },
  // herramienta de dibujo
  'paint.title': { en: 'Draw', es: 'Dibujar' },
  'paint.done': { en: 'Done', es: 'Listo' },
  'paint.close': { en: 'Close without saving', es: 'Cerrar sin guardar' },
  'paint.brush': { en: 'Brush', es: 'Pincel' },
  'paint.eraser': { en: 'Eraser', es: 'Goma' },
  'paint.bucket': { en: 'Bucket', es: 'Balde' },
  'paint.undo': { en: 'Undo', es: 'Deshacer' },
  'paint.size': { en: 'Size', es: 'Grosor' },
  'paint.canvas': { en: 'Canvas', es: 'Lienzo' },
  'color.black': { en: 'Black', es: 'Negro' }, 'color.white': { en: 'White', es: 'Blanco' }, 'color.red': { en: 'Red', es: 'Rojo' },
  'color.orange': { en: 'Orange', es: 'Naranja' }, 'color.yellow': { en: 'Yellow', es: 'Amarillo' }, 'color.green': { en: 'Green', es: 'Verde' },
  'color.blue': { en: 'Blue', es: 'Azul' }, 'color.purple': { en: 'Purple', es: 'Violeta' }, 'color.pink': { en: 'Pink', es: 'Rosa' },
  'color.brown': { en: 'Brown', es: 'Marrón' }, 'color.cyan': { en: 'Sky blue', es: 'Celeste' }, 'color.gray': { en: 'Gray', es: 'Gris' },
  // logros
  'badge.first-drop': { en: 'First tile|Put a tile on the board', es: 'Primera ficha|Poné una ficha en el tablero' },
  'badge.rule': { en: 'First rule|Make a rule with tiles', es: 'Primera regla|Armá una regla con fichas' },
  'badge.first-move': { en: 'On the move|Move with the joystick', es: 'En movimiento|Movete con el joystick' },
  'badge.artist': { en: 'Artist|Draw a new tile', es: 'Dibujante|Dibujá una ficha nueva' },
  'badge.detective': { en: 'Detective|See how a rule works', es: 'Detective|Mirá cómo funciona una regla' },
  'badge.explorer': { en: 'Explorer|Open three projects', es: 'Explorador|Abrí tres proyectos' },
  'badge.remix': { en: 'Inventor|Copy a project and change it', es: 'Inventor|Copiá un proyecto y cambialo' },
  'badge.saver': { en: 'Collector|Save a project of yours', es: 'Coleccionista|Guardá un proyecto tuyo' },
  'badge.world': { en: 'World complete|Finish every challenge of a world', es: 'Mundo completo|Terminá todos los desafíos de un mundo' },
  'badge.ladder': { en: 'Champion|Finish every challenge', es: 'Campeón|Terminá todos los desafíos' },
};

export class Texts {
  static language() {
    const current = LanguageProvider.current();
    return current !== null && current !== undefined && /espa/i.test(current.name) ? 'es' : 'en';
  }

  static at(key) {
    const entry = TEXTS[key];
    if (entry === undefined) return key;
    return entry[Texts.language()] || entry.en;
  }

  // Un texto ya bilingüe: { en, es } → el del idioma actual.
  static pick(bilingual) {
    if (bilingual === null || bilingual === undefined) return '';
    if (typeof bilingual === 'string') return bilingual;
    return bilingual[Texts.language()] || bilingual.en || '';
  }
}

export const T = key => Texts.at(key);
