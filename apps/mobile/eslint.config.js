// https://docs.expo.dev/guides/using-eslint/
const { defineConfig } = require('eslint/config');
const expoConfig = require("eslint-config-expo/flat");

module.exports = defineConfig([
  expoConfig,
  {
    ignores: ["dist/*", ".expo/*", "node_modules/*"],
  },
  {
    settings: {
      "import/ignore": [
        "react-native",
        "@expo/vector-icons",
        "expo-.*",
      ],
    },
    rules: {
      // Disable import/no-unresolved for packages that are resolved at runtime
      "import/no-unresolved": ["error", {
        ignore: [
          "^@expo/vector-icons$",
          "^expo-.*",
          "^react-native$",
          "^react-native-.*",
        ]
      }],
    },
  },
]);
