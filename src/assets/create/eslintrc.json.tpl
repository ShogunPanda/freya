{
  "parser": "espree",
  "parserOptions": {
    "ecmaVersion": 2022
  },
  "env": {
    "browser": true
  },
  "extends": ["@cowtech/eslint-config"],
  "overrides": [
    {
      "files": ["*.ts", "*.tsx"],
      "env": {
        "node": true,
        "browser": false
      },
      "parser": "@typescript-eslint/parser",
      "parserOptions": {
        "project": "tsconfig.json"
      },
      "extends": ["@cowtech/eslint-config/typescript"]
    }
  ]
}
