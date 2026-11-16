import { useEffect, useRef } from 'react';
import { Animated, StyleSheet, View } from 'react-native';
import { Button, Copy, Icon } from './components';
import { useTheme } from './theme';
import { move } from './motion';

export function RunPauseButton({
  paused,
  autoPaused,
  disabled,
  onPress,
}: {
  paused: boolean;
  autoPaused: boolean;
  disabled: boolean;
  onPress: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const iconProgress = useRef(new Animated.Value(paused ? 0 : 1)).current;
  const labelOpacity = useRef(new Animated.Value(1)).current;
  const title = autoPaused ? 'Pause manuelle' : paused ? 'Reprendre' : 'Mettre en pause';

  useEffect(() => {
    if (reduceMotion) {
      iconProgress.setValue(paused ? 0 : 1);
      return;
    }
    const animation = move(iconProgress, paused ? 0 : 1, 120);
    animation.start();
    return () => animation.stop();
  }, [paused, reduceMotion, iconProgress]);

  useEffect(() => {
    if (reduceMotion) {
      labelOpacity.setValue(1);
      return;
    }
    labelOpacity.setValue(0.25);
    const animation = move(labelOpacity, 1, 120);
    animation.start();
    return () => animation.stop();
  }, [title, reduceMotion, labelOpacity]);

  return (
    <Button title={title} size="run" feedback="medium" disabled={disabled} onPress={onPress} highContrast>
      <View style={styles.row}>
        <Animated.View style={{ opacity: labelOpacity, flexShrink: 1 }}>
          <Copy
            variant="button"
            style={{ color: disabled ? colors.muted : colors.accentInk, fontWeight: '700' }}
          >
            {title}
          </Copy>
        </Animated.View>
        <View style={styles.icons}>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: iconProgress,
                transform: [
                  {
                    rotate: iconProgress.interpolate({ inputRange: [0, 1], outputRange: ['-90deg', '0deg'] }),
                  },
                ],
              },
            ]}
          >
            <Icon name="pause" color={disabled ? colors.muted : colors.accentInk} size={24} />
          </Animated.View>
          <Animated.View
            style={[
              StyleSheet.absoluteFill,
              {
                opacity: Animated.subtract(1, iconProgress),
                transform: [
                  {
                    rotate: iconProgress.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '90deg'] }),
                  },
                ],
              },
            ]}
          >
            <Icon name="play" color={disabled ? colors.muted : colors.accentInk} size={24} />
          </Animated.View>
        </View>
      </View>
    </Button>
  );
}

const styles = StyleSheet.create({
  icons: { width: 24, height: 24 },
  row: { flex: 1, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: 8 },
});
