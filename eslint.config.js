import js from "@eslint/js";
import globals from "globals";
import { defineConfig } from "eslint/config";

export default defineConfig([
  {
    ignores: ["dist/**", "coverage/**"],
  },

  {
    files: ["**/*.{js,mjs,cjs}"],
    plugins: { js },
    extends: ["js/recommended"],
  },

  {
    files: ["src/**/*.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.browser,
    },

    rules: {
      eqeqeq: "error",
      "no-var": "error",
      "prefer-const": "warn",
    },
  },

  {
    files: ["webpack.*.js", "eslint.config.js"],

    languageOptions: {
      ecmaVersion: "latest",
      sourceType: "module",
      globals: globals.node,
    },
  },
]);
