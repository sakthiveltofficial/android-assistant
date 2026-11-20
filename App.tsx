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
import { colors } from './src/ui/theme';

// The chat/voice screen is always the main screen. Everything else is reached from the avatar menu.
type Screen = 'main' | 'settings' | 'profile' | 'history';

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [screen, setScreen] = useState<Screen>('main');
  const [menuOpen, setMenuOpen] = useState(false);
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
      if (screen === 'main') return false;
      setScreen('main');
      return true;
    });
    return () => sub.remove();
  }, [screen, menuOpen]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  const name = a.settings.profileName;
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

      <AccountMenu
        visible={menuOpen}
        name={name}
        onClose={() => setMenuOpen(false)}
        items={[
          { icon: 'person-outline', label: 'Profile', onPress: () => setScreen('profile') },
          { icon: 'time-outline', label: 'Chat history', onPress: () => setScreen('history') },
          { icon: 'settings-outline', label: 'Settings', onPress: () => setScreen('settings') },
        ]}
      />
    </SafeAreaProvider>
  );
}
