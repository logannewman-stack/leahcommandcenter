/**
 * "A small sound and animation for the big moments." Two soft notes, drawn
 * with the Web Audio API, so nothing is downloaded and nothing is loud. Off
 * and on is remembered on this device; browsers only let it play after the
 * person has tapped the page once.
 */

const KEY = "cc.sound";

export function soundOn() {
  try {
    return window.localStorage.getItem(KEY) !== "off";
  } catch {
    return true;
  }
}

export function setSoundOn(on) {
  try {
    window.localStorage.setItem(KEY, on ? "on" : "off");
  } catch {
    // Storage blocked: the switch lasts the page.
  }
}

let context = null;

/** @param {boolean} big  a bigger moment is a third note */
export function chime(big = false) {
  if (!soundOn()) return;
  try {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    if (!AudioContextClass) return;
    context = context || new AudioContextClass();
    if (context.state === "suspended") context.resume().catch(() => {});
    const notes = big ? [523.25, 659.25, 783.99] : [523.25, 659.25];
    const start = context.currentTime + 0.02;
    notes.forEach((frequency, i) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = "sine";
      oscillator.frequency.value = frequency;
      const at = start + i * 0.14;
      gain.gain.setValueAtTime(0.0001, at);
      gain.gain.exponentialRampToValueAtTime(0.08, at + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, at + 0.5);
      oscillator.connect(gain).connect(context.destination);
      oscillator.start(at);
      oscillator.stop(at + 0.55);
    });
  } catch {
    // No audio: the burst is enough.
  }
}
