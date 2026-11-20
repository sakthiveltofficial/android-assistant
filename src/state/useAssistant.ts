// Single place that wires voice -> agent -> native control -> UI state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import * as FS from 'expo-file-system/legacy';
import { useSharedValue } from 'react-native-reanimated';
import * as A11y from '../../modules/a11y-control';
import { runAgent, type AgentEvent } from '../agent/agent';
import type { LlmConfig } from '../agent/llm';
import { modelSupportsVision, providerById } from '../agent/providers';
import { localModelById } from '../local/catalog';
import { isDownloaded } from '../local/downloads';
import { downloadModel, isModelDownloaded, partialTranscribe, startConversation, startListening, stopAndTranscribe, stopConversation } from '../voice/stt';
import { isSpeaking, speak, stopSpeaking } from '../voice/tts';
import { defaultSettings, loadSettings, saveSettings, type Settings } from './settings';

export type Phase = 'idle' | 'listening' | 'transcribing' | 'running';
export type Msg = { role: 'user' | 'assistant'; text: string };
export type Convo = { id: string; title: string; at: number; messages: Msg[] };

const HISTORY_PATH = (FS.documentDirectory ?? '') + 'conversations.json';
const OWN_PACKAGE = 'com.sakthivel.androidassistant';

function confirmAsync(message: string): Promise<boolean> {
  return new Promise((resolve) =>
    Alert.alert('Confirm action', message, [
      { text: 'Block', style: 'cancel', onPress: () => resolve(false) },
      { text: 'Allow', onPress: () => resolve(true) },
    ], { cancelable: false }),
  );
}

