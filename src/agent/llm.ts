// Minimal multi-provider LLM client (direct HTTPS with the user's own key).
// Each call is stateless: the agent loop sends one prompt (+ optional screenshot)
// and requires exactly one tool call back.
import { TOOL_DECLARATIONS } from './tools';

export type Provider = 'anthropic' | 'openai' | 'gemini';

export type LlmConfig = { provider: Provider; apiKey: string; model: string };

export type LlmReply = {
  thought: string;
  toolCall?: { name: string; args: Record<string, any> };
};

export const DEFAULT_MODELS: Record<Provider, string> = {
  anthropic: 'claude-sonnet-5-5',
  openai: 'gpt-4o',
  gemini: 'gemini-2.5-flash',
};

type CallInput = {
  system: string;
  text: string;
  /** base64 JPEG without data: prefix */
  imageB64?: string;
  signal?: AbortSignal;
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
  switch (cfg.provider) {
    case 'anthropic':
      return callAnthropic(cfg, input);
    case 'openai':
      return callOpenAI(cfg, input);
    case 'gemini':
      return callGemini(cfg, input);
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
      tools: TOOL_DECLARATIONS.map((t) => ({ name: t.name, description: t.description, input_schema: t.parameters })),
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

async function callOpenAI(cfg: LlmConfig, i: CallInput): Promise<LlmReply> {
  const userContent: any[] = [{ type: 'text', text: i.text }];
  if (i.imageB64) {
    userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${i.imageB64}`, detail: 'low' } });
  }
  const data = await post(
    'https://api.openai.com/v1/chat/completions',
    { authorization: `Bearer ${cfg.apiKey}` },
    {
      model: cfg.model,
      tools: TOOL_DECLARATIONS.map((t) => ({
        type: 'function',
        function: { name: t.name, description: t.description, parameters: t.parameters },
      })),
      tool_choice: 'required',
      messages: [
        { role: 'system', content: i.system },
        { role: 'user', content: userContent },
      ],
    },
    i.signal,
  );
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
          functionDeclarations: TOOL_DECLARATIONS.map((t) => ({
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
