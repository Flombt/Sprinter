import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform, Pressable, ScrollView, StyleSheet, Text, View, type KeyDownEvent, type StyleProp, type TextProps, type ViewStyle } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Path } from 'react-native-svg';
import { Icon, type IconName } from './components';
import { useBottomBarInset } from './layout';
import { useTheme } from './theme';
import { haptic, type HapticFeedback } from './haptics';
import { interaction, typography } from './tokens';

/** The running identity: carbon, chalk, and a single high-visibility accent. */
export const design = {
  background: '#101011', surface: '#1B1B1E', raised: '#252528',
  paper: '#F2F0E9', paperLine: '#D7D4CC', ink: '#171719',
  text: '#FAF9F6', secondary: '#A0A0A7', muted: '#77777F',
  accent: '#FF5C35', accentSoft: '#322019', line: '#303034', danger: '#FF9F91',
  display: 'SprinterDisplay', metric: 'SprinterMetric',
  body: Platform.OS === 'ios' ? 'System' : Platform.OS === 'android' ? 'sans-serif' : 'system-ui',
};

export function useDesign() {
  const { colors } = useTheme();
  return { ...design, background: colors.background, surface: colors.surface, raised: colors.raised,
    text: colors.text, secondary: colors.secondary, muted: colors.muted, line: colors.line,
    accent: colors.dark ? design.accent : colors.accentText, accentSoft: colors.accentSoft, danger: colors.danger };
}

export function BodyText({ style, ...props }: TextProps) {
  const design = useDesign();
  return <Text {...props} style={[{ fontFamily: design.body, fontWeight: '400', fontSize: 14, lineHeight: 20, color: design.text, letterSpacing: -.15 }, style]} />;
}

export function DisplayText({ style, numeric = false, ...props }: TextProps & { numeric?: boolean }) {
  const design = useDesign();
  return <Text {...props} style={[{ fontFamily: numeric ? design.metric : design.display, fontSize: 42, lineHeight: 46, color: design.text, letterSpacing: -.5,
    ...(numeric ? { fontVariant: ['tabular-nums'] as const } : {}) }, style]} />;
}

export function Kicker({ style, ...props }: TextProps) {
  const design = useDesign();
  return <BodyText {...props} style={[typography.label, { color: design.secondary }, style]} />;
}

export function Surface({ children, paper = false, style, contentStyle }: {
  children: ReactNode; paper?: boolean; style?: StyleProp<ViewStyle>; contentStyle?: StyleProp<ViewStyle>;
}) {
  const design = useDesign();
  return <View style={[{ backgroundColor: paper ? design.paper : design.surface, borderRadius: 18, borderWidth: 1, borderColor: paper ? design.paper : design.line, overflow: 'hidden' }, style]}>
    <View style={[{ padding: 18 }, contentStyle]}>{children}</View>
  </View>;
}

export function AppBackground() {
  const design = useDesign();
  return <View pointerEvents="none" accessible={false} style={[StyleSheet.absoluteFill, { backgroundColor: design.background }]} />;
}

export function AppScreen({ children, gap = 20 }: { children: ReactNode; gap?: number }) {
  const insets = useSafeAreaInsets(), bottom = useBottomBarInset();
  return <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false} keyboardShouldPersistTaps="handled"
    contentContainerStyle={{ flexGrow: 1, paddingHorizontal: 20, paddingTop: insets.top + 16, paddingBottom: Math.max(bottom + 20, insets.bottom + 100), gap }}>
    {children}
  </ScrollView>;
}

