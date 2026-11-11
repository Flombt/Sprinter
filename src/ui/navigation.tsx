import { contrastAccent, interaction, typography } from './tokens';
import { RunnerGlyph } from './brand';
import { Copy, Icon, type IconName } from './components';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Platform, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { GlassView, isLiquidGlassAvailable } from 'expo-glass-effect';
import { useTheme } from './theme';
import { haptic } from './haptics';

export interface TabItem<T extends string> {
  key: T;
  title: string;
  icon: IconName;
  selectedIcon?: IconName;
}

export function TabPane({ visible, children }: { visible: boolean; children: ReactNode }) {
  const { reduceMotion } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (!visible || reduceMotion) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0);
    const animation = Animated.timing(opacity, {
      toValue: 1,
      duration: 120,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [visible, reduceMotion, opacity]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, { opacity: visible ? opacity : 0, zIndex: visible ? 1 : 0 }]}
      pointerEvents={visible ? 'auto' : 'none'}
      accessibilityElementsHidden={!visible}
      importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
      aria-hidden={!visible}
    >
      {children}
    </Animated.View>
  );
}

function BottomTabsView<T extends string>({
  items,
  value,
  onChange,
  onHeightChange,
  hidden = false,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  onHeightChange: (height: number) => void;
  hidden?: boolean;
}) {
  const insets = useSafeAreaInsets(),
    { colors, reduceMotion, reduceTransparency } = useTheme();
  const accent = contrastAccent(colors);
  const [width, setWidth] = useState(0),
    x = useRef(new Animated.Value(0)).current,
    positioned = useRef(false);
  const [height, setHeight] = useState(0);
  const slide = useRef(new Animated.Value(hidden ? 1 : 0)).current;
  const index = Math.max(
      0,
      items.findIndex((item) => item.key === value),
    ),
    itemWidth = width / items.length;
  useEffect(() => {
    if (!width) return;
    if (!positioned.current || reduceMotion) {
      x.setValue(index * itemWidth);
      positioned.current = true;
      return;
    }
    const animation = Animated.timing(x, {
      toValue: index * itemWidth,
      duration: 180,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [index, itemWidth, reduceMotion, width, x]);
  useEffect(() => {
    const toValue = hidden ? 1 : 0;
    if (reduceMotion) {
      slide.setValue(toValue);
      return;
    }
    const animation = Animated.timing(slide, {
      toValue,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [hidden, reduceMotion, slide]);

  return (
    <Animated.View
      accessibilityRole="tablist"
      accessibilityLabel="Navigation principale"
      pointerEvents={hidden ? 'none' : 'auto'}
      aria-hidden={hidden}
      accessibilityElementsHidden={hidden}
      importantForAccessibility={hidden ? 'no-hide-descendants' : 'auto'}
      onLayout={(event) => {
        const measuredHeight = event.nativeEvent.layout.height;
        setHeight(measuredHeight);
        onHeightChange(measuredHeight);
      }}
      style={{
        position: 'absolute',
        zIndex: 2,
        bottom: 0,
        left: 0,
        right: 0,
        paddingHorizontal: 20,
        paddingTop: 10,
        paddingBottom: Math.max(12, insets.bottom),
        transform: [{ translateY: Animated.multiply(slide, height || 150) }],
      }}
    >
      <View
        style={{
          borderRadius: 18,
          overflow: 'hidden',
          borderWidth: 1,
          borderColor: colors.line,
          backgroundColor: colors.glass,
        }}
      >
        <View pointerEvents="none" accessible={false} style={StyleSheet.absoluteFill}>
          {!reduceTransparency &&
            (Platform.OS === 'ios' && isLiquidGlassAvailable() ? (
              <GlassView
                colorScheme={colors.dark ? 'dark' : 'light'}
                glassEffectStyle="regular"
                style={StyleSheet.absoluteFill}
              />
            ) : (
              Platform.OS !== 'android' && (
                <BlurView
                  tint={colors.dark ? 'dark' : 'light'}
                  intensity={70}
                  style={StyleSheet.absoluteFill}
                />
              )
            ))}
        </View>
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={{ flexDirection: 'row' }}>
          {width > 0 && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: itemWidth,
                alignItems: 'center',
                transform: [{ translateX: x }],
              }}
            >
              <View
                style={{
                  width: 25,
                  height: 3,
                  borderBottomLeftRadius: 2,
                  borderBottomRightRadius: 2,
                  backgroundColor: accent,
                }}
              />
            </Animated.View>
          )}
          {items.map((item) => {
            const selected = value === item.key,
              color = selected ? accent : colors.secondary;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.title}
                accessibilityState={{ selected }}
                aria-selected={selected}
                onPress={() => {
                  if (selected) return;
                  haptic.select();
                  onChange(item.key);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  minHeight: 64,
                  paddingVertical: 11,
                  paddingHorizontal: 4,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 4,
                  opacity: pressed ? interaction.pressedOpacity : 1,
                })}
              >
                {item.key === 'home' ? (
                  <RunnerGlyph size={23} color={color} />
                ) : (
                  <Icon name={item.icon} size={21} color={color} />
                )}
                <Copy
                  variant="bodyCompact"
                  style={[
                    typography.tab,
                    {
                      fontWeight: selected ? '600' : '400',
                      color: selected ? colors.text : colors.secondary,
                    },
                  ]}
                >
                  {item.title}
                </Copy>
              </Pressable>
            );
          })}
        </View>
      </View>
    </Animated.View>
  );
}

export const BottomTabs = memo(BottomTabsView) as typeof BottomTabsView;
