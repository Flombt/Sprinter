// Studio du profil (8a essentiel, 8b avancé, §17.2 à §17.5) : chaque geste est gardé tout de suite dans le
// brouillon de l'appareil ; « Enregistrer » met à jour la version privée puis la synchronise. Le studio avancé
// ajoute Annuler / Rétablir, les réinitialisations, les configurations, les décorations et les widgets avancés.
import { useCallback, useReducer, useRef, useState, useSyncExternalStore } from 'react';
import { ScrollView, View } from 'react-native';
import { randomUUID } from 'expo-crypto';
import RangeSlider from '../../ui/RangeSlider';
import { Button, Copy, type IconName } from '../../ui/components';
import { Toggle } from '../../ui/controls';
import { confirm } from '../../ui/confirm';
import { spacing } from '../../ui/tokens';
import { session } from '../../services/session';
import { useFlag } from '../../account/config';
import { FormError, FormNotice } from '../../account/ui/parts';
import {
  ACCENTS, AVATARS, AVATAR_FRAMES, AVATAR_SHAPES, BANNERS, BUTTON_STYLES, CARD_STYLES, FONTS, MOODS, SEASONAL_THEMES, SWATCHES, THEMES,
} from '../catalog';
import { currentSeason } from '../themeModel';
import {
  DEFAULT_STYLE_SCOPE, ELEMENT_LABELS, ESSENTIAL_WIDGET_TYPES, EditHistory, LIMITS, STATUS_DURATIONS, STAT_IDS, STAT_LABELS, WIDGET_LABELS, computeStats,
  goalProgress, kindOf, moveInOrder, orderedWidgets, restoreDefaultStyle, statusExpiry, widgetKey, type AboutPayload, type AppearancePayload, type AvatarPayload,
  type BannerPayload, type Crop, type IdentityPayload, type Payload, type ProfileDoc, type StatId, type StatusDuration, type StatusPayload, type StatusesPayload,
  type WidgetPayload, type WidgetType,
} from '../model';
import { discardProfileDraft, editProfileElement, importProfileImage, pruneProfileMedia, saveProfile, useProfile, type MediaRef } from '../profile';
import type { DraftElement } from '../localStore';
import { Chip, ChipRow, CropControls, DraftField, PanelTitle } from './editorParts';
import { ProfileView } from './ProfileView';
import { AdvancedWidgetForm, ConfigsPanel, DecorationsPanel, ReorderList, type Change } from './studioPanels';

type Category = 'templates' | 'appearance' | 'avatar' | 'banner' | 'info' | 'status' | 'widgets' | 'decorations' | 'configs';
const CATEGORIES: [Category, string, IconName, boolean][] = [
  ['templates', 'Modèles', 'sparkles-outline', false], ['appearance', 'Apparence', 'color-palette-outline', false], ['avatar', 'Avatar', 'person-circle-outline', false],
  ['banner', 'Bannière', 'image-outline', false], ['info', 'Informations', 'text-outline', false], ['status', 'Statut', 'happy-outline', false],
  ['widgets', 'Widgets', 'grid-outline', false], ['decorations', 'Décorations et badges', 'ribbon-outline', true], ['configs', 'Mes configurations', 'bookmarks-outline', true],
];
const EMOJIS = ['🏃', '🎧', '🏁', '💪', '😴', '🤕', '🌧️', '🔥', '🎉', '🧘'];
const REVIEW_REASONS: Record<string, string> = {
  media_location: 'l’image contenait une position GPS', media_too_large: 'l’image est trop lourde', media_format: 'format d’image non accepté',
  media_too_long: 'l’animation dépasse 8 secondes', limit_widgets: '8 widgets au plus', limit_configs: '5 configurations au plus',
  'invalid:studio_disabled': 'fonction avancée momentanément indisponible',
};
type Edit = (key: string, payload: Payload | null) => void;
interface PanelProps { doc: ProfileDoc; edit: Edit; editMany: (changes: Change[]) => void; studio: boolean; onError: (message: string | null) => void; media: Record<string, MediaRef> }

function ResetButton({ label, scope, onReset, disabled }: { label: string; scope: string; onReset: () => void; disabled?: boolean }) {
  return <Button title={label} variant="quiet" icon="refresh" disabled={disabled} onPress={() => confirm(`${label} ?`, scope, 'Réinitialiser', onReset)} />;
}

