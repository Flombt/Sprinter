/* eslint-disable @typescript-eslint/no-require-imports -- chargement paresseux volontaire : aucun module de compte au démarrage (§0.1). */
import { Platform } from 'react-native';
import { IS_EXPO_GO } from '../services/capabilities';
import { cancelled, type AppleCredential } from './accountStore';

/**
 * Connexions natives (§6.2). Les modules natifs sont chargés au moment du geste, jamais
 * au démarrage. Google exige un client de développement (pas Expo Go).
 */
export const appleSupported = Platform.OS === 'ios';
export const googleSupported =
  Platform.OS !== 'web' && !IS_EXPO_GO && !!process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID;

export async function appleCredential(): Promise<AppleCredential> {
  const Apple = require('expo-apple-authentication') as typeof import('expo-apple-authentication');
  const Crypto = require('expo-crypto') as typeof import('expo-crypto');
  if (!(await Apple.isAvailableAsync())) throw new Error('unavailable');
  // Nonce brut envoyé à Supabase, empreinte SHA-256 transmise à Apple.
  const rawNonce = `${Crypto.randomUUID()}${Crypto.randomUUID()}`.replace(/-/g, '');
  const hashed = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, rawNonce);
  try {
    const credential = await Apple.signInAsync({
      requestedScopes: [Apple.AppleAuthenticationScope.FULL_NAME, Apple.AppleAuthenticationScope.EMAIL],
      nonce: hashed,
    });
    if (!credential.identityToken) throw new Error('apple_no_token');
    const name = [credential.fullName?.givenName, credential.fullName?.familyName].filter(Boolean).join(' ').trim();
    return { identityToken: credential.identityToken, rawNonce, authorizationCode: credential.authorizationCode ?? null, fullName: name || null };
  } catch (error) {
    if ((error as { code?: string }).code === 'ERR_REQUEST_CANCELED') throw cancelled();
    throw error;
  }
}

let googleConfigured = false;
export async function googleIdToken(): Promise<string> {
  let module: typeof import('@react-native-google-signin/google-signin');
  try { module = require('@react-native-google-signin/google-signin'); } catch { throw new Error('unavailable'); }
  const { GoogleSignin, isSuccessResponse, isErrorWithCode, statusCodes } = module;
  if (!googleConfigured) {
    GoogleSignin.configure({
      webClientId: process.env.EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID,
      iosClientId: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
    });
    googleConfigured = true;
  }
  try {
    if (Platform.OS === 'android') await GoogleSignin.hasPlayServices({ showPlayServicesUpdateDialog: true });
    // Toujours proposer le choix du compte Google (ré-authentification, liaison).
    if (GoogleSignin.hasPreviousSignIn()) await GoogleSignin.signOut();
    const response = await GoogleSignin.signIn();
    if (!isSuccessResponse(response)) throw cancelled();
    if (!response.data.idToken) throw new Error('google_no_token');
    return response.data.idToken;
  } catch (error) {
    if (isErrorWithCode(error) && (error.code === statusCodes.SIGN_IN_CANCELLED || error.code === statusCodes.IN_PROGRESS)) throw cancelled();
    throw error;
  }
}