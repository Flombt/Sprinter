export function sessionMessageSeverity(message: string): 'info' | 'error' {
  // Older session producers expose text only. Keep uncertain messages available until dismissed.
  return /^(?:Course terminée et enregistrée\.|Activité Santé importée localement\.|Sauvegarde archivée sans suppression\.|Ralentissez légèrement\.|Accélérez légèrement\.)/.test(message)
    ? 'info' : 'error';
}
