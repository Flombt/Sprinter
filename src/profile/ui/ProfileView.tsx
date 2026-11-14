// Rendu d'un profil personnalisé (§17.3 à §17.5) : bannière, avatar, nom, statut, présentation et widgets.
// Le contenu de l'utilisateur est rendu en texte et en éléments prédéfinis uniquement (§17.9).
// Sert à l'aperçu du studio, à « Mon profil » et, à partir de 8c, à la vue visiteur.
import { useState } from 'react';
import { Image, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../ui/theme';
import { radii, spacing } from '../../ui/tokens';
import { AVATARS, BANNERS, readableOn, resolveTheme, type ProfileTheme } from '../catalog';
import {
  activeStatus, orderedWidgets, type AboutPayload, type AppearancePayload, type AvatarPayload, type BannerPayload, type Crop,
  type IdentityPayload, type ProfileDoc, type StatId, type StatValue, type WidgetPayload,
} from '../model';
import type { MediaRef } from '../profile';

export function useProfileTheme(doc: ProfileDoc): ProfileTheme {
  const { colors, lightColors } = useTheme();
  const appearance = doc.appearance as AppearancePayload | null | undefined;
  return resolveTheme(appearance?.theme, appearance?.accent, colors.background !== lightColors.background);
}

/** Image recadrée « couvrir » + zoom + déplacement, sans réimporter le média (§17.2). */
export function CroppedImage({ media, width, height, crop, label }: { media: MediaRef; width: number; height: number; crop?: Partial<Crop>; label: string }) {
  const zoom = crop?.zoom ?? 1, x = crop?.x ?? 0, y = crop?.y ?? 0;
  const scale = Math.max(width / media.width, height / media.height) * zoom;
  const shownWidth = media.width * scale, shownHeight = media.height * scale;
  const overflowX = (shownWidth - width) / 2, overflowY = (shownHeight - height) / 2;
  return (
    <View style={{ width, height, overflow: 'hidden' }} accessible accessibilityRole="image" accessibilityLabel={label}>
      <Image source={{ uri: media.uri }} accessibilityIgnoresInvertColors
        style={{ position: 'absolute', width: shownWidth, height: shownHeight, left: -overflowX * (1 + x), top: -overflowY * (1 + y) }} />
    </View>
  );
}

export function BannerArt({ doc, media, theme, height = 132 }: { doc: ProfileDoc; media: Record<string, MediaRef>; theme: ProfileTheme; height?: number }) {
  const [width, setWidth] = useState(0);
  const banner = doc.banner as BannerPayload | null | undefined;
  const onLayout = (event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width);
  const preset = banner?.source === 'preset' ? BANNERS.find((item) => item.id === banner.presetId) : undefined;
  const image = banner?.source === 'media' && banner.mediaId ? media[banner.mediaId] : undefined;
  let content: React.ReactNode;
  if (image && width) content = <CroppedImage media={image} width={width} height={height} crop={banner?.crop} label="Bannière : image personnelle" />;
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
    </View>
  );
}

