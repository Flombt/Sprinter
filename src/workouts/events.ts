import { CoachingEvent } from './types';
import { CoachingPreferences, coachingPreset, effectivePriority, eventCategory, terminalEvent } from '../coaching/config';

/** Bounded priority queue: no announcement backlog survives a pause or a later segment. */
export class CoachingQueue {
  private events: CoachingEvent[] = [];
  private lastDelivered = -Infinity;
  private delivered = new Map<string, number>();
  push(input: CoachingEvent[], config: CoachingPreferences = coachingPreset('normal')) {
    let events = input.filter(e => Number.isFinite(e.at) && config.categories[eventCategory(e.kind)].enabled);
    const start = events.find(e => e.kind === 'workoutStart');
    const firstBlock = events.find(e => e.kind === 'segmentStart' && start && Math.abs(e.at - start.at) < .01);
    if (start && firstBlock) events = events.filter(e => e !== start).map(e => e === firstBlock ? { ...e, message: `${start.message} ${e.message}`, priority: Math.max(start.priority, e.priority) } : e);
    const outcome = events.find(e => e.kind === 'challengeWon' || e.kind === 'challengeLost');
    const completion = events.find(e => e.kind === 'workoutCompleted' && outcome && Math.abs(e.at - outcome.at) <= 2);
    if (outcome && completion) events = events.filter(e => e !== completion).map(e => e === outcome ? { ...e, message: `${e.message} Séance terminée. Votre GPS continue.` } : e);
    for (const event of events) {
      if (this.events.some(old => old.kind === event.kind && old.at > event.at)) continue;
      if (terminalEvent(event)) this.events = this.events.filter(old => terminalEvent(old));
      this.events = this.events.filter(old => old.kind !== event.kind);
      if (event.kind === 'segmentStart') this.events = this.events.filter(old => old.segmentIndex >= event.segmentIndex || terminalEvent(old) ||
        (['segmentEnd', 'repetitionCompleted'].includes(old.kind) && old.segmentIndex === event.segmentIndex - 1));
      if (event.kind === 'paceRecovered' || event.kind === 'paceDeviation') this.events = this.events.filter(old => !['paceRecovered', 'paceDeviation'].includes(old.kind));
      if (event.kind === 'routeOff' || event.kind === 'routeBack') this.events = this.events.filter(old => !['routeOff', 'routeBack'].includes(old.kind));
      if (event.kind === 'timeAhead' || event.kind === 'timeBehind') this.events = this.events.filter(old => !['timeAhead', 'timeBehind'].includes(old.kind));
      if (event.kind === 'distanceMilestone') this.events = this.events.filter(old => old.kind !== 'progressUpdate');
      if (event.kind === 'progressUpdate' && this.events.some(old => old.kind === 'distanceMilestone' && Math.abs(old.at - event.at) < 5)) continue;
      if (event.kind === 'segmentStart') this.events = this.events.filter(old => !['targetChanged', 'transitionSoon', 'paceDeviation', 'paceRecovered', 'segmentEnd', 'repetitionCompleted'].includes(old.kind));
      this.events.push(event);
    }
    this.events.sort((a, b) => effectivePriority(b, config) - effectivePriority(a, config) || b.at - a.at);
    this.events = this.events.slice(0, 16);
  }
  clear() { this.events = []; }
  cancelNavigation() { this.events = this.events.filter(e => e.kind !== 'routeOff' && e.kind !== 'routeBack'); }
  reset() { this.clear(); this.lastDelivered = -Infinity; this.delivered.clear(); }
  cancelPace(includeRecovery = false) { this.events = this.events.filter(e => e.kind !== 'paceDeviation' && (!includeRecovery || !['paceRecovered', 'timeAhead', 'timeBehind', 'goalExpired', 'challengeWarning'].includes(e.kind))); }
  next(now: number, segmentIndex: number, config: CoachingPreferences = coachingPreset('normal')): CoachingEvent | null {
    this.events = this.events.filter(e => config.categories[eventCategory(e.kind)].enabled && e.at <= now + .01 &&
      (terminalEvent(e) ? now - e.at <= 20 : now - e.at <= (e.kind === 'distanceMilestone' ? 15 : 8)) &&
      (e.expiresAt === undefined || now < e.expiresAt) &&
      (e.segmentIndex === segmentIndex || terminalEvent(e) || e.kind === 'distanceMilestone' || e.kind === 'progressUpdate' ||
        (['segmentEnd', 'repetitionCompleted'].includes(e.kind) && e.segmentIndex === segmentIndex - 1)));
    this.events.sort((a, b) => effectivePriority(b, config) - effectivePriority(a, config) || b.at - a.at);
    const index = this.events.findIndex(e => {
      if (e.kind === 'targetChanged' && this.events.some(other => other.kind === 'segmentStart' && other.segmentIndex === e.segmentIndex)) return false;
      const category = eventCategory(e.kind), rule = config.categories[category];
      return now - this.lastDelivered >= (terminalEvent(e) ? 2 : config.minimumGapSeconds) &&
        (terminalEvent(e) || now - (this.delivered.get(category) ?? -Infinity) >= rule.intervalSeconds);
    });
    if (index < 0) return null;
    const [event] = this.events.splice(index, 1);
    if (!event) return null;
    this.lastDelivered = now; this.delivered.set(eventCategory(event.kind), now);
    if (event.kind === 'segmentStart') this.events = this.events.filter(e => e.kind !== 'targetChanged' || e.segmentIndex !== event.segmentIndex);
    if (event.kind === 'workoutCompleted') this.events = this.events.filter(e => e.priority >= 100);
    return event;
  }
}
