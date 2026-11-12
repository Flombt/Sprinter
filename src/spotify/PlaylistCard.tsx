import { useState } from 'react';
import { Pressable, View } from 'react-native';
import { Artwork, SpotifyBrand } from './components';
import { music } from './device';
import { playlistDetails, playlistTitle } from './presentation';
import type { PlaylistReference } from './types';
import { Button, Copy, Divider, Icon, IconButton, Panel, styles } from '../ui/components';
import { confirm } from '../ui/confirm';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { interaction, spacing, iconSizes } from '../ui/tokens';

export function PlaylistCard({ playlist, selected, saved, connected, disabled, onTracks, onOpen }: {
  playlist: PlaylistReference; selected: boolean; saved: boolean; connected: boolean; disabled: boolean;
  onTracks: () => void; onOpen: () => void;
}) {
  const { colors } = useTheme(); const { largeText } = useAdaptiveLayout();
  const [expanded, setExpanded] = useState(false);
  return <Panel variant="list" style={{ gap: spacing.sm, borderWidth: 1, borderColor: selected ? colors.accentText : colors.line }}>
    <Pressable accessibilityRole="button" accessibilityLabel={`${saved ? 'Choisir' : 'Enregistrer et choisir'} ${playlistTitle(playlist)}`}
      accessibilityHint="Prépare cette playlist pour la prochaine course sans changer la lecture Spotify."
      accessibilityState={{ selected, disabled }} disabled={disabled} onPress={() => void music.select(playlist)}
      style={({ pressed }) => ({ flexDirection: largeText ? 'column' : 'row', alignItems: largeText ? 'flex-start' : 'center', gap: spacing.md, opacity: disabled ? interaction.disabledOpacity : pressed ? interaction.pressedOpacity : 1 })}>
      <Artwork image={playlist.image} size={56} />
      <View style={{ flex: largeText ? undefined : 1, minWidth: 0, gap: spacing.xs }}>
        <Copy variant="emphasis" numberOfLines={expanded || largeText ? undefined : 2}>{playlistTitle(playlist)}</Copy>
        <Copy muted variant="caption" numberOfLines={expanded || largeText ? undefined : 2}>{playlistDetails(playlist)}</Copy>
        <View style={[styles.row, { gap: spacing.xs }]}>
          <Icon name={selected ? 'checkmark-circle' : saved ? 'bookmark-outline' : 'add-circle-outline'} size={iconSizes.small} color={selected ? colors.accentText : colors.secondary} />
          <Copy variant="small" style={{ color: selected ? colors.accentText : colors.secondary, flexShrink: 1 }}>
            {selected ? 'Sélectionnée pour la course' : saved ? 'Enregistrée' : 'Enregistrer et sélectionner'}
          </Copy>
        </View>
      </View>
    </Pressable>
    <View style={[styles.row, { justifyContent: 'space-between', gap: spacing.sm }]}>
      <SpotifyBrand onPress={onOpen} caption="Ouvrir ↗" />
      <IconButton icon={expanded ? 'chevron-up' : 'ellipsis-horizontal'} label={`${expanded ? 'Masquer' : 'Afficher'} les options de ${playlistTitle(playlist)}`}
        quiet onPress={() => setExpanded(!expanded)} />
    </View>
    {expanded && <View style={{ gap: spacing.sm }}>
      <Divider />
      <Button title="Voir les morceaux" icon="list-outline" secondary disabled={!connected} onPress={onTracks} />
      {!connected && <Copy muted variant="caption">La connexion permet de consulter les morceaux accessibles à votre compte.</Copy>}
      <Copy selectable variant="small" muted>{playlist.url}</Copy>
      {saved && <Button title="Retirer de Sprinter" variant="quiet" danger disabled={disabled} icon="bookmark-outline" onPress={() => confirm(
        'Retirer cette référence ?', 'La playlist reste dans Spotify. Seul son lien enregistré dans Sprinter sera retiré.', 'Retirer', () => void music.remove(playlist.id))} />}
    </View>}
  </Panel>;
}
