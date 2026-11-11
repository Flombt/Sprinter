import { memo, useEffect, useRef, useState } from 'react';
import { Animated, Platform, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Copy, IconButton } from './components';
import { useTheme } from './theme';
import { radii, spacing } from './tokens';

type ToastSeverity = 'info' | 'error';

export const Toast = memo(function Toast({ message, severity = 'info', covered = false, onClose }: {
  message: string | null;
  severity?: ToastSeverity;
  covered?: boolean;
  onClose: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const { top } = useSafeAreaInsets();
  const progress = useRef(new Animated.Value(0)).current;
  const [shown, setShown] = useState<{ message: string; severity: ToastSeverity } | null>(null);
  const visible = message !== null && !covered;

  useEffect(() => {
    if (visible && message !== null) setShown({ message, severity });
    const toValue = visible ? 1 : 0;
    if (reduceMotion) {
      progress.setValue(toValue);
      if (!visible) setShown(null);
      return;
    }
    const animation = Animated.timing(progress, {
      toValue,
      duration: 200,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start(({ finished }) => { if (finished && !visible) setShown(null); });
    return () => animation.stop();
  }, [message, severity, visible, reduceMotion, progress]);

  useEffect(() => {
    if (!visible || severity === 'error') return;
    const timeout = setTimeout(onClose, 4000);
    return () => clearTimeout(timeout);
  }, [message, severity, visible, onClose]);

  if (!shown) return null;
  const error = shown.severity === 'error';
  return <Animated.View
    accessibilityRole={error ? 'alert' : undefined}
    accessibilityLiveRegion={error ? 'assertive' : 'polite'}
    accessibilityElementsHidden={!visible}
    importantForAccessibility={visible ? 'auto' : 'no-hide-descendants'}
    aria-hidden={!visible}
    pointerEvents={visible ? 'auto' : 'none'}
    style={[styles.toast, {
      top: top + spacing.sm,
      backgroundColor: colors.raised,
      borderColor: error ? colors.danger : colors.line,
      shadowColor: colors.shadow,
      opacity: progress,
      transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-8, 0] }) }],
    }]}
  >
    <Copy variant="caption" style={{ flex: 1 }}>{shown.message}</Copy>
    <IconButton icon="close" label="Fermer le message" onPress={onClose} quiet />
  </Animated.View>;
});

const styles = StyleSheet.create({
  toast: {
    position: 'absolute', left: spacing.md, right: spacing.md, zIndex: 5,
    borderRadius: radii.card, borderWidth: 1, paddingLeft: spacing.lg, paddingVertical: spacing.sm,
    paddingRight: spacing.xs, flexDirection: 'row', alignItems: 'center', gap: spacing.sm,
    shadowOpacity: .15, shadowRadius: radii.control, elevation: 5,
  },
});
