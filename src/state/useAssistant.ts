// Single place that wires voice -> agent -> native control -> UI state.
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, PermissionsAndroid, Platform } from 'react-native';
import * as SecureStore from 'expo-secure-store';
import * as FS from 'expo-file-system/legacy';
import { useSharedValue } from 'react-native-reanimated';
import * as A11y from '../../modules/a11y-control';
import { runAgent, type AgentEvent } from '../agent/agent';
import { DEFAULT_MODELS, type Provider } from '../agent/llm';
import { downloadModel, isModelDownloaded, partialTranscribe, startListening, stopAndTranscribe } from '../voice/stt';
import { speak, stopSpeaking } from '../voice/tts';

export type Phase = 'idle' | 'listening' | 'transcribing' | 'running';
export type Msg = { role: 'user' | 'assistant'; text: string };
export type Convo = { id: string; title: string; at: number; messages: Msg[] };

const K = { key: 'llm_api_key', provider: 'llm_provider', model: 'llm_model' };
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
  const [provider, setProvider] = useState<Provider>('anthropic');
  const [model, setModel] = useState(DEFAULT_MODELS.anthropic);
  const [apiKey, setApiKey] = useState('');
  const [phase, setPhase] = useState<Phase>('idle');
  const [transcript, setTranscript] = useState('');
  const [messages, setMessages] = useState<Msg[]>([]);
  const [modelReady, setModelReady] = useState(false);
  const [downloading, setDownloading] = useState<number | null>(null);
  const [speakResults, setSpeakResults] = useState(true);
  const [history, setHistory] = useState<Convo[]>([]);

  const abortRef = useRef<AbortController | null>(null);
  const partialTimer = useRef<ReturnType<typeof setInterval> | undefined>(undefined);
  const messagesRef = useRef<Msg[]>([]);
  const convoId = useRef<string>('');
  messagesRef.current = messages;

  // ---------------------------------------------------------------- load / persist
  useEffect(() => {
    (async () => {
      const [k, p, m] = await Promise.all(Object.values(K).map((n) => SecureStore.getItemAsync(n)));
      if (k) setApiKey(k);
      if (p === 'anthropic' || p === 'openai' || p === 'gemini') setProvider(p);
      if (m) setModel(m);
      setModelReady(await isModelDownloaded());
      try {
        const raw = await FS.readAsStringAsync(HISTORY_PATH);
        setHistory(JSON.parse(raw));
      } catch {
        /* no history yet */
      }
    })();
  }, []);

  const refreshService = useCallback(() => setServiceEnabled(A11y.isServiceEnabled()), []);

  const saveSettings = async (next: { provider: Provider; model: string; apiKey: string }) => {
    setProvider(next.provider);
    setModel(next.model);
    setApiKey(next.apiKey);
    await SecureStore.setItemAsync(K.key, next.apiKey);
    await SecureStore.setItemAsync(K.provider, next.provider);
    await SecureStore.setItemAsync(K.model, next.model);
  };

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

  // ---------------------------------------------------------------- agent run
  const run = useCallback(
    async (goal: string) => {
      const text = goal.trim();
      if (!text) return;
      if (!apiKey) {
        Alert.alert('Add an API key', 'Open Settings from the menu and add your model API key.');
        return;
      }
      if (!A11y.isServiceEnabled()) {
        Alert.alert('Accessibility service is off', 'Enable "Android Assistant" in Accessibility settings.', [
          { text: 'Open settings', onPress: A11y.openAccessibilitySettings },
          { text: 'Cancel', style: 'cancel' },
        ]);
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
      A11y.setRunning(true, text);

      const setAssistant = (t: string) =>
        setMessages((m) => {
          const copy = m.slice();
          copy[copy.length - 1] = { role: 'assistant', text: t };
          return copy;
        });

      const onEvent = (e: AgentEvent) => {
        if (e.type === 'turn') A11y.setRunning(true, `Step ${e.turn}: ${text}`);
        if (e.type === 'thought') setAssistant(e.text);
        if (e.type === 'action' && !e.ok) setAssistant(`${e.call.name}: ${e.message}`);
        if (e.type === 'done') {
          const final = e.explanation || (e.status === 'success' ? 'Done.' : 'Could not finish the task.');
          setAssistant(final);
          setPhase('idle');
          A11y.setRunning(false);
          // Bring our own UI back so the user sees the result.
          A11y.launchApp(OWN_PACKAGE).catch(() => {});
          if (speakResults) speak(final);
          setTimeout(() => persistConvo(messagesRef.current), 0);
        }
      };

      runAgent({
        goal: text,
        llm: { provider, apiKey, model },
        onEvent,
        signal: ctrl.signal,
        confirm: confirmAsync,
      }).catch((e) => onEvent({ type: 'done', status: 'failed', explanation: String(e?.message ?? e) }));
    },
    [apiKey, provider, model, speakResults, persistConvo],
  );

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

  const toggleMic = useCallback(() => {
    if (phase === 'listening') finishListening();
    else if (phase === 'idle') startVoice();
  }, [phase, finishListening, startVoice]);

  const cancel = useCallback(async () => {
    stopSpeaking();
    if (phase === 'listening') {
      stopPartial();
      await stopAndTranscribe().catch(() => '');
      setPhase('idle');
      setTranscript('');
    } else if (phase === 'running') {
      abortRef.current?.abort();
    }
  }, [phase]);

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

  return {
    level, serviceEnabled, refreshService,
    provider, model, apiKey, saveSettings,
    phase, transcript, messages,
    modelReady, downloading, downloadVoice,
    speakResults, setSpeakResults,
    history, newChat, openConvo,
    run, toggleMic, cancel,
  };
}
