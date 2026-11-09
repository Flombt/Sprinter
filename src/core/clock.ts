/** Time is expressed in monotonic seconds; wall-clock changes never drive an active duration. */
export class ActiveClock {
  private resumedAt: number | null = null;
  constructor(private accumulated = 0) {}
  get running() { return this.resumedAt !== null; }
  elapsed(time: number) { return this.accumulated + (this.resumedAt === null || !Number.isFinite(time) ? 0 : Math.max(0, time - this.resumedAt)); }
  resume(time: number) { if (this.resumedAt === null && Number.isFinite(time)) this.resumedAt = time; }
  pause(time: number) { this.accumulated = this.elapsed(time); this.resumedAt = null; }
}
