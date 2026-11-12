import { useEffect, useState, useSyncExternalStore } from 'react';
import { Image, Pressable, View } from 'react-native';
import { FeedbackPressable } from '../ui/FeedbackPressable';
import { useAnimatedVisibility } from '../ui/layoutAnimation';
import { music } from './device';
import { controlReason, selectedPlaylist } from './store';
import { MusicState, PlayerCommand } from './types';
import { Copy, Icon, IconName, Label, Panel, styles } from '../ui/components';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { interaction, radii, spacing, fontSizes, fontWeights, iconSizes } from '../ui/tokens';
import { playbackPresentation, playlistTitle } from './presentation';
import { duration } from '../core/format';
import { confirm } from '../ui/confirm';

const ignoreMusicUpdates = () => () => {};
export const useMusic = (active = true) => useSyncExternalStore(active ? music.subscribe : ignoreMusicUpdates, music.getSnapshot, music.getSnapshot);
const selectedMusic = () => selectedPlaylist(music.getSnapshot());
export const useSelectedPlaylist = (active = true) => useSyncExternalStore(active ? music.subscribe : ignoreMusicUpdates, selectedMusic, selectedMusic);
export function SpotifyBrand({ onPress, caption }: { onPress?: () => void; caption?: string }) {
  const { colors } = useTheme();
  const content = <><Image source={colors.dark ? require('../../assets/spotify/logo-white.png') : require('../../assets/spotify/logo-black.png')}
    style={{ width: 84, height: 25 }} resizeMode="contain" accessibilityLabel="Spotify" />
    {caption && <Copy muted variant="caption" style={{ flexShrink: 1 }}>{caption}</Copy>}</>;
  const container = { alignSelf: 'flex-start' as const, flexDirection: 'row' as const, alignItems: 'center' as const,
    flexWrap: 'wrap' as const, columnGap: spacing.md, rowGap: spacing.sm, paddingVertical: spacing.md, minHeight: 49, flexShrink: 1 };
  return onPress ? <FeedbackPressable onPress={onPress} accessibilityRole="link" accessibilityLabel="Ouvrir dans Spotify" style={container}>{content}</FeedbackPressable>
    : <View style={container}>{content}</View>;
}
export function Artwork({ image, size = 56 }: { image?: string | null; size?: number }) {
  const { colors } = useTheme(); const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [image]);
  // Spotify's artwork uses its original proportions and a small, permitted corner radius.
  return image && !failed ? <Image source={{ uri: image }} onError={() => setFailed(true)} style={{ width: size, height: size, borderRadius: radii.xs }} resizeMode="contain" accessibilityLabel="Pochette fournie par Spotify" />
    : <View accessible={false} style={{ width: size, height: size, borderRadius: radii.sm, backgroundColor: colors.raised, justifyContent: 'center', alignItems: 'center' }}><Icon name="musical-notes-outline" color={colors.secondary} size={Math.min(28, size / 2)} /></View>;
}
function MusicControl({ state, command, icon, label, large = false, onPress }: { state: MusicState; command: PlayerCommand; icon: IconName; label: string; large?: boolean; onPress: () => void }) {
  const { colors } = useTheme(); const reason = controlReason(state, command); const primary = command === 'play' || command === 'pause';
  return <Pressable accessibilityRole="button" accessibilityLabel={label} accessibilityHint={reason ?? undefined} accessibilityState={{ disabled: !!reason }} disabled={!!reason} onPress={onPress}
    style={({ pressed }) => ({ width: large ? 62 : 48, height: large ? 62 : 48, borderRadius: radii.pill, opacity: reason ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1,
      backgroundColor: primary ? colors.accent : 'transparent', justifyContent: 'center', alignItems: 'center' })}>
    <Icon name={icon} color={primary ? colors.accentInk : colors.text} size={large ? iconSizes.large : iconSizes.standard} />
  </Pressable>;
}
export function PlaybackControls({ state, compact = false }: { state: MusicState; compact?: boolean }) {
  const playing = state.playback?.playing === true;
  return <View style={[styles.row, { justifyContent: compact ? 'flex-end' : 'space-evenly', gap: compact ? 0 : 5 }]}>
    <MusicControl state={state} command="previous" icon="play-skip-back" label="Morceau précédent" onPress={() => void music.command('previous')} />
    <MusicControl state={state} command={playing ? 'pause' : 'play'} icon={playing ? 'pause' : 'play'} label={playing ? 'Mettre Spotify en pause' : 'Reprendre la lecture Spotify'} large={!compact} onPress={() => void music.command(playing ? 'pause' : 'play')} />
    <MusicControl state={state} command="next" icon="play-skip-forward" label="Morceau suivant" onPress={() => void music.command('next')} />
  </View>;
}
export function MusicSelection({ onChoose }: { onChoose: () => void }) {
  const state = useMusic(); const selected = selectedPlaylist(state); const { colors } = useTheme();
  return <View style={{ gap: spacing.md }}><View style={[styles.row, { justifyContent: 'space-between' }]}><Copy style={{ fontSize: fontSizes.section, fontWeight: fontWeights.semibold }}>Musique</Copy><Label>Optionnel</Label></View>
    <FeedbackPressable accessibilityRole="button" accessibilityLabel={selected ? `Choisir la musique. ${selected.name ?? 'Playlist Spotify'} sélectionnée.` : 'Choisir une playlist Spotify'} onPress={onChoose}>
      <Panel style={[styles.row, { gap: spacing.md }]}><Artwork image={selected?.image} size={52} /><View style={{ flex: 1, gap: 3 }}>
        <Copy style={{ fontWeight: fontWeights.semibold }}>{selected?.name ?? (selected ? 'Playlist Spotify sélectionnée' : 'La bande-son de votre sortie')}</Copy>
        <Copy muted variant="caption">{selected ? 'Changer de playlist ou écouter dans Spotify' : 'Ajouter un lien ou connecter votre compte'}</Copy>
      </View><Icon name="chevron-forward" size={iconSizes.standard} color={colors.secondary} /></Panel>
    </FeedbackPressable>
    {selected && <><Copy muted variant="caption">{state.status === 'connected'
      ? state.preferences.autoPlay ? 'La playlist démarrera avec la course si Spotify dispose d’un appareil actif et autorise la lecture.' : 'Le lancement automatique est désactivé. Votre lecture Spotify continue indépendamment.'
      : 'Ouvrez la playlist dans Spotify avant de partir, puis revenez démarrer votre course.'}</Copy><SpotifyBrand onPress={() => void music.openPlaylist(selected)} /></>}
  </View>;
}
export function MiniPlayer({ onExpand, foregroundOnlyRun = false }: { onExpand: () => void; foregroundOnlyRun?: boolean }) {
  const state = useMusic(); const selected = selectedPlaylist(state); const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  const showPlayer = useAnimatedVisibility(!!selected || state.status === 'connected');
  useEffect(() => music.watchPlayback(), []);
  if (!showPlayer) return <FeedbackPressable onPress={onExpand} accessibilityRole="button" style={[styles.row, { gap: spacing.sm, minHeight: 48, alignSelf: 'center' }]}><Icon name="musical-notes-outline" size={iconSizes.small} color={colors.secondary} /><Copy muted variant="caption">Choisir votre musique</Copy></FeedbackPressable>;
  const track = state.playback?.track; const view = playbackPresentation(state);
  const reason = state.status === 'connected' ? controlReason(state, state.playback?.playing ? 'pause' : 'play') : null;
  return <Panel variant="setting" style={{ gap: spacing.sm }}>
    <FeedbackPressable accessibilityRole="button" accessibilityLabel="Ouvrir le lecteur musical" onPress={onExpand}
      style={{ flexDirection: largeText ? 'column' : 'row', alignItems: largeText ? 'flex-start' : 'center', gap: spacing.md, minHeight: 48 }}>
      <Artwork image={track ? track.image : state.status !== 'connected' ? selected?.image : null} size={48} />
      <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: spacing.xs }}>
        <Copy variant="emphasis" numberOfLines={largeText ? undefined : 2}>{track?.title ?? (state.playback?.advertisement ? 'Publicité Spotify' : state.status !== 'connected' && selected ? playlistTitle(selected) : 'Votre lecteur Spotify')}</Copy>
        {track && <Copy muted variant="caption" numberOfLines={largeText ? undefined : 2}>{track.artist}</Copy>}
        <Copy variant="small" style={{ color: view.kind === 'playing' ? colors.accentText : colors.secondary }}>{view.label}{!track && selected && state.status !== 'connected' ? ' · choisie pour la course' : ''}</Copy>
      </View><Icon name="chevron-forward" size={iconSizes.small} color={colors.secondary} />
    </FeedbackPressable>
    <View style={{ flexDirection: largeText ? 'column' : 'row', alignItems: largeText ? 'flex-start' : 'center', justifyContent: 'space-between', gap: spacing.sm }}>
      <SpotifyBrand caption={state.status === 'connected' ? undefined : 'Ouvrir ↗'} onPress={() => confirmSpotifySwitch(foregroundOnlyRun, () => {
        if (track?.url) void music.platform.openSpotify(`spotify:${track.type}:${track.id}`, track.url).catch(() => music.openPlaylist());
        else void music.openPlaylist();
      })} />
      {state.status === 'connected' && <PlaybackControls state={state} compact />}
    </View>
    {reason && <Copy muted variant="small">{reason}</Copy>}
  </Panel>;
}
export function PlayerPanel({ state, openSpotify }: { state: MusicState; openSpotify: () => void }) {
  const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  const playback = state.playback, track = playback?.track; const view = playbackPresentation(state);
  const position = playback?.progressMs;
  const progress = track && Number.isFinite(track.durationMs) && track.durationMs > 0 && typeof position === 'number' && Number.isFinite(position) && position >= 0
    ? Math.min(1, position / track.durationMs) : null;
  const reason = controlReason(state, playback?.playing ? 'pause' : 'play');
  const shuffleReason = controlReason(state, 'shuffle');
  return <Panel style={{ gap: spacing.lg }}>
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}>
      <Label>Votre lecteur</Label>
      <View style={[styles.row, { gap: spacing.xs, maxWidth: '100%' }]}>
        <Icon name={view.kind === 'playing' ? 'volume-medium-outline' : view.kind === 'paused' ? 'pause-outline' : 'radio-outline'} size={iconSizes.small} color={view.kind === 'playing' ? colors.accentText : colors.secondary} />
        <Copy variant="caption" style={{ flexShrink: 1, color: view.kind === 'playing' ? colors.accentText : colors.secondary }}>{view.label}</Copy>
      </View>
    </View>
    <View style={{ flexDirection: largeText ? 'column' : 'row', alignItems: largeText ? 'flex-start' : 'center', gap: spacing.lg }}>
      <FeedbackPressable accessibilityRole="link" accessibilityLabel="Écouter ce contenu dans Spotify" onPress={openSpotify}><Artwork image={track?.image} size={track ? 96 : 56} /></FeedbackPressable>
      <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: spacing.xs }}><Copy variant="section">{track?.title ?? (playback?.advertisement ? 'Publicité Spotify' : 'À lancer dans Spotify')}</Copy>
        <Copy muted variant="caption">{track?.artist || (state.status === 'connected' ? 'Lancez une lecture dans Spotify pour synchroniser le lecteur.' : 'Connectez votre compte pour afficher le morceau en cours.')}</Copy>
        {track?.explicit && <Copy accessibilityLabel="Contenu explicite" variant="small" style={{ alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.secondary, paddingHorizontal: spacing.xs }}>E</Copy>}
      </View></View>
    {progress !== null && <View style={{ gap: spacing.sm }}>
      <View accessibilityRole="progressbar" accessibilityLabel={view.fresh ? 'Position reçue de Spotify' : 'Dernière position connue dans Spotify'} accessibilityValue={{ min: 0, max: 100, now: Math.round(progress * 100) }} style={{ height: 4, borderRadius: radii.xs, backgroundColor: colors.line }}><View style={{ width: `${progress * 100}%`, height: 4, backgroundColor: view.fresh ? colors.accentText : colors.muted, borderRadius: radii.xs }} /></View>
      <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}><Copy muted variant="small">{duration(Math.min(position!, track!.durationMs) / 1000)}</Copy><Copy muted variant="small">{duration(track!.durationMs / 1000)}</Copy></View>
    </View>}
    {(track || playback?.deviceId || playback?.advertisement) && <PlaybackControls state={state} />}
    {track?.type === 'episode' && <View style={[styles.row, { justifyContent: 'center', flexWrap: 'wrap', gap: spacing.md }]}>
      <MusicControl state={state} command="seek" icon="play-back" label="Reculer de quinze secondes" onPress={() => void music.seek(Math.max(0, (playback?.progressMs ?? 0) - 15000))} />
      <Copy muted variant="caption">15 secondes</Copy><MusicControl state={state} command="seek" icon="play-forward" label="Avancer de quinze secondes" onPress={() => void music.seek(Math.min(track.durationMs, (playback?.progressMs ?? 0) + 15000))} />
    </View>}
    <View style={[styles.row, { justifyContent: 'space-between', flexWrap: 'wrap', gap: spacing.sm }]}><FeedbackPressable accessibilityRole="button" accessibilityLabel="Mode aléatoire" accessibilityHint={shuffleReason ?? undefined} accessibilityState={{ disabled: !!shuffleReason, selected: playback?.shuffle === true }} disabled={!!shuffleReason} onPress={() => void music.command('shuffle')} style={[styles.row, { minHeight: 44, gap: spacing.sm, opacity: shuffleReason ? .35 : 1 }]}><Icon name="shuffle" size={iconSizes.standard} color={playback?.shuffle ? colors.accentText : colors.secondary} /><Copy muted variant="caption">Aléatoire</Copy></FeedbackPressable>
      <FeedbackPressable accessibilityRole="button" accessibilityLabel="Actualiser le lecteur Spotify" accessibilityState={{ disabled: state.status !== 'connected' || state.playerBusy }} onPress={() => void music.retryPlayback()} disabled={state.status !== 'connected' || state.playerBusy} style={[styles.row, { minHeight: 44, gap: spacing.xs, opacity: state.status === 'connected' && !state.playerBusy ? 1 : .35 }]}><Icon name="refresh-outline" size={iconSizes.small} color={colors.secondary} /><Copy muted variant="caption">Actualiser</Copy></FeedbackPressable></View>
    {reason && <Copy muted variant="caption">{reason}</Copy>}
    {!view.fresh && state.playback && <Copy muted variant="caption">Dernier état connu : le titre et la position attendent une réponse récente de Spotify.</Copy>}
    {state.retryAt > Date.now() && <Copy muted variant="caption">Nouvelle tentative au plus tôt à {new Date(state.retryAt).toLocaleTimeString('fr-FR')}. La course continue.</Copy>}
    {playback?.deviceName && <View style={[styles.row, { gap: spacing.sm }]}><Icon name="phone-portrait-outline" size={iconSizes.small} color={colors.secondary} /><Copy muted variant="small" style={{ flex: 1 }}>Sur {playback.deviceName}{!view.fresh ? ' · dernière information reçue' : ''}</Copy></View>}
    <SpotifyBrand caption="Ouvrir le lecteur ↗" onPress={openSpotify} />
  </Panel>;
}
export function confirmSpotifySwitch(duringForegroundOnlyRun: boolean, action: () => void) {
  if (duringForegroundOnlyRun) confirm('Ouvrir Spotify ?', 'Dans ce mode, quitter Sprinter met votre course en pause. Revenez ensuite dans Sprinter et touchez Reprendre.', 'Ouvrir Spotify', action);
  else action();
}
