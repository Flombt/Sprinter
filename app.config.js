// Connexion Google native (§6.2) : le plugin n'est ajouté que si le schéma iOS du client
// OAuth est fourni (EAS env). Sans lui, la configuration reste strictement inchangée.
function withGoogleSignIn(config) {
  const scheme = process.env.EXPO_PUBLIC_GOOGLE_IOS_URL_SCHEME;
  if (!scheme) return config;
  return { ...config, plugins: [...(config.plugins ?? []), ['@react-native-google-signin/google-signin', { iosUrlScheme: scheme }]] };
}

module.exports = ({ config: input }) => {
  const config = withGoogleSignIn(input);
  if (process.env.SPRINTER_SIDELOAD !== '1') return config;
  // Keep the normal App Store configuration intact; this is a separate build.
  const variant = JSON.parse(JSON.stringify(config));
  variant.extra = { ...variant.extra, sprinterSideload: true };
  delete variant.extra.eas?.build?.experimental?.ios?.appExtensions;
  variant.plugins = (variant.plugins ?? []).filter(plugin => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'expo-widgets' && name !== './plugins/with-sprinter-apple' && name !== 'expo-apple-authentication';
  });
  // Un compte Apple personnel ne peut pas signer la capacité « Sign in with Apple ».
  variant.ios = { ...variant.ios };
  delete variant.ios.usesAppleSignIn;
  variant.plugins.push('./plugins/with-sprinter-sideload');
  return variant;
};
