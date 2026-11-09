import { AppState } from 'react-native';
import { session } from '../services/session';
import { toolsStore } from './store';
export function connectRunningTools() {
  const observe = () => {
    try {
      const event = toolsStore.observe(session.getSnapshot());
      if (['acquiring', 'unavailable', 'paused'].includes(toolsStore.getSnapshot().navigation.status)) session.cancelNavigation();
      else if (event) session.announceNavigation(event.kind, event.message);
    }
    catch { /* Optional tools cannot interrupt the GPS callback or its checkpoint. */ }
  };
  const unsubscribe = session.subscribe(observe);
  void toolsStore.initialize().then(observe);
  const appState = AppState.addEventListener('change', state => { if (state === 'active') toolsStore.refreshCapabilities(); observe(); });
  return () => { unsubscribe(); appState.remove(); toolsStore.suspend(); };
}
