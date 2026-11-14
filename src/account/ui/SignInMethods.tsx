import { useCallback, useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import type { UserIdentity } from '@supabase/supabase-js';
import { Button, Copy, Divider, Icon, Panel } from '../../ui/components';
import { TextField } from '../../ui/controls';
import { SettingsNotice } from '../../ui/settings';
import { confirm } from '../../ui/confirm';
import { spacing } from '../../ui/tokens';
import { account, useAccount } from '../account';
import type { Provider } from '../accountStore';
import { appleSupported, googleSupported } from '../providers';
import { FormError, FormNotice, PROVIDER_ICON, PROVIDER_LABEL } from './parts';
import { Reauthenticate } from './Reauthenticate';

/** Méthodes de connexion (§6.4) : liaison manuelle après ré-authentification, jamais de fusion automatique. */
export function SignInMethods() {
  const state = useAccount();
  const [identities, setIdentities] = useState<UserIdentity[] | null>(null);
  const [pending, setPending] = useState<null | { kind: 'link'; provider: 'apple' | 'google' } | { kind: 'email' } | { kind: 'unlink'; identity: UserIdentity }>(null);
  const [email, setEmail] = useState('');
  const [emailCode, setEmailCode] = useState('');
  const [emailSent, setEmailSent] = useState(false);
  const load = useCallback(() => { account.identities().then(setIdentities).catch(() => setIdentities([])); }, []);
  useEffect(load, [load]);
  const linked = new Set((identities ?? []).map((identity) => identity.provider));
  const run = async () => {
    if (!pending) return;
    if (pending.kind === 'link') { if (await account.linkProvider(pending.provider)) { setPending(null); load(); } }
    else if (pending.kind === 'unlink') {
      confirm('Retirer cette méthode ?', `Vous ne pourrez plus vous connecter avec ${PROVIDER_LABEL[pending.identity.provider as Provider] ?? pending.identity.provider}.`, 'Retirer',
        () => void account.unlink(pending.identity).then((ok) => { if (ok) { setPending(null); load(); } }), true);
    }
  };
  const needsReauth = pending !== null && !account.recentlyAuthenticated();

  return (
    <View style={{ gap: spacing.lg }}>
      <Panel variant="setting" style={{ gap: spacing.md }}>
        {identities === null && <Copy muted>Chargement…</Copy>}
        {(identities ?? []).map((identity, index) => (
          <View key={identity.identity_id ?? identity.id} style={{ gap: spacing.md }}>
            {index > 0 && <Divider />}
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.md }}>
              <Icon name={PROVIDER_ICON[identity.provider as Provider] ?? 'key-outline'} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Copy variant="emphasis">{PROVIDER_LABEL[identity.provider as Provider] ?? identity.provider}</Copy>
                {typeof identity.identity_data?.email === 'string' && <Copy muted variant="caption">{identity.identity_data.email}</Copy>}
              </View>
              <Button title="Retirer" variant="quiet" disabled={state.busy || (identities?.length ?? 0) <= 1}
                hint={(identities?.length ?? 0) <= 1 ? 'Gardez au moins une méthode de connexion.' : undefined}
                onPress={() => setPending({ kind: 'unlink', identity })} />
            </View>
          </View>
        ))}
      </Panel>
      {(identities?.length ?? 0) <= 1 && <Copy variant="caption" muted>Gardez au moins une méthode de connexion.</Copy>}

      <View style={{ gap: spacing.sm }}>
        {appleSupported && !linked.has('apple') && <Button title="Ajouter Apple" icon="logo-apple" secondary onPress={() => setPending({ kind: 'link', provider: 'apple' })} />}
        {googleSupported && !linked.has('google') && <Button title="Ajouter Google" icon="logo-google" secondary onPress={() => setPending({ kind: 'link', provider: 'google' })} />}
        <Button title={linked.has('email') ? 'Changer d’adresse e-mail' : 'Ajouter une adresse e-mail'} icon="mail-outline" secondary onPress={() => setPending({ kind: 'email' })} />
      </View>

      {Platform.OS === 'ios' ? (
        <SettingsNotice icon="phone-portrait-outline" title="Changement d’appareil"
          body="Apple n’est pas proposé sur Android. Avant de passer sur un téléphone Android, ajoutez Google ou une adresse e-mail à ce compte." />
      ) : (
        <SettingsNotice icon="logo-apple" title="Compte créé avec Apple ?"
          body="La connexion Apple n’est pas disponible sur Android. Depuis un iPhone, ajoutez Google ou une adresse e-mail à votre compte dans Réglages › Compte › Méthodes de connexion, puis connectez-vous ici avec cette méthode." />
      )}

      {needsReauth && <Reauthenticate reason="Cette action modifie la façon d’accéder à votre compte." onConfirmed={() => void run()} />}
      {pending && !needsReauth && pending.kind !== 'email' && (
        <Button title={pending.kind === 'link' ? `Lier ${PROVIDER_LABEL[pending.provider]}` : 'Retirer la méthode'} onPress={() => void run()} disabled={state.busy} />
      )}
      {pending?.kind === 'email' && !needsReauth && (
        <Panel variant="setting" style={{ gap: spacing.md }}>
          <TextField label="Nouvelle adresse e-mail" value={email} onChangeText={setEmail} keyboardType="email-address" autoCapitalize="none" autoComplete="email" textContentType="emailAddress" />
          {!emailSent ? (
            <Button title="Recevoir un code" disabled={state.busy} onPress={() => void account.requestEmailLink(email).then((ok) => setEmailSent(ok === true))} />
          ) : (
            <>
              <Copy muted variant="caption">Saisissez le code reçu à la nouvelle adresse. Si votre compte avait déjà une adresse, un code y est aussi envoyé pour confirmer le changement.</Copy>
              <TextField label="Code à 6 chiffres" value={emailCode} onChangeText={(value) => setEmailCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} />
              <Button title="Confirmer l’adresse" disabled={state.busy || emailCode.length !== 6}
                onPress={() => void account.confirmEmailLink(email, emailCode).then((ok) => { if (ok) { setPending(null); setEmailSent(false); setEmailCode(''); load(); } })} />
            </>
          )}
        </Panel>
      )}
      {pending && <Button title="Annuler" variant="quiet" onPress={() => { setPending(null); setEmailSent(false); account.clearNotice(); }} />}
      <Copy variant="caption" muted>Sprinter ne fusionne jamais deux comptes sur la base d’un nom, d’une ville ou d’autres ressemblances.</Copy>
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
    </View>
  );
}
