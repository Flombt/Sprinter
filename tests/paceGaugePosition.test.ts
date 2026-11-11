import { describe, expect, it } from 'vitest';
import { paceGaugePosition } from '../src/ui/paceGaugePosition';

describe('position du curseur d’allure', () => {
  it('place une cible exacte au centre et distingue un écart de deux secondes', () => {
    const target = { fast: 300, slow: 300 };
    const center = paceGaugePosition(300.4, target, 20);
    expect(center).toEqual({ start: .5, end: .5, cursor: .5 });
    expect(paceGaugePosition(298, target, 20).cursor).toBeLessThan(.5);
    expect(paceGaugePosition(302, target, 20).cursor).toBeGreaterThan(.5);
  });

  it('place les limites de la plage tolérée aux extrémités de la zone', () => {
    const target = { fast: 300, slow: 320 };
    const first = paceGaugePosition(295, target, 5);
    const last = paceGaugePosition(325, target, 5);
    expect(first.cursor).toBe(first.start);
    expect(last.cursor).toBe(last.end);
  });

  it('borne les écarts et masque le curseur sans mesure valide', () => {
    const target = { fast: 300, slow: 320 };
    expect(paceGaugePosition(120, target, 0).cursor).toBe(0);
    expect(paceGaugePosition(1200, target, 0).cursor).toBe(1);
    expect(paceGaugePosition(null, target, 0).cursor).toBeNull();
    expect(paceGaugePosition(NaN, target, 0).cursor).toBeNull();
  });
});
