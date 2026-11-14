// Bibliothèque communautaire de thèmes (8d, §17.11) : parcourir par catégorie, prévisualiser, mettre en favori,
// appliquer une copie indépendante, publier son style (paramètres visuels seulement), signaler, retirer.
import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import { Button, Copy } from '../../ui/components';
import { TextField } from '../../ui/controls';
import { confirm } from '../../ui/confirm';
import { useTheme } from '../../ui/theme';
import { spacing } from '../../ui/tokens';
import { session } from '../../services/session';
import { Checkbox, FormError, FormNotice } from '../../account/ui/parts';
import { resolveAppearance } from '../catalog';
import { computeStats, type ProfileDoc, type StatId } from '../model';
import { editProfileElement, useProfile } from '../profile';
import { RULES } from '../sharing';
import { THEME_CATEGORIES, applyStyle, styleFromDoc, type ThemeCategory } from '../themeModel';
import { favoriteTheme, listThemes, publishTheme, reportTheme, withdrawTheme, type LibraryTheme } from '../themes';
import { Chip, ChipRow, PanelTitle } from './editorParts';
import { ProfileView } from './ProfileView';

export function ThemeLibrary() {
  const profile = useProfile();
  const { colors } = useTheme();
  const history = useSyncExternalStore(session.subscribe, () => session.getSnapshot().history, () => session.getSnapshot().history);
  const stats = useCallback((ids: StatId[]) => computeStats(history, ids, Date.now()), [history]);
  const [category, setCategory] = useState<ThemeCategory | null>(null);
  const [sort, setSort] = useState<'recent' | 'popular' | 'favorites'>('recent');
  const [items, setItems] = useState<LibraryTheme[]>([]);
  const [preview, setPreview] = useState<LibraryTheme | null>(null);
  const [name, setName] = useState('');
  const [publishCategory, setPublishCategory] = useState<ThemeCategory>('autre');
  const [agreed, setAgreed] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const load = useCallback(async (offset = 0) => {
    setError(null);
    try {
      const result = await listThemes(category, sort, offset);
      setItems((current) => (offset ? [...current, ...result.items] : result.items));
    } catch (failure) {
      setError(failure instanceof Error && failure.message === 'feature_disabled' ? 'La bibliothèque est momentanément indisponible.' : 'La bibliothèque n’a pas pu être chargée.');
    }
  }, [category, sort]);
  useEffect(() => { void load(); }, [load]);
  const previewDoc = useMemo<ProfileDoc>(() => {
    if (!preview) return profile.working;
    const doc = { ...profile.working };
    for (const change of applyStyle(profile.working, preview.style)) doc[change.key] = change.payload;
    return doc;
  }, [preview, profile.working]);
  const act = async (operation: () => Promise<unknown>, done: string) => {
    setError(null); setNotice(null);
    try { await operation(); setNotice(done); await load(); } catch (failure) {
      setError(failure instanceof Error && failure.message.startsWith('invalid_style') ? 'Ce style contient un élément non partageable.'
        : failure instanceof Error && failure.message === 'invalid_parameter:name' ? 'Choisissez un nom de 2 à 40 caractères, sans « officiel » ni « Sprinter ».'
          : failure instanceof Error && failure.message === 'limit_themes' ? 'Dix thèmes publiés au plus : retirez-en un.' : 'L’opération n’a pas abouti.');
    }
  };
  const apply = (theme: LibraryTheme) => act(async () => {
    for (const change of applyStyle(profile.working, theme.style)) await editProfileElement(change.key, change.payload);
  }, `« ${theme.name} » est appliqué à votre brouillon (copie indépendante). Enregistrez-le depuis Modifier.`);
  return (
    <View style={{ gap: spacing.lg }}>
      <View accessibilityLabel="Aperçu avec le thème sélectionné">
        <ProfileView doc={previewDoc} media={profile.media} stats={stats} badges={profile.badges} />
      </View>
      {preview ? <Copy muted variant="caption">Aperçu : « {preview.name} ». Vos textes et images restent les vôtres.</Copy> : null}
      <ChipRow label="Catégorie">
        <Chip label="Toutes" selected={category === null} onPress={() => setCategory(null)} />
        {THEME_CATEGORIES.map(([value, label]) => <Chip key={value} label={label} selected={category === value} onPress={() => setCategory(value)} />)}
      </ChipRow>
      <ChipRow label="Tri">
        <Chip label="Récents" selected={sort === 'recent'} onPress={() => setSort('recent')} />
        <Chip label="Populaires" selected={sort === 'popular'} onPress={() => setSort('popular')} />
        <Chip label="Mes favoris" selected={sort === 'favorites'} onPress={() => setSort('favorites')} />
      </ChipRow>
      {items.length === 0 ? <Copy muted>Aucun thème pour l’instant.</Copy> : null}
      {items.map((theme) => {
        const look = resolveAppearance(theme.style.appearance, colors.dark, 'ios');
        return (
          <View key={theme.id} style={{ gap: spacing.sm }}>
            <Copy variant="emphasis">{theme.name} · {THEME_CATEGORIES.find(([value]) => value === theme.category)?.[1]} · {theme.favorites} favori{theme.favorites > 1 ? 's' : ''}</Copy>
            <ChipRow>
              <Chip role="button" label="Aperçu" swatch={[look.background, look.accent, look.banner[1]]} selected={preview?.id === theme.id} onPress={() => setPreview(preview?.id === theme.id ? null : theme)} />
              <Chip role="button" label="Appliquer" icon="color-wand-outline" onPress={() => void apply(theme)} />
              <Chip role="checkbox" label="Favori" icon={theme.favorite ? 'heart' : 'heart-outline'} selected={theme.favorite}
                onPress={() => void act(() => favoriteTheme(theme.id, !theme.favorite), theme.favorite ? 'Retiré des favoris.' : 'Ajouté aux favoris.')} />
              {theme.mine ? <Chip role="button" label="Retirer" icon="trash-outline" onPress={() => confirm('Retirer ce thème ?', 'Il ne sera plus proposé. Les copies déjà appliquées restent chez leurs titulaires.', 'Retirer',
                () => void act(() => withdrawTheme(theme.id), 'Thème retiré de la bibliothèque.'), true)} />
                : <Chip role="button" label="Signaler" icon="flag-outline" onPress={() => confirm('Signaler ce thème ?', 'Il sera examiné par l’équipe Sprinter.', 'Signaler',
                  () => void act(() => reportTheme(theme.id, 'offensive'), 'Merci, le thème a été signalé.'))} />}
            </ChipRow>
          </View>
        );
      })}
      {items.length && items.length % 30 === 0 ? <Button title="Plus de thèmes" variant="quiet" onPress={() => void load(items.length)} /> : null}
      <PanelTitle title="Publier mon style" body="Seuls les paramètres visuels de votre version enregistrée sont publiés : thème, couleurs, typographie, bannière sans photo, forme et cadre de l’avatar, décorations sans texte. Ni photo, ni texte, ni statistique, ni badge." />
      <TextField label="Nom du thème" value={name} onChangeText={setName} maxLength={40} />
      <ChipRow label="Catégorie du thème">{THEME_CATEGORIES.map(([value, label]) => <Chip key={value} label={label} selected={publishCategory === value} onPress={() => setPublishCategory(value)} />)}</ChipRow>
      {RULES.slice(0, 1).map((rule) => <Copy key={rule} variant="caption">• {rule}</Copy>)}
      <Checkbox checked={agreed} onChange={setAgreed} label="Je publie ce thème dans la bibliothèque et j’accepte les règles d’usage" />
      <Button title="Publier dans la bibliothèque" icon="cloud-upload-outline" secondary disabled={!agreed || name.trim().length < 2}
        onPress={() => void act(() => publishTheme(randomUUID(), name.trim(), publishCategory, styleFromDoc(profile.saved)), 'Thème publié dans la bibliothèque.').then(() => { setName(''); setAgreed(false); })} />
      <FormNotice message={notice} />
      <FormError message={error} />
    </View>
  );
}
