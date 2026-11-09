import React, { forwardRef, useState } from 'react';
import { Platform, Pressable, StyleSheet, Switch as NativeSwitch, TextInput as NativeInput, View, type StyleProp, type ViewStyle } from 'react-native';
import { Picker as NativePicker, type PickerProps } from '@react-native-picker/picker';
import { Copy, Label } from './components';
import { useAdaptiveLayout, useTheme } from './theme';
import { interaction, layout, radii, spacing, typography } from './tokens';

export type InputProps = React.ComponentProps<typeof NativeInput> & { invalid?: boolean };
/** The native input stays controlled by its caller; parsing/validation belongs to each feature. */
export const Input = forwardRef<React.ComponentRef<typeof NativeInput>, InputProps>(function Input({ style, invalid = false, onFocus, onBlur, editable = true, accessibilityState, accessibilityHint, ...props }, ref) {
  const { colors } = useTheme(); const [focused, setFocused] = useState(false);
  return <NativeInput ref={ref} allowFontScaling placeholderTextColor={colors.muted} selectionColor={colors.accentText}
    {...props} accessibilityHint={accessibilityHint ?? (invalid ? 'Valeur à corriger.' : undefined)} editable={editable}
    accessibilityState={{ ...accessibilityState, disabled: !editable }}
    onFocus={event => { setFocused(true); onFocus?.(event); }} onBlur={event => { setFocused(false); onBlur?.(event); }}
    style={[typography.body, { minWidth: 0, minHeight: props.multiline ? layout.multiline : layout.input,
      backgroundColor: colors.field, color: colors.text, borderWidth: 1.5, borderColor: colors.controlLine,
      borderRadius: radii.control, paddingHorizontal: spacing.md, paddingVertical: spacing.md,
      textAlignVertical: props.multiline ? 'top' : 'center', opacity: editable ? 1 : interaction.disabledOpacity }, style,
      (focused || invalid) && { borderColor: invalid ? colors.danger : colors.accentText }]} />;
});
export function TextField({ label, description, error, style, ...props }: Omit<InputProps, 'style'> & { label: string; description?: string; error?: string; style?: StyleProp<ViewStyle> }) {
  const { colors } = useTheme();
  return <View style={[{ gap: spacing.sm }, style]}>
    <Label>{label}</Label><Input {...props} accessibilityLabel={props.accessibilityLabel ?? label}
      accessibilityHint={props.accessibilityHint ?? error ?? description} invalid={props.invalid || !!error} />
    {(error || description) && <Copy variant="caption" muted={!error} accessibilityRole={error ? 'alert' : undefined}
      style={error ? { color: colors.danger } : undefined}>{error ?? description}</Copy>}
  </View>;
}

export function Switch({ trackColor, accessibilityState, style, ...props }: React.ComponentProps<typeof NativeSwitch>) {
  const { colors } = useTheme();
  return <View style={{ minHeight: layout.touch, minWidth: 52, justifyContent: 'center', alignItems: 'center', flexShrink: 0 }}>
    <NativeSwitch hitSlop={{ top: 7, bottom: 7, left: 0, right: 0 }} {...props} accessibilityState={{ ...accessibilityState, disabled: props.disabled, checked: props.value }}
      trackColor={{ false: colors.line, true: colors.switchOn, ...trackColor }} thumbColor={colors.switchThumb}
      ios_backgroundColor={colors.line} style={style} />
  </View>;
}
export function Toggle({ title, body, value, onChange, disabled = false }: { title: string; body?: string; value: boolean; onChange: (value: boolean) => void; disabled?: boolean }) {
  return <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.lg, minHeight: layout.input }}>
    <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}><Copy variant="emphasis">{title}</Copy>
      {body && <Copy variant="caption" muted>{body}</Copy>}</View>
    <Switch accessibilityLabel={title} accessibilityHint={body} value={value} disabled={disabled} onValueChange={onChange} />
  </View>;
}

export interface ChoiceGroupProps<T extends string | number> {
  value: T; choices: readonly (readonly [T, string])[]; onChange: (value: T) => void; label?: string; disabled?: boolean;
}
export function ChoiceGroup<T extends string | number>({ value, choices, onChange, label, disabled = false, segmented = false }: ChoiceGroupProps<T> & { segmented?: boolean }) {
  const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  return <View accessible={false} accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: segmented ? spacing.xs : spacing.sm,
    ...(segmented ? { borderRadius: radii.control + spacing.xs, backgroundColor: colors.raised, padding: spacing.xs } : {}) }}>
    {choices.map(([key, title]) => {
      const selected = key === value;
      return <Pressable key={key} accessibilityRole="radio" accessibilityLabel={title} accessibilityState={{ checked: selected, disabled }}
        disabled={disabled} onPress={() => onChange(key)} style={({ pressed }) => ({
          minHeight: layout.touch, minWidth: layout.touch, borderRadius: radii.control, borderWidth: 1,
          paddingHorizontal: spacing.md, paddingVertical: spacing.sm, justifyContent: 'center',
          backgroundColor: selected ? segmented ? colors.surface : colors.accentSoft : segmented ? 'transparent' : colors.surface,
          borderColor: selected ? colors.accentText : segmented ? 'transparent' : colors.controlLine,
          ...(segmented && !largeText ? { flexGrow: 1, flexBasis: 0 } : {}),
          opacity: disabled ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1,
        })}><Copy variant="caption" style={{ color: selected ? colors.accentText : colors.secondary, fontWeight: selected ? '700' : '500', textAlign: 'center' }}>{title}</Copy></Pressable>;
    })}
  </View>;
}
export function SegmentedControl<T extends string | number>(props: ChoiceGroupProps<T>) { return <ChoiceGroup {...props} segmented />; }

function ThemedPicker<T>(props: PickerProps<T>) {
  const { colors } = useTheme(); const { fontScale, largeText } = useAdaptiveLayout();
  // This installed iOS picker uses scaleMultiplier:1; it does not scale its explicit font itself.
  const iosType = Platform.OS === 'ios' ? { fontSize: (StyleSheet.flatten(props.itemStyle)?.fontSize ?? typography.body.fontSize) * fontScale,
    height: 216 * Math.max(1, fontScale / 1.5) } : null;
  return <View pointerEvents={props.enabled === false ? 'none' : 'auto'} style={{ borderWidth: 1, borderColor: colors.controlLine, backgroundColor: colors.field,
    borderRadius: radii.control, overflow: 'hidden', opacity: props.enabled === false ? interaction.disabledOpacity : 1 }}>
    <NativePicker {...props} numberOfLines={props.numberOfLines ?? (largeText ? 3 : 1)} accessibilityState={{ ...props.accessibilityState, disabled: props.enabled === false }}
      style={[{ minHeight: layout.input, color: colors.text, backgroundColor: colors.field }, props.style]}
      itemStyle={[typography.body, { color: colors.text }, props.itemStyle, iosType]} />
  </View>;
}
/** Keep native wheel/dropdown semantics and the existing Picker.Item API. */
export const Picker = Object.assign(ThemedPicker, { Item: NativePicker.Item });
