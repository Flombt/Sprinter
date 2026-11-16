import { memo } from 'react';
import { Modal, Platform, View } from 'react-native';
import Music from '../screens/Music';
import RunningTools from '../screens/RunningTools';
import Settings from '../screens/Settings';
import { AccountSheet, type AccountEntry } from '../account/ui/AccountSheet';
import { useSessionStructure } from '../services/useSessionSelector';
import { useTheme } from '../ui/theme';

export type Sheet =
  | 'player'
  | 'settings'
  | 'tools'
  | 'account'
  | 'accountData'
  | 'localProfile'
  | 'myProfile'
  | 'profileEdit'
  | 'profileShare'
  | 'community';
const accountEntries: Partial<Record<Sheet, AccountEntry>> = {
  account: 'home',
  accountData: 'data',
  localProfile: 'localProfile',
  myProfile: 'myProfile',
  profileEdit: 'profileEdit',
  profileShare: 'profileShare',
  community: 'community',
};

export const AppSheets = memo(function AppSheets({
  sheet,
  onClose,
  onRecovery,
  onApple,
  onPrepare,
  onTools,
  onAccount,
  profileToken,
}: {
  sheet: Sheet | null;
  onClose: () => void;
  onRecovery: () => void;
  onApple: () => void;
  onPrepare: () => void;
  onTools: () => void;
  onAccount: () => void;
  profileToken?: string | null;
}) {
  const { colors, reduceMotion } = useTheme();
  const state = useSessionStructure();
  const entry = sheet ? accountEntries[sheet] : undefined;
  return (
    <Modal
      visible={sheet !== null}
      animationType={reduceMotion ? 'none' : 'slide'}
      presentationStyle="pageSheet"
      allowSwipeDismissal
      onRequestClose={onClose}
    >
      <View style={{ flex: 1, backgroundColor: colors.background }}>
        {sheet === 'player' && (
          <Music
            key={sheet}
            initialPlayer
            onClose={onClose}
            foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive}
          />
        )}
        {sheet === 'settings' && (
          <Settings
            state={state}
            onClose={onClose}
            onRecovery={onRecovery}
            onApple={Platform.OS === 'ios' ? onApple : undefined}
            onTools={onTools}
            onAccount={onAccount}
          />
        )}
        {entry && (
          <AccountSheet
            key={entry}
            entry={entry}
            onClose={onClose}
            profileToken={sheet === 'account' ? profileToken : undefined}
          />
        )}
        {sheet === 'tools' && <RunningTools onBack={onClose} onPrepare={onPrepare} />}
      </View>
    </Modal>
  );
});
