<div align="center">

# Android Assistant

**A standalone, on-device AI assistant that can see and operate your whole Android phone.**
Bring your own model key, or run Gemma fully offline. No PC, no ADB.

[![CI](https://github.com/sakthiveltofficial/android-assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/sakthiveltofficial/android-assistant/actions/workflows/ci.yml)
[![Release](https://img.shields.io/github/v/release/sakthiveltofficial/android-assistant?include_prereleases)](https://github.com/sakthiveltofficial/android-assistant/releases)
[![License](https://img.shields.io/badge/license-Apache%202.0-blue.svg)](LICENSE)
![Platform](https://img.shields.io/badge/platform-Android%2011%2B-3ddc84)
![Built with](https://img.shields.io/badge/built%20with-Expo%20%2B%20React%20Native-000020)
![Status](https://img.shields.io/badge/status-early%20alpha-orange)

</div>

> **Early alpha.** It runs and the UI is usable, but expect rough edges. See [Status](#status) for what has and has not been tested on real devices.

## What it is

Android Assistant is a voice/chat assistant with one extra ability: when a request needs the phone, it **drives the phone for you**. It reads the screen, decides the next tap, swipe or keystroke, and repeats until the job is done. Everything runs inside one app, with no computer attached.

It is an independent re-implementation of the ideas behind Google's [Artemis](https://github.com/google/artemis), moved from "PC + ADB" to "AccessibilityService on the phone".

## Features

- **Chat or control, automatically.** A router decides per message: questions are answered in the app; only phone tasks switch to control mode (background app, bottom glow, floating orb).
- **Agentic, not just reactive.** Simple goals run a fast observe → act loop. Complex goals go through a planner, per-step operator, validator (retry / replan on failure) and a summarizer, like Artemis Pro / LangGraph graphs.
- **Bring your own model.** Anthropic, OpenAI, Gemini, DeepSeek, or any OpenAI-compatible endpoint (OpenRouter, Groq, Ollama, LM Studio, vLLM…). Model lists are fetched live from the provider and picked from a list.
- **Fully on-device option.** Download a Google Gemma model in the app and run it with llama.cpp. Works offline.
- **Voice, on-device.** Speech-to-text with whisper.cpp (tiny English model), hands-free conversation mode with voice-activity detection, and barge-in: start talking and the assistant stops speaking and listens.
- **Minimized control mode.** While operating the phone the app steps aside. A touch-transparent gradient at the bottom edge plus a small animated particle-sphere button (tap to stop) are hidden during screenshots and gestures, so they never affect control, recordings or screenshots.
- **Quick model switching** from the dropdown at the top of the main screen; chat history, profile and settings from the avatar menu.
- **Safety by design.** See [Safety and privacy](#safety-and-privacy).

## How it works

```
 you (voice / text)
        │
        ▼
   ┌─────────┐  chat ──────────────────────────► reply in app
   │ Router  │
   └────┬────┘  phone task
        ▼
   ┌─────────┐   ┌──────────┐   ┌───────────┐   ┌────────────┐
   │ Planner │──►│ Operator │──►│ Validator │──►│ Summarizer │
   └─────────┘   └────┬─────┘   └─────┬─────┘   └────────────┘
        ▲             │ one tool call │ reject → retry → replan
        │             ▼ per turn      │
        │      ┌──────────────────────┴───────┐
        └──────│  Android AccessibilityService │  (Kotlin Expo module)
               │  UI tree · screenshot · tap   │
               │  swipe · type · keys · apps   │
               └───────────────────────────────┘
```

| Artemis (PC) | This app (on the phone) |
|---|---|
| `adb shell input tap/swipe` | `AccessibilityService.dispatchGesture` |
| `adb exec-out screencap` | `AccessibilityService.takeScreenshot` (Android 11+) |
| UI hierarchy dump | `AccessibilityNodeInfo` tree |
| clipboard-paste for text | `ACTION_SET_TEXT` |
| external orchestrator | agent loop in TypeScript, calling your model |

## Download

Prebuilt APKs are attached to each [GitHub Release](https://github.com/sakthiveltofficial/android-assistant/releases) (arm64 phones, Android 11+). Verify the download against the `.sha256` file, install the APK, then follow the setup steps below. Builds are produced automatically by GitHub Actions; see [Releases and CI](#releases-and-ci).

## Requirements

- An Android phone on **Android 11 (API 30) or newer** (screenshots need API 30+).
- To build: **Node 20+, JDK 17, Android SDK** (platform 36 and build-tools), and a USB cable or emulator. This is a **development build, not Expo Go**, because it uses native modules (accessibility, llama.cpp, whisper.cpp, Skia).
- A model: an API key for a cloud provider, **or** enough free storage and RAM for an on-device Gemma model (see the sizes in Settings).

## Quick start

```bash
git clone https://github.com/sakthiveltofficial/android-assistant.git
cd android-assistant
npm install

# build the dev client and install it on a connected phone / emulator
npx expo run:android

# afterwards, for JS-only changes
npx expo start --dev-client
```

On the phone:

1. Open the app → avatar → **Settings**.
2. Turn on **Accessibility service** → enable *Android Assistant*.
   On Android 13+ for sideloaded builds, first allow it under App info → ⋮ → *Allow restricted settings*.
3. Pick a provider, paste your API key, choose a model. (Or choose **On-device** and download a Gemma model.)
4. Optional: download the speech model in Settings → Voice, then tap the mic.

### Troubleshooting builds

- **Windows path-length errors (CMake / ninja "No such file or directory")**: clone into a very short path (e.g. `D:\aa`) and set `externalNativeBuild.cmake.buildStagingDirectory` to a short folder in `android/app/build.gradle`. Windows' 260-character limit breaks the native builds.
- **Xiaomi / MIUI "INSTALL_FAILED_USER_RESTRICTED"**: enable *Install via USB* in Developer options.
- **Installing `llama.rn` from Git Bash on Windows** can fail because of GNU `tar`; run `npm install` from PowerShell.
- Typecheck with `npx tsc --noEmit`.

## Releases and CI

- **CI** (`.github/workflows/ci.yml`) typechecks every push and pull request.
- **Release** (`.github/workflows/release.yml`) builds the Android APK and publishes it as a GitHub Release whenever a version tag is pushed:

  ```bash
  git tag v0.1.0
  git push origin v0.1.0
  ```

  It can also be run by hand from the Actions tab to produce an APK artifact without publishing.
- **Signing.** Without secrets the APK is signed with the debug key, which is fine for trying it out. To sign releases with your own key, add these repository secrets: `ANDROID_KEYSTORE_BASE64` (the keystore, base64-encoded), `ANDROID_KEYSTORE_PASSWORD`, `ANDROID_KEY_ALIAS`, `ANDROID_KEY_PASSWORD`. Keep the same key across releases, or users cannot update in place.
- Tags containing a hyphen (for example `v0.2.0-beta.1`) are published as pre-releases.

## Project layout

```
App.tsx                      navigation: main chat screen + account / model menus
modules/a11y-control/        Kotlin Expo module: AccessibilityService, overlay, particle orb, foreground service
src/agent/                   router · planner · operator · validator · summarizer (agent.ts), tool schema,
                             multi-provider LLM client (llm.ts), provider registry, live model lists
src/local/                   on-device Gemma: catalog, resumable downloads, llama.rn runtime
src/voice/                   whisper.cpp STT (push-to-talk + hands-free VAD), TTS
src/state/                   settings (keys in SecureStore) and the assistant state machine
src/screens/ src/ui/         Voice/chat, Settings, Profile, History + shared components
```

## Safety and privacy

This app can tap, type and read anything on your screen. Treat it accordingly.

- **Your keys stay on your device**, stored in Android's encrypted SecureStore, and are sent only to the provider you chose.
- **Cloud models see your screen.** While a phone task runs, screenshots and on-screen text are sent to your chosen provider. On-device models keep everything on the phone.
- **Confirmation for sensitive taps** (send, pay, buy, delete, install, call…): a dialog asks before the tap happens.
- **On-screen text is data, never instructions.** The agent is told to ignore text on pages, messages and notifications that tries to redirect it (prompt-injection defence). This is a mitigation, not a guarantee.
- **It never types passwords, card numbers or one-time codes**; such tasks are reported as failed.
- **Always interruptible:** a floating orb, a notification action, and a spoken or typed "stop" end the task.
- The accessibility permission is powerful. Only install builds you trust, and review the code you run.

See [SECURITY.md](SECURITY.md) to report a vulnerability.

## Status

| Area | State |
|---|---|
| Build, install, UI (chat, settings, menus) | Working on a real phone |
| Chat vs. phone-control routing, plan/validate agent graph | Implemented; typechecked; needs more real-task testing |
| Cloud providers (Anthropic, OpenAI, Gemini, DeepSeek, custom) | Implemented; live model lists need testing with real keys |
| On-device Gemma via llama.rn | Builds and links; model loading and tool-call quality still to be validated |
| Voice (whisper STT, hands-free VAD, barge-in) | Implemented; echo handling needs per-device tuning |
| Control overlay (gradient + particle orb) | Implemented and installed; visual check pending |

## Roadmap

- Pause/resume (not only stop) for running tasks
- Neural voice-activity detection (Silero) and a background-capable microphone service
- Stronger local-model tool calling, GPU offload on supported chips
- iOS is out of scope for now (it has no equivalent of Android's AccessibilityService)
- Localised UI and more TTS voices

## Contributing

Contributions are welcome, from typo fixes to new providers. Please read [CONTRIBUTING.md](CONTRIBUTING.md) and the [Code of Conduct](CODE_OF_CONDUCT.md) first.

## License

Licensed under the [Apache License 2.0](LICENSE). See [NOTICE](NOTICE) for attribution.
Third-party libraries keep their own licenses. Downloadable model weights (Whisper, Gemma) are not covered by this repository's license; check each model's terms before redistributing.

## Acknowledgements

- [google/artemis](https://github.com/google/artemis) for the architecture this project re-implements
- [Expo](https://expo.dev) and React Native
- [llama.cpp](https://github.com/ggml-org/llama.cpp) / [llama.rn](https://github.com/mybigday/llama.rn) and [whisper.cpp](https://github.com/ggml-org/whisper.cpp) / [whisper.rn](https://github.com/mybigday/whisper.rn)
- Google's Gemma open models

## Disclaimer

This is experimental software that automates your phone using AI models, which can make mistakes. You are responsible for what it does on your device and accounts. It is provided "as is", without warranty (see the license).
