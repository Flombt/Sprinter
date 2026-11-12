import { useCallback, useLayoutEffect, useState } from 'react';
import { LayoutAnimation, Platform } from 'react-native';
import { useTheme } from './theme';
import { motion } from './tokens';

export function useAnimateLayoutChange() {
  const { reduceMotion } = useTheme();
  return useCallback(() => {
    if (!reduceMotion && Platform.OS !== 'web') {
      LayoutAnimation.configureNext(LayoutAnimation.create(motion.duration.standard, 'easeInEaseOut', 'opacity'));
    }
  }, [reduceMotion]);
}

// Keep the old layout until the next commit when visibility comes from an external store.
export function useAnimatedVisibility(visible: boolean) {
  const animateLayout = useAnimateLayoutChange();
  const [shown, setShown] = useState(visible);
  useLayoutEffect(() => {
    if (visible === shown) return;
    animateLayout();
    setShown(visible);
  }, [animateLayout, shown, visible]);
  return shown;
}