export function AvatarArt({ doc, media, theme, size = 96 }: { doc: ProfileDoc; media: Record<string, MediaRef>; theme: ProfileTheme; size?: number }) {
  const avatar = doc.avatar as AvatarPayload | null | undefined;
  const image = avatar?.source === 'media' && avatar.mediaId ? media[avatar.mediaId] : undefined;
  const library = avatar?.source === 'library' ? AVATARS.find((item) => item.id === avatar.libraryId) : undefined;
  const ring = { width: size + 8, height: size + 8, borderRadius: (size + 8) / 2, backgroundColor: theme.background, alignItems: 'center' as const, justifyContent: 'center' as const };
  const inner = { width: size, height: size, borderRadius: size / 2, overflow: 'hidden' as const };
  if (image) return <View style={ring}><View style={inner}><CroppedImage media={image} width={size} height={size} crop={avatar?.crop} label="Avatar : photo personnelle" /></View></View>;
  const colors = library?.colors ?? [theme.accent, theme.surface] as [string, string];
  return (
    <View style={ring}>
      <LinearGradient colors={colors} style={[inner, { alignItems: 'center', justifyContent: 'center' }]} accessible accessibilityRole="image"
        accessibilityLabel={library ? `Avatar : ${library.label}` : 'Avatar Sprinter par défaut'}>
        <Ionicons name={library?.icon ?? 'person'} size={size * 0.46} color={readableOn(colors[0], '#FFFFFF', 3)} />
      </LinearGradient>
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

export function ProfileView({ doc, media, stats, now = Date.now(), privateNote = true }: {
  doc: ProfileDoc; media: Record<string, MediaRef>; stats: (ids: StatId[]) => StatValue[]; now?: number; privateNote?: boolean;
}) {
  const theme = useProfileTheme(doc);
  const name = (doc.identity as IdentityPayload | null | undefined)?.name?.trim();
  const bio = (doc.about as AboutPayload | null | undefined)?.bio?.trim();
  const status = activeStatus(doc.status, now);
  const widgets = orderedWidgets(doc);
  const text = { color: theme.text };
  const muted = { color: theme.muted };
  return (
    <View style={[styles.page, { backgroundColor: theme.background, borderColor: theme.line }]}>
      <BannerArt doc={doc} media={media} theme={theme} />
      <View style={styles.identity}>
        <View style={styles.avatarSlot}><AvatarArt doc={doc} media={media} theme={theme} /></View>
        <Text style={[styles.name, text]} accessibilityRole="header" maxFontSizeMultiplier={2}>{name || 'Profil Sprinter'}</Text>
        {status ? (
          <View style={[styles.status, { backgroundColor: theme.surface, borderColor: theme.line }]} accessible
            accessibilityLabel={`Statut : ${[status.emoji, status.text].filter(Boolean).join(' ')}${status.expiresAt ? `, ${expiryLabel(status.expiresAt, now)}` : ''}`}>
            {status.emoji ? <Text style={styles.statusEmoji}>{status.emoji}</Text> : null}
            {status.text ? <Text style={[styles.body, text]}>{status.text}</Text> : null}
            {status.expiresAt ? <Text style={[styles.small, muted]}>· {expiryLabel(status.expiresAt, now)}</Text> : null}
          </View>
        ) : null}
        {bio ? <Text style={[styles.body, text]}>{bio}</Text> : null}
      </View>
      {widgets.map((key) => {
        const widget = doc[key] as unknown as WidgetPayload;
        return (
          <View key={key} style={[styles.card, { backgroundColor: theme.surface, borderColor: theme.line }]}>
            {widget.title ? <Text style={[styles.cardTitle, text]} accessibilityRole="header">{widget.title}</Text> : null}
            {widget.type === 'text' && widget.text ? <Text style={[styles.body, text]}>{widget.text}</Text> : null}
            {widget.type === 'interests' ? (
              <View style={styles.tags}>
                {(widget.tags ?? []).map((tag) => (
                  <Text key={tag} style={[styles.tag, { color: theme.accentInk, backgroundColor: theme.accent }]}>{tag}</Text>
                ))}
              </View>
            ) : null}
            {widget.type === 'stats' ? (
              <View style={{ gap: spacing.sm }}>
                {stats(widget.stats ?? []).map((stat) => (
                  <View key={stat.id} style={styles.statRow} accessible accessibilityLabel={`${stat.label} : ${stat.value}`} accessibilityHint={stat.definition}>
                    <Text style={[styles.body, muted]}>{stat.label}</Text>
                    <Text style={[styles.statValue, text]}>{stat.value}</Text>
                  </View>
                ))}
                {privateNote ? <Text style={[styles.small, muted]}>Calculé sur cet appareil · visible par vous seul</Text> : null}
              </View>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { borderRadius: radii.card, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden', paddingBottom: spacing.lg, gap: spacing.md },
  identity: { paddingHorizontal: spacing.lg, gap: spacing.sm },
  avatarSlot: { marginTop: -56 },
  name: { fontSize: 24, lineHeight: 30, fontWeight: '700' },
  status: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', alignSelf: 'flex-start', gap: spacing.xs, borderWidth: StyleSheet.hairlineWidth,
    borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs },
  statusEmoji: { fontSize: 18 },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 18 },
  card: { marginHorizontal: spacing.lg, borderRadius: radii.control, borderWidth: StyleSheet.hairlineWidth, padding: spacing.lg, gap: spacing.sm },
  cardTitle: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  tags: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  tag: { fontSize: 14, lineHeight: 20, fontWeight: '600', borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: spacing.xs, overflow: 'hidden' },
  statRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.md },
  statValue: { fontSize: 17, lineHeight: 24, fontWeight: '700' },
});
