import { distance } from '../core/geo';
import { DEFAULT_CONFIG, type RunRecord, type TrackPoint } from '../core/types';

type Waypoint = readonly [latitude: number, longitude: number];
type ExampleRun = { title: string; run: RunRecord };

// These generated points only feed the read-only examples. They never enter the session repository.
function example(
  id: string,
  title: string,
  day: number,
  basePace: number,
  route: readonly Waypoint[],
): ExampleRun {
  const startedAt = Date.UTC(2026, 10, day, 8);
  const points: TrackPoint[] = [];
  let meters = 0;
  let seconds = 0;
  const coordinate = ([latitude, longitude]: Waypoint) => ({ latitude, longitude });
  const append = (position: ReturnType<typeof coordinate>, pace: number) => {
    const previous = points.at(-1);
    if (previous) {
      const length = distance(previous.fix, position);
      meters += length;
      seconds += (length * pace) / 1000;
    }
    points.push({
      id: points.length + 1,
      segment: 0,
      activeSeconds: seconds,
      totalSeconds: seconds,
      meters,
      pace,
      quality: 'good',
      continuity: previous ? 'continuous' : 'start',
      fix: { ...position, timestamp: startedAt + seconds * 1000, accuracy: 5, speed: 1000 / pace },
    });
  };
  append(coordinate(route[0]!), basePace);
  for (let leg = 1; leg < route.length; leg++) {
    const start = coordinate(route[leg - 1]!);
    const end = coordinate(route[leg]!);
    const samples = Math.ceil(distance(start, end) / 10);
    for (let sample = 1; sample <= samples; sample++) {
      const fraction = sample / samples;
      append(
        {
          latitude: start.latitude + (end.latitude - start.latitude) * fraction,
          longitude: start.longitude + (end.longitude - start.longitude) * fraction,
        },
        basePace + Math.round(16 * Math.sin(meters / 220)),
      );
    }
  }
  const fast = basePace - 10;
  const slow = basePace + 10;
  const inTargetSeconds = points.reduce((total, point, index) => {
    const previous = points[index - 1];
    return previous && point.pace !== null && point.pace >= fast && point.pace <= slow
      ? total + point.activeSeconds - previous.activeSeconds
      : total;
  }, 0);
  return {
    title,
    run: {
      id,
      startedAt,
      endedAt: startedAt + seconds * 1000,
      config: { ...DEFAULT_CONFIG },
      target: { fast, slow, distanceMeters: null },
      distanceMeters: meters,
      activeSeconds: seconds,
      totalSeconds: seconds,
      reliableSeconds: seconds,
      inTargetSeconds,
      clockPauses: [],
      splits: [],
      points,
      bestPace: points.reduce((best, point) => Math.min(best, point.pace ?? best), basePace),
    },
  };
}

export const exampleRuns = [
  example('example-park', 'Boucle du parc', 11, 336, [
    [48.8375, 2.4184],
    [48.8392, 2.4235],
    [48.8401, 2.4293],
    [48.8368, 2.4324],
    [48.8331, 2.4273],
    [48.8338, 2.4208],
    [48.8375, 2.4184],
  ]),
  example('example-river', 'Sortie au bord de l’eau', 8, 354, [
    [45.7724, 4.8489],
    [45.7699, 4.846],
    [45.7652, 4.8419],
    [45.7612, 4.8385],
    [45.7591, 4.8368],
    [45.7558, 4.8357],
    [45.7526, 4.8348],
  ]),
  example('example-intervals', 'Séance rythmée', 5, 302, [
    [43.283, 5.3797],
    [43.281, 5.3792],
    [43.2787, 5.3756],
    [43.2761, 5.3735],
    [43.2746, 5.3766],
    [43.2773, 5.3799],
    [43.2804, 5.3821],
    [43.283, 5.3797],
  ]),
];
