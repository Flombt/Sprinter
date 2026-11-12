import { useEffect, useRef } from 'react';
import { Animated, AppState, Easing, Platform, Pressable, StyleSheet } from 'react-native';
import { Pressable as GesturePressable } from 'react-native-gesture-handler';
import { Copy, Icon } from './components';
import { useTheme } from './theme';
import { interaction, radii, spacing, iconSizes } from './tokens';

const holdDuration = 1000;
const FinishPressable = Platform.OS === 'web' ? Pressable : GesturePressable;

export function HoldToFinish({ disabled, onFinish }: { disabled: boolean; onFinish: (held?: boolean) => void }) {
  const { colors, reduceMotion } = useTheme();
  const progress = useRef(new Animated.Value(0)).current;
  const holding = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state !== 'active') {
        holding.current = false;
        progress.setValue(0);
      }
    });
    return () => { subscription.remove(); progress.stopAnimation(); };
  }, [progress]);

  useEffect(() => {
    if (disabled) holding.current = false;
    if (disabled || reduceMotion) progress.setValue(0);
  }, [disabled, progress, reduceMotion]);

  return <FinishPressable accessibilityRole="button" accessibilityLabel="Terminer la course"
    accessibilityHint="Maintenez une seconde pour enregistrer. Un appui simple ouvre la confirmation."
    accessibilityState={{ disabled }} disabled={disabled} delayLongPress={holdDuration}
    accessibilityActions={[{ name: 'activate', label: 'Confirmer la fin de la course' }]}
    onAccessibilityAction={event => {
      if (!disabled && event.nativeEvent.actionName === 'activate') onFinish();
    }}
    onPress={() => onFinish()}
    onPressIn={() => {
      holding.current = true;
      if (!reduceMotion) Animated.timing(progress, { toValue: 1, duration: holdDuration, easing: Easing.linear, useNativeDriver: Platform.OS !== 'web' }).start();
    }}
    onPressOut={() => { holding.current = false; progress.setValue(0); }}
    onLongPress={() => {
      if (!holding.current) return;
      holding.current = false;
      onFinish(true);
    }}
    style={({ pressed }) => [styles.button, { backgroundColor: colors.dangerSurface, borderColor: colors.danger,
      opacity: disabled ? interaction.disabledOpacity : pressed && reduceMotion ? interaction.pressedOpacity : 1 }]}>
    <Animated.View pointerEvents="none" accessible={false} style={{ position: 'absolute', bottom: 0, left: 0, right: 0,
      height: 5, backgroundColor: colors.danger, transformOrigin: 'left', transform: [{ scaleX: progress }] }} />
    <Icon name="stop-circle-outline" size={iconSizes.standard} color={colors.danger} />
    <Copy variant="emphasis" style={{ color: colors.danger, flexShrink: 1, textAlign: 'center' }}>Maintenir pour terminer</Copy>
  </FinishPressable>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing.sm, padding: spacing.sm, borderRadius: radii.control, borderWidth: 1, overflow: 'hidden',
  },
});
