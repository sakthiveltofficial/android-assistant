import { requireNativeModule } from 'expo-modules-core';

export type UiElement = {
  index: number;
  text: string;
  desc: string;
  id: string;
  class: string;
  clickable: boolean;
  longClickable: boolean;
  editable: boolean;
  scrollable: boolean;
  checked: boolean;
  enabled: boolean;
  focused: boolean;
  bounds: [number, number, number, number];
  center: [number, number];
};

export type ScreenSnapshot = {
  package: string;
  width: number;
  height: number;
  elements: UiElement[];
  /** base64 JPEG (no data: prefix) */
  screenshot?: string;
  screenshotError?: string;
};

export type GlobalAction =
  | 'back'
  | 'home'
  | 'recents'
  | 'notifications'
  | 'quick_settings'
  | 'lock_screen';

type Native = {
  isServiceEnabled(): boolean;
  openAccessibilitySettings(): void;
  getScreen(includeScreenshot: boolean, maxEdge: number): Promise<string>;
  tap(x: number, y: number, durationMs: number): Promise<boolean>;
  swipe(x1: number, y1: number, x2: number, y2: number, durationMs: number): Promise<boolean>;
  setText(text: string, append: boolean): Promise<boolean>;
  globalAction(name: string): Promise<boolean>;
  launchApp(query: string): Promise<boolean>;
  listApps(): string;
  setRunning(running: boolean, status: string): void;
  addListener(event: 'onStopRequested', cb: () => void): { remove(): void };
};

// In Expo Go the custom native module is absent: fall back to inert stubs so the UI can still be previewed.
function loadNative(): Native {
  try {
    return requireNativeModule<Native>('A11yControl');
  } catch {
    const no = async () => false;
    return {
      isServiceEnabled: () => false,
      openAccessibilitySettings: () => {},
      getScreen: async () => JSON.stringify({ package: '', width: 0, height: 0, elements: [] }),
      tap: no, swipe: no, setText: no, globalAction: no, launchApp: no,
      listApps: () => '[]',
      setRunning: () => {},
      addListener: () => ({ remove() {} }),
    };
  }
}
export const nativeAvailable = (() => {
  try { requireNativeModule('A11yControl'); return true; } catch { return false; }
})();
const native = loadNative();

export const isServiceEnabled = () => native.isServiceEnabled();
export const openAccessibilitySettings = () => native.openAccessibilitySettings();

export async function getScreen(includeScreenshot = true, maxEdge = 1024): Promise<ScreenSnapshot> {
  return JSON.parse(await native.getScreen(includeScreenshot, maxEdge));
}
export const tap = (x: number, y: number, durationMs = 50) => native.tap(x, y, durationMs);
export const longPress = (x: number, y: number, durationMs = 800) => native.tap(x, y, durationMs);
export const swipe = (x1: number, y1: number, x2: number, y2: number, durationMs = 300) =>
  native.swipe(x1, y1, x2, y2, durationMs);
export const setText = (text: string, append = false) => native.setText(text, append);
export const globalAction = (name: GlobalAction) => native.globalAction(name);
export const launchApp = (query: string) => native.launchApp(query);
export const listApps = (): { label: string; package: string }[] => JSON.parse(native.listApps());

/** Foreground service + floating Stop button. Call with status text again to update the notification. */
export const setRunning = (running: boolean, status = 'Running a task') => native.setRunning(running, status);
/** Fires when the user taps Stop on the notification or the floating button. */
export const addStopListener = (cb: () => void) => native.addListener('onStopRequested', cb);
