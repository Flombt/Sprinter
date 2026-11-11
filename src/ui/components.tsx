import React, { useEffect, useRef } from 'react';
import { Animated, Platform, Pressable, ScrollView, StyleProp, StyleSheet, Text, TextStyle, View, ViewProps, ViewStyle } from 'react-native';
import Ionicons from '@expo/vector-icons/Ionicons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Circle, Ellipse, G, Path } from 'react-native-svg';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdaptiveLayout, useTheme } from './theme';
import { cardStyles, interaction, layout, radii, spacing, typography, type TextVariant } from './tokens';
import { useBottomBarInset } from './layout';
import { ScreenEntrance } from './motion';
import { haptic, type HapticFeedback } from './haptics';

export type IconName = React.ComponentProps<typeof Ionicons>['name'];
export function Copy({ children, style, muted = false, variant = 'body', ...props }: React.ComponentProps<typeof Text> & { muted?: boolean; variant?: TextVariant }) {
  const { colors } = useTheme();
  const custom = StyleSheet.flatten(style);
  // Legacy screen-specific sizes keep a matching line height until their migration to a named role.
  const lineHeight = custom?.fontSize && custom.lineHeight === undefined ? Math.ceil(custom.fontSize * (custom.fontSize >= 24 ? 1.22 : 1.5)) : undefined;
  return <Text allowFontScaling {...props} style={[typography[variant], { color: muted ? colors.secondary : colors.text }, lineHeight ? { lineHeight } : null, style]}>{children}</Text>;
}
export function Label({ children, style, ...props }: React.ComponentProps<typeof Text>) {
  return <Copy {...props} variant="label" muted style={style}>{children}</Copy>;
}
export function Icon({ name, size = 22, color }: { name: IconName; size?: number; color?: string }) {
  const { colors } = useTheme(); return <Ionicons accessible={false} allowFontScaling={false} name={name} size={size} color={color ?? colors.text} />;
}
export function Button({
  title, onPress, icon, secondary = false, variant, danger = false, disabled = false, style, hint, onHero = false,
  feedback = 'light', size, children,
}: {
  title: string; onPress: () => void; icon?: IconName; secondary?: boolean; danger?: boolean; disabled?: boolean;
  style?: StyleProp<ViewStyle>; hint?: string; variant?: 'primary' | 'secondary' | 'quiet'; onHero?: boolean;
  feedback?: HapticFeedback;
  size?: 'run' | 'toolbar';
  children?: React.ReactNode;
}) {
  const { colors, reduceMotion } = useTheme(); const scale = useRef(new Animated.Value(1)).current;
  const kind = variant ?? (secondary ? 'secondary' : 'primary');
  const color = onHero ? colors.heroActionText : danger ? kind === 'primary' ? colors.background : colors.danger : kind === 'primary' ? colors.accentInk : colors.text;
  const backgroundColor = onHero ? colors.heroAction : danger ? kind === 'primary' ? colors.danger : colors.dangerSurface : kind === 'primary' ? colors.accent : kind === 'secondary' ? colors.raised : 'transparent';
  useEffect(() => { if (reduceMotion || disabled) { scale.stopAnimation(); scale.setValue(1); } return () => scale.stopAnimation(); }, [disabled, reduceMotion, scale]);
  const animate = (toValue: number) => {
    if (!reduceMotion) Animated.timing(scale, {
      toValue, duration: interaction.pressDuration, useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  const press = () => {
    if (feedback !== 'none') haptic[feedback]();
    onPress();
  };
  return <Animated.View style={[{ minWidth: 0, transform: [{ scale }] }, style]}><Pressable accessibilityRole="button" accessibilityLabel={title}
    accessibilityHint={hint} accessibilityState={{ disabled }} disabled={disabled}
    onPress={press} onPressIn={() => animate(interaction.buttonScale)} onPressOut={() => animate(1)}
    style={({ pressed }) => [
      styles.button,
      kind === 'quiet' && { minHeight: layout.touch, paddingVertical: spacing.sm, paddingHorizontal: spacing.sm },
      size === 'run' && { minHeight: layout.runButton },
      size === 'toolbar' && { minHeight: layout.toolbarButton },
      { backgroundColor, opacity: disabled ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1 },
    ]}>
    {children ?? <>
      {icon && <Icon name={icon} color={color} size={22} />}
      <Copy variant="button" style={{ color, flexShrink: 1, textAlign: 'center' }}>{title}</Copy>
    </>}
  </Pressable></Animated.View>;
}
export function IconButton({ icon, label, onPress, quiet = false, disabled = false, feedback = 'light' }: {
  icon: IconName;
  label: string;
  onPress: () => void;
  quiet?: boolean;
  disabled?: boolean;
  feedback?: HapticFeedback;
}) {
  const { colors } = useTheme();
  const press = () => {
    if (feedback !== 'none') haptic[feedback]();
    onPress();
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={press}
    style={({ pressed }) => ({ width: layout.touch, height: layout.touch, borderRadius: radii.pill, justifyContent: 'center', alignItems: 'center',
      backgroundColor: quiet ? 'transparent' : colors.surface, opacity: disabled ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1 })}><Icon name={icon} /></Pressable>;
}
export function Card({ children, style, variant = 'default', ...props }: ViewProps & { variant?: keyof typeof cardStyles }) {
  const { colors } = useTheme();
  const container = [{ backgroundColor: colors.surface }, cardStyles[variant], style];
  return variant === 'hero'
    ? <LinearGradient {...props} colors={[colors.heroStart, colors.heroEnd]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={container}>{children}</LinearGradient>
    : <View {...props} style={container}>{children}</View>;
}
/** Backward-compatible name for the shared card; existing screens keep their content/actions. */
export const Panel = Card;
export function ListRow({ title, subtitle, trailing, icon, onPress, label }: {
  title: string; subtitle?: React.ReactNode; trailing?: React.ReactNode; icon?: IconName | React.ReactElement;
  onPress: () => void; label?: string;
}) {
  const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  return <Pressable accessibilityRole="button" accessibilityLabel={label ?? title} onPress={onPress}
    style={({ pressed }) => ({ opacity: pressed ? interaction.pressedOpacity : 1, minHeight: layout.touch })}>
    <Card variant="list" style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
      {icon && !largeText && <View style={{ width: layout.touch, height: layout.touch, borderRadius: radii.control, backgroundColor: colors.raised,
        alignItems: 'center', justifyContent: 'center' }}>
        {typeof icon === 'string' ? <Icon name={icon} color={colors.accentText} /> : icon}
      </View>}
      <View style={{ flex: 1, minWidth: 0, gap: spacing.sm }}>
        <Copy variant="emphasis">{title}</Copy>{subtitle}
        {largeText && trailing}
      </View>
      {!largeText && trailing}<Icon name="chevron-forward" size={16} color={colors.secondary} />
    </Card>
  </Pressable>;
}
export function Divider() {
  const { colors } = useTheme(); return <View style={{ height: StyleSheet.hairlineWidth, backgroundColor: colors.line }} />;
}
export function Screen({ children, bottom = spacing.xxl, scroll = true }: { children: React.ReactNode; bottom?: number; scroll?: boolean }) {
  const { colors } = useTheme(); const inset = useSafeAreaInsets(), barInset = useBottomBarInset();
  const { compact, largeText } = useAdaptiveLayout();
  const gutter = compact || largeText ? layout.compactGutter : layout.screenGutter;
  const content = { paddingTop: inset.top + spacing.lg, paddingHorizontal: Math.max(gutter, inset.left, inset.right),
    paddingBottom: Math.max(inset.bottom + bottom, barInset + spacing.xxl), gap: spacing.xxl, width: '100%' as const, maxWidth: layout.contentWidth, alignSelf: 'center' as const };
  return <ScreenEntrance>{scroll ? <ScrollView style={{ flex: 1, backgroundColor: colors.background }} contentContainerStyle={content}
    keyboardShouldPersistTaps="handled" keyboardDismissMode="interactive" automaticallyAdjustKeyboardInsets showsVerticalScrollIndicator={false}>{children}</ScrollView>
    : <View style={[{ flex: 1, backgroundColor: colors.background }, content]}>{children}</View>}</ScreenEntrance>;
}
export function Header({ title, subtitle, onBack, right }: { title: string; subtitle?: string; onBack?: () => void; right?: React.ReactNode }) {
  const { largeText } = useAdaptiveLayout();
  return <View style={[styles.row, { alignItems: 'flex-start', flexWrap: 'wrap', gap: spacing.md }]}>
    {onBack && <IconButton icon="chevron-back" label="Retour" onPress={onBack} quiet />}
    <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>{subtitle && <Label>{subtitle}</Label>}<Copy accessibilityRole="header" variant={onBack ? 'heading' : 'title'}>{title}</Copy></View>
    {right && <View style={largeText ? { width: '100%', alignItems: 'flex-start' } : undefined}>{right}</View>}
  </View>;
}
export function SectionHeading({ title, action, onPress }: { title: string; action?: string; onPress?: () => void }) {
  return <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}>
    <Copy accessibilityRole="header" variant="section" style={{ flexShrink: 1 }}>{title}</Copy>
    {action && <Button title={action} icon="arrow-forward" variant="quiet" onPress={onPress ?? (() => undefined)} />}
  </View>;
}
export function NumericReadout({ value, variant = 'metric', label, style }: { value: string; variant?: TextVariant; label?: string; style?: StyleProp<TextStyle> }) {
  const { largeText } = useAdaptiveLayout();
  const content = <Copy variant={variant} accessibilityLabel={label} style={style}>{value}</Copy>;
  // Keep the user's full text scale. Long numbers can be panned rather than shrunk or truncated.
  return largeText ? <ScrollView horizontal contentContainerStyle={{ flexGrow: 1 }} style={{ maxWidth: '100%' }}>{content}</ScrollView> : content;
}
export function Metric({ label, value, unit, large = false }: { label: string; value: string; unit?: string; large?: boolean }) {
  return <View style={{ gap: spacing.xs, flex: 1, minWidth: 0 }}><Label>{label}</Label><View style={[styles.row, { alignItems: 'baseline', flexWrap: 'wrap', gap: spacing.xs }]}>
    <NumericReadout value={value} variant={large ? 'metricLarge' : 'metric'} style={{ flexShrink: 1 }} />
    {unit && <Copy muted variant="caption">{unit}</Copy>}</View></View>;
}
export function MetricGrid({ children }: { children: React.ReactNode }) {
  const { largeText } = useAdaptiveLayout();
  return <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xl }}>
    {React.Children.toArray(children).map((child, i) => <View key={React.isValidElement(child) ? child.key ?? i : i}
      style={{ flexGrow: 1, flexBasis: largeText ? '100%' : 0, minWidth: largeText ? '100%' : 110 }}>{child}</View>)}
  </View>;
}
export function EmptyState({ icon, title, body, action }: { icon: IconName; title: string; body: string; action?: React.ReactNode }) {
  const { colors } = useTheme(); return <View style={{ alignItems: 'center', paddingVertical: spacing.xxl, gap: spacing.lg }}>
    <View style={{ width: 64, height: 64, borderRadius: radii.card, backgroundColor: colors.raised, justifyContent: 'center', alignItems: 'center' }}><Icon name={icon} size={29} color={colors.secondary} /></View>
    <Copy variant="section" style={{ textAlign: 'center' }}>{title}</Copy><Copy muted style={{ textAlign: 'center', maxWidth: 280 }}>{body}</Copy>{action}
  </View>;
}
export function TrackArt() {
  const { colors } = useTheme();
  return <View pointerEvents="none" accessible={false} style={{ position: 'absolute', width: 280, height: 240, right: -67, top: -5, transform: [{ rotate: '-27deg' }] }}>
    <Svg width="280" height="240" viewBox="0 0 280 240"><G fill="none" stroke={colors.heroDecoration} strokeWidth="1.2" opacity=".23">
      {[0, 1, 2, 3, 4, 5].map(i => <Ellipse key={i} cx="151" cy="122" rx={95 + i * 10} ry={47 + i * 10} />)}
    </G><Path d="M 13 122 C 13 57 69 25 151 25 C 230 25 289 64 289 122" stroke={colors.heroDecoration} strokeWidth="3" fill="none" opacity=".5" />
    <Circle cx="50" cy="54" r="7" fill={colors.heroDecoration} /><Circle cx="50" cy="54" r="14" stroke={colors.heroDecoration} strokeWidth="1" opacity=".22" fill="none" /></Svg>
  </View>;
}
export function Hero({ onStart, hasRun, title, description }: { onStart: () => void; hasRun: boolean; title?: string; description?: string }) {
  const { colors } = useTheme();
  return <Card variant="hero" style={{ overflow: 'hidden', padding: spacing.xl, gap: spacing.lg }}>
    <View pointerEvents="none" accessible={false} style={{ position: 'absolute', top: 0, right: 0, width: 100, height: 90, overflow: 'hidden', opacity: .4 }}><TrackArt /></View>
    <View style={{ gap: spacing.sm }}><View style={[styles.row, { gap: spacing.sm }]}><Icon name="pulse" size={17} color={colors.heroSecondary} />
      <Copy variant="label" style={{ color: colors.heroSecondary, flexShrink: 1 }}>Coach d’allure</Copy></View>
      <Copy accessibilityRole="header" variant="title" style={{ color: colors.heroText }}>{title ?? (hasRun ? 'Course en pause.' : 'À votre rythme.')}</Copy>
      <Copy variant="caption" style={{ color: colors.heroSecondary }}>{description ?? 'Choisissez votre allure. Le coach vous guide pendant la course.'}</Copy></View>
    <Button title={hasRun ? 'Retrouver ma course' : 'Commencer une course'} onPress={onStart} icon={hasRun ? 'arrow-forward' : 'play'} onHero
      hint={hasRun ? 'Ouvrir votre course et ses commandes de pause et de reprise.' : 'Choisir une allure ou une séance avant de démarrer.'} />
  </Card>;
}
export const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center' },
  button: { borderRadius: radii.button, minHeight: layout.button, paddingHorizontal: spacing.lg, paddingVertical: spacing.lg, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
