import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../ui/theme';
import type { Convo } from '../state/useAssistant';

function ago(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

export function HistoryScreen({ history, onOpen, onDelete, onBack }: { history: Convo[]; onOpen: (c: Convo) => void; onDelete: (id: string) => void; onBack: () => void }) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ padding: 22, paddingTop: insets.top + 14, paddingBottom: 40, gap: 8 }}>
        <Pressable onPress={onBack} style={s.back}>
          <Ionicons name="chevron-back" size={20} color={colors.text} />
          <Text style={s.title}>Chat history</Text>
        </Pressable>
        {history.length === 0 && <Text style={s.empty}>No conversations yet. Ask the assistant something and it will show up here.</Text>}
        {history.map((c) => (
          <Pressable key={c.id} style={s.row} onPress={() => onOpen(c)}>
            <Ionicons name="chatbubble-outline" size={15} color={colors.muted} />
            <View style={{ flex: 1 }}>
              <Text style={s.rowTitle} numberOfLines={1}>{c.title}</Text>
              <Text style={s.rowMeta}>{c.messages.filter((m) => m.role === 'user').length} message(s) · {ago(c.at)}</Text>
            </View>
            <Pressable onPress={() => onDelete(c.id)} hitSlop={10}>
              <Ionicons name="trash-outline" size={18} color={colors.muted} />
            </Pressable>
          </Pressable>
        ))}
      </ScrollView>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  back: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 10 },
  title: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 20 },
  empty: { color: colors.faint, fontFamily: fonts.regular, fontSize: 13, lineHeight: 19 },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: colors.card, borderRadius: 12, paddingHorizontal: 14, height: 62 },
  rowTitle: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  rowMeta: { color: colors.faint, fontFamily: fonts.regular, fontSize: 11.5, marginTop: 3 },
});
