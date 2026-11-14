import { Linking, Modal, Platform, View } from 'react-native';
import { Button, Copy, Label, Screen } from '../../ui/components';
import { spacing } from '../../ui/tokens';
import { useSessionSelector } from '../../services/useSessionSelector';
import type { SessionState } from '../../services/session';
import { useAppConfig, useUpdateRequired } from '../config';

const selectActiveRun = (state: SessionState) => state.run !== null;
const STORE_URL = Platform.select({
  ios: process.env.EXPO_PUBLIC_APP_STORE_ID ? `itms-apps://apps.apple.com/app/id${process.env.EXPO_PUBLIC_APP_STORE_ID}` : null,
  android: 'market://details?id=app.sprinter.running',
  default: null,
});

/**
 * « Mise à jour requise » (§10.4 Config, §14 4d) : seulement si une version minimale valide est
 * connue, jamais pendant une course, et jamais à cause d'un serveur injoignable (échec ouvert).
 */
export function UpdateRequiredGate() {
  const required = useUpdateRequired();
  const running = useSessionSelector(selectActiveRun);
  if (!required || running) return null;
  return (
    <Modal visible animationType="fade" onRequestClose={() => undefined}>
      <Screen>
        <View style={{ paddingTop: 80, gap: spacing.xl }}>
          <Label>SPRINTER</Label>
          <Copy variant="title" accessibilityRole="header">Mise à jour requise</Copy>
          <Copy muted>Cette version de Sprinter n’est plus prise en charge. Installez la dernière version pour continuer. Vos courses enregistrées sur ce téléphone sont conservées.</Copy>
          {STORE_URL && <Button title="Mettre à jour" icon="arrow-up-circle-outline" onPress={() => void Linking.openURL(STORE_URL)} />}
        </View>
      </Screen>
    </Modal>
  );
}

/** Message de maintenance publié depuis Sprinter Admin, affiché sans bloquer l'app. */
export function MaintenanceNotice() {
  const { maintenance } = useAppConfig();
  if (!maintenance.enabled) return null;
  return (
    <View accessibilityRole="alert" style={{ gap: spacing.xs }}>
      <Copy variant="emphasis">Maintenance en cours</Copy>
      <Copy muted variant="caption">{maintenance.message ?? 'Certaines fonctions en ligne peuvent être momentanément indisponibles. Vos courses restent enregistrées sur ce téléphone.'}</Copy>
    </View>
  );
}
