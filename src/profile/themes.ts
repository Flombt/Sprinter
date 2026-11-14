// Bibliothèque communautaire de thèmes (8d) : accès serveur.
import { account } from '../account/account';
import type { ThemeCategory, ThemeStyle } from './themeModel';

export interface LibraryTheme { id: string; name: string; category: ThemeCategory; style: ThemeStyle; favorites: number; favorite: boolean; mine: boolean }
export const listThemes = (category: ThemeCategory | null, sort: 'recent' | 'popular' | 'favorites', offset = 0) =>
  account.rpc<{ items: LibraryTheme[] }>('theme_list', { p_category: category, p_sort: sort, p_offset: offset });
export const publishTheme = (id: string, name: string, category: ThemeCategory, style: ThemeStyle) =>
  account.rpc<{ id: string; status: string }>('theme_publish', { p_id: id, p_name: name, p_category: category, p_style: style });
export const favoriteTheme = (id: string, on: boolean) => account.rpc('theme_favorite', { p_id: id, p_on: on });
export const withdrawTheme = (id: string) => account.rpc('theme_withdraw', { p_id: id });
export const reportTheme = (id: string, reason: string) => account.rpc('theme_report', { p_id: id, p_reason: reason, p_note: null });
