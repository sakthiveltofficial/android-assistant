// Tool layer for the agent loop (port of Artemis's action set to on-device APIs).
// The LLM loop itself (observe -> model -> act) is the next milestone; this file
// defines the tool schema the model sees and executes the calls it returns.
import * as A11y from '../../modules/a11y-control';
import type { ScreenSnapshot } from '../../modules/a11y-control';

export type ToolCall = { name: string; args: Record<string, any> };
export type ToolResult = { ok: boolean; message: string };

/** JSON-schema tool declarations (provider-agnostic; adapt per LLM API). */
export const TOOL_DECLARATIONS = [
  {
    name: 'click',
    description: 'Tap a UI element by its index from the current element list, or by x/y pixel coordinates.',
    parameters: {
      type: 'object',
      properties: {
        index: { type: 'integer', description: 'Element index (preferred)' },
        x: { type: 'integer' },
        y: { type: 'integer' },
        long_press: { type: 'boolean' },
      },
    },
  },
  {
    name: 'swipe',
    description: 'Swipe on screen. Use direction to scroll content.',
    parameters: {
      type: 'object',
      properties: { direction: { type: 'string', enum: ['up', 'down', 'left', 'right'] } },
      required: ['direction'],
    },
  },
  {
    name: 'input_text',
    description: 'Type text into the currently focused input field (tap the field first).',
    parameters: {
      type: 'object',
      properties: { text: { type: 'string' }, append: { type: 'boolean' } },
      required: ['text'],
    },
  },
  {
    name: 'press_key',
    description: 'Press a system key.',
    parameters: {
      type: 'object',
      properties: { key: { type: 'string', enum: ['back', 'home', 'recents', 'notifications', 'quick_settings'] } },
      required: ['key'],
    },
  },
  {
    name: 'launch_app',
    description: 'Open an app by name or package.',
    parameters: { type: 'object', properties: { app: { type: 'string' } }, required: ['app'] },
  },
  {
    name: 'wait',
    description: 'Wait for the screen to update.',
    parameters: { type: 'object', properties: { ms: { type: 'integer' } } },
  },
  {
    name: 'report_task_status',
    description: 'Finish the task. Call when done or when it cannot be completed.',
    parameters: {
      type: 'object',
      properties: {
        status: { type: 'string', enum: ['success', 'failed'] },
        explanation: { type: 'string' },
      },
      required: ['status', 'explanation'],
    },
  },
] as const;

/** Compact text form of the element list for the prompt. */
export function formatElements(s: ScreenSnapshot): string {
  return s.elements
    .map((e) => {
      const flags = [e.clickable && 'click', e.editable && 'edit', e.scrollable && 'scroll', e.checked && 'checked']
        .filter(Boolean)
        .join(',');
      const label = e.text || e.desc || e.id.split('/').pop() || e.class.split('.').pop();
      return `[${e.index}] ${label}${flags ? ` (${flags})` : ''} @${e.center[0]},${e.center[1]}`;
    })
    .join('\n');
}

/** Executes one tool call. `elements` is the snapshot the model saw, so indices resolve correctly. */
export async function executeTool(call: ToolCall, snap: ScreenSnapshot): Promise<ToolResult> {
  const a = call.args;
  try {
    switch (call.name) {
      case 'click': {
        let x = a.x as number | undefined;
        let y = a.y as number | undefined;
        if (typeof a.index === 'number') {
          const el = snap.elements[a.index];
          if (!el) return { ok: false, message: `No element with index ${a.index}` };
          [x, y] = el.center;
        }
        if (x == null || y == null) return { ok: false, message: 'click needs index or x/y' };
        const ok = a.long_press ? await A11y.longPress(x, y) : await A11y.tap(x, y);
        return { ok, message: ok ? `Tapped (${x}, ${y})` : 'Gesture was cancelled' };
      }
      case 'swipe': {
        const { width: w, height: h } = snap;
        const cx = w / 2, cy = h / 2;
        const d = Math.round(h * 0.3);
        const m: Record<string, [number, number, number, number]> = {
          up: [cx, cy + d, cx, cy - d], // content moves up
          down: [cx, cy - d, cx, cy + d],
          left: [cx + d, cy, cx - d, cy],
          right: [cx - d, cy, cx + d, cy],
        };
        const v = m[a.direction];
        if (!v) return { ok: false, message: `Bad direction ${a.direction}` };
        const ok = await A11y.swipe(v[0] | 0, v[1] | 0, v[2] | 0, v[3] | 0);
        return { ok, message: ok ? `Swiped ${a.direction}` : 'Swipe cancelled' };
      }
      case 'input_text': {
        const ok = await A11y.setText(String(a.text), !!a.append);
        return { ok, message: ok ? 'Text entered' : 'No focused input field — tap a text field first' };
      }
      case 'press_key': {
        const ok = await A11y.globalAction(a.key);
        return { ok, message: ok ? `Pressed ${a.key}` : `Could not press ${a.key}` };
      }
      case 'launch_app': {
        const ok = await A11y.launchApp(String(a.app));
        return { ok, message: ok ? `Launched ${a.app}` : `App not found: ${a.app}` };
      }
      case 'wait': {
        await new Promise((r) => setTimeout(r, Math.min(Number(a.ms) || 1000, 10000)));
        return { ok: true, message: 'Waited' };
      }
      default:
        return { ok: false, message: `Unknown tool ${call.name}` };
    }
  } catch (e: any) {
    return { ok: false, message: `Error: ${e?.message ?? e}` };
  }
}
