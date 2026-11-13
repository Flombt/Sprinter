import { Switch } from '../ui/controls';
import { useMemo, useRef, useState } from 'react';
import { Share, View } from 'react-native';
import type { RunRecord } from '../core/types';
import type { SavedRoute } from '../routes/types';
import { Button, Copy, Label, Panel, styles } from '../ui/components';
import { useTheme } from '../ui/theme';
import RouteMap from '../ui/RouteMap';
import { activityDocument, activitySummary, publicActivitySegments, routeDocument, statisticsDocument } from './documents';
import { defaultExportPrivacy, endpointZones, maskedSegments, type ExportPrivacy } from './privacy';
import { shareDocument } from '../services/documentShare';
import { gpxTrackSegments } from '../analysis/export/gpx';
import { shareActivityExport } from '../services/activityExport';

export function ActivityGpxButton({ run }: { run: RunRecord }) {
  const { colors } = useTheme();
  const pending = useRef(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const exportGpx = async () => {
    if (pending.current) return;
    pending.current = true;
    setBusy(true);
    setError(null);
    try {
      await shareActivityExport(run, 'gpx');
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      pending.current = false;
      setBusy(false);
    }
  };

  return (
    <View style={{ flexShrink: 1 }}>
      <Button title={busy ? 'Préparation…' : 'Exporter en GPX'} icon="download-outline"
        size="compact" variant="quiet" disabled={busy} onPress={() => void exportGpx()}
        hint="Ouvre le partage du tracé GPS complet avec les horaires enregistrés." />
      {error && <Copy accessibilityRole="alert" variant="caption" style={{ color: colors.danger }}>{error}</Copy>}
    </View>
  );
}

function PrivacyControls({ value, onChange }: { value: ExportPrivacy; onChange: (privacy: ExportPrivacy) => void }) {
  return <View style={{ gap: 12 }}><View style={[styles.row, { gap: 16 }]}><View style={{ flex: 1 }}><Copy style={{ fontWeight: '600' }}>Copie publique avec zones masquées</Copy><Copy muted variant="caption">{value.mode === 'public' ? 'Retirer les environs du départ et de l’arrivée, y compris les passages ultérieurs.' : 'Copie complète : les coordonnées et, pour une activité, les horaires peuvent être partagés.'}</Copy></View>
    <Switch accessibilityLabel="Masquer les zones de départ et d’arrivée pour le partage" value={value.mode === 'public'} onValueChange={enabled => onChange({ ...value, mode: enabled ? 'public' : 'private' })} /></View>
    {value.mode === 'public' && <><Label>Rayon autour de chaque extrémité</Label><View style={[styles.row, { flexWrap: 'wrap', gap: 8 }]}>{[100, 300, 500, 1000, 2000].map(radius => <Button key={radius} title={`${radius} m`} secondary={value.radiusMeters !== radius} onPress={() => onChange({ ...value, radiusMeters: radius })} />)}</View></>}
    <Copy muted variant="small">Le masquage concerne uniquement la copie exportée. Il réduit l’exposition des lieux sans garantir l’anonymat. La feuille de partage reste sous votre contrôle ; aucun partage en direct n’est activé.</Copy>
  </View>;
}
export function ActivitySharing({ run }: { run: RunRecord }) {
  const [privacy, setPrivacy] = useState<ExportPrivacy>({ ...defaultExportPrivacy }), [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const { colors } = useTheme();
  const segments = useMemo(() => !preview ? [] : privacy.mode === 'public' ? publicActivitySegments(run, privacy.radiusMeters)
    : gpxTrackSegments(run).map(s => s.map(p => p.fix)), [preview, privacy.mode, privacy.radiusMeters, run]);
  const act = async (kind: 'gpx' | 'csv' | 'summary' | 'statistics') => {
    if (busy) return; setBusy(true); setMessage(null);
    try {
      if (kind === 'summary') await Share.share({ message: activitySummary(run), title: 'Ma course avec Sprinter' });
      else if (kind === 'statistics') await shareDocument(statisticsDocument(run, privacy));
      else await shareDocument(activityDocument(run, kind, privacy));
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <Panel style={{ gap: 14 }}><Label>Partager une copie</Label><PrivacyControls value={privacy} onChange={setPrivacy} />
    <Button title={preview ? 'Fermer l’aperçu de la copie' : 'Voir le tracé qui sera partagé'} secondary disabled={busy || !run.points.length} onPress={() => setPreview(!preview)} />
    {preview && <><RouteMap key={`${run.id}:${privacy.mode}:${privacy.radiusMeters}`} points={[]} reference={segments} height={180} interactive /><Copy muted variant="small">{segments.reduce((n, s) => n + s.length, 0)} point(s) conservé(s). La copie publique ne contient ni identifiant ni horodatage des positions.</Copy></>}
    <Button title="Partager le résumé sans position" secondary icon="share-outline" disabled={busy} onPress={() => void act('summary')} />
    <Button title={`Exporter GPX ${privacy.mode === 'public' ? 'masqué' : 'complet'}`} secondary icon="share-outline" disabled={busy || run.points.length < (privacy.mode === 'public' ? 2 : 1)} onPress={() => void act('gpx')} />
    <Button title={`Exporter CSV ${privacy.mode === 'public' ? 'public' : 'complet'}`} secondary icon="share-outline" disabled={busy} onPress={() => void act('csv')} />
    <Button title="Exporter les statistiques CSV sans positions" secondary icon="stats-chart-outline" disabled={busy} onPress={() => void act('statistics')} />
    <Copy muted variant="small">Le résumé et le CSV public conservent les vrais compteurs de la course entière. Le GPX public décrit seulement le tracé restant, sans temps ni compteurs d’origine. Dans la feuille de partage iPhone, « Enregistrer dans Fichiers » conserve la copie choisie.</Copy>
    {message && <Copy accessibilityRole="alert" style={{ color: colors.warning.text }}>{message}</Copy>}
  </Panel>;
}
export function RouteSharing({ route }: { route: SavedRoute }) {
  const [privacy, setPrivacy] = useState<ExportPrivacy>({ ...defaultExportPrivacy }), [preview, setPreview] = useState(false);
  const [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const segments = useMemo(() => privacy.mode === 'public' ? maskedSegments(route.segments, endpointZones(route.segments), privacy.radiusMeters) : route.segments, [route, privacy.mode, privacy.radiusMeters]);
  const share = async () => { setBusy(true); setMessage(null); try { await shareDocument(routeDocument(route, privacy)); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setBusy(false); } };
  return <Panel style={{ gap: 14 }}><Label>Partager ce parcours</Label><PrivacyControls value={privacy} onChange={setPrivacy} />
    <Button title={preview ? 'Fermer l’aperçu public' : 'Voir la copie choisie'} secondary onPress={() => setPreview(!preview)} />
    {preview && <RouteMap key={`${route.id}:${privacy.mode}:${privacy.radiusMeters}`} points={[]} reference={segments} height={190} interactive />}
    <Button title={`Partager le GPX ${privacy.mode === 'public' ? 'masqué' : 'complet'}`} secondary icon="share-outline" disabled={busy} onPress={() => void share()} />
    {message && <Copy accessibilityRole="alert">{message}</Copy>}
  </Panel>;
}
