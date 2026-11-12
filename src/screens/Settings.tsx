import { useState, useSyncExternalStore } from 'react';
import { Platform, View } from 'react-native';
import type { Appearance } from '../core/types';
import { session } from '../services/session';
import type { SessionStructure } from '../services/useSessionSelector';
import { CAN_BACKGROUND, IS_EXPO_GO } from '../services/capabilities';
import {
  Button,
  Copy,
  Divider,
  Header,
  IconButton,
  Label,
  ListRow,
  Panel,
  Screen,
  SectionHeading,
} from '../ui/components';
import { SegmentedControl, Toggle } from '../ui/controls';
import { SettingsDisclosure, SettingsNotice } from '../ui/settings';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { spacing } from '../ui/tokens';
import { workouts } from '../workouts/store';
import { CoachingSettings } from '../coaching/SettingsPanel';
import { coachingSummary } from '../coaching/presentation';
import { PrecisionPanel } from '../settings/PrecisionPanel';
import { TrackingPanel } from '../settings/TrackingPanel';

type SettingsPage = 'main' | 'coach' | 'tracking' | 'precision' | 'privacy';
const PAGE_TITLE = {
  coach: 'Personnaliser le coach',
  tracking: 'Suivi de course',
  precision: 'Précision et alertes',
  privacy: 'Vos données',
};

function PrivacyPanel({ onApple }: { onApple?: () => void }) {
  return (
    <>
      <SettingsNotice
        icon="shield-checkmark-outline"
        title="Vos sorties restent locales"
        body={
          'Aucun compte ni abonnement n’est requis pour enregistrer une course. Vos ' +
          'parcours ne sont pas publiés automatiquement.'
        }
      />
      <Panel variant="setting" style={{ gap: spacing.md }}>
        <Copy accessibilityRole="header" variant="section">
          Conserver votre historique
        </Copy>
        <Copy muted>
          Vos activités sont enregistrées dans le stockage de l’application. Désinstaller Sprinter ou vider
          ses données supprime cet historique.
        </Copy>
        <Copy muted variant="caption">
          Conservez vos sorties importantes avec les exports disponibles dans leur détail, comme le GPX pour
          un parcours ou les statistiques au format CSV.
        </Copy>
      </Panel>
      <Panel variant="setting" style={{ gap: spacing.md }}>
        <Copy accessibilityRole="header" variant="section">
          Intégrations facultatives
        </Copy>
        <Copy muted variant="caption">
          Les exports et intégrations dépendent de vos actions ou des options que vous autorisez. Spotify
          nécessite son propre compte ; Apple Santé et l’affichage verrouillé se configurent séparément.
        </Copy>
        <Copy muted variant="caption">
          Activer l’affichage d’une course sur l’écran verrouillé ne remplace pas l’autorisation de suivi GPS
          en arrière-plan.
        </Copy>
        {onApple && (
          <Button title="Apple Santé et confidentialité" secondary icon="logo-apple" onPress={onApple} />
        )}
      </Panel>
    </>
  );
}

