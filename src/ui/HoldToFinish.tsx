import { useEffect, useRef } from 'react';
import { Animated, AppState, Easing, Platform, Pressable, StyleSheet, type KeyDownEvent } from 'react-native';
import { Copy, Icon } from './components';
import { haptic } from './haptics';
import { useTheme } from './theme';
import { interaction, radii, spacing } from './tokens';

const holdDuration = 1000;
const finishAction = [{ name: 'activate', label: 'Confirmer la fin de la course' }];

export function HoldToFinish({ disabled, onFinish, onConfirm }: {
  disabled: boolean;
  onFinish: () => void;
  onConfirm: () => void;
}) {
  const { colors, reduceMotion } = useTheme();
  const fill = useRef(new Animated.Value(0)).current;
  const pressed = useRef(false);
  const finishIssued = useRef(false);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', state => {
      if (state === 'active') return;
      pressed.current = false;
      fill.setValue(0);
    });
    return () => {
      subscription.remove();
      fill.stopAnimation();
    };
  }, [fill]);

  useEffect(() => {
    if (disabled || reduceMotion) {
      pressed.current = false;
      fill.setValue(0);
    }
    if (!disabled) finishIssued.current = false;
  }, [disabled, reduceMotion, fill]);

  const animate = (toValue: number, duration: number) => {
    if (reduceMotion) {
      fill.setValue(toValue);
      return;
    }
    Animated.timing(fill, {
      toValue,
      duration,
      easing: Easing.linear,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
  };
  const startHold = () => {
    if (disabled || finishIssued.current) return;
    pressed.current = true;
    haptic.light();
    if (!reduceMotion) animate(1, holdDuration);
  };
  const release = () => {
    pressed.current = false;
    if (!finishIssued.current) animate(0, 150);
  };
  const validate = () => {
    if (disabled || !pressed.current || finishIssued.current) return;
    finishIssued.current = true;
    fill.setValue(1);
    onFinish();
  };
  const keyboard = Platform.OS === 'web' ? { onKeyDown: (event: KeyDownEvent) => {
    if (event.nativeEvent.key !== 'Enter' && event.nativeEvent.key !== ' ') return;
    event.preventDefault();
    if (!disabled && !event.nativeEvent.repeat) onConfirm();
  } } : {};

  return <Pressable
    {...keyboard}
    accessibilityRole="button"
    accessibilityLabel="Terminer la course"
    accessibilityHint="Maintenez pour enregistrer votre sortie. Avec VoiceOver, activez pour confirmer."
    accessibilityState={{ disabled }}
    accessibilityActions={finishAction}
    onAccessibilityAction={event => {
      if (event.nativeEvent.actionName === 'activate' && !disabled) onConfirm();
    }}
    disabled={disabled}
    delayLongPress={holdDuration}
    onPressIn={startHold}
    onLongPress={validate}
    onPressOut={release}
    style={[styles.button, {
      backgroundColor: colors.raised,
      borderColor: colors.line,
      opacity: disabled ? interaction.disabledOpacity : 1,
    }]}
  >
    <Animated.View
      pointerEvents="none"
      accessible={false}
      style={[StyleSheet.absoluteFill, {
        backgroundColor: colors.accentSoft,
        transformOrigin: 'left',
        transform: [{ scaleX: fill }],
      }]}
    />
    <Icon name="stop-outline" size={19} color={colors.text} />
    <Copy variant="caption" style={{ flexShrink: 1 }}>Maintenez pour terminer</Copy>
  </Pressable>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.button,
    borderWidth: 1,
    overflow: 'hidden',
  },
});
