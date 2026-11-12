import { spacing, fontSizes, motion } from './tokens';
import { useEffect, useRef, useState } from 'react';
import { AppState, Modal, View } from 'react-native';
import Animated, { FadeInDown, FadeOutUp } from 'react-native-reanimated';
import { ActionIcon, AppBackground, BodyText, useDesign, DisplayText, Kicker, SpeedMark } from './design';
import { useTheme } from './theme';

const enterNumber = FadeInDown.duration(motion.duration.standard);
const exitNumber = FadeOutUp.duration(motion.duration.fast);

export function RunCountdown({ onComplete, onCancel }: { onComplete: () => void; onCancel: () => void }) {
  const design = useDesign();
  const [count, setCount] = useState(3), { reduceMotion } = useTheme();
  const complete = useRef(onComplete), cancel = useRef(onCancel);
  complete.current = onComplete; cancel.current = onCancel;
  useEffect(() => {
    const timer = setTimeout(() => { if (count === 0) complete.current(); else setCount(count - 1); },
      count === 0 ? motion.duration.slow : 1000);
    return () => clearTimeout(timer);
  }, [count]);
  useEffect(() => {
    const listener = AppState.addEventListener('change', next => { if (next !== 'active') cancel.current(); });
    return () => listener.remove();
  }, []);
  return <Modal transparent animationType={reduceMotion ? 'none' : 'fade'} onRequestClose={onCancel}>
    <View accessibilityViewIsModal style={{ flex: 1, backgroundColor: design.background, alignItems: 'center', justifyContent: 'center', gap: spacing.xxl, padding: spacing.xxxl }}>
      <AppBackground /><SpeedMark size={40} />
      <Kicker>{count === 0 ? 'DÉPART' : 'DÉPART DANS'}</Kicker>
      <View accessible accessibilityLiveRegion="assertive" accessibilityLabel={count === 0 ? 'Partez' : String(count)}
        style={{ height: 190, justifyContent: 'center', alignItems: 'center', width: '100%' }}>
        <Animated.View key={count} accessible={false} aria-hidden importantForAccessibility="no-hide-descendants"
          entering={reduceMotion ? undefined : enterNumber} exiting={reduceMotion ? undefined : exitNumber}
          style={{ position: 'absolute', left: 0, right: 0 }}>
          <DisplayText numeric={count !== 0} adjustsFontSizeToFit numberOfLines={1}
            style={{ fontSize: fontSizes.countdown, lineHeight: 190, textAlign: 'center', color: count === 0 ? design.accent : design.text }}>
            {count === 0 ? 'GO' : count}
          </DisplayText>
        </Animated.View>
      </View>
      <View accessible={false} style={{ flexDirection: 'row', gap: spacing.xs, marginBottom: spacing.xxl }}>{[3, 2, 1].map(step => <View key={step} style={{ width: 44, height: 4, backgroundColor: step >= count ? design.accent : design.line }} />)}</View>
      <View style={{ alignItems: 'center', gap: spacing.sm }}><ActionIcon icon="close" label="Annuler le départ" onPress={onCancel} /><BodyText style={{ color: design.secondary, fontSize: fontSizes.small }}>Annuler</BodyText></View>
    </View>
  </Modal>;
}
