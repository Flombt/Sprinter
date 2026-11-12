import { createContext, useContext } from 'react';
import type { PaceTarget } from '../core/types';

export interface RunControls {
  target: PaceTarget;
  setTarget: (target: PaceTarget) => void;
  starting: boolean;
  start: () => void;
  finish: (held?: boolean) => void;
  goHome: () => void;
}

export const RunContext = createContext<RunControls | null>(null);

export function useRunControls() {
  const controls = useContext(RunContext);
  if (!controls) throw new Error('RunContext is missing');
  return controls;
}
