import { useMemo, type ReactNode } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import { useFlag } from '../account/config';
import { km } from '../core/format';
import type { RunRecord } from '../core/types';
import type { Sheet } from '../navigation/AppSheets';
import { useProfile, type ProfileState } from '../profile/profile';
import type { IdentityPayload } from '../profile/model';
import { AvatarArt, BannerArt, useProfileAppearance } from '../profile/ui/ProfileView';
import { aggregate } from '../progression/aggregates';
import { useProgression } from '../progression/hooks';
import { Button, Copy, Icon, IconButton, Label, Screen } from '../ui/components';
import { DetailRow, EditorialImage, MeasureStrip, editorialMedia } from '../ui/editorial';
import { useAdaptiveLayout, useTheme } from '../ui/theme';
import { editorial, layout, radii, spacing } from '../ui/tokens';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

const bannerHeight = 195;

function ProfileHeading({
  name,
  banner,
  avatar,
  padding,
  onEdit,
  onSettings,
}: {
  name: string;
  banner?: ReactNode;
  avatar?: ReactNode;
  padding: number;
  onEdit: () => void;
  onSettings: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View>
      <View style={styles.banner}>
        {banner ?? <EditorialImage source={editorialMedia.profile} />}
        <View style={[styles.bannerTools, { paddingHorizontal: padding }]}>
          <Label style={styles.bannerLabel}>Mon espace</Label>
          <IconButton square icon="options-outline" label="Réglages" onPress={onSettings} />
        </View>
      </View>
      <View style={[styles.avatarContainer, { paddingHorizontal: padding }]}>
        {avatar ?? (
          <View
            accessible={false}
            style={[styles.avatar, { backgroundColor: colors.accentSoft, borderColor: colors.background }]}
          >
            {name ? (
              <Copy variant="title" style={{ color: colors.accentText }}>
                {Array.from(name)[0]?.toLocaleUpperCase('fr')}
              </Copy>
            ) : (
              <Icon name="person-outline" color={colors.accentText} />
            )}
          </View>
        )}
      </View>
      <View style={[styles.identity, { paddingHorizontal: padding }]}>
        <View style={{ flexGrow: 1, flexShrink: 1 }}>
          <Copy accessibilityRole="header" variant="editorialTitle">
            {name || 'Mon profil'}
          </Copy>
          <View style={styles.privacy}>
            <Icon name="lock-closed-outline" color={colors.secondary} size={15} />
            <Copy muted variant="caption">
              Vue privée
            </Copy>
          </View>
        </View>
        <Button title="Modifier" size="compact" variant="quiet" onPress={onEdit} />
      </View>
    </View>
  );
}

function PersonalizedHeading({
  localName,
  padding,
  active,
  onEdit,
  onSettings,
}: {
  localName: string;
  padding: number;
  active: boolean;
  onEdit: () => void;
  onSettings: () => void;
}) {
  const profile = useProfile();
  const palette = useProfileAppearance(profile.saved);
  const { saved, media }: ProfileState = profile;
  const name = (saved.identity as IdentityPayload | undefined)?.name?.trim() || localName;
  return (
    <ProfileHeading
      name={name}
      padding={padding}
      banner={
        saved.banner || saved.appearance ? (
          <BannerArt doc={saved} media={media} theme={palette} height={bannerHeight} animate={active} />
        ) : undefined
      }
      avatar={
        saved.avatar ? (
          <AvatarArt doc={saved} media={media} theme={palette} size={55} animate={active} />
        ) : undefined
      }
      onEdit={onEdit}
      onSettings={onSettings}
    />
  );
}

export default function ProfileTab({
  history,
  active,
  onOpen,
  onMusic,
}: {
  history: RunRecord[];
  active: boolean;
  onOpen: (sheet: Sheet) => void;
  onMusic: () => void;
}) {
  const { colors } = useTheme();
  const { compact, largeText } = useAdaptiveLayout();
  const insets = useSafeAreaInsets();
  const padding = Math.max(
    compact || largeText ? layout.compactGutter : layout.screenGutter,
    insets.left,
    insets.right,
  );
  const profiles = useFlag('profiles_enabled') && Platform.OS !== 'web';
  const sharing = useFlag('profile_sharing_enabled') && profiles;
  const community = useFlag('leaderboard_enabled');
  const name = useProgression().data.profileName ?? '';
  const totals = useMemo(() => aggregate(history, 0, Date.now() + 1), [history]);
  const edit = () => onOpen(profiles ? 'profileEdit' : 'localProfile');
  const settings = () => onOpen('settings');
  return (
    <Screen bleed top={0} gap={spacing.lg}>
      {profiles ? (
        <PersonalizedHeading
          localName={name}
          padding={padding}
          active={active}
          onEdit={edit}
          onSettings={settings}
        />
      ) : (
        <ProfileHeading name={name} padding={padding} onEdit={edit} onSettings={settings} />
      )}
      <View style={{ paddingHorizontal: padding, gap: spacing.md }}>
        <View style={[styles.metrics, { borderColor: colors.line }]}>
          <MeasureStrip
            items={[
              { label: 'Distance', value: km(totals.meters), unit: 'km' },
              { label: 'Sorties', value: String(totals.outings) },
            ]}
          />
        </View>
        <View>
          {profiles && (
            <DetailRow
              title="Studio de profil"
              icon="layers-outline"
              detail="Bannière, avatar et apparence"
              onPress={() => onOpen('myProfile')}
            />
          )}
          <DetailRow
            title="Confidentialité et partage"
            icon="lock-closed-outline"
            detail={sharing ? 'Visibilité publique et données' : 'Données du compte'}
            onPress={() => onOpen(sharing ? 'profileShare' : 'accountData')}
          />
          <DetailRow
            title="Compte et réglages"
            icon="options-outline"
            detail="Connexion, préférences et intégrations"
            onPress={settings}
          />
          {community && (
            <DetailRow
              title="Classement communautaire"
              icon="trophy-outline"
              onPress={() => onOpen('community')}
            />
          )}
          {profiles && (
            <DetailRow
              title="Nom du profil sportif local"
              icon="person-outline"
              detail={name || 'Facultatif'}
              onPress={() => onOpen('localProfile')}
            />
          )}
          <DetailRow
            title="Musique"
            icon="musical-notes-outline"
            detail="Bibliothèque Spotify"
            onPress={onMusic}
            rule={false}
          />
        </View>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  banner: { height: bannerHeight, backgroundColor: editorial.surface, overflow: 'hidden' },
  bannerTools: {
    ...StyleSheet.absoluteFill,
    top: spacing.md,
    bottom: undefined,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: spacing.sm,
  },
  bannerLabel: {
    color: editorial.ink,
    backgroundColor: editorial.surface,
    padding: spacing.xs,
    borderRadius: radii.sm,
    flexShrink: 1,
  },
  avatarContainer: { marginTop: -33 },
  avatar: {
    width: 65,
    height: 65,
    borderRadius: radii.pill,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 4,
  },
  identity: {
    paddingTop: spacing.md,
    flexDirection: 'row',
    alignItems: 'flex-end',
    flexWrap: 'wrap',
    gap: spacing.sm,
  },
  privacy: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  metrics: {
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
    paddingVertical: spacing.md,
  },
});
