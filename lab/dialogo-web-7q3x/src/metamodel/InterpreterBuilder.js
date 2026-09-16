import { Interpreter } from './Interpreter.js';
import { StateOfArtBuilderForVisualEnvironment } from './StateOfArtBuilderForVisualEnvironment.js';

export class InterpreterBuilder {
  static interpreterWithAsciiAndVisualStateOfArt() {
    return new InterpreterBuilder().buildWithStateOfArtBuilder(new StateOfArtBuilderForVisualEnvironment());
  }

  buildWithStateOfArtBuilder(stateOfArtBuilder, interpreter = new Interpreter()) {
    this.interpreterToBuild = interpreter;
    this.stateOfArtToBuild = stateOfArtBuilder.buildWithInterpreter(interpreter);
    interpreter.initializeWithStateOfArt(this.stateOfArtToBuild);
    return interpreter;
  }

  interpreter() { return this.interpreterToBuild; }
}
