import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, StyleSheet, View } from 'react-native';
import { QUALITY_LABELS, STATE_LABELS, type PaceState, type PaceTarget, type SignalQuality } from '../core/types';
import { Copy, Icon, type IconName } from './components';
import { paceGaugePosition } from './paceGaugePosition';
import { useTheme } from './theme';
import { radii, spacing } from './tokens';

const icons: Record<PaceState, IconName> = {
  onTarget: 'checkmark-circle-outline',
  tooFast: 'arrow-down',
  tooSlow: 'arrow-up',
  acquiring: 'navigate-circle-outline',
  unreliable: 'navigate-circle-outline',
  paused: 'pause-circle-outline',
  free: 'pulse-outline',
};
const cursorSize = 12;

export function PaceGauge({ value, target, tolerance, state, quality, running, autoPaused }: {
  value: number | null;
  target: Pick<PaceTarget, 'fast' | 'slow'> | null;
  tolerance: number;
  state: PaceState;
  quality: SignalQuality;
  running: boolean;
  autoPaused: boolean;
}) {
  const { colors, reduceMotion } = useTheme();
  const [width, setWidth] = useState(0);
  const translateX = useRef(new Animated.Value(0)).current;
  const positioned = useRef(false);
  const status = !running ? 'paused' : quality === 'good' ? state : 'unreliable';
  const label = autoPaused ? 'Pause automatique'
    : running && quality !== 'good' ? QUALITY_LABELS[quality] : STATE_LABELS[status];
  const color = status === 'tooFast' ? colors.orange : status === 'tooSlow' ? colors.blue
    : status === 'onTarget' ? colors.accentText : colors.secondary;
  const model = target ? paceGaugePosition(running && quality === 'good' ? value : null, target, tolerance) : null;
  const cursor = model?.cursor ?? null;

  useEffect(() => {
    if (cursor === null || width <= 0) {
      positioned.current = false;
      return;
    }
    const toValue = Math.max(0, width - cursorSize) * cursor;
    if (reduceMotion || !positioned.current) {
      positioned.current = true;
      translateX.setValue(toValue);
      return;
    }
    const animation = Animated.timing(translateX, {
      toValue,
      duration: 220,
      easing: Easing.out(Easing.back(.55)),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [cursor, width, reduceMotion, translateX]);

  return <View style={styles.container}>
    {model && <View
      accessible={false}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
      style={styles.rail}
    >
      <View style={[styles.line, { backgroundColor: colors.line }]} />
      {width > 0 && <View style={[styles.zone, {
        left: cursorSize / 2 + (width - cursorSize) * model.start - 2,
        width: Math.max(4, (width - cursorSize) * (model.end - model.start) + 4),
        backgroundColor: colors.accentText,
      }]} />}
      {cursor !== null && width > 0 && <Animated.View style={[styles.cursor, {
        backgroundColor: color,
        borderColor: colors.background,
        transform: [{ translateX }],
      }]} />}
    </View>}
    <View style={styles.status}>
      <Icon name={icons[status]} size={17} color={color} />
      <Copy variant="caption" accessibilityLiveRegion="polite" style={{ color, flexShrink: 1 }}>
        {label}
      </Copy>
    </View>
  </View>;
}

const styles = StyleSheet.create({
  container: { gap: spacing.xs, paddingHorizontal: spacing.xl },
  rail: { height: cursorSize, justifyContent: 'center', overflow: 'hidden' },
  line: { height: spacing.xs, borderRadius: radii.pill },
  zone: { position: 'absolute', height: spacing.xs, borderRadius: radii.pill },
  cursor: {
    position: 'absolute',
    width: cursorSize,
    height: cursorSize,
    borderWidth: 2,
    borderRadius: radii.pill,
  },
  status: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing.sm },
});
