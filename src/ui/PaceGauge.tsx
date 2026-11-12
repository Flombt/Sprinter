import { useLayoutEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, View } from 'react-native';
import { pace } from '../core/format';
import { STATE_LABELS, type PaceState, type PaceTarget, type RunRecord } from '../core/types';
import { paceTargetAt } from '../pacing/goals';
import { effectiveTarget } from '../workouts/definition';
import { BodyText, DisplayText } from './design';
import { paceGaugePosition } from './paceGaugePosition';
import { useTheme } from './theme';
import { palettes, spacing, fontSizes, fontWeights } from './tokens';

const cursorSize = 22;
const railHeight = 9;

export function paceGaugeTarget(run: RunRecord) {
  const workout = run.workout;
  const block = workout?.segments[workout.currentIndex];
  return workout ? workout.status === 'running' && block ? effectiveTarget(block.planned) : null
    : paceTargetAt(run.target, run.distanceMeters);
}

export function PaceGauge({ target, tolerance, value, status, paper = false, compact = false }: {
  target: Pick<PaceTarget, 'fast' | 'slow'> | null; tolerance: number;
  value: number | null; status: PaceState; paper?: boolean; compact?: boolean;
}) {
  const { colors: theme, reduceMotion } = useTheme();
  const colors = paper ? palettes.light : theme;
  const zone = status === 'tooFast' ? colors.danger : status === 'tooSlow' ? colors.blue : status === 'onTarget' ? colors.paceInTarget : colors.text;
  const text = pace(value);
  const gauge = target ? paceGaugePosition(text === '—' ? null : value, target, tolerance) : null;
  const [width, setWidth] = useState(0);
  const usableWidth = Math.max(0, width - cursorSize);
  const cursor = usableWidth && gauge?.cursor != null ? gauge.cursor * usableWidth : null;
  const x = useRef(new Animated.Value(0)).current;
  const previousWidth = useRef(0);

  useLayoutEffect(() => {
    const sameWidth = previousWidth.current === usableWidth;
    previousWidth.current = cursor === null ? 0 : usableWidth;
    if (cursor === null) return;
    if (reduceMotion || !sameWidth) { x.setValue(cursor); return; }
    const animation = Animated.timing(x, {
      toValue: cursor, duration: 900, easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web', isInteraction: false,
    });
    animation.start();
    return () => animation.stop();
  }, [cursor, reduceMotion, usableWidth, x]);

  return <View accessible accessibilityLabel={`Allure actuelle : ${text === '—' ? 'indisponible' : text + ' par kilomètre'}. ${STATE_LABELS[status]}`}>
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'baseline', gap: spacing.sm }}>
      <DisplayText numeric style={{ fontSize: compact ? fontSizes.metric : fontSizes.pace, lineHeight: compact ? 34 : 83, color: zone, letterSpacing: compact ? 0 : -1.5 }}>{text}</DisplayText>
      <BodyText style={{ fontSize: fontSizes.small, color: colors.secondary }}>min / km</BodyText>
      <BodyText style={{ fontSize: fontSizes.caption, color: zone, fontWeight: fontWeights.semibold }}>{STATE_LABELS[status]}</BodyText>
    </View>
    {gauge && <View onLayout={event => setWidth(event.nativeEvent.layout.width)} style={{ height: cursorSize, justifyContent: 'center' }}>
      <View style={{ height: railHeight, marginHorizontal: cursorSize / 2, borderRadius: railHeight / 2, backgroundColor: colors.controlLine }} />
      {usableWidth > 0 && <View style={{ position: 'absolute', left: cursorSize / 2 + gauge.start * usableWidth - 2,
        width: (gauge.end - gauge.start) * usableWidth + 4, height: railHeight, borderRadius: railHeight / 2, backgroundColor: colors.accentText }} />}
      {cursor !== null && <Animated.View style={{ position: 'absolute', left: 0, width: cursorSize, height: cursorSize,
        borderRadius: cursorSize / 2, backgroundColor: zone, borderWidth: 2, borderColor: paper ? colors.background : theme.background,
        transform: [{ translateX: x }] }} />}
    </View>}
  </View>;
}