export function ProfileEditor({ onDone }: { onDone: () => void }) {
  const profile = useProfile();
  const studio = useFlag('profile_studio_enabled');
  const [category, setCategory] = useState<Category>('templates');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [wide, setWide] = useState(false);
  const history = useRef(new EditHistory()).current;
  const [, refresh] = useReducer((value: number) => value + 1, 0);
  const sessionHistory = useSyncExternalStore(session.subscribe, () => session.getSnapshot().history, () => session.getSnapshot().history);
  const stats = useCallback((ids: StatId[]) => computeStats(sessionHistory, ids, Date.now()), [sessionHistory]);
  const goal = useCallback((widget: WidgetPayload) => goalProgress(widget, sessionHistory, Date.now()), [sessionHistory]);
  const doc = profile.working;
  const write = (changes: Change[]) => {
    setError(null);
    void changes.reduce((chain, change) => chain.then(() => editProfileElement(change.key, change.payload)), Promise.resolve())
      .catch(() => setError('Cette modification n’a pas pu être gardée sur l’appareil.'));
  };
  const editMany = (changes: Change[]) => {
    if (!changes.length) return;
    history.record(changes.map((change) => ({ key: change.key, before: doc[change.key] ?? null, after: change.payload })));
    write(changes);
    refresh();
  };
  const edit: Edit = (key, payload) => editMany([{ key, payload }]);
  const undo = () => { const steps = history.undo(); if (steps) write(steps.map((step) => ({ key: step.key, payload: step.after }))); refresh(); };
  const redo = () => { const steps = history.redo(); if (steps) write(steps.map((step) => ({ key: step.key, payload: step.after }))); refresh(); };
  const save = async () => {
    setBusy(true); setError(null);
    try { await saveProfile(); onDone(); } catch { setError('L’enregistrement a échoué. Vos modifications restent dans le brouillon.'); } finally { setBusy(false); }
  };
  const discard = () => confirm('Abandonner les modifications ?', 'Les changements non enregistrés seront perdus. La version enregistrée reste inchangée.', 'Abandonner',
    () => void discardProfileDraft().then(pruneProfileMedia).then(onDone).catch(() => setError('Le brouillon n’a pas pu être effacé.')), true);
  const props: PanelProps = { doc, edit, editMany, studio, onError: setError, media: profile.media };
  const panels: Record<Category, React.ReactNode> = {
    templates: <TemplatesPanel {...props} />,
    appearance: <AppearancePanel {...props} />,
    avatar: <AvatarPanel {...props} />,
    banner: <BannerPanel {...props} />,
    info: <InfoPanel {...props} />,
    status: <StatusPanel {...props} />,
    widgets: <WidgetsPanel {...props} />,
    decorations: <DecorationsPanel doc={doc} edit={edit} badges={profile.badges} />,
    configs: <ConfigsPanel doc={doc} edit={edit} editMany={editMany} />,
  };
  const visible = CATEGORIES.filter(([, , , advanced]) => studio || !advanced);
  return (
    <View style={{ gap: spacing.lg }}>
      {studio ? (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm }}>
          <Chip role="button" label="Annuler" icon="arrow-undo" disabled={!history.canUndo} onPress={undo} />
          <Chip role="button" label="Rétablir" icon="arrow-redo" disabled={!history.canRedo} onPress={redo} />
          <Chip label="Vue mobile" icon="phone-portrait-outline" selected={!wide} onPress={() => setWide(false)} />
          <Chip label="Vue ordinateur" icon="desktop-outline" selected={wide} onPress={() => setWide(true)} />
        </View>
      ) : null}
      <View accessibilityLabel="Aperçu du profil">
        <ProfileView doc={doc} media={profile.media} stats={stats} goal={goal} badges={profile.badges} wide={wide} />
      </View>
      <DraftState drafts={profile.drafts} />
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm }} accessibilityRole="tablist">
        {visible.map(([value, label, icon]) => <Chip key={value} label={label} icon={icon} selected={category === value} onPress={() => setCategory(value)} />)}
      </ScrollView>
      <View style={{ gap: spacing.lg }}>{panels[visible.some(([value]) => value === category) ? category : 'templates']}</View>
      <FormError message={error} />
      <Button title={busy ? 'Enregistrement…' : 'Enregistrer'} icon="checkmark" onPress={() => void save()} disabled={busy || !profile.drafts.length} />
      <Button title="Abandonner les modifications" secondary onPress={discard} disabled={busy || !profile.drafts.length} />
      <Copy muted variant="caption">Vous pouvez quitter à tout moment : le brouillon reste sur cet appareil, même après fermeture de l’app.</Copy>
    </View>
  );
}

