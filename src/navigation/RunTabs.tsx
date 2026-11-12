import { memo, useMemo, useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { NativeStackScreenProps, NativeStackNavigationProp } from '@react-navigation/native-stack';
import { View } from 'react-native';
import Home from '../screens/Home';
import RunStats from '../screens/RunStats';
import Music from '../screens/Music';
import { useSessionSelector } from '../services/useSessionSelector';
import type { SessionState } from '../services/session';
import { BottomBarInsetContext } from '../ui/layout';
import { BottomTabs, TabTransition, useTabActive, type TabItem } from '../ui/navigation';
import { useRunControls } from './RunContext';
import type { RootRoutes } from './routes';

type Tab = 'stats' | 'home' | 'music';
type Navigation = NativeStackNavigationProp<RootRoutes, 'Tabs'>;
const items: readonly TabItem<Tab>[] = [
  { key: 'stats', title: 'Stats', icon: 'stats-chart-outline', selectedIcon: 'stats-chart' },
  { key: 'home', title: 'Courir', icon: 'flash-outline', selectedIcon: 'flash' },
  { key: 'music', title: 'Spotify', icon: 'musical-notes-outline', selectedIcon: 'musical-notes' },
];

const selectSession = (state: SessionState) => state;
const selectForegroundRun = (state: SessionState) => (state.running || state.autoPaused) && !state.backgroundActive;

const HomePane = memo(function HomePane({ navigation, setTab }: { navigation: Navigation; setTab: (tab: Tab) => void }) {
  const controls = useRunControls();
  const focused = useIsFocused();
  const active = useTabActive() && focused;
  const actions = useMemo(() => ({
    onRecovery: () => navigation.push('Recovery'), onPrepare: () => navigation.push('Preparation'),
    onHistory: () => navigation.push('History'), onStats: () => setTab('stats'), onMusic: () => setTab('music'),
    onSettings: () => navigation.push('Settings'),
  }), [navigation, setTab]);
  return <Home {...actions} active={active} target={controls.target} starting={controls.starting}
    onStart={controls.start} onFinish={controls.finish} />;
});

const StatsPane = memo(function StatsPane({ navigation }: { navigation: Navigation }) {
  const controls = useRunControls();
  const focused = useIsFocused();
  const active = useTabActive() && focused;
  const state = useSessionSelector(selectSession, active);
  return <RunStats state={state} target={controls.target} onTargetChange={controls.setTarget}
    onPrepare={() => navigation.push('Preparation')} onSettings={() => navigation.push('Settings')} onFinish={controls.finish} />;
});

const MusicPane = memo(function MusicPane({ navigation }: { navigation: Navigation }) {
  const focused = useIsFocused();
  const active = useTabActive() && focused;
  const foregroundOnlyRun = useSessionSelector(selectForegroundRun, active);
  return <Music active={active} foregroundOnlyRun={foregroundOnlyRun} onAccount={() => navigation.push('SpotifyAccount')}
    onTracks={playlist => navigation.push('SpotifyTracks', { playlist })} />;
});

export function RunTabs({ navigation, route }: NativeStackScreenProps<RootRoutes, 'Tabs'>) {
  const request = route.params?.homeRequest;
  const [seenRequest, setSeenRequest] = useState(request);
  const [tab, setTab] = useState<Tab>('home');
  const [barHeight, setBarHeight] = useState(0);
  if (seenRequest !== request) { setSeenRequest(request); setTab('home'); }
  const content = tab === 'home' ? <HomePane navigation={navigation} setTab={setTab} />
    : tab === 'stats' ? <StatsPane navigation={navigation} /> : <MusicPane navigation={navigation} />;
  return <BottomBarInsetContext.Provider value={barHeight}>
    <View style={{ flex: 1 }}>
      <TabTransition value={tab}>{content}</TabTransition>
      <BottomTabs items={items} value={tab} onChange={setTab} onHeightChange={setBarHeight} />
    </View>
  </BottomBarInsetContext.Provider>;
}
