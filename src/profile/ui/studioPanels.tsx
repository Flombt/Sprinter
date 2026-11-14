// Panneaux du studio avancé (8b, §17.2 à §17.5) : décorations et badges officiels, configurations,
// widgets avancés et réorganisation par glisser-déposer, avec équivalents accessibles.
import { useMemo, useRef, useState } from 'react';
import { PanResponder, View, type LayoutChangeEvent } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { randomUUID } from 'expo-crypto';
import { Button, Copy } from '../../ui/components';
import { TextField } from '../../ui/controls';
import { confirm } from '../../ui/confirm';
import { useTheme } from '../../ui/theme';
import { layout, radii, spacing } from '../../ui/tokens';
import { AVATARS, BANNERS, CARD_BACKGROUNDS, DECORATION_ICONS, ENTRY_EFFECTS, PLATES, THEMES } from '../catalog';
import {
  LIMITS, applyConfiguration, captureConfiguration, configKey, moveInOrder, validatePayload, type BadgesPayload, type ConfigPayload, type DecorationsPayload,
  type Payload, type ProfileDoc, type WidgetPayload,
} from '../model';
import { importGalleryImage, type MediaRef } from '../profile';
import type { OfficialBadge } from '../sync';
import { Chip, ChipRow, DraftField, PanelTitle } from './editorParts';
import { CroppedImage } from './ProfileView';

export type Change = { key: string; payload: Payload | null };
type Edit = (key: string, payload: Payload | null) => void;
type EditMany = (changes: Change[]) => void;