function DraftState({ drafts }: { drafts: DraftElement[] }) {
  if (!drafts.length) return <Copy muted variant="caption">Aucune modification en cours.</Copy>;
  const review = drafts.filter((draft) => draft.review);
  return (
    <View style={{ gap: spacing.sm }}>
      <FormNotice message={`${drafts.length} modification${drafts.length > 1 ? 's' : ''} en brouillon sur cet appareil, non enregistrée${drafts.length > 1 ? 's' : ''}.`} />
      {review.map((draft) => {
        const label = ELEMENT_LABELS[kindOf(draft.key)];
        const code = draft.review!.replace('rejected:', '');
        const reason = draft.review === 'conflict' ? 'modifié entre-temps sur un autre appareil. La version enregistrée vient de cet autre appareil ; votre version est gardée ici.'
          : `non enregistré : ${REVIEW_REASONS[code] ?? 'contenu non accepté'}.`;
        return (
          <View key={draft.key} style={{ gap: spacing.xs }}>
            <Copy variant="caption">{label} — {reason}</Copy>
            <Button title="Reprendre la version enregistrée" variant="quiet" size="compact" onPress={() => void discardProfileDraft([draft.key])} />
          </View>
        );
      })}
    </View>
  );
}

function TemplatesPanel({ doc, editMany }: PanelProps) {
  const current = (doc.appearance as AppearancePayload | null | undefined)?.theme ?? 'sprinter';
  const season = SEASONAL_THEMES.find((theme) => theme.id === currentSeason(Date.now()).id)!;
  return (
    <>
      <PanelTitle title="Partir d’un modèle" body="Un univers complet en un geste : couleurs, cartes et bannière assorties. Chaque élément reste modifiable ensuite." />
      <ChipRow label="Thème de saison">
        <Chip label={`De saison : ${season.label}`} icon="leaf-outline" swatch={[season.background, season.accent, season.banner[1]]} selected={current === season.id}
          onPress={() => editMany([{ key: 'appearance', payload: { theme: season.id } }, { key: 'banner', payload: null }])} />
      </ChipRow>
      <ChipRow label="Modèles">
        {THEMES.map((theme) => (
          <Chip key={theme.id} label={theme.label} swatch={[theme.background, theme.accent, theme.banner[1]]} selected={current === theme.id}
            onPress={() => editMany([{ key: 'appearance', payload: theme.id === 'sprinter' ? null : { theme: theme.id } }, { key: 'banner', payload: null }])} />
        ))}
      </ChipRow>
      <Button title="Repartir du style Sprinter" icon="refresh" secondary onPress={() => editMany([{ key: 'appearance', payload: null }, { key: 'banner', payload: null }])} />
    </>
  );
}

