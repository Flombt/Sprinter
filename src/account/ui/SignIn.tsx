import { useEffect, useState } from 'react';
import { Platform, View } from 'react-native';
import { Button, Copy, Panel } from '../../ui/components';
import { TextField } from '../../ui/controls';
import { spacing } from '../../ui/tokens';
import { account, useAccount } from '../account';
import { legalUrl } from '../consents';
import { appleSupported, googleSupported } from '../providers';
import { validEmail } from '../otpGuard';
import { Checkbox, ExternalLink, FormError } from './parts';

/** Se connecter ou créer un compte (§6.1, §6.2) : Apple au moins aussi visible que Google sur iOS. */
export function SignIn({ onSignedIn }: { onSignedIn: (first: boolean) => void }) {
  const state = useAccount();
  const [adult, setAdult] = useState(false);
  const [step, setStep] = useState<'providers' | 'email' | 'code'>('providers');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [, setTick] = useState(0);
  const resendIn = account.resendDelay();
  useEffect(() => {
    if (step !== 'code' || resendIn <= 0) return;
    const timer = setInterval(() => setTick((value) => value + 1), 1000);
    return () => clearInterval(timer);
  }, [step, resendIn]);
  useEffect(() => () => account.clearNotice(), []);

  const done = (ok: boolean | null) => { if (ok) onSignedIn(account.getSnapshot().firstSignIn); };
  const gate = !adult || state.busy;

  if (step === 'email' || step === 'code') {
    return (
      <View style={{ gap: spacing.lg }}>
        <TextField
          label="Adresse e-mail"
          value={email}
          onChangeText={setEmail}
          keyboardType="email-address"
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="email"
          textContentType="emailAddress"
          editable={step === 'email' && !state.busy}
          returnKeyType="send"
        />
        {step === 'email' ? (
          <Button
            title="Recevoir un code"
            icon="mail-outline"
            disabled={gate || !validEmail(email)}
            onPress={() => void account.requestEmailCode(email).then((sent) => { if (sent) setStep('code'); })}
          />
        ) : (
          <>
            <Copy muted variant="caption">Saisissez le code à 6 chiffres reçu par e-mail. Il expire après 10 minutes.</Copy>
            <TextField
              label="Code à 6 chiffres"
              value={code}
              onChangeText={(value) => setCode(value.replace(/\D/g, '').slice(0, 6))}
              keyboardType="number-pad"
              textContentType="oneTimeCode"
              autoComplete="one-time-code"
              maxLength={6}
              autoFocus
            />
            <Button
              title="Valider"
              disabled={state.busy || code.length !== 6}
              onPress={() => void account.verifyEmailCode(email, code).then((ok) => { setCode(''); done(ok); })}
            />
            <Button
              title={resendIn > 0 ? `Renvoyer le code (${resendIn} s)` : 'Renvoyer le code'}
              variant="quiet"
              disabled={state.busy || resendIn > 0}
              onPress={() => void account.requestEmailCode(email)}
            />
          </>
        )}
        <FormError message={state.error} />
        <Button title="Choisir une autre méthode" variant="quiet" icon="arrow-back" onPress={() => { setStep('providers'); setCode(''); account.clearNotice(); }} />
      </View>
    );
  }

  return (
    <View style={{ gap: spacing.lg }}>
      <Copy muted>
        Sprinter fonctionne sans compte. Créez-en un si vous souhaitez sauvegarder vos courses et les retrouver sur un autre appareil.
      </Copy>
      <Panel variant="setting" style={{ gap: spacing.sm }}>
        <Checkbox checked={adult} onChange={setAdult} label="J’ai 16 ans ou plus et j’accepte les conditions d’utilisation">
          <View style={{ flexDirection: 'row', gap: spacing.lg, flexWrap: 'wrap' }}>
            <ExternalLink url={legalUrl('cgu')} label="Conditions d’utilisation" />
            <ExternalLink url={legalUrl('confidentialite')} label="Politique de confidentialité" />
          </View>
        </Checkbox>
      </Panel>
      {appleSupported && (
        <Button title="Continuer avec Apple" icon="logo-apple" disabled={gate} highContrast onPress={() => void account.signInWithApple().then(done)} />
      )}
      {googleSupported && (
        <Button title="Continuer avec Google" icon="logo-google" disabled={gate} secondary={appleSupported} onPress={() => void account.signInWithGoogle().then(done)} />
      )}
      <Button title="Continuer avec une adresse e-mail" icon="mail-outline" secondary disabled={gate} onPress={() => { account.clearNotice(); setStep('email'); }} />
      {Platform.OS === 'android' && (
        <Copy variant="caption" muted>
          Compte créé avec Apple sur un iPhone ? La connexion Apple n’est pas disponible sur Android : depuis l’iPhone, ajoutez Google ou une adresse e-mail dans Réglages › Compte › Méthodes de connexion, puis utilisez cette méthode ici.
        </Copy>
      )}
      {!adult && <Copy variant="caption" muted>Cochez la case pour continuer.</Copy>}
      <FormError message={state.error} />
    </View>
  );
}
