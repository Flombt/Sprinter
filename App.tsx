import { useCallback, useEffect, useRef, useState } from 'react';
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
import { session, type SessionState } from './src/services/session';
import { sameFields } from './src/services/snapshotSelection';
import { useSessionSelector } from './src/services/useSessionSelector';
import { defaultPalettes, ThemeProvider, useTheme } from './src/ui/theme';
import { Button, Copy, Label, Screen } from './src/ui/components';
import { spacing } from './src/ui/tokens';
import { confirm } from './src/ui/confirm';
import { haptic } from './src/ui/haptics';
import { RunCountdown } from './src/ui/RunCountdown';
import { Toast } from './src/ui/Toast';
import { sessionMessageSeverity } from './src/ui/sessionMessageSeverity';
import { music } from './src/spotify/device';
import { playlistFromAppLink } from './src/spotify/links';
import { workouts } from './src/workouts/store';
import { progression } from './src/progression/store';
import { connectAppleIntegrations } from './src/apple/connect';
import { connectRunningTools } from './src/tools/connect';
import { startAppConfig } from './src/account/config';
import { startAccount } from './src/account/account';
import { onAccountSheetRequest } from './src/account/ui/bus';

function KeepScreenAwake() {
  useKeepAwake('sprinter-active-screen');
  return null;
}

const selectAppearance = (state: SessionState) => state.settings.appearance;
const selectStartup = (state: SessionState) => ({ ready: state.ready, error: state.error });
const selectMessage = (state: SessionState) => state.message;
const selectKeepAwake = (state: SessionState) =>
  (state.running || state.autoPaused) && !state.backgroundActive;

function ForegroundAwake() {
  const enabled = useSessionSelector(selectKeepAwake);
  return enabled ? <KeepScreenAwake /> : null;
}

function SessionToast({ covered }: { covered: boolean }) {
  const message = useSessionSelector(selectMessage);
  return (
    <Toast
      message={message}
      severity={message ? sessionMessageSeverity(message) : 'info'}
      covered={covered}
      onClose={session.clearMessage}
    />
  );
}