export default function Settings({
  state,
  onApple,
  onTools,
  onRecovery,
  onClose,
}: {
  state: SessionStructure;
  onApple?: () => void;
  onTools?: () => void;
  onRecovery?: () => void;
  onClose?: () => void;
}) {
  const { colors } = useTheme();
  const { largeText } = useAdaptiveLayout();
  const [page, setPage] = useState<SettingsPage>('main');
  const library = useSyncExternalStore(workouts.subscribe, workouts.getSnapshot, workouts.getSnapshot);
  const coach = coachingSummary(state.settings.coaching);
  const audio = state.settings.audioEnabled,
    haptics = state.settings.hapticsEnabled;
  const background = state.runId
    ? state.backgroundActive
    : CAN_BACKGROUND && state.settings.backgroundEnabled;
  const trackingLabel =
    state.runId && !state.running && !state.autoPaused
      ? 'Course en pause'
      : background
        ? state.runId
          ? 'Suivi verrouillé démarré'
          : 'Suivi verrouillé configuré'
        : 'Premier plan uniquement';
  const coachSummary =
    `${coach.label}${coach.customized ? ' personnalisé' : ''}` +
    ` · ${coach.enabled} type${coach.enabled > 1 ? 's' : ''} d’annonce`;
  const voiceMessage = library.message && (
    <Copy accessibilityRole="alert" variant="caption" style={{ color: colors.danger }}>
      {library.message}
    </Copy>
  );
  const main = () => setPage('main');
  const close = onClose && <IconButton icon="close" label="Fermer les réglages" onPress={onClose} quiet />;

  if (page !== 'main')
    return (
      <Screen key={page}>
        <Header title={PAGE_TITLE[page]} subtitle="Réglages" onBack={main} right={close} />
        {page === 'coach' && (
          <>
            <SettingsNotice
              icon="mic-outline"
              title={
                library.preferences.voiceEnabled && audio
                  ? 'Voix activée au premier plan'
                  : 'Votre configuration du coach'
              }
              body={
                library.preferences.voiceEnabled && !audio
                  ? 'La voix est activée, mais nécessite aussi les signaux audio. Activez-les ' +
                    'dans les réglages principaux pour entendre les consignes.'
                  : 'Ces choix définissent les événements proposés au coach. La voix, les bips ' +
                    'et les vibrations restent soumis aux interrupteurs des réglages principaux et aux limites iOS.'
              }
            />
            {voiceMessage}
            <CoachingSettings
              value={state.settings.coaching}
              onChange={(coaching) => void session.updateSettings({ coaching })}
            />
          </>
        )}
        {page === 'tracking' && <TrackingPanel state={state} onApple={onApple} />}
        {page === 'precision' && (
          <PrecisionPanel
            value={state.settings.config}
            onChange={(key, value) =>
              void session.updateSettings({ config: { ...state.settings.config, [key]: value } })
            }
          />
        )}
        {page === 'privacy' && <PrivacyPanel onApple={onApple} />}
      </Screen>
    );

  return (
    <Screen key="settings-main">
      <Header title="Réglages" subtitle="Sprinter" right={close} />
      <Copy muted>Un coach à votre mesure, des réglages faciles à retrouver.</Copy>
      <View style={{ gap: spacing.md }}>
        <SectionHeading title="Coach de course" />
        <Panel variant="setting" style={{ gap: spacing.lg }}>
          <Toggle
            title="Vibrations"
            body="Retours tactiles de l’interface et repères du coach au premier plan."
            value={haptics}
            onChange={(hapticsEnabled) => void session.updateSettings({ hapticsEnabled })}
          />
          <Divider />
          <Toggle
            title="Signaux audio"
            body="Repères sonores pour accélérer ou ralentir."
            value={audio}
            onChange={(audioEnabled) => void session.updateSettings({ audioEnabled })}
          />
          <Divider />
          <Toggle
            title="Voix du coach"
            body="Consignes et objectif lus au premier plan. Nécessite les signaux audio."
            value={library.preferences.voiceEnabled}
            disabled={!library.ready}
            onChange={(enabled) => void workouts.setVoice(enabled)}
          />
          {library.preferences.voiceEnabled && !audio && (
            <Copy variant="caption" style={{ color: colors.warning.text }}>
              Voix en attente : activez les signaux audio pour entendre le coach.
            </Copy>
          )}
          {library.preferences.voiceEnabled && audio && (
            <Copy muted variant="caption">
              Sur iPhone, désactivez le mode silencieux pour entendre la voix.
            </Copy>
          )}
          {voiceMessage}
        </Panel>
        <ListRow
          title="Niveau et annonces"
          icon="chatbubble-ellipses-outline"
          onPress={() => setPage('coach')}
          label={`Personnaliser le coach. ${coachSummary}`}
          subtitle={
            <Copy muted variant="caption">
              {coachSummary} · contenu, fréquence et priorité.
            </Copy>
          }
        />
        <SettingsDisclosure
          title="Reconnaître les signaux"
          icon="ear-outline"
          summary="Aperçus audio et haptiques, selon les options activées."
        >
          <View style={{ gap: spacing.sm }}>
            <Copy variant="emphasis">Ralentir</Copy>
            <Copy muted variant="caption">
              Deux notes descendantes et deux impacts courts, si ces signaux sont activés.
            </Copy>
          </View>
          <View style={{ gap: spacing.sm }}>
            <Copy variant="emphasis">Accélérer</Copy>
            <Copy muted variant="caption">
              Une note longue et aiguë, avec une vibration système si activée.
            </Copy>
          </View>
          <View style={{ flexDirection: largeText ? 'column' : 'row', gap: spacing.sm }}>
            <Button
              title="Signal ralentir"
              icon="arrow-down"
              secondary
              disabled={!audio && !haptics}
              hint="Émettre le signal ralentir avec les options activées."
              style={{ flex: largeText ? undefined : 1 }}
              onPress={() => void session.testCue('slowDown')}
            />
            <Button
              title="Signal accélérer"
              icon="arrow-up"
              secondary
              disabled={!audio && !haptics}
              hint="Émettre le signal accélérer avec les options activées."
              style={{ flex: largeText ? undefined : 1 }}
              onPress={() => void session.testCue('speedUp')}
            />
          </View>
          {!audio && !haptics && (
            <Copy muted variant="caption">
              Activez les signaux audio ou les vibrations pour utiliser ces aperçus.
            </Copy>
          )}
          <Copy muted variant="small">
            Aucun message vocal n’est lu ici. iOS peut limiter les vibrations ; les effets personnalisés ne
            sont pas émis écran verrouillé.
          </Copy>
        </SettingsDisclosure>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeading title="Course et intégrations" />
        <ListRow
          title="Suivi de course"
          icon="location-outline"
          onPress={() => setPage('tracking')}
          label={
            `Suivi de course. ${trackingLabel}. Pause automatique ` +
            (state.settings.autoPauseEnabled ? 'activée.' : 'désactivée.')
          }
          subtitle={
            <Copy muted variant="caption">
              {trackingLabel} · pause automatique {state.settings.autoPauseEnabled ? 'activée' : 'désactivée'}
              .
            </Copy>
          }
        />
        {onTools && (
          <ListRow
            title="Parcours et outils"
            icon="map-outline"
            onPress={onTools}
            subtitle={
              <Copy muted variant="caption">
                Favoris, import GPX, métronome et partage.
              </Copy>
            }
          />
        )}
        {onApple && (
          <ListRow
            title="Apple et écran verrouillé"
            icon="logo-apple"
            onPress={onApple}
            subtitle={
              <Copy muted variant="caption">
                Santé, Activités en direct et autorisations. {IS_EXPO_GO ? 'Version installée requise.' : ''}
              </Copy>
            }
          />
        )}
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeading title="Apparence" />
        <Panel variant="setting" style={{ gap: spacing.md }}>
          <SegmentedControl<Appearance>
            label="Apparence de Sprinter"
            value={state.settings.appearance}
            choices={[
              ['system', 'Système'],
              ['light', 'Clair'],
              ['dark', 'Sombre'],
            ]}
            onChange={(appearance) => void session.updateSettings({ appearance })}
          />
        </Panel>
      </View>

      <View style={{ gap: spacing.md }}>
        <SectionHeading title="Avancé" />
        {onRecovery && (
          <ListRow
            title="Sauvegardes de récupération"
            icon="archive-outline"
            onPress={onRecovery}
            subtitle={
              <Copy muted variant="caption">
                {state.recoveryBlocked
                  ? 'Conserver la sauvegarde interrompue et débloquer le départ.'
                  : 'Retrouver et exporter les sauvegardes conservées.'}
              </Copy>
            }
          />
        )}
        <ListRow
          title="Précision et alertes"
          icon="options-outline"
          onPress={() => setPage('precision')}
          label={
            `Précision et alertes. Lissage ${state.settings.config.smoothingSeconds} secondes. ` +
            `Confirmation ${state.settings.config.confirmationSeconds} secondes.`
          }
          subtitle={
            <Copy muted variant="caption">
              Lissage {state.settings.config.smoothingSeconds} s · confirmation{' '}
              {state.settings.config.confirmationSeconds} s. Tolérances et seuil chronométrique.
            </Copy>
          }
        />
        <ListRow
          title="Vos données"
          icon="shield-checkmark-outline"
          onPress={() => setPage('privacy')}
          subtitle={
            <Copy muted variant="caption">
              Stockage local, conservation et intégrations facultatives.
            </Copy>
          }
        />
      </View>
      <Label>
        Sprinter 1.0 · {Platform.OS === 'web' ? 'Aperçu web' : IS_EXPO_GO ? 'Expo Go' : 'Version installée'}
      </Label>
    </Screen>
  );
}