function AppearancePanel({ doc, edit, editMany, studio }: PanelProps) {
  const appearance = (doc.appearance as AppearancePayload | null | undefined) ?? { theme: 'sprinter' };
  const set = (patch: Partial<AppearancePayload>) => {
    const next = { ...appearance, ...patch } as Payload;
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    if (next.colors && !Object.keys(next.colors as object).length) delete next.colors;
    edit('appearance', next.theme === 'sprinter' && Object.keys(next).length === 1 ? null : next);
  };
  const setColor = (slot: 'accent' | 'secondary' | 'background' | 'surface', color: string | undefined) => {
    const colors = { ...(appearance.colors ?? {}) } as Record<string, string>;
    if (color) colors[slot] = color; else delete colors[slot];
    set({ colors });
  };
  return (
    <>
      <PanelTitle title="Thème" body="Les réglages, la navigation et l’écran de course gardent le thème de l’app." />
      <ChipRow label="Thème">
        {THEMES.map((theme) => <Chip key={theme.id} label={theme.label} swatch={[theme.background, theme.accent]} selected={appearance.theme === theme.id} onPress={() => set({ theme: theme.id })} />)}
      </ChipRow>
      <PanelTitle title="Couleur d’accent" body="Ajustée automatiquement si elle manque de contraste avec le thème." />
      <ChipRow label="Couleur d’accent">
        <Chip label="Couleur du thème" selected={!appearance.accent} onPress={() => set({ accent: undefined })} />
        {ACCENTS.map((accent) => <Chip key={accent.id} label={accent.label} swatch={[accent.onDark, accent.onLight]} selected={appearance.accent === accent.id} onPress={() => set({ accent: accent.id })} />)}
      </ChipRow>
      {studio ? (
        <>
          {(['accent', 'secondary', 'background', 'surface'] as const).map((slot) => (
            <View key={slot} style={{ gap: spacing.sm }}>
              <PanelTitle title={{ accent: 'Couleur principale', secondary: 'Couleur secondaire', background: 'Fond de page', surface: 'Fond des cartes' }[slot]} />
              <ChipRow label={slot}>
                <Chip label="Du thème" selected={!appearance.colors?.[slot]} onPress={() => setColor(slot, undefined)} />
                {SWATCHES.map((color) => <Chip key={color} label={color} swatch={[color]} selected={appearance.colors?.[slot] === color} onPress={() => setColor(slot, color)} />)}
              </ChipRow>
            </View>
          ))}
          <Copy muted variant="caption">Un texte ou un accent qui deviendrait peu lisible est remplacé par une couleur de secours (contraste 4,5:1 pour le texte, 3:1 pour les accents).</Copy>
          <ChipRow label="Typographie">{FONTS.map((font) => <Chip key={font.id} label={font.label} selected={(appearance.font ?? 'system') === font.id} onPress={() => set({ font: font.id === 'system' ? undefined : font.id })} />)}</ChipRow>
          <ChipRow label="Style des cartes">{CARD_STYLES.map((style) => <Chip key={style.id} label={style.label} selected={(appearance.cards ?? 'outlined') === style.id} onPress={() => set({ cards: style.id === 'outlined' ? undefined : style.id })} />)}</ChipRow>
          <ChipRow label="Style des étiquettes">{BUTTON_STYLES.map((style) => <Chip key={style.id} label={style.label} selected={(appearance.buttons ?? 'pill') === style.id} onPress={() => set({ buttons: style.id === 'pill' ? undefined : style.id })} />)}</ChipRow>
          <Toggle title="Disposition encadrée" body="Un cadre aux couleurs du thème entoure le profil." value={appearance.frame === true} onChange={(frame) => set({ frame: frame || undefined })} />
          <ResetButton label="Restaurer l’apparence par défaut" scope={DEFAULT_STYLE_SCOPE} onReset={() => editMany(restoreDefaultStyle(doc))} disabled={!restoreDefaultStyle(doc).length} />
        </>
      ) : null}
    </>
  );
}

