import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Linking, Platform, View } from 'react-native';
import { CommonActions, StackActions, useNavigationContainerRef } from '@react-navigation/native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import * as SplashScreen from 'expo-splash-screen';
import { useKeepAwake } from 'expo-keep-awake';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { DEFAULT_EXACT_TARGET, type PaceTarget } from './src/core/types';
import { session, type SessionState } from './src/services/session';
import { shallowEqual, useSessionSelector } from './src/services/useSessionSelector';
import { ThemeProvider, useTheme } from './src/ui/theme';
import { Button, Copy, IconButton, Label, Screen } from './src/ui/components';
import { radii, spacing } from './src/ui/tokens';
import { confirm } from './src/ui/confirm';
import { design } from './src/ui/design';
import { RunCountdown } from './src/ui/RunCountdown';
import { startPreparedRun } from './src/services/runPreparation';
import { music } from './src/spotify/device';
import { workouts } from './src/workouts/store';
import { progression } from './src/progression/store';
import { connectAppleIntegrations } from './src/apple/connect';
import { connectRunningTools } from './src/tools/connect';
import { confirmFinishHaptic } from './src/services/alerts';
import { RootStack } from './src/navigation/RootStack';
import { RunContext } from './src/navigation/RunContext';
import type { RootRoutes } from './src/navigation/routes';

if (Platform.OS !== 'web') void SplashScreen.preventAutoHideAsync().catch(() => undefined);

const selectStartup = ({ ready, error, settings }: SessionState) => ({ ready, error, appearance: settings.appearance });
const selectMessage = (state: SessionState) => state.message;
const selectAwake = (state: SessionState) => (state.running || state.autoPaused) && !state.backgroundActive;

function KeepScreenAwake() {
  useKeepAwake('sprinter-active-screen');
  return null;
}

function SessionOverlay() {
  const message = useSessionSelector(selectMessage);
  const awake = useSessionSelector(selectAwake);
  const { colors } = useTheme();
  const inset = useSafeAreaInsets();
  return <>
    {awake && <KeepScreenAwake />}
    {message && <View accessibilityRole="alert" style={{ position: 'absolute', top: inset.top + spacing.sm, left: spacing.md, right: spacing.md,
      borderRadius: radii.card, backgroundColor: colors.raised, borderWidth: 1, borderColor: colors.line, paddingLeft: spacing.lg,
      paddingVertical: spacing.sm, paddingRight: spacing.xs, flexDirection: 'row', gap: spacing.sm, alignItems: 'center',
      shadowColor: colors.shadow, shadowOpacity: .15, shadowRadius: radii.control, elevation: 5 }}>
      <Copy variant="caption" style={{ flex: 1 }}>{message}</Copy><IconButton icon="close" label="Fermer le message" onPress={session.clearMessage} quiet />
    </View>}
  </>;
}

