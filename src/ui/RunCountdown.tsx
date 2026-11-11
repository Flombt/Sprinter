import { contrastAccent } from './tokens';
import { SpeedMark } from './brand';
import { AppBackground, Copy, IconButton, Label } from './components';
import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, Platform, View } from 'react-native';
import { useTheme } from './theme';
import { haptic } from './haptics';

export function RunCountdown({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const [count, setCount] = useState(3), { colors, reduceMotion } = useTheme();
  const accent = contrastAccent(colors);
  const scale = useRef(new Animated.Value(1)).current;
  const complete = useRef(onComplete), cancel = useRef(onCancel);
  complete.current = onComplete; cancel.current = onCancel;
  useEffect(() => {
    haptic.light();
    const timer = setTimeout(() => {
      if (count > 1) {
        setCount(count - 1);
        return;
      }
      haptic.medium();
      complete.current();
    }, 1000);
    return () => clearTimeout(timer);
  }, [count]);

  useEffect(() => {
    if (reduceMotion) {
      scale.setValue(1);
      return;
    }
    scale.setValue(.78);
    const animation = Animated.timing(scale, {
      toValue: 1,
      duration: 250,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: Platform.OS !== 'web',
    });
    animation.start();
    return () => animation.stop();
  }, [count, reduceMotion, scale]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => { if (next !== 'active') cancel.current(); });
    return () => listener.remove();
  }, []);
  return <Modal transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onCancel}>
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: colors.background, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
      <AppBackground /><SpeedMark size={40} />
      <Label>DÉPART DANS</Label>
      <Animated.View style={{ transform: [{ scale }] }}><Copy variant="condensedMetric" accessibilityLiveRegion="assertive" style={{ fontSize: 180, lineHeight: 190, color: colors.text }}>{count}</Copy></Animated.View>
      <View accessible={false} style={{ flexDirection: 'row', gap: 6, marginBottom: 25 }}>{[3, 2, 1].map(step => <View key={step} style={{ width: 44, height: 4, backgroundColor: step >= count ? accent : colors.line }} />)}</View>
      <View style={{ alignItems: 'center', gap: 9 }}><IconButton square icon="close" label="Annuler le départ" onPress={onCancel} /><Copy variant="bodyCompact" style={{ color: colors.secondary, fontSize: 12 }}>Annuler</Copy></View>
    </View>
  </Modal>;
}
