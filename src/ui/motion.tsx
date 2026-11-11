import { useEffect, useRef, type ReactNode } from 'react';
import { Animated, Easing, Platform } from 'react-native';
import { useTheme } from './theme';
import { interaction } from './tokens';

export function PageTransition({ children }: { children: ReactNode }) {
  const { reduceMotion } = useTheme();
  const progress = useRef(new Animated.Value(reduceMotion ? 1 : 0)).current;

  useEffect(() => {
    if (reduceMotion) {
      progress.setValue(1);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 200,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [progress, reduceMotion]);

  return <Animated.View style={{
    flex: 1,
    opacity: progress,
    transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) }],
  }}>
    {children}
  </Animated.View>;
}

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
