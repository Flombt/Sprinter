import { useEffect, useState, useSyncExternalStore } from 'react';
import { AppState } from 'react-native';
import { progression } from './store';
export const useProgression = () => {
  const state = useSyncExternalStore(progression.subscribe, progression.getSnapshot, progression.getSnapshot);
  useEffect(() => { void progression.initialize(); }, []); return state;
};
export function useLocalNow() {
  const [now, setNow] = useState(Date.now);
  useEffect(() => { const update = () => setNow(Date.now()); const timer = setInterval(update, 60000);
    const listener = AppState.addEventListener('change', state => { if (state === 'active') update(); });
    return () => { clearInterval(timer); listener.remove(); };
  }, []); return now;
}
