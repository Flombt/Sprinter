import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Button, Copy, Divider, Panel, SectionHeading } from '../../ui/components';
import { ChoiceGroup, TextField } from '../../ui/controls';
import { spacing } from '../../ui/tokens';
import { account } from '../account';
import { appVersion } from '../device';
import { formatDate, FormError, FormNotice } from './parts';

const CATEGORIES = [['account', 'Compte'], ['sync', 'Synchronisation'], ['bug', 'Problème'], ['data_request', 'Mes données'], ['other', 'Autre']] as const;
const STATUS: Record<string, string> = { open: 'reçue', in_progress: 'en cours', resolved: 'résolue', closed: 'close' };
type Category = (typeof CATEGORIES)[number][0];

/** « Contacter le support » (§14 4d) : la réponse arrive par e-mail ; aucune donnée de course n'est jointe. */
export function SupportForm() {
  const [category, setCategory] = useState<Category>('sync');
  const [message, setMessage] = useState('');
  const [requestId, setRequestId] = useState(() => randomUUID());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [history, setHistory] = useState<{ id: string; category: string; status: string; created_at: string }[]>([]);
  const load = useCallback(() => {
    account.ownSupportRequests().then(setHistory).catch(() => undefined);
  }, []);
  useEffect(load, [load]);
  const send = async () => {
    setBusy(true); setError(null); setNotice(null);
    try {
      await account.submitSupport(requestId, category, message.trim(), Platform.OS, appVersion());
      setMessage(''); setRequestId(randomUUID());
      setNotice('Demande envoyée. Nous vous répondrons par e-mail.');
      load();
    } catch (failure) {
      setError(failure instanceof Error && /rate_limited/.test(failure.message) ? 'Vous avez déjà envoyé plusieurs demandes aujourd’hui. Réessayez demain.' : 'Envoi impossible. Vérifiez votre connexion puis réessayez.');
    } finally { setBusy(false); }
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <Panel variant="setting" style={{ gap: spacing.md }}>
        <ChoiceGroup label="Sujet" value={category} choices={CATEGORIES} onChange={setCategory} />
        <TextField label="Votre message" value={message} onChangeText={setMessage} multiline maxLength={4000}
          description="Décrivez ce qui se passe. N’indiquez ni mot de passe ni donnée de santé." />
        <Button title="Envoyer" icon="send-outline" disabled={busy || !message.trim()} onPress={() => void send()} />
        <FormError message={error} />
        <FormNotice message={notice} />
      </Panel>
      {history.length > 0 && (
        <View style={{ gap: spacing.md }}>
          <SectionHeading title="Vos demandes" />
          <Panel variant="setting" style={{ gap: spacing.sm }}>
            {history.map((item, index) => (
              <View key={item.id} style={{ gap: spacing.xs }}>
                {index > 0 && <Divider />}
                <Copy variant="caption" muted>{formatDate(item.created_at)} · {CATEGORIES.find(([value]) => value === item.category)?.[1] ?? item.category} · {STATUS[item.status] ?? item.status}</Copy>
              </View>
            ))}
          </Panel>
        </View>
      )}
    </View>
  );
}
