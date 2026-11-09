import { HStack, Text, VStack } from '@expo/ui/swift-ui';
import { font, padding, privacySensitive } from '@expo/ui/swift-ui/modifiers';
import { createLiveActivity, type LiveActivityEnvironment } from 'expo-widgets';

export interface RunLiveProps {
  runId: string; running: boolean; capturedAt: number; expiresAt: number; activeSeconds: number;
  elapsed: string; distance: string; pace: string; status: string;
}
function RunLayout(props: RunLiveProps, environment: LiveActivityEnvironment) {
  'widget';
  const stale = environment.isStale === true;
  const timer = props.running && !stale
    ? <Text timerInterval={{ lower: new Date(props.capturedAt - props.activeSeconds * 1000), upper: new Date(props.expiresAt) }} countsDown={false} modifiers={[font({ size: 25, weight: 'semibold' }), privacySensitive()]} />
    : <Text modifiers={[font({ size: 25, weight: 'semibold' }), privacySensitive()]}>{props.elapsed}</Text>;
  return {
    banner: <VStack spacing={8} modifiers={[padding({ all: 14 })]}>
      <Text>{stale ? 'Sprinter · Actualisation interrompue' : `Sprinter · ${props.status}`}</Text>
      {timer}
      <Text modifiers={[privacySensitive()]}>{stale ? 'Dernier temps reçu ci-dessus · ouvrez Sprinter' : `${props.distance} km · ${props.pace} /km`}</Text>
    </VStack>,
    compactLeading: <Text modifiers={[privacySensitive()]}>{stale ? 'GPS —' : `${props.distance} km`}</Text>,
    compactTrailing: <Text modifiers={[privacySensitive()]}>{stale ? '—' : props.pace}</Text>,
    minimal: <Text>{stale ? '—' : props.running ? '▶' : 'Ⅱ'}</Text>,
    expandedLeading: <Text modifiers={[privacySensitive()]}>{stale ? '—' : `${props.distance} km`}</Text>,
    expandedTrailing: <Text modifiers={[privacySensitive()]}>{stale ? '—' : `${props.pace} /km`}</Text>,
    expandedCenter: <VStack>{timer}</VStack>,
    expandedBottom: <HStack><Text>{stale ? 'Actualisation interrompue · ouvrez Sprinter' : props.status}</Text></HStack>,
  };
}
export default createLiveActivity<RunLiveProps>('SprinterRunActivity', RunLayout);
