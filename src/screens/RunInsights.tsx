import { spacing, fontSizes, fontWeights, iconSizes } from '../ui/tokens';
import { useState } from 'react';
import { View } from 'react-native';
import { FeedbackPressable } from '../ui/FeedbackPressable';
import { useAnimateLayoutChange } from '../ui/layoutAnimation';
import type { SessionState } from '../services/session';
import { PacingProgressPanel, PaceHistory } from '../pacing/components';
import { RhythmTools, useTools } from '../tools/components';
import RouteMap from '../ui/RouteMap';
import { BodyText, useDesign, Kicker } from '../ui/design';
import { Icon } from '../ui/components';

export function RunInsights({ state }: { state: SessionState }) {
  const design = useDesign();
  const [expanded, setExpanded] = useState(false), tools = useTools(), run = state.run;
  const animateLayout = useAnimateLayoutChange();
  if (!run) return null;
  const reference = tools.routes.find(route => route.id === run.routeId);
  const last = run.points.at(-1)?.fix;
  return <View style={{ gap: spacing.md }}>
    <FeedbackPressable accessibilityRole="button" accessibilityLabel="Carte, allure et rythme" accessibilityState={{ expanded }} aria-expanded={expanded}
      onPress={() => { animateLayout(); setExpanded(value => !value); }} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: design.line }}>
      <BodyText style={{ fontSize: fontSizes.caption, fontWeight: fontWeights.semibold }}>Carte, allure et rythme</BodyText><Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={iconSizes.small} color={design.secondary} />
    </FeedbackPressable>
    {expanded && <>
      <PacingProgressPanel run={run} running={state.running} quality={state.quality} />
      <PaceHistory run={run} live />
      <RhythmTools compact />
      <Kicker>VOTRE PARCOURS</Kicker>
      <RouteMap points={run.points} reference={reference?.segments} current={last && ['good', 'stationary'].includes(state.quality) && Date.now() - last.timestamp < 8000 ? last : undefined} height={190} />
    </>}
  </View>;
}
