import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Copy, Divider, Panel, SectionHeading } from '../../ui/components';
import { confirm } from '../../ui/confirm';
import { spacing } from '../../ui/tokens';
import { account, useAccount } from '../account';
import { formatBytes, formatDate, FormError, FormNotice } from './parts';

type Summary = Awaited<ReturnType<typeof account.summary>>;
const PURPOSE_LABEL: Record<string, string> = {
  terms: 'Conditions d’utilisation', privacy_policy: 'Politique de confidentialité', cloud_sync_runs: 'Sauvegarde des courses',
  cloud_sync_routes: 'Sauvegarde des parcours GPS', community_leaderboard: 'Classement communautaire',
};

/** « Mes données » (§6.5) : contenu en ligne, appareils, historique des choix, export et suppression. */
export function MyData({ onDelete }: { onDelete: () => void }) {
  const state = useAccount();
  const [summary, setSummary] = useState<Summary | null>(null);
  const [failed, setFailed] = useState(false);
  const load = useCallback(() => { setFailed(false); account.summary().then(setSummary).catch(() => setFailed(true)); }, []);
  useEffect(load, [load]);
  return (
    <View style={{ gap: spacing.lg }}>
      <Panel variant="setting" style={{ gap: spacing.sm }}>
        <Copy variant="emphasis">Stocké en ligne</Copy>
        {failed ? (
          <>
            <Copy muted variant="caption">Informations indisponibles hors connexion.</Copy>
            <Button title="Réessayer" variant="quiet" onPress={load} />
          </>
        ) : !summary ? <Copy muted>Chargement…</Copy> : (
          <>
            <Copy muted>{summary.runs} course{summary.runs > 1 ? 's' : ''} · {summary.routes} parcours GPS · {formatBytes(summary.online_bytes)}</Copy>
            <Copy muted variant="caption">Vos courses restent aussi sur cet appareil.</Copy>
          </>
        )}
      </Panel>

      {summary && summary.devices.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="Appareils" />
          <Panel variant="setting" style={{ gap: spacing.md }}>
            {summary.devices.map((device, index) => (
              <View key={device.device_id} style={{ gap: spacing.sm }}>
                {index > 0 && <Divider />}
                <Copy variant="emphasis">{device.platform === 'ios' ? 'iPhone' : 'Android'}{device.current ? ' · cet appareil' : ''}</Copy>
                <Copy muted variant="caption">Version {device.app_version ?? '—'} · vu le {formatDate(device.last_seen_at)}</Copy>
                {!device.current && (
                  <Button title="Déconnecter cet appareil" variant="quiet" icon="log-out-outline" disabled={state.busy}
                    onPress={() => confirm('Déconnecter cet appareil ?', 'Il ne pourra plus synchroniser avec ce compte. Ses données locales ne sont pas effacées.', 'Déconnecter',
                      () => void account.disconnectDevice(device.device_id).then(load), true)} />
                )}
              </View>
            ))}
          </Panel>
        </View>
      )}

      {summary && summary.consents.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="Historique de vos choix" />
          <Panel variant="setting" style={{ gap: spacing.sm }}>
            {summary.consents.slice(0, 20).map((entry, index) => (
              <Copy key={`${entry.purpose}-${entry.at}-${index}`} muted variant="caption">
                {formatDate(entry.at)} · {PURPOSE_LABEL[entry.purpose] ?? entry.purpose} : {entry.granted ? 'accepté' : 'refusé ou retiré'} (version {entry.version})
              </Copy>
            ))}
          </Panel>
        </View>
      )}

      <View style={{ gap: spacing.sm }}>
        <Button title="Exporter mes données" icon="download-outline" secondary disabled={state.busy}
          onPress={() => void account.exportData()} />
        <Copy muted variant="caption">Archive ZIP de tout ce qui est stocké en ligne. Pour un parcours en GPX ou des statistiques en CSV, utilisez l’export du détail de chaque course.</Copy>
      </View>
      <Button title="Supprimer mon compte" icon="trash-outline" danger secondary onPress={onDelete} />
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
    </View>
  );
}
