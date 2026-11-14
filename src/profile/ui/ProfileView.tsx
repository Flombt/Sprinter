// Rendu d'un profil personnalisé (§17.3 à §17.5, §17.8) : bannière, avatar, nom, décorations, badges officiels,
// statut, présentation et widgets. Le contenu de l'utilisateur est rendu en texte et en éléments prédéfinis (§17.9).
// Sert à l'aperçu du studio, à « Mon profil » et, à partir de 8c, à la vue visiteur.
import { useEffect, useMemo, useRef, useState } from 'react';
import { Animated, Linking, Platform, Pressable, StyleSheet, Text, View, type LayoutChangeEvent, type TextStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { confirm } from '../../ui/confirm';
import { useTheme } from '../../ui/theme';
import { radii, spacing } from '../../ui/tokens';
import {
  AVATARS, BANNERS, DECORATION_ICONS, OFFICIAL_BADGE_ICON, PLATES, THEMES, readableOn, resolveAppearance, type ProfileTheme, type ResolvedAppearance,
} from '../catalog';
import {
  activeStatus, orderedWidgets, type AboutPayload, type AvatarPayload, type BannerPayload, type Crop, type DecorationsPayload, type IdentityPayload,
  type ProfileDoc, type StatId, type StatValue, type WidgetPayload, type BadgesPayload,
} from '../model';
import type { MediaRef } from '../profile';
import type { OfficialBadge } from '../sync';

export type Viewer = 'owner' | 'visitor';
export interface GoalValue { value: number; computed: boolean }

export function useProfileAppearance(doc: ProfileDoc): ResolvedAppearance {
  const { colors } = useTheme();
  return useMemo(() => resolveAppearance(doc.appearance as never, colors.dark, Platform.OS), [colors.dark, doc.appearance]);
}
/** Compatibilité 8a. */
export const useProfileTheme = (doc: ProfileDoc): ProfileTheme => useProfileAppearance(doc);

/** Image recadrée « couvrir » + zoom + déplacement. Une animation devient une image fixe si le mouvement est réduit. */
export function CroppedImage({ media, poster, width, height, crop, label }: {
  media: MediaRef; poster?: MediaRef; width: number; height: number; crop?: Partial<Crop>; label: string;
}) {
  const { reduceMotion } = useTheme();
  const still = reduceMotion && media.animated && poster;
  const shown = still ? poster : media;
  const zoom = crop?.zoom ?? 1, x = crop?.x ?? 0, y = crop?.y ?? 0;
  const scale = Math.max(width / shown.width, height / shown.height) * zoom;
  const shownWidth = shown.width * scale, shownHeight = shown.height * scale;
  const overflowX = (shownWidth - width) / 2, overflowY = (shownHeight - height) / 2;
  return (
    <View style={{ width, height, overflow: 'hidden' }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Image source={{ uri: shown.uri, headers: shown.headers }} placeholder={poster && !still ? { uri: poster.uri, headers: poster.headers } : undefined}
        autoplay={!reduceMotion} accessibilityIgnoresInvertColors cachePolicy={shown.headers ? 'memory' : 'disk'} contentFit="fill"
        style={{ position: 'absolute', width: shownWidth, height: shownHeight, left: -overflowX * (1 + x), top: -overflowY * (1 + y) }} />
    </View>
  );
}

/** Quelques points lumineux ; immobiles si le mouvement est réduit (§17.8). */
function Particles({ color, count = 10 }: { color: string; count?: number }) {
  const { reduceMotion } = useTheme();
  const drift = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (reduceMotion) return undefined;
    const loop = Animated.loop(Animated.timing(drift, { toValue: 1, duration: 6000, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [drift, reduceMotion]);
  const dots = useMemo(() => Array.from({ length: count }, (_, index) => ({ left: `${(index * 37) % 100}%`, top: `${(index * 53) % 90}%`, size: 3 + (index % 3) })), [count]);
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
      {dots.map((dot, index) => (
        <Animated.View key={index} style={{ position: 'absolute', left: dot.left as `${number}%`, top: dot.top as `${number}%`, width: dot.size, height: dot.size,
          borderRadius: dot.size, backgroundColor: color, opacity: 0.55,
          transform: [{ translateY: drift.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, index % 2 ? -6 : 6, 0] }) }] }} />
      ))}
    </View>
  );
}

