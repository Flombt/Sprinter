import { useEffect, useState } from 'react';
import { Alert, Platform, View } from 'react-native';
import { Button, Copy, Header, IconButton, ListRow, Panel, Screen, SectionHeading } from '../../ui/components';
import { confirm } from '../../ui/confirm';
import { SettingsNotice } from '../../ui/settings';
import { spacing } from '../../ui/tokens';
import { session } from '../../services/session';
import { account, useAccount } from '../account';
import { DeleteAccount } from './DeleteAccount';
import { MyData } from './MyData';
import { FormNotice, PROVIDER_LABEL } from './parts';
import { ProfileForm } from './ProfileForm';
import { SignIn } from './SignIn';
import { SignInMethods } from './SignInMethods';

type Route = 'home' | 'signIn' | 'profile' | 'methods' | 'data' | 'delete';
const TITLES: Record<Route, string> = {
  home: 'Compte', signIn: 'Se connecter', profile: 'Votre profil', methods: 'Méthodes de connexion', data: 'Mes données', delete: 'Supprimer mon compte',
};

function signOut() {
  const leave = (wipe: boolean) => void account.signOut().then(() => (wipe ? session.purgeLocalHistory() : undefined));
  const body = 'Vos courses restent sur cet appareil et réapparaîtront si vous vous reconnectez à ce compte.';
  if (Platform.OS === 'web') { confirm('Se déconnecter ?', body, 'Se déconnecter', () => leave(false)); return; }
  Alert.alert('Se déconnecter ?', body, [
    { text: 'Annuler', style: 'cancel' },
    { text: 'Se déconnecter', onPress: () => leave(false) },
    { text: 'Se déconnecter et effacer les courses de cet appareil', style: 'destructive',
      onPress: () => confirm('Effacer les courses de cet appareil ?', 'Les courses non sauvegardées en ligne seront perdues.', 'Effacer', () => leave(true), true) },
  ]);
}

/** Réglages › Compte (§6.1 étape 5). */
export function AccountSheet({ onClose }: { onClose: () => void }) {
  const state = useAccount();
  const [route, setRoute] = useState<Route>('home');
  const [firstTime, setFirstTime] = useState(false);
  useEffect(() => { if (state.status === 'signedOut' && route !== 'signIn' && route !== 'home') setRoute('home'); }, [route, state.status]);
  const back = () => { account.clearNotice(); setRoute(route === 'delete' ? 'data' : 'home'); };
  const close = <IconButton icon="close" label="Fermer" onPress={onClose} quiet />;
  return (
    <Screen key={route}>
      <Header title={TITLES[route]} subtitle="Réglages" onBack={route === 'home' ? undefined : back} right={close} />
      {route === 'signIn' && <SignIn onSignedIn={(first) => { setFirstTime(first); setRoute(first ? 'profile' : 'home'); }} />}
      {route === 'profile' && <ProfileForm firstTime={firstTime} onDone={() => { setFirstTime(false); setRoute('home'); }} />}
      {route === 'methods' && <SignInMethods />}
      {route === 'data' && <MyData onDelete={() => setRoute('delete')} />}
      {route === 'delete' && <DeleteAccount onDone={() => setRoute('home')} />}
      {route === 'home' && (state.status === 'signedIn' ? (
        <View style={{ gap: spacing.lg }}>
          <Panel variant="setting" style={{ gap: spacing.xs }}>
            <Copy variant="emphasis">{state.email ?? 'Compte Sprinter'}</Copy>
            <Copy muted variant="caption">Connecté avec {state.providers.map((p) => PROVIDER_LABEL[p]).join(', ') || '—'}</Copy>
          </Panel>
          <View style={{ gap: spacing.md }}>
            <SectionHeading title="Compte" />
            <ListRow title="Profil de compte" icon="person-circle-outline" onPress={() => setRoute('profile')}
              subtitle={<Copy muted variant="caption">Nom affiché, pays, ville, tranche d’âge · facultatifs.</Copy>} />
            <ListRow title="Méthodes de connexion" icon="key-outline" onPress={() => setRoute('methods')}
              subtitle={<Copy muted variant="caption">Apple, Google, adresse e-mail.</Copy>} />
            <ListRow title="Mes données" icon="shield-checkmark-outline" onPress={() => setRoute('data')}
              subtitle={<Copy muted variant="caption">Appareils, choix, export et suppression.</Copy>} />
          </View>
          <Button title="Se déconnecter" icon="log-out-outline" secondary disabled={state.busy} onPress={signOut} />
          <FormNotice message={state.notice} />
        </View>
      ) : (
        <View style={{ gap: spacing.lg }}>
          <Copy muted>Sprinter fonctionne sans compte. Créez-en un si vous souhaitez sauvegarder vos courses et les retrouver sur un autre appareil.</Copy>
          {state.status === 'loading' ? <Copy muted>Chargement…</Copy> : (
            <Button title="Se connecter ou créer un compte" icon="person-add-outline" onPress={() => setRoute('signIn')} />
          )}
          {state.pendingDeletion && (
            <SettingsNotice icon="hourglass-outline" title="Suppression en cours"
              body="Votre demande est validée et vos accès sont retirés. Le nettoyage de vos données en ligne se termine automatiquement." />
          )}
          <FormNotice message={state.notice} />
        </View>
      ))}
    </Screen>
  );
}
