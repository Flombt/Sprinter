/** Demande d'ouverture de la feuille Compte depuis un écran qui n'a pas accès à la navigation. */
type AccountEntry = 'home' | 'signIn';
const listeners = new Set<(entry: AccountEntry) => void>();
export function requestAccountSheet(entry: AccountEntry = 'home') { for (const listener of [...listeners]) listener(entry); }
export function onAccountSheetRequest(listener: (entry: AccountEntry) => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
