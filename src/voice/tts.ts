// Text-to-speech through the device's built-in engine (works offline when voice data is installed).
import * as Speech from 'expo-speech';

let speaking = false;

export function speak(text: string, onDone?: () => void) {
  const t = text.trim();
  if (!t) return onDone?.();
  Speech.stop();
  speaking = true;
  const end = () => { speaking = false; onDone?.(); };
  Speech.speak(t.slice(0, 600), { language: 'en-US', rate: 1.0, onDone: end, onStopped: () => { speaking = false; }, onError: () => { speaking = false; } });
}

export const stopSpeaking = () => { speaking = false; Speech.stop(); };
export const isSpeaking = () => speaking;
