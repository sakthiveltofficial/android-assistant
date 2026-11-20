import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert } from 'react-native';
import { LOCAL_MODELS, type LocalModel } from './catalog';
import { cancelDownload, downloadModel, isDownloaded, removeModel } from './downloads';

export type LocalState = { downloaded: boolean; progress: number | null };

export function useLocalModels() {
  const [state, setState] = useState<Record<string, LocalState>>({});
  const mounted = useRef(true);

  const set = useCallback((id: string, patch: Partial<LocalState>) => {
    if (!mounted.current) return;
    setState((s) => ({ ...s, [id]: { ...(s[id] ?? { downloaded: false, progress: null }), ...patch } }));
  }, []);

  const refresh = useCallback(async () => {
    for (const m of LOCAL_MODELS) set(m.id, { downloaded: await isDownloaded(m) });
  }, [set]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    return () => {
      mounted.current = false;
    };
  }, [refresh]);

  const download = useCallback(
    async (m: LocalModel) => {
      set(m.id, { progress: 0 });
      try {
        await downloadModel(m, (p) => set(m.id, { progress: p }));
        set(m.id, { downloaded: true, progress: null });
      } catch (e: any) {
        set(m.id, { progress: null, downloaded: await isDownloaded(m) });
        if (!String(e?.message).includes('cancelled')) Alert.alert('Download failed', String(e?.message ?? e));
      }
    },
    [set],
  );

  const cancel = useCallback(async (m: LocalModel) => {
    await cancelDownload(m);
  }, []);

  const remove = useCallback(
    async (m: LocalModel) => {
      await removeModel(m);
      set(m.id, { downloaded: false, progress: null });
    },
    [set],
  );

  return { state, download, cancel, remove };
}
