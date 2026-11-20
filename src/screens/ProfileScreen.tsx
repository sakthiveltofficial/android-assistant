import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { providerById } from '../agent/providers';
import { localModelById } from '../local/catalog';
import type { Settings } from '../state/settings';
import { colors, fonts } from '../ui/theme';

type Props = { settings: Settings; conversations: number; serviceEnabled: boolean; onSave: (s: Settings) => Promise<void>; onBack: () => void };

export function ProfileScreen({ settings, conversations, serviceEnabled, onSave, onBack }: Props) {
  const insets = useSafeAreaInsets();
  const [name, setName] = useState(settings.profileName);
  const [saved, setSaved] = useState(false);
  useEffect(() => setName(settings.profileName), [settings.profileName]);

  const def = providerById(settings.active);
  const model = def.kind === 'local' ? localModelById(settings.localModelId)?.name ?? 'none selected' : settings.providers[settings.active].model || 'not set';

  return (
    <ScrollView style={s.root} contentContainerStyle={{ padding: 22, paddingTop: insets.top + 14, gap: 14 }} keyboardShouldPersistTaps="handled">
      <Pressable onPress={onBack} style={s.back}>
        <Ionicons name="chevron-back" size={20} color={colors.text} />
        <Text style={s.title}>Profile</Text>
      </Pressable>

      <View style={s.avatarWrap}>
        <View style={s.avatar}>
          {name ? <Text style={s.avatarText}>{name[0].toUpperCase()}</Text> : <Ionicons name="person" size={34} color={colors.muted} />}
        </View>
      </View>

      <Text style={s.label}>Your name</Text>
      <TextInput style={s.input} value={name} onChangeText={(t) => { setName(t); setSaved(false); }} placeholder="What should I call you?" placeholderTextColor={colors.faint} />
      <Pressable style={s.btn} onPress={async () => { await onSave({ ...settings, profileName: name.trim() }); setSaved(true); }}>
        <Text style={s.btnText}>{saved ? 'Saved ✓' : 'Save'}</Text>
      </Pressable>

      <Text style={s.label}>Overview</Text>
      <View style={s.card}>
        <Stat k="Model" v={`${def.label} · ${model}`} />
        <Stat k="Device control" v={serviceEnabled ? 'Enabled' : 'Off'} />
        <Stat k="Conversations" v={String(conversations)} />
      </View>
    </ScrollView>
  );
}

const Stat = ({ k, v }: { k: string; v: string }) => (
  <View style={s.stat}>
    <Text style={s.statK}>{k}</Text>
    <Text style={s.statV} numberOfLines={1}>{v}</Text>
  </View>
);

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  title: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 20 },
  avatarWrap: { alignItems: 'center', marginVertical: 8 },
  avatar: { width: 84, height: 84, borderRadius: 42, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 34 },
  label: { color: colors.muted, fontFamily: fonts.medium, fontSize: 12, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { backgroundColor: colors.chip, borderRadius: 10, paddingHorizontal: 14, height: 46, color: colors.fg, fontFamily: fonts.regular, fontSize: 14 },
  btn: { backgroundColor: colors.orange, borderRadius: 10, height: 44, alignItems: 'center', justifyContent: 'center' },
  btnText: { color: '#fff', fontFamily: fonts.semibold, fontSize: 14 },
  card: { backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14 },
  stat: { flexDirection: 'row', justifyContent: 'space-between', gap: 16, paddingVertical: 13, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line },
  statK: { color: colors.muted, fontFamily: fonts.regular, fontSize: 13 },
  statV: { flex: 1, textAlign: 'right', color: colors.text, fontFamily: fonts.medium, fontSize: 13 },
});
