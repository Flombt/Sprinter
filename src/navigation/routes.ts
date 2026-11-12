import type { CalendarEntry } from '../progression/types';
import type { PlaylistReference } from '../spotify/types';
import type { WorkoutDefinition } from '../workouts/types';

export type SettingsSection = 'coach' | 'tracking' | 'precision' | 'privacy';

export type RootRoutes = {
  Tabs: { homeRequest?: number } | undefined;
  History: undefined;
  Detail: { runId: string; justFinished?: boolean };
  Records: undefined;
  Compare: { runId?: string } | undefined;
  Progression: undefined;
  Calendar: { day?: string; revision?: number } | undefined;
  CalendarEntry: { entry: CalendarEntry; workout?: WorkoutDefinition };
  CalendarBlocks: { definition: WorkoutDefinition; entry: CalendarEntry };
  Plans: undefined;
  Shoes: undefined;
  Apple: undefined;
  Recovery: undefined;
  Preparation: { paceEdit?: { bound: 'fast' | 'slow'; value: number } } | undefined;
  PaceEditor: { bound: 'fast' | 'slow'; value: number };
  Settings: undefined;
  SettingsSection: { section: SettingsSection };
  Tools: undefined;
  Music: undefined;
  SpotifyAccount: undefined;
  SpotifyTracks: { playlist: PlaylistReference };
  Workouts: undefined;
  WorkoutGhost: undefined;
  WorkoutPersonalBest: undefined;
  WorkoutRecords: undefined;
  WorkoutEditor: { definition: WorkoutDefinition };
};
