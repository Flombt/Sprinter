// Mon profil › Visibilité et partage (8c, §17.7) : privé par défaut, publication volontaire, visibilité par
// élément, lien révocable, recherche facultative, présence, blocages, décisions de modération.
import { useCallback, useEffect, useState, useSyncExternalStore } from 'react';
import { Share, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Button, Copy } from '../../ui/components';
import { SegmentedControl, TextField, Toggle } from '../../ui/controls';
import { confirm } from '../../ui/confirm';
import { SettingsNotice } from '../../ui/settings';
import { spacing } from '../../ui/tokens';
import { session } from '../../services/session';
import { account } from '../../account/account';
import { appVersion, devicePlatform } from '../../account/device';
import { Checkbox, FormError, FormNotice, formatDate } from '../../account/ui/parts';
import { ELEMENT_LABELS, WIDGET_LABELS, kindOf, type WidgetPayload } from '../model';
import { useProfile } from '../profile';
import {
  RULES, createLink, linkFor, loadSharing, markNoticeRead, myBlocks, pendingWithdrawals, publish, revokeLink, saveSharing, setVisibility, snapshotsFor, unblock,
  type SharingMode, type SharingState, type Withdrawal,
} from '../sharing';
import { PanelTitle } from './editorParts';

const ERRORS: Record<string, string> = {
  handle_taken: 'Ce pseudo est déjà pris.',
  'invalid_parameter:handle': 'Pseudo de 3 à 20 caractères : lettres, chiffres, point, tiret ou souligné. Certains mots sont réservés.',
  'invalid_parameter:handle_personal': 'Choisissez un pseudo qui ne reprend ni votre nom ni votre adresse e-mail.',
  'invalid_parameter:handle_required': 'Un pseudo de profil est nécessaire pour être visible des membres.',
  stale_publication: 'Votre profil a changé entre-temps (retrait, lien révoqué ou décision de modération). Vérifiez puis publiez à nouveau.',
  rules_required: 'Acceptez les règles d’usage avant la première publication.',
  moderation_removed: 'Votre profil a été retiré par la modération : contactez le support pour contester la décision.',
  sharing_private: 'Choisissez d’abord un mode de partage.',
  feature_disabled: 'Le partage des profils est momentanément indisponible.',
};
const NOTICE_LABELS = { content_hidden: 'masqué en attendant son examen', content_removed: 'retiré par la modération', content_restored: 'rétabli', profile_removed: 'retiré par la modération' } as const;
const MODES: [SharingMode, string][] = [['private', 'Privé'], ['link', 'Par lien'], ['members', 'Membres']];

