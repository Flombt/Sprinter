import { useEffect, useRef, useState } from 'react';
import { Platform, StyleSheet, View } from 'react-native';
import Constants, { ExecutionEnvironment } from 'expo-constants';
import MapView, { Marker } from 'react-native-maps';
import { Copy, Icon } from '../ui/components';
import { useTheme } from '../ui/theme';
import { radii } from '../ui/tokens';
import { itemIcon, markerLabel, type MapCanvasProps } from './mapCanvasProps';
import OfflineMap from './OfflineMap';

function NativeMap({ camera, onMove, clusters, onSelect }: MapCanvasProps) {
  const { colors, reduceMotion } = useTheme();
  const map = useRef<MapView>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    if (ready) map.current?.animateToRegion(camera, reduceMotion ? 0 : 220);
  }, [camera, ready, reduceMotion]);
  return (
    <MapView
      ref={map}
      style={StyleSheet.absoluteFill}
      initialRegion={camera}
      onMapReady={() => setReady(true)}
      onRegionChangeComplete={onMove}
      userInterfaceStyle={colors.dark ? 'dark' : 'light'}
      mapType="standard"
      toolbarEnabled={false}
      showsUserLocation={false}
      showsPointsOfInterests={false}
      accessibilityLabel="Carte des rendez-vous et des lieux de course"
    >
      {clusters.map((cluster) => {
        const item = cluster.items.length === 1 ? cluster.items[0] : undefined;
        return (
          <Marker
            key={cluster.id}
            coordinate={cluster.point}
            accessibilityLabel={markerLabel(cluster)}
            onPress={(event) => {
              event.stopPropagation();
              onSelect(cluster);
            }}
            title={markerLabel(cluster)}
            stopPropagation
          >
            <View
              style={{
                minWidth: 42,
                height: 42,
                paddingHorizontal: 4,
                alignItems: 'center',
                justifyContent: 'center',
                borderWidth: 1.5,
                borderColor: colors.accentText,
                backgroundColor: colors.surface,
                borderRadius: item?.kind === 'race' ? radii.control : radii.pill,
              }}
            >
              {item ? (
                <Icon size={18} name={itemIcon[item.kind]} color={colors.accentText} />
              ) : (
                <Copy variant="emphasis">{cluster.items.length}</Copy>
              )}
            </View>
          </Marker>
        );
      })}
    </MapView>
  );
}

export default function MapCanvas(props: MapCanvasProps) {
  const provider =
    Platform.OS === 'ios' ||
    Constants.executionEnvironment === ExecutionEnvironment.StoreClient ||
    !!Constants.expoConfig?.android?.config?.googleMaps?.apiKey;
  return provider ? <NativeMap {...props} /> : <OfflineMap {...props} />;
}
