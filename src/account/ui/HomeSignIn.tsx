import { Button } from '../../ui/components';
import { useAccount, useAccountsEnabled } from '../account';
import { requestAccountSheet } from './bus';

export function HomeSignIn() {
  const enabled = useAccountsEnabled();
  const { status, pendingDeletion } = useAccount();
  if (!enabled || status !== 'signedOut' || pendingDeletion) return null;
  return (
    <Button
      title="Se connecter ou créer un compte"
      icon="person-circle-outline"
      variant="quiet"
      size="compact"
      onPress={() => requestAccountSheet('signIn')}
    />
  );
}
