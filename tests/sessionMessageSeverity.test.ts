import { expect, it } from 'vitest';
import { sessionMessageSeverity } from '../src/ui/sessionMessageSeverity';

it('laisse les erreurs techniques et les alertes de récupération ouvertes', () => {
  expect(sessionMessageSeverity('Enregistrement impossible.')).toBe('error');
  expect(sessionMessageSeverity('Permission refusée.')).toBe('error');
  expect(sessionMessageSeverity('Course enregistrée. Arrêt du service GPS à vérifier.')).toBe('error');
  expect(sessionMessageSeverity('Course terminée et enregistrée.')).toBe('info');
});