function AvatarPanel({ doc, edit, studio, onError }: PanelProps) {
  const avatar = doc.avatar as AvatarPayload | null | undefined;
  const crop: Crop = { x: 0, y: 0, zoom: 1, ...avatar?.crop };
  const style = (patch: Partial<AvatarPayload>) => {
    const next = { ...(avatar ?? { source: 'default' as const }), ...patch } as Payload;
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    edit('avatar', next.source === 'default' && Object.keys(next).length === 1 ? null : next);
  };
  const keepStyle = (payload: Payload) => ({ ...Object.fromEntries(Object.entries(avatar ?? {}).filter(([key]) => ['shape', 'frame', 'halo'].includes(key))), ...payload });
  return (
    <>
      <PanelTitle title="Avatar" body="Photo personnelle (JPEG, PNG ou HEIC, convertie et allégée sur l’appareil, sans position GPS) ou avatar de la bibliothèque." />
      <Button title="Importer une photo" icon="image-outline" secondary onPress={() => void importProfileImage('avatar', { current: avatar as Payload | null }).then(onError).catch(() => onError('La photo n’a pas pu être importée.'))} />
      {studio ? <Button title="Importer un GIF animé" icon="film-outline" secondary onPress={() => void importProfileImage('avatar', { animated: true, current: avatar as Payload | null })
        .then(onError).catch(() => onError('Le GIF n’a pas pu être importé.'))} /> : null}
      {avatar?.source === 'media' ? <CropControls crop={crop} label="Avatar" onChange={(next) => edit('avatar', { ...avatar, crop: next })} /> : null}
      <ChipRow label="Bibliothèque d’avatars">
        <Chip label="Avatar Sprinter" icon="person" selected={!avatar || avatar.source === 'default'} onPress={() => edit('avatar', studio ? keepStyle({ source: 'default' }) : null)} />
        {AVATARS.map((item) => <Chip key={item.id} label={item.label} icon={item.icon} selected={avatar?.source === 'library' && avatar.libraryId === item.id}
          onPress={() => edit('avatar', keepStyle({ source: 'library', libraryId: item.id }))} />)}
      </ChipRow>
      {studio ? (
        <>
          <ChipRow label="Forme">{AVATAR_SHAPES.map((shape) => <Chip key={shape.id} label={shape.label} selected={(avatar?.shape ?? 'circle') === shape.id} onPress={() => style({ shape: shape.id === 'circle' ? undefined : shape.id })} />)}</ChipRow>
          <ChipRow label="Cadre">{AVATAR_FRAMES.map((frame) => <Chip key={frame.id} label={frame.label} selected={(avatar?.frame ?? 'none') === frame.id} onPress={() => style({ frame: frame.id === 'none' ? undefined : frame.id })} />)}</ChipRow>
          <Toggle title="Halo lumineux" body="Une lueur aux couleurs du thème autour de l’avatar." value={avatar?.halo === true} onChange={(halo) => style({ halo: halo || undefined })} />
          <ResetButton label="Réinitialiser l’avatar" scope="L’avatar Sprinter par défaut remplace votre avatar et ses réglages. Le reste du profil ne change pas." onReset={() => edit('avatar', null)} disabled={!avatar} />
        </>
      ) : null}
    </>
  );
}

function BannerPanel({ doc, edit, studio, onError }: PanelProps) {
  const banner = doc.banner as BannerPayload | null | undefined;
  const crop: Crop = { x: 0, y: 0, zoom: 1, ...banner?.crop };
  const gradient = banner?.source === 'gradient' && banner.colors ? banner.colors : null;
  const effects = Object.fromEntries(Object.entries(banner ?? {}).filter(([key]) => ['veil', 'particles'].includes(key)));
  const choose = (payload: Payload | null) => edit('banner', payload === null && !Object.keys(effects).length ? null : { ...(payload ?? { source: 'default' }), ...effects });
  const effect = (patch: { veil?: number; particles?: boolean }) => {
    const next = { ...(banner ?? { source: 'default' }), ...patch } as Payload;
    for (const key of Object.keys(next)) if (next[key] === undefined) delete next[key];
    edit('banner', next.source === 'default' && Object.keys(next).length === 1 ? null : next);
  };
  return (
    <>
      <PanelTitle title="Bannière" body="Image personnelle, visuel prédéfini, couleur unie ou dégradé." />
      <Button title="Importer une image" icon="image-outline" secondary onPress={() => void importProfileImage('banner', { current: banner as Payload | null }).then(onError).catch(() => onError('L’image n’a pas pu être importée.'))} />
      {studio ? <Button title="Importer un GIF animé" icon="film-outline" secondary onPress={() => void importProfileImage('banner', { animated: true, current: banner as Payload | null })
        .then(onError).catch(() => onError('Le GIF n’a pas pu être importé.'))} /> : null}
      {banner?.source === 'media' ? <CropControls crop={crop} label="Bannière" onChange={(next) => edit('banner', { ...banner, crop: next })} /> : null}
      <ChipRow label="Visuels prédéfinis">
        <Chip label="Bannière du thème" selected={!banner || banner.source === 'default'} onPress={() => choose(null)} />
        {BANNERS.map((item) => <Chip key={item.id} label={item.label} swatch={item.colors} selected={banner?.source === 'preset' && banner.presetId === item.id}
          onPress={() => choose({ source: 'preset', presetId: item.id })} />)}
      </ChipRow>
      <PanelTitle title="Couleur unie" />
      <ChipRow label="Couleur unie">
        {SWATCHES.map((color) => <Chip key={color} label={color} swatch={[color]} selected={banner?.source === 'color' && banner.colors?.[0] === color}
          onPress={() => choose({ source: 'color', colors: [color] })} />)}
      </ChipRow>
      <PanelTitle title="Dégradé" body={gradient ? `De ${gradient[0]} vers ${gradient[1]}. Touchez une couleur pour changer la seconde.` : 'Touchez deux couleurs : la première puis la seconde.'} />
      <ChipRow label="Dégradé">
        {SWATCHES.map((color) => <Chip key={color} label={color} swatch={[color]} selected={!!gradient?.includes(color)}
          onPress={() => choose({ source: 'gradient', colors: gradient ? [gradient[0]!, color] : [color, color === '#101011' ? '#5A5A5A' : '#101011'] })} />)}
      </ChipRow>
      {studio ? (
        <>
          <Copy variant="caption" muted>Voile pour la lisibilité : {Math.round((banner?.veil ?? 0) * 100)} %</Copy>
          <RangeSlider value={banner?.veil ?? 0} minimumValue={0} maximumValue={0.6} step={0.05} accessibilityLabel="Intensité du voile de la bannière"
            onSlidingComplete={(veil: number) => effect({ veil: veil > 0 ? Math.round(veil * 100) / 100 : undefined })} />
          <Toggle title="Particules" body="De petits points lumineux ; immobiles avec « Réduire les animations »." value={banner?.particles === true} onChange={(particles) => effect({ particles: particles || undefined })} />
          <ResetButton label="Réinitialiser la bannière" scope="La bannière du thème remplace votre bannière et ses effets. Le reste du profil ne change pas." onReset={() => edit('banner', null)} disabled={!banner} />
        </>
      ) : null}
    </>
  );
}

