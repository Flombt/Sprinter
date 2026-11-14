import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { RunRecord } from '../../core/types';
import { Button, Copy, Panel } from '../../ui/components';
import { spacing } from '../../ui/tokens';
import { useAccountsEnabled } from '../../account/account';
import { downloadRoute, syncLocal } from '../sync';

const REASONS: Record<string, string> = {
  unfinished: 'course non terminée', too_short: 'course trop courte', bad_date: 'date incohérente', vehicle_speed: 'vitesse de véhicule',
  superhuman_pace: 'allure hors norme', very_fast: 'allure très rapide', low_gps_reliability: 'GPS peu fiable', overlap: 'chevauche une autre course',
};

/**
 * Détail d'une course : téléchargement à la demande du tracé conservé en ligne (§8.4) et
 * validité calculée par le serveur, affichée à titre d'information (§9.1).
 */
export function CloudRoutePanel({ run }: { run: RunRecord }) {
  const enabled = useAccountsEnabled();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [validity, setValidity] = useState<{ validity: string | null; reasons: string | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    syncLocal.validity(run.id).then((value) => { if (active) setValidity(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [enabled, run.id]);
  if (!enabled) return null;
  const cloud = (run as RunRecord & { cloudRoute?: boolean }).cloudRoute === true && run.points.length === 0;
  const reasons = validity?.reasons ? (JSON.parse(validity.reasons) as string[]).map((reason) => REASONS[reason] ?? reason) : [];
  if (!cloud && (!validity?.validity || validity.validity === 'valid')) return null;
  return (
    <Panel variant="setting" style={{ gap: spacing.sm }}>
      {cloud && (
        <View style={{ gap: spacing.sm }}>
          <Copy variant="emphasis">Parcours sauvegardé en ligne</Copy>
          <Copy muted variant="caption">Le tracé de cette course n’est pas encore sur cet appareil.</Copy>
          {state === 'loading' ? <ActivityIndicator accessibilityLabel="Téléchargement du parcours" /> : (
            <Button title="Télécharger le parcours" icon="download-outline" secondary
              onPress={() => { setState('loading'); downloadRoute(run.id).then(() => setState('idle')).catch(() => setState('error')); }} />
          )}
          {state === 'error' && <Copy variant="caption" muted accessibilityRole="alert">Téléchargement impossible pour le moment. Réessayez avec une connexion.</Copy>}
        </View>
      )}
      {validity?.validity && validity.validity !== 'valid' && (
        <Copy muted variant="caption">
          {validity.validity === 'invalid' ? 'Course non retenue dans les statistiques' : 'Course signalée'} : {reasons.join(', ')}. Information seulement, vos données ne changent pas.
        </Copy>
      )}
    </Panel>
  );
}
