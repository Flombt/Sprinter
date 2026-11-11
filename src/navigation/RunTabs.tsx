import { useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import type { PaceTarget } from '../core/types';
import Home from '../screens/Home';
import Music from '../screens/Music';
import RunStats from '../screens/RunStats';
import type { SessionState } from '../services/session';
import { BottomBarInsetContext } from '../ui/layout';
import { BottomTabs, TabPane, type TabItem } from '../ui/navigation';

export type Tab = 'stats' | 'home' | 'music';
const tabs: readonly TabItem<Tab>[] = [
  { key: 'stats', title: 'Stats', icon: 'stats-chart-outline' },
  { key: 'home', title: 'Courir', icon: 'flash-outline' },
  { key: 'music', title: 'Spotify', icon: 'musical-notes-outline' },
];

export function RunTabs({
  state, tab, onTabChange, target, onTargetChange, starting, covered, onStart, onRecover, onPrepare, onHistory,
  onSettings, onMusic, onFinish, onConfirmFinish,
}: {
  state: SessionState;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  target: PaceTarget;
  onTargetChange: (target: PaceTarget) => void;
  starting: boolean;
  covered: boolean;
  onStart: () => void;
  onRecover: () => void;
  onPrepare: () => void;
  onHistory: () => void;
  onSettings: () => void;
  onMusic: () => void;
  onFinish: () => void;
  onConfirmFinish: () => void;
}) {
  const focused = useIsFocused();
  const [musicVisited, setMusicVisited] = useState(false);
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const active = focused && !covered;
  const running = state.running || state.autoPaused;
  const hideTabBar = tab === 'home' && running;
  const changeTab = (next: Tab) => {
    if (next === 'music') setMusicVisited(true);
    onTabChange(next);
  };

  return <BottomBarInsetContext.Provider value={hideTabBar ? 0 : tabBarHeight}>
    <TabPane visible={tab === 'home'}>
      <Home
        active={active && tab === 'home'}
        state={state}
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
      <RunStats
        active={active && tab === 'stats'}
        state={state}
        target={target}
        onTargetChange={onTargetChange}
        onPrepare={onPrepare}
        onSettings={onSettings}
        onMusic={onMusic}
        onFinish={onFinish}
        onConfirmFinish={onConfirmFinish}
      />
    </TabPane>
    {(musicVisited || tab === 'music') && <TabPane visible={tab === 'music'}>
      <Music active={active && tab === 'music'} foregroundOnlyRun={running && !state.backgroundActive} />
    </TabPane>}
    <BottomTabs items={tabs} value={tab} hidden={hideTabBar} onChange={changeTab} onHeightChange={setTabBarHeight} />
  </BottomBarInsetContext.Provider>;
}
