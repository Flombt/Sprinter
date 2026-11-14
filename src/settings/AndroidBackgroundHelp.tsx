import { Linking, Platform, View } from 'react-native';
import { Button, Copy, Panel } from '../ui/components';
import { spacing } from '../ui/tokens';

/**
 * Aide Android (§11) : certains constructeurs arrêtent les applications en arrière-plan.
 * Un trou de trace éventuel reste géré par les états de continuité existants (gpsReacquisition).
 */
export function AndroidBackgroundHelp() {
  if (Platform.OS !== 'android') return null;
  return (
    <Panel variant="setting" style={{ gap: spacing.md }}>
      <Copy accessibilityRole="header" variant="section">Autoriser Sprinter en arrière-plan</Copy>
      <View style={{ gap: spacing.sm }}>
        <Copy muted variant="caption">1. Autorisez la localisation « Toujours » pour Sprinter si vous courez écran verrouillé.</Copy>
        <Copy muted variant="caption">2. Autorisez les notifications : une notification persistante indique que la course est enregistrée.</Copy>
        <Copy muted variant="caption">3. Dans Batterie, choisissez « Sans restriction » (ou « Non optimisée ») pour Sprinter. Sur certains téléphones, autorisez aussi le démarrage automatique.</Copy>
      </View>
      <Button title="Ouvrir les réglages de Sprinter" secondary icon="settings-outline" onPress={() => void Linking.openSettings()} />
    </Panel>
  );
}
