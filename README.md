# Android Assistant (Expo + native accessibility control)

On-device port of the Artemis idea: an AI agent that sees and drives the Android UI.
No PC/ADB — control goes through an AccessibilityService (`modules/a11y-control`).

## Layout
- `modules/a11y-control/` — local Expo module (Kotlin): UI tree, screenshot, tap/swipe, set text, global keys, launch app
- `src/agent/tools.ts` — tool schema + executor (what the LLM calls)
- `App.tsx` — smoke-test screen (service status, API key storage, tests)

## Build (needs JDK 17 + Android SDK; not Expo Go)
```
npm install
npx expo run:android      # builds a dev client and installs it on a connected device/emulator
```
Then: open the app -> "Open accessibility settings" -> enable "Android Assistant".
On Android 13+ for sideloaded builds: App info -> ⋮ -> "Allow restricted settings" first.

## Next milestones
1. LLM client (Gemini/Claude/OpenAI, user key) + Flash-style loop using `tools.ts`
2. Foreground service + overlay stop button + confirmation for sensitive actions
3. On-device STT (whisper.rn/Vosk) and TTS
