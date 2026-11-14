import { useEffect } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { session, type SessionState } from '../../services/session';
import { sameFields } from '../../services/snapshotSelection';
import { useSessionSelector } from '../../services/useSessionSelector';
import { Button, Copy, Header, Panel, Screen } from '../../ui/components';
import { confirm } from '../../ui/confirm';
import { useTheme } from '../../ui/theme';
import { spacing } from '../../ui/tokens';
import { hasSignedInAccount, startAccount, useAccount } from '../account';
import { backend } from '../env';
import { FormNotice } from './parts';
import { SignIn } from './SignIn';
import { MaintenanceNotice } from './UpdateRequired';

const selectInterruptedRun = (state: SessionState) => ({
  hasRun: state.run !== null,
  tracking: state.running || state.autoPaused,
  busy: state.busy,
});

export function AccountGate({ onSignedIn }: { onSignedIn: (first: boolean) => void }) {
  const { colors } = useTheme();
  const state = useAccount();
  const { hasRun, tracking, busy } = useSessionSelector(selectInterruptedRun, sameFields);

  useEffect(() => {
    if (tracking && !hasSignedInAccount()) void session.pause();
  }, [tracking]);

  return (
    <Screen gap={spacing.xl}>
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Header subtitle="SPRINTER" title="Bienvenue" />
        <Copy muted>Connectez-vous ou créez un compte pour accéder à Sprinter et démarrer votre course.</Copy>
      </View>
      <MaintenanceNotice />
      {hasRun && (
        <Panel variant="setting" style={{ gap: spacing.sm }}>
          <Copy variant="emphasis">Course interrompue</Copy>
          <Copy muted>
            Votre sortie est conservée. Reconnectez-vous pour la reprendre, ou enregistrez-la ici.
          </Copy>
          <Button
            title="Enregistrer la course"
            icon="save-outline"
            secondary
            disabled={busy}
            onPress={() =>
              confirm(
                'Enregistrer la course ?',
                'Votre sortie sera conservée sur cet appareil.',
                'Enregistrer',
                () => void session.finish(),
              )
            }
          />
        </Panel>
      )}
      {state.status === 'signedOut' ? (
        <>
          {state.pendingDeletion && (
            <Copy muted>Le nettoyage des données de votre compte supprimé est en cours.</Copy>
          )}
          <FormNotice message={state.notice} />
          <SignIn onSignedIn={onSignedIn} />
        </>
      ) : state.status === 'loading' ? (
        <ActivityIndicator color={colors.secondary} accessibilityLabel="Vérification du compte" />
      ) : (
        <Panel variant="setting" style={{ gap: spacing.sm }}>
          <Copy variant="emphasis" accessibilityRole="alert">
            Connexion indisponible
          </Copy>
          <Copy muted>
            {backend
              ? 'Le service de connexion n’a pas pu démarrer.'
              : 'Cette version de Sprinter doit être configurée pour la connexion.'}
          </Copy>
          {backend && <Button title="Réessayer" onPress={startAccount} />}
        </Panel>
      )}
    </Screen>
  );
}