function AppContent() {
  const startup = useSessionSelector(selectStartup, sameFields);
  const { colors } = useTheme();
  const navigation = useNavigationContainerRef<RootRoutes>();
  const pendingHome = useRef(false);
  const [tab, setTab] = useState<Tab>('home');
  const [playlistImport, setPlaylistImport] = useState<string>();
  const clearPlaylistImport = useCallback(() => setPlaylistImport(undefined), []);
  const [target, setTarget] = useState<PaceTarget>({ ...DEFAULT_EXACT_TARGET });
  const [sheet, setSheet] = useState<Sheet | null>(null);

  useEffect(() => {
    void Promise.all([session.initialize(), progression.initialize()]).then(() =>
      progression.reconcile(session.getSnapshot().history),
    );
    void music.initialize();
    void workouts.initialize();
  }, []);
  useEffect(connectAppleIntegrations, []);
  useEffect(connectRunningTools, []);
  // Configuration distante facultative : sans backend configuré, aucun appel réseau.
  useEffect(startAppConfig, []);
  useEffect(startAccount, []);
  useEffect(() => onAccountSheetRequest(() => setSheet('account')), []);

  const openHome = useCallback(() => {
    setTab('home');
    pendingHome.current = !navigation.isReady();
    if (navigation.isReady() && navigation.canGoBack()) navigation.dispatch(StackActions.popToTop());
  }, [navigation]);

  useEffect(() => {
    const open = (url: string | null | undefined) => {
      if (url === 'sprinter://run') void session.initialize().then(openHome);
      const playlist = playlistFromAppLink(url);
      if (playlist) {
        setPlaylistImport(playlist);
        setTab('music');
        setSheet(null);
        pendingHome.current = false;
        if (navigation.isReady() && navigation.canGoBack()) navigation.dispatch(StackActions.popToTop());
      }
    };
    void Linking.getInitialURL()
      .then(open)
      .catch(() => undefined);
    const subscription = Linking.addEventListener('url', (event) => open(event.url));
    return () => subscription.remove();
  }, [navigation, openHome]);

  const openRecovery = useCallback(() => navigation.navigate('Recovery'), [navigation]);
  const runStart = useRunStart(openHome, openRecovery);

  const finish = () => {
    void session.finish().then((run) => {
      if (!run) return;
      haptic.success();
      openHome();
      navigation.navigate('RunSummary', { runId: run.id });
    });
  };
  const confirmFinish = () =>
    confirm('Terminer la course ?', 'Votre sortie sera enregistrée.', 'Enregistrer', finish);
  const modalVisible = sheet !== null || runStart.countdown;

  return (
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      <View
        style={{
          flex: 1,
          width: '100%',
          maxWidth: Platform.OS === 'web' ? 480 : undefined,
          alignSelf: 'center',
          backgroundColor: colors.background,
        }}
      >
        <StatusBar style={colors.dark ? 'light' : 'dark'} />
        <ForegroundAwake />
        <View
          style={{ flex: 1 }}
          aria-hidden={modalVisible}
          accessibilityElementsHidden={modalVisible}
          importantForAccessibility={modalVisible ? 'no-hide-descendants' : 'auto'}
        >
          {startup.ready ? (
            <RootStack
              navigationRef={navigation}
              onReady={() => {
                if (pendingHome.current) openHome();
              }}
              tab={tab}
              onTabChange={setTab}
              playlistImport={playlistImport}
              onPlaylistImportRead={clearPlaylistImport}
              target={target}
              onTargetChange={setTarget}
              starting={runStart.starting}
              covered={modalVisible}
              onStart={runStart.request}
              onFinish={finish}
              onConfirmFinish={confirmFinish}
              onOpenSheet={setSheet}
            />
          ) : (
            <Screen>
              <View style={{ paddingTop: 100, alignItems: 'center', gap: spacing.xxl }}>
                <Label>SPRINTER</Label>
                <Copy variant="title">Le rythme juste.</Copy>
                {startup.error ? (
                  <>
                    <Copy style={{ color: colors.danger, textAlign: 'center' }}>{startup.error}</Copy>
                    <Button title="Réessayer" onPress={() => void session.initialize()} />
                  </>
                ) : (
                  <ActivityIndicator color={colors.secondary} size="large" />
                )}
              </View>
            </Screen>
          )}
        </View>
        <AppSheets
          sheet={sheet}
          onClose={() => setSheet(null)}
          onDetail={(run) => {
            setSheet(null);
            navigation.dispatch(StackActions.push('Detail', { runId: run.id }));
          }}
          onRecovery={() => {
            setSheet(null);
            navigation.navigate('Recovery');
          }}
          onApple={() => {
            setSheet(null);
            navigation.navigate('Apple');
          }}
          onPrepare={() => {
            setSheet(null);
            if (!session.getSnapshot().run) navigation.navigate('Preparation');
          }}
          onTools={() => setSheet('tools')}
          onAccount={() => setSheet('account')}
        />
        {runStart.countdown && <RunCountdown onCancel={runStart.cancel} onComplete={runStart.begin} />}
        <SessionToast covered={modalVisible} />
      </View>
    </View>
  );
}

export default function App() {
  const appearance = useSessionSelector(selectAppearance);
  const [fontsLoaded, fontError] = useFonts({
    SprinterDisplay: require('./assets/fonts/BarlowCondensed-ExtraBold.ttf'),
    SprinterMetric: require('./assets/fonts/BarlowCondensed-SemiBold.ttf'),
  });
  return (
    <SafeAreaProvider>
      <ThemeProvider appearance={appearance}>
        {fontsLoaded || fontError ? (
          <AppContent />
        ) : (
          <View
            style={{
              flex: 1,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: defaultPalettes.dark.background,
            }}
          >
            <ActivityIndicator color={defaultPalettes.dark.secondary} />
          </View>
        )}
      </ThemeProvider>
    </SafeAreaProvider>
  );
}
