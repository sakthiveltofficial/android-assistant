// Text-to-speech through the device's built-in engine (works offline when voice data is installed).
import * as Speech from 'expo-speech';

export function speak(text: string) {
  const t = text.trim();
  if (!t) return;
  Speech.stop();
  Speech.speak(t.slice(0, 600), { language: 'en-US', rate: 1.0 });
}

export const stopSpeaking = () => Speech.stop();
