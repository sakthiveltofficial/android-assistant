import { useEffect, useState } from 'react';
import { AppState, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useAssistant } from './src/state/useAssistant';
import { VoiceScreen } from './src/screens/VoiceScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { ProfileScreen } from './src/screens/ProfileScreen';
import { HistoryScreen } from './src/screens/HistoryScreen';
import { AccountMenu } from './src/ui/AccountMenu';
import { ModelMenu, type ModelEntry } from './src/ui/ModelMenu';
import { PROVIDERS } from './src/agent/providers';
import { LOCAL_MODELS } from './src/local/catalog';
import { useLocalModels } from './src/local/useLocalModels';
import { colors } from './src/ui/theme';

// The chat/voice screen is always the main screen. Everything else is reached from the avatar menu.
type Screen = 'main' | 'settings' | 'profile' | 'history';

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [screen, setScreen] = useState<Screen>('main');
  const [menuOpen, setMenuOpen] = useState(false);
  const [modelMenuOpen, setModelMenuOpen] = useState(false);
  const localModels = useLocalModels();
  const a = useAssistant();

  useEffect(() => {
    a.refreshService();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') a.refreshService();
    });
    return () => sub.remove();
  }, [a.refreshService]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (menuOpen) { setMenuOpen(false); return true; }
      if (modelMenuOpen) { setModelMenuOpen(false); return true; }
      if (screen === 'main') return false;
      setScreen('main');
      return true;
    });
    return () => sub.remove();
  }, [screen, menuOpen, modelMenuOpen]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const name = a.settings.profileName;
  const st = a.settings;

  // Models that are ready to use: hosted providers with a key (or a custom endpoint) and downloaded on-device models.
  const entries: ModelEntry[] = [];
  for (const def of PROVIDERS) {
    if (def.kind === 'local') {
      for (const m of LOCAL_MODELS) {
        if (!localModels.state[m.id]?.downloaded) continue;
        entries.push({
          key: 'local:' + m.id,
          title: m.name,
          subtitle: 'On-device · offline',
          active: st.active === 'local' && st.localModelId === m.id,
          onPress: () => a.updateSettings({ ...st, active: 'local', localModelId: m.id, localVision: st.localVision && !!m.mmproj }),
        });
      }
      continue;
    }
    const p = st.providers[def.id];
    const ready = def.id === 'custom' ? !!p.baseUrl && !!p.model : !!p.apiKey && !!p.model;
    if (!ready) continue;
    entries.push({
      key: def.id,
      title: p.model,
      subtitle: def.label,
      active: st.active === def.id,
      onPress: () => a.updateSettings({ ...st, active: def.id }),
    });
  }
  const modelLabel = entries.find((e) => e.active)?.title ?? 'Choose a model';
  const back = () => setScreen('main');

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === 'main' && (
        <VoiceScreen
          phase={a.phase}
          transcript={a.transcript}
          messages={a.messages}
          level={a.level}
          onMic={a.toggleMic}
          onCancel={a.cancel}
          onAvatar={() => setMenuOpen(true)}
          onModel={() => { localModels.refresh(); setModelMenuOpen(true); }}
          modelLabel={modelLabel}
          onNewChat={a.newChat}
          initial={name ? name[0].toUpperCase() : undefined}
          onSend={a.run}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          settings={a.settings}
          serviceEnabled={a.serviceEnabled}
          modelReady={a.modelReady}
          downloading={a.downloading}
          onSave={a.updateSettings}
          onDownload={a.downloadVoice}
          onBack={back}
        />
      )}
      {screen === 'profile' && (
        <ProfileScreen
          settings={a.settings}
          conversations={a.history.length}
          serviceEnabled={a.serviceEnabled}
          onSave={a.updateSettings}
          onBack={back}
        />
      )}
      {screen === 'history' && (
        <HistoryScreen
          history={a.history}
          onOpen={(c) => { a.openConvo(c); back(); }}
          onDelete={a.deleteConvo}
          onBack={back}
        />
      )}

      <ModelMenu visible={modelMenuOpen} entries={entries} onClose={() => setModelMenuOpen(false)} onConfigure={() => setScreen('settings')} />

      <AccountMenu
        visible={menuOpen}
        name={name}
        onClose={() => setMenuOpen(false)}
        items={[
          { icon: 'create-outline', label: 'New chat', onPress: () => { a.newChat(); setScreen('main'); } },
          { icon: 'person-outline', label: 'Profile', onPress: () => setScreen('profile') },
          { icon: 'time-outline', label: 'Chat history', onPress: () => setScreen('history') },
          { icon: 'settings-outline', label: 'Settings', onPress: () => setScreen('settings') },
        ]}
      />
    </SafeAreaProvider>
  );
}
