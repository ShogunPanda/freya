{
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "project": "tsconfig.json"
  },
  "extends": ["@cowtech/eslint-config/react-with-typescript"],
  "overrides": [
    {
      "files": ["*.js"],
      "parser": "espree",
      "parserOptions": {
        "ecmaVersion": 2020
      },
      "extends": ["@cowtech/eslint-config"],
      "rules": {
        "@typescript-eslint/typedef": 0,
        "@typescript-eslint/require-await": 0
      }
    }
  ]
}
