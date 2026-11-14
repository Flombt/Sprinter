/** Demande d'ouverture de la feuille Compte depuis un écran qui n'a pas accès à la navigation. */
const listeners = new Set<() => void>();
export function requestAccountSheet() { for (const listener of [...listeners]) listener(); }
export function onAccountSheetRequest(listener: () => void) {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}
