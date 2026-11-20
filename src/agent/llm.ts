// Multi-provider LLM client (direct HTTPS with the user's own key, or an on-device model).
// Each call is stateless: the agent loop sends one prompt (+ optional screenshot)
// and requires exactly one tool call back.
import { TOOL_DECLARATIONS, type ToolDecl } from './tools';
import { providerById, type ProviderId } from './providers';

export type Provider = ProviderId;

export type LlmConfig = {
  provider: ProviderId;
  apiKey: string;
  model: string;
  /** Used by OpenAI-compatible providers (OpenAI, DeepSeek, custom). */
  baseUrl?: string;
  /** Attach screenshots? False for text-only models (they get the element list only). */
  vision: boolean;
};

export type LlmReply = {
  thought: string;
  toolCall?: { name: string; args: Record<string, any> };
};

type CallInput = {
  system: string;
  text: string;
  /** base64 JPEG without data: prefix */
  imageB64?: string;
  signal?: AbortSignal;
  /** Tool set for this call; defaults to the device-control tools. */
  tools?: ToolDecl[];
};

async function post(url: string, headers: Record<string, string>, body: unknown, signal?: AbortSignal) {
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: JSON.stringify(body),
    signal,
  });
  const raw = await res.text();
  if (!res.ok) {
    // Never echo request headers (they carry the key); the body is the provider's error only.
    throw new Error(`LLM HTTP ${res.status}: ${raw.slice(0, 300)}`);
  }
  return JSON.parse(raw);
}

export async function callModel(cfg: LlmConfig, input: CallInput): Promise<LlmReply> {
  const img = cfg.vision ? input.imageB64 : undefined;
  const i = { ...input, imageB64: img };
  switch (providerById(cfg.provider).kind) {
    case 'anthropic':
      return callAnthropic(cfg, i);
    case 'openai-compat':
      return callOpenAICompat(cfg, i);
    case 'gemini':
      return callGemini(cfg, i);
    case 'local': {
      // Lazy so the app still starts where llama.rn isn't available (e.g. Expo Go).
      const { callLocal } = require('../local/runtime') as typeof import('../local/runtime');
      return callLocal(i);
    }
  }
}

async function callAnthropic(cfg: LlmConfig, i: CallInput): Promise<LlmReply> {
  const content: any[] = [];
  if (i.imageB64) {
    content.push({ type: 'image', source: { type: 'base64', media_type: 'image/jpeg', data: i.imageB64 } });
  }
  content.push({ type: 'text', text: i.text });
  const data = await post(
    'https://api.anthropic.com/v1/messages',
    { 'x-api-key': cfg.apiKey, 'anthropic-version': '2023-06-01' },
    {
      model: cfg.model,
      max_tokens: 1024,
      system: i.system,
      tools: (i.tools ?? TOOL_DECLARATIONS).map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
      tool_choice: { type: 'any' },
      messages: [{ role: 'user', content }],
    },
    i.signal,
  );
  const blocks: any[] = data.content ?? [];
  const thought = blocks.filter((b) => b.type === 'text').map((b) => b.text).join('\n');
  const tu = blocks.find((b) => b.type === 'tool_use');
  return { thought, toolCall: tu ? { name: tu.name, args: tu.input ?? {} } : undefined };
}

/** OpenAI, DeepSeek and any other server that implements POST {base}/chat/completions. */
async function callOpenAICompat(cfg: LlmConfig, i: CallInput): Promise<LlmReply> {
  const base = (cfg.baseUrl || providerById(cfg.provider).baseUrl || '').replace(/\/+$/, '');
  if (!base) throw new Error('Set a base URL for this provider in Settings.');
  const userContent: any[] = [{ type: 'text', text: i.text }];
  if (i.imageB64) {
    userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${i.imageB64}`, detail: 'low' } });
  }
  const headers: Record<string, string> = cfg.apiKey ? { authorization: `Bearer ${cfg.apiKey}` } : {};
  const body = (toolChoice: 'required' | 'auto') => ({
    model: cfg.model,
    tools: (i.tools ?? TOOL_DECLARATIONS).map((t) => ({
      type: 'function',
      function: { name: t.name, description: t.description, parameters: t.parameters },
    })),
    tool_choice: toolChoice,
    messages: [
      { role: 'system', content: i.system },
      // Text-only servers expect a plain string rather than a content-part array.
      { role: 'user', content: i.imageB64 ? userContent : i.text },
    ],
  });

  let data: any;
  try {
    data = await post(`${base}/chat/completions`, headers, body('required'), i.signal);
  } catch (e: any) {
    // Some servers/models reject tool_choice:"required" — retry letting the model decide.
    if (String(e?.message).startsWith('LLM HTTP 400') || String(e?.message).startsWith('LLM HTTP 422')) {
      data = await post(`${base}/chat/completions`, headers, body('auto'), i.signal);
    } else {
      throw e;
    }
  }
  const msg = data.choices?.[0]?.message ?? {};
  const tc = msg.tool_calls?.[0];
  let args: Record<string, any> = {};
  if (tc) {
    try {
      args = JSON.parse(tc.function.arguments || '{}');
    } catch {
      /* leave empty; the loop reports invalid args */
    }
  }
  return { thought: msg.content ?? '', toolCall: tc ? { name: tc.function.name, args } : undefined };
}

async function callGemini(cfg: LlmConfig, i: CallInput): Promise<LlmReply> {
  const parts: any[] = [];
  if (i.imageB64) parts.push({ inlineData: { mimeType: 'image/jpeg', data: i.imageB64 } });
  parts.push({ text: i.text });
  const data = await post(
    `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(cfg.model)}:generateContent`,
    { 'x-goog-api-key': cfg.apiKey },
    {
      systemInstruction: { parts: [{ text: i.system }] },
      tools: [
        {
          functionDeclarations: (i.tools ?? TOOL_DECLARATIONS).map((t) => ({
            name: t.name,
            description: t.description,
            parameters: t.parameters,
          })),
        },
      ],
      toolConfig: { functionCallingConfig: { mode: 'ANY' } },
      contents: [{ role: 'user', parts }],
    },
    i.signal,
  );
  const out: any[] = data.candidates?.[0]?.content?.parts ?? [];
  const thought = out.filter((p) => p.text).map((p) => p.text).join('\n');
  const fc = out.find((p) => p.functionCall)?.functionCall;
  return { thought, toolCall: fc ? { name: fc.name, args: fc.args ?? {} } : undefined };
}
