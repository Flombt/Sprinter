const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');
module.exports = function withSprinterApple(config) {
  config = withEntitlementsPlist(config, mod => {
    mod.modResults['com.apple.developer.healthkit'] = true;
    return mod;
  });
  return withInfoPlist(config, mod => {
    mod.modResults.NSMotionUsageDescription = 'Si vous activez la cadence mesurée, Sprinter utilise les mouvements de l’iPhone pour estimer vos pas par minute pendant une course au premier plan.';
    mod.modResults.NSHealthShareUsageDescription = 'Avec votre accord, Sprinter lit vos activités de course et leur distance pour vous permettre de les consulter ou de les importer localement.';
    mod.modResults.NSHealthUpdateUsageDescription = 'Avec votre accord, Sprinter ajoute vos courses terminées et leur distance dans Apple Santé. Aucun accès aux autres données de santé n’est demandé.';
    return mod;
  });
};
