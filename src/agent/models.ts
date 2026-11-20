// Live model lists: ask the provider which models this key can use (falls back to the curated list).
import { providerById, type ProviderDef, type ProviderId } from './providers';

export type ModelOption = { id: string; label?: string };

async function getJson(url: string, headers: Record<string, string>): Promise<any> {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 12000);
  try {
    const res = await fetch(url, { headers, signal: ctrl.signal });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    return await res.json();
  } finally {
    clearTimeout(t);
  }
}

const dedupe = (ids: string[]) => Array.from(new Set(ids.filter(Boolean)));

/** Returns the provider's model ids, or throws (bad key, no network, endpoint unsupported). */
export async function fetchModels(id: ProviderId, apiKey: string, baseUrl?: string): Promise<string[]> {
  const def: ProviderDef = providerById(id);
  if (def.kind === 'local') return [];
  if (def.kind === 'anthropic') {
    const d = await getJson('https://api.anthropic.com/v1/models?limit=100', { 'x-api-key': apiKey, 'anthropic-version': '2023-06-01' });
    return dedupe((d.data ?? []).map((m: any) => m.id));
  }
  if (def.kind === 'gemini') {
    const d = await getJson('https://generativelanguage.googleapis.com/v1beta/models?pageSize=200', { 'x-goog-api-key': apiKey });
    return dedupe(
      (d.models ?? [])
        .filter((m: any) => (m.supportedGenerationMethods ?? []).includes('generateContent'))
        .map((m: any) => String(m.name).replace(/^models\//, ''))
        .filter((n: string) => n.startsWith('gemini')),
    );
  }
  // OpenAI-compatible: GET {base}/models
  const base = (baseUrl || def.baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Enter the base URL first');
  const d = await getJson(base + '/models', apiKey ? { authorization: 'Bearer ' + apiKey } : {});
  let ids: string[] = (d.data ?? d.models ?? []).map((m: any) => (typeof m === 'string' ? m : m.id ?? m.name));
  if (id === 'openai') {
    // The OpenAI list also contains embeddings, TTS, image and moderation models.
    ids = ids.filter((n) => /^(gpt|o\d|chatgpt)/.test(n) && !/(embed|tts|whisper|audio|image|realtime|transcribe|moderation|search|instruct)/.test(n));
  }
  return dedupe(ids).sort();
}
