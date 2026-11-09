import { ChoiceGroup, TextField } from '../ui/controls';
export function Field({ label, value, onChange, numeric = false, multiline = false, limit = 100 }: { label: string; value: string; onChange: (s: string) => void; numeric?: boolean; multiline?: boolean; limit?: number }) {
  return <TextField label={label} value={value} onChangeText={onChange} multiline={multiline} maxLength={limit}
    keyboardType={numeric ? 'decimal-pad' : 'default'} autoCapitalize={numeric ? 'none' : 'sentences'} />;
}
export function Choices<T extends string | number>({ value, choices, onChange }: { value: T; choices: readonly (readonly [T, string])[]; onChange: (v: T) => void }) {
  return <ChoiceGroup value={value} choices={choices} onChange={onChange} />;
}
export function numberValue(text: string): number { const value = text.trim().replace(',', '.'); return /^(\d+(\.\d*)?|\.\d+)$/.test(value) ? Number(value) : NaN; }
