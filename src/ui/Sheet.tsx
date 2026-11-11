import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, BackHandler, PanResponder, Platform, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, IconButton } from './components';
import { useTheme } from './theme';
import { layout, radii, spacing } from './tokens';

export function Sheet({ title, onClose, children }: {
  title: string;
  onClose: () => void;
  children: ReactNode;
}) {
  const { colors, reduceMotion } = useTheme();
  const { bottom } = useSafeAreaInsets();
  const [expanded, setExpanded] = useState(false);
  const offset = useRef(new Animated.Value(reduceMotion ? 0 : 32)).current;

  const settle = useCallback((toValue: number, done?: () => void) => {
    if (reduceMotion) {
      offset.setValue(toValue);
      done?.();
      return;
    }
    Animated.timing(offset, { toValue, duration: 180, useNativeDriver: Platform.OS !== 'web' }).start(result => {
      if (result.finished) done?.();
    });
  }, [offset, reduceMotion]);

  const close = useCallback(() => settle(48, onClose), [onClose, settle]);
  useEffect(() => {
    settle(0);
    return () => offset.stopAnimation();
  }, [offset, settle]);
  useEffect(() => {
    const back = BackHandler.addEventListener('hardwareBackPress', () => {
      close();
      return true;
    });
    return () => back.remove();
  }, [close]);

  const pan = useMemo(() => PanResponder.create({
    onMoveShouldSetPanResponder: (_, gesture) => Math.abs(gesture.dy) > 8 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
    onPanResponderMove: (_, gesture) => {
      if (!reduceMotion) offset.setValue(Math.max(0, gesture.dy));
    },
    onPanResponderRelease: (_, gesture) => {
      if (gesture.dy > 96) {
        close();
        return;
      }
      if (gesture.dy < -36) setExpanded(true);
      if (gesture.dy > 36) setExpanded(false);
      settle(0);
    },
    onPanResponderTerminate: () => settle(0),
  }), [close, offset, reduceMotion, settle]);

  return <View style={styles.overlay}>
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={'Fermer ' + title}
      onPress={close}
      style={[StyleSheet.absoluteFill, { backgroundColor: colors.scrim }]}
    />
    <Animated.View accessibilityViewIsModal style={[styles.sheet, {
      maxHeight: expanded ? '94%' : '72%',
      backgroundColor: colors.surface,
      transform: [{ translateY: offset }],
    }]}>
      <View {...pan.panHandlers}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? 'Réduire la feuille' : 'Agrandir la feuille'}
          accessibilityHint="Touchez ou faites glisser la poignée."
          accessibilityState={{ expanded }}
          onPress={() => setExpanded(value => !value)}
          style={styles.handleTouch}
        >
          <View style={[styles.handle, { backgroundColor: colors.controlLine }]} />
        </Pressable>
        <View style={styles.header}>
          <Copy accessibilityRole="header" variant="heading" style={{ flex: 1 }}>{title}</Copy>
          <IconButton icon="close" label={'Fermer ' + title} onPress={close} quiet />
        </View>
      </View>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
        automaticallyAdjustKeyboardInsets
        contentContainerStyle={{
          gap: spacing.lg,
          paddingHorizontal: spacing.xl,
          paddingBottom: Math.max(bottom, spacing.xl),
        }}
      >
        {children}
      </ScrollView>
    </Animated.View>
  </View>;
}

const styles = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFill, zIndex: 4, justifyContent: 'flex-end' },
  sheet: { borderTopLeftRadius: radii.hero, borderTopRightRadius: radii.hero, overflow: 'hidden' },
  handleTouch: { alignItems: 'center', justifyContent: 'center', minHeight: layout.touch },
  handle: { width: spacing.xxxl, height: spacing.xs, borderRadius: radii.pill },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing.xl, paddingBottom: spacing.sm },
});
