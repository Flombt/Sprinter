export interface RouteCoordinate { latitude: number; longitude: number; altitude?: number | null }
export interface SavedRoute {
  version: 1; id: string; name: string; createdAt: number; updatedAt?: number; source: 'activity' | 'gpx'; sourceActivityId?: string;
  segments: RouteCoordinate[][]; distanceMeters: number; warnings: string[];
}
export interface ToolsData {
  version: 1; selectedRouteId: string | null; departureMeters: number;
  metronomeEnabled: boolean; bpm: number; volume: number; cadenceEnabled: boolean;
}
export const defaultToolsData = (): ToolsData => ({ version: 1, selectedRouteId: null, departureMeters: 60, metronomeEnabled: false, bpm: 170, volume: .3, cadenceEnabled: false });
export interface NavigationStatus { status: 'unavailable' | 'acquiring' | 'onRoute' | 'offRoute' | 'paused'; distanceMeters: number | null; event?: 'off' | 'back' }
