import { useEffect, useState } from 'react';
import { ActivityIndicator, ScrollView, StyleSheet, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { session, type SessionState } from '../../services/session';
import { sameFields } from '../../services/snapshotSelection';
import { useSessionSelector } from '../../services/useSessionSelector';
import { Button, Copy, Header, Panel, Screen } from '../../ui/components';
import { Brand } from '../../ui/brand';
import { EditorialImage, editorialMedia, PhotoShade } from '../../ui/editorial';
import { confirm } from '../../ui/confirm';
import { useAdaptiveLayout, useTheme } from '../../ui/theme';
import { editorial, layout, spacing } from '../../ui/tokens';
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

function Welcome({ onContinue }: { onContinue: () => void }) {
  const { largeText, compact } = useAdaptiveLayout();
  const { reduceTransparency } = useTheme();
  const insets = useSafeAreaInsets();
  const gutter = compact ? layout.compactGutter : layout.screenGutter;
  return (
    <View style={{ flex: 1, backgroundColor: editorial.surface }}>
      <StatusBar style="light" />
      <EditorialImage source={editorialMedia.welcome} contentPosition={{ left: '49%', top: '52%' }} />
      <PhotoShade full />
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={[
          styles.welcome,
          {
            paddingTop: insets.top + spacing.md,
            paddingBottom: Math.max(insets.bottom, spacing.lg),
            paddingHorizontal: Math.max(gutter, insets.left, insets.right),
          },
        ]}
      >
        <Brand onPhoto />
        <View style={[styles.caption, reduceTransparency && { backgroundColor: editorial.surface }]}>
          <Copy
            accessibilityRole="header"
            variant={largeText || compact ? 'title' : 'editorialCover'}
            style={styles.photoText}
          >
            {'Courir.\nRespirer.\nRecommencer.'}
          </Copy>
          <Copy style={styles.photoText}>Connectez-vous ou créez un compte pour accéder à Sprinter.</Copy>
          <Button title="Continuer" endIcon="arrow-forward" onPhoto onPress={onContinue} />
        </View>
      </ScrollView>
    </View>
  );
}

export function AccountGate() {
  const { colors } = useTheme();
  const state = useAccount();
  const { hasRun, tracking, busy } = useSessionSelector(selectInterruptedRun, sameFields);
  const [continued, setContinued] = useState(false);

  useEffect(() => {
    if (tracking && !hasSignedInAccount()) void session.pause();
  }, [tracking]);

  const canShowWelcome = state.status === 'signedOut' && !hasRun && !state.pendingDeletion;
  if (canShowWelcome && !continued) return <Welcome onContinue={() => setContinued(true)} />;
  return (
    <Screen gap={spacing.xl}>
      <View style={{ marginTop: spacing.xl, gap: spacing.md }}>
        <Header
          subtitle="SPRINTER"
          title="Connexion"
          editorial
          onBack={canShowWelcome ? () => setContinued(false) : undefined}
        />
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
          <SignIn />
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

const styles = StyleSheet.create({
  welcome: { flexGrow: 1, justifyContent: 'space-between', gap: 160 },
  caption: { gap: spacing.md },
  photoText: { color: editorial.ink },
});
