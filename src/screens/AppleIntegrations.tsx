import { Toggle } from '../ui/controls';
import { useState, useSyncExternalStore } from 'react';
import { Linking, View } from 'react-native';
import { apple } from '../apple/store';
import { APPLE_BUILD_REQUIRED, nativeApple } from '../apple/bridge';
import { healthDuplicate, importedRun, validateHealthWorkout } from '../apple/mapping';
import type { HealthWorkout } from '../apple/types';
import { duration, km, runDate } from '../core/format';
import { session } from '../services/session';
import { Button, Copy, Header, Label, Panel, Screen, styles } from '../ui/components';
import { confirm } from '../ui/confirm';
import { useTheme } from '../ui/theme';

export default function AppleIntegrations({ onBack }: { onBack: () => void }) {
  const state = useSyncExternalStore(apple.subscribe, apple.getSnapshot, apple.getSnapshot);
  const runs = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
  const { colors } = useTheme();
  const [days, setDays] = useState(30), [importing, setImporting] = useState(false), [message, setMessage] = useState<string | null>(null);
  const cap = state.capabilities, preferences = state.preferences;
  const unavailable = !state.ready || !nativeApple || !cap.backupProtected;
  const disabled = unavailable || state.busy || importing;
  const writeStatus = (status: string) => status === 'authorized' ? 'autorisée' : status === 'denied' ? 'refusée' : 'non demandée';
  const importWorkout = async (workout: HealthWorkout) => {
    if (importing) return;
    setImporting(true); setMessage(null);
    try {
      if (!apple.getSnapshot().preferences.readRequested) throw new Error('Activez la lecture avant un import.');
      const duplicate = healthDuplicate(workout, session.getSnapshot().history, apple.getSnapshot().preferences.receipts);
      if (duplicate) throw new Error('Cette course correspond à une activité existante. Utilisez l’association pour éviter un doublon.');
      const run = importedRun(workout);
      if (await session.importHealthActivity(run)) await apple.associate(workout, run, session.getSnapshot().history);
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setImporting(false); }
  };
  const toggle = (title: string, body: string, value: boolean, onChange: (value: boolean) => void, extraDisabled = false) =>
    <Toggle title={title} body={body} value={value} onChange={onChange} disabled={disabled || extraDisabled} />;
  return <Screen bottom={40}><Header title="Apple & confidentialité" onBack={onBack} />
    {unavailable && <Panel style={{ gap: 10 }}><Copy>{APPLE_BUILD_REQUIRED}</Copy>{!state.ready && nativeApple && <Button title="Réinitialiser l’accès aux intégrations" secondary onPress={() => void apple.initialize()} />}</Panel>}
    <Panel style={{ gap: 16 }}><Label>Apple Santé · écriture</Label>
      <Copy>Envoyer les courses terminées et leur distance à Santé, uniquement avec votre autorisation.</Copy>
      <Copy muted variant="caption">Écriture des entraînements : {writeStatus(cap.workoutWrite)}. Distances : {writeStatus(cap.distanceWrite)}.</Copy>
      <Button title="Autoriser l’écriture dans Santé" secondary icon="heart-outline" disabled={disabled || !cap.available} onPress={() => void apple.requestAuthorization('write')} />
      {toggle('Synchroniser les prochaines courses', 'Après la sauvegarde locale, envoyer les nouvelles courses compatibles. Les anciennes restent envoyables depuis leur détail.', preferences.autoWrite, value => { void apple.setAutoWrite(value); }, !cap.available)}
      <Copy muted variant="caption">Un export est suspendu si les pauses exactes ou la chronologie sont inconnues. Aucun trajet, calorie ou rythme cardiaque n’est ajouté à Santé.</Copy>
      {(preferences.pendingRunIds?.length ?? 0) > 0 && <><Copy muted variant="caption">{preferences.pendingRunIds!.length} course(s) en attente d’envoi. Les envois reprennent à l’ouverture de Sprinter si la synchronisation reste active.</Copy><Button title="Reprendre les envois en attente" secondary disabled={disabled || !preferences.autoWrite} onPress={() => void apple.retryPending(runs.history)} /></>}
    </Panel>
    <Panel style={{ gap: 16 }}><Label>Écran verrouillé & Dynamic Island</Label>
      {toggle('Afficher ma course en direct', 'Le temps actif, la distance et l’allure seront visibles sans déverrouiller l’iPhone. La Dynamic Island apparaît sur les modèles compatibles.', preferences.liveEnabled, value => { void apple.setLiveEnabled(value); })}
      <Copy muted variant="caption">{cap.liveAllowed ? 'Activités en direct autorisées par cet iPhone.' : 'Activités en direct indisponibles ou désactivées dans les réglages iOS.'} Les données sont marquées périmées en cas d’interruption. Cet affichage ne maintient pas le GPS en arrière-plan ; activez le suivi verrouillé séparément si nécessaire.</Copy>
    </Panel>
    <Panel style={{ gap: 16 }}><Label>Apple Santé · lecture facultative</Label>
      <Copy>Consulter les courses et distances rendues visibles par Santé, puis choisir les activités à conserver dans Sprinter.</Copy>
      <Button title="Demander l’accès en lecture" secondary disabled={disabled || !cap.available} onPress={() => void apple.requestAuthorization('read')} />
      <Copy muted variant="caption">iOS ne révèle pas votre autorisation effective de lecture. Une liste vide peut signifier qu’aucune donnée n’est disponible ou que l’accès a été refusé.</Copy>
      {preferences.readRequested && <>
        <View style={[styles.row, { gap: 8 }]}>{[30, 90, 365].map(value => <Button key={value} style={{ flex: 1 }} title={`${value} j`} secondary={days !== value} disabled={disabled} onPress={() => setDays(value)} />)}</View>
        <Button title="Charger cette période" secondary disabled={disabled} onPress={() => void apple.read(days)} />
        <Button title="Désactiver la lecture dans Sprinter" secondary disabled={disabled} onPress={() => { void apple.disableRead(); setMessage('Lecture arrêtée. Les copies déjà importées restent dans votre historique et peuvent y être supprimées.'); }} />
        <Copy muted variant="caption">Aucun import automatique. Les copies sont locales ; une suppression ultérieure dans Santé ne supprime pas votre copie Sprinter. Une suppression dans Sprinter ne supprime pas l’original Santé.</Copy>
      </>}
    </Panel>
    {(message || state.message) && <Copy accessibilityRole="alert" style={{ color: colors.orange }}>{message ?? state.message}</Copy>}
    {state.workouts.map(workout => {
      const duplicate = healthDuplicate(workout, runs.history, preferences.receipts);
      let invalid: string | null = null;
      try { validateHealthWorkout(workout); } catch (error) { invalid = error instanceof Error ? error.message : String(error); }
      return <Panel key={workout.uuid} style={{ gap: 10 }}>
        <Label>{runDate(workout.startedAt)}</Label><Copy style={{ fontWeight: '600' }}>{workout.distanceMeters === null ? 'Distance indisponible' : `${km(workout.distanceMeters)} km`} · {duration(workout.activeSeconds)}</Copy>
        <Copy muted variant="caption">Source : {workout.sourceName} · {workout.sourceBundle}</Copy>
        {invalid && <Copy muted variant="caption">{invalid}</Copy>}
        {duplicate ? <><Copy>{duplicate.kind === 'exact' ? 'Déjà présente dans votre historique.' : `Doublon probable avec la sortie du ${runDate(duplicate.run.startedAt)} (${km(duplicate.run.distanceMeters)} km).`}</Copy>
          {duplicate.kind === 'probable' && <Button title="Associer à cette sortie existante" secondary disabled={disabled} onPress={() => confirm('Associer ces activités ?', 'Cette association évite un deuxième import et un nouvel envoi de la même course vers Santé. Aucune mesure locale ne sera remplacée.', 'Associer', () => { void apple.associate(workout, duplicate.run, session.getSnapshot().history); })} />}</>
          : <Button title="Importer dans mon historique" secondary disabled={disabled || !!runs.run || !!invalid} onPress={() => void importWorkout(workout)} />}
      </Panel>;
    })}
    {state.hasMore && <Button title="Charger la suite" secondary disabled={disabled} onPress={() => void apple.read(days, true)} />}
    <Panel style={{ gap: 12 }}><Label>Vos données</Label>
      <Copy muted variant="caption">Ces fonctions ne nécessitent pas de serveur. Sprinter ne transmet pas vos données Santé à Spotify ni à un service publicitaire. Les bases locales contenant les activités et journaux sont exclues de la sauvegarde iCloud de l’application dans cette version native. Conservez les sorties importantes avec les exports GPX ou CSV, que vous seul déclenchez. La synchronisation iCloud de Santé reste gérée par Apple et vos réglages.</Copy>
      <Copy muted variant="caption">Aucune autorisation de fréquence cardiaque, d’itinéraire Santé ou d’énergie n’est demandée. Gérez ou retirez les permissions dans Santé → profil → Apps → Sprinter. Désactiver une option ici ne retire pas les permissions iOS déjà accordées.</Copy>
      <Button title="Ouvrir les réglages iPhone" secondary disabled={!nativeApple} onPress={() => { void Linking.openSettings().catch(() => setMessage('Ouvrez les réglages iPhone pour gérer les permissions de Sprinter.')); }} />
    </Panel>
  </Screen>;
}
