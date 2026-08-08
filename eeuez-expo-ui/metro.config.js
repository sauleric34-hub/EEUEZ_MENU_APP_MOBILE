// eslint-disable-next-line @typescript-eslint/no-var-requires
const { getDefaultConfig } = require('expo/metro-config');

const config = getDefaultConfig(__dirname);

// Metro 0.83's "package exports" resolution (activé par défaut) casse la
// résolution d'imports relatifs internes à react-native-worklets/reanimated
// (ex. « Unable to resolve './featureFlags' ») alors que ces fichiers
// existent bel et bien sur disque. Le désactiver revient au résolveur
// classique, qui gère ces imports relatifs sans problème.
config.resolver.unstable_enablePackageExports = false;

module.exports = config;
