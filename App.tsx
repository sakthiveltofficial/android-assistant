import { useEffect, useState } from 'react';
import { AppState, BackHandler, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useFonts, Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold } from '@expo-google-fonts/inter';
import { useAssistant } from './src/state/useAssistant';
import { HomeScreen } from './src/screens/HomeScreen';
import { VoiceScreen } from './src/screens/VoiceScreen';
import { SettingsScreen } from './src/screens/SettingsScreen';
import { colors } from './src/ui/theme';

type Screen = 'home' | 'voice' | 'settings';

export default function App() {
  const [fontsLoaded] = useFonts({ Inter_400Regular, Inter_500Medium, Inter_600SemiBold, Inter_700Bold });
  const [screen, setScreen] = useState<Screen>('home');
  const a = useAssistant();

  useEffect(() => {
    a.refreshService();
    const sub = AppState.addEventListener('change', (st) => {
      if (st === 'active') a.refreshService();
    });
    return () => sub.remove();
  }, [a.refreshService]);

  // The agent brings the app back to the front when it finishes: show the conversation.
  useEffect(() => {
    if (a.phase === 'running') setScreen('voice');
  }, [a.phase]);

  useEffect(() => {
    const sub = BackHandler.addEventListener('hardwareBackPress', () => {
      if (screen === 'home') return false;
      setScreen('home');
      return true;
    });
    return () => sub.remove();
  }, [screen]);

  if (!fontsLoaded) return <View style={{ flex: 1, backgroundColor: colors.bg }} />;

  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {screen === 'home' && (
        <HomeScreen
          history={a.history}
          onNewChat={() => { a.newChat(); setScreen('voice'); }}
          onOpenConvo={(c) => { a.openConvo(c); setScreen('voice'); }}
          onStarter={(task) => { a.newChat(); setScreen('voice'); a.run(task); }}
          onSettings={() => setScreen('settings')}
        />
      )}
      {screen === 'voice' && (
        <VoiceScreen
          phase={a.phase}
          transcript={a.transcript}
          messages={a.messages}
          level={a.level}
          onMic={a.toggleMic}
          onCancel={a.cancel}
          onBack={() => setScreen('home')}
          onMenu={() => setScreen('settings')}
          onSend={a.run}
        />
      )}
      {screen === 'settings' && (
        <SettingsScreen
          provider={a.provider}
          model={a.model}
          apiKey={a.apiKey}
          serviceEnabled={a.serviceEnabled}
          modelReady={a.modelReady}
          downloading={a.downloading}
          speakResults={a.speakResults}
          onSpeakResults={a.setSpeakResults}
          onSave={a.saveSettings}
          onDownload={a.downloadVoice}
          onBack={() => setScreen('home')}
        />
      )}
    </SafeAreaProvider>
  );
}
