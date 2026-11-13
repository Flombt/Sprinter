import * as Haptics from 'expo-haptics';
import { AppState, Platform } from 'react-native';
import { session } from '../services/session';

async function play(effect: () => Promise<void>) {
  if (Platform.OS === 'web' || AppState.currentState !== 'active') return;
  if (!session.getSnapshot().settings.hapticsEnabled) return;
  try {
    await effect();
  } catch {
    // A missing haptic engine must never interfere with the action.
  }
}

export const haptic = {
  select: () => void play(Haptics.selectionAsync),
  light: () => void play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light)),
  medium: () => void play(() => Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium)),
  success: () => void play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success)),
  warning: () => void play(() => Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning)),
};

export type HapticFeedback = keyof typeof haptic | 'none';