function InfoPanel({ doc, edit, studio }: PanelProps) {
  const name = (doc.identity as IdentityPayload | null | undefined)?.name ?? '';
  const about = (doc.about as AboutPayload | null | undefined) ?? {};
  const setAbout = (patch: Partial<AboutPayload>) => {
    const next = { ...about, ...patch } as Payload;
    for (const key of Object.keys(next)) if (!String(next[key] ?? '').trim()) delete next[key];
    edit('about', Object.keys(next).length ? next : null);
  };
  return (
    <>
      <PanelTitle title="Informations" body="Facultatives. Ce nom de présentation est distinct de votre nom de compte." />
      <DraftField label="Nom de présentation" value={name} max={LIMITS.name} onCommit={(value) => edit('identity', value.trim() ? { name: value } : null)} />
      <DraftField label="Présentation courte" value={about.bio ?? ''} max={LIMITS.bio} multiline onCommit={(bio) => setAbout({ bio })}
        placeholder="Quelques mots sur vous, vos objectifs, votre façon de courir." />
      {studio ? (
        <>
          <DraftField label="Citation" value={about.quote ?? ''} max={LIMITS.quote} onCommit={(quote) => setAbout({ quote })} />
          <DraftField label="Description longue" value={about.long ?? ''} max={LIMITS.long} multiline onCommit={(long) => setAbout({ long })}
            description="Paragraphes simples ; repliée sur petit écran" />
          <ResetButton label="Réinitialiser les informations" scope="Le nom de présentation, la présentation, la citation et la description longue sont effacés du brouillon."
            onReset={() => { edit('identity', null); edit('about', null); }} disabled={!doc.identity && !doc.about} />
        </>
      ) : null}
    </>
  );
}

