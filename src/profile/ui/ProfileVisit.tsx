// Vue visiteur d'un profil partagé (8c, §17.7, §17.9) : uniquement la version publiée autorisée, avec
// Signaler, Bloquer et le contact du support. Un profil inaccessible donne toujours le même message.
import { useCallback, useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Copy } from '../../ui/components';
import { SegmentedControl, TextField } from '../../ui/controls';
import { confirm } from '../../ui/confirm';
import { SettingsNotice } from '../../ui/settings';
import { spacing } from '../../ui/tokens';
import { FormError, FormNotice } from '../../account/ui/parts';
import { ELEMENT_LABELS, kindOf, type StatValue } from '../model';
import type { MediaRef } from '../profile';
import { blockProfile, reportProfile, viewProfile, visitorMedia, type VisitTarget, type VisitView } from '../sharing';
import { ProfileView } from './ProfileView';
import { Chip, ChipRow, PanelTitle } from './editorParts';

const REASONS = [['offensive', 'Offensant'], ['impersonation', 'Usurpation'], ['personal_data', 'Données personnelles'], ['spam', 'Spam'], ['other', 'Autre']] as const;
type Reason = (typeof REASONS)[number][0];

export function ProfileVisit({ target, onSupport, onBlocked }: { target: VisitTarget; onSupport: () => void; onBlocked: () => void }) {
  const [view, setView] = useState<VisitView | null>(null);
  const [media, setMedia] = useState<Record<string, MediaRef>>({});
  const [reporting, setReporting] = useState(false);
  const [element, setElement] = useState<string | null>(null);
  const [reason, setReason] = useState<Reason>('offensive');
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async () => {
    setError(null);
    try {
      const next = await viewProfile(target);
      setView(next);
      setMedia(next.available ? await visitorMedia(next, target) : {});
    } catch (failure) {
      setError(failure instanceof Error && failure.message === 'feature_disabled' ? 'Le partage des profils est momentanément indisponible.' : 'Profil indisponible pour le moment.');
    }
  }, [target]);
  useEffect(() => { void load(); }, [load]);
  if (error) return <FormError message={error} />;
  if (!view) return <Copy muted>Chargement…</Copy>;
  if (!view.available) return <SettingsNotice icon="eye-off-outline" title="Profil indisponible" body="Ce profil n’existe pas, n’est pas partagé avec vous ou n’est plus accessible." />;
  const elements = view.elements ?? {};
  const reportable = Object.keys(elements).filter((key) => ['identity', 'avatar', 'banner', 'about', 'status', 'widget'].includes(kindOf(key)));
  const noStats = (): StatValue[] => [];
  const send = async () => {
    setError(null);
    try {
      await reportProfile(target, element, reason, note.trim() || null);
      setReporting(false); setNote('');
      setNotice('Merci, votre signalement a été transmis. Il sera examiné par l’équipe Sprinter.');
    } catch { setError('Le signalement n’a pas pu être envoyé.'); }
  };
  return (
    <View style={{ gap: spacing.lg }}>
      {view.self ? <FormNotice message="Aperçu visiteur : la version publiée, avec la visibilité et la modération réellement en vigueur." /> : null}
      {view.presence === 'online' ? <Copy muted variant="caption">● Dans Sprinter en ce moment</Copy> : null}
      <ProfileView doc={elements} media={media} stats={noStats} badges={view.badges ?? []} viewer="visitor" />
      <FormNotice message={notice} />
      {!view.self ? (
        <>
          {reporting ? (
            <View style={{ gap: spacing.md }}>
              <PanelTitle title="Signaler" body="Choisissez le contenu concerné et le motif. Votre identité n’est pas communiquée au membre." />
              <ChipRow label="Contenu">
                <Chip label="Tout le profil" selected={element === null} onPress={() => setElement(null)} />
                {reportable.map((key) => <Chip key={key} label={ELEMENT_LABELS[kindOf(key)]} selected={element === key} onPress={() => setElement(key)} />)}
              </ChipRow>
              <SegmentedControl value={reason} choices={REASONS} onChange={setReason} label="Motif" />
              <TextField label="Précisions (facultatives)" value={note} onChangeText={setNote} maxLength={500} multiline />
              <Button title="Envoyer le signalement" icon="flag-outline" onPress={() => void send()} />
              <Button title="Annuler" variant="quiet" onPress={() => setReporting(false)} />
            </View>
          ) : <Button title="Signaler" icon="flag-outline" secondary onPress={() => setReporting(true)} />}
          <Button title="Bloquer" icon="hand-left-outline" variant="quiet" onPress={() => confirm('Bloquer ce profil ?',
            'Vous ne verrez plus ce profil, et ce membre ne verra plus le vôtre. Vous pourrez débloquer depuis Visibilité et partage.', 'Bloquer',
            () => void blockProfile(target).then(onBlocked).catch(() => setError('Le blocage n’a pas abouti.')), true)} />
          <Button title="Contacter le support" icon="chatbubbles-outline" variant="quiet" onPress={onSupport} />
        </>
      ) : null}
      <FormError message={error} />
    </View>
  );
}
