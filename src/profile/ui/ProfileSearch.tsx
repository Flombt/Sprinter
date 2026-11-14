// Recherche de profils (8c) : réservée aux membres connectés, par pseudo, profils qui l'ont choisi.
import { useState } from 'react';
import { View } from 'react-native';
import { Button, Copy, ListRow } from '../../ui/components';
import { TextField } from '../../ui/controls';
import { spacing } from '../../ui/tokens';
import { FormError } from '../../account/ui/parts';
import { parseLink, searchProfiles, type VisitTarget } from '../sharing';
import { PanelTitle } from './editorParts';

export function ProfileSearch({ onOpen }: { onOpen: (target: VisitTarget) => void }) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<{ handle: string; name: string | null }[] | null>(null);
  const [link, setLink] = useState('');
  const [error, setError] = useState<string | null>(null);
  const search = async (after?: string) => {
    setError(null);
    try {
      const result = await searchProfiles(query.trim(), after);
      setItems((current) => (after ? [...(current ?? []), ...result.items] : result.items));
    } catch (failure) {
      setError(failure instanceof Error && failure.message === 'rate_limited' ? 'Trop de recherches : réessayez dans quelques minutes.'
        : failure instanceof Error && failure.message.startsWith('invalid_parameter') ? 'Saisissez au moins 2 caractères : lettres, chiffres, point, tiret ou souligné.'
          : 'La recherche n’a pas abouti.');
    }
  };
  return (
    <View style={{ gap: spacing.lg }}>
      <PanelTitle title="Rechercher un pseudo" body="Seuls les profils partagés aux membres qui ont choisi d’apparaître dans la recherche." />
      <TextField label="Pseudo" value={query} onChangeText={setQuery} autoCapitalize="none" autoCorrect={false} maxLength={20} onSubmitEditing={() => void search()} />
      <Button title="Rechercher" icon="search-outline" onPress={() => void search()} disabled={query.trim().length < 2} />
      {items?.length === 0 ? <Copy muted>Aucun profil trouvé.</Copy> : null}
      {(items ?? []).map((item) => (
        <ListRow key={item.handle} title={item.handle} icon="person-circle-outline" onPress={() => onOpen({ handle: item.handle })}
          subtitle={item.name ? <Copy muted variant="caption">{item.name}</Copy> : undefined} />
      ))}
      {items && items.length >= 20 && items.length % 20 === 0 ? <Button title="Plus de résultats" variant="quiet" onPress={() => void search(items[items.length - 1]!.handle)} /> : null}
      <PanelTitle title="Ouvrir un lien de profil" body="Collez le lien reçu (sprinter://profil?t=…) ou son code." />
      <TextField label="Lien ou code" value={link} onChangeText={setLink} autoCapitalize="none" autoCorrect={false} />
      <Button title="Ouvrir" icon="open-outline" secondary disabled={!parseLink(link)} onPress={() => { const token = parseLink(link); if (token) onOpen({ token }); }} />
      <FormError message={error} />
    </View>
  );
}
