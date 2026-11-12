import { useEffect } from 'react';
import { View } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import Animated, { useAnimatedProps, useSharedValue, withTiming } from 'react-native-reanimated';
import { Copy } from './components';
import { useTheme } from './theme';
import { motion } from './tokens';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);
const diameter = 108;
const radius = 44;
const circumference = 2 * Math.PI * radius;

export function TargetRing({ value, animate }: { value: number | null; animate: boolean }) {
  const { colors, reduceMotion } = useTheme();
  const progress = value === null ? 0 : Math.min(100, Math.max(0, value)) / 100;
  const offset = useSharedValue(animate && !reduceMotion ? circumference : circumference * (1 - progress));
  useEffect(() => {
    const next = circumference * (1 - progress);
    offset.set(animate && !reduceMotion ? withTiming(next, { duration: motion.duration.slow }) : next);
  }, [animate, offset, progress, reduceMotion]);
  const animatedProps = useAnimatedProps(() => ({ strokeDashoffset: offset.get() }));

  return <View accessible accessibilityLabel={value === null ? 'Temps dans la cible indisponible' : Math.round(value) + ' pour cent du temps dans la cible'}
    style={{ width: diameter, height: diameter, alignItems: 'center', justifyContent: 'center' }}>
    <Svg accessible={false} width={diameter} height={diameter} style={{ position: 'absolute' }}>
      <Circle cx={54} cy={54} r={radius} stroke={colors.line} strokeWidth={7} fill="none" />
      {progress > 0 && <AnimatedCircle cx={54} cy={54} r={radius} stroke={colors.accentText} strokeWidth={7} fill="none"
        strokeDasharray={[circumference, circumference]} animatedProps={animatedProps} strokeLinecap="round" rotation={-90} origin="54,54" />}
    </Svg>
    <Copy variant="metric">{value === null ? '—' : Math.round(value) + '%'}</Copy>
  </View>;
}
