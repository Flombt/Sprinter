import { useState, type ComponentProps, type ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { Copy, Icon, Label, type IconName } from './components';
import { useAdaptiveLayout, useTheme } from './theme';
import { editorial, interaction, layout, motionDuration, radii, spacing } from './tokens';

export const editorialMedia = {
  welcome: require('../../assets/editorial/aube.webp') as number,
  run: require('../../assets/editorial/rive.webp') as number,
  workout: require('../../assets/editorial/piste.webp') as number,
  profile: require('../../assets/editorial/illustration-cote.webp') as number,
  fallback: require('../../assets/editorial/illustration-horizon.webp') as number,
};

type ImageProps = ComponentProps<typeof Image>;
export const paceReadout = (label: string) => label.replace(/′/g, ':').replace(/″/g, '');
export function EditorialImage({
  source,
  fallback = editorialMedia.fallback,
  contentPosition = 'center',
  label,
}: {
  source?: ImageProps['source'];
  fallback?: number;
  contentPosition?: ImageProps['contentPosition'];
  label?: string;
}) {
  const { reduceMotion } = useTheme();
  const [failedSource, setFailedSource] = useState<ImageProps['source']>();
  const hasPhoto = !!source && source !== failedSource;
  return (
    <Image
      source={hasPhoto ? source : fallback}
      placeholder={fallback}
      placeholderContentFit="cover"
      contentFit="cover"
      contentPosition={contentPosition}
      transition={reduceMotion ? 0 : motionDuration.media}
      style={StyleSheet.absoluteFill}
      accessible={hasPhoto && !!label}
      accessibilityLabel={hasPhoto ? label : undefined}
      onError={hasPhoto ? () => setFailedSource(source) : undefined}
    />
  );
}

export function PhotoShade({ full = false }: { full?: boolean }) {
  return (
    <LinearGradient
      pointerEvents="none"
      colors={[full ? 'rgba(12,32,27,0.48)' : 'transparent', 'transparent', editorial.scrim, '#091B18']}
      locations={[0, 0.39, 0.71, 1]}
      style={StyleSheet.absoluteFill}
    />
  );
}

export function PhotoCover({
  title,
  eyebrow,
  detail,
  source,
  position,
  height,
  onPress,
}: {
  title: string;
  eyebrow?: string;
  detail?: string;
  source?: ImageProps['source'];
  position?: ImageProps['contentPosition'];
  height: number;
  onPress?: () => void;
}) {
  const { largeText } = useAdaptiveLayout();
  const { reduceTransparency } = useTheme();
  const style: StyleProp<ViewStyle> = [styles.cover, { minHeight: height }];
  const content = (
    <>
      <EditorialImage source={source} contentPosition={position} />
      <PhotoShade />
      <View style={[styles.coverCopy, reduceTransparency && { backgroundColor: editorial.surface }]}>
        {eyebrow && <Label style={{ color: editorial.secondary }}>{eyebrow}</Label>}
        <Copy
          accessibilityRole={onPress ? undefined : 'header'}
          variant={largeText ? 'title' : 'editorialCover'}
          style={{ color: editorial.ink }}
        >
          {title}
        </Copy>
        {detail && (
          <Copy
            variant="bodyCompact"
            style={{ color: editorial.ink, paddingRight: onPress ? spacing.xxxl : 0 }}
          >
            {detail}
          </Copy>
        )}
        {onPress && (
          <View style={styles.coverArrow}>
            <Icon name="arrow-forward" color={editorial.ink} size={20} />
          </View>
        )}
      </View>
    </>
  );
  return onPress ? (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={[title.replace(/\s+/g, ' '), detail].filter(Boolean).join(', ')}
      onPress={onPress}
      style={({ pressed }) => [style, pressed && { opacity: interaction.pressedOpacity }]}
    >
      {content}
    </Pressable>
  ) : (
    <View style={style}>{content}</View>
  );
}

export function DetailRow({
  title,
  detail,
  icon,
  media,
  onPress,
  rule = true,
  disabled = false,
}: {
  title: string;
  detail?: string;
  icon?: IconName;
  media?: ReactNode;
  onPress: () => void;
  rule?: boolean;
  disabled?: boolean;
}) {
  const { colors } = useTheme();
  const { largeText } = useAdaptiveLayout();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={detail ? title + ', ' + detail : title}
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.detailRow,
        rule && { borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.line },
        (pressed || disabled) && {
          opacity: disabled ? interaction.disabledOpacity : interaction.pressedOpacity,
        },
      ]}
    >
      {!largeText &&
        (media ||
          (icon && (
            <View style={[styles.tileIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name={icon} size={19} color={colors.accentText} />
            </View>
          )))}
      <View style={styles.rowText}>
        <Copy variant="emphasis" style={{ fontWeight: '700' }}>
          {title}
        </Copy>
        {detail && (
          <Copy variant="caption" muted>
            {detail}
          </Copy>
        )}
      </View>
      <Icon name="chevron-forward" size={16} color={colors.secondary} />
    </Pressable>
  );
}

export function MeasureStrip({
  items,
}: {
  items: readonly { label: string; shortLabel?: string; value: string; unit?: string }[];
}) {
  const { colors } = useTheme();
  const { compact, largeText } = useAdaptiveLayout();
  const stacked = largeText || (compact && items.length > 2);
  return (
    <View style={{ flexDirection: stacked ? 'column' : 'row', gap: spacing.sm }}>
      {items.map(({ label, shortLabel, value, unit }, index) => (
        <View
          key={label}
          accessible
          accessibilityLabel={[label, value, unit].filter(Boolean).join(' ')}
          style={{
            flex: stacked ? undefined : 1,
            alignItems: 'center',
            padding: spacing.sm,
            minWidth: 0,
            borderColor: colors.line,
            borderLeftWidth: !stacked && index ? StyleSheet.hairlineWidth : 0,
            borderTopWidth: stacked && index ? StyleSheet.hairlineWidth : 0,
          }}
        >
          <Copy variant="caption" muted style={{ textAlign: 'center', fontWeight: '700' }}>
            {!stacked ? (shortLabel ?? label) : label}
          </Copy>
          <Copy variant="editorialTitle" style={{ textAlign: 'center' }} maxFontSizeMultiplier={1.6}>
            {value}
            {unit && (
              <Copy variant="caption" muted>
                {'\u00a0'}
                {unit}
              </Copy>
            )}
          </Copy>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  cover: {
    borderRadius: radii.hero,
    overflow: 'hidden',
    justifyContent: 'flex-end',
    backgroundColor: editorial.surface,
  },
  coverCopy: { gap: spacing.xs, padding: spacing.xl },
  coverArrow: { position: 'absolute', right: spacing.xl, bottom: spacing.xl },
  detailRow: {
    minHeight: layout.touch + spacing.sm,
    alignItems: 'center',
    flexDirection: 'row',
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  tileIcon: {
    width: 39,
    height: 39,
    borderRadius: radii.control,
    alignItems: 'center',
    justifyContent: 'center',
  },
  rowText: { flex: 1, minWidth: 0 },
});
