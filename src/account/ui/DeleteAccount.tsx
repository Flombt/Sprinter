import { useState } from 'react';
import { forgetLocalProfile } from '../../profile/profile';
import { View } from 'react-native';
import { Button, Copy, Panel } from '../../ui/components';
import { Toggle } from '../../ui/controls';
import { SettingsNotice } from '../../ui/settings';
import { confirm } from '../../ui/confirm';
import { spacing } from '../../ui/tokens';
import { session } from '../../services/session';
import { account, useAccount } from '../account';
import { FormError } from './parts';
import { Reauthenticate } from './Reauthenticate';

/** Suppression du compte (§6.6, §6.7) : réauthentification < 5 min, courses locales conservées par défaut. */
export function DeleteAccount({ onDone }: { onDone: () => void }) {
  const state = useAccount();
  const [wipe, setWipe] = useState(false);
  const [confirmed, setConfirmed] = useState(account.recentlyAuthenticated());
  const remove = () =>
    confirm('Supprimer définitivement ?',
      'Votre compte et toutes vos données stockées en ligne seront supprimés définitivement. Cette action est irréversible.',
      'Supprimer', () => { const owner = account.getSnapshot().userId; void account.deleteAccount().then(async (result) => {
        if (!result) { setConfirmed(account.recentlyAuthenticated()); return; }
        // Le profil personnalisé du compte supprimé quitte aussi l'appareil (§17.9).
        if (owner) await forgetLocalProfile(owner).catch(() => undefined);
        if (wipe) await session.purgeLocalHistory();
        onDone();
      }); }, true);
  return (
    <View style={{ gap: spacing.lg }}>
      <SettingsNotice icon="warning-outline" title="Action irréversible"
        body="Votre compte et toutes vos données stockées en ligne seront supprimés définitivement. Vos courses restent sur cet appareil. Cette action est irréversible." />
      <Panel variant="setting">
        <Toggle title="Effacer aussi les courses de cet appareil" body="Désactivé par défaut : vos courses restent disponibles sans compte." value={wipe} onChange={setWipe} />
      </Panel>
      {!confirmed ? (
        <Reauthenticate reason="La suppression exige une connexion de moins de 5 minutes." onConfirmed={() => setConfirmed(true)} />
      ) : (
        <Button title="Supprimer mon compte" icon="trash-outline" danger disabled={state.busy} onPress={remove} />
      )}
      {state.busy && <Copy muted accessibilityLiveRegion="polite">Suppression en cours…</Copy>}
      <FormError message={state.error} />
    </View>
  );
}
