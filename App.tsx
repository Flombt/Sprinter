import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { useFonts } from 'expo-font';
import { DEFAULT_EXACT_TARGET, type PaceTarget, type RunRecord } from './src/core/types';
import { useKeepAwake } from 'expo-keep-awake';
import { session } from './src/services/session';
import { ThemeProvider, useTheme } from './src/ui/theme';
import { Button, Copy, IconButton, Label, Screen } from './src/ui/components';
import { BottomTabs, type TabItem } from './src/ui/navigation';
import { BottomBarInsetContext } from './src/ui/layout';
import { radii, spacing } from './src/ui/tokens';
import { confirm } from './src/ui/confirm';
import { design, useDesign, AppBackground, PageTransition, BodyText, ActionIcon } from './src/ui/design';
import { RunCountdown } from './src/ui/RunCountdown';
import { startPreparedRun } from './src/services/runPreparation';
import Home from './src/screens/Home';
import Preparation from './src/screens/Preparation';
import RunStats from './src/screens/RunStats';
import Recovery from './src/screens/Recovery';
import History from './src/screens/History';
import Detail from './src/screens/Detail';
import Settings from './src/screens/Settings';
import Music from './src/screens/Music';
import { music } from './src/spotify/device';
import Workouts from './src/screens/Workouts';
import { workouts } from './src/workouts/store';
import PersonalRecords from './src/screens/PersonalRecords';
import Comparison from './src/screens/Comparison';
import Progression from './src/screens/Progression';
import { progression } from './src/progression/store';
import AppleIntegrations from './src/screens/AppleIntegrations';
import { connectAppleIntegrations } from './src/apple/connect';
import RunningTools from './src/screens/RunningTools';
import { connectRunningTools } from './src/tools/connect';

