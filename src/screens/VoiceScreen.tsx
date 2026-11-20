import { useState } from 'react';
import {
  ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { SharedValue } from 'react-native-reanimated';
import { Orb } from '../ui/Orb';
import { BottomGlow } from '../ui/BottomGlow';
import { APP_NAME, colors, fonts } from '../ui/theme';
import type { Msg, Phase } from '../state/useAssistant';

type Props = {
  phase: Phase;
  transcript: string;
  messages: Msg[];
  level: SharedValue<number>;
  onMic: () => void;
  onCancel: () => void;
  /** Opens the account menu (Profile / Chat history / Settings). */
  onAvatar: () => void;
  /** Clears the conversation and starts a fresh one. */
  onNewChat: () => void;
  /** First letter of the profile name, shown inside the avatar. */
  initial?: string;
  onSend: (text: string) => void;
};

export function Header({ onAvatar, initial }: { onAvatar: () => void; initial?: string }) {
  return (
    <View style={s.header}>
      <View style={s.avatarSpacer} />
      <View style={s.pill}>
        <Text style={s.pillText}>{APP_NAME}</Text>
        <Ionicons name="chevron-down" size={11} color={colors.muted} style={{ marginLeft: 4 }} />
      </View>
      <Pressable onPress={onAvatar} style={s.avatar} hitSlop={8}>
        {initial ? (
          <Text style={s.avatarText}>{initial}</Text>
        ) : (
          <Ionicons name="person" size={18} color={colors.muted} />
        )}
      </Pressable>
    </View>
  );
}

export function VoiceScreen(p: Props) {
  const insets = useSafeAreaInsets();
  const [typing, setTyping] = useState(false);
  const [draft, setDraft] = useState('');
  const running = p.phase === 'running';
  const listening = p.phase === 'listening';
  const showChat = p.messages.length > 0 && !listening && p.phase !== 'transcribing';
  const tone = running ? 'dim' : p.transcript ? 'amber' : 'orange';

  const send = () => {
    if (!draft.trim()) return;
    p.onSend(draft);
    setDraft('');
    setTyping(false);
  };

  return (
    <KeyboardAvoidingView style={s.root} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <BottomGlow tone={tone} height={340} />
      <View style={{ paddingTop: insets.top + 8, flex: 1 }}>
        <Header onAvatar={p.onAvatar} initial={p.initial} />

        {showChat ? (
          <ScrollView contentContainerStyle={s.chat} showsVerticalScrollIndicator={false}>
            {p.messages.map((m, i) =>
              m.role === 'user' ? (
                <View key={i} style={s.bubble}>
                  <Text style={s.bubbleText}>{m.text}</Text>
                </View>
              ) : (
                <View key={i} style={{ marginTop: 14 }}>
                  {!!m.text && <Text style={s.answer}>{m.text}</Text>}
                  {running && i === p.messages.length - 1 && (
                    <View style={s.loadRow}>
                      <Text style={s.loadText}>Generate Loading</Text>
                      <ActivityIndicator size="small" color={colors.muted} style={{ marginLeft: 6, transform: [{ scale: 0.7 }] }} />
                    </View>
                  )}
                </View>
              ),
            )}
          </ScrollView>
        ) : (
          <View style={s.stage}>
            <View style={s.orbWrap}>
              <Orb size={300} level={p.level} mode={p.phase === 'transcribing' ? 'thinking' : 'listening'} />
            </View>
            {p.transcript ? (
              <View style={s.captionBlock}>
                <Text style={s.transcript}>{p.transcript}</Text>
                <Text style={s.small}>{listening ? 'Listening.' : 'Thinking…'}</Text>
              </View>
            ) : (
              <View style={s.listenBlock}>
                <Ionicons name="ear-outline" size={26} color={colors.muted} />
                <Text style={s.listen}>
                  {listening ? 'I’m Listening..' : p.phase === 'transcribing' ? 'Thinking…' : 'Tap the mic to talk'}
                </Text>
              </View>
            )}
          </View>
        )}

        {running && <Text style={s.paused}>Voice mode paused while generating</Text>}

        {typing && (
          <View style={s.inputRow}>
            <TextInput
              style={s.input}
              value={draft}
              onChangeText={setDraft}
              placeholder="Type a task…"
              placeholderTextColor={colors.faint}
              autoFocus
              onSubmitEditing={send}
              returnKeyType="send"
            />
            <Pressable onPress={send} hitSlop={10}>
              <Ionicons name="arrow-up-circle" size={32} color={colors.orange} />
            </Pressable>
          </View>
        )}

        <View style={[s.controls, { paddingBottom: Math.max(insets.bottom, 12) + 18 }]}>
          <Pressable style={s.sideBtn} onPress={() => setTyping((v) => !v)} disabled={running}>
            <Ionicons name="keypad-outline" size={20} color={colors.text} />
          </Pressable>
          <Pressable onPress={p.onMic} disabled={running || p.phase === 'transcribing'} style={running ? { opacity: 0.45 } : undefined}>
            <LinearGradient colors={['#FF6A1A', '#FF3D00']} style={s.mic}>
              <Ionicons name={listening ? 'stop' : 'mic-outline'} size={listening ? 20 : 24} color="#fff" />
            </LinearGradient>
          </Pressable>
          <Pressable style={s.sideBtn} onPress={listening || running ? p.onCancel : p.onNewChat}>
            <Ionicons name="close" size={22} color={colors.text} />
          </Pressable>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, height: 48 },
  menu: { width: 28, gap: 4 },
  menuLine: { height: 2, width: 18, borderRadius: 1, backgroundColor: colors.muted },
  pill: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.chip, borderRadius: 8, paddingHorizontal: 14, height: 32 },
  pillText: { color: colors.text, fontFamily: fonts.medium, fontSize: 14 },
  avatarSpacer: { width: 34 },
  avatarText: { color: colors.text, fontFamily: fonts.semibold, fontSize: 15 },
  avatar: { width: 34, height: 34, borderRadius: 17, backgroundColor: colors.chip, alignItems: 'center', justifyContent: 'center' },

  stage: { flex: 1, alignItems: 'center' },
  orbWrap: { marginTop: 40 },
  listenBlock: { position: 'absolute', bottom: 56, alignItems: 'center', gap: 10 },
  listen: { color: colors.muted, fontFamily: fonts.semibold, fontSize: 21 },
  captionBlock: { position: 'absolute', bottom: 44, left: 24, right: 24, alignItems: 'center' },
  transcript: { alignSelf: 'stretch', color: colors.fg, fontFamily: fonts.regular, fontSize: 19, lineHeight: 27 },
  small: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginTop: 20 },

  chat: { paddingHorizontal: 22, paddingTop: 22, paddingBottom: 140 },
  bubble: { alignSelf: 'flex-end', maxWidth: '78%', backgroundColor: colors.bubble, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginTop: 8 },
  bubbleText: { color: colors.fg, fontFamily: fonts.medium, fontSize: 13, lineHeight: 19 },
  answer: { color: colors.text, fontFamily: fonts.regular, fontSize: 13, lineHeight: 20 },
  loadRow: { flexDirection: 'row', alignItems: 'center', marginTop: 10 },
  loadText: { color: colors.muted, fontFamily: fonts.regular, fontSize: 12 },
  paused: { textAlign: 'center', color: colors.muted, fontFamily: fonts.regular, fontSize: 12, marginBottom: 22 },

  inputRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginHorizontal: 20, marginBottom: 10, backgroundColor: colors.chip, borderRadius: 24, paddingLeft: 16, paddingRight: 6, height: 48 },
  input: { flex: 1, color: colors.fg, fontFamily: fonts.regular, fontSize: 15 },

  controls: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 32, paddingTop: 8 },
  sideBtn: { width: 44, height: 44, borderRadius: 22, backgroundColor: colors.glass, alignItems: 'center', justifyContent: 'center' },
  mic: { width: 60, height: 60, borderRadius: 30, alignItems: 'center', justifyContent: 'center', shadowColor: '#FF5A00', shadowOpacity: 0.6, shadowRadius: 16, shadowOffset: { width: 0, height: 4 }, elevation: 10 },
});
