import { useState, type ReactNode } from 'react';
import { Image, type ImageSource } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import type { DiscoveryItem } from '../../supabase/functions/_shared/discovery-model';
import { Copy, Icon, Label, SectionHeading, type IconName } from '../ui/components';
import { PhotoCover } from '../ui/editorial';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { interaction, layout, radii, spacing } from '../ui/tokens';
import { dayLabel, kindTitle, kmLabel, scheduleLabel, terrainTitle, verifiedRegistration } from './catalog';
import { parisDay } from '../../supabase/functions/_shared/discovery-model';
import { itemIcon } from './mapCanvasProps';

interface Photo {
  asset: ImageSource;
  caption: string;
  author: string;
  source: string;
  license: 'CC BY-SA 4.0' | 'CC BY-SA 3.0';
  licenseUrl: string;
}
const photos: Record<string, Photo> = {
  promenade: {
    asset: require('../../assets/discovery/promenade.webp'),
    caption: 'La Promenade des Anglais',
    author: 'Uhooep',
    source: 'https://commons.wikimedia.org/wiki/File:Promenade_des_Anglais_(Nice),_France.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  villefranche: {
    asset: require('../../assets/discovery/villefranche.webp'),
    caption: 'Le port de la Santé à Villefranche-sur-Mer',
    author: 'JChevall',
    source: 'https://commons.wikimedia.org/wiki/File:Vue_g%C3%A9n%C3%A9rale_de_Villefranche_sur_Mer.jpg',
    license: 'CC BY-SA 4.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/4.0/',
  },
  gairaut: {
    asset: require('../../assets/discovery/gairaut.webp'),
    caption: 'La cascade de Gairaut, près du sentier',
    author: 'Kheper',
    source: 'https://commons.wikimedia.org/wiki/File:Cascade_de_Gairaut_vue_d%27ensemble.jpg',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
  vence: {
    asset: require('../../assets/discovery/vence.webp'),
    caption: 'Vence et la Méditerranée au loin',
    author: 'Myrabella',
    source: 'https://commons.wikimedia.org/wiki/File:Vence.jpg',
    license: 'CC BY-SA 3.0',
    licenseUrl: 'https://creativecommons.org/licenses/by-sa/3.0/',
  },
};
export const photoFor = (item: DiscoveryItem) =>
  item.mediaKey && Object.hasOwn(photos, item.mediaKey) ? photos[item.mediaKey] : undefined;

export function DiscoveryArt({
  item,
  children,
  style,
  compact = false,
}: {
  item: DiscoveryItem;
  children?: ReactNode;
  style?: React.ComponentProps<typeof View>['style'];
  compact?: boolean;
}) {
  const { colors, reduceMotion, reduceTransparency } = useTheme();
  const [failed, setFailed] = useState<string>();
  const photo = failed === item.id ? undefined : photoFor(item);
  const tone =
    item.kind === 'race' ? colors.warning.soft : item.kind === 'club' ? colors.accentSoft : colors.field;
  return (
    <View style={[styles.art, { backgroundColor: tone }, style]}>
      {photo ? (
        <Image
          source={photo.asset}
          recyclingKey={item.id}
          contentFit="cover"
          cachePolicy="memory-disk"
          accessible={false}
          transition={reduceMotion ? 0 : 160}
          style={StyleSheet.absoluteFill}
          onError={() => setFailed(item.id)}
        />
      ) : (
        <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, styles.artCenter]}>
          {!compact &&
            [0, 1, 2].map((index) => (
              <View
                key={index}
                style={{
                  position: 'absolute',
                  width: 150 + index * 38,
                  height: 95 + index * 27,
                  right: -34 - index * 6,
                  top: -21 + index * 4,
                  transform: [{ rotate: '-22deg' }],
                  borderRadius: 90,
                  borderColor: colors.controlLine,
                  borderWidth: 1,
                }}
              />
            ))}
          <Icon name={itemIcon[item.kind]} size={compact ? 21 : 42} color={colors.text} />
        </View>
      )}
      {children && (
        <>
          <LinearGradient
            pointerEvents="none"
            colors={
              reduceTransparency
                ? ['transparent', 'rgba(11,16,19,0.98)', 'rgba(11,16,19,1)']
                : ['rgba(11,16,19,0.04)', 'rgba(11,16,19,0.64)', 'rgba(11,16,19,0.97)']
            }
            locations={[0, 0.54, 1]}
            style={StyleSheet.absoluteFill}
          />
          {children}
        </>
      )}
    </View>
  );
}

export function Chip({
  title,
  selected,
  onPress,
  icon,
  accessibilityLabel,
  disabled = false,
}: {
  title: string;
  selected?: boolean;
  onPress: () => void;
  icon?: IconName;
  accessibilityLabel?: string;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      accessibilityState={{ selected, disabled }}
      disabled={disabled}
      style={({ pressed }) => [
        styles.chip,
        {
          borderColor: selected ? colors.accent : colors.controlLine,
          backgroundColor: selected ? colors.accent : colors.surface,
          opacity: disabled ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1,
        },
      ]}
    >
      {icon && <Icon size={16} name={icon} color={selected ? colors.accentInk : colors.secondary} />}
      <Copy
        variant="caption"
        style={{ color: selected ? colors.accentInk : colors.text, flexShrink: 1, fontWeight: '600' }}
      >
        {title}
      </Copy>
    </Pressable>
  );
}

export function ChipRow({ children, label }: { children: ReactNode; label?: string }) {
  const { largeText } = useAdaptiveLayout();
  if (largeText) return <View style={styles.wrap}>{children}</View>;
  return (
    <ScrollView
      horizontal
      accessibilityLabel={label}
      keyboardShouldPersistTaps="handled"
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.row}
    >
      {children}
    </ScrollView>
  );
}

