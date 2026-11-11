const informationalPrefixes = [
  'Course terminée et enregistrée.',
  'Activité Santé importée localement.',
  'Sauvegarde archivée sans suppression.',
  'Ralentissez légèrement.',
  'Accélérez légèrement.',
];

export function sessionMessageSeverity(message: string): 'info' | 'error' {
  // Older session producers expose text only. Keep uncertain messages available until dismissed.
  return informationalPrefixes.some((prefix) => message.startsWith(prefix)) ? 'info' : 'error';
}
