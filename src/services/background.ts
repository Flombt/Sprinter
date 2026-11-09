import * as TaskManager from 'expo-task-manager';
import { LocationObject } from 'expo-location';
import { LOCATION_TASK } from './capabilities';
import { session } from './session';

// Must be registered at module scope before React mounts (Expo TaskManager requirement).
TaskManager.defineTask<{ locations: LocationObject[] }>(LOCATION_TASK, async ({ data, error }) => {
  if (error) { await session.handleLocationError(error.message, true); return; }
  if (data?.locations) await session.handleBackground(data.locations);
});