export function Feature({ item, onPress }: { item: DiscoveryItem; onPress: () => void }) {
  const race = item.kind === 'race';
  return (
    <PhotoCover
      title={item.title}
      eyebrow={race ? 'Course à la une' : kindTitle[item.kind]}
      detail={[
        race ? scheduleLabel(item, true) : item.setting,
        item.city,
        item.distancesKm?.map(kmLabel).join(' / '),
      ]
        .filter(Boolean)
        .join(' · ')}
      height={242}
      source={photoFor(item)?.asset}
      position={{ left: '53%', top: '58%' }}
      onPress={onPress}
    />
  );
}

export function statusLabel(item: DiscoveryItem, now: number): string | undefined {
  if (item.state === 'cancelled') return 'Annulé';
  if (item.state === 'postponed') return 'Reporté';
  if (item.state === 'stale') return 'Informations à revérifier';
  const registration = verifiedRegistration(item, now, parisDay(now));
  if (registration?.state === 'open') return 'Inscriptions ouvertes';
  if (registration?.state === 'sold_out') return 'Complet';
  if (registration?.state === 'closed') return 'Inscriptions closes';
}

export function ResultRow({
  item,
  onPress,
  saved,
  text,
}: {
  item: DiscoveryItem;
  onPress: () => void;
  saved?: boolean;
  text?: string;
}) {
  const { colors } = useTheme();
  const meta =
    text ??
    [item.schedule ? scheduleLabel(item, true) : (item.setting ?? kindTitle[item.kind]), item.city].join(
      ' · ',
    );
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`${item.title}, ${meta}${saved ? ', en favori' : ''}`}
      onPress={onPress}
      style={({ pressed }) => [
        styles.result,
        {
          borderColor: colors.line,
          opacity: pressed ? interaction.pressedOpacity : 1,
        },
      ]}
    >
      <DiscoveryArt item={item} compact style={{ width: 58, height: 58, borderRadius: radii.control }} />
      <View style={{ flex: 1, minWidth: 0, gap: 3 }}>
        <Copy variant="emphasis">{item.title}</Copy>
        <Copy muted variant="caption">
          {meta}
        </Copy>
      </View>
      <Icon
        name={saved ? 'heart' : 'chevron-forward'}
        color={saved ? colors.accentText : colors.secondary}
        size={17}
      />
    </Pressable>
  );
}

export function RaceTile({ item, now, onPress }: { item: DiscoveryItem; now: number; onPress: () => void }) {
  const { colors } = useTheme();
  const state = statusLabel(item, now);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.tile,
        {
          backgroundColor: colors.surface,
          borderColor: colors.line,
          opacity: pressed ? interaction.pressedOpacity : 1,
        },
      ]}
    >
      <DiscoveryArt item={item} style={{ height: 112, borderRadius: 0 }} />
      <View style={{ padding: spacing.lg, gap: spacing.xs }}>
        <Label style={{ color: colors.accentText }}>
          {scheduleLabel(item, true)} · {item.city}
        </Label>
        <Copy variant="heading">{item.title}</Copy>
        <Copy muted variant="caption">
          {[item.distancesKm?.map(kmLabel).join(' / '), item.terrain && terrainTitle[item.terrain], state]
            .filter(Boolean)
            .join(' · ') || 'Voir le programme'}
        </Copy>
        <Copy muted variant="small">
          {item.sources[0]?.name}
        </Copy>
      </View>
    </Pressable>
  );
}

export function DiscoverySection({
  title,
  action,
  onPress,
  children,
}: {
  title: string;
  action?: string;
  onPress?: () => void;
  children: ReactNode;
}) {
  return (
    <View style={{ gap: spacing.md }}>
      <SectionHeading editorial title={title} action={action} onPress={onPress} />
      {children}
    </View>
  );
}

export function CatalogueNotice({
  offline,
  syncing,
  feedError,
  loadedAt,
  refresh,
}: {
  offline: boolean;
  syncing: boolean;
  feedError: boolean;
  loadedAt?: number;
  refresh?: () => void;
}) {
  const { colors } = useTheme();
  const date = loadedAt ? ` Dernière actualisation le ${dayLabel(parisDay(loadedAt))}.` : '';
  if (!offline && !syncing && !feedError) return null;
  const text = offline
    ? `Hors connexion.${date} Les informations affichées sont à revérifier.`
    : syncing
      ? 'Actualisation du catalogue…'
      : `Actualisation indisponible.${date} Les fiches enregistrées restent accessibles.`;
  return (
    <View
      style={{
        backgroundColor: colors.surface,
        borderRadius: radii.control,
        padding: spacing.md,
        gap: spacing.xs,
      }}
    >
      <Copy variant="caption" accessibilityLiveRegion="polite">
        {text}
      </Copy>
      {feedError && !offline && refresh && (
        <Chip title="Réessayer" icon="refresh-outline" onPress={refresh} />
      )}
    </View>
  );
}

export function CatalogueSkeleton() {
  const { colors } = useTheme();
  return (
    <View
      accessibilityLabel="Chargement de Découvrir"
      accessibilityRole="progressbar"
      style={{ gap: spacing.lg }}
    >
      {[242, 78, 78].map((height, i) => (
        <View key={i} style={{ height, borderRadius: radii.hero, backgroundColor: colors.surface }} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: {
    minHeight: layout.touch,
    borderRadius: radii.pill,
    borderWidth: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 4,
  },
  art: { overflow: 'hidden', borderRadius: radii.hero },
  artCenter: { alignItems: 'center', justifyContent: 'center' },
  result: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.sm,
    gap: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    minHeight: 82,
  },
  tile: { borderRadius: radii.hero, borderWidth: StyleSheet.hairlineWidth, overflow: 'hidden' },
});
