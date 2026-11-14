import { describe, expect, it } from 'vitest';
import { applyStyle, currentSeason, styleFromDoc } from '../src/profile/themeModel';
import { SEASONAL_THEMES, contrastRatio, findTheme } from '../src/profile/catalog';
import { validatePayload, widgetKey, type Payload, type ProfileDoc } from '../src/profile/model';

const media = '00000000-0000-4000-8000-0000000000aa';
const widget = widgetKey('00000000-0000-4000-8000-000000000001');

describe('bibliothèque de thèmes et saisons (8d)', () => {
  it('un thème publié ne contient que des éléments de style autorisés', () => {
    const doc: ProfileDoc = {
      appearance: { theme: 'neon', font: 'mono', colors: { accent: '#FF7AB6' } }, identity: { name: 'Camille' }, about: { bio: 'Privé' },
      avatar: { source: 'media', mediaId: media, shape: 'rounded', frame: 'gradient' }, banner: { source: 'media', mediaId: media, veil: 0.3 },
      decorations: { title: 'Traileuse', icon: 'eclair', plate: 'aurore' }, badges: { show: ['courses_10'] }, [widget]: { type: 'counter', label: 'Dossards', value: 42 },
    };
    const style = styleFromDoc(doc);
    expect(style).toEqual({
      appearance: { theme: 'neon', font: 'mono', colors: { accent: '#FF7AB6' } }, banner: { source: 'default', veil: 0.3 },
      avatar: { shape: 'rounded', frame: 'gradient' }, decorations: { icon: 'eclair', plate: 'aurore' },
    });
    expect(JSON.stringify(style)).not.toMatch(/mediaId|Camille|Privé|Traileuse|courses_10|Dossards|42/);
    expect(validatePayload('appearance', style.appearance as unknown as Payload)).toBeNull();
    expect(validatePayload('banner', style.banner as unknown as Payload)).toBeNull();
    expect(validatePayload('decorations', style.decorations as unknown as Payload)).toBeNull();
  });

  it('appliquer un thème crée une copie : textes, photos, titre et widgets du titulaire restent', () => {
    const doc: ProfileDoc = {
      appearance: { theme: 'pastel' }, avatar: { source: 'media', mediaId: media, halo: true }, banner: { source: 'media', mediaId: media },
      decorations: { title: 'Traileuse', icon: 'lune' }, about: { bio: 'Privé' }, [widget]: { type: 'text', text: 'x' },
    };
    const changes = Object.fromEntries(applyStyle(doc, { appearance: { theme: 'cyberpunk' }, avatar: { shape: 'square' }, banner: { source: 'preset', presetId: 'neon', veil: 0.2 },
      decorations: { icon: 'eclair', entry: 'fade' } }).map((change) => [change.key, change.payload]));
    expect(changes.appearance).toEqual({ theme: 'cyberpunk' });
    expect(changes.avatar).toEqual({ source: 'media', mediaId: media, shape: 'square' });
    expect(changes.banner).toEqual({ source: 'media', mediaId: media, veil: 0.2 });
    expect(changes.decorations).toEqual({ title: 'Traileuse', icon: 'eclair', entry: 'fade' });
    expect(Object.keys(changes)).not.toContain('about');
    expect(Object.keys(changes)).not.toContain(widget);
  });

  it('thèmes de saison : proposés pendant leur période, lisibles', () => {
    expect(currentSeason(Date.parse('2026-12-15T12:00:00Z')).id).toBe('hiver');
    expect(currentSeason(Date.parse('2027-01-15T12:00:00Z')).id).toBe('hiver');
    expect(currentSeason(Date.parse('2026-07-01T12:00:00Z')).id).toBe('ete');
    expect(currentSeason(Date.parse('2026-11-14T10:00:00Z')).id).toBe('automne');
    for (const theme of SEASONAL_THEMES) {
      expect(findTheme(theme.id, false).id).toBe(theme.id);
      expect(contrastRatio(theme.text, theme.background), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.muted, theme.surface), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accentInk, theme.accent), theme.id).toBeGreaterThanOrEqual(4.5);
      expect(contrastRatio(theme.accent, theme.surface), theme.id).toBeGreaterThanOrEqual(3);
    }
  });
});
