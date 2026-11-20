// Runs a downloaded Gemma model with llama.cpp (llama.rn) and returns one tool call per turn.
// Local models don't get a native tool channel: the reply is constrained to a JSON schema instead.
import { initLlama, type LlamaContext } from 'llama.rn';
import { TOOL_DECLARATIONS, type ToolDecl } from '../agent/tools';
import type { LlmReply } from '../agent/llm';
import { filePath } from './downloads';
import type { LocalModel } from './catalog';

let ctx: LlamaContext | null = null;
let loadedKey = '';
let visionOn = false;

export function isVisionLoaded() {
  return visionOn;
}

export async function releaseLocal(): Promise<void> {
  const c = ctx;
  ctx = null;
  loadedKey = '';
  visionOn = false;
  if (c) await c.release().catch(() => {});
}

/** Loads (or reuses) the model. `vision` also loads the projector so screenshots can be used. */
export async function loadLocal(model: LocalModel, vision: boolean, onProgress?: (p: number) => void): Promise<void> {
  const key = `${model.id}:${vision && !!model.mmproj}`;
  if (ctx && loadedKey === key) return;
  await releaseLocal();
  const c = await initLlama(
    {
      model: filePath(model.model),
      n_ctx: 6144,
      n_gpu_layers: 0, // CPU only: GPU offload only helps on Adreno devices and is unreliable elsewhere
      ctx_shift: false,
      use_mlock: false,
    },
    onProgress,
  );
  let mm = false;
  if (vision && model.mmproj) {
    mm = await c.initMultimodal({ path: filePath(model.mmproj), use_gpu: false });
  }
  ctx = c;
  loadedKey = key;
  visionOn = mm;
}

const schemaFor = (tools: ToolDecl[]) => ({
  anyOf: tools.map((t) => ({
    type: 'object',
    properties: { thought: { type: 'string' }, tool: { const: t.name }, args: t.parameters },
    required: ['tool', 'args'],
  })),
});

function toolHelp(tools: ToolDecl[]): string {
  return tools
    .map((t) => {
      const props = (t.parameters as any).properties ?? {};
      const args = Object.entries(props)
        .map(([k, v]: [string, any]) => k + (v.enum ? ':' + v.enum.join('|') : ':' + v.type))
        .join(', ');
      return '- ' + t.name + '(' + args + ') - ' + t.description;
    })
    .join('\n');
}

export async function callLocal(
  input: { system: string; text: string; imageB64?: string; signal?: AbortSignal; tools?: ToolDecl[] },
): Promise<LlmReply> {
  if (!ctx) throw new Error('On-device model is not loaded.');
  const c = ctx;
  const tools = input.tools ?? TOOL_DECLARATIONS;
  const onAbort = () => c.stopCompletion().catch(() => {});
  input.signal?.addEventListener('abort', onAbort);
  try {
    const system =
      `${input.system}\n\nTOOLS (choose exactly one):\n${toolHelp(tools)}\n\n` +
      `Reply with ONLY a JSON object: {"thought": "<one short sentence>", "tool": "<tool name>", "args": {...}}.`;
    const userContent: any[] = [{ type: 'text', text: input.text }];
    if (input.imageB64 && visionOn) {
      userContent.push({ type: 'image_url', image_url: { url: `data:image/jpeg;base64,${input.imageB64}` } });
    }
    const result = await c.completion({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: userContent },
      ],
      response_format: { type: 'json_schema', json_schema: { strict: true, schema: schemaFor(tools) } },
      n_predict: 300,
      temperature: 0.2,
      chat_template_kwargs: { enable_thinking: false },
    });
    if (input.signal?.aborted) throw new Error('aborted');
    const raw = (result.content ?? result.text ?? '').trim();
    let obj: any;
    try {
      obj = JSON.parse(raw);
    } catch {
      return { thought: raw.slice(0, 200) };
    }
    if (!tools.some((t) => t.name === obj.tool)) return { thought: String(obj.thought ?? '') };
    return { thought: String(obj.thought ?? ''), toolCall: { name: obj.tool, args: obj.args ?? {} } };
  } finally {
    input.signal?.removeEventListener('abort', onAbort);
  }
}
