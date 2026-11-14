import { useEffect, useState } from 'react';
import { View } from 'react-native';
import { Button, Copy, IconButton, Panel } from '../../ui/components';
import { spacing } from '../../ui/tokens';
import { useAccount, useAccountsEnabled } from '../account';
import { accountKv } from '../kv';
import { requestAccountSheet } from './bus';

const DISMISSED_KEY = 'nudge.save-runs.dismissed-at.v1';
const QUIET_MS = 30 * 24 * 3600_000;

/** Bandeau discret après la 3ᵉ course (§6.1) : fermable, absent pendant 30 jours ensuite. */
export function SaveRunsNudge({ runs }: { runs: number }) {
  const enabled = useAccountsEnabled();
  const state = useAccount();
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    if (!enabled || state.status !== 'signedOut' || runs < 3) { setVisible(false); return; }
    let active = true;
    accountKv.get(DISMISSED_KEY).then((value) => {
      if (active) setVisible(!value || Date.now() - Number(value) > QUIET_MS);
    }).catch(() => undefined);
    return () => { active = false; };
  }, [enabled, runs, state.status]);
  if (!visible) return null;
  const dismiss = () => { setVisible(false); void accountKv.set(DISMISSED_KEY, String(Date.now())); };
  return (
    <Panel variant="setting" style={{ gap: spacing.sm }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing.sm }}>
        <Copy variant="emphasis" style={{ flex: 1 }}>Sauvegardez vos courses</Copy>
        <IconButton icon="close" label="Masquer ce conseil" quiet onPress={dismiss} />
      </View>
      <Copy muted variant="caption">Un compte facultatif permet de retrouver vos courses sur un autre appareil.</Copy>
      <Button title="Découvrir" variant="quiet" icon="arrow-forward" onPress={() => { dismiss(); requestAccountSheet(); }} />
    </Panel>
  );
}
