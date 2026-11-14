import { useState } from 'react';
import { Alert, Platform } from 'react-native';
import { Button, Copy, Panel } from '../../ui/components';
import { confirm } from '../../ui/confirm';
import { spacing } from '../../ui/tokens';
import { chooseRouteBackup, useSyncStatus } from '../sync';

/** Choix des parcours GPS (§6.7, §8.1) : posé une fois, aucune réponse présélectionnée. */
export function RouteChoice({ onChosen }: { onChosen?: () => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const choose = (on: boolean) => {
    setBusy(true); setError(null);
    chooseRouteBackup(on).then(() => onChosen?.()).catch(() => setError('Connexion requise pour enregistrer ce choix.')).finally(() => setBusy(false));
  };
  return (
    <Panel variant="setting" style={{ gap: spacing.md }}>
      <Copy variant="emphasis">Parcours GPS</Copy>
      <Copy muted>Sauvegarder aussi vos parcours GPS ? Ils sont stockés de façon privée, visibles de vous seul. Vous pouvez changer d’avis à tout moment.</Copy>
      <Button title="Sauvegarder les parcours" icon="map-outline" disabled={busy} onPress={() => choose(true)} />
      <Button title="Les garder sur cet appareil" icon="phone-portrait-outline" secondary disabled={busy} onPress={() => choose(false)} />
      {error && <Copy variant="caption" muted accessibilityRole="alert">{error}</Copy>}
    </Panel>
  );
}

/** État et désactivation (§8.5) : « Supprimer aussi mes parcours en ligne » ou « Les conserver ». */
export function RouteSettings() {
  const status = useSyncStatus();
  if (status.routes === 'unset') return <RouteChoice />;
  const disable = () => {
    const body = 'Les nouveaux parcours ne seront plus envoyés. Que faire de ceux déjà en ligne ?';
    if (Platform.OS === 'web') { confirm('Arrêter la sauvegarde des parcours ?', body, 'Les conserver', () => void chooseRouteBackup(false)); return; }
    Alert.alert('Arrêter la sauvegarde des parcours ?', body, [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Les conserver', onPress: () => void chooseRouteBackup(false) },
      { text: 'Supprimer aussi mes parcours en ligne', style: 'destructive', onPress: () => void chooseRouteBackup(false, true) },
    ]);
  };
  return (
    <Panel variant="setting" style={{ gap: spacing.sm }}>
      <Copy variant="emphasis">Parcours GPS : {status.routes === 'on' ? 'sauvegardés' : 'gardés sur l’appareil'}</Copy>
      <Copy muted variant="caption">
        {status.routes === 'on'
          ? 'Chaque parcours part après la synchronisation de sa course, jamais pendant une course. Stockage privé, visible de vous seul.'
          : 'Les parcours déjà en ligne restent privés et téléchargeables, jusqu’à leur suppression.'}
      </Copy>
      {status.routes === 'on'
        ? <Button title="Arrêter la sauvegarde des parcours" variant="quiet" onPress={disable} />
        : <Button title="Sauvegarder les parcours" variant="quiet" onPress={() => confirm('Sauvegarder vos parcours GPS ?', 'Ils sont stockés de façon privée, visibles de vous seul.', 'Sauvegarder les parcours', () => void chooseRouteBackup(true))} />}
      {status.routes === 'off' && (
        <Button title="Supprimer mes parcours en ligne" variant="quiet" icon="trash-outline"
          onPress={() => confirm('Supprimer vos parcours en ligne ?', 'Les fichiers et leurs aperçus seront supprimés. Les parcours restent sur les appareils qui les ont enregistrés.', 'Supprimer', () => void chooseRouteBackup(false, true), true)} />
      )}
    </Panel>
  );
}