export function useAssistant() {
  const level = useSharedValue(0);
  const [serviceEnabled, setServiceEnabled] = useState(false);
  const [settings, setSettingsState] = useState<Settings>(defaultSettings());
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [modelReady, setModelReady] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [history, setHistory] = useState<Convo[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const partialTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const messagesRef = useRef<Msg[]>([]);
  const convoId = useRef<string>('');
  const [conversation, setConversation] = useState(false);
  const convoOn = useRef(false);
  const phaseRef = useRef<Phase>('idle');
  const runRef = useRef<(g: string) => void>(() => {});
  const settingsRef = useRef(settings);
  messagesRef.current = messages;
  phaseRef.current = phase;
  settingsRef.current = settings;

  // ---------------------------------------------------------------- load / persist
  useEffect(() => {
    (async () => {
      setSettingsState(await loadSettings());
      setModelReady(await isModelDownloaded());
      try {
        setHistory(JSON.parse(await FS.readAsStringAsync(HISTORY_PATH)));
      } catch {
        /* no history yet */
      }
    })();
  }, []);

  const refreshService = useCallback(() => setServiceEnabled(A11y.isServiceEnabled()), []);

  const updateSettings = useCallback(async (next: Settings) => {
    setSettingsState(next);
    settingsRef.current = next;
    await saveSettings(next);
  }, []);

  const persistConvo = useCallback(async (msgs: Msg[]) => {
    if (!msgs.length) return;
    const first = msgs.find((m) => m.role === 'user')?.text ?? 'Conversation';
    setHistory((prev) => {
      const entry: Convo = { id: convoId.current, title: first.slice(0, 60), at: Date.now(), messages: msgs };
      const next = [entry, ...prev.filter((c) => c.id !== entry.id)].slice(0, 30);
      FS.writeAsStringAsync(HISTORY_PATH, JSON.stringify(next)).catch(() => {});
      return next;
    });
  }, []);

  /** Builds the model config for the active provider, or explains what is missing. */
  const resolveLlm = useCallback(async (): Promise<{ cfg?: LlmConfig; error?: string }> => {
    const s = settingsRef.current;
    const def = providerById(s.active);
    const p = s.providers[s.active];
    if (def.kind === 'local') {
      const m = localModelById(s.localModelId);
      if (!m) return { error: 'Pick an on-device model in Settings first.' };
      if (!(await isDownloaded(m))) return { error: `Download "${m.name}" in Settings first.` };
      return { cfg: { provider: 'local', apiKey: '', model: m.id, vision: s.localVision && !!m.mmproj } };
    }
    if (def.keyRequired && !p.apiKey) return { error: `Add your ${def.label} API key in Settings.` };
    if (!p.model.trim()) return { error: 'Enter a model id in Settings.' };
    if (def.id === 'custom' && !p.baseUrl.trim()) return { error: 'Enter the base URL in Settings.' };
    return { cfg: { provider: def.id, apiKey: p.apiKey, model: p.model.trim(), baseUrl: p.baseUrl.trim(), vision: modelSupportsVision(def, p.model.trim(), p.vision) } };
  }, []);

  // ---------------------------------------------------------------- agent run
  const run = useCallback(
    async (goal: string) => {
      const text = goal.trim();
      if (!text) return;
      const { cfg, error } = await resolveLlm();
      if (!cfg) {
        Alert.alert('Almost there', error);
        return;
      }
      if (Platform.OS === 'android' && Platform.Version >= 33) {
        await PermissionsAndroid.request('android.permission.POST_NOTIFICATIONS');
      }
      if (!convoId.current) convoId.current = String(Date.now());
      const ctrl = new AbortController();
      abortRef.current = ctrl;
      setTranscript('');
      setPhase('running');
      setMessages((m) => [...m, { role: 'user', text }, { role: 'assistant', text: '' }]);

      const setAssistant = (t: string) =>
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: 'assistant', text: t };
          return copy;
        });

      let controlling = false;
      const finish = (e: Extract<AgentEvent, { type: 'done' }>) => {
        const final = e.explanation || (e.status === 'success' ? 'Done.' : 'Could not finish the task.');
        setAssistant(final);
        setPhase(convoOn.current ? 'listening' : 'idle');
        if (controlling) {
          // Only after real phone control: drop the overlay and bring our own UI back with the result.
          A11y.setRunning(false);
          A11y.launchApp(OWN_PACKAGE).catch(() => {});
        }
        if (settingsRef.current.speakResults) speak(final);
        setTimeout(() => persistConvo(messagesRef.current), 0);
      };

      // On-device models must be loaded into memory first (can take a while).
      if (cfg.provider === 'local') {
        setAssistant('Loading the on-device model…');
        try {
          const { loadLocal } = require('../local/runtime') as typeof import('../local/runtime');
          await loadLocal(localModelById(cfg.model)!, cfg.vision, (p) => setAssistant(`Loading the on-device model… ${Math.round(p * 100)}%`));
          setAssistant('');
        } catch (e: any) {
          return finish({ type: 'done', status: 'failed', explanation: `Could not load the model: ${e?.message ?? e}` });
        }
      }

      const context = messagesRef.current.slice(-8, -2).map((m) => m.role + ': ' + m.text).join(' | ');
      const onEvent = (e: AgentEvent) => {
        if (e.type === 'control') { controlling = true; A11y.setRunning(true, text); }
        if (e.type === 'turn' && controlling) A11y.setRunning(true, `Step ${e.turn}: ${text}`);
        if (e.type === 'plan') setAssistant('Plan:\n' + e.steps.map((t, i) => `${i + 1}. ${t}`).join('\n'));
        if (e.type === 'step') if (controlling) A11y.setRunning(true, `Step ${e.index + 1}/${e.total}: ${e.text}`);
        if (e.type === 'notice') setAssistant(e.text);
        if (e.type === 'thought') setAssistant(e.text);
        if (e.type === 'action' && !e.ok) setAssistant(`${e.call.name}: ${e.message}`);
        if (e.type === 'done') finish(e);
      };

      runAgent({
        goal: text,
        llm: cfg,
        onEvent,
        signal: ctrl.signal,
        context,
        confirm: confirmAsync,
        maxTurns: cfg.provider === 'local' ? 24 : 40,
      }).catch((e) => onEvent({ type: 'done', status: 'failed', explanation: String(e?.message ?? e) }));
    },
    [resolveLlm, persistConvo],
  );

  runRef.current = run;

  useEffect(() => {
    const sub = A11y.addStopListener(() => abortRef.current?.abort());
    return () => sub.remove();
  }, []);

  // ---------------------------------------------------------------- voice
  const stopPartial = () => {
    if (partialTimer.current) clearInterval(partialTimer.current);
    partialTimer.current = undefined;
  };

  const finishListening = useCallback(async () => {
    stopPartial();
    setPhase('transcribing');
    try {
      const text = await stopAndTranscribe();
      if (text) {
        setTranscript(text);
        run(text);
      } else {
        setTranscript('');
        setPhase('idle');
      }
    } catch (e: any) {
      setPhase('idle');
      Alert.alert('Voice error', String(e?.message ?? e));
    }
  }, [run]);

  const startVoice = useCallback(async () => {
    try {
      stopSpeaking();
      setTranscript('');
      await startListening({ onLevel: (l) => (level.value = l), onAutoStop: () => finishListening() });
      setPhase('listening');
      partialTimer.current = setInterval(async () => {
        const t = await partialTranscribe().catch(() => null);
        if (t) setTranscript(t);
      }, 2500);
    } catch (e: any) {
      setPhase('idle');
      Alert.alert('Voice error', String(e?.message ?? e));
    }
  }, [finishListening, level]);

  /** Hands-free mode: the mic stays open; speaking interrupts the assistant's voice and "stop" aborts a task. */
  const endConversation = useCallback(async () => {
    convoOn.current = false;
    setConversation(false);
    await stopConversation();
    stopSpeaking();
    if (phaseRef.current === 'listening') setPhase('idle');
    level.value = 0;
  }, [level]);

  const beginConversation = useCallback(async () => {
    try {
      stopSpeaking();
      await startConversation({
        onLevel: (l) => (level.value = l),
        isAssistantSpeaking: isSpeaking,
        onSpeechStart: () => { if (isSpeaking()) stopSpeaking(); }, // barge-in
        onUtterance: (text) => {
          setTranscript(text);
          if (phaseRef.current === 'running') {
            if (/^\W*(stop|cancel|abort|never ?mind)\b/i.test(text)) abortRef.current?.abort();
            return;
          }
          runRef.current(text);
        },
      });
      convoOn.current = true;
      setConversation(true);
      setPhase((p) => (p === 'idle' ? 'listening' : p));
    } catch (e: any) {
      Alert.alert('Voice error', String(e?.message ?? e));
    }
  }, [level]);

  const toggleMic = useCallback(() => {
    if (convoOn.current) endConversation();
    else if (phaseRef.current === 'idle') beginConversation();
  }, [endConversation, beginConversation]);

  const cancel = useCallback(async () => {
    stopSpeaking();
    if (convoOn.current && phase !== 'running') {
      await endConversation();
    } else if (phase === 'listening') {
      stopPartial();
      await stopAndTranscribe().catch(() => '');
      setPhase('idle');
      setTranscript('');
    } else if (phase === 'running') {
      abortRef.current?.abort();
    }
  }, [phase, endConversation]);

  const downloadVoice = async () => {
    setDownloading(0);
    try {
      await downloadModel(setDownloading);
      setModelReady(true);
    } catch (e: any) {
      Alert.alert('Download failed', String(e?.message ?? e));
    } finally {
      setDownloading(null);
    }
  };

  const newChat = useCallback(() => {
    convoId.current = String(Date.now());
    setMessages([]);
    setTranscript('');
  }, []);

  const openConvo = useCallback((c: Convo) => {
    convoId.current = c.id;
    setMessages(c.messages);
  }, []);

  const deleteConvo = useCallback((id: string) => {
    setHistory((prev) => {
      const next = prev.filter((c) => c.id !== id);
      FS.writeAsStringAsync(HISTORY_PATH, JSON.stringify(next)).catch(() => {});
      return next;
    });
    if (convoId.current === id) {
      convoId.current = '';
      setMessages([]);
    }
  }, []);

  return {
    level, serviceEnabled, refreshService, deleteConvo,
    settings, updateSettings,
    phase, transcript, messages,
    modelReady, downloading, downloadVoice,
    history, newChat, openConvo,
    run, toggleMic, cancel, conversation,
  };
}
