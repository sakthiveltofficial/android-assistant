// Registry of model providers the user can pick in Settings.
export type ProviderId = 'anthropic' | 'openai' | 'gemini' | 'deepseek' | 'custom' | 'local';
export type ProviderKind = 'anthropic' | 'openai-compat' | 'gemini' | 'local';

export type ProviderDef = {
  id: ProviderId;
  label: string;
  kind: ProviderKind;
  /** Fixed base URL for hosted providers; for 'custom' the user supplies one. */
  baseUrl?: string;
  defaultModel: string;
  /** Curated model ids shown in the picker (replaced by the live list when the key can fetch one). */
  models: string[];
  /** Whether the provider's models accept screenshots by default. */
  vision: boolean;
  /** If set, only these models accept screenshots (others are text-only). */
  visionModels?: string[];
  keyRequired: boolean;
  note?: string;
};

export const PROVIDERS: ProviderDef[] = [
  {
    id: 'anthropic',
    label: 'Anthropic',
    kind: 'anthropic',
    defaultModel: 'claude-sonnet-5-5',
    models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'],
    vision: true,
    keyRequired: true,
  },
  {
    id: 'openai',
    label: 'OpenAI',
    kind: 'openai-compat',
    baseUrl: 'https://api.openai.com/v1',
    defaultModel: 'gpt-4o',
    models: ['gpt-4o', 'gpt-4o-mini'],
    vision: true,
    keyRequired: true,
  },
  {
    id: 'gemini',
    label: 'Gemini',
    kind: 'gemini',
    defaultModel: 'gemini-2.5-flash',
    models: ['gemini-2.5-flash', 'gemini-2.5-pro'],
    vision: true,
    keyRequired: true,
  },
  {
    id: 'deepseek',
    label: 'DeepSeek',
    kind: 'openai-compat',
    baseUrl: 'https://api.deepseek.com',
    defaultModel: 'deepseek-flash',
    models: ['deepseek-flash', 'deepseek-v4-pro'],
    vision: false,
    visionModels: ['deepseek-flash'],
    keyRequired: true,
    note: 'deepseek-flash accepts screenshots; deepseek-v4-pro is text-only, so the assistant reads the screen as an element list instead.',
  },
  {
    id: 'custom',
    label: 'OpenAI-compatible',
    kind: 'openai-compat',
    defaultModel: '',
    models: [],
    vision: true,
    keyRequired: false,
    note: 'Any server that speaks the OpenAI chat API: OpenRouter, Groq, Together, LM Studio, Ollama (…/v1), vLLM, a company gateway.',
  },
  {
    id: 'local',
    label: 'On-device',
    kind: 'local',
    defaultModel: '',
    models: [],
    vision: false,
    keyRequired: false,
    note: 'Runs a Gemma model on this phone. Fully offline, but slower and less capable than cloud models.',
  },
];

export const providerById = (id: ProviderId): ProviderDef => PROVIDERS.find((p) => p.id === id)!;

/** Does this provider/model pair accept screenshots? (Custom endpoints use the user's switch.) */
export function modelSupportsVision(def: ProviderDef, model: string, userSwitch: boolean): boolean {
  if (def.id === 'custom') return userSwitch;
  if (def.visionModels) return def.visionModels.includes(model);
  return def.vision;
}
