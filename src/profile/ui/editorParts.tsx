// Briques du studio de profil : pastilles accessibles, champs à brouillon immédiat, recadrage sans geste.
// Les commandes gardent le style Sprinter (§17.3) ; seule la page de profil prend le thème choisi.
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import RangeSlider from '../../ui/RangeSlider';
import { Copy, type IconName } from '../../ui/components';
import { TextField } from '../../ui/controls';
import { useTheme } from '../../ui/theme';
import { layout, radii, spacing } from '../../ui/tokens';
import type { Crop } from '../model';

export function Chip({ label, selected = false, onPress, icon, swatch, disabled = false, role = 'radio' }: {
  label: string; selected?: boolean; onPress: () => void; icon?: IconName; swatch?: string[]; disabled?: boolean; role?: 'radio' | 'button' | 'checkbox';
}) {
  const { colors } = useTheme();
  return (
    <Pressable onPress={onPress} disabled={disabled} accessibilityRole={role} accessibilityLabel={label}
      accessibilityState={role === 'button' ? { disabled } : { selected, checked: selected, disabled }}
      style={({ pressed }) => [styles.chip, {
        borderColor: selected ? colors.accentText : colors.controlLine, backgroundColor: selected ? colors.accentSoft : colors.field,
        opacity: disabled ? 0.45 : pressed ? 0.75 : 1, borderWidth: selected ? 2 : 1,
      }]}>
      {swatch ? (
        <View style={styles.swatches}>
          {swatch.map((color, index) => <View key={`${color}${index}`} style={[styles.dot, { backgroundColor: color, borderColor: colors.controlLine }]} />)}
        </View>
      ) : null}
      {icon ? <Ionicons name={icon} size={18} color={colors.text} /> : null}
      <Text style={{ color: colors.text, fontSize: 14, lineHeight: 20, fontWeight: selected ? '700' : '500' }}>{label}</Text>
      {selected ? <Ionicons name="checkmark" size={16} color={colors.accentText} /> : null}
    </Pressable>
  );
}

export function ChipRow({ children, label }: { children: React.ReactNode; label?: string }) {
  return <View style={styles.row} accessibilityRole={label ? 'radiogroup' : undefined} accessibilityLabel={label}>{children}</View>;
}

export function PanelTitle({ title, body }: { title: string; body?: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: spacing.xs }}>
      <Text style={{ color: colors.text, fontSize: 17, lineHeight: 24, fontWeight: '700' }} accessibilityRole="header">{title}</Text>
      {body ? <Copy muted variant="caption">{body}</Copy> : null}
    </View>
  );
}

/** Champ texte enregistré dans le brouillon après une courte pause, et au départ de l'écran. */
export function DraftField({ label, value, max, onCommit, multiline = false, placeholder, description }: {
  label: string; value: string; max: number; onCommit: (value: string) => void; multiline?: boolean; placeholder?: string; description?: string;
}) {
  const [text, setText] = useState(value);
  const pending = useRef<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const commit = useRef(onCommit);
  commit.current = onCommit;
  useEffect(() => { if (pending.current === null) setText(value); }, [value]);
  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    if (pending.current !== null) commit.current(pending.current);
  }, []);
  const change = (next: string) => {
    const bounded = [...next].slice(0, max).join('');
    setText(bounded);
    pending.current = bounded;
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { timer.current = null; const latest = pending.current; pending.current = null; if (latest !== null) commit.current(latest); }, 350);
  };
  const remaining = max - [...text].length;
  return (
    <TextField label={label} value={text} onChangeText={change} multiline={multiline} placeholder={placeholder}
      description={`${description ? `${description} · ` : ''}${remaining} caractère${remaining > 1 ? 's' : ''} restant${remaining > 1 ? 's' : ''}`}
      style={multiline ? { minHeight: layout.multiline } : undefined} />
  );
}

/** Recadrage : zoom et déplacement par commandes accessibles (lecteur d'écran, clavier). */
export function CropControls({ crop, onChange, label }: { crop: Crop; onChange: (crop: Crop) => void; label: string }) {
  const { colors } = useTheme();
  const step = 0.1;
  const clamp = (value: number) => Math.max(-1, Math.min(1, Math.round(value * 100) / 100));
  const move = (dx: number, dy: number) => onChange({ ...crop, x: clamp(crop.x + dx), y: clamp(crop.y + dy) });
  const arrow = (icon: IconName, title: string, dx: number, dy: number) => (
    <Pressable onPress={() => move(dx, dy)} accessibilityRole="button" accessibilityLabel={title}
      style={({ pressed }) => [styles.arrow, { borderColor: colors.controlLine, backgroundColor: colors.field, opacity: pressed ? 0.7 : 1 }]}>
      <Ionicons name={icon} size={20} color={colors.text} />
    </Pressable>
  );
  return (
    <View style={{ gap: spacing.sm }}>
      <Copy variant="caption" muted>{label} · zoom ×{crop.zoom.toFixed(1)}</Copy>
      <RangeSlider value={crop.zoom} minimumValue={1} maximumValue={4} step={0.1} onSlidingComplete={(zoom: number) => onChange({ ...crop, zoom })}
        accessibilityLabel={`Zoom de ${label.toLowerCase()}`} />
      <View style={styles.row}>
        {arrow('arrow-back', 'Déplacer vers la gauche', -step, 0)}
        {arrow('arrow-forward', 'Déplacer vers la droite', step, 0)}
        {arrow('arrow-up', 'Déplacer vers le haut', 0, -step)}
        {arrow('arrow-down', 'Déplacer vers le bas', 0, step)}
        <Chip role="button" label="Recentrer" icon="scan-outline" onPress={() => onChange({ x: 0, y: 0, zoom: 1 })} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  chip: { minHeight: layout.touch, flexDirection: 'row', alignItems: 'center', gap: spacing.sm, borderRadius: radii.pill, paddingHorizontal: spacing.md },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  swatches: { flexDirection: 'row' },
  dot: { width: 18, height: 18, borderRadius: 9, borderWidth: StyleSheet.hairlineWidth, marginRight: -4 },
  arrow: { width: layout.touch, height: layout.touch, borderRadius: radii.control, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
