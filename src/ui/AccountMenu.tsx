import { Modal, Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from './theme';

type Item = { icon: keyof typeof Ionicons.glyphMap; label: string; onPress: () => void };

/** Dropdown anchored under the top-right avatar. */
export function AccountMenu({ visible, name, onClose, items }: { visible: boolean; name: string; onClose: () => void; items: Item[] }) {
  const insets = useSafeAreaInsets();
  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={s.backdrop} onPress={onClose}>
        <View style={[s.menu, { top: insets.top + 60 }]}>
          <View style={s.head}>
            <View style={s.avatar}>
              {name ? <Text style={s.avatarText}>{name[0].toUpperCase()}</Text> : <Ionicons name="person" size={16} color={colors.muted} />}
            </View>
            <Text style={s.name} numberOfLines={1}>{name || 'Guest'}</Text>
          </View>
          {items.map((it) => (
            <Pressable key={it.label} style={s.row} onPress={() => { onClose(); it.onPress(); }}>
              <Ionicons name={it.icon} size={18} color={colors.text} />
              <Text style={s.rowText}>{it.label}</Text>
            </Pressable>
          ))}
        </View>
      </Pressable>
    </Modal>
  );
}

const s = StyleSheet.create({
  backdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)' },
  menu: { position: 'absolute', right: 16, width: 220, backgroundColor: '#161616', borderRadius: 14, paddingVertical: 6, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  head: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingHorizontal: 14, paddingVertical: 12, borderBottomWidth: StyleSheet.hairlineWidth, borderBottomColor: colors.line, marginBottom: 4 },
  avatar: { width: 30, height: 30, borderRadius: 15, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 14 },
  name: { flex: 1, color: colors.fg, fontFamily: fonts.semibold, fontSize: 14 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingHorizontal: 14, height: 44 },
  rowText: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
});
