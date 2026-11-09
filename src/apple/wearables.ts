/** Future transport contract only. No Watch app, WatchConnectivity session or sensor is started. */
export type WearableEvent = {
  id: string; deviceId: string; sessionId: string; sequence: number; timestamp: number;
} & ({ kind: 'heartRate'; beatsPerMinute: number } | { kind: 'workout'; action: 'start' | 'pause' | 'resume' | 'end' });
export interface WearableTransport { subscribe(receive: (event: WearableEvent) => void): () => void }
export interface SessionAuthority { sessionId: string; owner: 'phone' | 'watch'; pairedDeviceId: string }
/** A bounded ingress validates identity/order. The caller decides how to apply accepted observations. */
export class WearableInbox {
  private ids = new Set<string>(); private order: string[] = []; private lastSequence = -1;
  constructor(readonly authority: SessionAuthority) {}
  accept(input: unknown, receivedAt: number): WearableEvent | null {
    if (!input || typeof input !== 'object') return null;
    const event = input as WearableEvent;
    if (event.deviceId !== this.authority.pairedDeviceId || event.sessionId !== this.authority.sessionId || typeof event.id !== 'string' || !event.id || event.id.length > 200 ||
        !Number.isInteger(event.sequence) || event.sequence <= this.lastSequence || this.ids.has(event.id) || !Number.isFinite(event.timestamp) ||
        !Number.isFinite(receivedAt) || event.timestamp > receivedAt + 5000 || receivedAt - event.timestamp > 120000) return null;
    if (event.kind === 'heartRate' ? !Number.isFinite(event.beatsPerMinute) || event.beatsPerMinute <= 0 || event.beatsPerMinute > 400 : event.kind !== 'workout' || !['start', 'pause', 'resume', 'end'].includes(event.action)) return null;
    this.lastSequence = event.sequence; this.ids.add(event.id); this.order.push(event.id);
    if (this.order.length > 512) this.ids.delete(this.order.shift()!);
    return { ...event };
  }
}