function AppContent({ ready, error }: { ready: boolean; error: string | null }) {
  const { colors } = useTheme();
  const navigation = useNavigationContainerRef<RootRoutes>();
  const [target, setTarget] = useState<PaceTarget>(DEFAULT_EXACT_TARGET);
  const [countdown, setCountdown] = useState(false);
  const [startingRun, setStartingRun] = useState(false);
  const startInFlight = useRef(false);
  const homeRequest = useRef(0);
  const pendingHome = useRef(false);

  const goHome = useCallback(() => {
    if (!navigation.isReady()) { pendingHome.current = true; return; }
    pendingHome.current = false;
    navigation.dispatch(StackActions.popTo('Tabs', { homeRequest: ++homeRequest.current }));
  }, [navigation]);

  useEffect(() => { void music.initialize(); void workouts.initialize(); }, []);
  useEffect(connectAppleIntegrations, []);
  useEffect(connectRunningTools, []);
  useEffect(() => {
    const open = (url: string | null | undefined) => { if (url === 'sprinter://run') goHome(); };
    void Linking.getInitialURL().then(open).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => subscription.remove();
  }, [goHome]);

  const start = useCallback(() => {
    const state = session.getSnapshot();
    if (state.recoveryBlocked) { navigation.dispatch(StackActions.push('Recovery')); return; }
    goHome();
    if (!state.run && !state.busy && !startInFlight.current) setCountdown(true);
  }, [goHome, navigation]);

  const beginRun = () => {
    setCountdown(false);
    if (startInFlight.current) return;
    startInFlight.current = true;
    setStartingRun(true);
    void startPreparedRun(target).then(started => {
      if (started) { goHome(); void music.onRunStarted(); }
    }).catch(() => session.reportMessage('Le départ a échoué. Réessayez depuis Courir.')).finally(() => {
      startInFlight.current = false;
      setStartingRun(false);
    });
  };

  const finish = useCallback((held = false) => {
    const runId = session.getSnapshot().run?.id;
    const save = () => {
      const current = session.getSnapshot();
      if (!runId || current.run?.id !== runId || current.busy) return;
      confirmFinishHaptic(current.settings.hapticsEnabled);
      void session.finish().then(run => {
        if (!run || !navigation.isReady()) return;
        const tabs = navigation.getRootState()?.routes[0];
        navigation.dispatch(CommonActions.reset({ index: 1, routes: [
          { key: tabs?.key, name: 'Tabs', params: { homeRequest: ++homeRequest.current } },
          { name: 'Detail', params: { runId: run.id, justFinished: true } },
        ] }));
      });
    };
    if (held) save();
    else confirm('Terminer la course ?', 'Votre sortie sera enregistrée.', 'Enregistrer', save);
  }, [navigation]);

  const controls = useMemo(() => ({ target, setTarget, starting: countdown || startingRun, start, finish, goHome }),
    [target, countdown, startingRun, start, finish, goHome]);

  return <View style={{ flex: 1, backgroundColor: colors.background }}>
    <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: 'center' }}>
      <StatusBar style={colors.dark ? 'light' : 'dark'} />
      {ready ? <RunContext.Provider value={controls}>
        <RootStack navigation={navigation} onReady={() => { if (pendingHome.current) goHome(); }} />
        {countdown && <RunCountdown onCancel={() => setCountdown(false)} onComplete={beginRun} />}
      </RunContext.Provider> : <Screen><View style={{ paddingTop: 100, alignItems: 'center', gap: spacing.xxl }}>
        <Label>SPRINTER</Label><Copy variant="title">Le rythme juste.</Copy>
        {error ? <><Copy style={{ color: colors.danger, textAlign: 'center' }}>{error}</Copy><Button title="Réessayer" onPress={() => void session.initialize()} /></>
          : <ActivityIndicator color={colors.dark ? colors.accent : colors.accentInk} size="large" />}
      </View></Screen>}
      <SessionOverlay />
    </View>
  </View>;
}

export default function App() {
  const { ready, error, appearance } = useSessionSelector(selectStartup, true, shallowEqual);
  const splashHidden = useRef(false);
  const [fontsLoaded, fontError] = useFonts({
    SprinterDisplay: require('./assets/fonts/BarlowCondensed-ExtraBold.ttf'),
    SprinterMetric: require('./assets/fonts/BarlowCondensed-SemiBold.ttf'),
  });
  useEffect(() => {
    void Promise.all([session.initialize(), progression.initialize()]).then(() => progression.reconcile(session.getSnapshot().history));
  }, []);
  const readyToShow = (fontsLoaded || !!fontError) && (ready || !!error);
  const onReadyLayout = () => {
    if (splashHidden.current) return;
    splashHidden.current = true;
    if (Platform.OS !== 'web') void SplashScreen.hideAsync().catch(() => undefined);
  };
  return <GestureHandlerRootView style={{ flex: 1 }}><SafeAreaProvider><ThemeProvider appearance={appearance}>
    {readyToShow || splashHidden.current ? <View style={{ flex: 1 }} onLayout={onReadyLayout}><AppContent ready={ready} error={error} /></View>
      : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: design.background }}><ActivityIndicator color={design.accent} /></View>}
  </ThemeProvider></SafeAreaProvider></GestureHandlerRootView>;
}
