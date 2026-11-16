import { interaction, layout, motionDuration, radii, typography } from './tokens';
import { RunnerGlyph } from './brand';
import { Copy, Icon, type IconName } from './components';
import { memo, useEffect, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useAdaptiveLayout, useTheme } from './theme';
import { move } from './motion';
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
    opacity.setValue(0.72);
    const animation = move(opacity, 1, motionDuration.tab);
    animation.start();
    return () => animation.stop();
  }, [visible, reduceMotion, opacity]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, visible ? { opacity } : { display: 'none' }]}
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
  disabledItem,
}: {
  items: readonly TabItem<T>[];
  value: T;
  onChange: (value: T) => void;
  onHeightChange: (height: number) => void;
  hidden?: boolean;
  disabledItem?: T;
}) {
  const insets = useSafeAreaInsets(),
    { colors, reduceMotion } = useTheme();
  const { compact, largeText } = useAdaptiveLayout();
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
    const animation = move(x, index * itemWidth, motionDuration.indicator);
    animation.start();
    return () => animation.stop();
  }, [index, itemWidth, reduceMotion, width, x]);
  useEffect(() => {
    const toValue = hidden ? 1 : 0;
    if (reduceMotion) {
      slide.setValue(toValue);
      return;
    }
    const animation = move(slide, toValue, motionDuration.indicator);
    animation.start();
    return () => animation.stop();
  }, [hidden, reduceMotion, slide]);

  return (
    <Animated.View
      accessibilityRole="tablist"
      accessibilityLabel="Navigation principale"
      pointerEvents={hidden ? 'none' : 'box-none'}
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
        paddingHorizontal: compact ? 8 : 12,
        paddingTop: 5,
        paddingBottom: Math.max(8, insets.bottom),
        borderTopWidth: StyleSheet.hairlineWidth,
        borderColor: colors.line,
        backgroundColor: colors.background,
        transform: [{ translateY: Animated.multiply(slide, height || 150) }],
      }}
    >
      <View style={styles.dock}>
        <View onLayout={(event) => setWidth(event.nativeEvent.layout.width)} style={styles.row}>
          {width > 0 && (
            <Animated.View
              pointerEvents="none"
              style={{
                position: 'absolute',
                top: 0,
                bottom: 0,
                left: 0,
                width: itemWidth,
                alignItems: 'center',
                transform: [{ translateX: x }],
              }}
            >
              <View
                style={{
                  width: Math.max(0, Math.min(118, itemWidth - 8)),
                  flex: 1,
                  borderRadius: radii.control,
                  backgroundColor: colors.accentSoft,
                }}
              />
            </Animated.View>
          )}
          {items.map((item) => {
            const selected = value === item.key,
              disabled = item.key === disabledItem,
              color = selected ? colors.accentText : colors.secondary;
            return (
              <Pressable
                key={item.key}
                accessibilityRole="tab"
                accessibilityLabel={item.title}
                accessibilityState={{ selected, disabled }}
                aria-selected={selected}
                disabled={disabled}
                onPress={() => {
                  if (selected) return;
                  haptic.select();
                  onChange(item.key);
                }}
                style={({ pressed }) => ({
                  flex: 1,
                  minWidth: 0,
                  minHeight: largeText ? 50 : layout.touch,
                  paddingVertical: 3,
                  paddingHorizontal: 1,
                  alignItems: 'center',
                  justifyContent: 'center',
                  gap: 1,
                  opacity: disabled ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1,
                })}
              >
                {item.key === 'home' ? (
                  <RunnerGlyph size={21} color={color} />
                ) : (
                  <Icon
                    name={selected ? (item.selectedIcon ?? item.icon) : item.icon}
                    size={20}
                    color={color}
                  />
                )}
                <Copy
                  variant="bodyCompact"
                  maxFontSizeMultiplier={1.55}
                  style={[
                    typography.tab,
                    {
                      fontWeight: selected ? '600' : '400',
                      color,
                      textAlign: 'center',
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

const styles = StyleSheet.create({
  dock: {
    alignSelf: 'center',
    width: '100%',
    maxWidth: 500,
  },
  row: { flexDirection: 'row' },
});

export const BottomTabs = memo(BottomTabsView) as typeof BottomTabsView;
