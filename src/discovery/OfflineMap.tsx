import { useMemo } from 'react';
import { PanResponder, Pressable, View } from 'react-native';
import { Copy, Icon } from '../ui/components';
import { useTheme } from '../ui/theme';
import { layout, radii } from '../ui/tokens';
import { MapBackdrop } from './MapBackdrop';
import { itemIcon, markerLabel, type MapCanvasProps } from './mapCanvasProps';
import { locateOnMap } from './mapModel';

export default function OfflineMap({ region, width, height, clusters, onMove, onSelect }: MapCanvasProps) {
  const { colors } = useTheme();
  const pan = useMemo(
    () =>
      PanResponder.create({
        onMoveShouldSetPanResponder: (_, gesture) => Math.hypot(gesture.dx, gesture.dy) > 9,
        onPanResponderRelease: (_, gesture) =>
          onMove({
            ...region,
            latitude: Math.max(
              -85,
              Math.min(85, region.latitude + (gesture.dy / height) * region.latitudeDelta),
            ),
            longitude: Math.max(
              -179,
              Math.min(179, region.longitude - (gesture.dx / width) * region.longitudeDelta),
            ),
          }),
      }),
    [height, onMove, region, width],
  );
  return (
    <View style={{ flex: 1 }} {...pan.panHandlers}>
      <MapBackdrop region={region} width={width} height={height} captions />
      {clusters.map((cluster) => {
        const { x, y } = locateOnMap(cluster.point, region);
        const item = cluster.items.length === 1 ? cluster.items[0] : undefined;
        return (
          <Pressable
            key={cluster.id}
            accessibilityLabel={markerLabel(cluster)}
            accessibilityRole="button"
            onPress={() => onSelect(cluster)}
            style={({ pressed }) => ({
              position: 'absolute',
              left: Math.max(0, Math.min(width - layout.touch, x * width - 22)),
              top: Math.max(0, Math.min(height - layout.touch, y * height - 22)),
              width: layout.touch,
              height: layout.touch,
              borderRadius: item?.kind === 'race' ? radii.control : radii.pill,
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: colors.surface,
              borderColor: colors.accentText,
              borderWidth: 1.5,
              opacity: pressed ? 0.8 : 1,
            })}
          >
            {item ? (
              <Icon name={itemIcon[item.kind]} color={colors.accentText} size={18} />
            ) : (
              <Copy variant="emphasis">{cluster.items.length}</Copy>
            )}
          </Pressable>
        );
      })}
      <Copy
        muted
        variant="small"
        style={{
          position: 'absolute',
          right: 5,
          bottom: 4,
          color: colors.text,
          backgroundColor: colors.surface,
          paddingHorizontal: 5,
          borderRadius: radii.sm,
        }}
      >
        Contours IGN / Etalab
      </Copy>
    </View>
  );
}
