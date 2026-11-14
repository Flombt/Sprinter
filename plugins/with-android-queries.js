// Android 11+ : déclare les applications interrogées (équivalent de LSApplicationQueriesSchemes, §11).
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = function withAndroidQueries(config) {
  return withAndroidManifest(config, (result) => {
    const manifest = result.modResults.manifest;
    manifest.queries = manifest.queries ?? [{}];
    const queries = manifest.queries[0];
    queries.package = queries.package ?? [];
    if (!queries.package.some((entry) => entry.$?.['android:name'] === 'com.spotify.music')) {
      queries.package.push({ $: { 'android:name': 'com.spotify.music' } });
    }
    queries.intent = queries.intent ?? [];
    if (!queries.intent.some((entry) => entry.data?.some?.((data) => data.$?.['android:scheme'] === 'spotify'))) {
      queries.intent.push({ action: [{ $: { 'android:name': 'android.intent.action.VIEW' } }], data: [{ $: { 'android:scheme': 'spotify' } }] });
    }
    return result;
  });
};
