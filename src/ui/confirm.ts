import { Alert, Platform } from 'react-native';
export function confirm(title: string, body: string, action: string, onConfirm: () => void, destructive = false) {
  if (Platform.OS === 'web') { if (globalThis.confirm(`${title}\n\n${body}`)) onConfirm(); return; }
  Alert.alert(title, body, [{ text: 'Annuler', style: 'cancel' }, { text: action, style: destructive ? 'destructive' : 'default', onPress: onConfirm }]);
}
