import { useState } from 'react';
import { useIsFocused } from '@react-navigation/native';
import { View } from 'react-native';
import type { PaceTarget } from '../core/types';
import { DiscoveryHome } from '../discovery/DiscoveryHome';
import Home from '../screens/Home';
import LiveRun from '../screens/LiveRun';
import ProfileTab from '../screens/ProfileTab';
import StatsDashboard, { type StatsNavigation } from '../screens/StatsDashboard';
import type { SessionStructure } from '../services/useSessionSelector';
import { MusicDock } from '../spotify/components';
import { Button } from '../ui/components';
import { BottomBarInsetContext } from '../ui/layout';
import { BottomTabs, TabPane, type TabItem } from '../ui/navigation';
import { layout, spacing } from '../ui/tokens';
import type { Sheet } from './AppSheets';

export type Tab = 'home' | 'discover' | 'progress' | 'profile';

const tabs: readonly TabItem<Tab>[] = [
  { key: 'home', title: 'Courir', icon: 'flash-outline' },
  { key: 'discover', title: 'Découvrir', icon: 'compass-outline' },
  { key: 'progress', title: 'Progrès', icon: 'stats-chart-outline' },
  { key: 'profile', title: 'Profil', icon: 'person-outline' },
];

export function RunTabs({
  state,
  tab,
  onTabChange,
  homeRequest,
  target,
  starting,
  covered,
  onStart,
  onRecover,
  onPrepare,
  onWorkouts,
  onDiscoveryDetail,
  statsNavigation,
  onRunStats,
  onOpenSheet,
  onMusic,
  onFinish,
  onConfirmFinish,
}: {
  state: SessionStructure;
  tab: Tab;
  onTabChange: (tab: Tab) => void;
  homeRequest: number;
  target: PaceTarget;
  starting: boolean;
  covered: boolean;
  onStart: () => void;
  onRecover: () => void;
  onPrepare: () => void;
  onWorkouts: () => void;
  onDiscoveryDetail: (id: string) => void;
  statsNavigation: StatsNavigation;
  onRunStats: () => void;
  onOpenSheet: (sheet: Sheet) => void;
  onMusic: () => void;
  onFinish: () => void;
  onConfirmFinish: () => void;
}) {
  const focused = useIsFocused();
  const [visited, setVisited] = useState<Partial<Record<Tab, boolean>>>({});
  const [tabBarHeight, setTabBarHeight] = useState(0);
  const [actionsHeight, setActionsHeight] = useState(0);
  const [browse, setBrowse] = useState<{ id: string; request: number }>();
  const active = focused && !covered;
  const tracking = state.running || state.autoPaused;
  const current = tracking ? 'home' : tab;
  const browsingPause = state.runId !== null && browse?.id === state.runId && browse.request === homeRequest;
  const live = !!state.runId && (tracking || (current === 'home' && !browsingPause));
  const bottom = live ? 0 : tabBarHeight + actionsHeight;

  const changeTab = (next: Tab) => {
    setVisited((previous) => (previous[next] ? previous : { ...previous, [next]: true }));
    onTabChange(next);
  };
  const returnToRun = () => {
    setBrowse(undefined);
    onTabChange('home');
  };

  return (
    <BottomBarInsetContext.Provider value={bottom}>
      <TabPane visible={current === 'home'}>
        {live ? (
          <LiveRun
            active={active}
            onBrowse={() => {
              if (state.runId && !tracking) setBrowse({ id: state.runId, request: homeRequest });
            }}
            onMusic={onMusic}
            onStats={onRunStats}
            onFinish={onFinish}
            onConfirmFinish={onConfirmFinish}
          />
        ) : (
          <Home
            state={state}
            target={target}
            starting={starting}
            onStart={onStart}
            onRecovery={onRecover}
            onPrepare={onPrepare}
            onWorkouts={onWorkouts}
            onReturn={returnToRun}
            onMusic={onMusic}
          />
        )}
      </TabPane>
      {(visited.discover || tab === 'discover') && (
        <TabPane visible={current === 'discover'}>
          <DiscoveryHome onOpen={onDiscoveryDetail} />
        </TabPane>
      )}
      {(visited.progress || tab === 'progress') && (
        <TabPane visible={current === 'progress'}>
          <StatsDashboard
            {...statsNavigation}
            history={state.history}
            hasRun={!!state.runId}
            active={active && current === 'progress'}
            onStart={() => changeTab('home')}
            onRunSettings={onRunStats}
          />
        </TabPane>
      )}
      {(visited.profile || tab === 'profile') && (
        <TabPane visible={current === 'profile'}>
          <ProfileTab
            history={state.history}
            active={active && current === 'profile'}
            onOpen={onOpenSheet}
            onMusic={onMusic}
          />
        </TabPane>
      )}
      {!live && (
        <View
          pointerEvents="box-none"
          onLayout={(event) => setActionsHeight(event.nativeEvent.layout.height)}
          style={{ position: 'absolute', zIndex: 2, left: 0, right: 0, bottom: tabBarHeight }}
        >
          <MusicDock active={active} onExpand={() => onOpenSheet('player')} />
          {!!state.runId && current !== 'home' && (
            <View style={{ paddingHorizontal: layout.screenGutter, paddingBottom: spacing.xs }}>
              <Button
                title="Revenir à la course en pause"
                size="compact"
                endIcon="arrow-forward"
                onPress={returnToRun}
              />
            </View>
          )}
        </View>
      )}
      <BottomTabs
        items={tabs}
        value={current}
        hidden={live}
        onChange={changeTab}
        onHeightChange={setTabBarHeight}
      />
    </BottomBarInsetContext.Provider>
  );
}