export function BannerArt({ doc, media, theme, height = 132 }: { doc: ProfileDoc; media: Record<string, MediaRef>; theme: ProfileTheme; height?: number }) {
  const [width, setWidth] = useState(0);
  const banner = doc.banner as BannerPayload | null | undefined;
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const preset = banner?.source === 'preset' ? BANNERS.find((item) => item.id === banner.presetId) : undefined;
  const image = banner?.source === 'media' && banner.mediaId ? media[banner.mediaId] : undefined;
  const poster = banner?.posterId ? media[banner.posterId] : undefined;
  let content: React.ReactNode;
  if (image && width) content = <CroppedImage media={image} poster={poster} width={width} height={height} crop={banner?.crop} label="Bannière : image personnelle" />;
  else if (banner?.source === 'color' && banner.colors?.[0]) content = <View style={{ flex: 1, backgroundColor: banner.colors[0] }} />;
  else {
    const colors = (banner?.source === 'gradient' && banner.colors && banner.colors.length >= 2 ? banner.colors : preset?.colors ?? theme.banner) as [string, string, ...string[]];
    content = (
      <LinearGradient colors={colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={{ flex: 1, alignItems: 'flex-end', justifyContent: 'flex-end', padding: spacing.lg }}>
        {preset?.icon ? <Ionicons name={preset.icon} size={42} color={readableOn(colors[0], '#FFFFFF', 3)} style={{ opacity: 0.35 }} /> : null}
      </LinearGradient>
    );
  }
  const label = image ? undefined : preset ? `Bannière : ${preset.label}` : banner?.source === 'color' ? 'Bannière : couleur unie'
    : banner?.source === 'gradient' ? 'Bannière : dégradé' : 'Bannière du thème';
  return (
    <View onLayout={onLayout} style={{ height, borderTopLeftRadius: radii.card, borderTopRightRadius: radii.card, overflow: 'hidden', backgroundColor: theme.surface }}
      accessible={!image} accessibilityRole={image ? undefined : 'image'} accessibilityLabel={label}>
      {content}
      {banner?.veil ? <View pointerEvents="none" style={[StyleSheet.absoluteFill, { backgroundColor: '#000000', opacity: banner.veil }]} /> : null}
      {banner?.particles ? <Particles color="#FFFFFF" /> : null}
    </View>
  );
}

export function AvatarArt({ doc, media, theme, size = 96 }: { doc: ProfileDoc; media: Record<string, MediaRef>; theme: ProfileTheme; size?: number }) {
  const avatar = doc.avatar as AvatarPayload | null | undefined;
  const image = avatar?.source === 'media' && avatar.mediaId ? media[avatar.mediaId] : undefined;
  const poster = avatar?.posterId ? media[avatar.posterId] : undefined;
  const library = avatar?.source === 'library' ? AVATARS.find((item) => item.id === avatar.libraryId) : undefined;
  const radius = (side: number) => (avatar?.shape === 'square' ? 8 : avatar?.shape === 'rounded' ? side * 0.24 : side / 2);
  const frame = avatar?.frame ?? 'none';
  const ringWidth = frame === 'thick' ? 6 : frame === 'double' ? 7 : frame === 'gradient' ? 5 : frame === 'thin' ? 3 : 4;
  const outer = size + ringWidth * 2;
  const inner = { width: size, height: size, borderRadius: radius(size), overflow: 'hidden' as const };
  const colors = library?.colors ?? [theme.accent, theme.surface] as [string, string];
  const picture = image
    ? <View style={inner}><CroppedImage media={image} poster={poster} width={size} height={size} crop={avatar?.crop} label="Avatar : photo personnelle" /></View>
    : (
      <LinearGradient colors={colors} style={[inner, { alignItems: 'center', justifyContent: 'center' }]} accessible accessibilityRole="image"
        accessibilityLabel={library ? `Avatar : ${library.label}` : 'Avatar Sprinter par défaut'}>
        <Ionicons name={library?.icon ?? 'person'} size={size * 0.46} color={readableOn(colors[0], '#FFFFFF', 3)} />
      </LinearGradient>
    );
  const ring = { width: outer, height: outer, borderRadius: radius(outer), alignItems: 'center' as const, justifyContent: 'center' as const };
  const halo = avatar?.halo ? { shadowColor: theme.accent, shadowOpacity: 0.8, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 10 } : {};
  if (frame === 'gradient') return <LinearGradient colors={[theme.accent, theme.banner[1]]} style={[ring, halo]}>{picture}</LinearGradient>;
  const border = frame === 'none' ? { backgroundColor: theme.background }
    : { backgroundColor: theme.background, borderWidth: frame === 'double' ? 2 : ringWidth - 1, borderColor: theme.accent };
  return (
    <View style={[ring, border, halo]}>
      {frame === 'double' ? <View style={{ ...ring, width: outer - 6, height: outer - 6, borderRadius: radius(outer - 6), borderWidth: 2, borderColor: theme.accent }}>{picture}</View> : picture}
    </View>
  );
}

function expiryLabel(expiresAt: string | null | undefined, now: number) {
  if (!expiresAt) return null;
  const at = new Date(expiresAt);
  const sameDay = new Date(now).toDateString() === at.toDateString();
  return sameDay ? `jusqu’à ${at.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' })}`
    : `jusqu’au ${at.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}`;
}
const domainOf = (url: string) => { try { return new URL(url).hostname; } catch { return url; } };

function Collapsible({ text, style, limit = 280 }: { text: string; style: TextStyle[]; limit?: number }) {
  const [open, setOpen] = useState(false);
  const long = text.length > limit;
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={style} numberOfLines={long && !open ? 6 : undefined}>{text}</Text>
      {long ? <Text style={[...style, { fontWeight: '700', textDecorationLine: 'underline' }]} accessibilityRole="button" onPress={() => setOpen(!open)}>
        {open ? 'Afficher moins' : 'Afficher plus'}</Text> : null}
    </View>
  );
}

