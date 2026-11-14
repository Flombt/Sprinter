import { useEffect, useMemo, useState } from 'react';
import { View } from 'react-native';
import { Button, Copy, Divider, Panel, SectionHeading } from '../../ui/components';
import { confirm } from '../../ui/confirm';
import { SettingsNotice } from '../../ui/settings';
import { spacing } from '../../ui/tokens';
import { session } from '../../services/session';
import { useSessionStructure } from '../../services/useSessionSelector';
import { probableDuplicates } from '../duplicates';
import { syncEngine, syncLocal, useSyncStatus } from '../sync';
import { useFlag } from '../../account/config';
import { RouteSettings } from './RouteChoice';

const date = (value: number | null) => (value ? new Date(value).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' }) : 'jamais');
const km = (meters: number) => `${(meters / 1000).toFixed(2).replace('.', ',')} km`;

/** Choix de sauvegarde des courses (§6.5, texte §6.7) : aucune option présélectionnée. */
export function BackupChoice({ onChosen }: { onChosen?: () => void }) {
  const status = useSyncStatus();
  const choose = (on: boolean) => void syncEngine.chooseBackup(on).then(() => onChosen?.());
  return (
    <Panel variant="setting" style={{ gap: spacing.md }}>
      <Copy variant="emphasis">Sauvegarde des courses</Copy>
      <Copy muted>Souhaitez-vous sauvegarder vos courses en ligne pour les retrouver sur vos appareils ? Vous pourrez modifier ce choix dans les réglages.</Copy>
      <Button title="Sauvegarder mes courses" icon="cloud-upload-outline" disabled={status.phase === 'running'} onPress={() => choose(true)} />
      <Button title="Les garder sur cet appareil" icon="phone-portrait-outline" secondary disabled={status.phase === 'running'} onPress={() => choose(false)} />
    </Panel>
  );
}

const PHASE: Record<string, string> = {
  disabled: 'Synchronisation inactive', idle: 'À jour', running: 'Synchronisation en cours…', offline: 'Hors connexion',
  paused: 'En pause', reauth: 'Reconnexion nécessaire', bound_other: 'Appareil lié à un autre compte', error: 'Échec de la dernière synchronisation',
};

/** Compte › Synchronisation (§6.1 étape 5, §7.1 n° 6) : état, éléments en erreur, « Réessayer ». */
export function SyncScreen() {
  const status = useSyncStatus();
  const { history } = useSessionStructure();
  const [blocked, setBlocked] = useState<{ entityId: string; lastError: string | null }[]>([]);
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());
  useEffect(() => {
    void syncEngine.refreshCounts().catch(() => undefined);
    void syncLocal.getState('duplicates_dismissed').then((value) => setDismissed(new Set(value ? JSON.parse(value) as string[] : [])));
  }, []);
  useEffect(() => { void syncLocal.blockedEntries().then(setBlocked).catch(() => undefined); }, [status.blocked]);
  const duplicates = useMemo(() => probableDuplicates(history, dismissed), [dismissed, history]);
  const keepBoth = (key: string) => {
    const next = new Set(dismissed); next.add(key); setDismissed(next);
    void syncLocal.setState('duplicates_dismissed', JSON.stringify([...next]));
  };
  const backupOn = status.backup === 'on' || status.backup === 'pending_on';
  const routesFlag = useFlag('routes_sync_enabled');

  return (
    <View style={{ gap: spacing.lg }}>
      <Panel variant="setting" style={{ gap: spacing.xs }}>
        <Copy variant="emphasis" accessibilityLiveRegion="polite">{PHASE[status.phase] ?? status.phase}</Copy>
        <Copy muted variant="caption">Dernière synchronisation réussie : {date(status.lastSuccessAt)}</Copy>
        {status.pending > 0 && <Copy muted variant="caption">{status.pending} élément{status.pending > 1 ? 's' : ''} en attente d’envoi{status.importing ? ' · import en arrière-plan' : ''}.</Copy>}
        {status.message && <Copy variant="caption" muted>{status.message}</Copy>}
        <Button title="Réessayer" icon="refresh" variant="quiet" disabled={status.phase === 'running'} onPress={() => void syncEngine.retryBlocked()} />
      </Panel>

      {status.backup === 'unset' ? <BackupChoice /> : (
        <Panel variant="setting" style={{ gap: spacing.sm }}>
          <Copy variant="emphasis">Sauvegarde des courses : {backupOn ? 'activée' : 'désactivée'}{status.backup.startsWith('pending') ? ' (en attente de connexion)' : ''}</Copy>
          <Copy muted variant="caption">
            {backupOn ? 'Vos courses sont sauvegardées en ligne et retrouvées sur vos autres appareils.' : 'Vos courses restent sur cet appareil. Les envois sont en pause.'}
          </Copy>
          {backupOn ? (
            <Button title="Désactiver la sauvegarde" variant="quiet" onPress={() => confirm('Désactiver la sauvegarde ?',
              'Les envois s’arrêtent tout de suite sur cet appareil, puis sur vos autres appareils dès confirmation. Les courses déjà en ligne y restent.',
              'Désactiver', () => void syncEngine.chooseBackup(false))} />
          ) : (
            <Button title="Sauvegarder mes courses" variant="quiet" onPress={() => confirm('Sauvegarder vos courses en ligne ?',
              'Souhaitez-vous sauvegarder vos courses en ligne pour les retrouver sur vos appareils ? Vous pourrez modifier ce choix dans les réglages.',
              'Sauvegarder mes courses', () => void syncEngine.chooseBackup(true))} />
          )}
        </Panel>
      )}

      {backupOn && routesFlag && <RouteSettings />}

      {status.deletedElsewhere.length > 0 && (
        <SettingsNotice icon="trash-outline" title={`${status.deletedElsewhere.length} courses supprimées depuis un autre appareil`}
          body="Elles n’existent plus en ligne. Choisissez de les supprimer aussi d’ici ou de les garder uniquement sur cet appareil.">
          <Button title="Les supprimer de cet appareil" danger secondary onPress={() => void syncEngine.resolveDeletedElsewhere('delete')} />
          <Button title="Les garder sur cet appareil uniquement" variant="quiet" onPress={() => void syncEngine.resolveDeletedElsewhere('keep')} />
        </SettingsNotice>
      )}

      {blocked.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="Éléments en erreur" />
          <Panel variant="setting" style={{ gap: spacing.sm }}>
            <Copy muted variant="caption">{blocked.length} élément{blocked.length > 1 ? 's' : ''} n’ont pas pu être envoyés après plusieurs essais. Ils restent sur cet appareil.</Copy>
            <Button title="Réessayer l’envoi" icon="refresh" secondary onPress={() => void syncEngine.retryBlocked()} />
          </Panel>
        </View>
      )}

      {duplicates.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="Doublons probables" />
          {duplicates.slice(0, 10).map(({ key, a, b }) => (
            <Panel key={key} variant="setting" style={{ gap: spacing.sm }}>
              <Copy muted variant="caption">Deux courses démarrées à moins de 2 minutes d’intervalle, de distances proches.</Copy>
              {[a, b].map((run, index) => (
                <View key={run.id} style={{ gap: spacing.xs }}>
                  {index > 0 && <Divider />}
                  <Copy>{new Date(run.startedAt).toLocaleString('fr-FR', { dateStyle: 'medium', timeStyle: 'short' })} · {km(run.distanceMeters)}</Copy>
                  <Button title="Supprimer celle-ci" variant="quiet" icon="trash-outline"
                    onPress={() => confirm('Supprimer cette course ?', 'Elle sera supprimée de cet appareil et de vos sauvegardes.', 'Supprimer', () => void session.deleteRun(run.id), true)} />
                </View>
              ))}
              <Button title="Garder les deux" variant="quiet" onPress={() => keepBoth(key)} />
            </Panel>
          ))}
        </View>
      )}
      <Copy muted variant="caption">La synchronisation n’a jamais lieu pendant une course. Une copie locale de vos courses est conservée avant le premier import.</Copy>
    </View>
  );
}
