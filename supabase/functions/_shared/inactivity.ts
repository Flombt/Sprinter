// Comptes inactifs (§5.6, §5.7) : avertissement à 23 mois, suppression à 24 mois, 30 jours après
// l'avertissement. Sans moyen d'envoi configuré, rien n'est supprimé (jamais sans avertissement).
export interface InactivityDeps {
  candidates(stage: 'warn' | 'delete'): Promise<string[]>;
  email(userId: string): Promise<string | null>;
  send: ((to: string) => Promise<void>) | null;
  markWarned(userId: string): Promise<void>;
  deleteAccount(userId: string): Promise<'done' | 'pending' | 'not_found'>;
  log(event: string, data?: Record<string, unknown>): void;
}

export const WARNING_SUBJECT = 'Votre compte Sprinter sera supprimé dans 30 jours';
export const WARNING_TEXT = `Bonjour,

Votre compte Sprinter n'a pas été utilisé depuis près de deux ans. Sans nouvelle connexion de votre part
dans les 30 jours, il sera supprimé avec les données associées stockées en ligne (profil, courses
sauvegardées, parcours, réglages). Les courses enregistrées sur votre téléphone n'y sont pas touchées.

Pour garder votre compte, il suffit d'ouvrir Sprinter et de vous connecter.

L'équipe Sprinter`;

export async function processInactivity(deps: InactivityDeps) {
  const summary = { warned: 0, deleted: 0, skipped: 0 };
  if (!deps.send) {
    deps.log('inactivity.email_not_configured');
    return { ...summary, skipped: -1 };
  }
  for (const userId of await deps.candidates('warn')) {
    const address = await deps.email(userId);
    if (!address) { summary.skipped++; continue; }
    try { await deps.send(address); await deps.markWarned(userId); summary.warned++; }
    catch { summary.skipped++; }
  }
  for (const userId of await deps.candidates('delete')) {
    const result = await deps.deleteAccount(userId);
    if (result === 'done') summary.deleted++;
  }
  deps.log('inactivity.done', summary);
  return summary;
}
