import React from 'react';
import NativeSlider from '@react-native-community/slider';
import { useTheme } from './theme';
import { layout } from './tokens';

export default function RangeSlider(props: React.ComponentProps<typeof NativeSlider>) {
  const { colors } = useTheme();
  return (
    <NativeSlider
      {...props}
      minimumTrackTintColor={props.minimumTrackTintColor ?? colors.accentText}
      maximumTrackTintColor={props.maximumTrackTintColor ?? colors.line}
      thumbTintColor={props.thumbTintColor ?? colors.accentText}
      style={[{ minHeight: layout.touch }, props.style]}
    />
  );
}
