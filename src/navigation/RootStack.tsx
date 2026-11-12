import { useMemo } from 'react';
import {
  DarkTheme,
  DefaultTheme,
  NavigationContainer,
  type NavigationContainerRefWithCurrent,
} from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackNavigationProp } from '@react-navigation/native-stack';
import { Platform } from 'react-native';
import type { PaceTarget, RunRecord } from '../core/types';
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
import { Shoes } from '../progression/Shoes';
import { useSessionStructure } from '../services/useSessionSelector';
import { EmptyState, Header, Screen } from '../ui/components';
import { useTheme } from '../ui/theme';
import type { Sheet } from './AppSheets';
import { RunTabs, type Tab } from './RunTabs';
import { resolveRun, type RootRoutes } from './routes';

const Stack = createNativeStackNavigator<RootRoutes>();

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
      onApple={() => navigation.push('Apple')}
      onTools={onTools}
      onRepeat={() => navigation.push('Preparation')}
    />
  );
}

export function RootStack({
  navigationRef,
  onReady,
  tab,
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
  onReady: () => void;
  tab: Tab;
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
  return (
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
              onTabChange={onTabChange}
              playlistImport={playlistImport}
              onPlaylistImportRead={onPlaylistImportRead}
              target={target}
              onTargetChange={onTargetChange}
              starting={starting}
              covered={covered}
              onStart={() => onStart(target)}
              onRecover={() => navigation.push('Recovery')}
              onPrepare={() => navigation.push('Preparation')}
              onHistory={() => navigation.push('History')}
              statsNavigation={{
                onHistory: () => navigation.push('History'),
                onDetail: (run) => navigation.push('Detail', { runId: run.id }),
                onExample: (id) => navigation.push('ExampleDetail', { id }),
                onRecords: () => navigation.push('Records'),
                onProgression: () => navigation.push('Progression'),
                onShoes: () => navigation.push('Shoes'),
              }}
              onSettings={() => onOpenSheet('settings')}
              onMusic={() => onOpenSheet('music')}
              onPlayer={() => onOpenSheet('player')}
              onFinish={onFinish}
              onConfirmFinish={onConfirmFinish}
            />
          )}
        </Stack.Screen>
        <Stack.Screen name="Preparation">
          {({ navigation }) => (
            <Preparation
              state={state}
              initialTarget={target}
              onTargetChange={onTargetChange}
              onBack={navigation.goBack}
              onStart={onStart}
              starting={starting}
              covered={covered}
              onMusic={() => onOpenSheet('music')}
              onWorkouts={() => onOpenSheet('workouts')}
              onTools={() => onOpenSheet('tools')}
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
          {({ navigation }) => (
            <Progression
              history={state.history}
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
}
