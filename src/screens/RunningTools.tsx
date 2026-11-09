import { Input, Picker } from '../ui/controls';
import { useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';

import { toolsStore } from '../tools/store';
import { RhythmTools, useTools } from '../tools/components';
import type { SavedRoute } from '../routes/types';
import { pickGPX } from '../routes/picker';
import { km } from '../core/format';
import { session } from '../services/session';
import { Button, Copy, Header, Label, Panel, Screen } from '../ui/components';
import { useTheme } from '../ui/theme';
import { confirm } from '../ui/confirm';
import RouteMap from '../ui/RouteMap';
import { RouteSharing } from '../sharing/components';

function RouteInspector({ route, draft = false, busy, canPrepare, onSave, onPrepare }: { route: SavedRoute; draft?: boolean; busy: boolean; canPrepare: boolean; onSave?: () => void; onPrepare: () => void }) {
  const [name, setName] = useState(route.name), { colors } = useTheme();
  return <View style={{ gap: 15 }}><Panel style={{ gap: 12 }}><Label>{draft ? 'Aperçu avant enregistrement' : 'Parcours favori'}</Label>
    <Copy variant="section">{route.name}</Copy><Copy muted>{km(route.distanceMeters)} km de tracé · {route.segments.length} segment(s)</Copy>
    <Copy muted variant="small">Longueur géométrique estimée. Un GPX importé ne devient pas une activité ni une performance passée.</Copy>
    {route.warnings.map(text => <Copy key={text} style={{ color: colors.orange, fontSize: 12 }}>{text}</Copy>)}
  </Panel><RouteMap key={route.id} points={[]} reference={route.segments} height={250} interactive />
    {draft ? <Button title="Enregistrer ce favori" disabled={busy} onPress={onSave ?? (() => undefined)} />
      : <><Panel style={{ gap: 10 }}><Label>Nom du favori</Label><Input accessibilityLabel="Nom du parcours" maxLength={100} value={name} onChangeText={setName} />
        <Button title="Enregistrer le nom" secondary disabled={busy || !name.trim()} onPress={() => void toolsStore.renameRoute(route.id, name)} /></Panel>
        <Button title="Refaire ce parcours" icon="footsteps-outline" disabled={busy || !canPrepare} onPress={onPrepare} />
        <RouteSharing route={route} />
        <Button title="Supprimer ce favori" secondary danger icon="trash-outline" disabled={busy || session.getSnapshot().run?.routeId === route.id} onPress={() => confirm('Supprimer ce parcours favori ?', 'Seul le tracé favori sera retiré. Les courses enregistrées dans l’historique restent conservées.', 'Supprimer', () => { void toolsStore.deleteRoute(route.id); }, true)} /></>}
  </View>;
}
export default function RunningTools({ onBack, onPrepare }: { onBack: () => void; onPrepare: () => void }) {
  const state = useTools(), running = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const [draft, setDraft] = useState<SavedRoute | null>(null), [viewId, setViewId] = useState<string | null>(state.preferences.selectedRouteId);
  const [importing, setImporting] = useState(false), [message, setMessage] = useState<string | null>(null);
  const selected = state.routes.find(r => r.id === viewId), { colors } = useTheme();
  const load = async () => { setImporting(true); setMessage(null); try { const route = await pickGPX(); if (route) setDraft(route); } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); } finally { setImporting(false); } };
  const prepare = async (route: SavedRoute) => { if (await toolsStore.update({ selectedRouteId: route.id })) onPrepare(); };
  return <Screen bottom={40}><Header title="Outils de course" onBack={onBack} />
    <Panel style={{ gap: 12 }}><Label>Mes parcours · stockage local</Label><Copy>Conservez un itinéraire de votre historique ou importez un GPX. Rien n’est publié automatiquement.</Copy>
      <Button title={importing ? 'Lecture du GPX…' : 'Importer un fichier GPX'} secondary icon="download-outline" disabled={!state.ready || state.busy || importing || !!running.run} onPress={() => void load()} />
      <Copy muted variant="small">GPX de 2 Mo maximum et 20 000 points. Les segments restent séparés ; les liaisons de plus de 1 km sont retirées. Les fonds de carte dépendent du réseau et du cache Apple.</Copy>
      {!!running.run && <Copy muted variant="caption">Choix et import d’un tracé disponibles entre deux courses. Le tracé de la course actuelle reste fixe.</Copy>}
      {!state.ready && <Button title="Réessayer le stockage des outils" secondary onPress={() => void toolsStore.initialize()} />}
    </Panel>
    {(message || state.message) && <Copy accessibilityRole="alert" style={{ color: colors.orange }}>{message ?? state.message}</Copy>}
    {draft && <><RouteInspector key={draft.id} route={draft} draft busy={state.busy} canPrepare={false} onPrepare={onPrepare} onSave={() => { void toolsStore.addRoute(draft).then(ok => { if (ok) { setViewId(draft.id); setDraft(null); } }); }} />
      <Button title="Annuler cet import" secondary onPress={() => setDraft(null)} /></>}
    <Panel style={{ gap: 12 }}><Label>{state.routes.length} / 50 favoris</Label>
      {!state.routes.length && <Copy muted>Aucun parcours favori. Une sortie avec des positions GPS peut être ajoutée depuis son détail.</Copy>}
      {state.routes.map(route => <Button key={route.id} title={`${state.preferences.selectedRouteId === route.id ? 'Choisi · ' : ''}${route.name} · ${km(route.distanceMeters)} km`} secondary={viewId !== route.id} onPress={() => { setViewId(route.id); setDraft(null); }} />)}
    </Panel>
    {!draft && selected && <RouteInspector key={selected.id} route={selected} busy={state.busy} canPrepare={!running.run} onPrepare={() => void prepare(selected)} />}
    <Panel style={{ gap: 12 }}><Label>Écart au tracé</Label><Copy muted variant="caption">Avertissement après au moins 10 secondes d’éloignement précis, avec marge de précision et seuil de retour distinct. Il ne s’agit pas d’un guidage routier ni d’une garantie de passage.</Copy>
      <Picker accessibilityLabel="Tolérance d’écart au parcours" selectedValue={state.preferences.departureMeters} enabled={state.ready && !state.busy && !running.run} itemStyle={{ color: colors.text }} onValueChange={value => { void toolsStore.update({ departureMeters: Number(value) }); }}>
        {[30, 60, 100, 150, 200].map(value => <Picker.Item key={value} value={value} label={`Tolérance d’écart : ${value} mètres`} />)}</Picker>
    </Panel>
    <RhythmTools />
    <Panel style={{ gap: 10 }}><Label>Strava · architecture préparée</Label><Copy muted variant="caption">Aucun compte Strava n’est connecté et aucune donnée n’y est envoyée. Une future synchronisation devra obtenir votre accord par activité, respecter les autorisations et les conditions des API, puis confirmer le traitement et les doublons.</Copy></Panel>
  </Screen>;
}
