import { useState } from 'react';
import { View } from 'react-native';
import { Button, Copy, Panel } from '../../ui/components';
import { TextField } from '../../ui/controls';
import { spacing } from '../../ui/tokens';
import { account, useAccount } from '../account';
import { appleSupported, googleSupported } from '../providers';
import { FormError } from './parts';

/**
 * Ré-authentification réelle (< 5 min) avant une action sensible : liaison, retrait d'une
 * méthode, suppression du compte. Elle se fait sur une session éphémère du même compte.
 */
export function Reauthenticate({ reason, onConfirmed }: { reason: string; onConfirmed: () => void }) {
  const state = useAccount();
  const [codeSent, setCodeSent] = useState(false);
  const [code, setCode] = useState('');
  const confirmed = (ok: boolean) => { if (ok) onConfirmed(); };
  return (
    <Panel variant="setting" style={{ gap: spacing.md }}>
      <Copy variant="emphasis">Confirmez votre identité</Copy>
      <Copy muted variant="caption">{reason} Utilisez une méthode déjà liée à ce compte.</Copy>
      {appleSupported && state.providers.includes('apple') && (
        <Button title="Confirmer avec Apple" icon="logo-apple" secondary disabled={state.busy} onPress={() => void account.reauthenticate('apple').then(confirmed)} />
      )}
      {googleSupported && state.providers.includes('google') && (
        <Button title="Confirmer avec Google" icon="logo-google" secondary disabled={state.busy} onPress={() => void account.reauthenticate('google').then(confirmed)} />
      )}
      {state.email && (
        <View style={{ gap: spacing.sm }}>
          {!codeSent ? (
            <Button title="Recevoir un code par e-mail" icon="mail-outline" secondary disabled={state.busy}
              onPress={() => void account.requestReauthCode(state.email!).then((ok) => setCodeSent(ok === true))} />
          ) : (
            <>
              <TextField label="Code reçu par e-mail" value={code} onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
                keyboardType="number-pad" textContentType="oneTimeCode" autoComplete="one-time-code" maxLength={6} autoFocus />
              <Button title="Confirmer" disabled={state.busy || code.length !== 6}
                onPress={() => void account.reauthenticate('email', state.email!, code).then((ok) => { setCode(''); confirmed(ok); })} />
            </>
          )}
        </View>
      )}
      <FormError message={state.error} />
    </Panel>
  );
}
