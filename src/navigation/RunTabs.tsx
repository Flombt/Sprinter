import { useCallback, useState, type ComponentProps } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { PaceTarget } from '../core/types';
import Home from '../screens/Home';
import Music from '../screens/Music';
import RunStats from '../screens/RunStats';
import StatsDashboard, { type StatsNavigation } from '../screens/StatsDashboard';
import { useLiveSession, type SessionStructure } from '../services/useSessionSelector';
import { MusicDock } from '../spotify/components';
import { BottomBarInsetContext } from '../ui/layout';
import { BottomTabs, TabPane, type TabItem } from '../ui/navigation';

export type Tab = 'stats' | 'home' | 'music';
const tabs: readonly TabItem<Tab>[] = [
  { key: 'music', title: 'Spotify', icon: 'musical-notes-outline' },
  { key: 'home', title: 'Courir', icon: 'flash-outline' },
  { key: 'stats', title: 'Stats', icon: 'stats-chart-outline' },
];

function LiveHome(props: Omit<ComponentProps<typeof Home>, 'state'>) {
  const state = useLiveSession(props.active);
  return <Home {...props} state={state} />;
}

function LiveStats({
  navigation,
  ...props
}: Omit<ComponentProps<typeof RunStats>, 'state' | 'onBack'> & { navigation: StatsNavigation }) {
  const [showRunSettings, setShowRunSettings] = useState(false);
  const state = useLiveSession(props.active && showRunSettings);
  if (showRunSettings) return <RunStats {...props} state={state} onBack={() => setShowRunSettings(false)} />;
  return (
    <StatsDashboard
      {...navigation}
      history={state.history}
      hasRun={!!state.run}
      onRunSettings={() => setShowRunSettings(true)}
    />
  );
}

export function RunTabs({
  state,
  tab,
  onTabChange,
  playlistImport,
  onPlaylistImportRead,
  target,
  onTargetChange,
  starting,
  covered,
  onStart,
  onRecover,
  onPrepare,
  onHistory,
  statsNavigation,
  onSettings,
  onMusic,
  onPlayer,
  onFinish,
  onConfirmFinish,
}: {
  state: SessionStructure;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  playlistImport?: string;
  onPlaylistImportRead: () => void;
  target: PaceTarget;
  onTargetChange: (target: PaceTarget) => void;
  starting: boolean;
  covered: boolean;
  onStart: () => void;
  onRecover: () => void;
  onPrepare: () => void;
  onHistory: () => void;
  statsNavigation: StatsNavigation;
  onSettings: () => void;
  onMusic: () => void;
  onPlayer: () => void;
  onFinish: () => void;
  onConfirmFinish: () => void;
}) {
  const focused = useIsFocused();
  const insets = useSafeAreaInsets();
  const [musicVisited, setMusicVisited] = useState(false);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [playerHeight, setPlayerHeight] = useState(0);
  const active = focused && !covered;
  const running = state.running || state.autoPaused;
  const hideTabBar = tab === 'home' && running;
  const playerBottom = hideTabBar ? insets.bottom : tabBarHeight;
  const bottomInset = hideTabBar && !playerHeight ? 0 : playerBottom + playerHeight;
  const changeTab = useCallback(
    (next: Tab) => {
      if (next === 'music') setMusicVisited(true);
      onTabChange(next);
    },
    [onTabChange],
  );

  return (
    <BottomBarInsetContext.Provider value={bottomInset}>
      <TabPane visible={tab === 'home'}>
        <LiveHome
          active={active && tab === 'home'}
          target={target}
          starting={starting}
          onStart={onStart}
          onRecovery={onRecover}
          onPrepare={onPrepare}
          onHistory={onHistory}
          onStats={() => changeTab('stats')}
          onMusic={() => changeTab('music')}
          onSettings={onSettings}
          onFinish={onFinish}
          onConfirmFinish={onConfirmFinish}
        />
      </TabPane>
      <TabPane visible={tab === 'stats'}>
        <LiveStats
          navigation={statsNavigation}
          active={active && tab === 'stats'}
          target={target}
          onTargetChange={onTargetChange}
          onPrepare={onPrepare}
          onSettings={onSettings}
          onMusic={onMusic}
          onFinish={onFinish}
          onConfirmFinish={onConfirmFinish}
        />
      </TabPane>
      {(musicVisited || tab === 'music') && (
        <TabPane visible={tab === 'music'}>
          <Music
            active={active && tab === 'music'}
            foregroundOnlyRun={running && !state.backgroundActive}
            playlistImport={playlistImport}
            onPlaylistImportRead={onPlaylistImportRead}
          />
        </TabPane>
      )}
      <View
        pointerEvents="box-none"
        onLayout={(event) => setPlayerHeight(event.nativeEvent.layout.height)}
        style={{ position: 'absolute', zIndex: 2, left: 0, right: 0, bottom: playerBottom }}
      >
        <MusicDock active={active} onExpand={onPlayer} />
      </View>
      <BottomTabs
        items={tabs}
        value={tab}
        hidden={hideTabBar}
        onChange={changeTab}
        onHeightChange={setTabBarHeight}
      />
    </BottomBarInsetContext.Provider>
  );
}
