import { Switch, Picker } from '../ui/controls';
import { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Linking, Platform, View } from 'react-native';

import { toolsStore } from './store';
import { cadenceBridge } from './cadence';
import { Button, Copy, Label, Metric, MetricGrid, Panel, styles } from '../ui/components';
import { useTheme } from '../ui/theme';
import { km } from '../core/format';
import type { SavedRoute } from '../routes/types';
import { configuredWeatherProvider, weatherAdvice, weatherLabel, weatherPosition, type WeatherSnapshot } from './weather';
export const useTools = () => useSyncExternalStore(toolsStore.subscribe, toolsStore.getSnapshot, toolsStore.getSnapshot);

export function RhythmTools({ compact = false }: { compact?: boolean }) {
  const state = useTools(), { colors } = useTheme(), prefs = state.preferences;
  const freshCadence = state.cadence && Date.now() - state.cadence.timestamp <= 10000 ? state.cadence.spm : null;
  const [bpm, setBpm] = useState(prefs.bpm); useEffect(() => setBpm(prefs.bpm), [prefs.bpm]);
  const changeBpm = async (value: number) => { setBpm(value); await toolsStore.update({ bpm: value }); };
  return <Panel style={{ gap: 14 }}><Label>Tempo cible & cadence mesurée</Label>
    <MetricGrid><Metric label="Métronome cible" value={String(prefs.bpm)} unit="bpm" /><Metric label="Cadence Core Motion" value={freshCadence === null ? '—' : Math.round(freshCadence).toString()} unit="pas/min" /></MetricGrid>
    <Copy muted variant="small">Un clic correspond à un pas visé. Le métronome ne mesure pas vos mouvements ; la cadence estimée provient du capteur de l’iPhone, seulement lorsqu’il fournit une mesure récente. Ajustez sans forcer votre foulée.</Copy>
    <View style={[styles.row, { gap: 16 }]}><View style={{ flex: 1 }}><Copy>Métronome pendant la course</Copy><Copy muted variant="small">S’arrête en pause et laisse la priorité au coach.</Copy></View><Switch accessibilityLabel="Métronome pendant la course" value={prefs.metronomeEnabled} disabled={!state.ready || state.busy || Platform.OS === 'web'} onValueChange={metronomeEnabled => { void toolsStore.update({ metronomeEnabled }); }} /></View>
    <View style={[styles.row, { gap: 12 }]}><Button title="− 5 bpm" secondary disabled={!state.ready || state.busy || bpm <= 80} onPress={() => void changeBpm(Math.max(80, bpm - 5))} style={{ flex: 1 }} /><Copy>{bpm} bpm</Copy><Button title="+ 5 bpm" secondary disabled={!state.ready || state.busy || bpm >= 220} onPress={() => void changeBpm(Math.min(220, bpm + 5))} style={{ flex: 1 }} /></View>
    {!compact && <><Label>Volume du métronome</Label><Picker accessibilityLabel="Volume du métronome" selectedValue={prefs.volume} enabled={state.ready && !state.busy} itemStyle={{ color: colors.text }} onValueChange={volume => { void toolsStore.update({ volume: Number(volume) }); }}>
      {[[.1, 'Faible'], [.3, 'Modéré'], [.5, 'Soutenu']].map(([value, title]) => <Picker.Item key={String(value)} value={value} label={String(title)} />)}</Picker></>}
    {!cadenceBridge ? <Copy muted variant="caption">La mesure Core Motion nécessite une version iOS reconstruite ; elle n’est pas fournie par Expo Go. Le métronome sonore reste utilisable sur iPhone.</Copy>
      : <><Copy muted variant="caption">{state.cadenceCapabilities.available ? state.cadenceCapabilities.permission === 'authorized' ? 'Mouvements autorisés. Mesure pendant la course au premier plan ; une donnée absente reste « — ».' : 'Mouvements non autorisés. Aucun chiffre de cadence n’est inventé.' : 'Ce téléphone ne fournit pas la cadence Core Motion.'}</Copy>
        {prefs.cadenceEnabled ? <Button title="Désactiver la mesure de cadence" secondary disabled={state.busy} onPress={() => void toolsStore.update({ cadenceEnabled: false })} /> : <Button title="Autoriser et activer la cadence mesurée" secondary disabled={!state.ready || state.busy || !state.cadenceCapabilities.available} onPress={() => void toolsStore.requestCadence()} />}</>}
    {state.message && <Copy muted accessibilityRole="alert" variant="caption">{state.message}</Copy>}
  </Panel>;
}
export function SelectedRoute({ onChoose, running = false }: { onChoose: () => void; running?: boolean }) {
  const state = useTools(), route = state.routes.find(r => r.id === state.preferences.selectedRouteId);
  return <Panel style={{ gap: 10 }}><Label>Parcours de référence</Label><Copy style={{ fontWeight: '600' }}>{route?.name ?? 'Sans tracé de référence'}</Copy>
    {route && <Copy muted variant="caption">{km(route.distanceMeters)} km de géométrie · avertissement à partir de {state.preferences.departureMeters} m d’écart confirmé. Les mesures de course restent calculées par le GPS.</Copy>}
    <Button title="Parcours favoris et import GPX" secondary icon="map-outline" disabled={running} onPress={onChoose} />
    {route && <Button title="Courir sans tracé" secondary disabled={state.busy || running} onPress={() => void toolsStore.update({ selectedRouteId: null })} />}
  </Panel>;
}
export function WeatherPanel({ route }: { route?: SavedRoute }) {
  const [value, setValue] = useState<WeatherSnapshot | null>(null), [busy, setBusy] = useState(false), [message, setMessage] = useState<string | null>(null);
  const request = useRef<AbortController | null>(null), { colors } = useTheme();
  useEffect(() => { request.current?.abort(); setValue(null); setBusy(false); return () => request.current?.abort(); }, [route?.id]);
  const load = async () => {
    request.current?.abort(); const controller = new AbortController(); request.current = controller; setBusy(true); setMessage(null);
    try {
      if (!configuredWeatherProvider) throw new Error('Aucun service météo n’est configuré pour cette version.');
      const position = route?.segments[0]?.[0] ?? await weatherPosition(controller.signal);
      const weather = await configuredWeatherProvider.fetch(position, controller.signal); if (!controller.signal.aborted) setValue(weather);
    } catch (error) { if (!controller.signal.aborted) setMessage(error instanceof Error ? error.message : String(error)); }
    finally { if (!controller.signal.aborted) setBusy(false); }
  };
  return <Panel style={{ gap: 13 }}><Label>Météo avant le départ · facultative</Label>
    <Copy muted variant="caption">En consultant la météo, vous acceptez l’envoi à Open-Meteo d’une zone approximative {route ? 'du départ du tracé choisi' : 'près de votre position'}. Aucun itinéraire ni identifiant n’est envoyé. Usage personnel du service gratuit ; aucun suivi météo continu.</Copy>
    {!configuredWeatherProvider && <Copy muted variant="caption">Service météo non configuré pour cette version. Vous pouvez partir sans météo.</Copy>}
    <Button title={busy ? 'Consultation de la météo…' : 'Consulter la météo de cette zone'} secondary icon="cloud-outline" disabled={busy || !configuredWeatherProvider} onPress={() => void load()} />
    {busy && <Button title="Annuler la consultation" secondary onPress={() => { request.current?.abort(); setBusy(false); }} />}
    {value && <><Copy style={{ fontWeight: '600' }}>{weatherLabel(value.code)} · {Math.round(value.temperature)} °C</Copy><Copy>Précipitations : {value.precipitation} mm / {Math.round(value.intervalSeconds / 60)} min</Copy><Copy>Vent : {Math.round(value.wind)} km/h · rafales {Math.round(value.gusts)} km/h</Copy>
      <Copy muted variant="small">Modèle pour le {new Date(value.validAt).toLocaleString('fr-FR')} · consulté à {new Date(value.fetchedAt).toLocaleTimeString('fr-FR')}. {Date.now() - value.validAt > 1800000 ? 'Donnée ancienne : actualisez-la avant de partir.' : ''}</Copy>
      {weatherAdvice(value).map(text => <Copy key={text} style={{ color: colors.warning.text, fontSize: 12 }}>{text}</Copy>)}
      <Button title="Source et attribution : Open-Meteo" secondary onPress={() => { void Linking.openURL(value.attributionURL).catch(() => setMessage('Source : Open-Meteo, open-meteo.com.')); }} /></>}
    {message && <Copy accessibilityRole="alert" style={{ color: colors.warning.text }}>{message} Vous pouvez partir sans météo.</Copy>}
    <Copy muted variant="small">Prévisions modélisées, locales et potentiellement incomplètes. Elles ne garantissent ni les conditions réelles ni la sécurité du parcours ; consultez les vigilances officielles.</Copy>
  </Panel>;
}
