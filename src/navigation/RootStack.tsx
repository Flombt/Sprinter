import { useMemo } from 'react';
import { DarkTheme, DefaultTheme, NavigationContainer, useIsFocused, type NavigationContainerRefWithCurrent } from '@react-navigation/native';
import { createNativeStackNavigator, type NativeStackScreenProps } from '@react-navigation/native-stack';
import { Platform, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import AppleIntegrations from '../screens/AppleIntegrations';
import Comparison from '../screens/Comparison';
import Detail from '../screens/Detail';
import History from '../screens/History';
import Music, { SpotifyAccount, SpotifyTracks } from '../screens/Music';
import PersonalRecords from '../screens/PersonalRecords';
import Preparation, { PaceEditor } from '../screens/Preparation';
import Progression from '../screens/Progression';
import Recovery from '../screens/Recovery';
import RunningTools from '../screens/RunningTools';
import Settings from '../screens/Settings';
import Workouts, { WorkoutEditor } from '../screens/Workouts';
import { Calendar, EntryEditor } from '../progression/Calendar';
import { Plans } from '../progression/PlanBuilder';
import { Shoes } from '../progression/Shoes';
import { session, type SessionState } from '../services/session';
import { useSessionSelector, useSessionStructure } from '../services/useSessionSelector';
import { EmptyState, Header, Screen } from '../ui/components';
import { ActionIcon, BodyText } from '../ui/design';
import { useTheme } from '../ui/theme';
import { spacing, fontWeights } from '../ui/tokens';
import { RunTabs } from './RunTabs';
import { useRunControls } from './RunContext';
import type { RootRoutes } from './routes';

type Props<T extends keyof RootRoutes> = NativeStackScreenProps<RootRoutes, T>;
const Stack = createNativeStackNavigator<RootRoutes>();
const selectHistory = (state: SessionState) => state.history;
const selectSession = (state: SessionState) => state;
const selectForegroundRun = (state: SessionState) => (state.running || state.autoPaused) && !state.backgroundActive;

function HistoryRoute({ navigation }: Props<'History'>) {
  const state = useSessionStructure(useIsFocused());
  const { start } = useRunControls();
  return <History state={state} onBack={navigation.goBack} onStart={start}
    onDetail={run => navigation.push('Detail', { runId: run.id })} onRecords={() => navigation.push('Records')}
    onCompare={() => navigation.push('Compare')} onProgression={() => navigation.push('Progression')} />;
}

function DetailRoute({ navigation, route }: Props<'Detail'>) {
  const history = useSessionSelector(selectHistory, useIsFocused());
  const run = history.find(item => item.id === route.params.runId);
  if (!run) return <Screen><Header title="Sortie introuvable" onBack={navigation.goBack} />
    <EmptyState icon="time-outline" title="Cette sortie est indisponible" body="Retrouvez vos sorties dans l’historique." />
  </Screen>;
  return <Detail run={run} history={history} justFinished={route.params.justFinished} onBack={navigation.goBack}
    onCompare={() => navigation.push('Compare', { runId: run.id })} onRecords={() => navigation.push('Records')}
    onApple={() => navigation.push('Apple')} onTools={() => navigation.push('Tools')} onRepeat={() => navigation.push('Preparation')} />;
}

function RecordsRoute({ navigation }: Props<'Records'>) {
  const history = useSessionSelector(selectHistory, useIsFocused());
  return <PersonalRecords history={history} onBack={navigation.goBack} onDetail={run => navigation.push('Detail', { runId: run.id })} />;
}

function CompareRoute({ navigation, route }: Props<'Compare'>) {
  const history = useSessionSelector(selectHistory, useIsFocused());
  return <Comparison history={history} initialId={route.params?.runId} onBack={navigation.goBack} />;
}

function ProgressionRoute({ navigation }: Props<'Progression'>) {
  const history = useSessionSelector(selectHistory, useIsFocused());
  return <Progression history={history} onBack={navigation.goBack} onDetail={run => navigation.push('Detail', { runId: run.id })}
    onRecords={() => navigation.push('Records')} onCalendar={() => navigation.push('Calendar')}
    onPlans={() => navigation.push('Plans')} onShoes={() => navigation.push('Shoes')} />;
}

function CalendarRoute({ navigation, route }: Props<'Calendar'>) {
  const { history, runId } = useSessionStructure(useIsFocused());
  return <Calendar history={history} dateRequest={route.params} canStart={!runId} onBack={navigation.goBack}
    onDetail={run => navigation.push('Detail', { runId: run.id })} onStart={() => navigation.push('Preparation')}
    onEdit={entry => navigation.push('CalendarEntry', { entry })} />;
}

function CalendarEntryRoute({ navigation, route }: Props<'CalendarEntry'>) {
  const { history, runId } = useSessionStructure(useIsFocused());
  const { entry, workout } = route.params;
  return <EntryEditor initial={entry} updatedWorkout={workout} history={history} canStart={!runId} onBack={navigation.goBack}
    onSaved={day => navigation.popTo('Calendar', { day, revision: Date.now() })} onStart={() => navigation.push('Preparation')}
    onEditBlocks={definition => navigation.push('CalendarBlocks', { definition, entry })} />;
}

function CalendarBlocksRoute({ navigation, route }: Props<'CalendarBlocks'>) {
  return <WorkoutEditor initial={route.params.definition} onBack={navigation.goBack}
    onCommit={workout => navigation.popTo('CalendarEntry', { entry: route.params.entry, workout })} />;
}

function PlansRoute({ navigation }: Props<'Plans'>) {
  const history = useSessionSelector(selectHistory, useIsFocused());
  return <Plans history={history} onBack={navigation.goBack} onSaved={day => navigation.replace('Calendar', { day })} />;
}

function ShoesRoute({ navigation }: Props<'Shoes'>) {
  const history = useSessionSelector(selectHistory, useIsFocused());
  return <Shoes history={history} onBack={navigation.goBack} />;
}

function AppleRoute({ navigation }: Props<'Apple'>) {
  return <AppleIntegrations onBack={navigation.goBack} />;
}

function RecoveryRoute({ navigation }: Props<'Recovery'>) {
  const state = useSessionStructure(useIsFocused());
  return <Recovery state={state} onBack={navigation.goBack} />;
}

function PreparationRoute({ navigation, route }: Props<'Preparation'>) {
  const state = useSessionStructure(useIsFocused());
  const { target, setTarget, goHome } = useRunControls();
  return <Preparation state={state} initialTarget={target} onTargetChange={setTarget} onBack={navigation.goBack} onStarted={goHome}
    onMusic={() => navigation.push('Music')} onWorkouts={() => navigation.push('Workouts')} onTools={() => navigation.push('Tools')}
    paceEdit={route.params?.paceEdit} onEditPace={(bound, value) => navigation.push('PaceEditor', { bound, value })} />;
}

function PaceEditorRoute({ navigation, route }: Props<'PaceEditor'>) {
  const { bound, value } = route.params;
  return <PaceEditor value={value} onBack={navigation.goBack}
    onApply={next => navigation.popTo('Preparation', { paceEdit: { bound, value: next } })} />;
}

function SettingsRoute({ navigation, route }: Props<'Settings' | 'SettingsSection'>) {
  const insets = useSafeAreaInsets();
  const state = useSessionSelector(selectSession, useIsFocused());
  return <View style={{ flex: 1 }}>
    {route.name === 'Settings' && <View style={{ paddingTop: insets.top + spacing.sm, paddingHorizontal: spacing.xl,
      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
      <BodyText style={{ fontWeight: fontWeights.semibold }}>Réglages avancés</BodyText>
      <ActionIcon icon="close" label="Fermer les réglages" onPress={navigation.goBack} />
    </View>}
    <Settings state={state} page={route.params?.section ?? 'main'} onBack={navigation.goBack}
      onSection={section => navigation.push('SettingsSection', { section })}
      onRecovery={() => navigation.push('Recovery')} onApple={() => navigation.push('Apple')} onTools={() => navigation.push('Tools')} />
  </View>;
}

function ToolsRoute({ navigation }: Props<'Tools'>) {
  return <RunningTools onBack={navigation.goBack} onPrepare={() => {
    if (session.getSnapshot().run) { navigation.goBack(); return; }
    if (navigation.getState().routes.some(route => route.name === 'Preparation')) navigation.popTo('Preparation');
    else navigation.replace('Preparation');
  }} />;
}

function MusicRoute({ navigation }: Props<'Music'>) {
  const active = useIsFocused();
  const foregroundOnlyRun = useSessionSelector(selectForegroundRun, active);
  return <Music active={active} onClose={navigation.goBack} foregroundOnlyRun={foregroundOnlyRun}
    onAccount={() => navigation.push('SpotifyAccount')} onTracks={playlist => navigation.push('SpotifyTracks', { playlist })} />;
}

function SpotifyAccountRoute({ navigation }: Props<'SpotifyAccount'>) {
  const foregroundOnlyRun = useSessionSelector(selectForegroundRun, useIsFocused());
  return <SpotifyAccount onBack={navigation.goBack} foregroundOnlyRun={foregroundOnlyRun} />;
}

function SpotifyTracksRoute({ navigation, route }: Props<'SpotifyTracks'>) {
  const foregroundOnlyRun = useSessionSelector(selectForegroundRun, useIsFocused());
  return <SpotifyTracks playlist={route.params.playlist} onBack={navigation.goBack} foregroundOnlyRun={foregroundOnlyRun} />;
}

function WorkoutsRoute({ navigation, route }: Props<'Workouts' | 'WorkoutGhost' | 'WorkoutPersonalBest' | 'WorkoutRecords'>) {
  return <Workouts view={route.name} onClose={navigation.goBack} onSelected={() => navigation.popTo('Preparation')}
    onDetail={run => navigation.push('Detail', { runId: run.id })} onEdit={definition => navigation.push('WorkoutEditor', { definition })}
    onBrowse={view => navigation.push(view)} />;
}

function WorkoutEditorRoute({ navigation, route }: Props<'WorkoutEditor'>) {
  return <WorkoutEditor initial={route.params.definition} onBack={navigation.goBack} onSelected={() => navigation.popTo('Preparation')} />;
}

export function RootStack({ navigation, onReady }: { navigation: NavigationContainerRefWithCurrent<RootRoutes>; onReady: () => void }) {
  const { colors, reduceMotion } = useTheme();
  const base = colors.dark ? DarkTheme : DefaultTheme;
  const theme = useMemo(() => ({ ...base, colors: { ...base.colors, background: colors.background,
    card: colors.surface, text: colors.text, border: colors.line, primary: colors.accentText, notification: colors.danger } }), [base, colors]);

  return <NavigationContainer ref={navigation} onReady={onReady} theme={theme}>
    <Stack.Navigator initialRouteName="Tabs" screenOptions={{ headerShown: false, animation: reduceMotion ? 'none' : 'default',
      contentStyle: { backgroundColor: colors.background } }}>
      <Stack.Screen name="Tabs" component={RunTabs} />
      <Stack.Screen name="History" component={HistoryRoute} />
      <Stack.Screen name="Detail" component={DetailRoute} />
      <Stack.Screen name="Records" component={RecordsRoute} />
      <Stack.Screen name="Compare" component={CompareRoute} />
      <Stack.Screen name="Progression" component={ProgressionRoute} />
      <Stack.Screen name="Calendar" component={CalendarRoute} />
      <Stack.Screen name="CalendarEntry" component={CalendarEntryRoute} />
      <Stack.Screen name="CalendarBlocks" component={CalendarBlocksRoute} />
      <Stack.Screen name="Plans" component={PlansRoute} />
      <Stack.Screen name="Shoes" component={ShoesRoute} />
      <Stack.Screen name="Apple" component={AppleRoute} />
      <Stack.Screen name="Recovery" component={RecoveryRoute} />
      <Stack.Screen name="Preparation" component={PreparationRoute} />
      <Stack.Group screenOptions={{ presentation: 'modal' }}>
        <Stack.Screen name="Settings" component={SettingsRoute} />
        <Stack.Screen name="SettingsSection" component={SettingsRoute} />
        <Stack.Screen name="Tools" component={ToolsRoute} />
        <Stack.Screen name="Music" component={MusicRoute} />
        <Stack.Screen name="SpotifyAccount" component={SpotifyAccountRoute} />
        <Stack.Screen name="SpotifyTracks" component={SpotifyTracksRoute} />
        <Stack.Screen name="Workouts" component={WorkoutsRoute} />
        <Stack.Screen name="WorkoutGhost" component={WorkoutsRoute} />
        <Stack.Screen name="WorkoutPersonalBest" component={WorkoutsRoute} />
        <Stack.Screen name="WorkoutRecords" component={WorkoutsRoute} />
        <Stack.Screen name="WorkoutEditor" component={WorkoutEditorRoute} />
      </Stack.Group>
      <Stack.Screen name="PaceEditor" component={PaceEditorRoute} options={{
        presentation: Platform.OS === 'ios' ? 'formSheet' : 'modal', sheetAllowedDetents: [.72, .94], sheetGrabberVisible: true,
      }} />
    </Stack.Navigator>
  </NavigationContainer>;
}
