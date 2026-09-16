// Los sonidos de la interfaz, sintetizados con WebAudio (no hay archivos): toques, soltar
// un símbolo, mover, logros. Se pueden apagar; la preferencia se recuerda en el navegador.
export class Sounds {
  constructor({ storage = null } = {}) {
    this.storage = storage;
    this.context = null;
    this.enabled = true;
    try { if (storage !== null && storage.getItem('representar.sound') === 'off') this.enabled = false; } catch (error) { /* sin storage */ }
  }

  setEnabled(enabled) {
    this.enabled = enabled;
    try { if (this.storage !== null) this.storage.setItem('representar.sound', enabled ? 'on' : 'off'); } catch (error) { /* sin storage */ }
  }

  ensureContext() {
    if (this.context === null && typeof AudioContext !== 'undefined') this.context = new AudioContext();
    if (this.context !== null && this.context.state === 'suspended') this.context.resume().catch(() => {});
    return this.context;
  }

  tone(frequency, duration, { type = 'sine', gain = 0.12, at = 0 } = {}) {
    if (!this.enabled) return;
    const context = this.ensureContext();
    if (context === null) return;
    const oscillator = context.createOscillator();
    const amplifier = context.createGain();
    oscillator.type = type;
    oscillator.frequency.value = frequency;
    const start = context.currentTime + at;
    amplifier.gain.setValueAtTime(0.0001, start);
    amplifier.gain.exponentialRampToValueAtTime(gain, start + 0.01);
    amplifier.gain.exponentialRampToValueAtTime(0.0001, start + duration);
    oscillator.connect(amplifier).connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration + 0.02);
  }

  tap() { this.tone(660, 0.05, { type: 'square', gain: 0.03 }); }
  pop() { this.tone(520, 0.08, { type: 'triangle', gain: 0.08 }); this.tone(780, 0.1, { type: 'triangle', gain: 0.05, at: 0.05 }); }
  step() { this.tone(330, 0.04, { type: 'triangle', gain: 0.04 }); }
  whoosh() { this.tone(200, 0.12, { type: 'sawtooth', gain: 0.02 }); }
  error() { this.tone(180, 0.18, { type: 'square', gain: 0.05 }); }
  tada() {
    [523, 659, 784, 1046].forEach((frequency, index) => this.tone(frequency, 0.35, { at: index * 0.09, gain: 0.1 }));
    this.tone(1318, 0.5, { at: 0.4, gain: 0.08 });
  }
}