function StatusPanel({ doc, edit, studio }: PanelProps) {
  const status = (doc.status as StatusPayload | null | undefined) ?? {};
  const templates = (doc.statuses as StatusesPayload | null | undefined)?.items ?? [];
  const [duration, setDuration] = useState<StatusDuration>('permanent');
  const commit = (patch: Partial<StatusPayload>) => {
    const next: StatusPayload = { ...status, ...patch };
    if (!next.emoji?.trim() && !next.text?.trim()) { edit('status', null); return; }
    if (!next.emoji) delete next.emoji;
    if (!next.text) delete next.text;
    edit('status', next as Payload);
  };
  const apply = (item: { emoji?: string; text?: string }) => {
    const next: StatusPayload = { ...item, expiresAt: statusExpiry(duration, Date.now()) };
    if (!next.expiresAt) delete next.expiresAt;
    edit('status', next as Payload);
  };
  return (
    <>
      <PanelTitle title="Statut" body="Texte ou emoji, permanent ou limité dans le temps : il disparaît seul à l’échéance, sur tous vos appareils." />
      <ChipRow label="Emoji">
        {EMOJIS.map((emoji) => <Chip key={emoji} label={emoji} selected={status.emoji === emoji} onPress={() => commit({ emoji: status.emoji === emoji ? undefined : emoji })} />)}
      </ChipRow>
      <DraftField label="Emoji personnalisé" value={status.emoji ?? ''} max={LIMITS.statusEmoji} onCommit={(value) => commit({ emoji: value.trim() || undefined })} />
      <DraftField label="Message" value={status.text ?? ''} max={LIMITS.statusText} onCommit={(value) => commit({ text: value.trim() ? value : undefined })} />
      <ChipRow label="Durée">
        {STATUS_DURATIONS.map((choice) => <Chip key={choice.value} label={choice.label} selected={duration === choice.value}
          onPress={() => { setDuration(choice.value); if (status.emoji || status.text) commit({ expiresAt: statusExpiry(choice.value, Date.now()) }); }} />)}
      </ChipRow>
      {studio ? (
        <>
          <PanelTitle title="Humeurs" body="Un geste pour un statut prêt à l’emploi, avec la durée choisie ci-dessus." />
          <ChipRow label="Humeurs">{MOODS.map((mood) => <Chip key={mood.label} role="button" label={`${mood.emoji} ${mood.label}`} onPress={() => apply({ emoji: mood.emoji, text: mood.label })} />)}</ChipRow>
          <PanelTitle title="Mes statuts enregistrés" body={`Jusqu’à ${LIMITS.statusTemplates} statuts réutilisables, gardés pour vous.`} />
          {templates.map((item, index) => (
            <ChipRow key={`${item.emoji ?? ''}${item.text ?? ''}${index}`}>
              <Chip role="button" label={`${item.emoji ?? ''} ${item.text ?? ''}`.trim()} onPress={() => apply(item)} />
              <Chip role="button" label="Retirer" icon="trash-outline" onPress={() => { const items = templates.filter((_, other) => other !== index); edit('statuses', items.length ? { items } : null); }} />
            </ChipRow>
          ))}
          <Button title="Enregistrer ce statut comme modèle" icon="bookmark-outline" secondary disabled={(!status.emoji && !status.text) || templates.length >= LIMITS.statusTemplates}
            onPress={() => edit('statuses', { items: [...templates, { ...(status.emoji ? { emoji: status.emoji } : {}), ...(status.text ? { text: status.text } : {}) }] })} />
        </>
      ) : null}
      <Button title="Effacer le statut" variant="quiet" icon="close-circle-outline" onPress={() => edit('status', null)} disabled={!status.emoji && !status.text} />
    </>
  );
}