export function ProfileView({ doc, media, stats, goal, badges = [], viewer = 'owner', wide = false, now = Date.now() }: {
  doc: ProfileDoc; media: Record<string, MediaRef>; stats: (ids: StatId[]) => StatValue[]; goal?: (widget: WidgetPayload) => GoalValue;
  badges?: OfficialBadge[]; viewer?: Viewer; wide?: boolean; now?: number;
}) {
  const theme = useProfileAppearance(doc);
  const { reduceMotion } = useTheme();
  const decorations = (doc.decorations as DecorationsPayload | null | undefined) ?? {};
  const entry = useRef(new Animated.Value(decorations.entry && decorations.entry !== 'none' && !reduceMotion ? 0 : 1)).current;
  useEffect(() => { Animated.timing(entry, { toValue: 1, duration: 450, useNativeDriver: true }).start(); }, [entry]);
  const name = (doc.identity as IdentityPayload | null | undefined)?.name?.trim();
  const about = (doc.about as AboutPayload | null | undefined) ?? {};
  const status = activeStatus(doc.status, now);
  const shown = new Set((doc.badges as BadgesPayload | null | undefined)?.show ?? []);
  const official = badges.filter((badge) => shown.has(badge.id));
  const font = theme.fontFamily ? { fontFamily: theme.fontFamily } : null;
  const text: TextStyle = { color: theme.text, ...font };
  const muted: TextStyle = { color: theme.muted, ...font };
  const tagRadius = theme.buttons === 'square' ? 4 : theme.buttons === 'rounded' ? 10 : radii.pill;
  const icon = DECORATION_ICONS.find((item) => item.id === decorations.icon);
  const plate = PLATES.find((item) => item.id === decorations.plate);
  const card = (key: string, children: React.ReactNode, wideCard: boolean) => {
    const background = decorations.card === 'teinte' ? { backgroundColor: theme.surface, borderColor: theme.accent }
      : { backgroundColor: theme.surface, borderColor: theme.line };
    const relief = theme.cards === 'raised' ? { shadowColor: '#000000', shadowOpacity: 0.18, shadowRadius: 8, shadowOffset: { width: 0, height: 3 }, elevation: 3 } : {};
    return (
      <View key={key} style={[styles.card, background, relief, { borderWidth: theme.cards === 'flat' ? 0 : StyleSheet.hairlineWidth, flexBasis: wideCard ? '100%' : '47%', flexGrow: 1 }]}>
        {decorations.card === 'degrade' ? <LinearGradient pointerEvents="none" colors={[theme.surface, theme.accent]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}
          style={[StyleSheet.absoluteFill, { opacity: 0.12, borderRadius: radii.control }]} /> : null}
        {children}
      </View>
    );
  };
  const provenance = (computed: boolean) => (
    <View style={styles.provenance} accessible accessibilityLabel={computed ? 'Donnée calculée par Sprinter' : viewer === 'owner' ? 'Valeur saisie par vous' : 'Valeur saisie par le membre'}>
      <Ionicons name={computed ? 'analytics-outline' : 'create-outline'} size={14} color={theme.muted} />
      <Text style={[styles.small, muted]}>{computed ? 'Donnée Sprinter' : viewer === 'owner' ? 'Saisi par vous' : 'Saisi par le membre'}</Text>
    </View>
  );
  const widgets = orderedWidgets(doc).map((key) => {
    const widget = doc[key] as unknown as WidgetPayload;
    const isWide = !wide || widget.size === 'wide';
    const title = widget.title ? <Text style={[styles.cardTitle, text]} accessibilityRole="header">{widget.title}</Text> : null;
    const empty = (message: string) => (viewer === 'owner' ? card(key, <>{title}<Text style={[styles.body, muted]}>{message}</Text></>, isWide) : null);
    switch (widget.type) {
      case 'text': return widget.text ? card(key, <>{title}<Collapsible text={widget.text} style={[styles.body, text]} /></>, isWide) : empty('Texte à compléter.');
      case 'interests': return widget.tags?.length ? card(key, <>{title}<View style={styles.tags}>{widget.tags.map((tag) => (
        <Text key={tag} style={[styles.tag, { color: theme.accentInk, backgroundColor: theme.accent, borderRadius: tagRadius }, font]}>{tag}</Text>))}</View></>, isWide)
        : empty('Ajoutez vos centres d’intérêt.');
      case 'stats': {
        // Version publiée : valeurs confirmées par le titulaire (valeur, libellé, période) ; sinon calcul local.
        const published = (widget as { values?: { id: StatId; label: string; value: string; period?: string }[] }).values;
        const values = published ? published.map((value) => ({ ...value, definition: value.period ?? '' })) : stats(widget.stats ?? []);
        const none = values.every((value) => value.value === '—' || value.value === '0' || value.value === '0 km');
        return card(key, <>
          {title}
          {values.map((stat) => (
            <View key={stat.id} style={styles.statRow} accessible accessibilityLabel={`${stat.label} : ${stat.value}, donnée calculée par Sprinter`} accessibilityHint={stat.definition}>
              <Text style={[styles.body, muted]}>{stat.label}</Text>
              <Text style={[styles.statValue, text]}>{stat.value}</Text>
            </View>
          ))}
          {none ? <Text style={[styles.small, muted]}>Pas encore de course Sprinter enregistrée sur cet appareil.</Text> : null}
          {provenance(true)}
          {viewer === 'owner' && !published ? <Text style={[styles.small, muted]}>Calculé sur cet appareil · visible par vous seul</Text> : null}
        </>, isWide);
      }
      case 'goal': {
        if (!widget.target) return empty('Objectif à définir.');
        const progress = viewer === 'visitor' || !goal ? { value: widget.progress ?? 0, computed: (widget as { computed?: boolean }).computed === true } : goal(widget);
        const ratio = Math.max(0, Math.min(1, progress.value / widget.target));
        const unit = widget.unit === 'autre' ? '' : ` ${widget.unit ?? 'km'}`;
        return card(key, <>
          {title}
          {widget.label ? <Text style={[styles.body, text]}>{widget.label}</Text> : null}
          <View style={[styles.bar, { backgroundColor: theme.line }]} accessible accessibilityRole="progressbar"
            accessibilityValue={{ min: 0, max: 100, now: Math.round(ratio * 100) }} accessibilityLabel={`Progression : ${progress.value.toLocaleString('fr-FR')} sur ${widget.target.toLocaleString('fr-FR')}${unit}`}>
            <View style={{ width: `${ratio * 100}%`, height: '100%', backgroundColor: theme.accent, borderRadius: radii.pill }} />
          </View>
          <Text style={[styles.small, muted]}>{progress.value.toLocaleString('fr-FR')} / {widget.target.toLocaleString('fr-FR')}{unit}</Text>
          {provenance(progress.computed)}
        </>, isWide);
      }
      case 'gallery': {
        const images = (widget.images ?? []).filter((image) => media[image.mediaId]);
        if (!images.length) return empty('Galerie vide : ajoutez jusqu’à 5 images.');
        return card(key, <>{title}<View style={styles.gallery}>{images.map((image) => (
          <Image key={image.mediaId} source={{ uri: media[image.mediaId]!.uri, headers: media[image.mediaId]!.headers }} style={styles.thumb} contentFit="cover"
            cachePolicy={media[image.mediaId]!.headers ? 'memory' : 'disk'} autoplay={!reduceMotion} accessible accessibilityLabel={image.alt} />))}</View></>, isWide);
      }
      case 'links': {
        if (!widget.links?.length) return empty('Ajoutez des liens HTTPS.');
        return card(key, <>{title}{widget.links.map((link) => (
          <Pressable key={link.url} accessibilityRole="link" accessibilityLabel={`${link.label || domainOf(link.url)}, ouvre ${domainOf(link.url)}`}
            onPress={() => confirm('Ouvrir ce lien ?', `Vous allez quitter Sprinter pour ${domainOf(link.url)}.`, 'Ouvrir', () => void Linking.openURL(link.url))}
            style={styles.link}>
            <Ionicons name="open-outline" size={16} color={theme.accent} />
            <View style={{ flex: 1 }}>
              <Text style={[styles.body, text, { fontWeight: '600' }]}>{link.label || domainOf(link.url)}</Text>
              <Text style={[styles.small, muted]}>{domainOf(link.url)}</Text>
            </View>
          </Pressable>))}</>, isWide);
      }
      case 'mood': return widget.emoji || widget.message ? card(key, <>{title}<View style={styles.statRow}>
        {widget.emoji ? <Text style={{ fontSize: 30 }}>{widget.emoji}</Text> : null}
        {widget.message ? <Text style={[styles.body, text, { flex: 1 }]}>{widget.message}</Text> : null}</View></>, isWide) : empty('Choisissez une humeur du jour.');
      case 'counter': return widget.value === undefined ? empty('Valeur à saisir.') : card(key, <>
        {title}
        <View style={styles.statRow} accessible accessibilityLabel={`${widget.label ?? 'Compteur'} : ${widget.value} ${widget.unit ?? ''}, ${viewer === 'owner' ? 'saisi par vous' : 'saisi par le membre'}`}>
          <Text style={[styles.body, muted]}>{widget.label ?? 'Compteur'}</Text>
          <Text style={[styles.statValue, text]}>{widget.value.toLocaleString('fr-FR')}{widget.unit ? ` ${widget.unit}` : ''}</Text>
        </View>
        {provenance(false)}
      </>, isWide);
      case 'favorites': {
        const items = (widget.items ?? []).map((item) => (item.kind === 'theme' ? THEMES.find((theme_) => theme_.id === item.id)?.label
          : item.kind === 'avatar' ? AVATARS.find((avatar) => avatar.id === item.id)?.label : BANNERS.find((banner) => banner.id === item.id)?.label)).filter(Boolean) as string[];
        return items.length ? card(key, <>{title}<View style={styles.tags}>{items.map((label) => (
          <Text key={label} style={[styles.tag, { color: theme.text, borderColor: theme.accent, borderWidth: 1, borderRadius: tagRadius }, font]}>{label}</Text>))}</View></>, isWide)
          : empty('Choisissez vos favoris.');
      }
      default: return null;
    }
  });
  const slide = decorations.entry === 'slide' ? [{ translateY: entry.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }] : [];
  return (
    <Animated.View style={[styles.page, { backgroundColor: theme.background, borderColor: theme.frame ? theme.accent : theme.line, borderWidth: theme.frame ? 2 : StyleSheet.hairlineWidth,
      opacity: entry, transform: slide }]}>
      <BannerArt doc={doc} media={media} theme={theme} />
      <View style={styles.identity}>
        <View style={styles.avatarSlot}><AvatarArt doc={doc} media={media} theme={theme} /></View>
        <View style={[styles.nameRow, plate ? { alignSelf: 'flex-start' } : null]}>
          {plate ? <LinearGradient colors={plate.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={[StyleSheet.absoluteFill, { borderRadius: radii.control, opacity: 0.35 }]} /> : null}
          <Text style={[styles.name, text, plate ? { paddingHorizontal: spacing.sm } : null]} accessibilityRole="header" maxFontSizeMultiplier={2}>{name || 'Profil Sprinter'}</Text>
        </View>
        {decorations.title || icon ? (
          <View style={[styles.decoration, { borderColor: theme.line, borderRadius: tagRadius }]} accessible accessibilityLabel={`Décoration choisie : ${[icon?.label, decorations.title].filter(Boolean).join(', ')}`}>
            {icon ? <Ionicons name={icon.icon} size={14} color={theme.secondary} /> : null}
            {decorations.title ? <Text style={[styles.small, text]}>{decorations.title}</Text> : null}
          </View>
        ) : null}
        {official.length ? (
          <View style={styles.tags}>
            {official.map((badge) => (
              <View key={badge.id} style={[styles.badge, { backgroundColor: theme.accent }]} accessible accessibilityLabel={`Badge officiel attribué par Sprinter : ${badge.label}`}
                accessibilityHint={badge.criteria}>
                <Ionicons name={OFFICIAL_BADGE_ICON} size={14} color={theme.accentInk} />
                <Text style={[styles.small, { color: theme.accentInk, fontWeight: '700' }]}>{badge.label}</Text>
              </View>
            ))}
          </View>
        ) : null}
        {status ? (
          <View style={[styles.status, { backgroundColor: theme.surface, borderColor: theme.line, borderRadius: tagRadius }]} accessible
            accessibilityLabel={`Statut : ${[status.emoji, status.text].filter(Boolean).join(' ')}${status.expiresAt ? `, ${expiryLabel(status.expiresAt, now)}` : ''}`}>
            {status.emoji ? <Text style={styles.statusEmoji}>{status.emoji}</Text> : null}
            {status.text ? <Text style={[styles.body, text]}>{status.text}</Text> : null}
            {status.expiresAt ? <Text style={[styles.small, muted]}>· {expiryLabel(status.expiresAt, now)}</Text> : null}
          </View>
        ) : null}
        {about.bio?.trim() ? <Text style={[styles.body, text]}>{about.bio.trim()}</Text> : null}
        {about.quote?.trim() ? <Text style={[styles.body, muted, { fontStyle: 'italic' }]}>« {about.quote.trim()} »</Text> : null}
        {about.long?.trim() ? <Collapsible text={about.long.trim()} style={[styles.body, text]} /> : null}
      </View>
      <View style={[styles.widgets, wide ? styles.widgetsWide : null]}>{widgets}</View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  page: { borderRadius: radii.card, overflow: 'hidden', paddingBottom: spacing.lg, gap: spacing.md },
  identity: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  avatarSlot: { marginTop: -56 },
  nameRow: { justifyContent: 'center' },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  decoration: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, borderWidth: 1, borderStyle: 'dashed', paddingHorizontal: spacing.sm, paddingVertical: 2 },
  badge: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs, borderRadius: radii.sm, paddingHorizontal: spacing.sm, paddingVertical: 3 },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, borderWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  statusEmoji: { fontSize: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  widgets: { paddingHorizontal: spacing.lg, gap: spacing.md },
  widgetsWide: { flexDirection: 'row', flexWrap: 'wrap' },
  card: { borderRadius: radii.control, padding: spacing.lg, gap: spacing.sm, overflow: 'hidden' },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { fontSize: 14, lineHeight: 20, fontWeight: '600', paddingHorizontal: spacing.md, paddingVertical: spacing.xs, overflow: 'hidden' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.md },
  statValue: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
  provenance: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  bar: { height: 10, borderRadius: radii.pill, overflow: 'hidden' },
  gallery: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  thumb: { width: 92, height: 92, borderRadius: radii.sm },
  link: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm, minHeight: 44 },
});
