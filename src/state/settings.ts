// Persistent settings. API keys live in SecureStore (one entry per provider);
// everything non-secret lives in a small JSON file.
import * as SecureStore from 'expo-secure-store';
import * as FS from 'expo-file-system/legacy';
import { PROVIDERS, providerById, type ProviderId } from '../agent/providers';

export type ProviderSettings = {
  apiKey: string;
  model: string;
  baseUrl: string;
  /** Send screenshots to this model? */
  vision: boolean;
};

export type Settings = {
  active: ProviderId;
  providers: Record<ProviderId, ProviderSettings>;
  /** On-device: selected catalog model id */
  localModelId: string;
  /** On-device: also feed screenshots to a vision-capable local model (slower) */
  localVision: boolean;
  speakResults: boolean;
  profileName: string;
};

const FILE = (FS.documentDirectory ?? '') + 'settings.json';
const keyName = (p: ProviderId) => `api_key_${p}`;

export function defaultSettings(): Settings {
  const providers = {} as Record<ProviderId, ProviderSettings>;
  for (const p of PROVIDERS) {
    providers[p.id] = { apiKey: '', model: p.defaultModel, baseUrl: p.baseUrl ?? '', vision: p.vision };
  }
  return { active: 'anthropic', providers, localModelId: '', localVision: false, speakResults: true, profileName: '' };
}

export async function loadSettings(): Promise<Settings> {
  const s = defaultSettings();
  try {
    const raw = JSON.parse(await FS.readAsStringAsync(FILE));
    if (raw.active && providerById(raw.active)) s.active = raw.active;
    for (const p of PROVIDERS) {
      const r = raw.providers?.[p.id];
      if (r) s.providers[p.id] = { ...s.providers[p.id], model: r.model ?? s.providers[p.id].model, baseUrl: r.baseUrl ?? s.providers[p.id].baseUrl, vision: r.vision ?? s.providers[p.id].vision };
    }
    s.localModelId = raw.localModelId ?? '';
    s.localVision = !!raw.localVision;
    s.speakResults = raw.speakResults ?? true;
    s.profileName = raw.profileName ?? '';
  } catch {
    /* first run */
  }
  // Migrate the key from the first version of the app (single shared key).
  const legacy = await SecureStore.getItemAsync('llm_api_key').catch(() => null);
  for (const p of PROVIDERS) {
    const k = await SecureStore.getItemAsync(keyName(p.id)).catch(() => null);
    s.providers[p.id].apiKey = k ?? '';
  }
  if (legacy && !s.providers[s.active].apiKey && s.active !== 'local') s.providers[s.active].apiKey = legacy;
  return s;
}

export async function saveSettings(s: Settings): Promise<void> {
  for (const p of PROVIDERS) {
    const k = s.providers[p.id].apiKey;
    if (k) await SecureStore.setItemAsync(keyName(p.id), k);
    else await SecureStore.deleteItemAsync(keyName(p.id)).catch(() => {});
  }
  const { providers, ...rest } = s;
  const nonSecret = Object.fromEntries(
    Object.entries(providers).map(([id, v]) => [id, { model: v.model, baseUrl: v.baseUrl, vision: v.vision }]),
  );
  await FS.writeAsStringAsync(FILE, JSON.stringify({ ...rest, providers: nonSecret }));
}
