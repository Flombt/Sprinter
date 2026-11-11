const { withEntitlementsPlist, withInfoPlist } = require('expo/config-plugins');

module.exports = function withSprinterSideload(config) {
  config = withEntitlementsPlist(config, mod => {
    delete mod.modResults['com.apple.developer.healthkit'];
    delete mod.modResults['com.apple.developer.healthkit.access'];
    delete mod.modResults['com.apple.developer.healthkit.background-delivery'];
    delete mod.modResults['com.apple.security.application-groups'];
    return mod;
  });
  return withInfoPlist(config, mod => {
    delete mod.modResults.NSHealthShareUsageDescription;
    delete mod.modResults.NSHealthUpdateUsageDescription;
    delete mod.modResults.NSSupportsLiveActivities;
    delete mod.modResults.NSSupportsLiveActivitiesFrequentUpdates;
    mod.modResults.NSMotionUsageDescription = 'Si vous activez la cadence mesurée, Sprinter utilise les mouvements de l’iPhone pour estimer vos pas par minute pendant une course au premier plan.';
    return mod;
  });
};
