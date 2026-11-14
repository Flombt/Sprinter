// Réglages › Compte › Mon profil (8a) : version privée enregistrée, état du brouillon et de la synchronisation.
import { useCallback, useEffect, useSyncExternalStore } from 'react';
import { View } from 'react-native';
import { Button, Copy } from '../../ui/components';
import { SettingsNotice } from '../../ui/settings';
import { spacing } from '../../ui/tokens';
import { session } from '../../services/session';
import { FormNotice, formatDate } from '../../account/ui/parts';
import { useFlag } from '../../account/config';
import { computeStats, goalProgress, type StatId, type WidgetPayload } from '../model';
import { clearProfileNotice, profileSync, syncProfileNow, useProfile, useProfileSyncStatus } from '../profile';
import type { ProfileSyncStatus } from '../sync';
import { ProfileView } from './ProfileView';

function syncLine(status: ProfileSyncStatus): string {
  switch (status.phase) {
    case 'running': return 'Synchronisation en cours…';
    case 'offline': return 'Hors connexion : enregistré sur cet appareil, envoi au retour du réseau.';
    case 'paused': case 'error': return status.message ?? 'Synchronisation reportée.';
    case 'disabled': return 'Enregistré sur cet appareil.';
    default:
      if (status.pending) return `${status.pending} modification${status.pending > 1 ? 's' : ''} en attente d’envoi.`;
      return status.lastSyncAt ? `Synchronisé avec vos autres appareils · ${formatDate(new Date(status.lastSyncAt).toISOString())}` : 'Enregistré sur cet appareil.';
  }
}

export function MyProfileScreen({ onEdit, onShare, onLibrary, onCard }: { onEdit: () => void; onShare?: () => void; onLibrary?: () => void; onCard?: () => void }) {
  const sharingFlag = useFlag('profile_sharing_enabled');
  const libraryFlag = useFlag('theme_library_enabled');
  const cardsFlag = useFlag('profile_cards_enabled');
  const profile = useProfile();
  const status = useProfileSyncStatus();
  const history = useSyncExternalStore(session.subscribe, () => session.getSnapshot().history, () => session.getSnapshot().history);
  const stats = useCallback((ids: StatId[]) => computeStats(history, ids, Date.now()), [history]);
  const goal = useCallback((widget: WidgetPayload) => goalProgress(widget, history, Date.now()), [history]);
  useEffect(() => { void profileSync.refreshCounts().catch(() => undefined); void profileSync.sync('foreground'); }, []);
  return (
    <View style={{ gap: spacing.lg }}>
      <ProfileView doc={profile.saved} media={profile.media} stats={stats} goal={goal} badges={profile.badges} />
      {profile.notice ? (
        <View style={{ gap: spacing.xs }}>
          <FormNotice message={profile.notice} />
          <Button title="J’ai compris" variant="quiet" size="compact" onPress={clearProfileNotice} />
        </View>
      ) : null}
      {profile.drafts.length ? (
        <SettingsNotice icon="create-outline" title="Modifications en cours"
          body={`${profile.drafts.length} modification${profile.drafts.length > 1 ? 's' : ''} gardée${profile.drafts.length > 1 ? 's' : ''} sur cet appareil, pas encore enregistrée${profile.drafts.length > 1 ? 's' : ''}.${status.review || profile.drafts.some((draft) => draft.review) ? ' Certaines sont à revoir.' : ''}`} />
      ) : null}
      <Copy muted variant="caption" accessibilityLiveRegion="polite">{syncLine(status)}</Copy>
      <Button title={profile.drafts.length ? 'Reprendre la modification' : 'Modifier'} icon="create-outline" onPress={onEdit} />
      {status.pending > 0 && status.phase !== 'running' ? <Button title="Synchroniser maintenant" icon="sync-outline" secondary onPress={() => void syncProfileNow()} /> : null}
      {sharingFlag && onShare ? <Button title="Visibilité et partage" icon="people-outline" secondary onPress={onShare} /> : null}
      {libraryFlag && onLibrary ? <Button title="Bibliothèque de thèmes" icon="color-palette-outline" secondary onPress={onLibrary} /> : null}
      {cardsFlag && onCard ? <Button title="Carte de profil" icon="card-outline" secondary onPress={onCard} /> : null}
      <Copy muted variant="caption">{sharingFlag ? 'Votre profil reste privé tant que vous ne le publiez pas. Il est distinct de votre profil de compte, et chaque élément est facultatif.'
        : 'Votre profil est privé : vous seul le voyez. Il est distinct de votre profil de compte, et chaque élément est facultatif.'}</Copy>
    </View>
  );
}
