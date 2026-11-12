import { useEffect, useState, type ReactNode } from 'react';
import { Pressable, View } from 'react-native';
import Slider from './RangeSlider';
import { Copy, Divider, Icon, Panel, styles, type IconName } from './components';
import { useAdaptiveLayout, useTheme } from './theme';
import { useAnimateLayoutChange } from './layoutAnimation';
import { interaction, layout, radii, spacing, fontWeights, iconSizes } from './tokens';

/** Collapsed settings keep a live summary; controls remain ordinary native inputs. */
export function SettingsDisclosure({ title, summary, icon, children, defaultOpen = false }: {
  title: string; summary?: string; icon?: IconName; children: ReactNode; defaultOpen?: boolean;
}) {
  const [expanded, setExpanded] = useState(defaultOpen); const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  const animateLayout = useAnimateLayoutChange();
  return <Panel variant="setting" style={{ gap: spacing.lg }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${title}${summary ? `. ${summary}` : ''}`} accessibilityHint={expanded ? 'Masquer les options.' : 'Afficher les options.'}
      accessibilityState={{ expanded }} onPress={() => { animateLayout(); setExpanded(value => !value); }}
      style={({ pressed }) => ({ flexDirection: 'row', alignItems: 'center', gap: spacing.md, minHeight: layout.touch, opacity: pressed ? interaction.pressedOpacity : 1 })}>
      {icon && !largeText && <Icon name={icon} size={iconSizes.standard} color={colors.accentText} />}
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <Copy variant="emphasis">{title}</Copy>{summary && <Copy muted variant="caption">{summary}</Copy>}
      </View><Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={iconSizes.small} color={colors.secondary} />
    </Pressable>
    {expanded && <><Divider /><View style={{ gap: spacing.lg }}>{children}</View></>}
  </Panel>;
}

export function SettingRange({ title, description, value, min, max, step = 1, unit = 's', onChange }: {
  title: string; description?: string; value: number; min: number; max: number; step?: number; unit?: string; onChange: (value: number) => void;
}) {
  const { colors } = useTheme(); const [local, setLocal] = useState(value);
  useEffect(() => setLocal(value), [value]);
  return <View style={{ gap: spacing.sm }}>
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}>
      <Copy variant="emphasis" style={{ flexShrink: 1 }}>{title}</Copy>
      <View style={{ borderRadius: radii.sm, backgroundColor: colors.raised, paddingHorizontal: spacing.sm, paddingVertical: spacing.xs }}>
        <Copy variant="caption" style={{ fontWeight: fontWeights.semibold, fontVariant: ['tabular-nums'] }}>{local} {unit}</Copy>
      </View>
    </View>
    {description && <Copy muted variant="caption">{description}</Copy>}
    <Slider accessibilityLabel={title} accessibilityHint={description} accessibilityValue={{ min, max, now: local, text: `${local} ${unit}` }}
      minimumValue={min} maximumValue={max} step={step} value={local} onValueChange={setLocal} onSlidingComplete={onChange} />
  </View>;
}

export function SettingsNotice({ title, body, icon = 'information-circle-outline', children }: {
  title: string; body: string; icon?: IconName; children?: ReactNode;
}) {
  const { colors } = useTheme();
  return <Panel variant="setting" style={{ gap: spacing.md, backgroundColor: colors.raised }}>
    <View style={[styles.row, { gap: spacing.md, alignItems: 'flex-start' }]}>
      <Icon name={icon} color={colors.secondary} size={iconSizes.standard} />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}><Copy variant="emphasis">{title}</Copy><Copy muted variant="caption">{body}</Copy></View>
    </View>{children}
  </Panel>;
}
