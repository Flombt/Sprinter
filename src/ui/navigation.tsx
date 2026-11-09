import { useEffect, useRef, type ComponentRef } from 'react';
import { Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Copy, Icon, type IconName } from './components';
import { useAdaptiveLayout, useTheme } from './theme';
import { interaction, layout, radii, spacing } from './tokens';

export interface TabItem<T extends string> { key: T; title: string; icon: IconName; selectedIcon?: IconName }
/** Presentation only: the existing page/tab state remains in App. */
export function BottomTabs<T extends string>({ items, value, onChange, onHeightChange }: {
  items: readonly TabItem<T>[]; value: T; onChange: (value: T) => void; onHeightChange: (height: number) => void;
}) {
  const { colors, reduceMotion, reduceTransparency } = useTheme(), { largeText, fontScale } = useAdaptiveLayout();
  const insets = useSafeAreaInsets();
  const scroll = useRef<ComponentRef<typeof ScrollView>>(null), positions = useRef(new Map<T, number>());
  useEffect(() => {
    const x = positions.current.get(value);
    if (largeText && x !== undefined) scroll.current?.scrollTo({ x: Math.max(0, x - spacing.sm), animated: !reduceMotion });
  }, [value, largeText, fontScale, reduceMotion]);
  const tabs = items.map(item => {
    const selected = value === item.key;
    return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.title}
      accessibilityState={{ selected }} onPress={() => onChange(item.key)} onLayout={event => {
        const x = event.nativeEvent.layout.x; positions.current.set(item.key, x);
        if (largeText && selected) scroll.current?.scrollTo({ x: Math.max(0, x - spacing.sm), animated: false });
      }}
      style={({ pressed }) => ({ minHeight: layout.touch, ...(largeText ? { minWidth: 88 * fontScale, paddingHorizontal: spacing.md } : { flex: 1, minWidth: 0 }),
        paddingVertical: spacing.sm, alignItems: 'center', justifyContent: 'center', gap: spacing.xs,
        borderRadius: radii.control, opacity: pressed ? interaction.pressedOpacity : 1 })}>
      <View style={{ borderRadius: radii.pill, paddingHorizontal: spacing.md, paddingVertical: 2, backgroundColor: selected ? colors.accentSoft : 'transparent' }}>
        <Icon name={selected ? item.selectedIcon ?? item.icon : item.icon} size={layout.tabIcon} color={selected ? colors.accentText : colors.secondary} />
      </View>
      <Copy variant="tab" style={{ textAlign: 'center', color: selected ? colors.accentText : colors.secondary }}>{item.title}</Copy>
    </Pressable>;
  });
  const content = largeText
    ? <ScrollView ref={scroll} horizontal showsHorizontalScrollIndicator contentContainerStyle={{ flexDirection: 'row', alignItems: 'center' }}>{tabs}</ScrollView>
    : <View style={{ flexDirection: 'row', alignItems: 'stretch' }}>{tabs}</View>;
  const surface = { width: '100%' as const, maxWidth: layout.contentWidth, alignSelf: 'center' as const,
    borderRadius: radii.card, overflow: 'hidden' as const, borderWidth: StyleSheet.hairlineWidth, borderColor: colors.line };
  return <View accessible={false} accessibilityRole="tablist" accessibilityLabel="Navigation principale" onLayout={event => onHeightChange(event.nativeEvent.layout.height)} style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
    paddingHorizontal: Math.max(spacing.md, insets.left, insets.right), paddingTop: spacing.sm, paddingBottom: Math.max(spacing.sm, insets.bottom) }}>
    {reduceTransparency || Platform.OS !== 'ios'
      ? <View style={[surface, { backgroundColor: colors.surface }]}>{content}</View>
      : isLiquidGlassAvailable()
        ? <GlassView glassEffectStyle="regular" colorScheme={colors.dark ? 'dark' : 'light'} style={surface}>{content}</GlassView>
        : <BlurView intensity={75} tint={colors.dark ? 'dark' : 'light'} style={[surface, { backgroundColor: colors.glass }]}>{content}</BlurView>}
  </View>;
}
