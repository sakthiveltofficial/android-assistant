// On-device speech-to-text: push-to-talk capture (16 kHz mono PCM) -> whisper.cpp via whisper.rn.
// Nothing is sent over the network except the one-time model download.
import { PermissionsAndroid } from 'react-native';
import * as FS from 'expo-file-system/legacy';
import LiveAudioStream from '@fugood/react-native-audio-pcm-stream';
import { initWhisper, type WhisperContext } from 'whisper.rn/index';

// ~32 MB quantized English-only tiny model from the whisper.cpp project.
const MODEL_URL = 'https://huggingface.co/ggerganov/whisper.cpp/resolve/main/ggml-tiny.en-q5_1.bin';
const MODEL_PATH = (FS.documentDirectory ?? '') + 'ggml-tiny.en-q5_1.bin';
const MIN_MODEL_BYTES = 20 * 1024 * 1024;
const MAX_RECORD_MS = 30_000;
const BYTES_PER_SEC = 16000 * 2;

let ctx: WhisperContext | null = null;
let streamReady = false;
let chunks: Uint8Array[] = [];
let recording = false;
let autoStopTimer: ReturnType<typeof setTimeout> | undefined;
let levelCb: ((level: number) => void) | undefined;
let partialBusy = false;

export async function isModelDownloaded(): Promise<boolean> {
  const info = await FS.getInfoAsync(MODEL_PATH);
  return info.exists && (info as any).size > MIN_MODEL_BYTES;
}

export async function downloadModel(onProgress: (fraction: number) => void): Promise<void> {
  const dl = FS.createDownloadResumable(MODEL_URL, MODEL_PATH, {}, (p) =>
    onProgress(p.totalBytesExpectedToWrite ? p.totalBytesWritten / p.totalBytesExpectedToWrite : 0),
  );
  const res = await dl.downloadAsync();
  if (!res || res.status !== 200 || !(await isModelDownloaded())) {
    await FS.deleteAsync(MODEL_PATH, { idempotent: true });
    throw new Error(`Model download failed (HTTP ${res?.status ?? 'none'})`);
  }
}

async function getContext(): Promise<WhisperContext> {
  if (!ctx) ctx = await initWhisper({ filePath: MODEL_PATH });
  return ctx;
}

function b64ToBytes(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

/** RMS of a little-endian PCM16 chunk, scaled so normal speech lands around 0.3-1. */
function rmsLevel(bytes: Uint8Array): number {
  const n = bytes.length >> 1;
  if (!n) return 0;
  let sum = 0;
  for (let i = 0; i < n; i++) {
    let s = bytes[2 * i] | (bytes[2 * i + 1] << 8);
    if (s & 0x8000) s -= 0x10000;
    sum += s * s;
  }
  return Math.min(1, (Math.sqrt(sum / n) / 32768) * 6);
}

function concat(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, c) => n + c.length, 0);
  const out = new Uint8Array(total);
  let off = 0;
  for (const c of parts) {
    out.set(c, off);
    off += c.length;
  }
  return out;
}

async function pcmToText(bytes: Uint8Array): Promise<string> {
  if (bytes.length < BYTES_PER_SEC * 0.3) return ''; // under ~0.3 s
  const pcm16 = new Int16Array(bytes.buffer, bytes.byteOffset, bytes.length >> 1);
  const f32 = new Float32Array(pcm16.length);
  for (let i = 0; i < pcm16.length; i++) f32[i] = pcm16[i] / 32768;
  const whisper = await getContext();
  const { promise } = whisper.transcribeData(f32.buffer as ArrayBuffer, { language: 'en' });
  const { result } = await promise;
  return result.replace(/\[[A-Z_ ]+\]|\(.*?\)/g, '').trim(); // drop [BLANK_AUDIO], (music) etc.
}

export async function startListening(opts: { onAutoStop?: () => void; onLevel?: (l: number) => void } = {}) {
  const perm = await PermissionsAndroid.request('android.permission.RECORD_AUDIO');
  if (perm !== PermissionsAndroid.RESULTS.GRANTED) throw new Error('Microphone permission denied');
  if (!(await isModelDownloaded())) throw new Error('Voice model not downloaded yet');
  levelCb = opts.onLevel;
  if (!streamReady) {
    LiveAudioStream.init({
      sampleRate: 16000,
      channels: 1,
      bitsPerSample: 16,
      audioSource: 6, // VOICE_RECOGNITION
      bufferSize: 4096,
      wavFile: '',
    });
    LiveAudioStream.on('data', (b64) => {
      if (!recording) return;
      const b = b64ToBytes(b64);
      chunks.push(b);
      levelCb?.(rmsLevel(b));
    });
    streamReady = true;
  }
  chunks = [];
  recording = true;
  LiveAudioStream.start();
  autoStopTimer = setTimeout(() => opts.onAutoStop?.(), MAX_RECORD_MS);
}

/** Transcribes what has been recorded so far without stopping (for live captions). */
export async function partialTranscribe(): Promise<string | null> {
  if (!recording || partialBusy) return null;
  partialBusy = true;
  try {
    return await pcmToText(concat(chunks.slice()));
  } finally {
    partialBusy = false;
  }
}

/** Stops capture and returns the final transcript ('' if nothing intelligible). */
export async function stopAndTranscribe(): Promise<string> {
  clearTimeout(autoStopTimer);
  recording = false;
  levelCb?.(0);
  try {
    await LiveAudioStream.stop();
  } catch {
    /* already stopped */
  }
  const bytes = concat(chunks);
  chunks = [];
  return pcmToText(bytes);
}

export function isListening(): boolean {
  return recording;
}
