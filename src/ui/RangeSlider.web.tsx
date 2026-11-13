import React from 'react';
import type NativeSlider from '@react-native-community/slider';
import { useTheme } from './theme';
import { layout } from './tokens';

export default function RangeSlider(props: React.ComponentProps<typeof NativeSlider>) {
  const { colors } = useTheme();
  const value = props.value ?? 0;
  return React.createElement('input', {
    type: 'range',
    min: props.minimumValue,
    max: props.maximumValue,
    step: props.step,
    value,
    'aria-label': props.accessibilityLabel,
    disabled: props.disabled,
    style: {
      width: '100%',
      minHeight: layout.touch,
      margin: 0,
      accentColor: String(props.thumbTintColor ?? colors.accentText),
      cursor: 'pointer',
    },
    onChange: (event: React.ChangeEvent<HTMLInputElement>) =>
      props.onValueChange?.(Number(event.currentTarget.value)),
    onPointerUp: (event: React.PointerEvent<HTMLInputElement>) =>
      props.onSlidingComplete?.(Number(event.currentTarget.value)),
    onKeyUp: (event: React.KeyboardEvent<HTMLInputElement>) =>
      props.onSlidingComplete?.(Number(event.currentTarget.value)),
  });
}
