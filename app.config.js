module.exports = ({ config }) => {
  if (process.env.SPRINTER_SIDELOAD !== '1') return config;
  // Keep the normal App Store configuration intact; this is a separate build.
  const variant = JSON.parse(JSON.stringify(config));
  variant.extra = { ...variant.extra, sprinterSideload: true };
  delete variant.extra.eas?.build?.experimental?.ios?.appExtensions;
  variant.plugins = (variant.plugins ?? []).filter(plugin => {
    const name = Array.isArray(plugin) ? plugin[0] : plugin;
    return name !== 'expo-widgets' && name !== './plugins/with-sprinter-apple';
  });
  variant.plugins.push('./plugins/with-sprinter-sideload');
  return variant;
};
