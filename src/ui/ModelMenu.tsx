import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from './theme';

export type ModelEntry = { key: string; title: string; subtitle: string; active: boolean; onPress: () => void };

/** Dropdown under the top pill: switch between the models that are already set up, or jump to Settings. */
export function ModelMenu({ visible, entries, onClose, onConfigure }: { visible: boolean; entries: ModelEntry[]; onClose: () => void; onConfigure: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <View style={[s.menu, { top: insets.top + 60 }]}>
          <Text style={s.head}>Model</Text>
          {entries.length === 0 && <Text style={s.empty}>No model is set up yet. Add an API key or download an on-device model.</Text>}
          {entries.map((e) => (
            <Pressable key={e.key} style={s.row} onPress={() => { onClose(); e.onPress(); }}>
              <View style={{ flex: 1 }}>
                <Text style={[s.title, e.active && { color: colors.fg }]} numberOfLines={1}>{e.title}</Text>
                <Text style={s.sub} numberOfLines={1}>{e.subtitle}</Text>
              </View>
              {e.active && <Ionicons name="checkmark-circle" size={20} color={colors.orange} />}
            </Pressable>
          ))}
          <Pressable style={s.configure} onPress={() => { onClose(); onConfigure(); }}>
            <Ionicons name="options-outline" size={18} color={colors.orange} />
            <Text style={s.configureText}>{entries.length ? 'Manage models' : 'Set up a model'}</Text>
          </Pressable>
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  menu: { position: 'absolute', alignSelf: 'center', width: 300, maxWidth: '92%', backgroundColor: '#161616', borderRadius: 16, paddingVertical: 8, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  head: { color: colors.muted, fontFamily: fonts.medium, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.7, paddingHorizontal: 16, paddingVertical: 8 },
  empty: { color: colors.faint, fontFamily: fonts.regular, fontSize: 12.5, lineHeight: 18, paddingHorizontal: 16, paddingBottom: 10 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, minHeight: 54 },
  title: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  sub: { color: colors.faint, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 2 },
  configure: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 16, height: 50, marginTop: 4, borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: colors.line },
  configureText: { color: colors.orange, fontFamily: fonts.semibold, fontSize: 14 },
});
