import { useCallback, useMemo } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  useIsFocused,
  useNavigation,
  type NavigationContainerRefWithCurrent,
} from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import type { PaceTarget, RunRecord } from '../core/types';
import { parisDay } from '../../supabase/functions/_shared/discovery-model';
import { DiscoveryProvider } from '../discovery/DiscoveryProvider';
import { DiscoveryDetail } from '../discovery/DiscoveryDetail';
import { linkedPlan } from '../discovery/trainingLink';
import AppleIntegrations from '../screens/AppleIntegrations';
import Comparison from '../screens/Comparison';
import Detail from '../screens/Detail';
import ExampleDetail from '../screens/ExampleDetail';
import History from '../screens/History';
import PersonalRecords from '../screens/PersonalRecords';
import Preparation from '../screens/Preparation';
import Progression from '../screens/Progression';
import Recovery from '../screens/Recovery';
import RunSummary from '../screens/RunSummary';
import Workouts from '../screens/Workouts';
import Music from '../screens/Music';
import RunStats from '../screens/RunStats';
import { RoutePreview } from '../screens/LiveRun';
import { Shoes } from '../progression/Shoes';
import { useLiveSession, useSessionStructure } from '../services/useSessionSelector';
import { session } from '../services/session';
import { EmptyState, Header, Screen } from '../ui/components';
import { useTheme } from '../ui/theme';
import { motionDuration } from '../ui/tokens';
import type { Sheet } from './AppSheets';
import { RunTabs, type Tab } from './RunTabs';
import { resolveRun, type RootRoutes } from './routes';

const Stack = createNativeStackNavigator<RootRoutes>();

function RunStatsRoute({
  covered,
  ...props
}: Omit<React.ComponentProps<typeof RunStats>, 'active' | 'state'> & { covered: boolean }) {
  const focused = useIsFocused() && !covered;
  const state = useLiveSession(focused);
  return <RunStats {...props} active={focused} state={state} />;
}

function MusicRoute({
  covered,
  ...props
}: Omit<React.ComponentProps<typeof Music>, 'active' | 'onNestedChange'> & { covered: boolean }) {
  const active = useIsFocused() && !covered;
  const navigation = useNavigation<NativeStackNavigationProp<RootRoutes, 'Music'>>();
  const onNestedChange = useCallback(
    (nested: boolean) => navigation.setOptions({ gestureEnabled: !nested }),
    [navigation],
  );
  return <Music {...props} active={active} onNestedChange={onNestedChange} />;
}

function RunDetailRoute({
  runId,
  history,
  navigation,
  justFinished,
  onTools,
}: {
  runId: string;
  history: RunRecord[];
  navigation: NativeStackNavigationProp<RootRoutes>;
  justFinished?: boolean;
  onTools: () => void;
}) {
  const run = resolveRun(history, runId);
  if (!run) {
    return (
      <Screen>
        <Header title="Sortie introuvable" onBack={navigation.goBack} />
        <EmptyState
          icon="time-outline"
          title="Cette sortie est indisponible"
          body="Retrouvez les sorties enregistrées dans votre historique."
        />
      </Screen>
    );
  }
  if (justFinished) {
    return (
      <RunSummary
        run={run}
        history={history}
        onBack={navigation.goBack}
        onDetail={() => navigation.push('Detail', { runId })}
        onHistory={() => navigation.replace('History')}
      />
    );
  }
  return (
    <Detail
      run={run}
      history={history}
      onBack={navigation.goBack}
      onCompare={() => navigation.push('Comparison', { runId })}
      onRecords={() => navigation.push('Records')}
      onApple={Platform.OS === 'ios' ? () => navigation.push('Apple') : undefined}
      onTools={onTools}
      onRepeat={() => navigation.push('Preparation')}
    />
  );
}

