import { useWindowDimensions, View } from 'react-native';
import { targetLabel } from '../core/format';
import type { PaceTarget } from '../core/types';
import type { SessionStructure } from '../services/useSessionSelector';
import { Brand } from '../ui/brand';
import { Button, Copy, IconButton, Label, Screen } from '../ui/components';
import { DetailRow, editorialMedia, paceReadout, PhotoCover } from '../ui/editorial';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { spacing } from '../ui/tokens';
import { useRunSetup } from '../ui/useRunSetup';

export default function Home({
  state,
  target,
  starting,
  onStart,
  onPrepare,
  onWorkouts,
  onRecovery,
  onReturn,
  onMusic,
}: {
  state: SessionStructure;
  target: PaceTarget;
  starting: boolean;
  onStart: () => void;
  onPrepare: () => void;
  onWorkouts: () => void;
  onRecovery: () => void;
  onReturn: () => void;
  onMusic: () => void;
}) {
  const { colors } = useTheme();
  const { largeText } = useAdaptiveLayout();
  const { height } = useWindowDimensions();
  const setup = useRunSetup(target, state);
  const paused = state.runId !== null;
  const busy = starting || state.busy;
  const title = paused
    ? 'Revenir à la course'
    : busy
      ? 'Préparation du GPS…'
      : state.recoveryBlocked
        ? 'Récupérer la course'
        : setup.error
          ? 'Vérifier la préparation'
          : 'Démarrer';
  const start = paused ? onReturn : state.recoveryBlocked ? onRecovery : setup.error ? onPrepare : onStart;

  return (
    <Screen
      gap={spacing.md}
      top={spacing.xs}
      footer={
        <Button
          title={title}
          endIcon={paused || setup.error ? 'arrow-forward' : 'play'}
          onPress={start}
          disabled={busy && !paused}
        />
      }
    >
      <View
        style={{
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: spacing.sm,
        }}
      >
        <Brand />
        <IconButton
          square
          icon="musical-notes-outline"
          label="Ouvrir la bibliothèque Musique"
          onPress={onMusic}
        />
      </View>
      <PhotoCover
        source={editorialMedia.run}
        position={{ left: '71%', top: '52%' }}
        title={'À votre\nallure.'}
        eyebrow={paused ? 'Course en pause' : (setup.definition?.name ?? 'Course libre')}
        height={Math.min(320, Math.max(215, height * 0.38))}
      />
      {paused ? (
        <Copy muted>Reprenez ou terminez votre activité depuis l’écran de course.</Copy>
      ) : (
        <>
          <View
            style={{
              flexDirection: 'row',
              flexWrap: 'wrap',
              alignItems: 'flex-end',
              justifyContent: 'space-between',
              gap: spacing.md,
            }}
          >
            <View style={{ minWidth: 0, flexShrink: 1, width: largeText ? '100%' : undefined }}>
              <Label>{setup.definition ? 'Séance sélectionnée' : 'Allure cible'}</Label>
              {setup.definition ? (
                <Copy variant="heading">{setup.definition.name}</Copy>
              ) : (
                <Copy
                  variant="editorialTitle"
                  accessibilityLabel={'Allure cible ' + targetLabel(setup.target) + ' par kilomètre'}
                >
                  {paceReadout(targetLabel(setup.target))}{' '}
                  <Copy variant="bodyCompact" style={{ color: colors.secondary }}>
                    /km
                  </Copy>
                </Copy>
              )}
            </View>
            <Button title="Préparer" endIcon="options-outline" secondary size="compact" onPress={onPrepare} />
          </View>
          {state.recoveryBlocked ? (
            <Copy variant="caption" accessibilityRole="alert" style={{ color: colors.danger }}>
              Une sauvegarde interrompue doit être récupérée avant le départ.
            </Copy>
          ) : setup.error ? (
            <Copy variant="caption" accessibilityRole="alert" style={{ color: colors.danger }}>
              {setup.error}
            </Copy>
          ) : null}
          <View style={{ borderTopWidth: 1, borderColor: colors.line }}>
            <DetailRow
              title="Séances"
              icon="layers-outline"
              onPress={onWorkouts}
              rule={false}
              disabled={busy}
            />
          </View>
        </>
      )}
    </Screen>
  );
}
