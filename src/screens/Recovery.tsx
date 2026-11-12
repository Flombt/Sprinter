import { fontSizes, spacing, fontWeights } from '../ui/tokens';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { session, type SessionState } from '../services/session';
import type { DraftArchiveInfo } from '../storage/repository';
import { shareDocument } from '../services/documentShare';
import { confirm } from '../ui/confirm';
import { ActionButton, ActionIcon, AppScreen, BodyText, useDesign, DisplayText, Kicker, Surface } from '../ui/design';

export default function Recovery({ state, onBack }: { state: Pick<SessionState, 'busy' | 'recoveryBlocked'>; onBack: () => void }) {
  const design = useDesign();
  const [archives, setArchives] = useState<DraftArchiveInfo[]>([]), [message, setMessage] = useState<string | null>(null), [busy, setBusy] = useState(false);
  const load = useCallback(() => {
    let current = true;
    void session.listDraftArchives().then(value => { if (current) setArchives(value); }).catch(error => { if (current) setMessage(String(error)); });
    return () => { current = false; };
  }, []);
  useEffect(load, [load]);
  const archive = () => confirm('Conserver et débloquer ?', 'Une copie complète de la sauvegarde sera conservée dans Sprinter. Votre historique reste intact et une nouvelle course pourra démarrer.', 'Conserver et débloquer', () => {
    void session.archiveRecoveryDraft().then(async ok => {
      if (ok) { try { setArchives(await session.listDraftArchives()); setMessage(null); } catch (error) { setMessage(String(error)); } }
    });
  });
  const exportArchive = async (id: string) => {
    setBusy(true); setMessage(null);
    try {
      const archive = await session.loadDraftArchive(id);
      if (!archive) throw new Error('Sauvegarde introuvable.');
      await shareDocument({ filename: 'sprinter-recovery-' + archive.id + '.json', mimeType: 'application/json', data: archive.payload, points: 0, segments: 0 });
    } catch (error) { setMessage(error instanceof Error ? error.message : String(error)); }
    finally { setBusy(false); }
  };
  return <AppScreen>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><Kicker>VOS DONNÉES</Kicker><DisplayText style={{ fontSize: fontSizes.heading, lineHeight: 42 }}>RÉCUPÉRATION.</DisplayText></View><ActionIcon icon="arrow-back" label="Retour" onPress={onBack} /></View>
    {state.recoveryBlocked && <Surface paper contentStyle={{ gap: spacing.md }}>
      <BodyText style={{ fontSize: fontSizes.body, fontWeight: fontWeights.bold, color: design.ink }}>Une sauvegarde est illisible</BodyText>
      <BodyText style={{ color: '#65615C' }}>Conservez une archive de la course interrompue pour débloquer un nouveau départ. Aucune donnée de cette sauvegarde ne sera supprimée.</BodyText>
      <ActionButton title="Conserver et débloquer" onPress={archive} disabled={state.busy} compact />
    </Surface>}
    <Kicker>SAUVEGARDES CONSERVÉES</Kicker>
    {!archives.length && <BodyText style={{ color: design.secondary }}>Aucune sauvegarde archivée pour le moment.</BodyText>}
    {archives.map(archive => <Surface key={archive.id} contentStyle={{ gap: spacing.md }}>
      <BodyText style={{ fontWeight: fontWeights.semibold }}>{new Date(archive.archivedAt).toLocaleString('fr-FR')}</BodyText>
      <BodyText style={{ color: design.secondary, fontSize: fontSizes.small }}>Archive privée · {Math.max(1, Math.ceil(archive.bytes / 1024))} Ko</BodyText>
      <ActionButton title="Exporter la sauvegarde privée" icon="download-outline" secondary compact disabled={busy} onPress={() => void exportArchive(archive.id)} />
    </Surface>)}
    {!!archives.length && <BodyText style={{ color: design.secondary, fontSize: fontSizes.small }}>Ces sauvegardes brutes peuvent contenir vos positions GPS. Conservez-les dans un emplacement privé.</BodyText>}
    {message && <BodyText accessibilityRole="alert" style={{ color: design.danger }}>{message}</BodyText>}
  </AppScreen>;
}
