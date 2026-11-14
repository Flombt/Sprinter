import { useEffect, useState } from 'react';
import { ActivityIndicator, View } from 'react-native';
import { Button, Copy, Panel } from '../../ui/components';
import { ChoiceGroup, Picker, TextField } from '../../ui/controls';
import { SettingsDisclosure } from '../../ui/settings';
import { spacing } from '../../ui/tokens';
import { account, useAccount } from '../account';
import type { Profile } from '../accountStore';
import { COUNTRIES } from '../countries';
import { FormError, FormNotice } from './parts';

const AGE_BANDS = [['', 'Non renseignée'], ['16-24', '16–24'], ['25-34', '25–34'], ['35-44', '35–44'], ['45-54', '45–54'], ['55+', '55 et +']] as const;

/** « Votre profil » (§6.1 étape 4, §6.5) : champs facultatifs, bouton « Passer ». */
export function ProfileForm({ firstTime, onDone }: { firstTime: boolean; onDone: () => void }) {
  const state = useAccount();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loadError, setLoadError] = useState(false);
  useEffect(() => {
    let active = true;
    account.loadProfile()
      .then((value) => {
        if (!active) return;
        const loaded = value ?? { display_name: null, country_code: null, city: null, age_band: null };
        setProfile({ ...loaded, display_name: loaded.display_name ?? account.getSnapshot().proposedName });
      })
      .catch(() => { if (active) { setLoadError(true); setProfile({ display_name: account.getSnapshot().proposedName, country_code: null, city: null, age_band: null }); } });
    return () => { active = false; };
  }, []);
  if (!profile) return <ActivityIndicator style={{ marginTop: spacing.xxl }} />;
  const set = (patch: Partial<Profile>) => setProfile({ ...profile, ...patch });
  return (
    <View style={{ gap: spacing.lg }}>
      {firstTime && <Copy muted>Ces informations sont facultatives. Vous pourrez les modifier à tout moment.</Copy>}
      {loadError && <Copy variant="caption" muted>Profil indisponible hors connexion. Vos modifications seront enregistrées dès que possible.</Copy>}
      {state.proposedName && profile.display_name === state.proposedName && (
        <Copy variant="caption" muted>Nom proposé par Apple : il ne sera enregistré que si vous validez.</Copy>
      )}
      <TextField label="Nom affiché" value={profile.display_name ?? ''} maxLength={50} autoComplete="name" textContentType="nickname"
        onChangeText={(display_name) => set({ display_name })} description="Visible de vous seul dans l’app." />
      <View style={{ gap: spacing.sm }}>
        <Copy variant="emphasis">Pays</Copy>
        <Picker selectedValue={profile.country_code ?? ''} onValueChange={(value) => set({ country_code: value ? String(value) : null })} accessibilityLabel="Pays">
          <Picker.Item label="Non renseigné" value="" />
          {COUNTRIES.map(([code, name]) => <Picker.Item key={code} label={name} value={code} />)}
        </Picker>
      </View>
      <TextField label="Ville" value={profile.city ?? ''} maxLength={80} autoComplete="off" onChangeText={(city) => set({ city })} />
      <ChoiceGroup label="Tranche d’âge" value={profile.age_band ?? ''} choices={AGE_BANDS} onChange={(value) => set({ age_band: value || null })} />
      <SettingsDisclosure title="Pourquoi cette information ?" icon="help-circle-outline" summary="Usage statistique agrégé, accès limités et journalisés.">
        <Copy muted variant="caption">
          Ces champs sont facultatifs et restent privés. Ils servent à produire des statistiques agrégées. Les accès autorisés dans Sprinter Admin sont limités et journalisés.
        </Copy>
      </SettingsDisclosure>
      <Panel variant="setting" style={{ gap: spacing.sm }}>
        <Button title="Enregistrer" disabled={state.busy} onPress={() => void account.saveProfile(profile).then((ok) => { if (ok) onDone(); })} />
        {firstTime && <Button title="Passer" variant="quiet" onPress={onDone} />}
      </Panel>
      <FormError message={state.error} />
      <FormNotice message={state.notice} />
    </View>
  );
}
