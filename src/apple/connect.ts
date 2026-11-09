import { AppState } from 'react-native';
import { session } from '../services/session';
import { apple } from './store';

/** Receives committed activities only. Native failures never escape into the GPS writer. */
export function connectAppleIntegrations() {
  let previousId = session.getSnapshot().run?.id ?? null;
  const pending = new Set<string>();
  const sent = new Set<string>();
  let replayed = false;
  const observe = () => {
    const state = session.getSnapshot();
    apple.observe(state);
    if (previousId && !state.run) pending.add(previousId);
    previousId = state.run?.id ?? null;
    if (!replayed && state.ready && apple.getSnapshot().ready) { replayed = true; void apple.retryPending(state.history); }
    if (apple.getSnapshot().ready) for (const id of pending) {
      const run = state.history.find(r => r.id === id);
      if (!run || sent.has(id)) continue;
      pending.delete(id); sent.add(id);
      if (apple.getSnapshot().preferences.autoWrite) void apple.exportRun(run, true);
    }
  };
  const unsubscribe = session.subscribe(observe);
  void apple.initialize().then(observe);
  const stateSubscription = AppState.addEventListener('change', state => { if (state === 'active') { apple.refreshCapabilities(); observe(); if (session.getSnapshot().ready) void apple.retryPending(session.getSnapshot().history); } });
  return () => { unsubscribe(); stateSubscription.remove(); };
}
