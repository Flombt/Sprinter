// Carte partageable et signature (8d, §17.11) : composition à partir d'éléments choisis, aperçu validé
// par le titulaire, puis génération d'une image sur l'appareil. Rien n'est envoyé au serveur.
import { useRef, useState } from 'react';
import { Share, Text, View } from 'react-native';
import * as Sharing from 'expo-sharing';
import { captureRef } from 'react-native-view-shot';
import { Button, Copy } from '../../ui/components';
import { radii, spacing } from '../../ui/tokens';
import { Checkbox, FormError } from '../../account/ui/parts';
import { DECORATION_ICONS } from '../catalog';
import { activeStatus, type AboutPayload, type DecorationsPayload, type IdentityPayload } from '../model';
import { useProfile } from '../profile';
import { AvatarArt, useProfileAppearance } from './ProfileView';
import { PanelTitle } from './editorParts';

export function ProfileCard() {
  const profile = useProfile();
  const doc = profile.saved;
  const theme = useProfileAppearance(doc);
  const card = useRef<React.ComponentRef<typeof View>>(null);
  const [show, setShow] = useState({ avatar: true, name: true, status: true, decoration: true, bio: false });
  const [validated, setValidated] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const name = (doc.identity as IdentityPayload | null | undefined)?.name?.trim() || 'Profil Sprinter';
  const status = activeStatus(doc.status, Date.now());
  const decorations = (doc.decorations as DecorationsPayload | null | undefined) ?? {};
  const icon = DECORATION_ICONS.find((item) => item.id === decorations.icon);
  const bio = (doc.about as AboutPayload | null | undefined)?.bio?.split('\n')[0]?.slice(0, 90);
  const signature = [show.name ? name : null, show.status && status ? [status.emoji, status.text].filter(Boolean).join(' ') : null,
    show.decoration && decorations.title ? decorations.title : null, 'via Sprinter'].filter(Boolean).join(' · ');
  const toggle = (key: keyof typeof show) => { setShow({ ...show, [key]: !show[key] }); setValidated(false); };
  const generate = async () => {
    setError(null);
    try {
      const uri = await captureRef(card, { format: 'png', quality: 1, result: 'tmpfile' });
      if (await Sharing.isAvailableAsync()) await Sharing.shareAsync(uri, { mimeType: 'image/png', dialogTitle: 'Partager ma carte Sprinter' });
    } catch { setError('L’image n’a pas pu être générée sur cet appareil.'); }
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <PanelTitle title="Composer la carte" body="Choisissez ce qui apparaît. L’image est créée sur votre appareil, seulement après votre validation de l’aperçu." />
      <Checkbox checked={show.avatar} onChange={() => toggle('avatar')} label="Avatar" />
      <Checkbox checked={show.name} onChange={() => toggle('name')} label="Nom de présentation" />
      <Checkbox checked={show.status} onChange={() => toggle('status')} label="Statut" />
      <Checkbox checked={show.decoration} onChange={() => toggle('decoration')} label="Décoration (icône et titre)" />
      <Checkbox checked={show.bio} onChange={() => toggle('bio')} label="Première ligne de la présentation" />
      <View ref={card} collapsable={false} accessible accessibilityLabel={`Aperçu de la carte : ${signature}`}
        style={{ backgroundColor: theme.background, borderRadius: radii.card, padding: spacing.xl, gap: spacing.md, alignItems: 'center', borderWidth: 2, borderColor: theme.accent }}>
        {show.avatar ? <AvatarArt doc={doc} media={profile.media} theme={theme} size={88} /> : null}
        {show.name ? <Text style={{ color: theme.text, fontSize: 22, fontWeight: '700', fontFamily: theme.fontFamily }}>{name}</Text> : null}
        {show.decoration && (icon || decorations.title) ? <Text style={{ color: theme.secondary, fontSize: 14 }}>{[icon?.label, decorations.title].filter(Boolean).join(' · ')}</Text> : null}
        {show.status && status ? <Text style={{ color: theme.text, fontSize: 15 }}>{[status.emoji, status.text].filter(Boolean).join(' ')}</Text> : null}
        {show.bio && bio ? <Text style={{ color: theme.muted, fontSize: 14, textAlign: 'center' }}>{bio}</Text> : null}
        <Text style={{ color: theme.muted, fontSize: 12 }}>Sprinter</Text>
      </View>
      <Checkbox checked={validated} onChange={setValidated} label="J’ai vérifié l’aperçu : il ne contient que ce que je veux partager" />
      <Button title="Générer et partager l’image" icon="image-outline" disabled={!validated} onPress={() => void generate()} />
      <PanelTitle title="Signature" body={signature} />
      <Button title="Partager la signature" icon="share-outline" secondary disabled={!validated} onPress={() => void Share.share({ message: signature })} />
      <Copy muted variant="caption">Aucune position, course ni donnée d’appareil n’est ajoutée.</Copy>
      <FormError message={error} />
    </View>
  );
}
