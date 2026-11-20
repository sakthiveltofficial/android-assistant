import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { colors, fonts } from '../ui/theme';
import type { Convo } from '../state/useAssistant';

type Props = {
  history: Convo[];
  onNewChat: () => void;
  onOpenConvo: (c: Convo) => void;
  onStarter: (task: string) => void;
  onSettings: () => void;
};

const SERVICES: { icon: keyof typeof Ionicons.glyphMap; label: string; color: string }[] = [
  { icon: 'chatbubble-ellipses-outline', label: 'AI Chat', color: colors.orange },
  { icon: 'phone-portrait-outline', label: 'Device Control', color: '#3D8BFF' },
  { icon: 'settings-outline', label: 'Settings', color: '#35C46B' },
];

// Placeholder starter tasks — edit freely.
const STARTERS = [
  { title: 'Device Check-up', sub: 'Battery level and free storage right now.', task: 'Open Settings and tell me the battery level and how much storage is free.', hot: true, icon: 'flash' as const },
  { title: 'Focus Mode', sub: 'Silence distractions for a while.', task: 'Turn on Do Not Disturb.', hot: false, icon: 'bulb-outline' as const },
];

function ago(ts: number) {
  const m = Math.floor((Date.now() - ts) / 60000);
  if (m < 1) return 'now';
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h}h ago` : `${Math.floor(h / 24)}d ago`;
}

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? 'Good Morning!' : h < 18 ? 'Good Afternoon!' : 'Good Evening!';
}

export function HomeScreen(p: Props) {
  const insets = useSafeAreaInsets();
  return (
    <View style={s.root}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + 14, paddingBottom: 130 }} showsVerticalScrollIndicator={false}>
        <View style={s.top}>
          <View>
            <Text style={s.hello}>{greeting()}</Text>
            <Text style={s.sub}>What should I do on your phone?</Text>
          </View>
          <Pressable style={s.avatar} onPress={p.onSettings}>
            <Ionicons name="person" size={20} color={colors.muted} />
          </Pressable>
        </View>

        <View style={s.rowHead}>
          <Text style={s.h}>Services</Text>
          <Text style={s.viewAll}>View all</Text>
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.chips}>
          {SERVICES.map((v) => (
            <Pressable key={v.label} style={s.chip} onPress={v.label === 'Settings' ? p.onSettings : p.onNewChat}>
              <Ionicons name={v.icon} size={15} color={v.color} />
              <Text style={s.chipText}>{v.label}</Text>
            </Pressable>
          ))}
        </ScrollView>

        <Text style={[s.h, { marginTop: 34, marginLeft: 22 }]}>Starters</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.cards}>
          {STARTERS.map((c) => (
            <View key={c.title} style={s.card}>
              {c.hot && (
                <LinearGradient
                  pointerEvents="none"
                  colors={['rgba(255,90,0,0)', 'rgba(255,90,0,0.55)']}
                  style={StyleSheet.absoluteFill}
                />
              )}
              <View style={s.cardIcon}>
                <Ionicons name={c.icon} size={13} color={c.hot ? colors.orange : colors.muted} />
              </View>
              <Text style={[s.cardTitle, c.hot && { color: colors.orange }]}>{c.title}</Text>
              <Text style={s.cardSub}>{c.sub}</Text>
              <Pressable style={s.gen} onPress={() => p.onStarter(c.task)}>
                <Text style={s.genText}>Generate</Text>
              </Pressable>
            </View>
          ))}
        </ScrollView>

        <View style={[s.rowHead, { marginTop: 30 }]}>
          <Text style={s.h}>Previous Conversations</Text>
          <Text style={s.viewAll}>View all</Text>
        </View>
        <View style={{ paddingHorizontal: 22, gap: 8, marginTop: 10 }}>
          {p.history.length === 0 && <Text style={s.empty}>No conversations yet.</Text>}
          {p.history.slice(0, 4).map((c) => (
            <Pressable key={c.id} style={s.convo} onPress={() => p.onOpenConvo(c)}>
              <Ionicons name="chatbubble-outline" size={13} color={colors.muted} />
              <Text style={s.convoText} numberOfLines={1}>{c.title}</Text>
              <Text style={s.convoTime}>{ago(c.at)}</Text>
            </Pressable>
          ))}
        </View>
      </ScrollView>

      <LinearGradient pointerEvents="none" colors={['rgba(0,0,0,0)', '#000']} style={s.fade} />
      <Pressable style={[s.newWrap, { bottom: Math.max(insets.bottom, 12) + 14 }]} onPress={p.onNewChat}>
        <LinearGradient colors={['#E8580F', '#C2410C']} style={s.newBtn}>
          <Text style={s.newText}>New Chat</Text>
        </LinearGradient>
      </Pressable>
    </View>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  top: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22 },
  hello: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 17 },
  sub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11, marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },
  rowHead: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 22, marginTop: 30 },
  h: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 14 },
  viewAll: { color: colors.muted, fontFamily: fonts.regular, fontSize: 11 },
  chips: { paddingHorizontal: 22, gap: 10, marginTop: 12 },
  chip: { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: colors.chip, borderRadius: 8, paddingHorizontal: 12, height: 38 },
  chipText: { color: colors.text, fontFamily: fonts.medium, fontSize: 12 },
  cards: { paddingHorizontal: 22, gap: 12, marginTop: 12 },
  card: { width: 160, height: 176, borderRadius: 14, backgroundColor: colors.card, padding: 14, overflow: 'hidden', borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  cardIcon: { width: 28, height: 28, borderRadius: 8, backgroundColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center' },
  cardTitle: { color: colors.fg, fontFamily: fonts.semibold, fontSize: 13, marginTop: 14 },
  cardSub: { color: colors.muted, fontFamily: fonts.regular, fontSize: 10.5, lineHeight: 15, marginTop: 4 },
  gen: { position: 'absolute', left: 14, right: 14, bottom: 14, height: 32, borderRadius: 8, backgroundColor: '#0E0E0E', alignItems: 'center', justifyContent: 'center' },
  genText: { color: colors.text, fontFamily: fonts.medium, fontSize: 12 },
  convo: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: colors.card, borderRadius: 10, paddingHorizontal: 12, height: 44, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
  convoText: { flex: 1, color: colors.text, fontFamily: fonts.regular, fontSize: 12.5 },
  convoTime: { color: colors.faint, fontFamily: fonts.regular, fontSize: 10.5 },
  empty: { color: colors.faint, fontFamily: fonts.regular, fontSize: 12 },
  fade: { position: 'absolute', left: 0, right: 0, bottom: 0, height: 150 },
  newWrap: { position: 'absolute', left: 22, right: 22 },
  newBtn: { height: 52, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  newText: { color: '#FFD9C2', fontFamily: fonts.semibold, fontSize: 15 },
});
