import { StyleSheet, View } from 'react-native';
import { Icon } from './components';
import { useTheme } from './theme';

const grid = Array.from({ length: 11 }, (_, index) => (index + 1) * 8.33);

export function MapPlaceholder() {
  const { colors } = useTheme();
  return <View accessible={false} pointerEvents="none" style={[StyleSheet.absoluteFill, styles.canvas, { backgroundColor: colors.field }]}>
    {grid.map(position => <View key={position} style={[styles.vertical, { left: `${position}%`, backgroundColor: colors.line }]} />)}
    {grid.map(position => <View key={position} style={[styles.horizontal, { top: `${position}%`, backgroundColor: colors.line }]} />)}
    <View style={[styles.reticle, { borderColor: colors.controlLine, backgroundColor: colors.surface }]}>
      <Icon name="locate-outline" size={28} color={colors.secondary} />
    </View>
  </View>;
}

const styles = StyleSheet.create({
  canvas: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  vertical: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth },
  horizontal: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth },
  reticle: { width: 66, height: 66, borderRadius: 33, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
});
