import { useSyncExternalStore } from 'react';
import { getUpdateInfo, updateManager } from '../services/updates';
import { Copy, Panel } from '../ui/components';
import { SettingsDisclosure } from '../ui/settings';
import { spacing } from '../ui/tokens';

export function VersionPanel() {
  const state = useSyncExternalStore(
    updateManager.subscribe,
    updateManager.getSnapshot,
    updateManager.getSnapshot,
  );
  const info = getUpdateInfo();
  const status = !info.enabled
    ? 'Mises à jour automatiques indisponibles dans ce client.'
    : state.status === 'ready'
      ? 'Une mise à jour est prête pour le prochain lancement de Sprinter.'
      : state.status === 'checking'
        ? 'Recherche discrète de mises à jour.'
        : state.status === 'downloading'
          ? 'Téléchargement en cours. Vous pouvez continuer à utiliser Sprinter.'
          : state.status === 'failed'
            ? 'Vérification indisponible. Sprinter conserve sa version locale et réessaiera plus tard.'
            : state.status === 'deferred'
              ? 'La recherche reprendra lorsque les conditions le permettront.'
              : 'Les correctifs compatibles sont téléchargés automatiquement et appliqués au prochain lancement.';
  return (
    <>
      <Panel variant="setting" style={{ gap: spacing.md }}>
        <Copy variant="section">Sprinter {info.version}</Copy>
        {info.build && <Copy muted>Build {info.build}</Copy>}
        <Copy muted>{status}</Copy>
        {info.enabled && (
          <Copy muted variant="caption">
            Aucun redémarrage n’est imposé pendant votre utilisation.
          </Copy>
        )}
        {info.emergency && (
          <Copy muted variant="caption">
            La version de secours embarquée est utilisée.
          </Copy>
        )}
      </Panel>
      {info.enabled && (
        <SettingsDisclosure title="Informations techniques" icon="information-circle-outline">
          <Copy muted variant="caption" selectable>
            Canal : {info.channel ?? 'Non configuré'}
          </Copy>
          <Copy muted variant="caption" selectable>
            Runtime : {info.runtime ?? 'Indisponible'}
          </Copy>
          <Copy muted variant="caption" selectable>
            Version chargée : {info.embedded ? 'Embarquée' : 'Mise à jour automatique'}
          </Copy>
          <Copy muted variant="caption" selectable>
            Identifiant OTA : {info.updateId ?? 'Indisponible'}
          </Copy>
          <Copy muted variant="caption" selectable>
            Date du bundle : {info.createdAt ?? 'Indisponible'}
          </Copy>
        </SettingsDisclosure>
      )}
    </>
  );
}
