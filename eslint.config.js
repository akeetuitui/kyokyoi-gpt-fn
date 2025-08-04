module.exports = {
  files: ["**/*.js"],
  languageOptions: {
    ecmaVersion: 2021,
    sourceType: "module",
  },
  rules: {
    quotes: ["error", "double"],
    indent: ["error", 2],
    "max-len": ["error", { "code": 100 }],
    "no-trailing-spaces": "error",
    "object-curly-spacing": ["error", "always"],
    "comma-dangle": ["error", "always-multiline"],
    "arrow-parens": ["error", "always"],
    "padded-blocks": ["error", "never"],
    "camelcase": ["warn", { "properties": "never" }],
  },
};