export function ShareSettings({ onVisit, onSearch }: { onVisit: () => void; onSearch: () => void }) {
  const profile = useProfile();
  const history = useSyncExternalStore(session.subscribe, () => session.getSnapshot().history, () => session.getSnapshot().history);
  const [state, setState] = useState<SharingState | null>(null);
  const [offline, setOffline] = useState(false);
  const [pending, setPending] = useState<Withdrawal[]>([]);
  const [mode, setMode] = useState<SharingMode>('private');
  const [handle, setHandle] = useState('');
  const [searchable, setSearchable] = useState(false);
  const [presence, setPresence] = useState(false);
  const [rules, setRules] = useState(false);
  const [confirmValues, setConfirmValues] = useState(false);
  const [link, setLink] = useState<string | null>(null);
  const [blocks, setBlocks] = useState<{ id: string; label: string; created_at: string }[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const fail = (failure: unknown) => setError(failure instanceof Error ? ERRORS[failure.message] ?? 'L’opération n’a pas abouti. Réessayez.' : 'L’opération n’a pas abouti.');
  const reload = useCallback(async () => {
    try {
      const result = await loadSharing();
      setOffline(result.offline);
      setPending(await pendingWithdrawals());
      if (result.state) {
        setState(result.state); setMode(result.state.mode); setHandle(result.state.handle ?? ''); setSearchable(result.state.searchable);
        setPresence(result.state.presence === 'audience'); setRules(result.state.rules_accepted);
      }
      if (!result.offline) setBlocks(await myBlocks().catch(() => []));
    } catch (failure) { fail(failure); }
  }, []);
  useEffect(() => { void reload(); }, [reload]);
  const act = async (operation: () => Promise<unknown>, done?: string) => {
    setBusy(true); setError(null); setNotice(null);
    try {
      const result = await operation();
      if (result === 'queued') setNotice('Retrait en attente de connexion : il s’appliquera dès le retour du réseau.');
      else if (done) setNotice(done);
      await reload();
    } catch (failure) { fail(failure); } finally { setBusy(false); }
  };
  if (state && !state.enabled) return <SettingsNotice icon="pause-circle-outline" title="Partage indisponible" body="Le partage des profils n’est pas encore ouvert. Votre profil reste privé." />;
  const content = Object.keys(profile.saved).filter((key) => profile.saved[key] && ['identity', 'avatar', 'banner', 'about', 'status', 'widget'].includes(kindOf(key)));
  const visibility = state?.visibility ?? {};
  const { snapshots, preview } = snapshotsFor(profile.saved, visibility, history, Date.now());
  const label = (key: string) => (key.startsWith('widget:') ? `${WIDGET_LABELS[(profile.saved[key] as unknown as WidgetPayload).type]} · ${(profile.saved[key] as unknown as WidgetPayload).title ?? ''}` : ELEMENT_LABELS[kindOf(key)]);
  const contest = (item: { id: string; kind: string; element_key: string | null; created_at: string }) => act(async () => {
    await account.submitSupport(randomUUID(), 'other', `Contestation d’une décision de modération du ${formatDate(item.created_at)} concernant : ${item.element_key ? label(item.element_key) : 'le profil'}.`,
      devicePlatform() ?? 'web', appVersion());
    await markNoticeRead(item.id);
  }, 'Votre contestation a été transmise au support.');
  return (
    <View style={{ gap: spacing.lg }}>
      {offline ? <FormNotice message="Hors connexion : derniers choix connus affichés." /> : null}
      {pending.length ? <SettingsNotice icon="cloud-offline-outline" title="Retrait en attente de connexion" body="Votre demande de retrait sera appliquée dès le retour du réseau." /> : null}
      {state?.moderation && state.moderation !== 'visible' ? <SettingsNotice icon="alert-circle-outline" title="Profil retiré par la modération" body="Il n’est plus visible des autres membres. Vous pouvez contester la décision auprès du support." /> : null}
      {(state?.notices ?? []).map((item) => (
        <View key={item.id} style={{ gap: spacing.xs }}>
          <Copy variant="caption">{item.element_key ? label(item.element_key) : 'Votre profil'} : {NOTICE_LABELS[item.kind]} le {formatDate(item.created_at)}.</Copy>
          <View style={{ flexDirection: 'row', gap: spacing.sm }}>
            {item.kind !== 'content_restored' ? <Button title="Contester" variant="quiet" size="compact" onPress={() => void contest(item)} /> : null}
            <Button title="J’ai compris" variant="quiet" size="compact" onPress={() => void act(() => markNoticeRead(item.id))} />
          </View>
        </View>
      ))}
      <PanelTitle title="Qui peut voir votre profil" body="Privé par défaut. Le partage est un choix distinct de la participation au classement." />
      <SegmentedControl value={mode} choices={MODES} onChange={setMode} label="Mode de partage" />
      <Copy muted variant="caption">{mode === 'private' ? 'Vous seul voyez votre profil.' : mode === 'link'
        ? 'Les membres connectés qui ont le lien. Le profil n’apparaît pas dans la recherche. Attention : un lien peut être transféré.'
        : 'Les membres connectés. Apparaître dans la recherche reste un choix séparé.'}</Copy>
      {mode !== 'private' ? (
        <>
          <TextField label="Pseudo de profil" value={handle} onChangeText={setHandle} autoCapitalize="none" autoCorrect={false} maxLength={20}
            description="Distinct de votre nom de compte et de votre pseudo de classement." />
          {mode === 'members' ? <Toggle title="Apparaître dans la recherche" body="Les membres pourront trouver votre pseudo." value={searchable} onChange={setSearchable} /> : null}
          <Toggle title="Montrer ma présence" body="Indique seulement que vous êtes dans Sprinter en ce moment ; ni lieu, ni course, ni historique." value={presence} onChange={setPresence} />
          {!state?.rules_accepted ? (
            <View style={{ gap: spacing.sm }}>
              <PanelTitle title="Règles d’usage" />
              {RULES.map((rule) => <Copy key={rule} variant="caption">• {rule}</Copy>)}
              <Checkbox checked={rules} onChange={setRules} label="J’accepte les règles d’usage du profil partagé" />
            </View>
          ) : null}
        </>
      ) : null}
      <Button title="Enregistrer ces choix" icon="checkmark" disabled={busy || (mode !== 'private' && !state?.rules_accepted && !rules)}
        onPress={() => void act(() => saveSharing(mode, mode === 'members' && searchable, mode === 'private' ? null : handle.trim() || null, presence ? 'audience' : 'nobody', !state?.rules_accepted && rules),
          mode === 'private' ? 'Votre profil est redevenu privé.' : 'Choix enregistrés. Publiez pour mettre à jour la version visible.')} />

      {state && state.mode !== 'private' ? (
        <>
          <PanelTitle title="Éléments visibles" body="Chaque élément reste « Moi uniquement » tant que vous ne le montrez pas. Masquer s’applique tout de suite ; montrer s’applique à la prochaine publication." />
          {content.map((key) => (
            <View key={key} style={{ gap: spacing.xs }}>
              <Copy variant="emphasis">{label(key)}{state.published[key] === 'hidden' ? ' · en cours d’examen' : state.published[key] === 'removed' ? ' · retiré par la modération' : ''}</Copy>
              <SegmentedControl value={visibility[key] ?? 'owner'} choices={[['owner', 'Moi uniquement'], ['audience', 'Audience du profil']] as const}
                onChange={(value) => void act(() => setVisibility(key, value))} label={`Visibilité : ${label(key)}`} />
            </View>
          ))}
          {preview.length ? (
            <View style={{ gap: spacing.xs }}>
              <PanelTitle title="Valeurs calculées sur cet appareil" body="Seules ces valeurs, leur libellé et leur période seront visibles ; vos courses restent sur l’appareil." />
              {preview.map((item) => <Copy key={`${item.key}${item.label}`} variant="caption">{item.label} : {item.value}</Copy>)}
              <Checkbox checked={confirmValues} onChange={setConfirmValues} label="Je confirme le partage de ces valeurs" />
            </View>
          ) : null}
          <Button title={state.published_at ? 'Mettre à jour le profil partagé' : 'Publier'} icon="cloud-upload-outline" disabled={busy || offline || (preview.length > 0 && !confirmValues)}
            onPress={() => void act(() => publish(state.epoch, confirmValues ? snapshots : {}), 'Profil partagé mis à jour.')} />
          {state.published_at ? <Copy muted variant="caption">Dernière publication : {formatDate(state.published_at)}. Les modifications enregistrées ensuite restent privées jusqu’à la prochaine publication.</Copy> : null}
          <Button title="Voir comme un visiteur" icon="eye-outline" secondary onPress={onVisit} disabled={!state.published_at} />
          <PanelTitle title="Lien de partage" body="Un seul lien actif. Le révoquer le rend définitivement inutilisable, même si vous publiez à nouveau." />
          {link ? <TextField label="Lien à transmettre" value={linkFor(link)} editable={false} selectTextOnFocus /> : null}
          {link ? <Button title="Partager le lien" icon="share-outline" secondary onPress={() => void Share.share({ message: linkFor(link) })} /> : null}
          <Button title={state.link_active ? 'Remplacer le lien' : 'Créer un lien'} icon="link-outline" secondary disabled={busy || offline}
            onPress={() => void act(async () => setLink(await createLink()), state.link_active ? 'Nouveau lien créé : l’ancien ne fonctionne plus.' : 'Lien créé.')} />
          {state.link_active ? <Button title="Révoquer le lien" icon="close-circle-outline" variant="quiet" disabled={busy}
            onPress={() => confirm('Révoquer le lien ?', 'Les personnes qui l’ont reçu ne pourront plus ouvrir votre profil.', 'Révoquer', () => void act(async () => { setLink(null); return revokeLink(); }), true)} /> : null}
        </>
      ) : null}

      <PanelTitle title="Découvrir" />
      <Button title="Rechercher un profil ou ouvrir un lien" icon="search-outline" secondary onPress={onSearch} />
      {blocks.length ? (
        <View style={{ gap: spacing.sm }}>
          <PanelTitle title="Profils bloqués" body="Ni vous ni eux ne voyez vos profils respectifs, dans aucun canal." />
          {blocks.map((block) => (
            <View key={block.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
              <Copy>{block.label}</Copy>
              <Button title="Débloquer" variant="quiet" size="compact" onPress={() => void act(() => unblock(block.id))} />
            </View>
          ))}
        </View>
      ) : null}
      <FormNotice message={notice} />
      <FormError message={error} />
    </View>
  );
}
