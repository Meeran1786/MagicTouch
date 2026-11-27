// ESLint (flat config): one set of rules for every file we write. See CODE-STANDARD.md.
import js from "@eslint/js";
import globals from "globals";

export default [
  { ignores: ["public/vendor/**", "node_modules/**", "tests/browser/out/**"] },
  js.configs.recommended,
  {
    // browser code: the wall pages, templates and shared modules
    files: ["public/**/*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.browser } },
  },
  {
    // the offline server, tools and tests
    files: ["server/**/*.js", "tools/**/*.js", "tests/**/*.js", "*.js"],
    languageOptions: { ecmaVersion: 2023, sourceType: "module", globals: { ...globals.node } },
  },
  {
    files: ["**/*.cjs"],
    languageOptions: { ecmaVersion: 2023, sourceType: "commonjs", globals: { ...globals.node, ...globals.browser } },
  },
  {
    rules: {
      "no-unused-vars": ["error", { args: "none", caughtErrors: "none", ignoreRestSiblings: true }],
      "no-var": "error",
      "prefer-const": "error",
      eqeqeq: ["error", "smart"],
      "no-implicit-globals": "error",
      "no-eval": "error",
      "no-new-func": "error",
    },
  },
];
