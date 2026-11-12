import { ActivityIndicator, StyleSheet, View } from 'react-native';
import { WebView } from 'react-native-webview';
import { Copy } from '../ui/components';
import { useTheme } from '../ui/theme';
import { playlistEmbedUrl } from './links';

export function PlaylistEmbed({ id, title }: { id: string; title: string }) {
  const uri = playlistEmbedUrl(id);
  const { colors } = useTheme();
  const canNavigate = (url: string, topFrame: boolean) => {
    try {
      const target = new URL(url);
      if (!topFrame) return target.protocol === 'https:' || url === 'about:blank';
      const embed = new URL(uri);
      return target.origin === embed.origin && target.pathname === embed.pathname;
    } catch {
      return false;
    }
  };
  return (
    <View
      style={{ flex: 1, minHeight: 0, borderRadius: 14, overflow: 'hidden', backgroundColor: colors.surface }}
    >
      <WebView
        accessibilityLabel={`Lecteur Spotify : ${title}`}
        source={{ uri }}
        originWhitelist={['*']}
        onShouldStartLoadWithRequest={(request) => canNavigate(request.url, request.isTopFrame !== false)}
        allowsInlineMediaPlayback
        mediaPlaybackRequiresUserAction
        allowFileAccess={false}
        nestedScrollEnabled
        startInLoadingState
        style={{ backgroundColor: colors.surface }}
        renderLoading={() => (
          <View style={[StyleSheet.absoluteFill, { justifyContent: 'center' }]}>
            <ActivityIndicator color={colors.secondary} accessibilityLabel="Chargement du lecteur Spotify" />
          </View>
        )}
        renderError={() => (
          <View style={{ padding: 16 }}>
            <Copy variant="caption">
              Le lecteur Spotify est indisponible. Réessayez ou ouvrez la playlist dans Spotify.
            </Copy>
          </View>
        )}
      />
    </View>
  );
}
