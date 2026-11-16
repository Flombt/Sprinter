import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useTheme } from './theme';
import { interaction } from './tokens';

export function move(value: Animated.Value, toValue: number, duration: number) {
  return Animated.timing(value, {
    toValue,
    duration,
    easing: Easing.out(Easing.cubic),
    useNativeDriver: Platform.OS !== 'web',
  });
}

/** One short entrance per mount, independent of live metrics or business state. */
export function ScreenEntrance({ children }: { children: ReactNode }) {
  const { reduceMotion } = useTheme();
  const opacity = useRef(new Animated.Value(1)).current;
  const entered = useRef(false);
  useEffect(() => {
    const animate = !entered.current && !reduceMotion;
    entered.current = true;
    opacity.stopAnimation();
    if (!animate) {
      opacity.setValue(1);
      return;
    }
    opacity.setValue(0.94);
    const animation = move(opacity, 1, interaction.screenDuration);
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View style={{ flex: 1, minWidth: 0, opacity }}>{children}</Animated.View>;
}
