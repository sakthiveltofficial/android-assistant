import { useEffect, useRef, useState, type ReactNode } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as A11y from '../../modules/a11y-control';
import { fetchModels } from '../agent/models';
import { PROVIDERS, modelSupportsVision, providerById, type ProviderId } from '../agent/providers';
import { LOCAL_MODELS, totalSizeMB, type LocalModel } from '../local/catalog';
import { useLocalModels } from '../local/useLocalModels';
import type { Settings } from '../state/settings';
import { colors, fonts } from '../ui/theme';

type Props = {
  settings: Settings;
  serviceEnabled: boolean;
  modelReady: boolean;
  downloading: number | null;
  onSave: (s: Settings) => Promise<void>;
  onDownload: () => void;
  onBack: () => void;
};

const fmtSize = (mb: number) => (mb >= 1000 ? `${(mb / 1000).toFixed(1)} GB` : `${mb} MB`);

// ---------------------------------------------------------------- small building blocks
function Section({ title, hint, children }: { title: string; hint?: string; children: ReactNode }) {
  return (
    <View style={s.section}>
      <Text style={s.sectionTitle}>{title}</Text>
      {!!hint && <Text style={s.hint}>{hint}</Text>}
      <View style={s.card}>{children}</View>
    </View>
  );
}

function Row({ icon, title, subtitle, right, last }: { icon: keyof typeof Ionicons.glyphMap; title: string; subtitle?: string; right?: ReactNode; last?: boolean }) {
  return (
    <View style={[s.row, !last && s.rowLine]}>
      <View style={s.rowIcon}><Ionicons name={icon} size={17} color={colors.text} /></View>
      <View style={{ flex: 1 }}>
        <Text style={s.rowTitle}>{title}</Text>
        {!!subtitle && <Text style={s.rowSub}>{subtitle}</Text>}
      </View>
      {right}
    </View>
  );
}

function Field({ label, children, help }: { label: string; children: ReactNode; help?: string }) {
  return (
    <View style={s.field}>
      <Text style={s.fieldLabel}>{label}</Text>
      {children}
      {!!help && <Text style={s.hint}>{help}</Text>}
    </View>
  );
}

function ModelPicker({ options, value, onPick }: { options: string[]; value: string; onPick: (m: string) => void }) {
  return (
    <View style={s.picker}>
      <ScrollView nestedScrollEnabled style={{ maxHeight: 260 }}>
        {options.map((m, i) => {
          const on = m === value;
          return (
            <Pressable key={m} style={[s.opt, i > 0 && s.rowLineTop]} onPress={() => onPick(m)}>
              <Text style={[s.optText, on && { color: colors.fg, fontFamily: fonts.semibold }]} numberOfLines={1}>{m}</Text>
              <Ionicons name={on ? 'radio-button-on' : 'radio-button-off'} size={20} color={on ? colors.orange : colors.faint} />
            </Pressable>
          );
        })}
      </ScrollView>
    </View>
  );
}

const Pill = ({ ok, text }: { ok: boolean; text: string }) => (
  <View style={[s.pill, { backgroundColor: ok ? 'rgba(80,200,120,0.15)' : 'rgba(255,255,255,0.08)' }]}>
    <View style={[s.dot, { backgroundColor: ok ? '#4cc777' : colors.muted }]} />
    <Text style={[s.pillText, { color: ok ? '#7be0a0' : colors.muted }]}>{text}</Text>
  </View>
);