type Tab = 'stats' | 'home' | 'music';
type Page = { name: 'tabs' } | { name: 'recovery' } | { name: 'history' } | { name: 'apple' } | { name: 'prepare' } | { name: 'detail'; run: RunRecord; justFinished?: boolean; returnTo?: 'progression' } | { name: 'records'; returnTo?: 'progression' } | { name: 'compare'; initialId?: string } | { name: 'progression' };
const TAB_ITEMS: readonly TabItem<Tab>[] = [
  { key: 'stats', title: 'Stats', icon: 'stats-chart-outline', selectedIcon: 'stats-chart' },
  { key: 'home', title: 'Courir', icon: 'flash-outline', selectedIcon: 'flash-outline' },
  { key: 'music', title: 'Spotify', icon: 'musical-notes-outline', selectedIcon: 'musical-notes' },
];
function KeepScreenAwake() { useKeepAwake('sprinter-active-screen'); return null; }
function AppContent() {
  const design = useDesign();
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { colors, reduceMotion } = useTheme(); const inset = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home'); const [page, setPage] = useState<Page>({ name: 'tabs' });
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [target, setTarget] = useState<PaceTarget>({ ...DEFAULT_EXACT_TARGET });
  const [countdown, setCountdown] = useState(false);
  const [settingsVisible, setSettingsVisible] = useState(false);
  const [musicVisible, setMusicVisible] = useState(false);
  const [workoutsVisible, setWorkoutsVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  useEffect(() => { void Promise.all([session.initialize(), progression.initialize()]).then(() => progression.reconcile(session.getSnapshot().history)); void music.initialize(); void workouts.initialize(); }, []);
  useEffect(connectAppleIntegrations, []);
  useEffect(connectRunningTools, []);
  useEffect(() => {
    const open = (url: string | null | undefined) => {
      if (url !== 'sprinter://run') return;
      void session.initialize().then(() => { setTab(session.getSnapshot().run ? 'stats' : 'home'); setPage({ name: 'tabs' }); });
    };
    void Linking.getInitialURL().then(open).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => subscription.remove();
  }, []);
  const tabs = () => setPage({ name: 'tabs' });
  const start = () => {
    if (state.recoveryBlocked) { setPage({ name: 'recovery' }); return; }
    setTab('home'); tabs();
    if (!state.run && !state.busy) setCountdown(true);
  };
  const beginRun = () => {
    setCountdown(false);
    void startPreparedRun(target).then(started => { if (started) { setTab('home'); tabs(); void music.onRunStarted(); } });
  };
  const detail = (run: RunRecord, justFinished = false) => setPage({ name: 'detail', run, justFinished });
  const history = () => setPage({ name: 'history' });
  const progress = () => setPage({ name: 'progression' });
  const applePage = () => setPage({ name: 'apple' });
  const openTools = () => setToolsVisible(true);
  const finish = () => confirm('Terminer la course ?', 'Votre sortie sera enregistrée.', 'Enregistrer', () => {
    void session.finish().then(run => { if (run) detail(run, true); });
  });
  const modalVisible = musicVisible || workoutsVisible || toolsVisible || settingsVisible || countdown;
  let content: React.ReactNode;
  if (!state.ready) content = <Screen><View style={{ paddingTop: 100, alignItems: 'center', gap: spacing.xxl }}><Label>SPRINTER</Label><Copy variant="title">Le rythme juste.</Copy>
    {state.error ? <><Copy style={{ color: colors.danger, textAlign: 'center' }}>{state.error}</Copy><Button title="Réessayer" onPress={() => void session.initialize()} /></> : <ActivityIndicator color={colors.dark ? colors.accent : colors.accentInk} size="large" />}</View></Screen>;
  else if (page.name === 'prepare') content = <Preparation state={state} initialTarget={target} onTargetChange={setTarget} onBack={tabs} onStarted={() => { setTab('home'); tabs(); }} onMusic={() => setMusicVisible(true)} onWorkouts={() => setWorkoutsVisible(true)} onTools={openTools} />;
  else if (page.name === 'detail') content = <Detail run={page.run} history={state.history} justFinished={page.justFinished} onBack={page.returnTo === 'progression' ? progress : history} onCompare={() => setPage({ name: 'compare', initialId: page.run.id })} onRecords={() => setPage({ name: 'records', returnTo: page.returnTo })} onApple={applePage} onTools={openTools} onRepeat={() => setPage({ name: 'prepare' })} />;
  else if (page.name === 'records') content = <PersonalRecords history={state.history} onBack={page.returnTo === 'progression' ? progress : history} onDetail={detail} />;
  else if (page.name === 'compare') content = <Comparison history={state.history} initialId={page.initialId} onBack={history} />;
  else if (page.name === 'progression') content = <Progression history={state.history} canStart={!state.run} onBack={history} onDetail={run => setPage({ name: 'detail', run, returnTo: 'progression' })} onStart={() => setPage({ name: 'prepare' })} onRecords={() => setPage({ name: 'records', returnTo: 'progression' })} />;
  else if (page.name === 'apple') content = <AppleIntegrations onBack={tabs} />;
  else if (page.name === 'recovery') content = <Recovery state={state} onBack={tabs} />;
  else if (page.name === 'history') content = <History state={state} onBack={tabs} onDetail={detail} onStart={start} onRecords={() => setPage({ name: 'records' })} onCompare={() => setPage({ name: 'compare' })} onProgression={progress} />;
  else if (tab === 'music') content = <Music foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive} />;
  else if (tab === 'stats') content = <RunStats state={state} target={target} onTargetChange={setTarget} onPrepare={() => setPage({ name: 'prepare' })} onSettings={() => setSettingsVisible(true)} onFinish={finish} />;
  else content = <Home state={state} target={target} onStart={start} onRecovery={() => setPage({ name: 'recovery' })} onPrepare={() => setPage({ name: 'prepare' })} onHistory={history} onStats={() => setTab('stats')} onMusic={() => setTab('music')} onFinish={finish} />;
  return <View style={{ flex: 1, backgroundColor: colors.background }}><View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: 'center', backgroundColor: design.background }}><StatusBar style={colors.dark ? 'light' : 'dark'} />
    <AppBackground />
    {(state.running || state.autoPaused) && !state.backgroundActive && <KeepScreenAwake />}
    <BottomBarInsetContext.Provider value={state.ready && page.name === 'tabs' ? tabBarHeight : 0}>
      <View style={{ flex: 1 }} aria-hidden={modalVisible} accessibilityElementsHidden={modalVisible} importantForAccessibility={modalVisible ? 'no-hide-descendants' : 'auto'}><PageTransition key={page.name === 'tabs' ? tab : page.name}>{content}</PageTransition>
        {state.ready && page.name === 'tabs' && <BottomTabs items={TAB_ITEMS} value={tab} onChange={setTab} onHeightChange={setTabBarHeight} />}
      </View>
    </BottomBarInsetContext.Provider>
    <Modal visible={musicVisible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setMusicVisible(false)}>
      <View style={{ flex: 1, backgroundColor: colors.background }}><AppBackground />{musicVisible && <Music onClose={() => setMusicVisible(false)} foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive} />}</View>
    </Modal>
    <Modal visible={settingsVisible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setSettingsVisible(false)}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        <View style={{ paddingTop: inset.top + 8, paddingHorizontal: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}><BodyText style={{ fontSize: 18, fontWeight: '600' }}>Réglages avancés</BodyText><ActionIcon icon="close" label="Fermer les réglages" onPress={() => setSettingsVisible(false)} /></View>
        {settingsVisible && <Settings state={state} onRecovery={() => { setSettingsVisible(false); setPage({ name: 'recovery' }); }} onApple={() => { setSettingsVisible(false); applePage(); }} onTools={() => { setSettingsVisible(false); openTools(); }} />}
      </View>
    </Modal>
    <Modal visible={workoutsVisible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setWorkoutsVisible(false)}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>{workoutsVisible && <Workouts onClose={() => setWorkoutsVisible(false)} onSelected={() => setWorkoutsVisible(false)} onDetail={run => { setWorkoutsVisible(false); detail(run); }} />}</View>
    </Modal>
    {countdown && <RunCountdown onCancel={() => setCountdown(false)} onComplete={beginRun} />}
    <Modal visible={toolsVisible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setToolsVisible(false)}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>{toolsVisible && <RunningTools onBack={() => setToolsVisible(false)} onPrepare={() => { setToolsVisible(false); if (!session.getSnapshot().run) setPage({ name: 'prepare' }); }} />}</View>
    </Modal>
    {state.message && <View accessibilityRole="alert" style={{ position: 'absolute', top: inset.top + spacing.sm, left: spacing.md, right: spacing.md, borderRadius: radii.card, backgroundColor: colors.raised,
      borderWidth: 1, borderColor: colors.line, paddingLeft: spacing.lg, paddingVertical: spacing.sm, paddingRight: spacing.xs, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', shadowColor: colors.shadow, shadowOpacity: .15, shadowRadius: radii.control, elevation: 5 }}>
      <Copy variant="caption" style={{ flex: 1 }}>{state.message}</Copy><IconButton icon="close" label="Fermer le message" onPress={session.clearMessage} quiet />
    </View>}
  </View></View>;
}
export default function App() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [fontsLoaded, fontError] = useFonts({
    SprinterDisplay: require('./assets/fonts/BarlowCondensed-ExtraBold.ttf'),
    SprinterMetric: require('./assets/fonts/BarlowCondensed-SemiBold.ttf'),
  });
  return <SafeAreaProvider><ThemeProvider appearance={state.settings.appearance}>
    {fontsLoaded || fontError ? <AppContent /> : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: design.background }}><ActivityIndicator color={design.accent} /></View>}
  </ThemeProvider></SafeAreaProvider>;
}
