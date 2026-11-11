import Constants, { ExecutionEnvironment } from 'expo-constants';
import { Platform } from 'react-native';
export const IS_EXPO_GO = Constants.executionEnvironment === ExecutionEnvironment.StoreClient;
export const IS_SIDELOAD_BUILD = Constants.expoConfig?.extra?.sprinterSideload === true;
export const CAN_BACKGROUND = !IS_EXPO_GO && Platform.OS !== 'web';
export const LOCATION_TASK = 'sprinter.active-run.location.v1';
