import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Platform } from 'react-native';
import { useTheme } from './theme';
import { interaction } from './tokens';

/** One short entrance per mount, independent of live metrics or business state. */
export function ScreenEntrance({ children }: { children: ReactNode }) {
  const { reduceMotion } = useTheme(); const opacity = useRef(new Animated.Value(1)).current; const entered = useRef(false);
  useEffect(() => {
    const animate = !entered.current && !reduceMotion; entered.current = true;
    opacity.stopAnimation();
    if (!animate) { opacity.setValue(1); return; }
    opacity.setValue(.94);
    const animation = Animated.timing(opacity, { toValue: 1, duration: interaction.screenDuration, useNativeDriver: Platform.OS !== 'web' });
    animation.start();
    return () => animation.stop();
  }, [opacity, reduceMotion]);
  return <Animated.View style={{ flex: 1, minWidth: 0, opacity }}>{children}</Animated.View>;
}
