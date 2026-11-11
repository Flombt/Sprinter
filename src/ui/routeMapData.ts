import type { TrackPoint } from '../core/types';
import type { RouteCoordinate } from '../routes/types';

export type MapCommand = { kind: 'position' | 'route'; revision: number };

export interface RouteMapProps {
  points: readonly TrackPoint[];
  reference?: RouteCoordinate[][];
  current?: RouteCoordinate;
  selected?: RouteCoordinate;
  initialPosition?: RouteCoordinate;
  height?: number | 'fill';
  interactive?: boolean;
  live?: boolean;
  follow?: boolean;
  satellite?: boolean;
  command?: MapCommand;
  onPan?: () => void;
}

export const EMPTY_TRACK: readonly TrackPoint[] = [];
export const EMPTY_REFERENCE: RouteCoordinate[][] = [];

type Sample = { index: number; coordinate: RouteCoordinate };
type Segment = { id: number; kept: Sample[]; last: Sample };

/** The engine appends to its track array. A larger stride keeps a subset of already sampled indexes. */
export class RecordedTrack {
  private source: readonly TrackPoint[] | undefined;
  private count = 0;
  private lastPoint: TrackPoint | undefined;
  private stride = 1;
  private segments: Segment[] = [];
  private result: RouteCoordinate[][] = [];

  update(points: readonly TrackPoint[], count = points.length): RouteCoordinate[][] {
    if (this.source !== points || count < this.count || this.lastPoint !== points[this.count - 1]) {
      this.source = points;
      this.count = 0;
      this.lastPoint = undefined;
      this.stride = 1;
      this.segments = [];
      this.result = [];
    }
    if (count === this.count) return this.result;

    const stride = 2 ** Math.max(0, Math.ceil(Math.log2(count / 1500)));
    let changedFrom = Math.max(0, this.segments.length - 1);
    if (stride !== this.stride) {
      for (const segment of this.segments) {
        segment.kept = segment.kept.filter((sample, index) => index === 0 || sample.index % stride === 0);
      }
      this.stride = stride;
      changedFrom = 0;
    }

    let segment = this.segments.at(-1);
    for (let index = this.count; index < count; index++) {
      const point = points[index]!;
      if (segment?.id === point.segment && index % stride !== 0 && points[index + 1]?.segment === point.segment
        && index < count - 1) continue;
      const sample = { index, coordinate: { latitude: point.fix.latitude, longitude: point.fix.longitude } };
      if (!segment || segment.id !== point.segment) {
        segment = { id: point.segment, kept: [sample], last: sample };
        this.segments.push(segment);
      } else {
        segment.last = sample;
        if (index % stride === 0) segment.kept.push(sample);
      }
    }
    this.count = count;
    this.lastPoint = points[count - 1];
    this.result = [
      ...this.result.slice(0, changedFrom),
      ...this.segments.slice(changedFrom).map(({ kept, last }) => {
        const coordinates = kept.map(sample => sample.coordinate);
        if (kept.at(-1) !== last) coordinates.push(last.coordinate);
        return coordinates;
      }),
    ];
    return this.result;
  }
}

export function recordedSegments(points: readonly TrackPoint[]): RouteCoordinate[][] {
  return new RecordedTrack().update(points);
}

export function referenceSegments(reference: RouteCoordinate[][]) {
  const step = Math.max(1, Math.ceil(reference.reduce((count, segment) => count + segment.length, 0) / 1500));
  return reference.map(segment => segment.filter((_, index) => index === 0 || index === segment.length - 1 || index % step === 0));
}
