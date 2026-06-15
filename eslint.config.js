import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.webextensions,
      },
    },
    rules: {
      "no-unused-vars": "warn",
      "semi": "error",
      "quotes": ['error', 'single'],
      "no-console": "off",
    },
  },
];
