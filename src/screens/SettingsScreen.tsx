import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Switch, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as A11y from '../../modules/a11y-control';
import { DEFAULT_MODELS, type Provider } from '../agent/llm';
import { colors, fonts } from '../ui/theme';

type Props = {
  provider: Provider;
  model: string;
  apiKey: string;
  serviceEnabled: boolean;
  modelReady: boolean;
  downloading: number | null;
  speakResults: boolean;
  onSpeakResults: (v: boolean) => void;
  onSave: (v: { provider: Provider; model: string; apiKey: string }) => Promise<void>;
  onDownload: () => void;
  onBack: () => void;
};

const PROVIDERS: Provider[] = ['anthropic', 'openai', 'gemini'];

export function SettingsScreen(p: Props) {
  const insets = useSafeAreaInsets();
  const [provider, setProvider] = useState(p.provider);
  const [model, setModel] = useState(p.model);
  const [apiKey, setApiKey] = useState(p.apiKey);
  const [saved, setSaved] = useState(false);
  useEffect(() => setApiKey(p.apiKey), [p.apiKey]);

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 22, paddingTop: insets.top + 14, gap: 12 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={p.onBack} style={s.back}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
        <Text style={s.title}>Settings</Text>
      </Pressable>

      <Text style={s.label}>Device control</Text>
      <View style={s.card}>
        <Text style={s.row}>Accessibility service: {p.serviceEnabled ? 'Enabled ✅' : 'Off'}</Text>
        {!p.serviceEnabled && (
          <Pressable style={s.btn} onPress={A11y.openAccessibilitySettings}>
            <Text style={s.btnText}>Open accessibility settings</Text>
          </Pressable>
        )}
      </View>

      <Text style={s.label}>AI model</Text>
      <View style={s.seg}>
        {PROVIDERS.map((x) => (
          <Pressable
            key={x}
            style={[s.segItem, x === provider && s.segOn]}
            onPress={() => { setProvider(x); setModel(DEFAULT_MODELS[x]); setSaved(false); }}
          >
            <Text style={[s.segText, x === provider && { color: '#fff' }]}>{x}</Text>
          </Pressable>
        ))}
      </View>
      <TextInput style={s.input} value={model} onChangeText={(t) => { setModel(t); setSaved(false); }} autoCapitalize="none" placeholder="model id" placeholderTextColor={colors.faint} />
      <TextInput style={s.input} value={apiKey} onChangeText={(t) => { setApiKey(t); setSaved(false); }} secureTextEntry autoCapitalize="none" placeholder="API key (stored encrypted on this device)" placeholderTextColor={colors.faint} />
      <Pressable style={s.btn} onPress={async () => { await p.onSave({ provider, model, apiKey }); setSaved(true); }}>
        <Text style={s.btnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
      </Pressable>

      <Text style={s.label}>Voice</Text>
      <View style={s.card}>
        {p.modelReady ? (
          <Text style={s.row}>Speech model ready (runs on this device) ✅</Text>
        ) : (
          <Pressable style={s.btn} onPress={p.onDownload} disabled={p.downloading !== null}>
            <Text style={s.btnText}>
              {p.downloading === null ? 'Download voice model (~32 MB, one time)' : `Downloading… ${Math.round(p.downloading * 100)}%`}
            </Text>
          </Pressable>
        )}
        <View style={s.switchRow}>
          <Text style={s.row}>Speak results aloud</Text>
          <Switch value={p.speakResults} onValueChange={p.onSpeakResults} trackColor={{ true: colors.orange }} />
        </View>
      </View>

      <Text style={s.note}>
        Screenshots and on-screen text are sent to the model you choose while a task runs. Sensitive taps (send, pay, delete…) ask for confirmation.
      </Text>
    </ScrollView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  title: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 20 },
  label: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, marginTop: 10, textTransform: 'uppercase', letterSpacing: 0.6 },
  card: { backgroundColor: colors.card, borderRadius: 12, padding: 14, gap: 12 },
  row: { color: colors.text, fontFamily: fonts.regular, fontSize: 13 },
  switchRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  seg: { flexDirection: 'row', backgroundColor: colors.chip, borderRadius: 10, padding: 3 },
  segItem: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
  segOn: { backgroundColor: colors.orange },
  segText: { color: colors.muted, fontFamily: fonts.medium, fontSize: 13 },
  input: { backgroundColor: colors.chip, borderRadius: 10, paddingHorizontal: 14, height: 46, color: colors.fg, fontFamily: fonts.regular, fontSize: 14 },
  btn: { backgroundColor: colors.orange, borderRadius: 10, minHeight: 44, paddingVertical: 10, paddingHorizontal: 12, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 14, textAlign: 'center' },
  note: { color: colors.faint, fontFamily: fonts.regular, fontSize: 11, lineHeight: 16, marginTop: 6 },
});
