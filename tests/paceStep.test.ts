import { describe, expect, it } from 'vitest';
import { paceStep } from '../src/ui/paceStep';

describe('ajustement tactile de l’allure', () => {
  it('avance par pas de cinq secondes et accélère après une seconde et demie', () => {
    expect(paceStep(300, -1, 0)).toBe(295);
    expect(paceStep(300, 1, 1499)).toBe(305);
    expect(paceStep(300, 1, 1500)).toBe(310);
  });

  it('respecte les allures limites de deux et vingt minutes par kilomètre', () => {
    expect(paceStep(121, -1, 1500)).toBe(120);
    expect(paceStep(1198, 1, 0)).toBe(1200);
  });
});
