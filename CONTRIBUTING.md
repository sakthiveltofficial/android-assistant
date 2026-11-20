# Contributing to Android Assistant

Thanks for helping! This project is small and moving fast, so clear, focused contributions are the most useful.

By participating you agree to the [Code of Conduct](CODE_OF_CONDUCT.md). By contributing you agree that your work is licensed under the [Apache License 2.0](LICENSE) (see "Licensing of contributions" below).

## Ways to help

- **Test on real devices** and report what works. Phone model, Android version and ROM (MIUI, One UI, Pixel…) matter a lot for accessibility and microphone behaviour.
- **Fix bugs** or pick an issue labelled `good first issue`.
- **Add a provider or model entry** (see `src/agent/providers.ts` and `src/agent/models.ts`).
- **Improve the agent**: prompts, tool set, planning/validation, loop detection.
- **Improve docs and UI polish.**

For anything larger than a small fix, please **open an issue first** so we can agree on the approach before you invest time.

## Development setup

Requirements: Node 20+, JDK 17, Android SDK, a phone (Android 11+) or emulator.

```bash
git clone https://github.com/sakthiveltofficial/android-assistant.git
cd android-assistant
npm install
npx expo run:android          # first build: dev client + native modules
npx expo start --dev-client   # later: JS changes hot-reload
```

This is an Expo **development build**, not Expo Go. Native changes (anything under `modules/` or new native dependencies) need a rebuild; JS/TS changes do not. Read the README's troubleshooting section for Windows path-length and MIUI install issues.

Expo APIs change between SDK versions. Check the docs for the SDK version in `package.json` rather than relying on memory.

## Before you open a pull request

```bash
npx tsc --noEmit        # must pass
npx expo lint           # if lint is configured for your change
```

- Test the change on a device when it touches the agent, accessibility module, voice or overlay, and say in the PR what you tested and on which device/Android version.
- Keep PRs **small and single-purpose**. Unrelated refactors belong in their own PR.
- Match the surrounding code style. Prefer TypeScript types over `any`; add a short comment when the reason for something is not obvious.
- Update the README or docs if behaviour or setup changes.
- Never commit secrets, API keys, keystores, `.env` files, model weights, or build output (`android/` is generated and git-ignored).

## Commit messages and PRs

- Use a short imperative subject: `Add Mistral provider`, `Fix overlay hiding during gestures`.
- Explain the *why* in the body when it is not obvious.
- Link the issue (`Fixes #123`). Fill in the PR template.

## Safety-sensitive areas

This app can operate a phone on someone's behalf, so some changes get extra scrutiny:

- **Confirmation gate, prompt-injection defences, and the "never type passwords/codes" rule** (`src/agent/agent.ts`). Do not weaken them without a discussion in an issue.
- **Accessibility module and overlay** (`modules/a11y-control`). The overlay must stay out of screenshots and injected gestures.
- **Networking and key handling.** Keys belong in SecureStore and may only be sent to the provider the user chose. No analytics or telemetry without an explicit opt-in discussion.

## Reporting bugs and requesting features

Use the issue templates. For a bug, include: phone model, Android version/ROM, app version or commit, the model/provider used, steps to reproduce, and any logs (`adb logcat`). **Remove API keys and personal screen content from logs and screenshots.**

**Security problems:** do not open a public issue. See [SECURITY.md](SECURITY.md).

## Licensing of contributions

Unless you state otherwise, any contribution you intentionally submit for inclusion is licensed under the Apache License 2.0 (section 5 of the license), without additional terms. Only submit work you have the right to license this way, and do not paste code from projects with incompatible licenses.
