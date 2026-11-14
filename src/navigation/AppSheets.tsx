import { memo } from 'react';
import { Modal, View } from 'react-native';
import type { RunRecord } from '../core/types';
import Music from '../screens/Music';
import RunningTools from '../screens/RunningTools';
import Settings from '../screens/Settings';
import Workouts from '../screens/Workouts';
import { AccountSheet } from '../account/ui/AccountSheet';
import { useSessionStructure } from '../services/useSessionSelector';
import { useTheme } from '../ui/theme';

export type Sheet = 'music' | 'player' | 'settings' | 'workouts' | 'tools' | 'account';

export const AppSheets = memo(function AppSheets({
  sheet,
  onClose,
  onDetail,
  onRecovery,
  onApple,
  onPrepare,
  onTools,
  onAccount,
}: {
  sheet: Sheet | null;
  onClose: () => void;
  onDetail: (run: RunRecord) => void;
  onRecovery: () => void;
  onApple: () => void;
  onPrepare: () => void;
  onTools: () => void;
  onAccount: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const state = useSessionStructure();
  return (
    <Modal
      visible={sheet !== null}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {(sheet === 'music' || sheet === 'player') && (
          <Music
            key={sheet}
            initialPlayer={sheet === 'player'}
            onClose={onClose}
            foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive}
          />
        )}
        {sheet === 'settings' && (
          <Settings
            state={state}
            onClose={onClose}
            onRecovery={onRecovery}
            onApple={onApple}
            onTools={onTools}
            onAccount={onAccount}
          />
        )}
        {sheet === 'account' && <AccountSheet onClose={onClose} />}
        {sheet === 'workouts' && <Workouts onClose={onClose} onSelected={onClose} onDetail={onDetail} />}
        {sheet === 'tools' && <RunningTools onBack={onClose} onPrepare={onPrepare} />}
      </View>
    </Modal>
  );
});
