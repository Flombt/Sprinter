import { useMemo, useSyncExternalStore } from 'react';
import { session, type SessionState } from './session';
import { sameFields, snapshotSelection } from './snapshotSelection';

export function useSessionSelector<T>(
  selector: (state: SessionState) => T,
  isEqual: (left: T, right: T) => boolean = Object.is,
): T {
  const read = useMemo(() => snapshotSelection(session.getSnapshot, selector, isEqual), [selector, isEqual]);
  return useSyncExternalStore(session.subscribe, read, read);
}

function selectStructure(state: SessionState) {
  return {
    history: state.history,
    settings: state.settings,
    runId: state.run?.id ?? null,
    busy: state.busy,
    running: state.running,
    autoPaused: state.autoPaused,
    backgroundActive: state.backgroundActive,
    recoveryBlocked: state.recoveryBlocked === true,
    unreadableCount: state.unreadableCount,
  };
}
export type SessionStructure = ReturnType<typeof selectStructure>;
export const useSessionStructure = () => useSessionSelector(selectStructure, sameFields);

const identity = (state: SessionState) => state;
const sameStructure = (left: SessionState, right: SessionState) =>
  sameFields(selectStructure(left), selectStructure(right));

/** A hidden tab retains its React state but only observes the shape of the current session. */
export function useLiveSession(active: boolean): SessionState {
  return useSessionSelector(identity, active ? Object.is : sameStructure);
}
