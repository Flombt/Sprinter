import { useState } from 'react';
import { Pressable, View } from 'react-native';
import type { SessionState } from '../services/session';
import { PacingProgressPanel, PaceHistory } from '../pacing/components';
import { RhythmTools, useTools } from '../tools/components';
import RouteMap from '../ui/RouteMap';
import { BodyText, useDesign, Kicker } from '../ui/design';
import { Icon } from '../ui/components';
import { MiniPlayer } from '../spotify/components';

export function RunInsights({ active, state, onMusic }: {
  active: boolean;
  state: SessionState;
  onMusic: () => void;
}) {
  const design = useDesign();
  const [expanded, setExpanded] = useState(false), tools = useTools(), run = state.run;
  if (!run) return null;
  const reference = tools.routes.find(route => route.id === run.routeId);
  const last = run.points.at(-1)?.fix;
  return <View style={{ gap: 14 }}>
    <Pressable accessibilityRole="button" accessibilityLabel="Carte, allure et rythme" accessibilityState={{ expanded }} aria-expanded={expanded}
      onPress={() => setExpanded(!expanded)} style={{ minHeight: 48, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderTopWidth: 1, borderTopColor: design.line }}>
      <BodyText style={{ fontSize: 13, fontWeight: '600' }}>Carte, allure et rythme</BodyText><Icon name={expanded ? 'chevron-up' : 'chevron-down'} size={17} color={design.secondary} />
    </Pressable>
    {expanded && <>
      <PacingProgressPanel run={run} running={state.running} quality={state.quality} />
      <PaceHistory run={run} live />
      <RhythmTools compact />
      <MiniPlayer
        active={active}
        onExpand={onMusic}
        foregroundOnlyRun={(state.running || state.autoPaused) && !state.backgroundActive}
      />
      <Kicker>VOTRE PARCOURS</Kicker>
      <RouteMap points={run.points} reference={reference?.segments} current={last && ['good', 'stationary'].includes(state.quality) && Date.now() - last.timestamp < 8000 ? last : undefined} height={190} />
    </>}
  </View>;
}
