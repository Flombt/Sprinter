import { ChoiceGroup, Input, Switch } from '../ui/controls';
import { useEffect, useState } from 'react';
import { View } from 'react-native';
import type { PaceTarget } from '../core/types';
import { DEFAULT_TARGET } from '../core/types';
import { duration, km, pace } from '../core/format';
import { Copy, Label, Panel, styles } from '../ui/components';
import { useTheme } from '../ui/theme';

const paceText = (value: number) => Number.isFinite(value) ? `${Math.floor(value / 60)}:${String(Math.round(value % 60)).padStart(2, '0')}` : '';
export function PacingNumberInput({ label, value, onChange, kind = 'number' }: { label: string; value: number; onChange: (value: number) => void; kind?: 'number' | 'pace' | 'time' }) {
  const { colors } = useTheme();
  const format = (n: number) => !Number.isFinite(n) ? '' : kind === 'pace' ? paceText(n) : kind === 'time' ? duration(n) : String(n);
  const [text, setText] = useState(() => format(value)), [focused, setFocused] = useState(false);
  useEffect(() => { if (!focused && Number.isFinite(value)) setText(format(value)); }, [value, focused, kind]);
  return <View style={{ gap: 6, flex: 1, minWidth: 105 }}><Label>{label}</Label><Input accessibilityLabel={label} value={text} keyboardType={kind === 'number' ? 'decimal-pad' : 'numbers-and-punctuation'}
    onFocus={() => setFocused(true)} onBlur={() => setFocused(false)} onChangeText={input => {
      setText(input); const raw = input.trim().replace(',', '.'); let parsed = NaN;
      if (kind === 'number' && /^\d+(\.\d*)?$/.test(raw)) parsed = Number(raw);
      if (kind === 'pace') { const match = /^(\d{1,2}):([0-5]\d)$/.exec(raw); if (match) parsed = Number(match[1]) * 60 + Number(match[2]); }
      if (kind === 'time') { const parts = raw.split(':'); if ((parts.length === 2 || parts.length === 3) && /^\d{1,3}$/.test(parts[0]!) && parts.slice(1).every(p => /^[0-5]\d$/.test(p))) parsed = parts.reduce((n, p) => n * 60 + Number(p), 0); }
      onChange(parsed);
    }} placeholder={kind === 'pace' ? '5:10' : kind === 'time' ? '25:00' : '5'} placeholderTextColor={colors.muted}
    invalid={!Number.isFinite(value)} style={{ fontVariant: ['tabular-nums'] }} /></View>;
}
function Choice<T extends string>({ value, values, onChange }: { value: T; values: [T, string][]; onChange: (value: T) => void }) {
  return <ChoiceGroup value={value} choices={values} onChange={onChange} />;
}
export function PacingGoalEditor({ target, onChange }: { target: PaceTarget; onChange: (target: PaceTarget) => void }) {
  const { colors } = useTheme(); const mode = target.kilometerTargets !== undefined ? 'kilometers' : target.finishSeconds != null ? 'time' : 'pace';
  const [window, setWindow] = useState(() => mode === 'time' ? (target.slow - target.fast) / 2 : 5);
  const [lastFinish, setLastFinish] = useState(target.finishSeconds ?? 1500);
  const setMode = (next: 'pace' | 'time' | 'kilometers') => {
    const { finishSeconds, kilometerTargets, timeBasis, ...rest } = target;
    const base = { ...rest, fast: Number.isFinite(rest.fast) ? rest.fast : DEFAULT_TARGET.fast, slow: Number.isFinite(rest.slow) ? rest.slow : DEFAULT_TARGET.slow };
    if (next === 'pace') onChange(base);
    else if (next === 'time') onChange({ ...base, distanceMeters: base.distanceMeters ?? 5000, finishSeconds: lastFinish, timeBasis: target.timeBasis ?? 'active' });
    else { const distance = base.distanceMeters ?? 5000, count = Number.isFinite(distance) && distance >= 100 && distance <= 200000 ? Math.ceil(distance / 1000) : 0;
      onChange({ ...base, distanceMeters: distance, timeBasis: timeBasis ?? 'active', ...(finishSeconds != null ? { finishSeconds } : {}), kilometerTargets: Array.from({ length: count }, (_, i) => ({ kilometer: i + 1, fast: base.fast, slow: base.slow })) }); }
  };
  useEffect(() => {
    if (mode === 'kilometers' && target.distanceMeters !== null && Number.isFinite(target.distanceMeters) && target.distanceMeters >= 100 && target.distanceMeters <= 200000) {
      const count = Math.ceil(target.distanceMeters / 1000);
      if (target.kilometerTargets!.length !== count) onChange({ ...target, kilometerTargets: Array.from({ length: count }, (_, i) => target.kilometerTargets![i] ?? { kilometer: i + 1, fast: target.fast, slow: target.slow }) });
    }
    if (mode === 'time' && target.distanceMeters && Number.isFinite(target.finishSeconds) && Number.isFinite(target.distanceMeters)) {
      const mean = target.finishSeconds! / target.distanceMeters * 1000;
      const fast = Number.isFinite(window) && window >= 0 && window <= 60 ? Math.max(120, Math.min(1200, Math.floor(mean - window))) : NaN;
      const slow = Number.isFinite(window) && window >= 0 && window <= 60 ? Math.max(120, Math.min(1200, Math.ceil(mean + window))) : NaN;
      if (!Object.is(fast, target.fast) || !Object.is(slow, target.slow)) onChange({ ...target, fast, slow });
    }
  }, [target, mode, window]);
  const setFinish = (finishSeconds: number) => { setLastFinish(finishSeconds); onChange({ ...target, finishSeconds }); };
  return <Panel style={{ gap: 16 }}><Label>Objectif du coach</Label><Choice value={mode} values={[["pace", "Plage d’allure"], ["time", "Temps final"], ["kilometers", "Par kilomètre"]]} onChange={setMode} />
    {mode !== 'pace' && <Copy muted variant="caption">Une distance est nécessaire. Ajustez-la dans « Une distance en tête ? » ci-dessous.</Copy>}
    {mode === 'kilometers' && <View style={[styles.row, { gap: 15 }]}><Copy style={{ flex: 1 }}>Comparer aussi à un temps final</Copy><Switch accessibilityLabel="Comparer à un temps final" value={target.finishSeconds != null} onValueChange={enabled => onChange({ ...target, finishSeconds: enabled ? lastFinish : undefined })} /></View>}
    {target.finishSeconds != null && <><PacingNumberInput label="Temps final (min:sec ou h:min:sec)" kind="time" value={target.finishSeconds} onChange={setFinish} />
      <Choice value={target.timeBasis ?? 'active'} values={[["active", "Temps actif"], ["total", "Temps total, pauses incluses"]]} onChange={timeBasis => onChange({ ...target, timeBasis })} />
      <Copy muted variant="caption">{target.timeBasis === 'total' ? 'Les pauses consomment le temps disponible pour cet objectif.' : 'Les pauses sont exclues du temps final souhaité.'}</Copy></>}
    {mode === 'time' && <><PacingNumberInput label="Demi-largeur de la zone de guidage (s/km)" value={window} onChange={setWindow} />
      <Copy>Zone de guidage : {pace(target.fast)} – {pace(target.slow)} /km.</Copy><Copy muted variant="caption">La zone reste celle choisie au départ. L’allure moyenne nécessaire pour le reste de la distance est affichée séparément pendant la course.</Copy></>}
    {mode === 'kilometers' && <><Copy muted variant="caption">Chaque plage s’applique à la distance réellement enregistrée. Le dernier bloc peut être partiel. À la fin du plan, la sortie continue en allure libre.</Copy>
      {target.kilometerTargets?.map((p, index) => <View key={p.kilometer} style={{ gap: 9, paddingTop: 12, borderTopWidth: 1, borderTopColor: colors.line }}><Label>Kilomètre {p.kilometer}{target.distanceMeters !== null && index === target.kilometerTargets!.length - 1 && target.distanceMeters % 1000 > 0 ? ` · ${km(target.distanceMeters % 1000, 2)} km` : ''}</Label>
        <View style={[styles.row, { gap: 9, flexWrap: 'wrap' }]}><PacingNumberInput label="Rapide (min:sec /km)" kind="pace" value={p.fast} onChange={fast => onChange({ ...target, kilometerTargets: target.kilometerTargets!.map((old, i) => i === index ? { ...old, fast } : old) })} />
          <PacingNumberInput label="Lente (min:sec /km)" kind="pace" value={p.slow} onChange={slow => onChange({ ...target, kilometerTargets: target.kilometerTargets!.map((old, i) => i === index ? { ...old, slow } : old) })} /></View>
      </View>)}</>}
  </Panel>;
}