export function PageTransition({ children }: { children: ReactNode }) {
  const { reduceMotion } = useTheme();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;
  useEffect(() => {
    if (reduceMotion) { progress.setValue(1); return; }
    const animation = Animated.timing(progress, { toValue: 1, duration: 200, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [progress, reduceMotion]);
  return <Animated.View style={{ flex: 1, opacity: progress, transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }] }}>{children}</Animated.View>;
}

export function ActionIcon({ icon, label, onPress, disabled = false, paper = false, feedback = 'light' }: {
  icon: IconName; label: string; onPress: () => void; disabled?: boolean; paper?: boolean; feedback?: HapticFeedback;
}) {
  const design = useDesign();
  const press = () => {
    if (feedback !== 'none') haptic[feedback]();
    onPress();
  };
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityState={{ disabled }}
    disabled={disabled} onPress={press}
    style={({ pressed }) => ({ width: 44, height: 44, alignItems: 'center', justifyContent: 'center', borderRadius: 12,
      borderWidth: 1, borderColor: paper ? design.paperLine : design.line, backgroundColor: pressed ? paper ? '#DDDAD2' : design.raised : paper ? 'transparent' : design.surface, opacity: disabled ? .3 : 1 })}>
    <Icon name={icon} size={19} color={paper ? design.ink : design.text} />
  </Pressable>;
}

export function ActionButton({
  title, icon, onPress, disabled = false, secondary = false, compact = false, feedback = 'light', arrow = true,
}: {
  title: string; icon?: IconName; onPress: () => void; disabled?: boolean; secondary?: boolean; compact?: boolean;
  feedback?: HapticFeedback;
  arrow?: boolean;
}) {
  const design = useDesign();
  const { reduceMotion } = useTheme(), scale = useRef(new Animated.Value(1)).current;
  const animate = (toValue: number) => {
    if (!reduceMotion) Animated.timing(scale, {
      toValue, duration: interaction.pressDuration, useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  useEffect(() => {
    if (reduceMotion || disabled) scale.setValue(1);
    return () => scale.stopAnimation();
  }, [disabled, reduceMotion, scale]);
  const press = () => {
    if (feedback !== 'none') haptic[feedback]();
    onPress();
  };
  const foreground = disabled ? design.muted : secondary ? design.text : '#FFFFFF';
  return <Animated.View style={{ transform: [{ scale }] }}>
    <Pressable accessibilityRole="button" accessibilityLabel={title} accessibilityState={{ disabled }}
      disabled={disabled} onPress={press}
      onPressIn={() => animate(interaction.buttonScale)} onPressOut={() => animate(1)}
      style={({ pressed }) => ({ minHeight: compact ? 50 : 60, paddingHorizontal: 18, paddingVertical: 10, borderRadius: 12,
        flexDirection: 'row', alignItems: 'center', justifyContent: secondary ? 'center' : 'space-between', gap: 12,
        backgroundColor: disabled || secondary ? design.raised : design.accent, borderWidth: secondary || disabled ? 1 : 0, borderColor: design.line,
        opacity: pressed ? interaction.pressedOpacity : 1 })}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flexShrink: 1 }}>
        {icon && <Icon name={icon} size={19} color={foreground} />}
        <BodyText style={{ fontSize: compact ? 14 : 16, lineHeight: 22, fontWeight: '700', color: foreground }}>{title}</BodyText>
      </View>
      {!secondary && arrow && <Icon name="arrow-forward" size={22} color={foreground} />}
    </Pressable>
  </Animated.View>;
}

export function StatusBadge({ label, active = false, paper = false }: { label: string; active?: boolean; paper?: boolean }) {
  const design = useDesign();
  return <View style={{ alignSelf: 'flex-start', flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 8, paddingVertical: 5, borderRadius: 6,
    backgroundColor: paper ? '#E3E0D8' : active ? design.accentSoft : design.raised }}>
    <View style={{ width: 5, height: 5, borderRadius: 3, backgroundColor: active ? design.accent : design.muted }} />
    <Kicker style={{ color: paper ? '#5F5D58' : active ? design.accent : design.secondary, letterSpacing: .7 }}>
      {label}
    </Kicker>
  </View>;
}

export function ToggleSwitch({ label, hint, value, onChange, disabled = false }: {
  label: string; hint?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean;
}) {
  const design = useDesign();
  const { reduceMotion } = useTheme(), position = useRef(new Animated.Value(value ? 18 : 0)).current;
  useEffect(() => {
    if (reduceMotion) { position.setValue(value ? 18 : 0); return; }
    const animation = Animated.spring(position, { toValue: value ? 18 : 0, damping: 24, stiffness: 300, mass: .7, useNativeDriver: Platform.OS !== 'web' });
    animation.start(); return () => animation.stop();
  }, [position, reduceMotion, value]);
  const change = () => {
    haptic.select();
    onChange(!value);
  };
  // React Native Web handles Enter; Space needs an explicit handler for role=switch.
  const keyboard = Platform.OS === 'web' ? { onKeyDown: (event: KeyDownEvent) => {
    if (!disabled && (event.nativeEvent.key === ' ' || event.nativeEvent.key === 'Spacebar')) {
      event.preventDefault();
      if (!event.nativeEvent.repeat) change();
    }
  } } : {};
  return <Pressable {...keyboard} accessibilityRole="switch" accessibilityLabel={label} accessibilityHint={hint} accessibilityState={{ checked: value, disabled }}
    aria-checked={value} disabled={disabled} onPress={change}
    style={({ pressed }) => ({ minWidth: 48, minHeight: 44, alignItems: 'center', justifyContent: 'center',
      opacity: disabled ? .35 : pressed ? interaction.pressedOpacity : 1 })}>
    <View style={{ width: 44, height: 26, borderRadius: 13, backgroundColor: value ? design.accent : '#424248', justifyContent: 'center' }}>
      <Animated.View style={{ position: 'absolute', left: 2, width: 22, height: 22, borderRadius: 11, backgroundColor: '#FFFFFF', transform: [{ translateX: position }] }} />
    </View>
  </Pressable>;
}

export function SectionLabel({ title, meta }: { title: string; meta?: string }) {
  const design = useDesign();
  return <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 10 }}>
    <Kicker>{title}</Kicker>
    {meta && <BodyText style={[typography.small, { color: design.secondary }]}>{meta}</BodyText>}
  </View>;
}

export function SpeedMark({ size = 30, color = design.accent }: { size?: number; color?: string }) {
  return <Svg accessible={false} width={size} height={size * .8} viewBox="0 0 36 28">
    <Path d="M2 25 14 3h6L8 25Zm10 0L24 3h6L18 25Zm10 0L34 3h2L24 25Z" fill={color} />
  </Svg>;
}

export function RunnerGlyph({ size = 24, color = design.text }: { size?: number; color?: string }) {
  return <Svg accessible={false} width={size} height={size} viewBox="0 0 24 24">
    <Circle cx="16.5" cy="4.5" r="2" fill={color} />
    <Path d="m11 8 3-1 3 4 3 1M14 8l-4 6 4 3-2 5M10 14l-3 5H3M11 8l-4 3H4" fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </Svg>;
}

export function Brand() {
  return <View accessibilityLabel="Sprinter" style={{ flexDirection: 'row', alignItems: 'center', gap: 9 }}>
    <SpeedMark size={28} /><DisplayText style={{ fontSize: 29, lineHeight: 34, letterSpacing: .6 }}>SPRINTER</DisplayText>
  </View>;
}