function WidgetsPanel({ doc, edit, studio, media, onError }: PanelProps) {
  const order = orderedWidgets(doc);
  const [open, setOpen] = useState<string | null>(null);
  const setOrder = (next: string[]) => edit('layout', next.length ? { order: next } : null);
  const types: WidgetType[] = studio ? ['text', 'interests', 'stats', 'goal', 'gallery', 'links', 'mood', 'counter', 'favorites'] : ESSENTIAL_WIDGET_TYPES;
  const add = (type: WidgetType) => {
    const key = widgetKey(randomUUID());
    edit(key, { type, title: WIDGET_LABELS[type], ...(type === 'stats' ? { stats: ['runs', 'distance'] } : {}) });
    setOrder([...order, key]);
    setOpen(key);
  };
  const row = (key: string, index: number) => {
    const widget = doc[key] as unknown as WidgetPayload;
    const title = widget.title || WIDGET_LABELS[widget.type];
    return (
      <View style={{ gap: spacing.sm }}>
        <Copy variant="emphasis">{index + 1}. {title} · {WIDGET_LABELS[widget.type]}{studio ? ` · ${widget.size === 'wide' ? 'large' : 'compacte'}` : ''}</Copy>
        <ChipRow>
          <Chip role="button" label="Monter" icon="arrow-up" disabled={index === 0} onPress={() => setOrder(moveInOrder(order, key, -1))} />
          <Chip role="button" label="Descendre" icon="arrow-down" disabled={index === order.length - 1} onPress={() => setOrder(moveInOrder(order, key, 1))} />
          {studio ? <Chip role="button" label={widget.size === 'wide' ? 'Rendre compacte' : 'Rendre large'} icon="resize-outline"
            onPress={() => edit(key, { ...widget, size: widget.size === 'wide' ? 'compact' : 'wide' } as unknown as Payload)} /> : null}
          <Chip role="button" label={open === key ? 'Fermer' : 'Modifier'} icon="create-outline" onPress={() => setOpen(open === key ? null : key)} />
          <Chip role="button" label="Retirer" icon="trash-outline" onPress={() => { edit(key, null); setOrder(order.filter((item) => item !== key)); }} />
        </ChipRow>
        {open === key ? <WidgetForm widget={widget} media={media} onError={onError} onChange={(next) => edit(key, next as unknown as Payload)} /> : null}
      </View>
    );
  };
  return (
    <>
      <PanelTitle title="Widgets" body={`Ajoutez, configurez et ordonnez vos cartes (${order.length}/${LIMITS.widgets}). Sur petit écran, elles suivent cet ordre en colonne.`} />
      {studio ? <ReorderList keys={order} onReorder={setOrder} render={row} /> : order.map((key, index) => <View key={key}>{row(key, index)}</View>)}
      <ChipRow>
        {types.map((type) => <Chip key={type} role="button" label={`Ajouter : ${WIDGET_LABELS[type]}`} icon="add" disabled={order.length >= LIMITS.widgets} onPress={() => add(type)} />)}
      </ChipRow>
      {order.length >= LIMITS.widgets ? <Copy muted variant="caption">Huit widgets au plus : retirez-en un pour en ajouter un autre.</Copy> : null}
    </>
  );
}

function WidgetForm({ widget, onChange, media, onError }: { widget: WidgetPayload; onChange: (widget: WidgetPayload) => void; media: Record<string, MediaRef>; onError: (message: string | null) => void }) {
  const patch = (next: Partial<WidgetPayload>) => onChange({ ...widget, ...next });
  const essential = (
    <>
      <DraftField label="Titre de la carte" value={widget.title ?? ''} max={LIMITS.widgetTitle} onCommit={(title) => patch({ title: title || undefined })} />
      {widget.type === 'text' ? <DraftField label="Texte" multiline value={widget.text ?? ''} max={LIMITS.widgetText} onCommit={(text) => patch({ text: text || undefined })} /> : null}
      {widget.type === 'interests' ? (
        <DraftField label="Centres d’intérêt" value={(widget.tags ?? []).join(', ')} max={LIMITS.tags * (LIMITS.tagLength + 2)} description="Séparés par des virgules, 12 au plus"
          onCommit={(value) => patch({ tags: [...new Set(value.split(',').map((tag) => [...tag.trim()].slice(0, LIMITS.tagLength).join('')).filter(Boolean))].slice(0, LIMITS.tags) })} />
      ) : null}
      {widget.type === 'stats' ? (
        <ChipRow>
          {STAT_IDS.map((id) => {
            const selected = (widget.stats ?? []).includes(id);
            return <Chip key={id} role="checkbox" label={STAT_LABELS[id]} selected={selected}
              onPress={() => patch({ stats: selected ? (widget.stats ?? []).filter((item) => item !== id) : [...(widget.stats ?? []), id].slice(0, LIMITS.stats) })} />;
          })}
        </ChipRow>
      ) : null}
      {widget.type === 'stats' ? <Copy muted variant="caption">Valeurs calculées sur cet appareil à partir de vos courses Sprinter : elles restent privées.</Copy> : null}
    </>
  );
  return (
    <View style={{ gap: spacing.md }}>
      {essential}
      <AdvancedWidgetForm widget={widget} onChange={onChange} media={media} onError={onError} />
    </View>
  );
}
