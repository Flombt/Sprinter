import { useEffect, useRef } from 'react';
import { Animated, Platform, StyleSheet, View } from 'react-native';
import Svg, { Circle, Path } from 'react-native-svg';
import { Copy } from './components';
import { useTheme } from './theme';

const size = 108;
const center = size / 2;
const radius = 44;
const circumference = 2 * Math.PI * radius;
const steps = 20;

export function TargetRing({ percentage }: { percentage: number | null }) {
  const { colors, reduceMotion } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const animated = !reduceMotion && percentage !== null && percentage > 0;
  const label = percentage === null ? '—' : Math.round(percentage) + ' %';

  useEffect(() => {
    if (!animated) return;
    progress.setValue(0);
    const animation = Animated.timing(progress, {
      toValue: 1,
      duration: 700,
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [animated, percentage, progress]);

  return <View accessible accessibilityLabel={'Temps dans la cible ' + label} style={styles.ring}>
    <Svg width={size} height={size} style={StyleSheet.absoluteFill} accessible={false}>
      <Circle cx={center} cy={center} r={radius} stroke={colors.line} strokeWidth={7} fill="none" />
      {!animated && percentage !== null && percentage > 0 && <Circle
        cx={center}
        cy={center}
        r={radius}
        stroke={colors.accentText}
        strokeWidth={7}
        fill="none"
        strokeDasharray={[circumference * percentage / 100, circumference]}
        strokeLinecap="round"
        rotation={-90}
        origin="54,54"
      />}
    </Svg>
    {animated && Array.from({ length: steps }, (_, index) => {
      const start = (index / steps * percentage / 100 - .25) * 2 * Math.PI;
      const end = ((index + 1) / steps * percentage / 100 - .25) * 2 * Math.PI;
      const from = [center + Math.cos(start) * radius, center + Math.sin(start) * radius];
      const to = [center + Math.cos(end) * radius, center + Math.sin(end) * radius];
      const opacity = progress.interpolate({
        inputRange: [index / steps, (index + 1) / steps],
        outputRange: [0, 1],
        extrapolate: 'clamp',
      });
      return <Animated.View key={index} style={[StyleSheet.absoluteFill, { opacity }]} pointerEvents="none">
        <Svg width={size} height={size} accessible={false}>
          <Path d={`M ${from.join(' ')} A ${radius} ${radius} 0 0 1 ${to.join(' ')}`}
            stroke={colors.accentText} strokeWidth={7} strokeLinecap="round" fill="none" />
        </Svg>
      </Animated.View>;
    })}
    <Copy variant="metric">{label}</Copy>
  </View>;
}

const styles = StyleSheet.create({
  ring: { width: size, height: size, alignItems: 'center', justifyContent: 'center' },
});
