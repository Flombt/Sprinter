import { useEffect, useRef, useState } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { Icon, type IconName } from './components';
import { BodyText, useDesign, RunnerGlyph } from './design';
import { useTheme } from './theme';
import { haptic } from './haptics';
import { interaction, typography } from './tokens';

export interface TabItem<T extends string> { key: T; title: string; icon: IconName; selectedIcon?: IconName }

export function BottomTabs<T extends string>({ items, value, onChange, onHeightChange }: {
  items: readonly TabItem<T>[]; value: T; onChange: (value: T) => void; onHeightChange: (height: number) => void;
}) {
  const design = useDesign();
  const insets = useSafeAreaInsets(), { colors, reduceMotion, reduceTransparency } = useTheme();
  const [width, setWidth] = useState(0), x = useRef(new Animated.Value(0)).current, positioned = useRef(false);
  const index = Math.max(0, items.findIndex(item => item.key === value)), itemWidth = width / items.length;
  useEffect(() => {
    if (!width) return;
    if (!positioned.current || reduceMotion) { x.setValue(index * itemWidth); positioned.current = true; return; }
    const animation = Animated.timing(x, {
      toValue: index * itemWidth,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(); return () => animation.stop();
  }, [index, itemWidth, reduceMotion, width, x]);
  return <View accessibilityRole="tablist" accessibilityLabel="Navigation principale" onLayout={event => onHeightChange(event.nativeEvent.layout.height)}
    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: 20, paddingTop: 10, paddingBottom: Math.max(12, insets.bottom) }}>
    <View style={{ borderRadius: 18, overflow: 'hidden', borderWidth: 1, borderColor: design.line, backgroundColor: colors.glass }}>
      <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
        {!reduceTransparency && (Platform.OS === 'ios' && isLiquidGlassAvailable()
          ? <GlassView colorScheme={colors.dark ? 'dark' : 'light'} glassEffectStyle="regular" style={StyleSheet.absoluteFill} />
          : Platform.OS !== 'android' && <BlurView tint={colors.dark ? 'dark' : 'light'} intensity={70} style={StyleSheet.absoluteFill} />)}
      </View>
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row' }}>
        {width > 0 && <Animated.View pointerEvents="none" style={{ position: 'absolute', top: 0, left: 0, width: itemWidth, alignItems: 'center', transform: [{ translateX: x }] }}>
          <View style={{ width: 25, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: design.accent }} />
        </Animated.View>}
        {items.map(item => {
          const selected = value === item.key, color = selected ? design.accent : design.secondary;
          return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.title} accessibilityState={{ selected }} aria-selected={selected}
            onPress={() => {
              if (selected) return;
              haptic.select();
              onChange(item.key);
            }} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 64, paddingVertical: 11, paddingHorizontal: 4,
              alignItems: 'center', justifyContent: 'center', gap: 4, opacity: pressed ? interaction.pressedOpacity : 1 })}>
            {item.key === 'home' ? <RunnerGlyph size={23} color={color} /> : <Icon name={item.icon} size={21} color={color} />}
            <BodyText style={[typography.tab, { fontWeight: selected ? '600' : '400', color: selected ? design.text : design.secondary }]}>{item.title}</BodyText>
          </Pressable>;
        })}
      </View>
    </View>
  </View>;
}
