import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import type { RunRecord } from '../../core/types';
import { Button, Copy, Panel } from '../../ui/components';
import { spacing } from '../../ui/tokens';
import { useTheme } from '../../ui/theme';
import { useAccountsEnabled } from '../../account/account';
import { downloadRoute, syncLocal } from '../sync';
import type { RouteProgress } from '../routes';

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
  const { colors } = useTheme();
  const [state, setState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [progress, setProgress] = useState<RouteProgress | null>(null);
  const [validity, setValidity] = useState<{ validity: string | null; reasons: string | null } | null>(null);
  useEffect(() => {
    if (!enabled) return;
    let active = true;
    syncLocal.validity(run.id).then((value) => { if (active) setValidity(value); }).catch(() => undefined);
    return () => { active = false; };
  }, [enabled, run.id]);
  const cloud = (run as RunRecord & { cloudRoute?: boolean }).cloudRoute === true && run.points.length === 0;
  const [attempt, setAttempt] = useState(0);
  const retry = useCallback(() => setAttempt((value) => value + 1), []);
  useEffect(() => {
    if (!enabled || !cloud) return;
    let active = true;
    setState('loading');
    setProgress(null);
    downloadRoute(run.id, (value) => { if (active) setProgress(value); })
      .then(() => { if (active) setState('idle'); })
      .catch(() => { if (active) setState('error'); });
    return () => { active = false; };
  }, [enabled, cloud, run.id, attempt]);
  if (!enabled) return null;
  const percent = progress?.total ? Math.min(100, Math.round(progress.received / progress.total * 100)) : null;
  const reasons = validity?.reasons ? (JSON.parse(validity.reasons) as string[]).map((reason) => REASONS[reason] ?? reason) : [];
  if (!cloud && (!validity?.validity || validity.validity === 'valid')) return null;
  return (
    <Panel variant="setting" style={{ gap: spacing.sm }}>
      {cloud && (
        <View style={{ gap: spacing.sm }}>
          <Copy variant="emphasis">Parcours sauvegardé en ligne</Copy>
          <Copy muted variant="caption">Le tracé de cette course n’est pas encore sur cet appareil.</Copy>
          {state === 'loading' && <View style={{ gap: spacing.sm }}>
            <ActivityIndicator accessibilityLabel="Téléchargement du parcours" />
            <View accessibilityRole="progressbar" accessibilityLabel="Téléchargement du parcours"
              accessibilityValue={percent === null ? { text: 'En cours' } : { min: 0, max: 100, now: percent }}
              style={{ height: 4, borderRadius: 2, backgroundColor: colors.line, overflow: 'hidden' }}>
              <View style={{ height: 4, width: `${percent ?? 0}%`, backgroundColor: colors.secondary }} />
            </View>
            {percent !== null && <Copy muted variant="caption">{percent} %</Copy>}
          </View>}
          {state === 'error' && <Button title="Réessayer" icon="download-outline" secondary onPress={retry} />}
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
