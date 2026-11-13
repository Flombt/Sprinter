import { useEffect, useRef, type ReactNode } from 'react';
import { AppState, View } from 'react-native';
import { IconButton, styles } from './components';
import { haptic } from './haptics';
import { paceStep } from './paceStep';
import { useAdaptiveLayout } from './theme';
import { spacing } from './tokens';

function PaceStepButton({
  direction,
  value,
  disabled,
  onChange,
}: {
  direction: -1 | 1;
  value: number;
  disabled: boolean;
  onChange: (value: number) => void;
}) {
  const latest = useRef({ value, onChange });
  const repeated = useRef(false);
  const pressedAt = useRef(0);
  const timer = useRef<ReturnType<typeof setInterval> | null>(null);
  latest.current = { value, onChange };

  const stop = () => {
    if (timer.current !== null) clearInterval(timer.current);
    timer.current = null;
  };

  useEffect(() => {
    if (disabled) stop();
  }, [disabled]);
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (state) => {
      if (state !== 'active') stop();
    });
    return () => {
      subscription.remove();
      stop();
    };
  }, []);

  const apply = (heldFor: number) => {
    const next = paceStep(latest.current.value, direction, heldFor);
    if (next === latest.current.value) return;
    latest.current.value = next;
    haptic.select();
    latest.current.onChange(next);
  };
  return (
    <IconButton
      square
      icon={direction < 0 ? 'remove' : 'add'}
      label={
        direction < 0
          ? 'Accélérer l’allure de cinq secondes par kilomètre'
          : 'Ralentir l’allure de cinq secondes par kilomètre'
      }
      disabled={disabled}
      feedback="none"
      delayLongPress={350}
      onPressIn={() => {
        repeated.current = false;
        pressedAt.current = Date.now();
      }}
      onPressOut={stop}
      onPress={() => {
        if (!repeated.current) apply(0);
      }}
      onLongPress={() => {
        repeated.current = true;
        apply(0);
        timer.current = setInterval(() => apply(Date.now() - pressedAt.current), 170);
      }}
    />
  );
}

export function PaceStepper({
  value,
  disabled = false,
  onChange,
  children,
}: {
  value: number;
  disabled?: boolean;
  onChange: (value: number) => void;
  children: ReactNode;
}) {
  const { compact, largeText } = useAdaptiveLayout();
  const decrement = (
    <PaceStepButton direction={-1} value={value} disabled={disabled || value <= 120} onChange={onChange} />
  );
  const increment = (
    <PaceStepButton direction={1} value={value} disabled={disabled || value >= 1200} onChange={onChange} />
  );
  if (largeText || compact) {
    return (
      <View style={{ gap: spacing.md }}>
        {children}
        <View style={[styles.row, { justifyContent: 'center', gap: spacing.xxl }]}>
          {decrement}
          {increment}
        </View>
      </View>
    );
  }
  return (
    <View style={[styles.row, { justifyContent: 'space-between', gap: spacing.md }]}>
      {decrement}
      <View style={{ flex: 1, minWidth: 0 }}>{children}</View>
      {increment}
    </View>
  );
}
