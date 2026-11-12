import { useMemo, useSyncExternalStore } from 'react';
import { session, type SessionState } from './session';

const unsubscribe = () => {};
const ignoreUpdates = () => unsubscribe;

export function shallowEqual<T extends object>(left: T, right: T) {
  const keys = Object.keys(left) as (keyof T)[];
  return keys.length === Object.keys(right).length && keys.every(key => Object.is(left[key], right[key]));
}

export function useSessionSelector<T>(select: (state: SessionState) => T, active = true, equal: (a: T, b: T) => boolean = Object.is): T {
  const getSelection = useMemo(() => {
    let previous: SessionState | undefined;
    let selection: T;
    return () => {
      const state = session.getSnapshot();
      if (state === previous) return selection;
      const next = select(state);
      if (!previous || !equal(selection, next)) selection = next;
      previous = state;
      return selection;
    };
  }, [select, equal]);
  return useSyncExternalStore(active ? session.subscribe : ignoreUpdates, getSelection, getSelection);
}

const selectStructure = ({ run, history, settings, running, autoPaused, busy, backgroundActive, recoveryBlocked, unreadableCount }: SessionState) => ({
  runId: run?.id, routeId: run?.routeId, history, settings, running, autoPaused, busy, backgroundActive, recoveryBlocked, unreadableCount,
});

export type SessionStructure = ReturnType<typeof selectStructure>;

export function useSessionStructure(active = true) {
  return useSessionSelector(selectStructure, active, shallowEqual);
}
