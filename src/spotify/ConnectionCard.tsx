import { useEffect, useState } from 'react';
import { Linking, Pressable, View } from 'react-native';
import { music } from './device';
import { validClientId, validSpotifyRedirect } from './auth';
import { SpotifyBrand } from './components';
import type { MusicState } from './types';
import { Button, Copy, Divider, Icon, Label, Panel, styles } from '../ui/components';
import { TextField } from '../ui/controls';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { spacing } from '../ui/tokens';

export function ConnectionCard({ state, openExternal, onMessage }: {
  state: MusicState; openExternal: (action: () => void) => void; onMessage: (message: string) => void;
}) {
  const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  const [expanded, setExpanded] = useState(false);
  const [connecting, setConnecting] = useState(false);
  const [clientId, setClientId] = useState(state.preferences.clientId);
  const [redirectUri, setRedirectUri] = useState(state.preferences.redirectUri ?? '');
  useEffect(() => setClientId(state.preferences.clientId), [state.preferences.clientId]);
  useEffect(() => setRedirectUri(state.preferences.redirectUri ?? ''), [state.preferences.redirectUri]);
  const connected = state.status === 'connected';
  const configured = validClientId(state.preferences.clientId) && validSpotifyRedirect(state.preferences.redirectUri);
  const connect = async () => {
    if (!configured) { setExpanded(true); return; }
    setConnecting(true);
    try { await music.connect(); } finally { setConnecting(false); }
  };
  return <Panel variant="setting" style={{ gap: spacing.md }}>
    <View style={{ flexDirection: largeText ? 'column' : 'row', gap: spacing.md, alignItems: 'flex-start' }}>
      <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: spacing.xs }}>
        <Label>Votre compte</Label>
        <Copy variant="emphasis">{connected ? state.profile?.name ?? 'Compte Spotify' : 'Spotify'}</Copy>
        <Copy variant="caption" style={{ color: connected ? colors.text : colors.secondary }}>
          {!state.ready ? 'Chargement…' : connected ? 'Connecté' : state.status === 'expired' ? 'Connexion expirée' : 'Non connecté · liens disponibles'}
        </Copy>
      </View>
      <Pressable accessibilityRole="button" accessibilityLabel={connected ? 'Options du compte Spotify' : 'Configuration de la connexion Spotify'}
        accessibilityState={{ expanded }} onPress={() => setExpanded(!expanded)}
        style={[styles.row, { minHeight: 44, gap: spacing.xs, maxWidth: largeText ? '100%' : '45%' }]}>
        <Copy variant="caption" muted style={{ flexShrink: 1 }}>{connected ? 'Options' : 'Configurer'}</Copy>
        <Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={16} color={colors.secondary} />
      </Pressable>
    </View>
    {!connected && <>
      <Copy muted variant="caption">Ajoutez une playlist par lien, ou connectez votre compte pour retrouver vos playlists et les commandes de lecture.</Copy>
      {music.platform.canAuthenticate && <Button title={connecting ? 'Connexion…' : state.status === 'expired' ? 'Reconnecter Spotify' : configured ? 'Connecter Spotify' : 'Configurer la connexion'}
        icon="link-outline" variant="secondary" disabled={!state.ready || state.busy} onPress={() => void connect()} />}
      {!music.platform.canAuthenticate && <Copy muted variant="caption">Dans Expo Go, utilisez les liens et ouvrez Spotify avant le départ. La connexion au compte nécessite une version de développement installée.</Copy>}
    </>}
    {expanded && <View style={{ gap: spacing.lg }}>
      <Divider />
      {connected && <View style={{ gap: spacing.sm }}>
        <Button title={connecting ? 'Connexion…' : 'Réautoriser Spotify'} secondary disabled={state.busy || !music.platform.canAuthenticate} onPress={() => void connect()} />
        <Button title="Déconnecter ce compte" variant="quiet" disabled={state.busy} onPress={() => void music.disconnectSafely()} />
      </View>}
      <Label>Connexion avancée · Spotify Developer</Label>
      <Copy muted variant="caption">La connexion développeur sert à retrouver votre bibliothèque et à piloter la lecture. Pour enregistrer une playlist, son lien suffit.</Copy>
      <Copy muted variant="caption">
        1. Ouvrez votre application dans Spotify Developer et copiez le Client ID depuis Settings.{'\n'}
        2. Déclarez l’adresse HTTPS de votre page de retour dans les Redirect URIs de Spotify.{'\n'}
        3. Collez ici ces deux valeurs, enregistrez, puis choisissez Connecter Spotify.
      </Copy>
      <TextField label="Client ID public" value={clientId} onChangeText={setClientId} editable={!state.busy}
        placeholder="Client ID de votre application Spotify" autoCapitalize="none" autoCorrect={false} maxLength={40} />
      <TextField label="Page de retour HTTPS" value={redirectUri} onChangeText={setRedirectUri} editable={!state.busy}
        placeholder="https://votre-domaine.fr/spotify-callback/" autoCapitalize="none" autoCorrect={false} keyboardType="url" maxLength={2048} />
      <Button title="Enregistrer la configuration" secondary disabled={!state.ready || state.busy
        || (!!clientId.trim() && !validClientId(clientId.trim())) || (!!redirectUri.trim() && !validSpotifyRedirect(redirectUri.trim()))}
        onPress={() => void music.configure(clientId, redirectUri)} />
      <Copy muted variant="small">L’adresse doit correspondre exactement à celle déclarée dans Spotify. La page de retour doit être hébergée en HTTPS. Aucun Client Secret n’est demandé.</Copy>
      <Copy muted variant="small">Retour interne utilisé par cette page :</Copy><Copy selectable variant="caption">{music.platform.redirectUri}</Copy>
      <Copy muted variant="small">Aucun client secret à saisir. En mode développement, le propriétaire de l’application doit être Premium et votre compte autorisé dans Spotify Developer.</Copy>
      <Button title="Ouvrir Spotify Developer" variant="quiet" icon="open-outline" onPress={() => openExternal(() => {
        void Linking.openURL('https://developer.spotify.com/dashboard').catch(() => onMessage('Ouvrez developer.spotify.com/dashboard dans votre navigateur.'));
      })} />
      <SpotifyBrand />
    </View>}
  </Panel>;
}
