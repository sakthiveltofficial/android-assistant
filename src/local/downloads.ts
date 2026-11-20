// Resumable model downloads into the app's private storage.
import * as FS from 'expo-file-system/legacy';
import type { LocalFile, LocalModel } from './catalog';

const DIR = (FS.documentDirectory ?? '') + 'llm/';
const handles = new Map<string, FS.DownloadResumable>();
const cancelled = new Set<string>();

export const filePath = (f: LocalFile) => DIR + f.name;

async function ensureDir() {
  const info = await FS.getInfoAsync(DIR);
  if (!info.exists) await FS.makeDirectoryAsync(DIR, { intermediates: true });
}

async function fileOk(f: LocalFile): Promise<boolean> {
  const info = await FS.getInfoAsync(filePath(f));
  return info.exists && (info as any).size >= f.sizeMB * 1024 * 1024 * 0.9;
}

export async function isDownloaded(m: LocalModel): Promise<boolean> {
  if (!(await fileOk(m.model))) return false;
  return m.mmproj ? fileOk(m.mmproj) : true;
}

export async function removeModel(m: LocalModel): Promise<void> {
  for (const f of [m.model, m.mmproj]) {
    if (!f) continue;
    await FS.deleteAsync(filePath(f), { idempotent: true });
    await FS.deleteAsync(filePath(f) + '.part', { idempotent: true });
    await FS.deleteAsync(filePath(f) + '.resume', { idempotent: true });
  }
}

/** Downloads every file of a model, reporting overall progress 0..1. Resumes partial files. */
export async function downloadModel(m: LocalModel, onProgress: (fraction: number) => void): Promise<void> {
  await ensureDir();
  const files = [m.model, m.mmproj].filter(Boolean) as LocalFile[];
  const totalBytes = files.reduce((n, f) => n + f.sizeMB * 1024 * 1024, 0);

  const free = await FS.getFreeDiskStorageAsync();
  if (free < totalBytes * 1.1) {
    throw new Error(`Not enough free storage: need about ${Math.round(totalBytes / 1e9 * 10) / 10} GB.`);
  }

  cancelled.delete(m.id);
  let doneBytes = 0;
  for (const f of files) {
    const fileBytes = f.sizeMB * 1024 * 1024;
    if (await fileOk(f)) {
      doneBytes += fileBytes;
      onProgress(doneBytes / totalBytes);
      continue;
    }
    const part = filePath(f) + '.part';
    const resumeFile = filePath(f) + '.resume';
    let resumeData: string | undefined;
    try {
      resumeData = JSON.parse(await FS.readAsStringAsync(resumeFile)).resumeData;
    } catch {
      /* fresh start */
    }
    let lastSave = 0;
    const dl = FS.createDownloadResumable(
      f.url,
      part,
      {},
      (p) => {
        onProgress((doneBytes + p.totalBytesWritten) / totalBytes);
        const now = Date.now();
        if (now - lastSave > 4000) {
          lastSave = now;
          dl.savable().resumeData && FS.writeAsStringAsync(resumeFile, JSON.stringify(dl.savable())).catch(() => {});
        }
      },
      resumeData,
    );
    handles.set(m.id, dl);
    let res;
    try {
      res = await (resumeData ? dl.resumeAsync() : dl.downloadAsync());
    } catch (e) {
      if (cancelled.has(m.id)) throw new Error('Download cancelled');
      FS.writeAsStringAsync(resumeFile, JSON.stringify(dl.savable())).catch(() => {});
      throw e;
    } finally {
      handles.delete(m.id);
    }
    if (cancelled.has(m.id) || !res) throw new Error('Download cancelled');
    if (res.status !== 200 && res.status !== 206) {
      await FS.deleteAsync(part, { idempotent: true });
      await FS.deleteAsync(resumeFile, { idempotent: true });
      throw new Error(`Download failed (HTTP ${res.status})`);
    }
    await FS.moveAsync({ from: part, to: filePath(f) });
    await FS.deleteAsync(resumeFile, { idempotent: true });
    doneBytes += fileBytes;
  }
  onProgress(1);
}

/** Pauses an in-flight download; partial data is kept so it can resume later. */
export async function cancelDownload(m: LocalModel): Promise<void> {
  cancelled.add(m.id);
  const h = handles.get(m.id);
  if (!h) return;
  try {
    const state = await h.pauseAsync();
    const f = [m.model, m.mmproj].find((x) => x && state.url === x.url);
    if (f) await FS.writeAsStringAsync(filePath(f) + '.resume', JSON.stringify(state));
  } catch {
    /* already finished */
  }
}
