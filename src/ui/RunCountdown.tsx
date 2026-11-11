import { useEffect, useRef, useState } from 'react';
import { Animated, AppState, Easing, Modal, Platform, View } from 'react-native';
import { ActionIcon, AppBackground, BodyText, useDesign, DisplayText, Kicker, SpeedMark } from './design';
import { useTheme } from './theme';

export function RunCountdown({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const design = useDesign();
  const [count, setCount] = useState(3), { reduceMotion } = useTheme();
  const scale = useRef(new Animated.Value(1)).current;
  const complete = useRef(onComplete), cancel = useRef(onCancel);
  complete.current = onComplete; cancel.current = onCancel;
  useEffect(() => {
    const timer = setTimeout(() => { if (count === 1) complete.current(); else setCount(count - 1); }, 1000);
    if (!reduceMotion) {
      scale.setValue(.78);
      Animated.timing(scale, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: Platform.OS !== 'web' }).start();
    }
    return () => { clearTimeout(timer); scale.stopAnimation(); };
  }, [count, reduceMotion, scale]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => { if (next !== 'active') cancel.current(); });
    return () => listener.remove();
  }, []);
  return <Modal transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onCancel}>
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: design.background, alignItems: 'center', justifyContent: 'center', gap: 24, padding: 32 }}>
      <AppBackground /><SpeedMark size={40} />
      <Kicker>DÉPART DANS</Kicker>
      <Animated.View style={{ transform: [{ scale }] }}><DisplayText numeric accessibilityLiveRegion="assertive" style={{ fontSize: 180, lineHeight: 190, color: design.text }}>{count}</DisplayText></Animated.View>
      <View accessible={false} style={{ flexDirection: 'row', gap: 6, marginBottom: 25 }}>{[3, 2, 1].map(step => <View key={step} style={{ width: 44, height: 4, backgroundColor: step >= count ? design.accent : design.line }} />)}</View>
      <View style={{ alignItems: 'center', gap: 9 }}><ActionIcon icon="close" label="Annuler le départ" onPress={onCancel} /><BodyText style={{ color: design.secondary, fontSize: 12 }}>Annuler</BodyText></View>
    </View>
  </Modal>;
}
