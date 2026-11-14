import { Linking, Pressable, View } from 'react-native';
import { Copy, Icon } from '../../ui/components';
import { useTheme } from '../../ui/theme';
import { layout, spacing } from '../../ui/tokens';
import type { Provider } from '../accountStore';

export function Checkbox({ checked, onChange, label, children }: { checked: boolean; onChange: (value: boolean) => void; label: string; children?: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      accessibilityLabel={label}
      onPress={() => onChange(!checked)}
      style={{ flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md, minHeight: layout.touch, paddingVertical: spacing.sm }}
    >
      <Icon name={checked ? 'checkbox' : 'square-outline'} color={checked ? colors.accent : colors.secondary} size={24} />
      <View style={{ flex: 1, minWidth: 0, gap: spacing.xs }}>
        <Copy variant="emphasis">{label}</Copy>
        {children}
      </View>
    </Pressable>
  );
}

export function FormError({ message }: { message: string | null | undefined }) {
  const { colors } = useTheme();
  if (!message) return null;
  return <Copy accessibilityRole="alert" variant="caption" style={{ color: colors.danger }}>{message}</Copy>;
}

export function FormNotice({ message }: { message: string | null | undefined }) {
  if (!message) return null;
  return <Copy accessibilityLiveRegion="polite" variant="caption" muted>{message}</Copy>;
}

export function ExternalLink({ url, label }: { url: string | null; label: string }) {
  const { colors } = useTheme();
  if (!url) return <Copy variant="caption" muted>{label} (bientôt disponible)</Copy>;
  return (
    <Copy accessibilityRole="link" variant="caption" style={{ color: colors.accentText, textDecorationLine: 'underline' }} onPress={() => void Linking.openURL(url)}>
      {label}
    </Copy>
  );
}

export const PROVIDER_LABEL: Record<Provider, string> = { apple: 'Apple', google: 'Google', email: 'Adresse e-mail' };
export const PROVIDER_ICON = { apple: 'logo-apple', google: 'logo-google', email: 'mail-outline' } as const;

export const formatBytes = (bytes: number) =>
  bytes < 1024 ? `${bytes} o` : bytes < 1024 ** 2 ? `${(bytes / 1024).toFixed(1).replace('.', ',')} Ko` : `${(bytes / 1024 ** 2).toFixed(1).replace('.', ',')} Mo`;
export const formatDate = (iso: string | null | undefined) =>
  iso ? new Date(iso).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : '—';
