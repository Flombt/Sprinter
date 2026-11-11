import { Modal, View } from 'react-native';
import type { RunRecord } from '../core/types';
import Music from '../screens/Music';
import RunningTools from '../screens/RunningTools';
import Settings from '../screens/Settings';
import Workouts from '../screens/Workouts';
import type { SessionState } from '../services/session';
import { useTheme } from '../ui/theme';

export type Sheet = 'music' | 'settings' | 'workouts' | 'tools';

export function AppSheets({ sheet, state, onClose, onDetail, onRecovery, onApple, onPrepare, onTools }: {
  sheet: Sheet | null;
  state: SessionState;
  onClose: () => void;
  onDetail: (run: RunRecord) => void;
  onRecovery: () => void;
  onApple: () => void;
  onPrepare: () => void;
  onTools: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  return <Modal
    visible={sheet !== null}
    animationType={reduceMotion ? 'none' : 'slide'}
    presentationStyle="pageSheet"
    allowSwipeDismissal
    onRequestClose={onClose}
  >
    <View style={{ flex: 1, backgroundColor: colors.background }}>
      {sheet === 'music' && <Music
        onClose={onClose}
        foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive}
      />}
      {sheet === 'settings' && <Settings
        state={state}
        onClose={onClose}
        onRecovery={onRecovery}
        onApple={onApple}
        onTools={onTools}
      />}
      {sheet === 'workouts' && <Workouts onClose={onClose} onSelected={onClose} onDetail={onDetail} />}
      {sheet === 'tools' && <RunningTools onBack={onClose} onPrepare={onPrepare} />}
    </View>
  </Modal>;
}