// ---------------------------------------------------------------- screen
export function SettingsScreen(p: Props) {
  const insets = useSafeAreaInsets();
  const [draft, setDraft] = useState<Settings>(p.settings);
  const [showKey, setShowKey] = useState(false);
  const local = useLocalModels();
  const [fetched, setFetched] = useState<Partial<Record<ProviderId, string[]>>>({});
  const [fetching, setFetching] = useState(false);
  const [fetchErr, setFetchErr] = useState('');
  const keyAtFetch = useRef('');
  useEffect(() => setDraft(p.settings), [p.settings]);

  const def = providerById(draft.active);
  const cur = draft.providers[draft.active];
  const dirty = JSON.stringify(draft) !== JSON.stringify(p.settings);

  const live = fetched[draft.active];
  const options = live && live.length ? live : def.models;

  const loadModels = async (silent: boolean) => {
    if (def.kind === 'local') return;
    if (def.keyRequired && !cur.apiKey) { if (!silent) setFetchErr('Paste your API key first.'); return; }
    setFetching(true);
    setFetchErr('');
    try {
      const ids = await fetchModels(draft.active, cur.apiKey, cur.baseUrl);
      if (!ids.length) throw new Error('The provider returned no models');
      setFetched((f) => ({ ...f, [draft.active]: ids }));
    } catch (e: any) {
      if (!silent) setFetchErr('Could not load the model list (' + (e?.message ?? e) + ')' + (def.id === 'custom' ? '. You can type a model name instead.' : '. Showing the built-in list.'));
    } finally {
      setFetching(false);
    }
  };

  // Hosted providers: pull the live list once a key is available (silent; the built-in list is the fallback).
  useEffect(() => {
    if (def.id === 'custom' || def.kind === 'local' || !cur.apiKey || fetched[draft.active] || keyAtFetch.current === draft.active + cur.apiKey) return;
    keyAtFetch.current = draft.active + cur.apiKey;
    loadModels(true);
  }, [draft.active, cur.apiKey]);

  // A saved model that is no longer offered (e.g. an old DeepSeek id) falls back to the default.
  useEffect(() => {
    if (def.id === 'custom' || def.kind === 'local') return;
    if (!options.includes(cur.model)) editProvider({ model: def.models.includes(cur.model) ? cur.model : def.defaultModel });
  }, [draft.active, options.length]);

  const edit = (patch: Partial<Settings>) => setDraft((d) => ({ ...d, ...patch }));
  const editProvider = (patch: Partial<typeof cur>) => edit({ providers: { ...draft.providers, [draft.active]: { ...cur, ...patch } } });
  /** Toggles and model picks apply immediately; text fields use the Save bar. */
  const apply = (patch: Partial<Settings>) => { const n = { ...draft, ...patch }; setDraft(n); p.onSave(n); };

  const selectLocal = (m: LocalModel) => apply({ active: 'local' as ProviderId, localModelId: m.id, localVision: draft.localVision && !!m.mmproj });
  const selectedLocal = LOCAL_MODELS.find((m) => m.id === draft.localModelId);

  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ padding: 20, paddingTop: insets.top + 12, paddingBottom: dirty ? 110 : 50 }} keyboardShouldPersistTaps="handled">
        <View style={s.header}>
          <Pressable onPress={p.onBack} hitSlop={10} style={s.backBtn}>
            <Ionicons name="chevron-back" size={22} color={colors.text} />
          </Pressable>
          <Text style={s.title}>Settings</Text>
        </View>

        {/* ---- Device control */}
        <Section title="Device control">
          <Row
            icon="accessibility-outline"
            title="Accessibility service"
            subtitle={p.serviceEnabled ? 'Lets the assistant see and operate the screen' : 'Required so the assistant can tap, type and read the screen'}
            right={p.serviceEnabled ? <Pill ok text="On" /> : (
              <Pressable style={s.small} onPress={A11y.openAccessibilitySettings}><Text style={s.smallText}>Enable</Text></Pressable>
            )}
            last
          />
        </Section>

        {/* ---- AI model */}
        <Section title="AI model" hint="Choose where the assistant's thinking happens.">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
            {PROVIDERS.map((x) => (
              <Pressable key={x.id} style={[s.chip, x.id === draft.active && s.chipOn]} onPress={() => edit({ active: x.id })}>
                <Text style={[s.chipText, x.id === draft.active && s.chipTextOn]}>{x.label}</Text>
              </Pressable>
            ))}
          </ScrollView>
          {!!def.note && <Text style={[s.hint, { marginTop: 10 }]}>{def.note}</Text>}

          {def.kind !== 'local' && (
            <View style={{ marginTop: 14, gap: 16 }}>
              {def.id === 'custom' && (
                <Field label="Base URL" help="Any OpenAI-compatible server (OpenRouter, Groq, Ollama, LM Studio…).">
                  <TextInput style={s.input} value={cur.baseUrl} onChangeText={(t) => editProvider({ baseUrl: t })} autoCapitalize="none" autoCorrect={false} keyboardType="url" placeholder="https://openrouter.ai/api/v1" placeholderTextColor={colors.faint} />
                </Field>
              )}
              <Field label={def.keyRequired ? 'API key' : 'API key (optional)'} help="Stored encrypted on this device and only sent to this provider.">
                <View style={s.inputWrap}>
                  <TextInput style={[s.input, { flex: 1, backgroundColor: 'transparent' }]} value={cur.apiKey} onChangeText={(t) => editProvider({ apiKey: t })} secureTextEntry={!showKey} autoCapitalize="none" autoCorrect={false} placeholder="Paste your key" placeholderTextColor={colors.faint} />
                  <Pressable onPress={() => setShowKey((v) => !v)} hitSlop={10} style={{ paddingRight: 12 }}>
                    <Ionicons name={showKey ? 'eye-off-outline' : 'eye-outline'} size={18} color={colors.muted} />
                  </Pressable>
                </View>
              </Field>

              <Field label="Model">
                {def.id === 'custom' ? (
                  <>
                    <Pressable style={[s.small, { alignSelf: 'flex-start', opacity: fetching ? 0.6 : 1 }]} onPress={() => loadModels(false)} disabled={fetching}>
                      <Text style={s.smallText}>{fetching ? 'Loading…' : live ? 'Refresh model list' : 'Load models from this server'}</Text>
                    </Pressable>
                    {!!fetchErr && <Text style={[s.hint, { color: '#e5736b' }]}>{fetchErr}</Text>}
                    {!!live && live.length > 0 && <ModelPicker options={live} value={cur.model} onPick={(m) => editProvider({ model: m })} />}
                    <TextInput style={s.input} value={cur.model} onChangeText={(t) => editProvider({ model: t })} autoCapitalize="none" autoCorrect={false} placeholder="…or type a model name" placeholderTextColor={colors.faint} />
                  </>
                ) : (
                  <>
                    <ModelPicker options={options} value={cur.model} onPick={(m) => apply({ providers: { ...draft.providers, [draft.active]: { ...cur, model: m } } })} />
                    <Text style={s.hint}>
                      {fetching ? 'Loading your available models…' : live ? 'Live list from ' + def.label + ' for your key.' : cur.apiKey ? fetchErr || 'Built-in list.' : 'Built-in list. Add your key to load the full list.'}
                    </Text>
                    {!modelSupportsVision(def, cur.model, cur.vision) && <Text style={s.hint}>This model is text-only, so the assistant reads the screen as text.</Text>}
                  </>
                )}
              </Field>

              {def.id === 'custom' && (
                <View style={s.switchRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowTitle}>Model accepts screenshots</Text>
                    <Text style={s.rowSub}>Turn off for text-only models.</Text>
                  </View>
                  <Switch value={cur.vision} onValueChange={(v) => editProvider({ vision: v })} trackColor={{ true: colors.orange }} />
                </View>
              )}
            </View>
          )}
        </Section>

        {/* ---- On-device models */}
        {def.kind === 'local' && (
          <Section title="On-device models" hint="Google Gemma, run by llama.cpp on this phone. Downloads are large, so use Wi-Fi. Tap a downloaded model to use it.">
            {LOCAL_MODELS.map((m, i) => {
              const st = local.state[m.id];
              const downloaded = !!st?.downloaded;
              const busy = st?.progress != null;
              const selected = draft.localModelId === m.id && downloaded;
              return (
                <Pressable key={m.id} style={[s.model, i > 0 && s.rowLineTop, selected && s.modelOn]} onPress={() => downloaded && selectLocal(m)}>
                  <View style={{ flex: 1 }}>
                    <Text style={s.modelFamily}>{m.family}{m.recommended ? '  ·  Recommended' : ''}</Text>
                    <Text style={s.modelName}>{m.name}</Text>
                    <Text style={s.rowSub}>{m.blurb}</Text>
                    <Text style={s.modelMeta}>{fmtSize(totalSizeMB(m))} · {m.ramHint}{m.mmproj ? ' · sees screenshots' : ' · text only'}</Text>
                    {busy && <View style={s.bar}><View style={[s.barFill, { width: `${Math.round((st!.progress ?? 0) * 100)}%` }]} /></View>}
                  </View>
                  <View style={s.modelActions}>
                    {busy ? (
                      <Pressable onPress={() => local.cancel(m)} style={s.small}><Text style={s.smallText}>{Math.round((st!.progress ?? 0) * 100)}%  ✕</Text></Pressable>
                    ) : downloaded ? (
                      <>
                        {selected ? <Ionicons name="checkmark-circle" size={24} color={colors.orange} /> : <Text style={s.useText}>Use</Text>}
                        <Pressable onPress={() => local.remove(m)} hitSlop={10}><Ionicons name="trash-outline" size={18} color={colors.muted} /></Pressable>
                      </>
                    ) : (
                      <Pressable onPress={() => local.download(m)} style={s.small}><Text style={s.smallText}>Download</Text></Pressable>
                    )}
                  </View>
                </Pressable>
              );
            })}
            {!!selectedLocal?.mmproj && (
              <View style={[s.switchRow, s.rowLineTop, { paddingTop: 14 }]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowTitle}>Use screenshots</Text>
                  <Text style={s.rowSub}>Off = reads the screen as text only. Much faster on a phone.</Text>
                </View>
                <Switch value={draft.localVision} onValueChange={(v) => apply({ localVision: v })} trackColor={{ true: colors.orange }} />
              </View>
            )}
          </Section>
        )}

        {/* ---- Voice */}
        <Section title="Voice">
          <Row
            icon="mic-outline"
            title="Speech recognition"
            subtitle={p.modelReady ? 'Runs on this device, works offline' : p.downloading !== null ? `Downloading… ${Math.round(p.downloading * 100)}%` : 'One-time 32 MB download'}
            right={p.modelReady ? <Pill ok text="Ready" /> : (
              <Pressable style={[s.small, p.downloading !== null && { opacity: 0.5 }]} onPress={p.onDownload} disabled={p.downloading !== null}>
                <Text style={s.smallText}>Download</Text>
              </Pressable>
            )}
          />
          <View style={[s.row, { paddingBottom: 0 }]}>
            <View style={s.rowIcon}><Ionicons name="volume-high-outline" size={17} color={colors.text} /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle}>Speak results aloud</Text>
            </View>
            <Switch value={draft.speakResults} onValueChange={(v) => apply({ speakResults: v })} trackColor={{ true: colors.orange }} />
          </View>
        </Section>

        {/* ---- Privacy */}
        <View style={s.privacy}>
          <Ionicons name="shield-checkmark-outline" size={16} color={colors.muted} />
          <Text style={[s.hint, { flex: 1 }]}>
            Cloud models receive screenshots and on-screen text while a task runs. On-device models keep everything on the phone. Sensitive taps (send, pay, delete…) always ask first.
          </Text>
        </View>
      </ScrollView>

      {dirty && (
        <View style={[s.saveBar, { paddingBottom: insets.bottom + 12 }]}>
          <Pressable style={s.discard} onPress={() => setDraft(p.settings)}><Text style={s.smallText}>Discard</Text></Pressable>
          <Pressable style={s.save} onPress={() => p.onSave(draft)}><Text style={s.saveText}>Save changes</Text></Pressable>
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 18 },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  title: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 22 },

  section: { marginBottom: 22 },
  sectionTitle: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.7, marginBottom: 8, marginLeft: 4 },
  card: { backgroundColor: colors.card, borderRadius: 16, padding: 14 },
  hint: { color: colors.faint, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, marginBottom: 2 },

  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12 },
  rowLine: { borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  rowLineTop: { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  rowIcon: { width: 32, height: 32, borderRadius: 10, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  rowTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  rowSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, lineHeight: 17, marginTop: 2 },
  switchRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },

  chips: { gap: 8, paddingRight: 8 },
  chip: { backgroundColor: colors.chip, borderRadius: 20, paddingHorizontal: 16, paddingVertical: 9 },
  chipOn: { backgroundColor: colors.orange },
  chipText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  chipTextOn: { color: '#fff' },

  field: { gap: 6 },
  fieldLabel: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  input: { backgroundColor: colors.chip, borderRadius: 12, paddingHorizontal: 14, height: 46, color: colors.fg, fontFamily: fonts.regular, fontSize: 14 },
  inputWrap: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.chip, borderRadius: 12 },
  picker: { backgroundColor: colors.chip, borderRadius: 12, paddingHorizontal: 14 },
  opt: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10, minHeight: 46 },
  optText: { flex: 1, color: colors.muted, fontFamily: fonts.regular, fontSize: 14 },
  mini: { backgroundColor: colors.bg, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, borderWidth: 1, borderColor: 'transparent' },
  miniOn: { borderColor: colors.orange },
  miniText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },

  small: { backgroundColor: colors.chip, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 8 },
  smallText: { color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
  pill: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5 },
  dot: { width: 6, height: 6, borderRadius: 3 },
  pillText: { fontFamily: fonts.medium, fontSize: 12 },

  model: { flexDirection: 'row', gap: 12, paddingVertical: 14, paddingHorizontal: 2 },
  modelOn: { backgroundColor: 'rgba(255,107,26,0.07)', marginHorizontal: -14, paddingHorizontal: 16, borderRadius: 12 },
  modelFamily: { color: colors.orange, fontFamily: fonts.medium, fontSize: 10.5, textTransform: 'uppercase', letterSpacing: 0.5 },
  modelName: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 15, marginTop: 3 },
  modelMeta: { color: colors.faint, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 6 },
  modelActions: { alignItems: 'center', justifyContent: 'center', gap: 14, minWidth: 64 },
  useText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  bar: { height: 4, borderRadius: 2, backgroundColor: colors.chip, marginTop: 10, overflow: 'hidden' },
  barFill: { height: 4, backgroundColor: colors.orange },

  privacy: { flexDirection: 'row', gap: 10, paddingHorizontal: 4 },

  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, flexDirection: 'row', gap: 10, paddingHorizontal: 20, paddingTop: 12, backgroundColor: colors.bg, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  discard: { backgroundColor: colors.chip, borderRadius: 12, height: 48, paddingHorizontal: 20, alignItems: 'center', justifyContent: 'center' },
  save: { flex: 1, backgroundColor: colors.orange, borderRadius: 12, height: 48, alignItems: 'center', justifyContent: 'center' },
  saveText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 15 },
});
