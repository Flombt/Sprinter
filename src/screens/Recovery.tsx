import { useTheme } from '../ui/theme';
import { Button, Card, Copy, IconButton, Label, Screen } from '../ui/components';
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { session, type SessionState } from '../services/session';
import type { DraftArchiveInfo } from '../storage/repository';
import { shareDocument } from '../services/documentShare';
import { confirm } from '../ui/confirm';

export default function Recovery({ state, onBack }: { state: SessionState; onBack: () => void }) {
  const { colors } = useTheme();
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
  return <Screen>
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}><View><Label>VOS DONNÉES</Label><Copy variant="condensedTitle" style={{ fontSize: 36, lineHeight: 42 }}>RÉCUPÉRATION.</Copy></View><IconButton square icon="arrow-back" label="Retour" onPress={onBack} /></View>
    {state.recoveryBlocked && <Card variant="paper" contentStyle={{ gap: 14 }}>
      <Copy variant="bodyCompact" style={{ fontSize: 17, fontWeight: '700', color: colors.heroText }}>Une sauvegarde est illisible</Copy>
      <Copy variant="bodyCompact" style={{ color: '#65615C' }}>Conservez une archive de la course interrompue pour débloquer un nouveau départ. Aucune donnée de cette sauvegarde ne sera supprimée.</Copy>
      <Button highContrast arrow size="compact" title="Conserver et débloquer" onPress={archive} disabled={state.busy} />
    </Card>}
    <Label>SAUVEGARDES CONSERVÉES</Label>
    {!archives.length && <Copy variant="bodyCompact" style={{ color: colors.secondary }}>Aucune sauvegarde archivée pour le moment.</Copy>}
    {archives.map(archive => <Card key={archive.id} contentStyle={{ gap: 12 }}>
      <Copy variant="bodyCompact" style={{ fontWeight: '600' }}>{new Date(archive.archivedAt).toLocaleString('fr-FR')}</Copy>
      <Copy variant="bodyCompact" style={{ color: colors.secondary, fontSize: 12 }}>Archive privée · {Math.max(1, Math.ceil(archive.bytes / 1024))} Ko</Copy>
      <Button highContrast size="compact" title="Exporter la sauvegarde privée" icon="download-outline" variant="secondary" disabled={busy} onPress={() => void exportArchive(archive.id)} />
    </Card>)}
    {!!archives.length && <Copy variant="bodyCompact" style={{ color: colors.secondary, fontSize: 12 }}>Ces sauvegardes brutes peuvent contenir vos positions GPS. Conservez-les dans un emplacement privé.</Copy>}
    {message && <Copy variant="bodyCompact" accessibilityRole="alert" style={{ color: colors.danger }}>{message}</Copy>}
  </Screen>;
}
