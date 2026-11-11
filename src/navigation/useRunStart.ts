import { useCallback, useRef, useState } from 'react';
import type { PaceTarget } from '../core/types';
import { session } from '../services/session';
import { startPreparedRun } from '../services/runPreparation';
import { music } from '../spotify/device';

export function useRunStart(onStarted: () => void, onRecovery: () => void) {
  const pending = useRef<PaceTarget | null>(null);
  const inFlight = useRef(false);
  const [countdown, setCountdown] = useState(false);
  const [starting, setStarting] = useState(false);

  const request = useCallback(
    (target: PaceTarget) => {
      const state = session.getSnapshot();
      if (state.recoveryBlocked) {
        onRecovery();
      } else if (state.run) {
        onStarted();
      } else if (!state.busy && !pending.current && !inFlight.current) {
        pending.current = target;
        setCountdown(true);
      }
    },
    [onRecovery, onStarted],
  );

  const cancel = useCallback(() => {
    pending.current = null;
    setCountdown(false);
  }, []);

  const begin = useCallback(() => {
    const target = pending.current;
    if (!target || inFlight.current) return;
    inFlight.current = true;
    cancel();
    setStarting(true);
    void startPreparedRun(target)
      .then((started) => {
        if (!started) return;
        onStarted();
        void music.onRunStarted();
      })
      .catch(() => {
        session.reportMessage('Le départ a échoué. Réessayez depuis Courir.');
      })
      .finally(() => {
        inFlight.current = false;
        setStarting(false);
      });
  }, [cancel, onStarted]);

  return { countdown, starting: countdown || starting, request, cancel, begin };
}
