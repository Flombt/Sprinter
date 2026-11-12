import { Pressable, StyleSheet, type PressableProps } from 'react-native';
import { interaction } from './tokens';

export function FeedbackPressable({ disabled, style, ...props }: PressableProps) {
  return <Pressable {...props} disabled={disabled} style={state => {
    const base = typeof style === 'function' ? style(state) : style;
    if (disabled || !state.pressed) return base;
    return [base, { opacity: (StyleSheet.flatten(base)?.opacity ?? 1) * interaction.pressedOpacity }];
  }} />;
}
