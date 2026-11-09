import type { RunRecord } from '../core/types';
import type { SessionState } from '../services/session';
import { session } from '../services/session';
import { useTools } from './components';
import { toolsStore } from './store';
import { Button, Copy, Label, Panel } from '../ui/components';
import { useTheme } from '../ui/theme';
export function FavouriteActions({ run, onTools, onRepeat }: { run: RunRecord; onTools?: () => void; onRepeat?: () => void }) {
  const state = useTools(), favourite = state.routes.find(r => r.sourceActivityId === run.id);
  const repeat = async () => {
    if (!favourite && !await toolsStore.saveActivityRoute(run)) return;
    const route = toolsStore.getSnapshot().routes.find(r => r.sourceActivityId === run.id);
    if (route && await toolsStore.update({ selectedRouteId: route.id })) onRepeat?.();
  };
  return <Panel style={{ gap: 12 }}><Label>Parcours favori</Label>
    <Button title={favourite ? 'Parcours déjà dans mes favoris' : 'Enregistrer cet itinéraire favori'} secondary icon="bookmark-outline" disabled={!state.ready || state.busy || !!favourite || run.points.length < 2} onPress={() => void toolsStore.saveActivityRoute(run)} />
    {onRepeat && <Button title="Refaire ce parcours" secondary icon="footsteps-outline" disabled={!state.ready || state.busy || !!session.getSnapshot().run || run.points.length < 2} onPress={() => void repeat()} />}
    {onTools && <Button title="Ouvrir mes parcours et outils" secondary onPress={onTools} />}
    {state.message && <Copy accessibilityRole="alert" muted variant="caption">{state.message}</Copy>}
  </Panel>;
}
export function NavigationPanel({ state }: { state: SessionState }) {
  const tools = useTools(), { colors } = useTheme(), run = state.run;
  if (!run?.routeId) return null;
  const route = tools.routes.find(r => r.id === run.routeId), navigation = tools.navigation;
  const status = !route ? 'Tracé indisponible sur cet appareil' : navigation.status === 'paused' ? 'Guidage en pause' : navigation.status === 'offRoute' ? 'Éloignement confirmé du tracé'
    : navigation.status === 'onRoute' ? navigation.distanceMeters !== null && navigation.distanceMeters > tools.preferences.departureMeters ? 'Écart en cours de vérification' : 'À proximité du tracé' : 'En attente d’une position GPS précise';
  return <Panel style={{ gap: 10 }}><Label>Parcours · {run.routeName ?? route?.name ?? 'Référence'}</Label>
    <Copy style={{ color: navigation.status === 'offRoute' ? colors.orange : colors.text, fontWeight: '600' }} accessibilityLiveRegion="polite">{status}</Copy>
    <Copy muted>Écart au tracé : {navigation.distanceMeters === null ? '—' : `${Math.round(navigation.distanceMeters)} m`}</Copy>
    <Copy muted variant="small">Tracé bleu, course enregistrée en vert. Aucun calcul de route, instruction de virage ou suivi partagé en direct. Les alertes audio suivent vos réglages de coach ; les fonds de carte peuvent manquer hors ligne.</Copy>
  </Panel>;
}
