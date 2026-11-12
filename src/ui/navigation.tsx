import { createContext, useContext, useEffect, useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Reanimated, { useAnimatedStyle, useSharedValue, withSpring } from 'react-native-reanimated';
import { Icon, type IconName } from './components';
import { BodyText, useDesign, RunnerGlyph } from './design';
import { useTheme } from './theme';
import { FloatingMaterial } from './FloatingMaterial';
import { motion, spacing, radii, fontSizes, fontWeights, iconSizes } from './tokens';

export interface TabItem<T extends string> { key: T; title: string; icon: IconName; selectedIcon?: IconName }
const TabActivity = createContext(true);
export const useTabActive = () => useContext(TabActivity);

export function TabTransition({ value, children }: { value: string; children: ReactNode }) {
  const { colors, reduceMotion } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const committed = useRef({ value, children });
  const [transition, setTransition] = useState({ value, outgoing: null as typeof committed.current | null });
  if (transition.value !== value) {
    setTransition({ value, outgoing: reduceMotion ? null : committed.current });
  }

  useLayoutEffect(() => { committed.current = { value, children }; }, [value, children]);

  const { outgoing } = transition;
  useLayoutEffect(() => {
    if (!outgoing || reduceMotion) {
      opacity.setValue(1);
      if (outgoing) setTransition({ value, outgoing: null });
      return;
    }
    opacity.setValue(0);
    const fade = Animated.timing(opacity, { toValue: 1, duration: motion.duration.fast, easing: motion.enter, useNativeDriver: Platform.OS !== 'web' });
    fade.start(({ finished }) => {
      if (finished) setTransition(current => current.outgoing === outgoing ? { value, outgoing: null } : current);
    });
    return () => fade.stop();
  }, [opacity, outgoing, reduceMotion, value]);

  return <View style={{ flex: 1 }}>
    {outgoing && !reduceMotion && <Animated.View key={outgoing.value} pointerEvents="none" aria-hidden
      accessibilityElementsHidden importantForAccessibility="no-hide-descendants"
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.background }]}>
      <TabActivity.Provider value={false}>{outgoing.children}</TabActivity.Provider>
    </Animated.View>}
    <Animated.View key={value} style={[StyleSheet.absoluteFill, { backgroundColor: colors.background, opacity: reduceMotion ? 1 : opacity }]}>
      <TabActivity.Provider value>{children}</TabActivity.Provider>
    </Animated.View>
  </View>;
}

export function BottomTabs<T extends string>({ items, value, onChange, onHeightChange }: {
  items: readonly TabItem<T>[]; value: T; onChange: (value: T) => void; onHeightChange: (height: number) => void;
}) {
  const design = useDesign();
  const insets = useSafeAreaInsets(), { reduceMotion } = useTheme();
  const [width, setWidth] = useState(0), x = useSharedValue(0), positioned = useRef(false);
  const index = Math.max(0, items.findIndex(item => item.key === value)), itemWidth = width / items.length;
  useEffect(() => {
    if (!width) return;
    if (!positioned.current || reduceMotion) x.set(index * itemWidth);
    else x.set(withSpring(index * itemWidth, motion.spring));
    positioned.current = true;
  }, [index, itemWidth, reduceMotion, width, x]);
  const indicator = useAnimatedStyle(() => ({ transform: [{ translateX: x.get() }] }));
  return <View accessibilityRole="tablist" accessibilityLabel="Navigation principale" onLayout={event => onHeightChange(event.nativeEvent.layout.height)}
    style={{ position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: spacing.xl, paddingTop: spacing.sm, paddingBottom: Math.max(12, insets.bottom) }}>
    <View style={{ borderRadius: radii.card, overflow: 'hidden', borderWidth: 1, borderColor: design.line }}>
      <FloatingMaterial />
      <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row' }}>
        {width > 0 && <Reanimated.View pointerEvents="none" style={[{ position: 'absolute', top: 0, left: 0, width: itemWidth, alignItems: 'center' }, indicator]}>
          <View style={{ width: 25, height: 3, borderBottomLeftRadius: 2, borderBottomRightRadius: 2, backgroundColor: design.accent }} />
        </Reanimated.View>}
        {items.map(item => {
          const selected = value === item.key, color = selected ? design.accent : design.secondary;
          return <Pressable key={item.key} accessibilityRole="tab" accessibilityLabel={item.title} accessibilityState={{ selected }} aria-selected={selected}
            onPress={() => onChange(item.key)} style={({ pressed }) => ({ flex: 1, minWidth: 0, minHeight: 64, paddingVertical: spacing.md, paddingHorizontal: spacing.xs,
              alignItems: 'center', justifyContent: 'center', gap: spacing.xs, opacity: pressed ? .6 : 1 })}>
            {item.key === 'home' && !selected ? <RunnerGlyph size={23} color={color} />
              : <Icon name={selected ? item.selectedIcon ?? item.icon : item.icon} size={item.key === 'home' ? iconSizes.large : iconSizes.standard} color={color} />}
            <BodyText style={{ fontSize: fontSizes.micro, lineHeight: 14, fontWeight: selected ? fontWeights.semibold : fontWeights.regular, color: selected ? design.text : design.secondary }}>{item.title}</BodyText>
          </Pressable>;
        })}
      </View>
    </View>
  </View>;
}
