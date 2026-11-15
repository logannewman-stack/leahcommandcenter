import globals from "globals";
import pluginJs from "@eslint/js";
import pluginReact from "eslint-plugin-react";
import pluginReactHooks from "eslint-plugin-react-hooks";
import pluginUnusedImports from "eslint-plugin-unused-imports";

const shared = {
  "no-unused-vars": "off",
  "no-empty": ["error", { allowEmptyCatch: true }],
  "unused-imports/no-unused-imports": "error",
  "unused-imports/no-unused-vars": [
    "warn",
    { vars: "all", varsIgnorePattern: "^_", args: "after-used", argsIgnorePattern: "^_", ignoreRestSiblings: true }
  ]
};

export default [
  { ignores: ["dist/**", "node_modules/**", ".vercel/**"] },
  {
    files: ["src/**/*.{js,jsx}"],
    languageOptions: {
      globals: globals.browser,
      parserOptions: { ecmaVersion: 2022, sourceType: "module", ecmaFeatures: { jsx: true } }
    },
    settings: { react: { version: "detect" } },
    plugins: { react: pluginReact, "react-hooks": pluginReactHooks, "unused-imports": pluginUnusedImports },
    rules: {
      ...pluginJs.configs.recommended.rules,
      ...pluginReact.configs.flat.recommended.rules,
      ...shared,
      "react/jsx-uses-vars": "error",
      "react/jsx-uses-react": "error",
      "react/prop-types": "off",
      "react/react-in-jsx-scope": "off",
      "react/no-unescaped-entities": "off",
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn"
    }
  },
  {
    files: ["api/**/*.js", "tests/**/*.mjs", "*.config.js"],
    languageOptions: {
      globals: { ...globals.node, ...globals.es2022 },
      parserOptions: { ecmaVersion: 2022, sourceType: "module" }
    },
    plugins: { "unused-imports": pluginUnusedImports },
    rules: { ...pluginJs.configs.recommended.rules, ...shared }
  }
];
