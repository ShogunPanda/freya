{
  "env": {
    "targets": "node >= 20"
  },
  "jsc": {
    "target": "ESNext",
    "parser": {
      "syntax": "typescript",
      "tsx": true,
      "dynamicImport": true
    },
    "transform": {
      "react": {
        "runtime": "automatic",
        "importSource": "preact",
        "pragmaFrag": "Fragment",
        "throwIfNamespace": true,
        "development": false,
        "useBuiltins": false
      }
    }
  }
}
