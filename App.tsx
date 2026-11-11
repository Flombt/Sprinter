import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StackActions, useNavigationContainerRef } from '@react-navigation/native';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { useKeepAwake } from 'expo-keep-awake';
import { DEFAULT_EXACT_TARGET, type PaceTarget } from './src/core/types';
import { AppSheets, type Sheet } from './src/navigation/AppSheets';
import { RootStack } from './src/navigation/RootStack';
import type { Tab } from './src/navigation/RunTabs';
import type { RootRoutes } from './src/navigation/routes';
import { useRunStart } from './src/navigation/useRunStart';
import { session } from './src/services/session';
import { ThemeProvider, useTheme } from './src/ui/theme';
import { Button, Copy, Label, Screen } from './src/ui/components';
import { palettes, spacing } from './src/ui/tokens';
import { confirm } from './src/ui/confirm';
import { haptic } from './src/ui/haptics';
import { RunCountdown } from './src/ui/RunCountdown';
import { Toast } from './src/ui/Toast';
import { sessionMessageSeverity } from './src/ui/sessionMessageSeverity';
import { music } from './src/spotify/device';
import { workouts } from './src/workouts/store';
import { progression } from './src/progression/store';
import { connectAppleIntegrations } from './src/apple/connect';
import { connectRunningTools } from './src/tools/connect';

function KeepScreenAwake() {
  useKeepAwake('sprinter-active-screen');
  return null;
}

function AppContent() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { colors } = useTheme();
  const navigation = useNavigationContainerRef<RootRoutes>();
  const pendingHome = useRef(false);
  const [tab, setTab] = useState<Tab>('home');
  const [target, setTarget] = useState<PaceTarget>({ ...DEFAULT_EXACT_TARGET });
  const [sheet, setSheet] = useState<Sheet | null>(null);

  useEffect(() => {
    void Promise.all([session.initialize(), progression.initialize()])
      .then(() => progression.reconcile(session.getSnapshot().history));
    void music.initialize();
    void workouts.initialize();
  }, []);
  useEffect(connectAppleIntegrations, []);
  useEffect(connectRunningTools, []);

  const openHome = useCallback(() => {
    setTab('home');
    pendingHome.current = !navigation.isReady();
    if (navigation.isReady() && navigation.canGoBack()) navigation.dispatch(StackActions.popToTop());
  }, [navigation]);

  useEffect(() => {
    const open = (url: string | null | undefined) => {
      if (url === 'sprinter://run') void session.initialize().then(openHome);
    };
    void Linking.getInitialURL().then(open).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => subscription.remove();
  }, [openHome]);

  const openRecovery = useCallback(() => navigation.navigate('Recovery'), [navigation]);
  const runStart = useRunStart(openHome, openRecovery);

  const finish = () => {
    void session.finish().then(run => {
      if (!run) return;
      haptic.success();
      openHome();
      navigation.navigate('RunSummary', { runId: run.id });
    });
  };
  const confirmFinish = () => confirm(
    'Terminer la course ?',
    'Votre sortie sera enregistrée.',
    'Enregistrer',
    finish,
  );
  const modalVisible = sheet !== null || runStart.countdown;
  const foregroundOnlyRun = (state.running || state.autoPaused) && !state.backgroundActive;

  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{
      flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: 'center',
      backgroundColor: colors.background,
    }}>
      <StatusBar style={colors.dark ? 'light' : 'dark'} />
      {foregroundOnlyRun && <KeepScreenAwake />}
      <View
        style={{ flex: 1 }}
        aria-hidden={modalVisible}
        accessibilityElementsHidden={modalVisible}
        importantForAccessibility={modalVisible ? 'no-hide-descendants' : 'auto'}
      >
        {state.ready ? <RootStack
          navigationRef={navigation}
          onReady={() => { if (pendingHome.current) openHome(); }}
          state={state}
          tab={tab}
          onTabChange={setTab}
          target={target}
          onTargetChange={setTarget}
          starting={runStart.starting}
          covered={modalVisible}
          onStart={runStart.request}
          onFinish={finish}
          onConfirmFinish={confirmFinish}
          onOpenSheet={setSheet}
        /> : <Screen>
          <View style={{ paddingTop: 100, alignItems: 'center', gap: spacing.xxl }}>
            <Label>SPRINTER</Label>
            <Copy variant="title">Le rythme juste.</Copy>
            {state.error ? <>
              <Copy style={{ color: colors.danger, textAlign: 'center' }}>{state.error}</Copy>
              <Button title="Réessayer" onPress={() => void session.initialize()} />
            </> : <ActivityIndicator color={colors.dark ? colors.accent : colors.accentInk} size="large" />}
          </View>
        </Screen>}
      </View>
      <AppSheets
        sheet={sheet}
        state={state}
        onClose={() => setSheet(null)}
        onDetail={run => {
          setSheet(null);
          navigation.dispatch(StackActions.push('Detail', { runId: run.id }));
        }}
        onRecovery={() => { setSheet(null); navigation.navigate('Recovery'); }}
        onApple={() => { setSheet(null); navigation.navigate('Apple'); }}
        onPrepare={() => {
          setSheet(null);
          if (!session.getSnapshot().run) navigation.navigate('Preparation');
        }}
        onTools={() => setSheet('tools')}
      />
      {runStart.countdown && <RunCountdown onCancel={runStart.cancel} onComplete={runStart.begin} />}
      <Toast
        message={state.message}
        severity={state.message ? sessionMessageSeverity(state.message) : 'info'}
        covered={modalVisible}
        onClose={session.clearMessage}
      />
    </View>
  </View>;
}

export default function App() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [fontsLoaded, fontError] = useFonts({
    SprinterDisplay: require('./assets/fonts/BarlowCondensed-ExtraBold.ttf'),
    SprinterMetric: require('./assets/fonts/BarlowCondensed-SemiBold.ttf'),
  });
  return <SafeAreaProvider>
    <ThemeProvider appearance={state.settings.appearance}>
      {fontsLoaded || fontError ? <AppContent /> : <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: palettes.dark.background,
      }}>
        <ActivityIndicator color={palettes.dark.accent} />
      </View>}
    </ThemeProvider>
  </SafeAreaProvider>;
}
