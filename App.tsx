import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { ActivityIndicator, Linking, Modal, Platform, View } from 'react-native';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { StatusBar } from 'expo-status-bar';
import { RunRecord } from './src/core/types';
import { session } from './src/services/session';
import { ThemeProvider, useTheme } from './src/ui/theme';
import { Button, Copy, IconButton, Label, Screen } from './src/ui/components';
import { BottomTabs, type TabItem } from './src/ui/navigation';
import { BottomBarInsetContext } from './src/ui/layout';
import { radii, spacing } from './src/ui/tokens';
import Home from './src/screens/Home';
import Preparation from './src/screens/Preparation';
import Live from './src/screens/Live';
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

type Tab = 'home' | 'workouts' | 'history' | 'music' | 'settings';
type Page = { name: 'tabs' } | { name: 'apple' } | { name: 'prepare' } | { name: 'live' } | { name: 'detail'; run: RunRecord; justFinished?: boolean; returnTo?: 'progression' } | { name: 'records'; returnTo?: 'progression' } | { name: 'compare'; initialId?: string } | { name: 'progression' };
const TAB_ITEMS: readonly TabItem<Tab>[] = [
  { key: 'home', title: 'Courir', icon: 'pulse-outline', selectedIcon: 'pulse' },
  { key: 'history', title: 'Sorties', icon: 'trail-sign-outline', selectedIcon: 'trail-sign' },
  { key: 'workouts', title: 'Séances', icon: 'fitness-outline', selectedIcon: 'fitness' },
  { key: 'music', title: 'Musique', icon: 'musical-notes-outline', selectedIcon: 'musical-notes' },
  { key: 'settings', title: 'Réglages', icon: 'options-outline', selectedIcon: 'options' },
];
function AppContent() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { colors, reduceMotion } = useTheme(); const inset = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>('home'); const [page, setPage] = useState<Page>({ name: 'tabs' });
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [musicVisible, setMusicVisible] = useState(false);
  const [workoutsVisible, setWorkoutsVisible] = useState(false);
  const [toolsVisible, setToolsVisible] = useState(false);
  useEffect(() => { void Promise.all([session.initialize(), progression.initialize()]).then(() => progression.reconcile(session.getSnapshot().history)); void music.initialize(); void workouts.initialize(); }, []);
  useEffect(connectAppleIntegrations, []);
  useEffect(connectRunningTools, []);
  useEffect(() => {
    const open = (url: string | null | undefined) => {
      if (url !== 'sprinter://run') return;
      void session.initialize().then(() => { if (session.getSnapshot().run) setPage({ name: 'live' }); else { setTab('history'); setPage({ name: 'tabs' }); } });
    };
    void Linking.getInitialURL().then(open).catch(() => undefined);
    const subscription = Linking.addEventListener('url', event => open(event.url));
    return () => subscription.remove();
  }, []);
  const tabs = () => setPage({ name: 'tabs' });
  const start = () => setPage(state.run ? { name: 'live' } : { name: 'prepare' });
  const detail = (run: RunRecord, justFinished = false) => setPage({ name: 'detail', run, justFinished });
  const history = () => { setTab('history'); tabs(); };
  const progress = () => setPage({ name: 'progression' });
  const applePage = () => setPage({ name: 'apple' });
  const openTools = () => setToolsVisible(true);
  let content: React.ReactNode;
  if (!state.ready) content = <Screen><View style={{ paddingTop: 100, alignItems: 'center', gap: spacing.xxl }}><Label>SPRINTER</Label><Copy variant="title">Le rythme juste.</Copy>
    {state.error ? <><Copy style={{ color: colors.danger, textAlign: 'center' }}>{state.error}</Copy><Button title="Réessayer" onPress={() => void session.initialize()} /></> : <ActivityIndicator color={colors.dark ? colors.accent : colors.accentInk} size="large" />}</View></Screen>;
  else if (page.name === 'prepare') content = <Preparation state={state} onBack={tabs} onStarted={() => setPage({ name: 'live' })} onMusic={() => setMusicVisible(true)} onWorkouts={() => setWorkoutsVisible(true)} onTools={openTools} />;
  else if (page.name === 'live') content = state.run ? <Live state={state} onClose={tabs} onFinished={run => detail(run, true)} onMusic={() => setMusicVisible(true)} /> : <Home state={state} onStart={start} onHistory={() => setTab('history')} onDetail={detail} onProgression={progress} />;
  else if (page.name === 'detail') content = <Detail run={page.run} history={state.history} justFinished={page.justFinished} onBack={page.returnTo === 'progression' ? progress : history} onCompare={() => setPage({ name: 'compare', initialId: page.run.id })} onRecords={() => setPage({ name: 'records', returnTo: page.returnTo })} onApple={applePage} onTools={openTools} onRepeat={() => setPage({ name: 'prepare' })} />;
  else if (page.name === 'records') content = <PersonalRecords history={state.history} onBack={page.returnTo === 'progression' ? progress : history} onDetail={detail} />;
  else if (page.name === 'compare') content = <Comparison history={state.history} initialId={page.initialId} onBack={history} />;
  else if (page.name === 'progression') content = <Progression history={state.history} canStart={!state.run} onBack={history} onDetail={run => setPage({ name: 'detail', run, returnTo: 'progression' })} onStart={start} onRecords={() => setPage({ name: 'records', returnTo: 'progression' })} />;
  else if (page.name === 'apple') content = <AppleIntegrations onBack={tabs} />;
  else if (tab === 'history') content = <History state={state} onDetail={detail} onStart={start} onRecords={() => setPage({ name: 'records' })} onCompare={() => setPage({ name: 'compare' })} onProgression={progress} />;
  else if (tab === 'music') content = <Music foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive} />;
  else if (tab === 'workouts') content = <Workouts onSelected={() => { if (!state.run) setPage({ name: 'prepare' }); }} onDetail={detail} />;
  else if (tab === 'settings') content = <Settings state={state} onApple={applePage} onTools={openTools} />;
  else content = <Home state={state} onStart={start} onHistory={() => setTab('history')} onDetail={detail} onProgression={progress} />;
  return <View style={{ flex: 1, width: '100%', maxWidth: Platform.OS === 'web' ? 480 : undefined, alignSelf: 'center', backgroundColor: colors.background }}><StatusBar style={colors.dark ? 'light' : 'dark'} />
    <BottomBarInsetContext.Provider value={state.ready && page.name === 'tabs' ? tabBarHeight : 0}>
      <View style={{ flex: 1 }} accessibilityElementsHidden={musicVisible || workoutsVisible || toolsVisible} importantForAccessibility={musicVisible || workoutsVisible || toolsVisible ? 'no-hide-descendants' : 'auto'}>{content}
        {state.ready && page.name === 'tabs' && <BottomTabs items={TAB_ITEMS} value={tab} onChange={setTab} onHeightChange={setTabBarHeight} />}
      </View>
    </BottomBarInsetContext.Provider>
    <Modal visible={musicVisible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setMusicVisible(false)}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>{musicVisible && <Music onClose={() => setMusicVisible(false)} foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive} />}</View>
    </Modal>
    <Modal visible={workoutsVisible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setWorkoutsVisible(false)}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>{workoutsVisible && <Workouts onClose={() => setWorkoutsVisible(false)} onSelected={() => setWorkoutsVisible(false)} onDetail={run => { setWorkoutsVisible(false); detail(run); }} />}</View>
    </Modal>
    <Modal visible={toolsVisible} animationType={reduceMotion ? 'none' : 'slide'} presentationStyle="pageSheet" onRequestClose={() => setToolsVisible(false)}>
      <View style={{ flex: 1, backgroundColor: colors.background }}>{toolsVisible && <RunningTools onBack={() => setToolsVisible(false)} onPrepare={() => { setToolsVisible(false); if (!session.getSnapshot().run) setPage({ name: 'prepare' }); }} />}</View>
    </Modal>
    {state.message && <View accessibilityRole="alert" style={{ position: 'absolute', top: inset.top + spacing.sm, left: spacing.md, right: spacing.md, borderRadius: radii.card, backgroundColor: colors.raised,
      borderWidth: 1, borderColor: colors.line, paddingLeft: spacing.lg, paddingVertical: spacing.sm, paddingRight: spacing.xs, flexDirection: 'row', gap: spacing.sm, alignItems: 'center', shadowColor: colors.shadow, shadowOpacity: .15, shadowRadius: radii.control, elevation: 5 }}>
      <Copy variant="caption" style={{ flex: 1 }}>{state.message}</Copy><IconButton icon="close" label="Fermer le message" onPress={session.clearMessage} quiet />
    </View>}
  </View>;
}
function ThemedApp() {
  const state = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  return <ThemeProvider appearance={state.settings.appearance}><AppContent /></ThemeProvider>;
}
export default function App() { return <SafeAreaProvider><ThemedApp /></SafeAreaProvider>; }
