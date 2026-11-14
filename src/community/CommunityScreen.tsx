import { useCallback, useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Button, Copy, Divider, Panel } from '../ui/components';
import { SegmentedControl, TextField } from '../ui/controls';
import { confirm } from '../ui/confirm';
import { spacing } from '../ui/tokens';
import { account } from '../account/account';
import { Checkbox, FormError, FormNotice } from '../account/ui/parts';

type Scope = 'distance' | 'runs' | 'active_days';
type Period = 'week' | 'last_week';
interface Board { items: { rank: number; handle: string; value: number; me: boolean }[]; me: { rank: number; value: number } | null; member: boolean; method: string }
const UNIT: Record<Scope, (value: number) => string> = {
  distance: (value) => `${value.toLocaleString('fr-FR', { maximumFractionDigits: 1 })} km`,
  runs: (value) => `${value} course${value > 1 ? 's' : ''}`,
  active_days: (value) => `${value} jour${value > 1 ? 's' : ''}`,
};
const MESSAGES: Record<string, string> = {
  handle_taken: 'Ce pseudo est déjà pris.',
  'invalid_parameter:handle': 'Pseudo de 3 à 20 caractères : lettres, chiffres, point, tiret ou souligné. Certains mots sont réservés.',
  'invalid_parameter:handle_personal': 'Choisissez un pseudo qui ne reprend ni votre nom ni votre adresse e-mail.',
};

/** Classement communautaire facultatif (phase 7) : pseudo seulement, ni nom, ni lieu, ni parcours. */
export function CommunityScreen() {
  const [board, setBoard] = useState<Board | null>(null);
  const [scope, setScope] = useState<Scope>('distance');
  const [period, setPeriod] = useState<Period>('week');
  const [handle, setHandle] = useState('');
  const [agreed, setAgreed] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(() => {
    setError(null);
    account.rpc<Board>('public_leaderboard', { p_scope: scope, p_period: period }).then(setBoard).catch(() => setError('Classement indisponible pour le moment.'));
  }, [period, scope]);
  useEffect(load, [load]);
  const fail = (failure: unknown) => setError(failure instanceof Error ? MESSAGES[failure.message] ?? 'L’opération n’a pas abouti. Réessayez.' : 'L’opération n’a pas abouti.');
  const join = async () => {
    setBusy(true); setError(null);
    try {
      await account.recordConsent('community_leaderboard', true);
      await account.rpc('community_join', { p_handle: handle.trim() });
      setNotice('Vous participez au classement de la semaine.'); load();
    } catch (failure) { fail(failure); } finally { setBusy(false); }
  };
  const leave = () => confirm('Quitter le classement ?', 'Votre pseudo disparaît immédiatement du classement.', 'Quitter', () => {
    void (async () => {
      setBusy(true);
      try { await account.rpc('community_leave'); await account.recordConsent('community_leaderboard', false); setNotice('Vous ne participez plus au classement.'); load(); }
      catch (failure) { fail(failure); } finally { setBusy(false); }
    })();
  }, true);
  const report = (target: string) => {
    const send = (reason: string) => void account.rpc('community_report', { p_handle: target, p_reason: reason })
      .then(() => setNotice('Signalement envoyé. Merci.')).catch(fail);
    if (Platform.OS === 'web') { confirm('Signaler ce pseudo ?', 'Un pseudo signalé plusieurs fois est masqué en attendant l’examen.', 'Signaler', () => send('offensive')); return; }
    Alert.alert('Signaler ce pseudo', 'Pour quelle raison ?', [
      { text: 'Annuler', style: 'cancel' },
      { text: 'Propos inappropriés', onPress: () => send('offensive') },
      { text: 'Usurpation d’identité', onPress: () => send('impersonation') },
      { text: 'Données personnelles', onPress: () => send('personal_data') },
    ]);
  };

  if (board && !board.member) {
    return (
      <View style={{ gap: spacing.lg }}>
        <Copy muted>Participez au classement de la semaine sous un pseudo. Les autres membres voient seulement votre pseudo et vos totaux de la semaine : ni nom, ni lieu, ni parcours.</Copy>
        <Panel variant="setting" style={{ gap: spacing.md }}>
          <TextField label="Pseudo" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} maxLength={20}
            description="3 à 20 caractères. N’utilisez ni votre nom ni votre adresse e-mail." />
          <Checkbox checked={agreed} onChange={setAgreed} label="J’accepte d’apparaître sous ce pseudo dans le classement communautaire" />
          <Button title="Participer" icon="trophy-outline" disabled={busy || !agreed || handle.trim().length < 3} onPress={() => void join()} />
          <Copy muted variant="caption">Vous pouvez quitter le classement à tout moment ; le retrait est immédiat.</Copy>
        </Panel>
        <FormError message={error} />
      </View>
    );
  }
  return (
    <View style={{ gap: spacing.lg }}>
      <SegmentedControl<Scope> label="Classement" value={scope} choices={[['distance', 'Distance'], ['runs', 'Courses'], ['active_days', 'Jours actifs']]} onChange={setScope} />
      <SegmentedControl<Period> label="Période" value={period} choices={[['week', 'Cette semaine'], ['last_week', 'Semaine dernière']]} onChange={setPeriod} />
      {board?.me && <Copy variant="emphasis" accessibilityLiveRegion="polite">Votre rang : {board.me.rank} · {UNIT[scope](board.me.value)}</Copy>}
      <Panel variant="setting" style={{ gap: spacing.sm }}>
        {!board && <Copy muted>Chargement…</Copy>}
        {board?.items.length === 0 && <Copy muted>Aucune course éligible cette semaine.</Copy>}
        {board?.items.map((item, index) => (
          <View key={`${item.rank}-${item.handle}`} style={{ gap: spacing.xs }}>
            {index > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Copy variant="emphasis" style={{ width: 36 }}>{item.rank}</Copy>
              <Copy style={{ flex: 1 }}>{item.handle}{item.me ? ' (vous)' : ''}</Copy>
              <Copy muted>{UNIT[scope](item.value)}</Copy>
              {!item.me && <Button title="Signaler" variant="quiet" onPress={() => report(item.handle)} />}
            </View>
          </View>
        ))}
      </Panel>
      {board && <Copy muted variant="caption">{board.method}</Copy>}
      <Button title="Quitter le classement" variant="quiet" icon="exit-outline" disabled={busy} onPress={leave} />
      <FormError message={error} />
      <FormNotice message={notice} />
    </View>
  );
}