/** Liste réordonnable : poignée à glisser, actions « Monter » / « Descendre » pour le lecteur d'écran. */
export function ReorderList({ keys, onReorder, render }: { keys: string[]; onReorder: (next: string[]) => void; render: (key: string, index: number) => React.ReactNode }) {
  const { colors } = useTheme();
  const heights = useRef<Record<string, number>>({});
  const [drag, setDrag] = useState<{ key: string; dy: number } | null>(null);
  const responders = useMemo(() => Object.fromEntries(keys.map((key) => [key, PanResponder.create({
    onStartShouldSetPanResponder: () => true,
    onMoveShouldSetPanResponder: () => true,
    onPanResponderTerminationRequest: () => false,
    onPanResponderGrant: () => setDrag({ key, dy: 0 }),
    onPanResponderMove: (_event, gesture) => setDrag({ key, dy: gesture.dy }),
    onPanResponderRelease: (_event, gesture) => {
      const values = Object.values(heights.current);
      const average = values.length ? values.reduce((sum, value) => sum + value, 0) / values.length : 80;
      const shift = Math.round(gesture.dy / Math.max(average, 40));
      setDrag(null);
      if (shift) onReorder(moveInOrder(keys, key, shift));
    },
    onPanResponderTerminate: () => setDrag(null),
  })])), [keys, onReorder]);
  return (
    <View style={{ gap: spacing.md }}>
      {keys.map((key, index) => (
        <View key={key} onLayout={(event: LayoutChangeEvent) => { heights.current[key] = event.nativeEvent.layout.height; }}
          style={[{ flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
            drag?.key === key ? { transform: [{ translateY: drag.dy }], zIndex: 2, opacity: 0.9 } : null]}>
          <View {...responders[key]!.panHandlers} accessible accessibilityRole="adjustable" accessibilityLabel={`Position ${index + 1} sur ${keys.length}. Glissez pour déplacer.`}
            accessibilityActions={[{ name: 'decrement', label: 'Monter' }, { name: 'increment', label: 'Descendre' }]}
            onAccessibilityAction={(event) => onReorder(moveInOrder(keys, key, event.nativeEvent.actionName === 'increment' ? 1 : -1))}
            style={{ width: layout.touch, height: layout.touch, alignItems: 'center', justifyContent: 'center', borderRadius: radii.control, backgroundColor: colors.field }}>
            <Ionicons name="reorder-three" size={24} color={colors.text} />
          </View>
          <View style={{ flex: 1 }}>{render(key, index)}</View>
        </View>
      ))}
    </View>
  );
}

export function DecorationsPanel({ doc, edit, badges }: { doc: ProfileDoc; edit: Edit; badges: OfficialBadge[] }) {
  const decorations = (doc.decorations as DecorationsPayload | null | undefined) ?? {};
  const set = (patch: Partial<DecorationsPayload>) => {
    const next = { ...decorations, ...patch } as Payload;
    for (const key of Object.keys(next)) if (next[key] === undefined || next[key] === '') delete next[key];
    edit('decorations', Object.keys(next).length ? next : null);
  };
  const shown = (doc.badges as BadgesPayload | null | undefined)?.show ?? [];
  const toggle = (id: string) => {
    const next = shown.includes(id) ? shown.filter((item) => item !== id) : [...shown, id].slice(0, 6);
    edit('badges', next.length ? { show: next } : null);
  };
  const titleError = decorations.title && validatePayload('decorations', { title: decorations.title }) ? 'Ce titre ressemble à une distinction officielle : choisissez-en un autre.' : null;
  return (
    <>
      <PanelTitle title="Décorations" body="Titre, icône, plaque de nom, fond des cartes et effet d’entrée. Elles relèvent de votre style et restent distinctes des badges officiels." />
      <DraftField label="Titre" value={decorations.title ?? ''} max={LIMITS.decorationTitle} placeholder="Par exemple : Traileuse du dimanche"
        onCommit={(title) => set({ title: title.trim() || undefined })} description={titleError ?? undefined} />
      <ChipRow label="Icône">
        <Chip label="Sans icône" selected={!decorations.icon} onPress={() => set({ icon: undefined })} />
        {DECORATION_ICONS.map((item) => <Chip key={item.id} label={item.label} icon={item.icon} selected={decorations.icon === item.id} onPress={() => set({ icon: item.id })} />)}
      </ChipRow>
      <ChipRow label="Plaque de nom">
        <Chip label="Sans plaque" selected={!decorations.plate} onPress={() => set({ plate: undefined })} />
        {PLATES.map((item) => <Chip key={item.id} label={item.label} swatch={item.colors} selected={decorations.plate === item.id} onPress={() => set({ plate: item.id })} />)}
      </ChipRow>
      <ChipRow label="Fond des cartes">
        {CARD_BACKGROUNDS.map((item) => <Chip key={item.id} label={item.label} selected={(decorations.card ?? 'uni') === item.id} onPress={() => set({ card: item.id === 'uni' ? undefined : item.id })} />)}
      </ChipRow>
      <ChipRow label="Effet d’entrée">
        {ENTRY_EFFECTS.map((item) => <Chip key={item.id} label={item.label} selected={(decorations.entry ?? 'none') === item.id} onPress={() => set({ entry: item.id === 'none' ? undefined : item.id })} />)}
      </ChipRow>
      <Copy muted variant="caption">Avec « Réduire les animations », l’effet d’entrée est remplacé par un affichage direct.</Copy>
      <PanelTitle title="Badges officiels" body="Attribués par Sprinter selon des critères vérifiables. Choisissez ceux à afficher ; ils gardent un style réservé." />
      {badges.length ? (
        <ChipRow>
          {badges.map((badge) => <Chip key={badge.id} role="checkbox" icon="shield-checkmark" label={badge.label} selected={shown.includes(badge.id)} onPress={() => toggle(badge.id)} />)}
        </ChipRow>
      ) : <Copy muted variant="caption">Aucun badge pour l’instant. Ils apparaissent après synchronisation, selon vos courses sauvegardées et votre ancienneté.</Copy>}
    </>
  );
}

export function ConfigsPanel({ doc, editMany, edit }: { doc: ProfileDoc; editMany: EditMany; edit: Edit }) {
  const configs = Object.keys(doc).filter((key) => key.startsWith('config:') && doc[key]).sort((a, b) => String((doc[a] as Payload).name).localeCompare(String((doc[b] as Payload).name)));
  const [name, setName] = useState('');
  const [renaming, setRenaming] = useState<string | null>(null);
  const create = () => {
    const label = name.trim() || `Style ${configs.length + 1}`;
    edit(configKey(randomUUID()), captureConfiguration(doc, label) as unknown as Payload);
    setName('');
  };
  return (
    <>
      <PanelTitle title="Mes configurations" body={`Enregistrez jusqu’à ${LIMITS.configurations} styles (apparence et disposition des widgets). Appliquer une configuration garde vos textes, votre statut et vos choix de visibilité, et ne publie rien.`} />
      {configs.map((key) => {
        const config = doc[key] as unknown as ConfigPayload;
        return (
          <View key={key} style={{ gap: spacing.sm }}>
            <Copy variant="emphasis">{config.name}</Copy>
            <ChipRow>
              <Chip role="button" label="Appliquer" icon="color-wand-outline" onPress={() => confirm(`Appliquer « ${config.name} » ?`,
                'L’apparence et la disposition changent dans le brouillon. Vos textes, images, widgets et votre statut restent les mêmes. Vous pourrez annuler.',
                'Appliquer', () => editMany(applyConfiguration(doc, config)))} />
              <Chip role="button" label="Mettre à jour" icon="refresh" onPress={() => edit(key, captureConfiguration(doc, config.name) as unknown as Payload)} />
              <Chip role="button" label="Renommer" icon="create-outline" onPress={() => setRenaming(renaming === key ? null : key)} />
              <Chip role="button" label="Dupliquer" icon="copy-outline" disabled={configs.length >= LIMITS.configurations}
                onPress={() => edit(configKey(randomUUID()), { ...config, name: [...`${config.name} (copie)`].slice(0, 40).join('') } as unknown as Payload)} />
              <Chip role="button" label="Supprimer" icon="trash-outline" onPress={() => confirm(`Supprimer « ${config.name} » ?`, 'Votre profil actuel ne change pas.', 'Supprimer', () => edit(key, null), true)} />
            </ChipRow>
            {renaming === key ? <DraftField label="Nom" value={config.name} max={40} onCommit={(value) => { if (value.trim()) edit(key, { ...config, name: value.trim() } as unknown as Payload); }} /> : null}
          </View>
        );
      })}
      {configs.length < LIMITS.configurations ? (
        <>
          <DraftField label="Nom de la nouvelle configuration" value={name} max={40} onCommit={setName} placeholder="Minimaliste, Cyberpunk, Personnel…" />
          <Button title="Enregistrer le style actuel" icon="bookmark-outline" secondary onPress={create} />
        </>
      ) : <Copy muted variant="caption">Cinq configurations au plus : supprimez-en une pour en créer une autre.</Copy>}
    </>
  );
}

/** Formulaires des widgets avancés (objectif, galerie, liens, humeur, compteur, favoris). */
export function AdvancedWidgetForm({ widget, onChange, media, onError }: {
  widget: WidgetPayload; onChange: (widget: WidgetPayload) => void; media: Record<string, MediaRef>; onError: (message: string | null) => void;
}) {
  const patch = (next: Partial<WidgetPayload>) => onChange({ ...widget, ...next });
  const number = (value: string) => { const parsed = Number(value.replace(',', '.').replace(/\s/g, '')); return Number.isFinite(parsed) ? parsed : undefined; };
  switch (widget.type) {
    case 'goal': return (
      <View style={{ gap: spacing.md }}>
        <DraftField label="Objectif" value={widget.label ?? ''} max={60} placeholder="Par exemple : Semi-marathon en 1 h 45" onCommit={(label) => patch({ label: label || undefined })} />
        <DraftField label="Cible" value={widget.target === undefined ? '' : String(widget.target)} max={9} onCommit={(value) => patch({ target: number(value) })} />
        <ChipRow label="Unité">
          {(['km', 'courses', 'minutes', 'jours', 'autre'] as const).map((unit) => <Chip key={unit} label={unit} selected={(widget.unit ?? 'km') === unit} onPress={() => patch({ unit })} />)}
        </ChipRow>
        <ChipRow label="Progression">
          {([['manual', 'Saisie manuelle'], ['distance_month', 'Distance du mois'], ['distance_year', 'Distance de l’année'], ['runs_month', 'Courses du mois'], ['runs_year', 'Courses de l’année']] as const)
            .map(([source, label]) => <Chip key={source} label={label} selected={(widget.source ?? 'manual') === source} onPress={() => patch({ source })} />)}
        </ChipRow>
        {(widget.source ?? 'manual') === 'manual'
          ? <DraftField label="Progression actuelle" value={widget.progress === undefined ? '' : String(widget.progress)} max={9} onCommit={(value) => patch({ progress: number(value) })} />
          : <Copy muted variant="caption">Calculée sur cet appareil à partir de vos courses Sprinter (au moins 1 km et 5 min) ; elle reste privée.</Copy>}
      </View>
    );
    case 'gallery': {
      const images = widget.images ?? [];
      return (
        <View style={{ gap: spacing.md }}>
          {images.map((image, index) => (
            <View key={image.mediaId} style={{ gap: spacing.sm }}>
              {media[image.mediaId] ? <CroppedImage media={media[image.mediaId]!} width={120} height={80} label={image.alt} /> : null}
              <DraftField label={`Description de l’image ${index + 1}`} value={image.alt} max={140} description="Lue par le lecteur d’écran"
                onCommit={(alt) => patch({ images: images.map((item) => (item.mediaId === image.mediaId ? { ...item, alt: alt.trim() || 'Image' } : item)) })} />
              <Button title="Retirer cette image" variant="quiet" size="compact" onPress={() => patch({ images: images.filter((item) => item.mediaId !== image.mediaId) })} />
            </View>
          ))}
          <Button title="Ajouter une image" icon="image-outline" secondary disabled={images.length >= LIMITS.gallery}
            onPress={() => void importGalleryImage().then((result) => {
              if (!result) return;
              if ('error' in result) { onError(result.error); return; }
              patch({ images: [...images, { mediaId: result.id, alt: 'Image' }] });
            }).catch(() => onError('L’image n’a pas pu être importée.'))} />
          <Copy muted variant="caption">Cinq images au plus. Décrivez chaque image : la description est obligatoire.</Copy>
        </View>
      );
    }
    case 'links': return <LinksForm links={widget.links ?? []} onChange={(next) => patch({ links: next })} />;
    case 'mood': return (
      <View style={{ gap: spacing.md }}>
        <DraftField label="Emoji" value={widget.emoji ?? ''} max={LIMITS.statusEmoji} onCommit={(emoji) => patch({ emoji: emoji.trim() || undefined })} />
        <DraftField label="Message du jour" value={widget.message ?? ''} max={140} onCommit={(message) => patch({ message: message.trim() || undefined })} />
      </View>
    );
    case 'counter': return (
      <View style={{ gap: spacing.md }}>
        <DraftField label="Intitulé" value={widget.label ?? ''} max={40} placeholder="Par exemple : Dossards accrochés" onCommit={(label) => patch({ label: label || undefined })} />
        <DraftField label="Valeur" value={widget.value === undefined ? '' : String(widget.value)} max={12} onCommit={(value) => patch({ value: number(value) })} />
        <DraftField label="Unité (facultative)" value={widget.unit ?? ''} max={16} onCommit={(unit) => patch({ unit: (unit.trim() || undefined) as WidgetPayload['unit'] })} />
        <Copy muted variant="caption">Affiché avec la mention « Saisi par vous », distinct des données Sprinter.</Copy>
      </View>
    );
    case 'favorites': {
      const items = widget.items ?? [];
      const has = (kind: string, id: string) => items.some((item) => item.kind === kind && item.id === id);
      const toggle = (kind: 'theme' | 'avatar' | 'banner', id: string) => patch({ items: has(kind, id) ? items.filter((item) => !(item.kind === kind && item.id === id)) : [...items, { kind, id }].slice(0, 6) });
      return (
        <View style={{ gap: spacing.sm }}>
          <ChipRow label="Thèmes favoris">{THEMES.map((theme) => <Chip key={theme.id} role="checkbox" label={theme.label} selected={has('theme', theme.id)} onPress={() => toggle('theme', theme.id)} />)}</ChipRow>
          <ChipRow label="Avatars favoris">{AVATARS.map((avatar) => <Chip key={avatar.id} role="checkbox" icon={avatar.icon} label={avatar.label} selected={has('avatar', avatar.id)} onPress={() => toggle('avatar', avatar.id)} />)}</ChipRow>
          <ChipRow label="Bannières favorites">{BANNERS.map((banner) => <Chip key={banner.id} role="checkbox" label={banner.label} selected={has('banner', banner.id)} onPress={() => toggle('banner', banner.id)} />)}</ChipRow>
          <Copy muted variant="caption">Six favoris au plus, choisis parmi les thèmes et visuels disponibles dans Sprinter.</Copy>
        </View>
      );
    }
    default: return null;
  }
}

function LinksForm({ links, onChange }: { links: { label: string; url: string }[]; onChange: (links: { label: string; url: string }[]) => void }) {
  const [label, setLabel] = useState('');
  const [url, setUrl] = useState('');
  const [error, setError] = useState<string | null>(null);
  const add = () => {
    const candidate = { label: label.trim(), url: url.trim() };
    if (validatePayload('widget', { type: 'links', links: [candidate] })) { setError('Adresse refusée : utilisez un lien complet en https://, sans espace.'); return; }
    onChange([...links, candidate]); setLabel(''); setUrl(''); setError(null);
  };
  return (
    <View style={{ gap: spacing.md }}>
      {links.map((link) => (
        <View key={link.url} style={{ gap: spacing.xs }}>
          <Copy variant="emphasis">{link.label || link.url}</Copy>
          <Copy muted variant="caption">{link.url}</Copy>
          <Button title="Retirer ce lien" variant="quiet" size="compact" onPress={() => onChange(links.filter((item) => item.url !== link.url))} />
        </View>
      ))}
      {links.length < LIMITS.links ? (
        <>
          <TextField label="Libellé" value={label} maxLength={40} onChangeText={setLabel} />
          <TextField label="Adresse (https://…)" value={url} maxLength={200} onChangeText={setUrl} autoCapitalize="none" autoCorrect={false} keyboardType="url"
            description={error ?? 'Le domaine de destination est affiché aux visiteurs.'} />
          <Button title="Ajouter le lien" icon="link-outline" secondary onPress={add} disabled={!url.trim()} />
        </>
      ) : <Copy muted variant="caption">Cinq liens au plus.</Copy>}
    </View>
  );
}
