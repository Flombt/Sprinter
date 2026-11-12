import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Linking, Platform, View } from 'react-native';
import * as Location from 'expo-location';
import { session, type SessionState } from '../services/session';
import { CAN_BACKGROUND, IS_EXPO_GO } from '../services/capabilities';
import { Button, Copy, Divider, Icon, Panel, SectionHeading, styles } from '../ui/components';
import { Toggle } from '../ui/controls';
import { SettingsDisclosure, SettingsNotice } from '../ui/settings';
import { useTheme } from '../ui/theme';
import { spacing, iconSizes } from '../ui/tokens';

export function TrackingPanel({ state, onApple }: { state: SessionState; onApple?: () => void }) {
  const { colors } = useTheme();
  const [permission, setPermission] = useState('Vérification de l’autorisation…');
  const [message, setMessage] = useState<string | null>(null);
  const mounted = useRef(false), revision = useRef(0);
  const readPermission = useCallback(() => {
    const request = ++revision.current;
    void Location.getForegroundPermissionsAsync().then(value => {
      if (!mounted.current || request !== revision.current) return;
      setPermission(value.granted ? value.ios?.accuracy === 'reduced' ? 'Position approximative · activez Position exacte'
        : 'Autorisation accordée · précision vérifiée pendant la course' : 'Localisation non autorisée');
    }).catch(() => { if (mounted.current && request === revision.current) setPermission('Autorisation indisponible'); });
  }, []);
  useEffect(() => {
    mounted.current = true; readPermission();
    const listener = AppState.addEventListener('change', next => { if (next === 'active') readPermission(); });
    return () => { mounted.current = false; revision.current++; listener.remove(); };
  }, [readPermission]);
  const configured = CAN_BACKGROUND && state.settings.backgroundEnabled;
  const trackingBackground = state.run ? state.backgroundActive : configured;
  return <>
    <SettingsNotice icon={trackingBackground ? 'lock-closed-outline' : 'phone-portrait-outline'}
      title={trackingBackground ? state.run ? 'Suivi en arrière-plan démarré' : 'Suivi verrouillé configuré' : 'Sprinter doit rester à l’écran'}
      body={trackingBackground
        ? 'Le GPS peut continuer pendant la course en arrière-plan, avec les autorisations requises. iOS reste responsable de la disponibilité des mesures.'
        : 'Dans ce mode, quitter Sprinter ou verrouiller l’iPhone met une course en pause. Revenez dans l’application pour la reprendre.'} />
    <View style={{ gap: spacing.md }}><SectionHeading title="Comportement de la course" />
      <Panel variant="setting" style={{ gap: spacing.lg }}>
        <Toggle title="Pause automatique" body="Détecter un arrêt, puis reprendre avec le mouvement."
          value={state.settings.autoPauseEnabled === true} disabled={!!state.run}
          onChange={autoPauseEnabled => void session.updateSettings({ autoPauseEnabled })} />
        <Divider />
        <Toggle title="Suivi écran verrouillé" body={CAN_BACKGROUND
          ? 'GPS uniquement pendant une course. Nécessite la localisation « Toujours ».'
          : IS_EXPO_GO ? 'Indisponible dans Expo Go. Une version de développement installée est nécessaire.' : 'Indisponible dans l’aperçu web. Utilisez une version iPhone installée.'}
          value={configured} disabled={!CAN_BACKGROUND || !!state.run}
          onChange={backgroundEnabled => void session.updateSettings({ backgroundEnabled })} />
        {!!state.run && <Copy muted variant="caption">Ces deux options sont modifiables entre deux courses, y compris lorsque la course actuelle est en pause.</Copy>}
      </Panel>
    </View>
    <SettingsDisclosure title="Comment fonctionne la pause automatique ?" summary="Arrêt confirmé, mouvement précis et GPS disponible." icon="pause-circle-outline">
      <Copy muted variant="caption">L’arrêt doit durer 5 secondes, ou 10 secondes sans vitesse disponible. La reprise nécessite 2 secondes de mouvement précis. Le GPS reste actif pour détecter ce mouvement.</Copy>
      <Copy muted variant="caption">Une perte du signal GPS ne déclenche pas la pause automatique.</Copy>
    </SettingsDisclosure>
    <View style={{ gap: spacing.md }}><SectionHeading title="Autorisation de localisation" />
      <Panel variant="setting" style={{ gap: spacing.md }}>
        <View style={[styles.row, { gap: spacing.sm, alignItems: 'flex-start' }]}><Icon name="location-outline" size={iconSizes.standard} color={colors.secondary} />
          <Copy variant="caption" style={{ flex: 1 }}>{permission}</Copy></View>
        <Copy muted variant="caption">Ce statut concerne l’accès au premier plan. L’autorisation arrière-plan est vérifiée au départ et à la reprise si le suivi verrouillé est activé.</Copy>
        <Button title={Platform.OS === 'ios' ? 'Ouvrir les réglages iPhone' : 'Ouvrir les réglages de l’appareil'} secondary icon="open-outline" onPress={() => {
          void Linking.openSettings().then(readPermission).catch(() => {
            if (mounted.current) setMessage('Ouvrez les réglages de votre appareil pour gérer la localisation de Sprinter.');
          });
        }} />
        {message && <Copy accessibilityRole="alert" variant="caption" style={{ color: colors.orange }}>{message}</Copy>}
      </Panel>
    </View>
    <SettingsDisclosure title="Premier plan, arrière-plan et verrouillage" summary="Le suivi GPS et les sorties du coach ont des limites différentes." icon="layers-outline">
      <View style={{ gap: spacing.xs }}><Copy variant="emphasis">Au premier plan</Copy><Copy muted variant="caption">Le GPS, la voix et les signaux fonctionnent selon vos options. iOS peut limiter les effets haptiques.</Copy></View>
      <Divider />
      <View style={{ gap: spacing.xs }}><Copy variant="emphasis">En arrière-plan</Copy><Copy muted variant="caption">Le GPS nécessite la version installée, le suivi verrouillé activé et les autorisations. Sinon la course passe en pause. Les bips courts ne constituent pas une garantie d’annonces continues ; leur comportement reste à valider sur iPhone.</Copy></View>
      <Divider />
      <View style={{ gap: spacing.xs }}><Copy variant="emphasis">Écran verrouillé</Copy><Copy muted variant="caption">Le GPS suit les mêmes conditions. La voix et les vibrations personnalisées de cette version sont limitées au premier plan. Une Activité en direct affiche les données, sans maintenir le GPS actif.</Copy></View>
      {onApple && <Button title="Écran verrouillé et intégrations Apple" secondary icon="logo-apple" onPress={onApple} />}
    </SettingsDisclosure>
  </>;
}