export function RootStack({
  navigationRef,
  userId,
  onReady,
  tab,
  homeRequest,
  onTabChange,
  playlistImport,
  onPlaylistImportRead,
  target,
  onTargetChange,
  starting,
  covered,
  onStart,
  onFinish,
  onConfirmFinish,
  onOpenSheet,
}: {
  navigationRef: NavigationContainerRefWithCurrent<RootRoutes>;
  userId: string;
  onReady: () => void;
  tab: Tab;
  homeRequest: number;
  onTabChange: (tab: Tab) => void;
  playlistImport?: string;
  onPlaylistImportRead: () => void;
  target: PaceTarget;
  onTargetChange: (target: PaceTarget) => void;
  starting: boolean;
  covered: boolean;
  onStart: (target: PaceTarget) => void;
  onFinish: () => void;
  onConfirmFinish: () => void;
  onOpenSheet: (sheet: Sheet) => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const state = useSessionStructure();
  const canPrepare = () => {
    const snapshot = session.getSnapshot();
    return !snapshot.run && !snapshot.busy && !starting;
  };
  const detailTransition = reduceMotion ? 'none' : Platform.OS === 'ios' ? 'simple_push' : 'fade';
  const base = colors.dark ? DarkTheme : DefaultTheme;
  const theme = useMemo(
    () => ({
      ...base,
      colors: {
        background: colors.background,
        card: colors.surface,
        text: colors.text,
        border: colors.line,
        primary: colors.accent,
        notification: colors.danger,
      },
    }),
    [base, colors],
  );
  const navigationTree = (
    <NavigationContainer ref={navigationRef} onReady={onReady} theme={theme}>
      <Stack.Navigator
        initialRouteName="Tabs"
        screenOptions={{
          headerShown: false,
          animation: reduceMotion ? 'none' : Platform.OS === 'ios' ? 'simple_push' : 'default',
          animationDuration: 200,
          gestureEnabled: true,
          freezeOnBlur: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="Tabs">
          {({ navigation }) => (
            <RunTabs
              state={state}
              tab={tab}
              homeRequest={homeRequest}
              onTabChange={onTabChange}
              target={target}
              starting={starting}
              covered={covered}
              onStart={() => onStart(target)}
              onRecover={() => navigation.push('Recovery')}
              onPrepare={() => {
                if (canPrepare()) navigation.push('Preparation');
              }}
              onWorkouts={() => {
                if (canPrepare()) navigation.push('Workouts');
              }}
              onDiscoveryDetail={(id) => navigation.push('DiscoveryDetail', { id })}
              statsNavigation={{
                onHistory: () => navigation.push('History'),
                onDetail: (run) => navigation.push('Detail', { runId: run.id }),
                onExample: (id) => navigation.push('ExampleDetail', { id }),
                onRecords: () => navigation.push('Records'),
                onProgression: () => navigation.push('Progression'),
                onShoes: () => navigation.push('Shoes'),
                onCompare: () => navigation.push('Comparison'),
              }}
              onRunStats={() => navigation.push('RunStats')}
              onOpenSheet={onOpenSheet}
              onMusic={() => navigation.push('Music')}
              onFinish={onFinish}
              onConfirmFinish={onConfirmFinish}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Preparation">
          {({ navigation, route }) => (
            <Preparation
              state={state}
              discovery={route.params?.discovery}
              initialTarget={target}
              onTargetChange={onTargetChange}
              onBack={navigation.goBack}
              onStart={onStart}
              starting={starting}
              covered={covered}
              onMusic={() => navigation.push('Music')}
              onWorkouts={() => navigation.push('Workouts', { returnToPreparation: true })}
              onTools={() => onOpenSheet('tools')}
              onMap={() => navigation.push('RoutePreview')}
              onSettings={() => onOpenSheet('settings')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="RoutePreview">
          {({ navigation }) => <RoutePreview onBack={navigation.goBack} />}
        </Stack.Screen>
        <Stack.Screen name="Workouts">
          {({ navigation, route }) => (
            <Workouts
              onClose={navigation.goBack}
              onSelected={() => {
                if (!canPrepare() || route.params?.returnToPreparation) navigation.goBack();
                else navigation.replace('Preparation');
              }}
              onDetail={(run) => navigation.push('Detail', { runId: run.id })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="Music"
          options={{ animation: detailTransition, animationDuration: motionDuration.sheet }}
        >
          {({ navigation }) => (
            <MusicRoute
              covered={covered}
              onClose={navigation.goBack}
              foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive}
              playlistImport={playlistImport}
              onPlaylistImportRead={onPlaylistImportRead}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="RunStats">
          {({ navigation }) => (
            <RunStatsRoute
              covered={covered}
              target={target}
              onTargetChange={onTargetChange}
              onPrepare={() => {
                if (canPrepare()) navigation.push('Preparation');
              }}
              onSettings={() => onOpenSheet('settings')}
              onMusic={() => navigation.push('Music')}
              onFinish={onFinish}
              onConfirmFinish={onConfirmFinish}
              onBack={navigation.goBack}
            />
          )}
        </Stack.Screen>
        <Stack.Screen
          name="DiscoveryDetail"
          options={{ animation: detailTransition, animationDuration: motionDuration.detail }}
        >
          {({ navigation, route }) => (
            <DiscoveryDetail
              id={route.params.id}
              key={route.params.id}
              onBack={navigation.goBack}
              onOpen={(id) => navigation.push('DiscoveryDetail', { id })}
              onPrepare={(discovery, plan) => {
                if (!canPrepare()) return;
                const discoveryPlan = plan ? linkedPlan(discovery, parisDay(Date.now())) : undefined;
                if (discoveryPlan) navigation.push('Progression', { discoveryPlan });
                else navigation.push('Preparation', { discovery });
              }}
              onWorkout={(suggestion, discovery) => {
                if (canPrepare()) navigation.push('DiscoveryWorkout', { suggestion, discovery });
              }}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="DiscoveryWorkout">
          {({ navigation, route }) => (
            <Workouts
              initialTemplate={route.params.suggestion}
              onClose={navigation.goBack}
              onSelected={() => {
                if (canPrepare()) navigation.replace('Preparation', { discovery: route.params.discovery });
                else navigation.goBack();
              }}
              onDetail={(run) => navigation.push('Detail', { runId: run.id })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Detail">
          {({ route, navigation }) => (
            <RunDetailRoute
              runId={route.params.runId}
              history={state.history}
              navigation={navigation}
              onTools={() => onOpenSheet('tools')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="ExampleDetail">
          {({ route, navigation }) => <ExampleDetail id={route.params.id} onBack={navigation.goBack} />}
        </Stack.Screen>
        <Stack.Screen name="Shoes">
          {({ navigation }) => <Shoes history={state.history} onBack={navigation.goBack} />}
        </Stack.Screen>
        <Stack.Screen name="RunSummary">
          {({ route, navigation }) => (
            <RunDetailRoute
              runId={route.params.runId}
              history={state.history}
              navigation={navigation}
              justFinished
              onTools={() => onOpenSheet('tools')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="History">
          {({ navigation }) => (
            <History
              state={state}
              onBack={navigation.goBack}
              onDetail={(run) => navigation.push('Detail', { runId: run.id })}
              onStart={() => onStart(target)}
              onRecords={() => navigation.push('Records')}
              onCompare={() => navigation.push('Comparison')}
              onProgression={() => navigation.push('Progression')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Records">
          {({ navigation }) => (
            <PersonalRecords
              history={state.history}
              onBack={navigation.goBack}
              onDetail={(run) => navigation.push('Detail', { runId: run.id })}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Comparison">
          {({ route, navigation }) => (
            <Comparison history={state.history} initialId={route.params?.runId} onBack={navigation.goBack} />
          )}
        </Stack.Screen>
        <Stack.Screen name="Progression">
          {({ navigation, route }) => (
            <Progression
              history={state.history}
              discoveryPlan={route.params?.discoveryPlan}
              canStart={!state.runId}
              onBack={navigation.goBack}
              onDetail={(run) => navigation.push('Detail', { runId: run.id })}
              onStart={() => navigation.push('Preparation')}
              onRecords={() => navigation.push('Records')}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Recovery">
          {({ navigation }) => <Recovery state={state} onBack={navigation.goBack} />}
        </Stack.Screen>
        <Stack.Screen name="Apple">
          {({ navigation }) => <AppleIntegrations onBack={navigation.goBack} />}
        </Stack.Screen>
      </Stack.Navigator>
    </NavigationContainer>
  );
  return (
    <DiscoveryProvider
      key={userId}
      userId={userId}
      visible={tab === 'discover' && !covered}
      blocked={!!state.runId || state.busy || starting}
    >
      {navigationTree}
    </DiscoveryProvider>
  );
}
